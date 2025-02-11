import { removeFromArray, randomIntFromInterval } from "common-helpers";

const recycleBin = [];

const TWO_PI = 2 * Math.PI;
const ONE_EIGHTY_PI = Math.PI / 180;

export function getInstance() {
    return new ParticleEngine();
}

export function getPrograms() {
    const progs = [];

    for(let prog in predefinedEffectPrograms) {
        progs.push(prog);
    }

    return progs;
}

class ParticleEngine {
    constructor() {
        this.particles = [];

        this.offsetX = 0;
        this.offsetY = 0;

        this.middleX = 0;
        this.middleY = 0;

        this.starfieldStarSize = 0.3;
        this.starfieldAcceleration = 0.015;
        this.starfieldSpeed = 0.125;
        this.starfieldTrails = false;
        this.starfieldMaxHoldoff = 289;
        this.starfieldGrowth = 0.00375;
        this.starfieldPasses = 1;
        this.starfieldColor = "#ffffff";

        this.starfieldRunning = false;
        this.rainRunning = false;
        this.snowRunning = false;
        this.embersRunning = false;

        this.rndAngle = 0;
        this.acceleration = 0;
    }

    update(delta) {
        if(!delta || delta > 20) {
            delta = 1;
        }

        let killList = [];
        let addList = [];
        let particle;
        let rX,rS,rSP;

        this.rndAngle += 0.002 * delta;

        let screenWidth = (this.middleX - this.offsetX) * 2;
        let screenHeight = (this.middleY - this.offsetY) * 2;

        // handle starfield;
        if(this.starfieldRunning) {

            for(let i = 0; i < this.starfieldPasses; i++) {
                let dX = randomIntFromInterval(this.offsetX,screenWidth);
                let dY = randomIntFromInterval(this.offsetY,screenHeight);
    
                let dist = Math.sqrt((dX * dX) + (dY * dY));
                let ratio = this.starfieldSpeed / dist;
                
                let goX = ratio * dX;
                let goY = ratio * dY;
    
                if(randomIntFromInterval(1,2) == 1) {
                    goX = -goX;
                }
    
                if(randomIntFromInterval(1,2) == 1) {
                    goY = -goY;
                }

                let starColor = this.starfieldColor;

                if(Array.isArray(this.starfieldColor)) {
                    starColor = this.starfieldColor[randomIntFromInterval(0,this.starfieldColor.length - 1)];
                }
    
                addList.push({
                    x: this.middleX,
                    y: this.middleY,
                    vx: goX,
                    vy: goY,
                    size: this.starfieldStarSize,
                    growth: this.starfieldGrowth,
                    color: starColor,
                    alpha: 0,
                    fade: -0.025,
                    gravityX: 0,
                    gravityY: 0,
                    compOp: "screen",
                    trails: this.starfieldTrails,
                    acceleration: this.starfieldAcceleration,
                    holdoffTicks: randomIntFromInterval(0,this.starfieldMaxHoldoff)
                });
            }

            

        }


        // handle rain 
        if(this.rainRunning) {

            let dropcount = randomIntFromInterval(1,3);

            

            for(let i = 0; i < dropcount; i++) {
                rX = randomIntFromInterval(this.offsetX,this.offsetX + screenWidth);
                rS = randomIntFromInterval(1,3);

                rS -= 0.5;

                rSP = randomIntFromInterval(6,14);


                addList.push({
                    x: rX,
                    y: this.offsetY,
                    vx: 0,
                    vy: rSP,
                    size: rS,
                    color: "#42A5F5",
                    alpha: 0.3,
                    compOp: "screen",
                    fade: 0,
                    trails: true
                });

            }

        }

        // handle snow
        if(this.snowRunning) {

            let snowChance = randomIntFromInterval(0,5);

            if(snowChance == 2) {
                rX = randomIntFromInterval(this.offsetX,this.offsetX + screenWidth);
                rS = randomIntFromInterval(1,3);

                rS -= 0.5;

                rSP = randomIntFromInterval(1,6);


                addList.push({
                    x: rX,
                    y: this.offsetY,
                    vx: Math.sin(this.rndAngle) * 2,
                    vy: rSP,
                    size: rS,
                    color: "#ffffff",
                    alpha: 0.8,
                    compOp: "screen",
                    fade: 0,
                    loopsBack: true,
                    useGlobalAngle: true
                });
            }
        }

        // handle lava embers
        if(this.embersRunning) {
            let emberChance = randomIntFromInterval(0,5);

            if(emberChance == 2) {
                rX = randomIntFromInterval(this.offsetX,this.offsetX + screenWidth);
                rS = randomIntFromInterval(1,2);

                rS -= 0.5;

                rSP = -randomIntFromInterval(1,2);
                let uVX = Math.sin(this.rndAngle) * 2;

                addList.push({
                    x: rX,
                    y: this.middleY * 2,
                    vx: uVX,
                    vy: rSP,
                    size: rS,
                    color: "#EF6C00",
                    alpha: 0.6,
                    compOp: "screen",
                    fade: 0,
                    loopsBack: true,
                    useGlobalAngle: true
                });

                addList.push({
                    x: rX,
                    y: this.middleY * 2,
                    vx: uVX,
                    vy: rSP,
                    size: rS - 0.25,
                    color: "#FFECB3",
                    alpha: 0.85,
                    compOp: "screen",
                    fade: 0,
                    loopsBack: true,
                    useGlobalAngle: true
                });
            }
        }

        for(let i = 0,l = this.particles.length; i < l; i++) {

            particle = this.particles[i];

            if(particle.holdoffTicks > 0) {
                particle.holdoffTicks -= delta;
            }

            particle.age += delta;

            if(particle.speed != null && particle.angle != null) {
                let radians = particle.angle * ONE_EIGHTY_PI;
                particle.vx = Math.cos(radians) * particle.speed;
                particle.vy = Math.sin(radians) * particle.speed + particle.gravityY;
            }

            if(particle.useGlobalAngle) {
                particle.x += (Math.sin(this.rndAngle) * 2) * delta;
            } else {
                particle.x += particle.vx * delta;
            }

            
            
            particle.y += particle.vy * delta;

            
            particle.size += particle.growth * delta;
            particle.alpha -= particle.fade * delta;

            particle.vx += particle.gravityX * delta;
            particle.vy += particle.gravityY * delta;

            if(particle.alpha <= 0 || particle.size <= 0 || particle.dead) {
                killList.push(particle);
                continue;
            }

            if(particle.alpha > 1) {
                particle.alpha = 1;
            }

            if(particle.trails && particle.alpha > 0 && particle.holdoffTicks <= 0) {
                addList.push({
                    x: particle.x,
                    y: particle.y,
                    color: particle.color,
                    vx: 0,
                    vy: 0,
                    gravityX: 0,
                    gravityY: 0,
                    fade: 0.25,
                    size: particle.size,
                    growth: 0,
                    alpha: particle.alpha
                });

            }

            // is a percent
            if(particle.acceleration > 0) {
                particle.vx += particle.vx * (particle.acceleration * delta);
                particle.vy += particle.vy * (particle.acceleration * delta);
            }
        }

        while(killList.length > 0) {
            let kill = killList.pop();
            removeFromArray(this.particles,kill);

            if(recycleBin.length < 4000) {
                recycleBin.push(kill);
            }
            
        }

        while(addList.length > 0) {
            let add = addList.pop();
            this.playParticle(add);
        }
    }

    draw(context) {
        context.save();

        if(this.offsetX != 0 || this.offsetY != 0) {
            context.translate(this.offsetX,this.offsetY);
        }

        let particle;
        let canvas = context.canvas;

        this.middleX = this.offsetX + canvas.width / 2;
        this.middleY = this.offsetY + canvas.height / 2;

        for(let i = 0,l = this.particles.length; i < l; i++) {
            
            particle = this.particles[i];

            if(particle.holdoffTicks > 0) {
                continue;
            }

            if(particle.age > 100) {
                if(particle.y < this.offsetY || particle.y > this.offsetY + canvas.height) {
                    particle.dead = true;
                    continue;
                }

                if(particle.x < this.offsetX || particle.x > this.offsetX + canvas.width) {

                    if(particle.loopsBack) {
                        if(particle.x < this.offsetX) {
                            particle.x = this.offsetX + canvas.width;
                        } else {
                            particle.x = this.offsetX;
                        }
                    } else {
                        particle.dead = true;
                        continue;
                    }

                    
                }
            }

            context.save();

            context.globalCompositeOperation = particle.compOp;
            context.globalAlpha = particle.alpha;
            
            context.beginPath();
            context.arc(particle.x, particle.y, particle.size, 0, TWO_PI, false);
            context.fillStyle = particle.color;
            context.fill();
            
            context.restore();

            
        }

        canvas = null;

        context.restore();
    }

    reset() {
        this.particles = [];
    }

    playParticle(options) {
        if(this.particles.length > 4000) {
            return;
        }

        const p = getNewParticle(options);
        this.particles.push(p);
    }

    playEffect(effect, x, y) {
        if(!predefinedEffectPrograms[effect]) {
            return;
        }

        let program = predefinedEffectPrograms[effect];

        for(let i = 0; i < program.length; i++) {

            effect = program[i];

            let count = 0;

            if(effect.count) {
                count = effect.count;
            }

            if(effect.rCount) {
                count = randomIntFromInterval(effect.rCount[0],effect.rCount[1]);
            }

            for(let j = 0; j < count; j++) {

                let useX = x;
                let useY = y;

                if(effect.prX) {
                    let xMod = randomIntFromInterval(0,effect.prX * 2);
                    xMod -= effect.prX;
                    useX += xMod;
                }

                if(effect.prY) {
                    let yMod = randomIntFromInterval(0,effect.prY * 2);
                    yMod -= effect.prY;
                    useY += yMod;
                }

                if(effect.program == null) {

                    let particleOptions = {};

                    for(let op in effect.options) {
                        particleOptions[op] = effect.options[op];
                    }

                    particleOptions.x = useX;
                    particleOptions.y = useY;


                    this.playParticle(particleOptions);
                } else {
                    this.playEffect(effect.program,useX,useY);
                }
            }
        }
    }
}

class Particle {
    constructor(options) {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.size = 1;
        this.growth = 0;
        this.color = "#ff0000";
        this.alpha = 1;
        this.dead = false;
        this.fade = 0.01;
        this.age = 0;
        this.gravityX = 0;
        this.gravityY = 0;
        this.compOp = "lighter";
        this.trails = false;
        this.loopsBack = false;
        this.useGlobalAngle = false;
        this.sticks = false;

        this.speed = null;
        this.angle = null;
        this.holdoffTicks = 0;

        let xDev = 0;
        let yDev = 0;
        let vxDev = 0;
        let vyDev = 0;

        this.acceleration = 0;

        if(options) {
            for(let prop in options) {

                if(prop == "rSpeed") {
                    this.speed = randomIntFromInterval(options[prop][0],options[prop][1]);
                    continue;
                }

                if(prop == "rAngle") {
                    this.angle = randomIntFromInterval(options[prop][0],options[prop][1]);
                    continue;
                }

                if(prop == "xDev" || prop == "yDev") {
                    
                    if(prop == "xDev") {
                        xDev.middleXv = randomIntFromInterval(0,options[prop] * 2);
                        xDev -= options[prop];
                    }

                    if(prop == "yDev") {
                        yDev = randomIntFromInterval(0,options[prop] * 2);
                        yDev -= options[prop];
                    }

                    continue;
                }

                if(prop == "rVX" || prop == "rVY") {
                    
                    if(prop == "rVX") {
                        vxDev = randomIntFromInterval(0,options[prop] * 2);
                        vxDev -= options[prop];
                    }

                    if(prop == "rVY") {
                        vyDev = randomIntFromInterval(0,options[prop] * 2);
                        vyDev -= options[prop];
                    }

                    continue;
                }

                this[prop] = options[prop];
            }
        }

        this.x += xDev;
        this.y += yDev;

        this.vx += vxDev;
        this.vy += vyDev;
    }
}

function getNewParticle(options) {
    if(recycleBin.length == 0) {
        return new Particle(options);
    } else {
        let p = recycleBin.pop();

        if(!p) {
            return new Particle(options);
        }

        p.x = 0;
        p.y = 0;
        p.vx = 0;
        p.vy = 0;
        p.size = 1;
        p.growth = 0;
        p.color = "#ff0000";
        p.alpha = 1;
        p.dead = false;
        p.fade = 0.01;
        p.age = 0;
        p.gravityX = 0;
        p.gravityY = 0;
        p.compOp = "lighter";
        p.trails = false;
        p.loopsBack = false;
        p.useGlobalAngle = false;
        p.sticks = false;
        p.holdoffTicks = 0;
        p.acceleration = 0;

        let xDev = 0;
        let yDev = 0;
        let vxDev = 0;
        let vyDev = 0;

        if(options) {
            for(let prop in options) {

                if(prop == "rSize") {
                    p.size = randomIntFromInterval(options[prop][0],options[prop][1]);
                }

                if(prop == "rGrowth") {
                    p.growth = randomIntFromInterval(options[prop][0],options[prop][1]);
                }

                if(prop == "xDev" || prop == "yDev") {

                    if(prop == "xDev") {
                        xDev = randomIntFromInterval(0,options[prop] * 2);
                        xDev -= options[prop];
                    }

                    if(prop == "yDev") {
                        yDev = randomIntFromInterval(0,options[prop] * 2);
                        yDev -= options[prop];
                    }

                    continue;
                }

                if(prop == "rVX" || prop == "rVY") {
                    
                    if(prop == "rVX") {
                        vxDev = randomIntFromInterval(0,options[prop] * 2);
                        vxDev -= options[prop];
                    }

                    if(prop == "rVY") {
                        vyDev = randomIntFromInterval(0,options[prop] * 2);
                        vyDev -= options[prop];
                    }

                    continue;
                }

                p[prop] = options[prop];
            }
        }

        p.x += xDev;
        p.y += yDev;

        p.vx += vxDev;
        p.vy += vyDev;

        return p;
    }
}

const predefinedEffectPrograms = {
    "redblast": [
        {
            count: 14,
            program: null,
            options: {
                rSize: [1,3],
                color: "#E53935",
                rVX: 8,
                rVY: 8
            }
        }
    ],
    "blueblast": [
        {
            count: 3,
            program: null,
            options: {
                size: 7,
                color: "#1976D2",
                rVX: 2,
                vy: 0,
                rGrowth: [0,1]
            }
        }
    ],
    "yellowblast": [
        {
            rCount: [0,1],
            program: null,
            options: {
                rSize: [1,2],
                color: "#1976D2",
                rVX: 12,
                rVY: 4
            }
        },
        {
            rCount: [0,1],
            program: null,
            options: {
                rSize: [1,2],
                color: "#FFB300",
                rVX: 12,
                rVY: 4
            }
        },
        {
            rCount: [0,1],
            program: null,
            options: {
                rSize: [1,2],
                color: "#FF6F00",
                rVX: 12,
                rVY: 4
            }
        }
    ],
    "purpleblast": [
        {
            rCount: [0,1],
            program: null,
            options: {
                rSize: [1,3],
                color: "#E91E63",
                rVX: 6,
                rVY: 6,
                sticks: true
            }
        },
        {
            rCount: [0,1],
            program: null,
            options: {
                rSize: [1,3],
                color: "#9C27B0",
                rVX: 6,
                rVY: 6,
                sticks: true
            }
        },
        {
            rCount: [0,1],
            program: null,
            options: {
                rSize: [1,3],
                color: "#F44336",
                rVX: 6,
                rVY: 6,
                sticks: true
            }
        }
    ],
    "stab": [
        {
            count: 1,
            program: null,
            options: {
                size: 4,
                color: "#660000",
                fade: 0.02,
                compOp: "source-over"
            }
        }
    ],
    "smallmagic": [
        {
            count: 1,
            program: null,
            options: {
                size: 6,
                color: "#007acc",
                fade: 0.02,
                compOp: "source-over"
            }
        }
    ],
    "leaf": [
        {
            count: 1,
            program: null,
            options: {
                size: 8,
                color: "#00994d",
                fade: 0.02,
                compOp: "source-over"
            }
        }
    ],
    "blunt": [
        {
            count: 1,
            program: null,
            options: {
                size: 16,
                color: "#333333",
                fade: 0.02,
                compOp: "source-over"
            }
        }
    ],
    "bluntspike": [
        {
            count: 1,
            program: "blunt",
            options: null
        },
        {
            count: 1,
            program: "shotgun",
            options: null
        }
    ],
    "shotgun": [
        {
            count: 12,
            program: null,
            options: {
                size: 4,
                color: "#660000",
                fade: 0.02,
                compOp: "source-over",
                xDev: 30,
                yDev: 30
            }
        }
    ],
    "explosion": [
        {
            count: 40,
            program: null,
            options: {
                size: 3,
                color: "#ff9900",
                fade: 0.02,
                rVX: 5,
                rVY: 5,
                growth: -0.05
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 5,
                color: "#ffe0b3",
                fade: 0.02,
                rVX: 5,
                rVY: 5,
                trails: true,
                alpha: 0.8
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 1,
                color: "#ffff66",
                fade: 0.04,
                rVX: 5,
                rVY: 5,
                trails: true,
                alpha: 0.5,
                growth: 0.3
            }
        },
        {
            count: 20,
            program: null,
            options: {
                size: 1,
                color: "#ffff66",
                fade: 0.01,
                rVX: 5,
                rVY: 5,
                gravityY: 0.05,
                trails: true,
                alpha: 0.5,
                growth: 0.05,
                useGlobalAngle: true
            }
        }
    ],
    "sonicexplosion": [
        {
            count: 40,
            program: null,
            options: {
                size: 5,
                color: "#000099",
                fade: 0.02,
                rVX: 5,
                rVY: 5
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 5,
                color: "#660066",
                fade: 0.02,
                rVX: 5,
                rVY: 5
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 5,
                color: "#9966ff",
                fade: 0.02,
                rVX: 5,
                rVY: 5
            }
        }
    ],
    "blueexplosion": [
        {
            count: 40,
            program: null,
            options: {
                rSize: [1,3],
                color: "#002080",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 10,
            program: null,
            options: {
                rSize: [2,4],
                color: "#002db3",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360]
            }
        },
        {
            count: 10,
            program: null,
            options: {
                rSize: [3,6],
                color: "#0039e6",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360]
            }
        }
    ],
    "bloodexplosion": [
        {
            count: 40,
            program: null,
            options: {
                size: 5,
                color: "#F44336",
                fade: 0.02,
                compOp: "source-over",
                rVX: 5,
                rVY: 5
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 5,
                color: "#E53935",
                compOp: "source-over",
                fade: 0.02,
                rVX: 5,
                rVY: 5
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 5,
                color: "#D32F2F",
                compOp: "source-over",
                fade: 0.02,
                rVX: 5,
                rVY: 5
            }
        }
    ],
    "multiexplosion": [
        {
            count: 0,
            rCount: [3,8],
            program: "explosion",
            options: null,
            prX: 150,
            prY: 150
        }
    ],
    "flame": [
        {
            count: 6,
            program: null,
            prX: 4,
            prY: 2,
            options: {
                size: 1,
                color: "#FFD54F",
                fade: 0.02,
                vy: -0.6,
                rvX: 20,
                growth: 0.15
            }
        }
    ],
    "smallrainbowexplosion": [
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#f44336",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#FF9800",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#FFEB3B",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#4CAF50",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#2196F3",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#3F51B5",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#673AB7",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        }
    ],
    "smallelectricexplosion": [
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#B3E5FC",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#BBDEFB",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#42A5F5",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#29B6F6",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#1976D2",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#0288D1",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        },
        {
            count: 8,
            program: null,
            options: {
                rSize: [1,5],
                color: "#01579B",
                fade: 0.02,
                rSpeed: [1,5],
                rAngle: [0,360],
                rGrowth: [0,1]
            }
        }
    ],
    "explosionpinks": [
        {
            count: 40,
            program: null,
            options: {
                size: 3,
                color: "#F8BBD0",
                fade: 0.02,
                rVX: 5,
                rVY: 5,
                growth: -0.05
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 5,
                color: "#F48FB1",
                fade: 0.02,
                rVX: 5,
                rVY: 5,
                trails: true,
                alpha: 0.8
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 1,
                color: "#F06292",
                fade: 0.04,
                rVX: 5,
                rVY: 5,
                trails: true,
                alpha: 0.5,
                growth: 0.3
            }
        },
        {
            count: 20,
            program: null,
            options: {
                size: 1,
                color: "#EC407A",
                fade: 0.01,
                rVX: 5,
                rVY: 5,
                gravityY: 0.05,
                trails: true,
                alpha: 0.5,
                growth: 0.05,
                useGlobalAngle: true
            }
        }
    ],
    "explosionpindogos": [
        {
            count: 40,
            program: null,
            options: {
                size: 3,
                color: "#C5CAE9",
                fade: 0.02,
                rVX: 5,
                rVY: 5,
                growth: -0.05
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 5,
                color: "#9FA8DA",
                fade: 0.02,
                rVX: 5,
                rVY: 5,
                trails: true,
                alpha: 0.8
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 1,
                color: "#7986CB",
                fade: 0.04,
                rVX: 5,
                rVY: 5,
                trails: true,
                alpha: 0.5,
                growth: 0.3
            }
        },
        {
            count: 20,
            program: null,
            options: {
                size: 1,
                color: "#5C6BC0",
                fade: 0.01,
                rVX: 5,
                rVY: 5,
                gravityY: 0.05,
                trails: true,
                alpha: 0.5,
                growth: 0.05,
                useGlobalAngle: true
            }
        }
    ],
    "explosionlightblues": [
        {
            count: 40,
            program: null,
            options: {
                size: 3,
                color: "#B3E5FC",
                fade: 0.02,
                rVX: 5,
                rVY: 5,
                growth: -0.05
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 5,
                color: "#81D4FA",
                fade: 0.02,
                rVX: 5,
                rVY: 5,
                trails: true,
                alpha: 0.8
            }
        },
        {
            count: 10,
            program: null,
            options: {
                size: 1,
                color: "#4FC3F7",
                fade: 0.04,
                rVX: 5,
                rVY: 5,
                trails: true,
                alpha: 0.5,
                growth: 0.3
            }
        },
        {
            count: 20,
            program: null,
            options: {
                size: 1,
                color: "#29B6F6",
                fade: 0.01,
                rVX: 5,
                rVY: 5,
                gravityY: 0.05,
                trails: true,
                alpha: 0.5,
                growth: 0.05,
                useGlobalAngle: true
            }
        }
    ]
};