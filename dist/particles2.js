var o={d:(r,t)=>{for(var e in t)o.o(t,e)&&!o.o(r,e)&&Object.defineProperty(r,e,{enumerable:!0,get:t[e]})},o:(o,r)=>Object.prototype.hasOwnProperty.call(o,r)},r={};function t(o,r){return Math.floor(Math.random()*(r-o+1)+o)}function e(o,r){const t=o.indexOf(r);return t>-1&&o.splice(t,1),o}o.d(r,{i:()=>n,u:()=>a});const l=[],i=2*Math.PI,s=Math.PI/180;function n(){return new p}function a(){const o=[];for(let r in c)o.push(r);return o}class p{constructor(){this.particles=[],this.offsetX=0,this.offsetY=0,this.middleX=0,this.middleY=0,this.starfieldStarSize=.3,this.starfieldAcceleration=.015,this.starfieldSpeed=.125,this.starfieldTrails=!1,this.starfieldMaxHoldoff=289,this.starfieldGrowth=.00375,this.starfieldPasses=1,this.starfieldColor="#ffffff",this.starfieldRunning=!1,this.rainRunning=!1,this.snowRunning=!1,this.embersRunning=!1,this.rndAngle=0,this.acceleration=0}update(o){(!o||o>20)&&(o=1);let r,i,n,a,p=[],h=[];this.rndAngle+=.002*o;let c=2*(this.middleX-this.offsetX),f=2*(this.middleY-this.offsetY);if(this.starfieldRunning)for(let o=0;o<this.starfieldPasses;o++){let o=t(this.offsetX,c),r=t(this.offsetY,f),e=Math.sqrt(o*o+r*r),l=this.starfieldSpeed/e,i=l*o,s=l*r;1==t(1,2)&&(i=-i),1==t(1,2)&&(s=-s);let n=this.starfieldColor;Array.isArray(this.starfieldColor)&&(n=this.starfieldColor[t(0,this.starfieldColor.length-1)]),h.push({x:this.middleX,y:this.middleY,vx:i,vy:s,size:this.starfieldStarSize,growth:this.starfieldGrowth,color:n,alpha:0,fade:-.025,gravityX:0,gravityY:0,compOp:"screen",trails:this.starfieldTrails,acceleration:this.starfieldAcceleration,holdoffTicks:t(0,this.starfieldMaxHoldoff)})}if(this.rainRunning){let o=t(1,3);for(let r=0;r<o;r++)i=t(this.offsetX,this.offsetX+c),n=t(1,3),n-=.5,a=t(6,14),h.push({x:i,y:this.offsetY,vx:0,vy:a,size:n,color:"#42A5F5",alpha:.3,compOp:"screen",fade:0,trails:!0})}if(this.snowRunning&&2==t(0,5)&&(i=t(this.offsetX,this.offsetX+c),n=t(1,3),n-=.5,a=t(1,6),h.push({x:i,y:this.offsetY,vx:2*Math.sin(this.rndAngle),vy:a,size:n,color:"#ffffff",alpha:.8,compOp:"screen",fade:0,loopsBack:!0,useGlobalAngle:!0})),this.embersRunning&&2==t(0,5)){i=t(this.offsetX,this.offsetX+c),n=t(1,2),n-=.5,a=-t(1,2);let o=2*Math.sin(this.rndAngle);h.push({x:i,y:2*this.middleY,vx:o,vy:a,size:n,color:"#EF6C00",alpha:.6,compOp:"screen",fade:0,loopsBack:!0,useGlobalAngle:!0}),h.push({x:i,y:2*this.middleY,vx:o,vy:a,size:n-.25,color:"#FFECB3",alpha:.85,compOp:"screen",fade:0,loopsBack:!0,useGlobalAngle:!0})}for(let t=0,e=this.particles.length;t<e;t++){if(r=this.particles[t],r.holdoffTicks>0&&(r.holdoffTicks-=o),r.age+=o,null!=r.speed&&null!=r.angle){let o=r.angle*s;r.vx=Math.cos(o)*r.speed,r.vy=Math.sin(o)*r.speed+r.gravityY}r.useGlobalAngle?r.x+=2*Math.sin(this.rndAngle)*o:r.x+=r.vx*o,r.y+=r.vy*o,r.size+=r.growth*o,r.alpha-=r.fade*o,r.vx+=r.gravityX*o,r.vy+=r.gravityY*o,r.alpha<=0||r.size<=0||r.dead?p.push(r):(r.alpha>1&&(r.alpha=1),r.trails&&r.alpha>0&&r.holdoffTicks<=0&&h.push({x:r.x,y:r.y,color:r.color,vx:0,vy:0,gravityX:0,gravityY:0,fade:.25,size:r.size,growth:0,alpha:r.alpha}),r.acceleration>0&&(r.vx+=r.vx*(r.acceleration*o),r.vy+=r.vy*(r.acceleration*o)))}for(;p.length>0;){let o=p.pop();e(this.particles,o),l.length<4e3&&l.push(o)}for(;h.length>0;){let o=h.pop();this.playParticle(o)}}draw(o){let r;o.save(),0==this.offsetX&&0==this.offsetY||o.translate(this.offsetX,this.offsetY);let t=o.canvas;this.middleX=this.offsetX+t.width/2,this.middleY=this.offsetY+t.height/2;for(let e=0,l=this.particles.length;e<l;e++)if(r=this.particles[e],!(r.holdoffTicks>0)){if(r.age>100){if(r.y<this.offsetY||r.y>this.offsetY+t.height){r.dead=!0;continue}if(r.x<this.offsetX||r.x>this.offsetX+t.width){if(!r.loopsBack){r.dead=!0;continue}r.x<this.offsetX?r.x=this.offsetX+t.width:r.x=this.offsetX}}o.save(),o.globalCompositeOperation=r.compOp,o.globalAlpha=r.alpha,o.beginPath(),o.arc(r.x,r.y,r.size,0,i,!1),o.fillStyle=r.color,o.fill(),o.restore()}t=null,o.restore()}reset(){this.particles=[]}playParticle(o){if(this.particles.length>4e3)return;const r=function(o){if(0==l.length)return new h(o);{let r=l.pop();if(!r)return new h(o);r.x=0,r.y=0,r.vx=0,r.vy=0,r.size=1,r.growth=0,r.color="#ff0000",r.alpha=1,r.dead=!1,r.fade=.01,r.age=0,r.gravityX=0,r.gravityY=0,r.compOp="lighter",r.trails=!1,r.loopsBack=!1,r.useGlobalAngle=!1,r.sticks=!1,r.holdoffTicks=0,r.acceleration=0;let e=0,i=0,s=0,n=0;if(o)for(let l in o)"rSize"==l&&(r.size=t(o[l][0],o[l][1])),"rGrowth"==l&&(r.growth=t(o[l][0],o[l][1])),"xDev"!=l&&"yDev"!=l?"rVX"!=l&&"rVY"!=l?r[l]=o[l]:("rVX"==l&&(s=t(0,2*o[l]),s-=o[l]),"rVY"==l&&(n=t(0,2*o[l]),n-=o[l])):("xDev"==l&&(e=t(0,2*o[l]),e-=o[l]),"yDev"==l&&(i=t(0,2*o[l]),i-=o[l]));return r.x+=e,r.y+=i,r.vx+=s,r.vy+=n,r}}(o);this.particles.push(r)}playEffect(o,r,e){if(!c[o])return;let l=c[o];for(let i=0;i<l.length;i++){let s=0;(o=l[i]).count&&(s=o.count),o.rCount&&(s=t(o.rCount[0],o.rCount[1]));for(let l=0;l<s;l++){let l=r,i=e;if(o.prX){let r=t(0,2*o.prX);r-=o.prX,l+=r}if(o.prY){let r=t(0,2*o.prY);r-=o.prY,i+=r}if(null==o.program){let r={};for(let t in o.options)r[t]=o.options[t];r.x=l,r.y=i,this.playParticle(r)}else this.playEffect(o.program,l,i)}}}}class h{constructor(o){this.x=0,this.y=0,this.vx=0,this.vy=0,this.size=1,this.growth=0,this.color="#ff0000",this.alpha=1,this.dead=!1,this.fade=.01,this.age=0,this.gravityX=0,this.gravityY=0,this.compOp="lighter",this.trails=!1,this.loopsBack=!1,this.useGlobalAngle=!1,this.sticks=!1,this.speed=null,this.angle=null,this.holdoffTicks=0;let r=0,e=0,l=0,i=0;if(this.acceleration=0,o)for(let s in o)"rSpeed"!=s?"rAngle"!=s?"xDev"!=s&&"yDev"!=s?"rVX"!=s&&"rVY"!=s?this[s]=o[s]:("rVX"==s&&(l=t(0,2*o[s]),l-=o[s]),"rVY"==s&&(i=t(0,2*o[s]),i-=o[s])):("xDev"==s&&(r.middleXv=t(0,2*o[s]),r-=o[s]),"yDev"==s&&(e=t(0,2*o[s]),e-=o[s])):this.angle=t(o[s][0],o[s][1]):this.speed=t(o[s][0],o[s][1]);this.x+=r,this.y+=e,this.vx+=l,this.vy+=i}}const c={redblast:[{count:14,program:null,options:{rSize:[1,3],color:"#E53935",rVX:8,rVY:8}}],blueblast:[{count:3,program:null,options:{size:7,color:"#1976D2",rVX:2,vy:0,rGrowth:[0,1]}}],yellowblast:[{rCount:[0,1],program:null,options:{rSize:[1,2],color:"#1976D2",rVX:12,rVY:4}},{rCount:[0,1],program:null,options:{rSize:[1,2],color:"#FFB300",rVX:12,rVY:4}},{rCount:[0,1],program:null,options:{rSize:[1,2],color:"#FF6F00",rVX:12,rVY:4}}],purpleblast:[{rCount:[0,1],program:null,options:{rSize:[1,3],color:"#E91E63",rVX:6,rVY:6,sticks:!0}},{rCount:[0,1],program:null,options:{rSize:[1,3],color:"#9C27B0",rVX:6,rVY:6,sticks:!0}},{rCount:[0,1],program:null,options:{rSize:[1,3],color:"#F44336",rVX:6,rVY:6,sticks:!0}}],stab:[{count:1,program:null,options:{size:4,color:"#660000",fade:.02,compOp:"source-over"}}],smallmagic:[{count:1,program:null,options:{size:6,color:"#007acc",fade:.02,compOp:"source-over"}}],leaf:[{count:1,program:null,options:{size:8,color:"#00994d",fade:.02,compOp:"source-over"}}],blunt:[{count:1,program:null,options:{size:16,color:"#333333",fade:.02,compOp:"source-over"}}],bluntspike:[{count:1,program:"blunt",options:null},{count:1,program:"shotgun",options:null}],shotgun:[{count:12,program:null,options:{size:4,color:"#660000",fade:.02,compOp:"source-over",xDev:30,yDev:30}}],explosion:[{count:40,program:null,options:{size:3,color:"#ff9900",fade:.02,rVX:5,rVY:5,growth:-.05}},{count:10,program:null,options:{size:5,color:"#ffe0b3",fade:.02,rVX:5,rVY:5,trails:!0,alpha:.8}},{count:10,program:null,options:{size:1,color:"#ffff66",fade:.04,rVX:5,rVY:5,trails:!0,alpha:.5,growth:.3}},{count:20,program:null,options:{size:1,color:"#ffff66",fade:.01,rVX:5,rVY:5,gravityY:.05,trails:!0,alpha:.5,growth:.05,useGlobalAngle:!0}}],sonicexplosion:[{count:40,program:null,options:{size:5,color:"#000099",fade:.02,rVX:5,rVY:5}},{count:10,program:null,options:{size:5,color:"#660066",fade:.02,rVX:5,rVY:5}},{count:10,program:null,options:{size:5,color:"#9966ff",fade:.02,rVX:5,rVY:5}}],blueexplosion:[{count:40,program:null,options:{rSize:[1,3],color:"#002080",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:10,program:null,options:{rSize:[2,4],color:"#002db3",fade:.02,rSpeed:[1,5],rAngle:[0,360]}},{count:10,program:null,options:{rSize:[3,6],color:"#0039e6",fade:.02,rSpeed:[1,5],rAngle:[0,360]}}],bloodexplosion:[{count:40,program:null,options:{size:5,color:"#F44336",fade:.02,compOp:"source-over",rVX:5,rVY:5}},{count:10,program:null,options:{size:5,color:"#E53935",compOp:"source-over",fade:.02,rVX:5,rVY:5}},{count:10,program:null,options:{size:5,color:"#D32F2F",compOp:"source-over",fade:.02,rVX:5,rVY:5}}],multiexplosion:[{count:0,rCount:[3,8],program:"explosion",options:null,prX:150,prY:150}],flame:[{count:6,program:null,prX:4,prY:2,options:{size:1,color:"#FFD54F",fade:.02,vy:-.6,rvX:20,growth:.15}}],smallrainbowexplosion:[{count:8,program:null,options:{rSize:[1,5],color:"#f44336",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#FF9800",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#FFEB3B",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#4CAF50",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#2196F3",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#3F51B5",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#673AB7",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}}],smallelectricexplosion:[{count:8,program:null,options:{rSize:[1,5],color:"#B3E5FC",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#BBDEFB",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#42A5F5",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#29B6F6",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#1976D2",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#0288D1",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}},{count:8,program:null,options:{rSize:[1,5],color:"#01579B",fade:.02,rSpeed:[1,5],rAngle:[0,360],rGrowth:[0,1]}}],explosionpinks:[{count:40,program:null,options:{size:3,color:"#F8BBD0",fade:.02,rVX:5,rVY:5,growth:-.05}},{count:10,program:null,options:{size:5,color:"#F48FB1",fade:.02,rVX:5,rVY:5,trails:!0,alpha:.8}},{count:10,program:null,options:{size:1,color:"#F06292",fade:.04,rVX:5,rVY:5,trails:!0,alpha:.5,growth:.3}},{count:20,program:null,options:{size:1,color:"#EC407A",fade:.01,rVX:5,rVY:5,gravityY:.05,trails:!0,alpha:.5,growth:.05,useGlobalAngle:!0}}],explosionpindogos:[{count:40,program:null,options:{size:3,color:"#C5CAE9",fade:.02,rVX:5,rVY:5,growth:-.05}},{count:10,program:null,options:{size:5,color:"#9FA8DA",fade:.02,rVX:5,rVY:5,trails:!0,alpha:.8}},{count:10,program:null,options:{size:1,color:"#7986CB",fade:.04,rVX:5,rVY:5,trails:!0,alpha:.5,growth:.3}},{count:20,program:null,options:{size:1,color:"#5C6BC0",fade:.01,rVX:5,rVY:5,gravityY:.05,trails:!0,alpha:.5,growth:.05,useGlobalAngle:!0}}],explosionlightblues:[{count:40,program:null,options:{size:3,color:"#B3E5FC",fade:.02,rVX:5,rVY:5,growth:-.05}},{count:10,program:null,options:{size:5,color:"#81D4FA",fade:.02,rVX:5,rVY:5,trails:!0,alpha:.8}},{count:10,program:null,options:{size:1,color:"#4FC3F7",fade:.04,rVX:5,rVY:5,trails:!0,alpha:.5,growth:.3}},{count:20,program:null,options:{size:1,color:"#29B6F6",fade:.01,rVX:5,rVY:5,gravityY:.05,trails:!0,alpha:.5,growth:.05,useGlobalAngle:!0}}]};var f=r.i,u=r.u;export{f as getInstance,u as getPrograms};