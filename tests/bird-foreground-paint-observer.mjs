// Read-only diagnostic: conservative bounds of the REAL post-flock paints.
// No second canvas, source renderer calls, scene state or clock changes.
export function installBirdForegroundOpacityObserver() {
 if (window.__birdForegroundOpacity) return;
 const nativeGetContext = HTMLCanvasElement.prototype.getContext;
 const states = new WeakMap();
 const errors = [];
 const box = (points) => points.length ? {
  left: Math.min(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)),
  right: Math.max(...points.map(p => p.x)), bottom: Math.max(...points.map(p => p.y)),
 } : null;
 const union = (a,b) => !a ? b : !b ? a : ({left:Math.min(a.left,b.left),top:Math.min(a.top,b.top),right:Math.max(a.right,b.right),bottom:Math.max(a.bottom,b.bottom)});
 const intersection = (a,b) => !b ? a : !a ? b : ({left:Math.max(a.left,b.left),top:Math.max(a.top,b.top),right:Math.min(a.right,b.right),bottom:Math.min(a.bottom,b.bottom)});
 const overlap = (a,b) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
 function attach(canvas,ctx) {
  if(states.has(canvas))return;
  const state={canvas,ctx,active:false,sequence:0,birds:[],matrix:null,paints:[],path:null,clip:null,stack:[],sources:new Set()};states.set(canvas,state);
  const map=(x,y) => {const m=ctx.getTransform();return{x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};};
  const rect=(x,y,w,h) => box([map(x,y),map(x+w,y),map(x+w,y+h),map(x,y+h)]);
  const grow=(b,n) => b&&({left:b.left-n,top:b.top-n,right:b.right+n,bottom:b.bottom+n});
  function record(bounds,kind,stroke=false,source) {
   if(!state.active||!bounds||ctx.globalAlpha<=.01)return;
   const m=ctx.getTransform(), scale=Math.hypot(m.a,m.b,m.c,m.d);
   const extent=(stroke?ctx.lineWidth*Math.max(1,ctx.lineJoin==='miter'?ctx.miterLimit:1)*scale/2:0)
    +Math.abs(ctx.shadowOffsetX)+Math.abs(ctx.shadowOffsetY)+ctx.shadowBlur*3;
   const clipped=intersection(grow(bounds,extent),state.clip);
   if(clipped&&clipped.right>=clipped.left&&clipped.bottom>=clipped.top)state.paints.push({...clipped,kind,globalAlpha:ctx.globalAlpha,...(source?{source}: {})});
  }
  function hook(name,after) {
   const native=ctx[name];if(typeof native!=='function')return;
   Object.defineProperty(ctx,name,{configurable:true,value:function(...args){
    const result=Reflect.apply(native,ctx,args); // Original call exactly once.
    try{after(args);}catch(error){errors.push({name,message:String(error).slice(0,300)});}
    return result;
   }});
  }
  hook('clearRect',()=>{state.active=false;state.sequence++;state.paints=[];state.birds=[];state.path=null;state.clip=null;state.stack=[];});
  hook('save',()=>state.stack.push(state.clip&&({...state.clip})));
  hook('restore',()=>{state.clip=state.stack.pop()??null;});
  hook('beginPath',()=>{state.path=null;});
  for(const name of ['moveTo','lineTo'])hook(name,a=>{state.path=union(state.path,box([map(a[0],a[1])]));});
  for(const name of ['bezierCurveTo','quadraticCurveTo'])hook(name,a=>{const points=[];for(let i=0;i<a.length;i+=2)points.push(map(a[i],a[i+1]));state.path=union(state.path,box(points));});
  for(const name of ['rect','roundRect'])hook(name,a=>{state.path=union(state.path,rect(a[0],a[1],a[2],a[3]));});
  hook('arc',a=>{state.path=union(state.path,rect(a[0]-a[2],a[1]-a[2],a[2]*2,a[2]*2));});
  hook('ellipse',a=>{const radius=Math.hypot(a[2],a[3]);state.path=union(state.path,rect(a[0]-radius,a[1]-radius,radius*2,radius*2));});
  hook('arcTo',a=>{const m=ctx.getTransform();state.path=union(state.path,grow(box([map(a[0],a[1]),map(a[2],a[3])]),Math.abs(a[4])*Math.hypot(m.a,m.b,m.c,m.d)));});
  hook('clip',a=>{if(a.length&&typeof a[0]==='object')return;state.clip=intersection(state.clip,state.path);});
  for(const name of ['fill','stroke'])hook(name,a=>record(a.length&&typeof a[0]==='object'?{left:0,top:0,right:canvas.width,bottom:canvas.height}:state.path,name,name==='stroke'));
  for(const name of ['fillRect','strokeRect'])hook(name,a=>record(rect(a[0],a[1],a[2],a[3]),name,name==='strokeRect'));
  for(const name of ['fillText','strokeText'])hook(name,a=>{
   const metrics=ctx.measureText(a[0]),fallback=parseFloat(ctx.font)||16;
   record(rect(a[1]-(metrics.actualBoundingBoxLeft??metrics.width),a[2]-(metrics.actualBoundingBoxAscent??fallback),
    (metrics.actualBoundingBoxLeft??metrics.width)+(metrics.actualBoundingBoxRight??metrics.width),
    (metrics.actualBoundingBoxAscent??fallback)+(metrics.actualBoundingBoxDescent??fallback)),name,name==='strokeText');
  });
  hook('drawImage',a=>{
   const image=a[0],src=image.currentSrc||image.src||'',source=src.startsWith('data:')?'embedded-image':src;
   if(state.active&&source)state.sources.add(source);
   const p=a.length===9?[a[5],a[6],a[7],a[8]]:a.length===5?a.slice(1):[a[1],a[2],image.naturalWidth||image.width,image.naturalHeight||image.height];
   record(rect(...p),'drawImage',false,source);
  });
  // The public dataset assignment occurs AFTER the actual flock was painted.
  // Proxy only forwards the same DOMStringMap writes and adds the observer flag.
  const dataset=canvas.dataset;
  Object.defineProperty(canvas,'dataset',{configurable:true,get:()=>new Proxy(dataset,{set(target,key,value){
   const result=Reflect.set(target,key,value,target);
   if(key==='skyBirds'){try{state.birds=JSON.parse(value);state.matrix=ctx.getTransform();state.active=true;}catch(error){errors.push({name:'skyBirds-marker',message:String(error)});}}
   return result;
  }})});
 }
 HTMLCanvasElement.prototype.getContext=function(...args){const result=Reflect.apply(nativeGetContext,this,args);if(args[0]==='2d'&&this.id==='world'&&result)attach(this,result);return result;};
 window.__birdForegroundOpacity={signature:'actual-post-flock-conservative-paint-bounds-v1',sample(){
  const canvas=document.querySelector('#world'),state=canvas&&states.get(canvas);
  if(!state||!state.active||!state.matrix)return{ready:false,errors};
  const m=state.matrix,rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height;
  const map=(x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
  const birds=state.birds.map(bird=>{
   const k=bird.size/5,tip=-1.2-bird.wing*2.1;
   const top=Math.min(-1.1-bird.wing*1.6,tip,-1.1)-.2,bottom=Math.max(.9,tip+1.05,.6)+.2;
   const glyph=box([map(bird.x-5.6*k,bird.y+top*k),map(bird.x+5.6*k,bird.y+top*k),map(bird.x+5.6*k,bird.y+bottom*k),map(bird.x-5.6*k,bird.y+bottom*k)]);
   const hits=state.paints.filter(p=>overlap(glyph,p));
   const points=[['body',0,0],['far-inner-wing',-2.5,.1-bird.wing*.8],['near-inner-wing',2.5,.1-bird.wing*.8]].map(([kind,x,y])=>{
    const p=map(bird.x+x*k*bird.direction,bird.y+y*k);
    return{kind,x:p.x/sx,y:p.y/sy,coveredByPaintBounds:state.paints.some(b=>p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom)};
   });
   return{id:bird.id,unoccluded:hits.length===0,glyph:{left:glyph.left/sx,top:glyph.top/sy,right:glyph.right/sx,bottom:glyph.bottom/sy},points,occluders:hits.slice(0,8).map(p=>({...p,left:p.left/sx,top:p.top/sy,right:p.right/sx,bottom:p.bottom/sy}))};
  });
  return{ready:true,signature:this.signature,sequence:state.sequence,frameAt:JSON.parse(canvas.dataset.freeMovement||'{}').frameAt,
   matrix:{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f},backingCanvas:{width:canvas.width,height:canvas.height},cssRect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},
   conservativeGeometry:true,actualAlphaSamples:null,originalNativeCallsForwardedExactlyOnce:true,
   birds,paintCount:state.paints.length,bounds:state.paints.map(p=>({...p,left:p.left/sx,top:p.top/sy,right:p.right/sx,bottom:p.bottom/sy})),sourceUrls:[...state.sources],errors:[...errors]};
 }};
}

export async function readBirdForegroundOpacity(page) {
 return page.evaluate(()=>window.__birdForegroundOpacity?.sample()??{ready:false,errors:[{message:'observer not installed'}]});
}
