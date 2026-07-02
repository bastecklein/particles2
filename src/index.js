const MAX_P   = 3000;          // hard particle cap; raise if needed
const TWO_PI  = Math.PI * 2;

/** Particle shape type */
const T_CIRCLE = 0;
const T_LINE   = 1;   // renders as a velocity-direction streak — used for rain

/**
 * Registered composite operations.
 * Index must stay stable — it is stored per-particle as a uint8.
 */
const COMP_STRS = ["screen", "lighter", "source-over", "multiply"];
const COMP_IDX  = { screen: 0, lighter: 1, "source-over": 2, multiply: 3 };

const DUST_GROUND_PALETTES = {
    dirt:   { color: "#A1887F", detailColor: "#8D6E63" },
    sand:   { color: "#D7CCC8", detailColor: "#BCAAA4" },
    mud:    { color: "#8D6E63", detailColor: "#6D4C41" },
    clay:   { color: "#A98274", detailColor: "#8E6E63" },
    ash:    { color: "#9E9E9E", detailColor: "#757575" },
    snow:   { color: "#ECEFF1", detailColor: "#CFD8DC" },
    grass:  { color: "#9FAF88", detailColor: "#7F8F6D" },
    mars:   { color: "#B56A4A", detailColor: "#8F4A33" },
    lunar:  { color: "#B0BEC5", detailColor: "#90A4AE" }
};

function resolveDustPalette(options) {
    const groundType = (typeof options.groundType === "string" ? options.groundType : "dirt").toLowerCase();
    const userGroundColors = options.groundColors && typeof options.groundColors === "object" ? options.groundColors : null;

    let palette = DUST_GROUND_PALETTES[groundType] || DUST_GROUND_PALETTES.dirt;

    if(userGroundColors && userGroundColors[groundType]) {
        const custom = userGroundColors[groundType];

        if(typeof custom === "string") {
            palette = {
                color: custom,
                detailColor: palette.detailColor
            };
        } else if(custom && typeof custom === "object") {
            palette = {
                color: custom.color || palette.color,
                detailColor: custom.detailColor || custom.secondary || palette.detailColor
            };
        }
    }

    return palette;
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Creates and returns a new ParticleEngine instance.
 * @returns {ParticleEngine}
 */
export function getInstance() {
    return new ParticleEngine();
}

/**
 * Returns the names of all built-in effect programs.
 * @returns {string[]}
 */
export function getPrograms() {
    return Object.keys(EFFECT_PROGRAMS);
}

// ─── engine ───────────────────────────────────────────────────────────────────

export class ParticleEngine {
    constructor() {
        const N = MAX_P;

        // ── SoA particle data ─────────────────────────────────────────────────
        // Active particles occupy the contiguous range [0 .. count-1]
        this._x     = new Float32Array(N);   // screen x
        this._y     = new Float32Array(N);   // screen y
        this._vx    = new Float32Array(N);   // velocity x
        this._vy    = new Float32Array(N);   // velocity y
        this._sz    = new Float32Array(N);   // radius (circle) or half-width (line)
        this._gr    = new Float32Array(N);   // size growth per tick
        this._al    = new Float32Array(N);   // alpha  [0–1]
        this._fd    = new Float32Array(N);   // alpha fade per tick
        this._gx    = new Float32Array(N);   // gravity x (added to vx each tick)
        this._gy    = new Float32Array(N);   // gravity y (added to vy each tick)
        this._age   = new Float32Array(N);   // age in ticks
        this._hld   = new Float32Array(N);   // holdoff — particle hidden until hld<=0
        this._acc   = new Float32Array(N);   // velocity acceleration fraction per tick
        this._sLen  = new Float32Array(N);   // line streak scale factor (T_LINE only)

        this._type  = new Uint8Array(N);     // T_CIRCLE | T_LINE
        this._comp  = new Uint8Array(N);     // index into COMP_STRS
        this._colorI = new Uint8Array(N);    // index into _colorTable (max 254 entries)
        this._flags = new Uint8Array(N);     // bit 0=loopsBack  bit 1=useGlobalAngle  bit 2=trails
        this._light = new Uint8Array(N);     // 0=unlit (default), 1=lit
        this._space = new Uint8Array(N);     // 0=screen-space, 1=world-space

        // ── colour registry ───────────────────────────────────────────────────
        this._colorTable = ["#ffffff"];      // index 0 is always white
        this._colorLut   = { "#ffffff": 0 };

        // ── render / sort buffers  (pre-allocated — zero GC per frame) ────────
        // packed Uint32:  high 20 bits = sort key (comp×12 + colorIdx×4 + alphaQ)
        //                 low  12 bits = particle index  (max 4095 ≤ MAX_P)
        this._sortBuf = new Uint32Array(N);

        // deferred spawn queue — avoids mutating particle arrays mid-update loop
        this._spawnQ = [];

        // ── active count ──────────────────────────────────────────────────────
        this.count = 0;

        // ── weather / environment state ───────────────────────────────────────
        this.snowRunning     = false;
        this.rainRunning     = false;
        this.embersRunning   = false;
        this.starfieldRunning = false;

        // ── starfield settings (API compatibility with particles2) ────────────
        this.starfieldColor        = "#ffffff";
        this.starfieldPasses       = 1;
        this.starfieldSpeed        = 0.125;
        this.starfieldTrails       = false;
        this.starfieldStarSize     = 0.3;
        this.starfieldGrowth       = 0.00375;
        this.starfieldAcceleration = 0.015;
        this.starfieldMaxHoldoff   = 289;

        // ── shared mutable state ──────────────────────────────────────────────
        this.offsetX = 0;
        this.offsetY = 0;
        this.middleX = 0;
        this.middleY = 0;

        /**
         * Global horizontal / vertical wind (pixels per tick).
         * Applied to all particles regardless of useGlobalAngle.
         */
        this.windX = 0;
        this.windY = 0;

        /**
         * Spawn-rate multiplier for weather emitters.
         * 0.25 = low quality, 0.5 = medium, 1.0 = full.
         */
        this.qualityMult = 1.0;

        this._rndAngle = 0;
        this._screenW  = 800;
        this._screenH  = 600;
    }

    // ── colour registry ───────────────────────────────────────────────────────

    _colorToIdx(color) {
        let idx = this._colorLut[color];
        if(idx === undefined) {
            if(this._colorTable.length >= 254) return 0;   // table full → fallback white
            idx = this._colorTable.length;
            this._colorTable.push(color);
            this._colorLut[color] = idx;
        }
        return idx;
    }

    // ── particle allocation (appends to contiguous pool) ─────────────────────

    /**
     * Spawns a single particle from an options object.
     * Supports the same option keys as particles2.playParticle(), plus:
     *   type      {number}  T_CIRCLE (default) | T_LINE
     *   sLen      {number}  Line streak scale factor (default 0.08)
     *   windX/Y             Ignored — use engine.windX/Y instead
    *   space     {string}  "screen" (default) or "world"
     */
    playParticle(opt) {
        if(this.count >= MAX_P) return;

        const i = this.count++;

        // Randomise velocity if rVX / rVY supplied (particles2 API compat)
        const rX = opt.rVX != null ? (Math.random() * opt.rVX * 2) - opt.rVX : 0;
        const rY = opt.rVY != null ? (Math.random() * opt.rVY * 2) - opt.rVY : 0;

        // Randomise size if rSize [min, max] supplied
        const sz = (opt.rSize != null)
            ? opt.rSize[0] + Math.random() * (opt.rSize[1] - opt.rSize[0])
            : (opt.size ?? 1);

        this._x[i]    = (opt.x || 0) + (opt.xDev ? (Math.random() * opt.xDev * 2 - opt.xDev) : 0);
        this._y[i]    = (opt.y || 0) + (opt.yDev ? (Math.random() * opt.yDev * 2 - opt.yDev) : 0);
        this._vx[i]   = (opt.vx ?? 0) + rX;
        this._vy[i]   = (opt.vy ?? 0) + rY;
        this._sz[i]   = sz;
        this._gr[i]   = opt.growth    ?? 0;
        this._al[i]   = opt.alpha     ?? 1;
        this._fd[i]   = opt.fade      ?? 0.01;
        this._gx[i]   = opt.gravityX  ?? 0;
        this._gy[i]   = opt.gravityY  ?? 0;
        this._age[i]  = 0;
        this._hld[i]  = opt.holdoffTicks ?? 0;
        this._acc[i]  = opt.acceleration ?? 0;
        this._sLen[i] = opt.sLen ?? 0.08;

        this._type[i]   = opt.type ?? T_CIRCLE;
        this._comp[i]   = COMP_IDX[opt.compOp ?? "screen"] ?? 0;
        this._colorI[i] = this._colorToIdx(opt.color ?? "#ffffff");
        this._light[i]  = (opt.lightMode === "lit" || opt.lightMode === 1) ? 1 : 0;
        this._space[i]  = (opt.space === "world" || opt.space === 1) ? 1 : 0;

        let flags = 0;
        if(opt.loopsBack)      flags |= 1;
        if(opt.useGlobalAngle) flags |= 2;
        if(opt.trails)         flags |= 4;
        this._flags[i] = flags;
    }

    // ── particle removal — O(1) swap-delete ───────────────────────────────────

    _killAt(i) {
        const last = --this.count;
        if(i === last) return;          // was already the last slot
        this._x[i]     = this._x[last];
        this._y[i]     = this._y[last];
        this._vx[i]    = this._vx[last];
        this._vy[i]    = this._vy[last];
        this._sz[i]    = this._sz[last];
        this._gr[i]    = this._gr[last];
        this._al[i]    = this._al[last];
        this._fd[i]    = this._fd[last];
        this._gx[i]    = this._gx[last];
        this._gy[i]    = this._gy[last];
        this._age[i]   = this._age[last];
        this._hld[i]   = this._hld[last];
        this._acc[i]   = this._acc[last];
        this._sLen[i]  = this._sLen[last];
        this._type[i]  = this._type[last];
        this._comp[i]  = this._comp[last];
        this._colorI[i] = this._colorI[last];
        this._flags[i] = this._flags[last];
        this._light[i] = this._light[last];
        this._space[i] = this._space[last];
    }

    // ── update ────────────────────────────────────────────────────────────────

    update(delta) {
        if(!delta || delta > 20) delta = 1;

        this._rndAngle += 0.002 * delta;

        const sw = this._screenW;
        const sh = this._screenH;
        const ox = this.offsetX;
        const oy = this.offsetY;
        const wx = this.windX;
        const wy = this.windY;
        const ra = this._rndAngle;

        // ── weather emitters ──────────────────────────────────────────────────
        if(this.snowRunning)     this._spawnSnow(sw, sh, ox, oy);
        if(this.rainRunning)     this._spawnRain(sw, sh, ox, oy);
        if(this.embersRunning)   this._spawnEmbers(sw, sh, ox, oy);
        if(this.starfieldRunning) this._spawnStars(sw, sh, ox, oy);

        // Flush deferred spawn queue (weather spawners use it)
        this._flushSpawnQ();

        // ── main update loop ──────────────────────────────────────────────────
        // Hot path: iterates flat typed arrays — CPU can prefetch each stride.
        let i = 0;
        while(i < this.count) {

            // Still waiting to appear
            if(this._hld[i] > 0) {
                this._hld[i] -= delta;
                i++;
                continue;
            }

            this._age[i] += delta;
            const flags = this._flags[i];

            // ── integration ───────────────────────────────────────────────────
            if(flags & 2) {
                // useGlobalAngle: position driven by global sine oscillator + wind
                this._x[i] += (Math.sin(ra) * 2 + wx) * delta;
            } else {
                this._x[i] += (this._vx[i] + wx) * delta;
            }
            this._y[i] += (this._vy[i] + wy) * delta;

            this._sz[i] += this._gr[i]  * delta;
            this._al[i] -= this._fd[i]  * delta;

            this._vx[i] += this._gx[i]  * delta;
            this._vy[i] += this._gy[i]  * delta;

            if(this._acc[i] !== 0) {
                this._vx[i] += this._vx[i] * this._acc[i] * delta;
                this._vy[i] += this._vy[i] * this._acc[i] * delta;
            }

            // ── death checks ──────────────────────────────────────────────────
            if(this._al[i] <= 0 || this._sz[i] <= 0) {
                this._killAt(i);
                continue;               // don't advance i — new particle was swapped in
            }

            if(this._al[i] > 1) this._al[i] = 1;

            // Bounds check only after a short grace period (avoids killing edge-spawned particles)
            if(this._age[i] > 80) {
                const px = this._x[i];
                const py = this._y[i];
                const minX = this._space[i] ? ox : 0;
                const minY = this._space[i] ? oy : 0;
                const maxX = minX + sw;
                const maxY = minY + sh;

                if(py < minY - 20 || py > maxY + 20) {
                    this._killAt(i); continue;
                }
                if(px < minX - 20 || px > maxX + 20) {
                    if(flags & 1) {     // loopsBack: wrap horizontally
                        this._x[i] = (px < minX) ? maxX : minX;
                    } else {
                        this._killAt(i); continue;
                    }
                }
            }

            // ── trails ────────────────────────────────────────────────────────
            // Deferred: avoids mutating arrays while iterating them
            if((flags & 4) && this._al[i] > 0.06) {
                this._spawnQ.push({
                    x: this._x[i],
                    y: this._y[i],
                    color: this._colorTable[this._colorI[i]],
                    vx: 0, vy: 0,
                    gravityX: 0, gravityY: 0,
                    fade: 0.2,
                    size: this._sz[i] * 0.65,
                    growth: 0,
                    alpha: this._al[i] * 0.3,
                    compOp: COMP_STRS[this._comp[i]],
                    lightMode: this._light[i] ? "lit" : "unlit",
                    space: this._space[i] ? "world" : "screen"
                });
            }

            i++;
        }

        this._flushSpawnQ();
    }

    _flushSpawnQ() {
        for(let k = 0; k < this._spawnQ.length; k++) {
            this.playParticle(this._spawnQ[k]);
        }
        this._spawnQ.length = 0;
    }

    // ── weather spawners ──────────────────────────────────────────────────────

    _spawnSnow(sw, sh, ox, oy) {
        if(Math.random() > 0.40 * this.qualityMult) return;

        // Occasional large background flake (creates depth illusion)
        if(Math.random() < 0.25) {
            this.playParticle({
                x: ox + Math.random() * sw, y: oy,
                vx: (Math.random() - 0.5) * 0.6, vy: 0.5 + Math.random() * 1.0,
                size: 2.8 + Math.random() * 2.2,
                growth: 0,
                color: "#ffffff",
                alpha: 0.12 + Math.random() * 0.18,
                compOp: "screen",
                fade: 0,
                lightMode: "lit",
                loopsBack: true, useGlobalAngle: true
            });
        }

        // Standard foreground flake
        this.playParticle({
            x: ox + Math.random() * sw, y: oy,
            vx: (Math.random() - 0.5) * 1.8, vy: 1.0 + Math.random() * 3.8,
            size: 0.4 + Math.random() * 1.8,
            growth: 0,
            color: "#ffffff",
            alpha: 0.45 + Math.random() * 0.5,
            compOp: "screen",
            fade: 0,
            lightMode: "lit",
            loopsBack: true, useGlobalAngle: true
        });
    }

    _spawnRain(sw, sh, ox, oy) {
        const n = Math.max(1, Math.round((1 + Math.random() * 3) * this.qualityMult));
        // Slight horizontal drift from wind; also adds visual angle to streaks
        const windBias = this.windX * 0.05;

        for(let k = 0; k < n; k++) {
            const spd = 9 + Math.random() * 7;
            this.playParticle({
                x: ox + Math.random() * (sw + 80) - 40, y: oy,
                vx: windBias * spd,
                vy: spd,
                size: 0.35 + Math.random() * 0.9,
                sLen: 0.09 + Math.random() * 0.05,   // streak length factor
                growth: 0,
                color: "#90CAF9",
                alpha: 0.16 + Math.random() * 0.24,
                compOp: "screen",
                fade: 0,
                lightMode: "lit",
                type: T_LINE
            });
        }
    }

    _spawnEmbers(sw, sh, ox, oy) {
        if(Math.random() > 0.45 * this.qualityMult) return;

        // Cycle through a hot palette — orange → amber → yellow
        const EMBER_PALETTE = ["#FF6D00", "#FF8F00", "#FFC107", "#FF3D00", "#FFAB40"];
        const color = EMBER_PALETTE[Math.floor(Math.random() * EMBER_PALETTE.length)];
        const sz  = 0.55 + Math.random() * 1.6;
        const bx  = ox + Math.random() * sw;
        const by  = oy + sh + 4;
        const vx  = (Math.random() - 0.5) * 2.8;
        const vy  = -(0.7 + Math.random() * 2.8);

        // Outer glow ember
        this.playParticle({
            x: bx, y: by, vx, vy,
            size: sz,
            growth: -0.003,
            color,
            alpha: 0.5 + Math.random() * 0.35,
            compOp: "screen",
            fade: 0.0018,
            loopsBack: true, useGlobalAngle: true
        });

        // Hot white inner core (spawned for ~half the embers)
        if(Math.random() < 0.5) {
            this.playParticle({
                x: bx, y: by, vx, vy,
                size: sz * 0.32,
                growth: -0.002,
                color: "#FFF9C4",
                alpha: 0.9,
                compOp: "screen",
                fade: 0.0025,
                loopsBack: true, useGlobalAngle: true
            });
        }
    }

    _spawnStars(sw, sh, ox, oy) {
        for(let k = 0; k < this.starfieldPasses; k++) {
            const mx = ox + sw / 2;
            const my = oy + sh / 2;
            const dx = (Math.random() - 0.5) * sw;
            const dy = (Math.random() - 0.5) * sh;
            const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
            const ratio = this.starfieldSpeed / dist;
            const gx = ratio * dx * (Math.random() < 0.5 ? -1 : 1);
            const gy = ratio * dy * (Math.random() < 0.5 ? -1 : 1);
            const col = Array.isArray(this.starfieldColor)
                ? this.starfieldColor[Math.floor(Math.random() * this.starfieldColor.length)]
                : this.starfieldColor;
            this.playParticle({
                x: mx, y: my,
                vx: gx, vy: gy,
                size: this.starfieldStarSize,
                growth: this.starfieldGrowth,
                color: col,
                alpha: 0,
                fade: -0.025,           // negative fade = particle fades IN
                compOp: "screen",
                trails: this.starfieldTrails,
                acceleration: this.starfieldAcceleration,
                holdoffTicks: Math.floor(Math.random() * this.starfieldMaxHoldoff)
            });
        }
    }

    // ── draw (batched) ────────────────────────────────────────────────────────
    //
    // Rendering strategy:
    //   Phase 1 — Lines (T_LINE): grouped by (compOp, color), alpha-bucketed.
    //             Each bucket = one beginPath + N lineTo calls + one stroke.
    //   Phase 2 — Circles (T_CIRCLE): pack sort key into Uint32, sort once,
    //             linear scan — change state only when (compOp|color|alpha) changes.
    //             Each group = one beginPath + N arc calls + one fill.
    //
    // State change count drops from O(N) in particles2 → O(compOps × colors × alphaBuckets).

    draw(context, pass = "all") {
        const canvas    = context.canvas;
        this._screenW   = canvas.width;
        this._screenH   = canvas.height;
        this.middleX    = this.offsetX + canvas.width  / 2;
        this.middleY    = this.offsetY + canvas.height / 2;

        const passMode = pass === "lit" ? 1 : pass === "unlit" ? 0 : -1;

        if(this.count === 0) return;

        context.save();

        // ── Phase 1: line particles ────────────────────────────────────────────
        // Scan once to find unique (compOp, colorIdx) pairs that have T_LINE entries
        const lineGroups = new Set();
        for(let i = 0; i < this.count; i++) {
            if(passMode !== -1 && this._light[i] !== passMode) continue;
            if(this._type[i] === T_LINE && this._hld[i] <= 0) {
                lineGroups.add((this._comp[i] << 8) | this._colorI[i]);
            }
        }

        if(lineGroups.size > 0) {
            context.lineCap = "round";

            for(const groupKey of lineGroups) {
                const compI = (groupKey >> 8) & 0xff;
                const ciIdx = groupKey & 0xff;

                context.globalCompositeOperation = COMP_STRS[compI];
                context.strokeStyle = this._colorTable[ciIdx];

                // 8 alpha buckets per group — each = one beginPath + N lineTo + stroke
                for(let b = 1; b <= 8; b++) {
                    const hiA  = b / 8;
                    const loA  = hiA - 0.125;
                    const midA = (loA + hiA) * 0.5;

                    let open = false;

                    for(let i = 0; i < this.count; i++) {
                        if(passMode !== -1 && this._light[i] !== passMode) continue;
                        if(this._type[i] !== T_LINE || this._hld[i] > 0) continue;
                        if(this._comp[i] !== compI || this._colorI[i] !== ciIdx) continue;
                        const al = this._al[i];
                        if(al <= loA || al > hiA) continue;

                        if(!open) {
                            context.globalAlpha = midA;
                            context.lineWidth   = this._sz[i] * 2;
                            context.beginPath();
                            open = true;
                        }

                        // Streak from current position backwards along velocity vector
                        const sl = this._sLen[i];
                        const drawX = this._space[i] ? this._x[i] - this.offsetX : this._x[i];
                        const drawY = this._space[i] ? this._y[i] - this.offsetY : this._y[i];

                        context.moveTo(drawX, drawY);
                        context.lineTo(
                            drawX - this._vx[i] * sl * 8,
                            drawY - this._vy[i] * sl * 8
                        );
                    }

                    if(open) context.stroke();
                }
            }
        }

        // ── Phase 2: circle particles ──────────────────────────────────────────
        // Build packed sort buffer: Uint32 = (sortKey << 12) | particleIndex
        //   sortKey bits: [13:12]=comp  [11:4]=colorIdx  [3:0]=alphaQ(0-15)
        // Sorting this numerically groups particles by (comp → color → alpha).
        //
        let sortCount = 0;
        for(let i = 0; i < this.count; i++) {
            if(passMode !== -1 && this._light[i] !== passMode) continue;
            if(this._type[i] !== T_CIRCLE || this._hld[i] > 0) continue;
            // quantise alpha into 16 buckets [1..16]
            const alphaQ = Math.max(1, Math.min(16, Math.ceil(this._al[i] * 16)));
            // sort key: 2 bits comp, 8 bits color, 4 bits alphaQ
            const key = (this._comp[i] << 12) | (this._colorI[i] << 4) | (alphaQ - 1);
            this._sortBuf[sortCount++] = (key << 12) | i;
        }

        if(sortCount > 0) {
            // In-place numeric sort on a subarray view — no allocation
            this._sortBuf.subarray(0, sortCount).sort();

            let lastComp  = -1;
            let lastColor = -1;
            let lastAQ    = -1;
            let batchOpen = false;

            for(let s = 0; s < sortCount; s++) {
                const packed = this._sortBuf[s];
                const idx    = packed & 0xfff;                     // low 12 bits = particle index
                const key    = packed >>> 12;                      // high 20 bits = sort key
                const compI  = (key >>> 12) & 0x3;
                const ciIdx  = (key >>>  4) & 0xff;
                const alphaQ = (key & 0xf) + 1;
                const alphaF = alphaQ / 16;

                const changed = (compI !== lastComp) || (ciIdx !== lastColor) || (alphaQ !== lastAQ);

                if(changed) {
                    if(batchOpen) {
                        context.fill();
                    }

                    if(compI  !== lastComp)  { context.globalCompositeOperation = COMP_STRS[compI]; lastComp  = compI; }
                    if(ciIdx  !== lastColor) { context.fillStyle = this._colorTable[ciIdx];          lastColor = ciIdx; }
                    if(alphaQ !== lastAQ)    { context.globalAlpha = alphaF;                          lastAQ    = alphaQ; }

                    context.beginPath();
                    batchOpen = true;
                }

                // moveTo before arc avoids implicit lineTo connecting arcs
                const drawX = this._space[idx] ? this._x[idx] - this.offsetX : this._x[idx];
                const drawY = this._space[idx] ? this._y[idx] - this.offsetY : this._y[idx];

                context.moveTo(drawX + this._sz[idx], drawY);
                context.arc(drawX, drawY, this._sz[idx], 0, TWO_PI);
            }

            if(batchOpen) context.fill();
        }

        context.restore();
    }

    // ── named effect programs ─────────────────────────────────────────────────

    playEffect(effectName, x, y) {
        const program = EFFECT_PROGRAMS[effectName];
        if(!program) return;

        for(let i = 0; i < program.length; i++) {
            const step = program[i];
            let count = step.count || 0;
            if(step.rCount) {
                count = step.rCount[0] + Math.floor(Math.random() * (step.rCount[1] - step.rCount[0] + 1));
            }

            for(let j = 0; j < count; j++) {
                const useX = x + (step.prX ? (Math.random() * step.prX * 2 - step.prX) : 0);
                const useY = y + (step.prY ? (Math.random() * step.prY * 2 - step.prY) : 0);

                if(step.program) {
                    this.playEffect(step.program, useX, useY);
                } else if(step.options) {
                    const o = Object.assign({}, step.options, { x: useX, y: useY });
                    this.playParticle(o);
                }
            }
        }
    }

    /**
     * Spawns a configurable smoke or dust poof at screen-space coordinates.
     *
     * Options (all optional):
     *  - x, y:           spawn center in screen coordinates
     *  - mode:           "smoke" (default) or "dust"
        *  - groundType:     dust palette key (dirt, sand, mud, clay, ash, snow, grass, mars, lunar)
        *  - groundColors:   optional custom palette map by groundType
     *  - count:          number of main particles before quality scaling
     *  - color:          base puff color
     *  - detailColor:    inner/detail puff color
     *  - compOp:         composite operation (default "source-over")
     *  - spreadX, spreadY
     *  - sizeMin, sizeMax
     *  - growthMin, growthMax
     *  - fadeMin, fadeMax
     *  - alphaMin, alphaMax
     *  - riseMin, riseMax
     *  - driftX, driftY: directional bias
     *  - jitterX, jitterY: random velocity variance
     *  - gravityY
     *  - windInfluence: scalar multiplier for engine wind
    *  - space:          "world" (default for smoke) or "screen"
     */
    playSmoke(options = {}) {
        const getNum = (val, fallback) => Number.isFinite(val) ? val : fallback;
        const rand = (min, max) => min + Math.random() * (max - min);

        const mode = options.mode === "dust" ? "dust" : "smoke";

        const x = getNum(options.x, this.middleX || this._screenW / 2);
        const y = getNum(options.y, this.middleY || this._screenH / 2);

        const dustPalette = mode === "dust" ? resolveDustPalette(options) : null;
        const defaultColor = mode === "dust" ? dustPalette.color : "#78909C";
        const defaultDetail = mode === "dust" ? dustPalette.detailColor : "#546E7A";

        const spreadX = getNum(options.spreadX, mode === "dust" ? 12 : 8);
        const spreadY = getNum(options.spreadY, mode === "dust" ? 6 : 10);

        const sizeMin = getNum(options.sizeMin, mode === "dust" ? 2.0 : 3.2);
        const sizeMax = getNum(options.sizeMax, mode === "dust" ? 5.5 : 8.5);

        const growthMin = getNum(options.growthMin, mode === "dust" ? 0.06 : 0.16);
        const growthMax = getNum(options.growthMax, mode === "dust" ? 0.18 : 0.42);

        const fadeMin = getNum(options.fadeMin, mode === "dust" ? 0.008 : 0.005);
        const fadeMax = getNum(options.fadeMax, mode === "dust" ? 0.016 : 0.010);

        const alphaMin = getNum(options.alphaMin, mode === "dust" ? 0.20 : 0.24);
        const alphaMax = getNum(options.alphaMax, mode === "dust" ? 0.38 : 0.50);

        const riseMin = getNum(options.riseMin, mode === "dust" ? -0.8 : -2.1);
        const riseMax = getNum(options.riseMax, mode === "dust" ? -0.2 : -0.7);

        const driftX = getNum(options.driftX, 0);
        const driftY = getNum(options.driftY, 0);

        const jitterX = getNum(options.jitterX, mode === "dust" ? 0.7 : 0.5);
        const jitterY = getNum(options.jitterY, mode === "dust" ? 0.4 : 0.6);

        const windInfluence = getNum(options.windInfluence, mode === "dust" ? 0.75 : 0.45);
        const gravityY = getNum(options.gravityY, mode === "dust" ? 0.008 : -0.003);
        const compOp = options.compOp || "source-over";
        const lightMode = options.lightMode || "lit";
        const space = options.space || "world";

        const requestedCount = Math.max(1, Math.floor(getNum(options.count, mode === "dust" ? 9 : 7)));
        const mainCount = Math.max(1, Math.round(requestedCount * this.qualityMult));
        const detailCount = Math.max(1, Math.round(mainCount * 0.45));

        const baseColor = options.color || defaultColor;
        const detailColor = options.detailColor || defaultDetail;

        for(let i = 0; i < mainCount; i++) {
            this.playParticle({
                x: x + rand(-spreadX, spreadX),
                y: y + rand(-spreadY, spreadY),
                vx: driftX + rand(-jitterX, jitterX) + (this.windX * windInfluence),
                vy: driftY + rand(riseMin, riseMax) + rand(-jitterY, jitterY) + (this.windY * windInfluence * 0.25),
                size: rand(sizeMin, sizeMax),
                growth: rand(growthMin, growthMax),
                color: baseColor,
                alpha: rand(alphaMin, alphaMax),
                fade: rand(fadeMin, fadeMax),
                gravityY,
                compOp,
                trails: !!options.trails,
                lightMode,
                space
            });
        }

        for(let i = 0; i < detailCount; i++) {
            this.playParticle({
                x: x + rand(-spreadX * 0.6, spreadX * 0.6),
                y: y + rand(-spreadY * 0.5, spreadY * 0.5),
                vx: driftX + rand(-jitterX * 0.65, jitterX * 0.65) + (this.windX * windInfluence * 0.85),
                vy: driftY + rand(riseMin * 0.85, riseMax * 0.85) + rand(-jitterY * 0.65, jitterY * 0.65) + (this.windY * windInfluence * 0.2),
                size: rand(Math.max(0.8, sizeMin * 0.45), Math.max(1.2, sizeMax * 0.6)),
                growth: rand(growthMin * 0.7, growthMax * 0.8),
                color: detailColor,
                alpha: rand(Math.min(1, alphaMin * 1.05), Math.min(1, alphaMax * 1.15)),
                fade: rand(fadeMin * 0.9, fadeMax * 1.1),
                gravityY,
                compOp,
                lightMode,
                space
            });
        }
    }

    /** Clears all active particles. */
    reset() {
        this.count = 0;
    }
}

// ─── built-in effect programs ──────────────────────────────────────────────────
//
// Each step: { count?, rCount?, prX?, prY?, program?, options? }
// options support all playParticle keys: rVX, rVY, rSize, xDev, yDev, etc.
//
// Layer order within an explosion:
//   1. Instant flash  (large, fast-fading, screen)
//   2. Hot burst core (fast, tight, screen)
//   3. Spark trails   (screen, trails:true, small, high velocity, weak gravity)
//   4. Shrapnel       (screen, medium particles, stronger gravity, trails:true)
//   5. Smoke puffs    (source-over, large, grow, rise slowly)

const EFFECT_PROGRAMS = {

    // ── fire explosion ─────────────────────────────────────────────────────
    explosion: [
        // 1. White flash
        { count: 1,  options: { size: 22, growth: 3.2, color: "#FFFFFF", fade: 0.20, alpha: 0.65, compOp: "screen" }},
        // 2. Orange hot core
        { count: 14, options: { rSize: [2, 9], color: "#FF8C00", fade: 0.034, rVX: 7, rVY: 7, growth: 0.14, compOp: "screen", alpha: 0.9 }},
        // 3. Yellow sparks — small, fast, trail
        { count: 22, options: { size: 1.2, color: "#FFEE58", fade: 0.052, rVX: 12, rVY: 12, gravityY: 0.10, compOp: "screen", alpha: 0.95, trails: true }},
        // 4. Red/orange shrapnel — medium, arcs, gravity
        { count: 16, options: { rSize: [1.5, 5], color: "#FF4500", fade: 0.027, rVX: 9, rVY: 9, gravityY: 0.08, compOp: "screen", alpha: 0.75, trails: true }},
        // 5. Grey smoke puffs
        { count: 7,  options: { rSize: [5, 12], color: "#607D8B", fade: 0.006, rVX: 2.5, rVY: 2.5, vy: -1.8, growth: 0.55, compOp: "source-over", alpha: 0.32 }},
        // 6. Dark smoke cores
        { count: 4,  options: { rSize: [3, 7],  color: "#37474F", fade: 0.005, rVX: 1.5, rVY: 1.5, vy: -1.3, growth: 0.30, compOp: "source-over", alpha: 0.45 }},
    ],

    // ── blue plasma explosion ──────────────────────────────────────────────
    blueexplosion: [
        { count: 1,  options: { size: 20, growth: 2.8, color: "#E3F2FD", fade: 0.18, alpha: 0.70, compOp: "screen" }},
        { count: 12, options: { rSize: [2, 7], color: "#29B6F6", fade: 0.030, rVX: 7, rVY: 7, growth: 0.12, compOp: "screen", alpha: 0.90 }},
        { count: 22, options: { size: 1.2, color: "#81D4FA", fade: 0.050, rVX: 11, rVY: 11, gravityY: 0.05, compOp: "screen", alpha: 0.85, trails: true }},
        { count: 10, options: { rSize: [2, 6], color: "#4FC3F7", fade: 0.024, rVX: 6, rVY: 6, growth: 0.15, compOp: "screen", alpha: 0.70 }},
        { count: 5,  options: { rSize: [4, 9], color: "#0277BD", fade: 0.007, rVX: 2, rVY: 2, vy: -1.2, growth: 0.42, compOp: "screen", alpha: 0.28 }},
    ],

    // ── blood splatter ─────────────────────────────────────────────────────
    bloodexplosion: [
        { count: 25, options: { rSize: [1, 5],   color: "#C62828", fade: 0.026, rVX: 7,  rVY: 7,  gravityY: 0.12, compOp: "source-over", alpha: 0.80 }},
        { count: 12, options: { size: 1.5,        color: "#EF9A9A", fade: 0.040, rVX: 9,  rVY: 9,  gravityY: 0.14, compOp: "source-over", alpha: 0.60, trails: true }},
        { count: 6,  options: { rSize: [3, 7],   color: "#B71C1C", fade: 0.014, rVX: 3,  rVY: 3,  growth: 0.06,   compOp: "source-over", alpha: 0.65 }},
    ],

    // ── electric / lightning burst ─────────────────────────────────────────
    smallelectricexplosion: [
        { count: 1,  options: { size: 14, growth: 4.5, color: "#FFFFFF", fade: 0.28, alpha: 0.60, compOp: "screen" }},
        { count: 20, options: { rSize: [1, 4], color: "#E1F5FE", fade: 0.060, rVX: 10, rVY: 10, compOp: "screen", alpha: 0.90, trails: true }},
        { count: 12, options: { size: 1.0,     color: "#B3E5FC", fade: 0.040, rVX: 7,  rVY: 7,  compOp: "screen", alpha: 0.70 }},
        { count: 8,  options: { rSize: [2, 6], color: "#4FC3F7", fade: 0.020, rVX: 5,  rVY: 5,  growth: 0.20, compOp: "screen", alpha: 0.50 }},
    ],

    // ── sparkle / success ──────────────────────────────────────────────────
    sparkle: [
        { count: 10, options: { rSize: [1, 3], color: "#FFF176", fade: 0.045, rVX: 5.5, rVY: 5.5, compOp: "screen", alpha: 1.0, trails: true }},
        { count: 6,  options: { rSize: [2, 5], color: "#FFEB3B", fade: 0.030, rVX: 3,   rVY: 3,   growth: 0.06, compOp: "screen", alpha: 0.75 }},
    ],

    // ── smoke puff (engine / building exhaust) ─────────────────────────────
    smoke: [
        { count: 5, options: { rSize: [4, 8],  color: "#78909C", fade: 0.007, rVX: 1.5, rVY: 1.5, vy: -2.0, growth: 0.40, compOp: "source-over", alpha: 0.30, lightMode: "lit" }},
        { count: 3, options: { rSize: [2, 5],  color: "#546E7A", fade: 0.006, rVX: 1.0, rVY: 1.0, vy: -1.5, growth: 0.22, compOp: "source-over", alpha: 0.40, lightMode: "lit" }},
    ],

    // ── multi-site explosion stagger ───────────────────────────────────────
    multiexplosion: [
        { count: 3, prX: 60, prY: 60, program: "explosion" },
    ],

    // ── small rainbow burst ────────────────────────────────────────────────
    smallrainbowexplosion: [
        { count: 8, options: { rSize: [1, 4], color: "#EF5350", fade: 0.04, rVX: 7, rVY: 7, compOp: "screen", alpha: 0.9, trails: true }},
        { count: 8, options: { rSize: [1, 4], color: "#FFA726", fade: 0.04, rVX: 7, rVY: 7, compOp: "screen", alpha: 0.9, trails: true }},
        { count: 8, options: { rSize: [1, 4], color: "#FFEE58", fade: 0.04, rVX: 7, rVY: 7, compOp: "screen", alpha: 0.9, trails: true }},
        { count: 8, options: { rSize: [1, 4], color: "#66BB6A", fade: 0.04, rVX: 7, rVY: 7, compOp: "screen", alpha: 0.9, trails: true }},
        { count: 8, options: { rSize: [1, 4], color: "#42A5F5", fade: 0.04, rVX: 7, rVY: 7, compOp: "screen", alpha: 0.9, trails: true }},
        { count: 8, options: { rSize: [1, 4], color: "#AB47BC", fade: 0.04, rVX: 7, rVY: 7, compOp: "screen", alpha: 0.9, trails: true }},
    ],

    // ── red laser/blaster hit ──────────────────────────────────────────────
    redblast: [
        { count: 1,  options: { size: 18, growth: 2.8, color: "#FFCDD2", fade: 0.22, alpha: 0.60, compOp: "screen" }},
        { count: 14, options: { rSize: [1, 5], color: "#EF5350", fade: 0.040, rVX: 8, rVY: 8, compOp: "screen", alpha: 0.90, trails: true }},
        { count: 8,  options: { rSize: [2, 7], color: "#B71C1C", fade: 0.024, rVX: 5, rVY: 5, growth: 0.12, compOp: "screen", alpha: 0.60 }},
    ],

    // ── sonic / concussion shockwave ───────────────────────────────────────
    sonicexplosion: [
        { count: 1,  options: { size: 28, growth: 4.5, color: "#FFFFFF", fade: 0.22, alpha: 0.50, compOp: "screen" }},
        { count: 25, options: { size: 1.5, color: "#E0F7FA", fade: 0.040, rVX: 11, rVY: 11, compOp: "screen", alpha: 0.85, trails: true }},
        { count: 10, options: { rSize: [3, 8], color: "#B2EBF2", fade: 0.024, rVX: 6, rVY: 6, growth: 0.22, compOp: "screen", alpha: 0.50 }},
        { count: 1,  options: { size: 16, growth: 3.5, color: "#E1F5FE", fade: 0.18, alpha: 0.35, compOp: "screen" }},
    ],

    // ── pink explosion ─────────────────────────────────────────────────────
    explosionpinks: [
        { count: 1,  options: { size: 18, growth: 2.6, color: "#FCE4EC", fade: 0.18, alpha: 0.70, compOp: "screen" }},
        { count: 14, options: { rSize: [2, 7], color: "#EC407A", fade: 0.032, rVX: 7, rVY: 7, growth: 0.12, compOp: "screen", alpha: 0.90 }},
        { count: 20, options: { size: 1.2,     color: "#F48FB1", fade: 0.050, rVX: 10, rVY: 10, gravityY: 0.06, compOp: "screen", alpha: 0.80, trails: true }},
        { count: 6,  options: { rSize: [4, 9], color: "#AD1457", fade: 0.007, rVX: 2,  rVY: 2,  vy: -1.5, growth: 0.38, compOp: "screen", alpha: 0.28 }},
    ],

    // ── purple / indigo explosion ──────────────────────────────────────────
    explosionpindogos: [
        { count: 1,  options: { size: 18, growth: 2.6, color: "#EDE7F6", fade: 0.18, alpha: 0.70, compOp: "screen" }},
        { count: 14, options: { rSize: [2, 7], color: "#7E57C2", fade: 0.032, rVX: 7, rVY: 7, growth: 0.12, compOp: "screen", alpha: 0.90 }},
        { count: 20, options: { size: 1.2,     color: "#CE93D8", fade: 0.050, rVX: 10, rVY: 10, gravityY: 0.06, compOp: "screen", alpha: 0.80, trails: true }},
        { count: 6,  options: { rSize: [4, 9], color: "#4527A0", fade: 0.007, rVX: 2,  rVY: 2,  vy: -1.5, growth: 0.38, compOp: "screen", alpha: 0.28 }},
    ],

    // ── light-blue explosion ───────────────────────────────────────────────
    explosionlightblues: [
        { count: 1,  options: { size: 18, growth: 2.6, color: "#E3F2FD", fade: 0.18, alpha: 0.70, compOp: "screen" }},
        { count: 14, options: { rSize: [2, 7], color: "#4FC3F7", fade: 0.032, rVX: 7, rVY: 7, growth: 0.12, compOp: "screen", alpha: 0.90 }},
        { count: 20, options: { size: 1.2,     color: "#29B6F6", fade: 0.050, rVX: 10, rVY: 10, gravityY: 0.06, compOp: "screen", alpha: 0.80, trails: true }},
        { count: 6,  options: { rSize: [4, 9], color: "#01579B", fade: 0.007, rVX: 2,  rVY: 2,  vy: -1.5, growth: 0.38, compOp: "screen", alpha: 0.28 }},
    ],
};

export default { getInstance, getPrograms };