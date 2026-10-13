/** Screen-space production controls remain readable when a whole deck is fitted. */
export interface ProductionBubbleAnchor { id:number; x:number; y:number; width:number; height:number }
export interface ProductionBubbleViewport { left:number; top:number; right:number; bottom:number }
export interface ProductionBubblePosition { x:number; y:number; displaced:boolean }
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
function overlaps(a:ProductionBubbleAnchor,b:ProductionBubbleAnchor){
  return Math.abs(a.x-b.x)<(a.width+b.width)/2+4&&Math.abs(a.y-b.y)<(a.height+b.height)/2+4;
}
/** Keep natural roof anchors where they fit; crowded views use a compact product row. */
export function layoutProductionBubbles(anchors:readonly ProductionBubbleAnchor[],viewport:ProductionBubbleViewport){
  const result=new Map<number,ProductionBubblePosition>();
  if(!anchors.length)return result;
  const visible=anchors.filter(a=>a.x+a.width/2>=viewport.left&&a.x-a.width/2<=viewport.right
    &&a.y+a.height/2>=viewport.top&&a.y-a.height/2<=viewport.bottom);
  for(const anchor of anchors)result.set(anchor.id,{x:anchor.x,y:anchor.y,displaced:false});
  if(!visible.some((a,index)=>visible.slice(index+1).some(b=>overlaps(a,b))))return result;
  if(viewport.right-viewport.left<=(viewport.bottom-viewport.top)*1.4){
    const current=visible.map(a=>({...a}));let failed=false;
    for(const anchor of current){
      if(!current.some(b=>b.id!==anchor.id&&overlaps(anchor,b)))continue;
      let found:ProductionBubbleAnchor|undefined;
      for(let radius=4;radius<=96&&!found;radius+=4)for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1],[-.707,-.707],[.707,-.707],[-.707,.707],[.707,.707]]){
        const candidate={...anchor,x:anchor.x+dx*radius,y:anchor.y+dy*radius};
        if(candidate.x-candidate.width/2<viewport.left+4||candidate.x+candidate.width/2>viewport.right-4
          ||candidate.y-candidate.height/2<viewport.top+4||candidate.y+candidate.height/2>viewport.bottom-4)continue;
        if(!current.some(b=>b.id!==anchor.id&&overlaps(candidate,b))){found=candidate;break;}
      }
      if(!found){failed=true;break;}
      anchor.x=found.x;anchor.y=found.y;result.set(anchor.id,{x:found.x,y:found.y,displaced:true});
    }
    if(!failed)return result;
  }
  const gap=4,margin=4,available=Math.max(48,viewport.right-viewport.left-margin*2);
  const ordered=[...visible].sort((a,b)=>a.y-b.y||a.x-b.x),rows:ProductionBubbleAnchor[][]=[];
  let row:ProductionBubbleAnchor[]=[],used=0;
  for(const anchor of ordered){
    const next=used+(row.length?gap:0)+anchor.width;
    if(row.length&&next>available){rows.push(row);row=[];used=0;}
    used+=(row.length?gap:0)+anchor.width;row.push(anchor);
  }
  if(row.length)rows.push(row);
  const heights=rows.map(items=>Math.max(...items.map(a=>a.height))),height=heights.reduce((n,h)=>n+h,0)+gap*(rows.length-1);
  const meanY=visible.reduce((n,a)=>n+a.y,0)/visible.length;
  let y=clamp(meanY-height/2,viewport.top+margin,Math.max(viewport.top+margin,viewport.bottom-margin-height));
  for(let index=0;index<rows.length;index++){
    const items=rows[index],width=items.reduce((n,a)=>n+a.width,0)+gap*(items.length-1),meanX=items.reduce((n,a)=>n+a.x,0)/items.length;
    let x=clamp(meanX-width/2,viewport.left+margin,viewport.right-margin-width);
    for(const anchor of items){
      const next={x:x+anchor.width/2,y:y+heights[index]/2,displaced:true};result.set(anchor.id,next);x+=anchor.width+gap;
    }
    y+=heights[index]+gap;
  }
  return result;
}
