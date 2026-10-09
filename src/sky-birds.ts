/** Distant original painted silhouettes; decorative and never interactive. */
export interface SkyBirdViewport { left:number;top:number;right:number;bottom:number }
export interface SkyBirdOptions {
  /** Real animation seconds, independent of the accelerated village clock. */
  timeSeconds:number;
  viewport:SkyBirdViewport;
  /** Keep the flock below actual HUD occlusions in the same world coordinates. */
  skyTop?:number;
  /** Optional horizon in the same coordinates as the viewport. */
  skyBottom?:number;
  night?:number;
  reducedMotion?:boolean;
}
export interface SkyBirdFrame {
  id:number;x:number;y:number;depth:number;size:number;
  direction:1|-1;wing:number;gliding:boolean;alpha:number;
}
const TAU=Math.PI*2;
const clamp=(n:number):number=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const fraction=(n:number):number=>((n%1)+1)%1;
const flock=[
  {phase:.08,depth:.28,altitude:.23,speed:14,direction:1 as const},
  {phase:.23,depth:.4,altitude:.43,speed:18,direction:1 as const},
  {phase:.37,depth:.62,altitude:.68,speed:25,direction:-1 as const},
  {phase:.51,depth:.23,altitude:.15,speed:12,direction:1 as const},
  {phase:.66,depth:.54,altitude:.52,speed:22,direction:-1 as const},
  {phase:.79,depth:.78,altitude:.77,speed:29,direction:1 as const},
  {phase:.92,depth:.35,altitude:.35,speed:16,direction:1 as const},
  {phase:.14,depth:.46,altitude:.32,speed:20,direction:-1 as const},
];

/** Smooth dusk/dawn, with the same local village minutes already in the save. */
export function skyNightAmount(minutes:number):number{
  const minute=fraction((Number.isFinite(minutes)?minutes:480)/1440)*1440;
  if(minute<300||minute>=1200)return 1;
  if(minute<450){const t=(450-minute)/150;return t*t*(3-2*t);}
  if(minute<=1050)return 0;
  const t=(minute-1050)/150;return t*t*(3-2*t);
}

/** Wrapping occurs beyond the camera edges; no on-screen position jumps. */
export function sampleSkyBirds(o:SkyBirdOptions):SkyBirdFrame[]{
  const v=o.viewport,width=Math.max(1,v.right-v.left),height=Math.max(1,v.bottom-v.top);
  // Clear the largest wing before wrapping, without hiding a large percentage
  // of a phone's sky for unnecessarily long loops.
  const margin=18,span=width+margin*2;
  const top=Math.max(v.top,Math.min(v.bottom-24,o.skyTop??v.top));
  const bottom=Math.max(top+24,Math.min(v.bottom,o.skyBottom??top+height*.28));
  const band=Math.max(24,bottom-top),night=clamp(o.night??0);
  const time=o.reducedMotion?0:Math.max(0,Number.isFinite(o.timeSeconds)?o.timeSeconds:0);
  return flock.map((bird,id)=>{
    const travel=fraction(bird.phase+time*bird.speed/span);
    const x=bird.direction===1?v.left-margin+travel*span:v.right+margin-travel*span;
    const drift=Math.sin(time*(.11+id*.009)+id*1.13)*(2+bird.depth*5);
    const y=top+10+(band-20)*bird.altitude+drift;
    const edge=clamp(Math.min(x-v.left+4,v.right-x+4)/(12+bird.depth*6));
    const gliding=o.reducedMotion===true||Math.sin(time*.37+id*1.71)>.42;
    const wing=gliding?.2:Math.sin(time*(1.35+id*.13)*TAU+id*.8);
    const daylight=1-night*(id===1||id===5?.55:.9);
    return {id,x,y,depth:bird.depth,size:8+bird.depth*7,direction:bird.direction,wing,gliding,
      alpha:edge*(.34+bird.depth*.35)*daylight};
  });
}

function wing(c:CanvasRenderingContext2D,side:1|-1,flap:number,near:boolean):void{
  const tipY=-1.2-flap*2.1,length=near?5.4:4.5;
  c.beginPath();c.moveTo(-.5,-.15);
  c.quadraticCurveTo(side*length*.45,-1.1-flap*1.6,side*length,tipY);
  c.quadraticCurveTo(side*length*.7,tipY+1.05,side*length*.35,.5);
  c.lineTo(0,.6);c.closePath();
  c.fillStyle=near?'#667466':'#8a927e';c.fill();
  c.strokeStyle='#546353';c.lineWidth=.3;c.stroke();
  c.beginPath();c.moveTo(side*.8,.05);c.quadraticCurveTo(side*2.4,-.4-flap,side*4.4,tipY+.3);
  c.strokeStyle='#c4c6a9';c.lineWidth=.28;c.stroke();
}

export function drawSkyBirds(c:CanvasRenderingContext2D,o:SkyBirdOptions):SkyBirdFrame[]{
  const birds=sampleSkyBirds(o),night=clamp(o.night??0),v=o.viewport;
  c.save();c.beginPath();c.rect(v.left,v.top,v.right-v.left,v.bottom-v.top);c.clip();
  for(const bird of birds){
    if(bird.alpha<.015)continue;
    c.save();c.globalAlpha*=bird.alpha;c.translate(bird.x,bird.y);c.scale(bird.size/5*bird.direction,bird.size/5);
    // Far wing, tapered body, near wing: separate silhouettes keep the flock
    // readable without the two synchronized V strokes used on the old horizon.
    wing(c,-1,bird.wing,false);
    c.beginPath();c.moveTo(-2.3,.3);c.quadraticCurveTo(-.4,-1.1,1.8,-.45);
    c.lineTo(2.8,-.1);c.lineTo(1.5,.45);c.quadraticCurveTo(-.3,1.05,-2.3,.3);
    c.fillStyle=night>.5?'#7f9282':'#a9ab92';c.fill();
    wing(c,1,bird.wing,true);
    c.beginPath();c.moveTo(-1.4,.45);c.lineTo(-3.4,.9);c.lineTo(-2.7,-.2);c.closePath();c.fillStyle='#617460';c.fill();
    c.beginPath();c.arc(1.7,-.3,.62,0,TAU);c.fillStyle='#c9c4a7';c.fill();
    c.restore();
  }
  c.restore();return birds;
}
