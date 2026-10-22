import{h as gc,d as _c,a as vc,c as xc,p as Mc,b as yc,P as Sc,A as Zs,e as eo,f as no,U as Ec,g as js,i as bc}from"./index-Bz9psJ59.js";const Tc=[140,160,180],Ac=s=>Tc[Math.max(0,Math.min(2,Math.trunc(s)-1))],wc=.43,Qs=.41,ei=7.55,io=30,so=1.65,Rc=.12,Nn=28,Je=(s,t=0)=>Number.isFinite(s)?s:t,Be=(s,t,e)=>Math.max(t,Math.min(e,s)),De=(s,t)=>Math.hypot(t.x-s.x,t.y-s.y),mn=(s,t)=>{const e=Math.hypot(s,t);return e>1e-5?{x:s/e,y:t/e}:{x:0,y:0}},ro=(s,t)=>Math.atan2(t.x-s.x,t.y-s.y),tr=(s,t=0)=>({left:s.x-s.w/2-t,right:s.x+s.w/2+t,bottom:s.y-s.d/2-t,top:s.y+s.d/2+t});function ao(s,t,e){let n=0,i=1;for(let r=0;r<2;r++){const a=r===0?s.x:s.y,o=(r===0?t.x:t.y)-a,c=r===0?e.left:e.bottom,l=r===0?e.right:e.top;if(Math.abs(o)<1e-9){if(a<=c||a>=l)return null;continue}let h=(c-a)/o,u=(l-a)/o;if(h>u){const d=h;h=u,u=d}if(n=Math.max(n,h),i=Math.min(i,u),n>=i)return null}return n<=1&&i>=0?Math.max(0,n):null}function Cc(s){return[{id:"road-divider-a",kind:"barrier",x:-5.8,y:16,w:3.2,d:.9,h:.9},{id:"abandoned-van",kind:"car",x:4.35,y:34,w:2.8,d:5.8,h:1.8},{id:"supply-crates-a",kind:"crate",x:-2.7,y:45,w:1.7,d:1.8,h:1.05},{id:"road-divider-b",kind:"barrier",x:.5,y:55,w:6.3,d:.9,h:.9},{id:"rusted-sedan",kind:"car",x:-4.5,y:s*.51,w:2.6,d:5,h:1.45},{id:"road-divider-c",kind:"barrier",x:5.1,y:s*.61,w:4.3,d:.9,h:.85},{id:"supply-crates-b",kind:"crate",x:-1.8,y:s*.73,w:2.2,d:1.7,h:1.2},{id:"checkpoint-divider-a",kind:"barrier",x:-5,y:s-19,w:4.7,d:.85,h:.95},{id:"checkpoint-divider-b",kind:"barrier",x:4.7,y:s-12,w:4.8,d:.85,h:.95}]}function oo(s,t){let e=0;for(const n of s)n.remaining-=t,n.remaining>0&&(s[e++]=n);s.length=e}class Pc{state;input={moveX:0,moveY:0,aimX:0,aimY:14,firing:!1};lastMove={x:1,y:0};dodgeDirection={x:1,y:0};shotIn=0;eventId=0;traceId=0;routes=new Map;routeGeometry=[];staticRouteGraphs=new Map;attackMultiplier;enemyDamageMultiplier;constructor(t){const e=Math.trunc(Be(Je(t.stage,1),1,3)),n=Ac(e);this.attackMultiplier=Be(Je(t.bonuses?.attackMultiplier??1,1),1,1.2),this.enemyDamageMultiplier=Be(Je(t.bonuses?.enemyDamageMultiplier??1,1),.85,1);const i=[...new Set(t.teamIds??["dog","cat"])].slice(0,3);this.state={stage:e,level:Math.trunc(Be(Je(t.level,1),1,100)),time:0,worldWidth:16,goalY:n,distance:3,hero:{x:0,y:3,health:100,maxHealth:100,heading:0,aimHeading:0,walking:!1,walkDistance:0,recoil:0,hurt:0,invulnerable:0},enemies:[],pets:i.map((a,o)=>({id:a,x:o%2===0?-1.25:1.25,y:1.5-o*.5,heading:0,walkDistance:0})),obstacles:Cc(n),objectives:[{id:"supply-a",kind:"supply",x:-5.1,y:45,collected:!1},{id:"supply-b",kind:"supply",x:4.8,y:n*.72,collected:!1},{id:"traveler",kind:"traveler",x:-4.8,y:n-9,collected:!1}],ammo:io,magazine:io,reloadRemaining:0,dodgeRemaining:0,dodgeCooldown:0,supportCooldowns:{supply:0,scout:0},scoutRemaining:0,enemiesDefeated:0,supplies:0,rescued:0,paused:!1,result:null,traces:[],events:[]};const r=[25,59,n*.63,n-24];for(let a=0;a<4;a++)for(let o=0;o<3;o++){const c=a*3+o+1,l=a>0&&o===1?"armored":o===2?"runner":"shambler",u=Math.round((l==="armored"?144:l==="runner"?53:70)*(1+(e-1)*.13)),d=this.clearSpawn({x:(o-1)*4,y:r[a]+o*1.5},Qs);this.state.enemies.push({id:c,kind:l,...d,health:u,maxHealth:u,heading:Math.PI,walkDistance:0,attackRemaining:0,attackCooldown:.3+o*.2,hurt:0,defeatedAt:null,active:!1})}}setInput(t){const e={...this.input,...t},n=mn(Je(e.moveX),Je(e.moveY)),i=Math.min(1,Math.hypot(Je(e.moveX),Je(e.moveY)));this.input={moveX:n.x*i,moveY:n.y*i,aimX:Be(Je(e.aimX,this.input.aimX),-100,100),aimY:Be(Je(e.aimY,this.input.aimY),-50,this.state.goalY+50),firing:e.firing===!0,targetId:Number.isSafeInteger(e.targetId)&&e.targetId>0?e.targetId:void 0,weakpoint:Number.isSafeInteger(e.targetId)&&e.targetId>0&&e.weakpoint===!0}}setPaused(t){this.state.paused=t,t&&(this.input.moveX=0,this.input.moveY=0,this.input.firing=!1,this.state.hero.walking=!1)}get firing(){return this.input.firing&&!this.state.paused&&!this.state.result&&this.state.reloadRemaining<=0&&this.state.dodgeRemaining<=0}tick(t){if(this.state.paused||this.state.result||!Number.isFinite(t)||t<=0)return;let e=Math.min(t,.12);for(;e>1e-7&&!this.state.result;){const n=Math.min(e,.011111111111111112);this.step(n),e-=n}}reload(){const t=this.state;return!this.canAct()||t.reloadRemaining>0||t.ammo>=t.magazine||t.dodgeRemaining>0?!1:(t.reloadRemaining=so,this.wasReloading=!0,this.emit("reload",t.hero,0,so),!0)}dodge(){const t=this.state;if(!this.canAct()||t.dodgeRemaining>0||t.dodgeCooldown>0)return!1;const e=Math.hypot(this.input.moveX,this.input.moveY)>.1;return this.dodgeDirection=e?mn(this.input.moveX,this.input.moveY):{...this.lastMove},t.dodgeRemaining=.28,t.dodgeCooldown=3.2,t.hero.invulnerable=.34,t.reloadRemaining=0,this.wasReloading=!1,!0}canUseSupport(t){return this.canAct()&&this.state.pets.length>0&&this.state.supportCooldowns[t]<=0}canUseHealthPotion(){return!1}restoreHealth(t){if(!this.canUseHealthPotion()||!Number.isFinite(t)||t<=0)return!1;const e=this.state.hero,n=Math.min(t,e.maxHealth-e.health);return e.health+=n,this.emit("heal",e,n),!0}useSupport(t){if(!this.canUseSupport(t))return!1;const e=this.state;if(t==="supply"){const n=Math.min(24,100-e.hero.health);e.hero.health+=n,e.ammo=e.magazine,e.reloadRemaining=0,this.wasReloading=!1,e.supportCooldowns.supply=22,this.emit("heal",e.hero,n)}else e.scoutRemaining=7,e.supportCooldowns.scout=18,this.emit("scout",e.hero,7);return!0}nearestObjective(){let t=null,e=1/0;for(const n of this.state.objectives){if(n.collected)continue;const i=De(n,this.state.hero);i<=2.8&&i<e&&(t=n,e=i)}return t}collect(){if(!this.canAct())return!1;const t=this.nearestObjective();return t?(t.collected=!0,t.kind==="supply"?(this.state.supplies+=1,this.state.hero.health=Math.min(100,this.state.hero.health+12),this.state.ammo=this.state.magazine,this.state.reloadRemaining=0,this.wasReloading=!1,this.emit("collect",t,1)):(this.state.rescued+=1,this.emit("rescue",t,1)),this.checkVictory(),!0):!1}canClear(){const t=this.state;return!t.result&&t.hero.health>0&&t.time>0&&gc(t)}clear(){return this.canClear()?(this.finish("victory"),{...this.state.result}):null}retreat(){return this.state.result||this.finish(this.canClear()?"victory":"retreat"),{...this.state.result}}canAct(){return!this.state.paused&&!this.state.result&&this.state.hero.health>0}step(t){const e=this.state,n=e.hero;if(e.time=Math.min(3600,e.time+t),n.health=n.maxHealth,e.time>=3600){this.finish(this.canClear()?"victory":"retreat");return}e.reloadRemaining=Math.max(0,e.reloadRemaining-t),e.dodgeRemaining=Math.max(0,e.dodgeRemaining-t),e.dodgeCooldown=Math.max(0,e.dodgeCooldown-t),e.supportCooldowns.supply=Math.max(0,e.supportCooldowns.supply-t),e.supportCooldowns.scout=Math.max(0,e.supportCooldowns.scout-t),e.scoutRemaining=Math.max(0,e.scoutRemaining-t),n.invulnerable=Math.max(0,n.invulnerable-t),n.recoil=Math.max(0,n.recoil-t*8),n.hurt=Math.max(0,n.hurt-t),this.shotIn=Math.max(0,this.shotIn-t),oo(e.events,t),oo(e.traces,t);const i=e.dodgeRemaining>0?this.dodgeDirection:{x:this.input.moveX,y:this.input.moveY},r=e.dodgeRemaining>0?13:e.reloadRemaining>0?3.2:this.input.firing?3.85:5.6,a={x:n.x,y:n.y};this.move(n,i.x*r*t,i.y*r*t,wc);const o=De(a,n);n.walking=o>1e-5,n.walkDistance+=o,n.walking&&(this.lastMove=mn(i.x,i.y),n.heading=Math.atan2(i.x,i.y)),n.aimHeading=ro(n,{x:this.input.aimX,y:this.input.aimY}),n.walking||(n.heading=n.aimHeading),e.distance=Math.max(e.distance,Math.min(e.goalY,n.y)),e.reloadRemaining===0&&this.wasReloading&&(e.ammo=e.magazine),this.wasReloading=e.reloadRemaining>0,this.input.firing&&e.reloadRemaining<=0&&e.dodgeRemaining<=0&&this.shotIn<=0&&(e.ammo>0?this.shoot():this.reload());for(const c of e.enemies)if(c.hurt=Math.max(0,c.hurt-t),!(c.health<=0)&&(this.stepEnemy(c,t),n.health<=0)){this.finish("defeat");break}for(let c=0;c<e.pets.length;c++)this.stepPet(c,t);this.checkVictory()}wasReloading=!1;shoot(){const t=this.state,e=t.hero,n={x:this.input.aimX,y:this.input.aimY};let i=mn(n.x-e.x,n.y-e.y);Math.hypot(i.x,i.y)<.1&&(i={x:Math.sin(e.aimHeading),y:Math.cos(e.aimHeading)});const r=t.enemies.filter(u=>u.health>0&&De(u,e)<=Nn).map(u=>{const d=u.x-e.x,p=u.y-e.y,g=d*i.x+p*i.y,_=Math.abs(d*i.y-p*i.x);return{enemy:u,along:g,side:_}}).filter(u=>u.along>.4&&u.side<.7&&this.clearLine(e,u.enemy,0,!0)).sort((u,d)=>u.side-d.side||u.along-d.along)[0];r&&(i=mn(r.enemy.x-e.x,r.enemy.y-e.y));const a={x:e.x+i.x*Nn,y:e.y+i.y*Nn};let o=1;for(const u of t.obstacles){if(u.h<1.25)continue;const d=ao(e,a,tr(u));d!==null&&(o=Math.min(o,d))}let c=null,l=!1;for(const u of t.enemies){if(u.health<=0)continue;const d=u.x-e.x,p=u.y-e.y,g=d*i.x+p*i.y,_=Math.abs(d*i.y-p*i.x),m=u.kind==="armored"?.64:.47;if(g<=0||g>Nn||_>m)continue;const f=Math.max(0,g-Math.sqrt(Math.max(0,m*m-_*_)))/Nn;f<o&&(o=f,c=u,l=this.input.targetId===u.id&&this.input.weakpoint===!0)}const h={x:e.x+i.x*Nn*o,y:e.y+i.y*Nn*o};if(t.ammo-=1,this.shotIn=Rc,e.recoil=1,e.aimHeading=Math.atan2(i.x,i.y),t.traces.push({id:++this.traceId,from:{x:e.x,y:e.y},to:h,remaining:.085,hit:!!c,critical:l}),this.emit("shot",e,0,.08),c){const u=Math.round((18+Math.min(20,t.level)*.55)*this.attackMultiplier*(l?1.35:1));c.health=Math.max(0,c.health-u),c.hurt=.2,c.active=!0,c.kind!=="armored"&&(c.attackRemaining=0,c.attackCooldown=Math.max(c.attackCooldown,.24)),this.emit("damage",c,u,.65),c.health<=0&&(c.defeatedAt=t.time,c.attackRemaining=0,t.enemiesDefeated+=1,this.routes.delete(`enemy-${c.id}`),this.emit("defeat",c,1,.8))}}stepEnemy(t,e){const n=this.state,i=n.hero,r=De(t,i);if(!t.active&&r<27&&(t.active=!0),!t.active)return;if(t.heading=ro(t,i),t.attackCooldown=Math.max(0,t.attackCooldown-e),t.attackRemaining>0){if(t.attackRemaining=Math.max(0,t.attackRemaining-e),t.attackRemaining===0){const d=t.kind==="armored"?2.55:1.85;r<=d&&i.invulnerable<=0&&this.clearLine(t,i,.08)&&(Math.round((t.kind==="armored"?19:t.kind==="runner"?10:13)*(1+(n.stage-1)*.1)*this.enemyDamageMultiplier),i.invulnerable=.48),t.attackCooldown=t.kind==="runner"?1.25:1.65}return}const a=t.kind==="armored"?2.05:1.3;if(r<=a&&t.attackCooldown<=0&&this.clearLine(t,i,.08)){t.attackRemaining=t.kind==="armored"?1.05:t.kind==="runner"?.62:.82;return}if(r<a*.8||t.hurt>.13&&t.kind!=="armored")return;const o=this.routeTarget(`enemy-${t.id}`,t,i,Qs);let c=mn(o.x-t.x,o.y-t.y);for(const d of n.enemies){if(d===t||d.health<=0)continue;const p=De(t,d);p>.001&&p<.85&&(c.x+=(t.x-d.x)/p*(.85-p)*.9,c.y+=(t.y-d.y)/p*(.85-p)*.9)}c=mn(c.x,c.y);const l=(t.kind==="runner"?3.45:t.kind==="armored"?1.6:2.3)*(n.scoutRemaining>0?.55:1),h={x:t.x,y:t.y};this.move(t,c.x*l*e,c.y*l*e,Qs);const u=De(h,t);t.walkDistance+=u,u>1e-6&&(t.heading=Math.atan2(c.x,c.y))}stepPet(t,e){const n=this.state,i=n.pets[t],r=t%2===0?-1:1,a=i.id==="elephant"?.75:i.id==="giraffe"?.65:["panda","boar","deer"].includes(i.id)?.5:.32,o=this.clearSpawn({x:Be(n.hero.x+r*(1.1+t*.2),-7,7),y:Math.max(.8,n.hero.y-1.35-t*.45)},a),c=De(i,o);if(c<.15)return;const l=this.routeTarget(`pet-${t}`,i,o,a),h=mn(l.x-i.x,l.y-i.y),u=Math.min(c,(c>5?7.8:5.8)*e),d={x:i.x,y:i.y};this.move(i,h.x*u,h.y*u,a),i.walkDistance+=De(d,i),De(d,i)>1e-6&&(i.heading=Math.atan2(h.x,h.y))}move(t,e,n,i){const r=Math.max(1,Math.ceil(Math.hypot(e,n)/.12));for(let a=0;a<r;a++){const o=Be(t.x+e/r,-ei+i,ei-i);this.freeXY(o,t.y,i)&&(t.x=o);const c=Be(t.y+n/r,.55,this.state.goalY+.25);this.freeXY(t.x,c,i)&&(t.y=c)}}free(t,e){return this.freeXY(t.x,t.y,e)}freeXY(t,e,n){if(!(t>=-ei+n&&t<=ei-n&&e>=.5&&e<=this.state.goalY+.3))return!1;for(const i of this.state.obstacles)if(t>i.x-i.w/2-n&&t<i.x+i.w/2+n&&e>i.y-i.d/2-n&&e<i.y+i.d/2+n)return!1;return!0}clearSpawn(t,e){const n={x:Be(t.x,-ei+e+.02,ei-e-.02),y:Be(t.y,.55,this.state.goalY)};if(this.free(n,e))return n;for(let i=.5;i<=8;i+=.5)for(let r=0;r<16;r++){const a=r*Math.PI/8,o={x:n.x+Math.cos(a)*i,y:n.y+Math.sin(a)*i};if(this.free(o,e))return o}return{x:0,y:3}}clearLine(t,e,n,i=!1){return!this.state.obstacles.some(r=>(!i||r.h>=1.25)&&ao(t,e,tr(r,n))!==null)}routeTarget(t,e,n,i){if(this.clearLine(e,n,i))return this.routes.delete(t),n;let r=this.routes.get(t);for((!r||r.until<=this.state.time||De(r.target,n)>1.8)&&(r={points:this.findRoute(e,n,i),target:{...n},until:this.state.time+.65},this.routes.set(t,r));r.points.length>1&&De(e,r.points[0])<.3;)r.points.shift();return r.points[0]&&this.clearLine(e,r.points[0],i)?r.points[0]:(this.routes.delete(t),e)}findRoute(t,e,n){const i=this.clearSpawn(e,n),r=this.staticRouteGraph(n),a=[{...t},i,...r.points],o=a.map(()=>1/0),c=a.map(()=>-1),l=new Set(a.map((u,d)=>d));for(o[0]=0;l.size;){let u=-1,d=1/0;for(const p of l)o[p]<d&&(u=p,d=o[p]);if(u<0||u===1)break;l.delete(u);for(const p of l){let g;if(u>=2&&p>=2){const m=r.costs[u-2];g=m[p-2],Number.isNaN(g)&&(g=this.clearLine(a[u],a[p],n)?De(a[u],a[p]):1/0,m[p-2]=g)}else g=this.clearLine(a[u],a[p],n)?De(a[u],a[p]):1/0;if(!Number.isFinite(g))continue;const _=o[u]+g;_<o[p]&&(o[p]=_,c[p]=u)}}if(!Number.isFinite(o[1]))return[];const h=[];for(let u=1;u>0&&!(u<0);u=c[u])h.unshift({...a[u]});return h}staticRouteGraph(t){const e=this.state.obstacles,n=this.routeGeometry;let i=n.length!==1+e.length*5||n[0]!==this.state.goalY;for(let l=0;!i&&l<e.length;l++){const h=e[l],u=1+l*5;i=n[u]!==h.x||n[u+1]!==h.y||n[u+2]!==h.w||n[u+3]!==h.d||n[u+4]!==h.h}if(i){n.length=1+e.length*5,n[0]=this.state.goalY;for(let l=0;l<e.length;l++){const h=e[l],u=1+l*5;n[u]=h.x,n[u+1]=h.y,n[u+2]=h.w,n[u+3]=h.d,n[u+4]=h.h}this.staticRouteGraphs.clear()}const r=this.staticRouteGraphs.get(t);if(r)return r;const a=[];for(const l of e){const h=tr(l,t+.075);for(const u of[h.left,h.right])for(const d of[h.bottom,h.top]){const p={x:u,y:d};this.free(p,t+.01)&&a.push(p)}}const o=a.map(()=>new Float64Array(a.length).fill(NaN)),c={points:a,costs:o};return this.staticRouteGraphs.size>=8&&this.staticRouteGraphs.clear(),this.staticRouteGraphs.set(t,c),c}emit(t,e,n,i=1){const r=this.state.events;r.push({id:++this.eventId,kind:t,x:e.x,y:e.y,amount:n,remaining:i}),r.length>90&&r.splice(0,r.length-90)}checkVictory(){const t=this.state;t.hero.y>=t.goalY&&this.canClear()&&this.finish("victory")}finish(t){const e=this.state;e.result||(this.input.firing=!1,this.input.moveX=0,this.input.moveY=0,e.hero.walking=!1,e.result={mode:"advancing",stage:e.stage,outcome:t,remainingHealth:t==="defeat"?0:e.hero.health,enemiesDefeated:e.enemiesDefeated,duration:e.time,distance:Be(e.distance,0,e.goalY),supplies:e.supplies,rescued:e.rescued})}}/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Pa="180",Dc=0,lo=1,Lc=2,Rl=1,Cl=2,hn=3,Dn=0,we=1,He=2,Rn=0,Ei=1,co=2,ho=3,uo=4,Ic=5,Xn=100,Uc=101,Nc=102,Fc=103,Oc=104,Bc=200,zc=201,kc=202,Hc=203,zr=204,kr=205,Vc=206,Gc=207,Wc=208,Xc=209,Yc=210,qc=211,$c=212,Kc=213,Jc=214,Hr=0,Vr=1,Gr=2,Ti=3,Wr=4,Xr=5,Yr=6,qr=7,Pl=0,Zc=1,jc=2,Cn=0,Qc=1,th=2,eh=3,Dl=4,nh=5,ih=6,sh=7,Ll=300,Ai=301,wi=302,$r=303,Kr=304,Ys=306,$i=1e3,qn=1001,Jr=1002,Ue=1003,rh=1004,is=1005,qe=1006,er=1007,$n=1008,en=1009,Il=1010,Ul=1011,Ki=1012,Da=1013,Jn=1014,Qe=1015,ts=1016,La=1017,Ia=1018,Ji=1020,Nl=35902,Fl=35899,Ol=1021,Bl=1022,$e=1023,Zi=1026,ji=1027,Ua=1028,Na=1029,zl=1030,Fa=1031,Oa=1033,Ls=33776,Is=33777,Us=33778,Ns=33779,Zr=35840,jr=35841,Qr=35842,ta=35843,ea=36196,na=37492,ia=37496,sa=37808,ra=37809,aa=37810,oa=37811,la=37812,ca=37813,ha=37814,ua=37815,da=37816,fa=37817,pa=37818,ma=37819,ga=37820,_a=37821,va=36492,xa=36494,Ma=36495,ya=36283,Sa=36284,Ea=36285,ba=36286,ah=3200,oh=3201,kl=0,lh=1,An="",Ee="srgb",Ri="srgb-linear",Bs="linear",Kt="srgb",ni=7680,fo=519,ch=512,hh=513,uh=514,Hl=515,dh=516,fh=517,ph=518,mh=519,Ta=35044,gh=35048,po="300 es",tn=2e3,zs=2001;class Pi{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){const n=this._listeners;return n===void 0?!1:n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){const n=this._listeners;if(n===void 0)return;const i=n[t];if(i!==void 0){const r=i.indexOf(e);r!==-1&&i.splice(r,1)}}dispatchEvent(t){const e=this._listeners;if(e===void 0)return;const n=e[t.type];if(n!==void 0){t.target=this;const i=n.slice(0);for(let r=0,a=i.length;r<a;r++)i[r].call(this,t);t.target=null}}}const ye=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],nr=Math.PI/180,Aa=180/Math.PI;function Pn(){const s=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(ye[s&255]+ye[s>>8&255]+ye[s>>16&255]+ye[s>>24&255]+"-"+ye[t&255]+ye[t>>8&255]+"-"+ye[t>>16&15|64]+ye[t>>24&255]+"-"+ye[e&63|128]+ye[e>>8&255]+"-"+ye[e>>16&255]+ye[e>>24&255]+ye[n&255]+ye[n>>8&255]+ye[n>>16&255]+ye[n>>24&255]).toLowerCase()}function zt(s,t,e){return Math.max(t,Math.min(e,s))}function _h(s,t){return(s%t+t)%t}function ir(s,t,e){return(1-e)*s+e*t}function je(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("Invalid component type.")}}function Jt(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("Invalid component type.")}}class ut{constructor(t=0,e=0){ut.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,i=t.elements;return this.x=i[0]*e+i[3]*n+i[6],this.y=i[1]*e+i[4]*n+i[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=zt(this.x,t.x,e.x),this.y=zt(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=zt(this.x,t,e),this.y=zt(this.y,t,e),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(zt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(zt(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),i=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*i+t.x,this.y=r*i+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Di{constructor(t=0,e=0,n=0,i=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=i}static slerpFlat(t,e,n,i,r,a,o){let c=n[i+0],l=n[i+1],h=n[i+2],u=n[i+3];const d=r[a+0],p=r[a+1],g=r[a+2],_=r[a+3];if(o===0){t[e+0]=c,t[e+1]=l,t[e+2]=h,t[e+3]=u;return}if(o===1){t[e+0]=d,t[e+1]=p,t[e+2]=g,t[e+3]=_;return}if(u!==_||c!==d||l!==p||h!==g){let m=1-o;const f=c*d+l*p+h*g+u*_,b=f>=0?1:-1,E=1-f*f;if(E>Number.EPSILON){const R=Math.sqrt(E),A=Math.atan2(R,f*b);m=Math.sin(m*A)/R,o=Math.sin(o*A)/R}const S=o*b;if(c=c*m+d*S,l=l*m+p*S,h=h*m+g*S,u=u*m+_*S,m===1-o){const R=1/Math.sqrt(c*c+l*l+h*h+u*u);c*=R,l*=R,h*=R,u*=R}}t[e]=c,t[e+1]=l,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,i,r,a){const o=n[i],c=n[i+1],l=n[i+2],h=n[i+3],u=r[a],d=r[a+1],p=r[a+2],g=r[a+3];return t[e]=o*g+h*u+c*p-l*d,t[e+1]=c*g+h*d+l*u-o*p,t[e+2]=l*g+h*p+o*d-c*u,t[e+3]=h*g-o*u-c*d-l*p,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,i){return this._x=t,this._y=e,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,i=t._y,r=t._z,a=t._order,o=Math.cos,c=Math.sin,l=o(n/2),h=o(i/2),u=o(r/2),d=c(n/2),p=c(i/2),g=c(r/2);switch(a){case"XYZ":this._x=d*h*u+l*p*g,this._y=l*p*u-d*h*g,this._z=l*h*g+d*p*u,this._w=l*h*u-d*p*g;break;case"YXZ":this._x=d*h*u+l*p*g,this._y=l*p*u-d*h*g,this._z=l*h*g-d*p*u,this._w=l*h*u+d*p*g;break;case"ZXY":this._x=d*h*u-l*p*g,this._y=l*p*u+d*h*g,this._z=l*h*g+d*p*u,this._w=l*h*u-d*p*g;break;case"ZYX":this._x=d*h*u-l*p*g,this._y=l*p*u+d*h*g,this._z=l*h*g-d*p*u,this._w=l*h*u+d*p*g;break;case"YZX":this._x=d*h*u+l*p*g,this._y=l*p*u+d*h*g,this._z=l*h*g-d*p*u,this._w=l*h*u-d*p*g;break;case"XZY":this._x=d*h*u-l*p*g,this._y=l*p*u-d*h*g,this._z=l*h*g+d*p*u,this._w=l*h*u+d*p*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,i=Math.sin(n);return this._x=t.x*i,this._y=t.y*i,this._z=t.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],i=e[4],r=e[8],a=e[1],o=e[5],c=e[9],l=e[2],h=e[6],u=e[10],d=n+o+u;if(d>0){const p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(h-c)*p,this._y=(r-l)*p,this._z=(a-i)*p}else if(n>o&&n>u){const p=2*Math.sqrt(1+n-o-u);this._w=(h-c)/p,this._x=.25*p,this._y=(i+a)/p,this._z=(r+l)/p}else if(o>u){const p=2*Math.sqrt(1+o-n-u);this._w=(r-l)/p,this._x=(i+a)/p,this._y=.25*p,this._z=(c+h)/p}else{const p=2*Math.sqrt(1+u-n-o);this._w=(a-i)/p,this._x=(r+l)/p,this._y=(c+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(zt(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const i=Math.min(1,e/n);return this.slerp(t,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,i=t._y,r=t._z,a=t._w,o=e._x,c=e._y,l=e._z,h=e._w;return this._x=n*h+a*o+i*l-r*c,this._y=i*h+a*c+r*o-n*l,this._z=r*h+a*l+n*c-i*o,this._w=a*h-n*o-i*c-r*l,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,i=this._y,r=this._z,a=this._w;let o=a*t._w+n*t._x+i*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=n,this._y=i,this._z=r,this;const c=1-o*o;if(c<=Number.EPSILON){const p=1-e;return this._w=p*a+e*this._w,this._x=p*n+e*this._x,this._y=p*i+e*this._y,this._z=p*r+e*this._z,this.normalize(),this}const l=Math.sqrt(c),h=Math.atan2(l,o),u=Math.sin((1-e)*h)/l,d=Math.sin(e*h)/l;return this._w=a*u+this._w*d,this._x=n*u+this._x*d,this._y=i*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(i*Math.sin(t),i*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class L{constructor(t=0,e=0,n=0){L.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(mo.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(mo.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*i,this.y=r[1]*e+r[4]*n+r[7]*i,this.z=r[2]*e+r[5]*n+r[8]*i,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*i+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*i+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*i+r[14])*a,this}applyQuaternion(t){const e=this.x,n=this.y,i=this.z,r=t.x,a=t.y,o=t.z,c=t.w,l=2*(a*i-o*n),h=2*(o*e-r*i),u=2*(r*n-a*e);return this.x=e+c*l+a*u-o*h,this.y=n+c*h+o*l-r*u,this.z=i+c*u+r*h-a*l,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*i,this.y=r[1]*e+r[5]*n+r[9]*i,this.z=r[2]*e+r[6]*n+r[10]*i,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=zt(this.x,t.x,e.x),this.y=zt(this.y,t.y,e.y),this.z=zt(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=zt(this.x,t,e),this.y=zt(this.y,t,e),this.z=zt(this.z,t,e),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(zt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,i=t.y,r=t.z,a=e.x,o=e.y,c=e.z;return this.x=i*c-r*o,this.y=r*a-n*c,this.z=n*o-i*a,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return sr.copy(this).projectOnVector(t),this.sub(sr)}reflect(t){return this.sub(sr.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(zt(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,i=this.z-t.z;return e*e+n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const i=Math.sin(e)*t;return this.x=i*Math.sin(n),this.y=Math.cos(e)*t,this.z=i*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),i=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=i,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const sr=new L,mo=new Di;class Ut{constructor(t,e,n,i,r,a,o,c,l){Ut.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,a,o,c,l)}set(t,e,n,i,r,a,o,c,l){const h=this.elements;return h[0]=t,h[1]=i,h[2]=o,h[3]=e,h[4]=r,h[5]=c,h[6]=n,h[7]=a,h[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,r=this.elements,a=n[0],o=n[3],c=n[6],l=n[1],h=n[4],u=n[7],d=n[2],p=n[5],g=n[8],_=i[0],m=i[3],f=i[6],b=i[1],E=i[4],S=i[7],R=i[2],A=i[5],P=i[8];return r[0]=a*_+o*b+c*R,r[3]=a*m+o*E+c*A,r[6]=a*f+o*S+c*P,r[1]=l*_+h*b+u*R,r[4]=l*m+h*E+u*A,r[7]=l*f+h*S+u*P,r[2]=d*_+p*b+g*R,r[5]=d*m+p*E+g*A,r[8]=d*f+p*S+g*P,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],c=t[6],l=t[7],h=t[8];return e*a*h-e*o*l-n*r*h+n*o*c+i*r*l-i*a*c}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],c=t[6],l=t[7],h=t[8],u=h*a-o*l,d=o*c-h*r,p=l*r-a*c,g=e*u+n*d+i*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/g;return t[0]=u*_,t[1]=(i*l-h*n)*_,t[2]=(o*n-i*a)*_,t[3]=d*_,t[4]=(h*e-i*c)*_,t[5]=(i*r-o*e)*_,t[6]=p*_,t[7]=(n*c-l*e)*_,t[8]=(a*e-n*r)*_,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,i,r,a,o){const c=Math.cos(r),l=Math.sin(r);return this.set(n*c,n*l,-n*(c*a+l*o)+a+t,-i*l,i*c,-i*(-l*a+c*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(rr.makeScale(t,e)),this}rotate(t){return this.premultiply(rr.makeRotation(-t)),this}translate(t,e){return this.premultiply(rr.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<9;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const rr=new Ut;function Vl(s){for(let t=s.length-1;t>=0;--t)if(s[t]>=65535)return!0;return!1}function ks(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function vh(){const s=ks("canvas");return s.style.display="block",s}const go={};function Qi(s){s in go||(go[s]=!0,console.warn(s))}function xh(s,t,e){return new Promise(function(n,i){function r(){switch(s.clientWaitSync(t,s.SYNC_FLUSH_COMMANDS_BIT,0)){case s.WAIT_FAILED:i();break;case s.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}const _o=new Ut().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),vo=new Ut().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Mh(){const s={enabled:!0,workingColorSpace:Ri,spaces:{},convert:function(i,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===Kt&&(i.r=dn(i.r),i.g=dn(i.g),i.b=dn(i.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(i.applyMatrix3(this.spaces[r].toXYZ),i.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===Kt&&(i.r=bi(i.r),i.g=bi(i.g),i.b=bi(i.b))),i},workingToColorSpace:function(i,r){return this.convert(i,this.workingColorSpace,r)},colorSpaceToWorking:function(i,r){return this.convert(i,r,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===An?Bs:this.spaces[i].transfer},getToneMappingMode:function(i){return this.spaces[i].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(i,r=this.workingColorSpace){return i.fromArray(this.spaces[r].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,r,a){return i.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(i,r){return Qi("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),s.workingToColorSpace(i,r)},toWorkingColorSpace:function(i,r){return Qi("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),s.colorSpaceToWorking(i,r)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],n=[.3127,.329];return s.define({[Ri]:{primaries:t,whitePoint:n,transfer:Bs,toXYZ:_o,fromXYZ:vo,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:Ee},outputColorSpaceConfig:{drawingBufferColorSpace:Ee}},[Ee]:{primaries:t,whitePoint:n,transfer:Kt,toXYZ:_o,fromXYZ:vo,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:Ee}}}),s}const Wt=Mh();function dn(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function bi(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}let ii;class yh{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let n;if(t instanceof HTMLCanvasElement)n=t;else{ii===void 0&&(ii=ks("canvas")),ii.width=t.width,ii.height=t.height;const i=ii.getContext("2d");t instanceof ImageData?i.putImageData(t,0,0):i.drawImage(t,0,0,t.width,t.height),n=ii}return n.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=ks("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const i=n.getImageData(0,0,t.width,t.height),r=i.data;for(let a=0;a<r.length;a++)r[a]=dn(r[a]/255)*255;return n.putImageData(i,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(dn(e[n]/255)*255):e[n]=dn(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let Sh=0;class Ba{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Sh++}),this.uuid=Pn(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){const e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):e instanceof VideoFrame?t.set(e.displayHeight,e.displayWidth,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let a=0,o=i.length;a<o;a++)i[a].isDataTexture?r.push(ar(i[a].image)):r.push(ar(i[a]))}else r=ar(i);n.url=r}return e||(t.images[this.uuid]=n),n}}function ar(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?yh.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let Eh=0;const or=new L;class ve extends Pi{constructor(t=ve.DEFAULT_IMAGE,e=ve.DEFAULT_MAPPING,n=qn,i=qn,r=qe,a=$n,o=$e,c=en,l=ve.DEFAULT_ANISOTROPY,h=An){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Eh++}),this.uuid=Pn(),this.name="",this.source=new Ba(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=a,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=c,this.offset=new ut(0,0),this.repeat=new ut(1,1),this.center=new ut(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ut,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(or).x}get height(){return this.source.getSize(or).y}get depth(){return this.source.getSize(or).z}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Texture.setValues(): parameter '${e}' has value of undefined.`);continue}const i=this[e];if(i===void 0){console.warn(`THREE.Texture.setValues(): property '${e}' does not exist.`);continue}i&&n&&i.isVector2&&n.isVector2||i&&n&&i.isVector3&&n.isVector3||i&&n&&i.isMatrix3&&n.isMatrix3?i.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Ll)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case $i:t.x=t.x-Math.floor(t.x);break;case qn:t.x=t.x<0?0:1;break;case Jr:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case $i:t.y=t.y-Math.floor(t.y);break;case qn:t.y=t.y<0?0:1;break;case Jr:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}ve.DEFAULT_IMAGE=null;ve.DEFAULT_MAPPING=Ll;ve.DEFAULT_ANISOTROPY=1;class ce{constructor(t=0,e=0,n=0,i=1){ce.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=i}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,i){return this.x=t,this.y=e,this.z=n,this.w=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*i+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*i+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*i+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*i+a[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,i,r;const c=t.elements,l=c[0],h=c[4],u=c[8],d=c[1],p=c[5],g=c[9],_=c[2],m=c[6],f=c[10];if(Math.abs(h-d)<.01&&Math.abs(u-_)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+_)<.1&&Math.abs(g+m)<.1&&Math.abs(l+p+f-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const E=(l+1)/2,S=(p+1)/2,R=(f+1)/2,A=(h+d)/4,P=(u+_)/4,U=(g+m)/4;return E>S&&E>R?E<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(E),i=A/n,r=P/n):S>R?S<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(S),n=A/i,r=U/i):R<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(R),n=P/r,i=U/r),this.set(n,i,r,e),this}let b=Math.sqrt((m-g)*(m-g)+(u-_)*(u-_)+(d-h)*(d-h));return Math.abs(b)<.001&&(b=1),this.x=(m-g)/b,this.y=(u-_)/b,this.z=(d-h)/b,this.w=Math.acos((l+p+f-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=zt(this.x,t.x,e.x),this.y=zt(this.y,t.y,e.y),this.z=zt(this.z,t.z,e.z),this.w=zt(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=zt(this.x,t,e),this.y=zt(this.y,t,e),this.z=zt(this.z,t,e),this.w=zt(this.w,t,e),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(zt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class bh extends Pi{constructor(t=1,e=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:qe,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=n.depth,this.scissor=new ce(0,0,t,e),this.scissorTest=!1,this.viewport=new ce(0,0,t,e);const i={width:t,height:e,depth:n.depth},r=new ve(i);this.textures=[];const a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(t={}){const e={minFilter:qe,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),t!==null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let i=0,r=this.textures.length;i<r;i++)this.textures[i].image.width=t,this.textures[i].image.height=e,this.textures[i].image.depth=n,this.textures[i].isArrayTexture=this.textures[i].image.depth>1;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,n=t.textures.length;e<n;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;const i=Object.assign({},t.textures[e].image);this.textures[e].source=new Ba(i)}return this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Zn extends bh{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class Gl extends ve{constructor(t=null,e=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=Ue,this.minFilter=Ue,this.wrapR=qn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class Th extends ve{constructor(t=null,e=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=Ue,this.minFilter=Ue,this.wrapR=qn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class jn{constructor(t=new L(1/0,1/0,1/0),e=new L(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(Ge.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(Ge.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=Ge.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,Ge):Ge.fromBufferAttribute(r,a),Ge.applyMatrix4(t.matrixWorld),this.expandByPoint(Ge);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),ss.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ss.copy(n.boundingBox)),ss.applyMatrix4(t.matrixWorld),this.union(ss)}const i=t.children;for(let r=0,a=i.length;r<a;r++)this.expandByObject(i[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,Ge),Ge.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Ni),rs.subVectors(this.max,Ni),si.subVectors(t.a,Ni),ri.subVectors(t.b,Ni),ai.subVectors(t.c,Ni),gn.subVectors(ri,si),_n.subVectors(ai,ri),Fn.subVectors(si,ai);let e=[0,-gn.z,gn.y,0,-_n.z,_n.y,0,-Fn.z,Fn.y,gn.z,0,-gn.x,_n.z,0,-_n.x,Fn.z,0,-Fn.x,-gn.y,gn.x,0,-_n.y,_n.x,0,-Fn.y,Fn.x,0];return!lr(e,si,ri,ai,rs)||(e=[1,0,0,0,1,0,0,0,1],!lr(e,si,ri,ai,rs))?!1:(as.crossVectors(gn,_n),e=[as.x,as.y,as.z],lr(e,si,ri,ai,rs))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Ge).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Ge).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(rn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),rn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),rn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),rn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),rn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),rn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),rn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),rn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(rn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}}const rn=[new L,new L,new L,new L,new L,new L,new L,new L],Ge=new L,ss=new jn,si=new L,ri=new L,ai=new L,gn=new L,_n=new L,Fn=new L,Ni=new L,rs=new L,as=new L,On=new L;function lr(s,t,e,n,i){for(let r=0,a=s.length-3;r<=a;r+=3){On.fromArray(s,r);const o=i.x*Math.abs(On.x)+i.y*Math.abs(On.y)+i.z*Math.abs(On.z),c=t.dot(On),l=e.dot(On),h=n.dot(On);if(Math.max(-Math.max(c,l,h),Math.min(c,l,h))>o)return!1}return!0}const Ah=new jn,Fi=new L,cr=new L;class Li{constructor(t=new L,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):Ah.setFromPoints(t).getCenter(n);let i=0;for(let r=0,a=t.length;r<a;r++)i=Math.max(i,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(i),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Fi.subVectors(t,this.center);const e=Fi.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),i=(n-this.radius)*.5;this.center.addScaledVector(Fi,i/n),this.radius+=i}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(cr.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Fi.copy(t.center).add(cr)),this.expandByPoint(Fi.copy(t.center).sub(cr))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}}const an=new L,hr=new L,os=new L,vn=new L,ur=new L,ls=new L,dr=new L;class za{constructor(t=new L,e=new L(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,an)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=an.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(an.copy(this.origin).addScaledVector(this.direction,e),an.distanceToSquared(t))}distanceSqToSegment(t,e,n,i){hr.copy(t).add(e).multiplyScalar(.5),os.copy(e).sub(t).normalize(),vn.copy(this.origin).sub(hr);const r=t.distanceTo(e)*.5,a=-this.direction.dot(os),o=vn.dot(this.direction),c=-vn.dot(os),l=vn.lengthSq(),h=Math.abs(1-a*a);let u,d,p,g;if(h>0)if(u=a*c-o,d=a*o-c,g=r*h,u>=0)if(d>=-g)if(d<=g){const _=1/h;u*=_,d*=_,p=u*(u+a*d+2*o)+d*(a*u+d+2*c)+l}else d=r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*c)+l;else d=-r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*c)+l;else d<=-g?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-c),r),p=-u*u+d*(d+2*c)+l):d<=g?(u=0,d=Math.min(Math.max(-r,-c),r),p=d*(d+2*c)+l):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-c),r),p=-u*u+d*(d+2*c)+l);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*c)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(hr).addScaledVector(os,d),p}intersectSphere(t,e){an.subVectors(t.center,this.origin);const n=an.dot(this.direction),i=an.dot(an)-n*n,r=t.radius*t.radius;if(i>r)return null;const a=Math.sqrt(r-i),o=n-a,c=n+a;return c<0?null:o<0?this.at(c,e):this.at(o,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,i,r,a,o,c;const l=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return l>=0?(n=(t.min.x-d.x)*l,i=(t.max.x-d.x)*l):(n=(t.max.x-d.x)*l,i=(t.min.x-d.x)*l),h>=0?(r=(t.min.y-d.y)*h,a=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,a=(t.min.y-d.y)*h),n>a||r>i||((r>n||isNaN(n))&&(n=r),(a<i||isNaN(i))&&(i=a),u>=0?(o=(t.min.z-d.z)*u,c=(t.max.z-d.z)*u):(o=(t.max.z-d.z)*u,c=(t.min.z-d.z)*u),n>c||o>i)||((o>n||n!==n)&&(n=o),(c<i||i!==i)&&(i=c),i<0)?null:this.at(n>=0?n:i,e)}intersectsBox(t){return this.intersectBox(t,an)!==null}intersectTriangle(t,e,n,i,r){ur.subVectors(e,t),ls.subVectors(n,t),dr.crossVectors(ur,ls);let a=this.direction.dot(dr),o;if(a>0){if(i)return null;o=1}else if(a<0)o=-1,a=-a;else return null;vn.subVectors(this.origin,t);const c=o*this.direction.dot(ls.crossVectors(vn,ls));if(c<0)return null;const l=o*this.direction.dot(ur.cross(vn));if(l<0||c+l>a)return null;const h=-o*vn.dot(dr);return h<0?null:this.at(h/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Zt{constructor(t,e,n,i,r,a,o,c,l,h,u,d,p,g,_,m){Zt.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,a,o,c,l,h,u,d,p,g,_,m)}set(t,e,n,i,r,a,o,c,l,h,u,d,p,g,_,m){const f=this.elements;return f[0]=t,f[4]=e,f[8]=n,f[12]=i,f[1]=r,f[5]=a,f[9]=o,f[13]=c,f[2]=l,f[6]=h,f[10]=u,f[14]=d,f[3]=p,f[7]=g,f[11]=_,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Zt().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,i=1/oi.setFromMatrixColumn(t,0).length(),r=1/oi.setFromMatrixColumn(t,1).length(),a=1/oi.setFromMatrixColumn(t,2).length();return e[0]=n[0]*i,e[1]=n[1]*i,e[2]=n[2]*i,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,i=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),c=Math.cos(i),l=Math.sin(i),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){const d=a*h,p=a*u,g=o*h,_=o*u;e[0]=c*h,e[4]=-c*u,e[8]=l,e[1]=p+g*l,e[5]=d-_*l,e[9]=-o*c,e[2]=_-d*l,e[6]=g+p*l,e[10]=a*c}else if(t.order==="YXZ"){const d=c*h,p=c*u,g=l*h,_=l*u;e[0]=d+_*o,e[4]=g*o-p,e[8]=a*l,e[1]=a*u,e[5]=a*h,e[9]=-o,e[2]=p*o-g,e[6]=_+d*o,e[10]=a*c}else if(t.order==="ZXY"){const d=c*h,p=c*u,g=l*h,_=l*u;e[0]=d-_*o,e[4]=-a*u,e[8]=g+p*o,e[1]=p+g*o,e[5]=a*h,e[9]=_-d*o,e[2]=-a*l,e[6]=o,e[10]=a*c}else if(t.order==="ZYX"){const d=a*h,p=a*u,g=o*h,_=o*u;e[0]=c*h,e[4]=g*l-p,e[8]=d*l+_,e[1]=c*u,e[5]=_*l+d,e[9]=p*l-g,e[2]=-l,e[6]=o*c,e[10]=a*c}else if(t.order==="YZX"){const d=a*c,p=a*l,g=o*c,_=o*l;e[0]=c*h,e[4]=_-d*u,e[8]=g*u+p,e[1]=u,e[5]=a*h,e[9]=-o*h,e[2]=-l*h,e[6]=p*u+g,e[10]=d-_*u}else if(t.order==="XZY"){const d=a*c,p=a*l,g=o*c,_=o*l;e[0]=c*h,e[4]=-u,e[8]=l*h,e[1]=d*u+_,e[5]=a*h,e[9]=p*u-g,e[2]=g*u-p,e[6]=o*h,e[10]=_*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(wh,t,Rh)}lookAt(t,e,n){const i=this.elements;return Le.subVectors(t,e),Le.lengthSq()===0&&(Le.z=1),Le.normalize(),xn.crossVectors(n,Le),xn.lengthSq()===0&&(Math.abs(n.z)===1?Le.x+=1e-4:Le.z+=1e-4,Le.normalize(),xn.crossVectors(n,Le)),xn.normalize(),cs.crossVectors(Le,xn),i[0]=xn.x,i[4]=cs.x,i[8]=Le.x,i[1]=xn.y,i[5]=cs.y,i[9]=Le.y,i[2]=xn.z,i[6]=cs.z,i[10]=Le.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,r=this.elements,a=n[0],o=n[4],c=n[8],l=n[12],h=n[1],u=n[5],d=n[9],p=n[13],g=n[2],_=n[6],m=n[10],f=n[14],b=n[3],E=n[7],S=n[11],R=n[15],A=i[0],P=i[4],U=i[8],y=i[12],M=i[1],D=i[5],w=i[9],O=i[13],H=i[2],G=i[6],W=i[10],et=i[14],V=i[3],rt=i[7],ct=i[11],Et=i[15];return r[0]=a*A+o*M+c*H+l*V,r[4]=a*P+o*D+c*G+l*rt,r[8]=a*U+o*w+c*W+l*ct,r[12]=a*y+o*O+c*et+l*Et,r[1]=h*A+u*M+d*H+p*V,r[5]=h*P+u*D+d*G+p*rt,r[9]=h*U+u*w+d*W+p*ct,r[13]=h*y+u*O+d*et+p*Et,r[2]=g*A+_*M+m*H+f*V,r[6]=g*P+_*D+m*G+f*rt,r[10]=g*U+_*w+m*W+f*ct,r[14]=g*y+_*O+m*et+f*Et,r[3]=b*A+E*M+S*H+R*V,r[7]=b*P+E*D+S*G+R*rt,r[11]=b*U+E*w+S*W+R*ct,r[15]=b*y+E*O+S*et+R*Et,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],i=t[8],r=t[12],a=t[1],o=t[5],c=t[9],l=t[13],h=t[2],u=t[6],d=t[10],p=t[14],g=t[3],_=t[7],m=t[11],f=t[15];return g*(+r*c*u-i*l*u-r*o*d+n*l*d+i*o*p-n*c*p)+_*(+e*c*p-e*l*d+r*a*d-i*a*p+i*l*h-r*c*h)+m*(+e*l*u-e*o*p-r*a*u+n*a*p+r*o*h-n*l*h)+f*(-i*o*h-e*c*u+e*o*d+i*a*u-n*a*d+n*c*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const i=this.elements;return t.isVector3?(i[12]=t.x,i[13]=t.y,i[14]=t.z):(i[12]=t,i[13]=e,i[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],c=t[6],l=t[7],h=t[8],u=t[9],d=t[10],p=t[11],g=t[12],_=t[13],m=t[14],f=t[15],b=u*m*l-_*d*l+_*c*p-o*m*p-u*c*f+o*d*f,E=g*d*l-h*m*l-g*c*p+a*m*p+h*c*f-a*d*f,S=h*_*l-g*u*l+g*o*p-a*_*p-h*o*f+a*u*f,R=g*u*c-h*_*c-g*o*d+a*_*d+h*o*m-a*u*m,A=e*b+n*E+i*S+r*R;if(A===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const P=1/A;return t[0]=b*P,t[1]=(_*d*r-u*m*r-_*i*p+n*m*p+u*i*f-n*d*f)*P,t[2]=(o*m*r-_*c*r+_*i*l-n*m*l-o*i*f+n*c*f)*P,t[3]=(u*c*r-o*d*r-u*i*l+n*d*l+o*i*p-n*c*p)*P,t[4]=E*P,t[5]=(h*m*r-g*d*r+g*i*p-e*m*p-h*i*f+e*d*f)*P,t[6]=(g*c*r-a*m*r-g*i*l+e*m*l+a*i*f-e*c*f)*P,t[7]=(a*d*r-h*c*r+h*i*l-e*d*l-a*i*p+e*c*p)*P,t[8]=S*P,t[9]=(g*u*r-h*_*r-g*n*p+e*_*p+h*n*f-e*u*f)*P,t[10]=(a*_*r-g*o*r+g*n*l-e*_*l-a*n*f+e*o*f)*P,t[11]=(h*o*r-a*u*r-h*n*l+e*u*l+a*n*p-e*o*p)*P,t[12]=R*P,t[13]=(h*_*i-g*u*i+g*n*d-e*_*d-h*n*m+e*u*m)*P,t[14]=(g*o*i-a*_*i-g*n*c+e*_*c+a*n*m-e*o*m)*P,t[15]=(a*u*i-h*o*i+h*n*c-e*u*c-a*n*d+e*o*d)*P,this}scale(t){const e=this.elements,n=t.x,i=t.y,r=t.z;return e[0]*=n,e[4]*=i,e[8]*=r,e[1]*=n,e[5]*=i,e[9]*=r,e[2]*=n,e[6]*=i,e[10]*=r,e[3]*=n,e[7]*=i,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],i=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,i))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),i=Math.sin(e),r=1-n,a=t.x,o=t.y,c=t.z,l=r*a,h=r*o;return this.set(l*a+n,l*o-i*c,l*c+i*o,0,l*o+i*c,h*o+n,h*c-i*a,0,l*c-i*o,h*c+i*a,r*c*c+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,i,r,a){return this.set(1,n,r,0,t,1,a,0,e,i,1,0,0,0,0,1),this}compose(t,e,n){const i=this.elements,r=e._x,a=e._y,o=e._z,c=e._w,l=r+r,h=a+a,u=o+o,d=r*l,p=r*h,g=r*u,_=a*h,m=a*u,f=o*u,b=c*l,E=c*h,S=c*u,R=n.x,A=n.y,P=n.z;return i[0]=(1-(_+f))*R,i[1]=(p+S)*R,i[2]=(g-E)*R,i[3]=0,i[4]=(p-S)*A,i[5]=(1-(d+f))*A,i[6]=(m+b)*A,i[7]=0,i[8]=(g+E)*P,i[9]=(m-b)*P,i[10]=(1-(d+_))*P,i[11]=0,i[12]=t.x,i[13]=t.y,i[14]=t.z,i[15]=1,this}decompose(t,e,n){const i=this.elements;let r=oi.set(i[0],i[1],i[2]).length();const a=oi.set(i[4],i[5],i[6]).length(),o=oi.set(i[8],i[9],i[10]).length();this.determinant()<0&&(r=-r),t.x=i[12],t.y=i[13],t.z=i[14],We.copy(this);const l=1/r,h=1/a,u=1/o;return We.elements[0]*=l,We.elements[1]*=l,We.elements[2]*=l,We.elements[4]*=h,We.elements[5]*=h,We.elements[6]*=h,We.elements[8]*=u,We.elements[9]*=u,We.elements[10]*=u,e.setFromRotationMatrix(We),n.x=r,n.y=a,n.z=o,this}makePerspective(t,e,n,i,r,a,o=tn,c=!1){const l=this.elements,h=2*r/(e-t),u=2*r/(n-i),d=(e+t)/(e-t),p=(n+i)/(n-i);let g,_;if(c)g=r/(a-r),_=a*r/(a-r);else if(o===tn)g=-(a+r)/(a-r),_=-2*a*r/(a-r);else if(o===zs)g=-a/(a-r),_=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=h,l[4]=0,l[8]=d,l[12]=0,l[1]=0,l[5]=u,l[9]=p,l[13]=0,l[2]=0,l[6]=0,l[10]=g,l[14]=_,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,i,r,a,o=tn,c=!1){const l=this.elements,h=2/(e-t),u=2/(n-i),d=-(e+t)/(e-t),p=-(n+i)/(n-i);let g,_;if(c)g=1/(a-r),_=a/(a-r);else if(o===tn)g=-2/(a-r),_=-(a+r)/(a-r);else if(o===zs)g=-1/(a-r),_=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=h,l[4]=0,l[8]=0,l[12]=d,l[1]=0,l[5]=u,l[9]=0,l[13]=p,l[2]=0,l[6]=0,l[10]=g,l[14]=_,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<16;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const oi=new L,We=new Zt,wh=new L(0,0,0),Rh=new L(1,1,1),xn=new L,cs=new L,Le=new L,xo=new Zt,Mo=new Di;class nn{constructor(t=0,e=0,n=0,i=nn.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=i}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,i=this._order){return this._x=t,this._y=e,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const i=t.elements,r=i[0],a=i[4],o=i[8],c=i[1],l=i[5],h=i[9],u=i[2],d=i[6],p=i[10];switch(e){case"XYZ":this._y=Math.asin(zt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,l),this._z=0);break;case"YXZ":this._x=Math.asin(-zt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(zt(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-a,l)):(this._y=0,this._z=Math.atan2(c,r));break;case"ZYX":this._y=Math.asin(-zt(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(c,r)):(this._x=0,this._z=Math.atan2(-a,l));break;case"YZX":this._z=Math.asin(zt(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,l),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-zt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,l),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return xo.makeRotationFromQuaternion(t),this.setFromRotationMatrix(xo,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Mo.setFromEuler(this),this.setFromQuaternion(Mo,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}nn.DEFAULT_ORDER="XYZ";class ka{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let Ch=0;const yo=new L,li=new Di,on=new Zt,hs=new L,Oi=new L,Ph=new L,Dh=new Di,So=new L(1,0,0),Eo=new L(0,1,0),bo=new L(0,0,1),To={type:"added"},Lh={type:"removed"},ci={type:"childadded",child:null},fr={type:"childremoved",child:null};class de extends Pi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ch++}),this.uuid=Pn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=de.DEFAULT_UP.clone();const t=new L,e=new nn,n=new Di,i=new L(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Zt},normalMatrix:{value:new Ut}}),this.matrix=new Zt,this.matrixWorld=new Zt,this.matrixAutoUpdate=de.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=de.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new ka,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return li.setFromAxisAngle(t,e),this.quaternion.multiply(li),this}rotateOnWorldAxis(t,e){return li.setFromAxisAngle(t,e),this.quaternion.premultiply(li),this}rotateX(t){return this.rotateOnAxis(So,t)}rotateY(t){return this.rotateOnAxis(Eo,t)}rotateZ(t){return this.rotateOnAxis(bo,t)}translateOnAxis(t,e){return yo.copy(t).applyQuaternion(this.quaternion),this.position.add(yo.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(So,t)}translateY(t){return this.translateOnAxis(Eo,t)}translateZ(t){return this.translateOnAxis(bo,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(on.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?hs.copy(t):hs.set(t,e,n);const i=this.parent;this.updateWorldMatrix(!0,!1),Oi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?on.lookAt(Oi,hs,this.up):on.lookAt(hs,Oi,this.up),this.quaternion.setFromRotationMatrix(on),i&&(on.extractRotation(i.matrixWorld),li.setFromRotationMatrix(on),this.quaternion.premultiply(li.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(To),ci.child=t,this.dispatchEvent(ci),ci.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Lh),fr.child=t,this.dispatchEvent(fr),fr.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),on.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),on.multiply(t.parent.matrixWorld)),t.applyMatrix4(on),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(To),ci.child=t,this.dispatchEvent(ci),ci.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,i=this.children.length;n<i;n++){const a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const i=this.children;for(let r=0,a=i.length;r<a;r++)i[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Oi,t,Ph),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Oi,Dh,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const i=this.children;for(let r=0,a=i.length;r<a;r++)i[r].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map(o=>({...o})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(t),i.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(i.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(i.boundingBox=this.boundingBox.toJSON()));function r(o,c){return o[c.uuid]===void 0&&(o[c.uuid]=c.toJSON(t)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const c=o.shapes;if(Array.isArray(c))for(let l=0,h=c.length;l<h;l++){const u=c[l];r(t.shapes,u)}else r(t.shapes,c)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let c=0,l=this.material.length;c<l;c++)o.push(r(t.materials,this.material[c]));i.material=o}else i.material=r(t.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const c=this.animations[o];i.animations.push(r(t.animations,c))}}if(e){const o=a(t.geometries),c=a(t.materials),l=a(t.textures),h=a(t.images),u=a(t.shapes),d=a(t.skeletons),p=a(t.animations),g=a(t.nodes);o.length>0&&(n.geometries=o),c.length>0&&(n.materials=c),l.length>0&&(n.textures=l),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),p.length>0&&(n.animations=p),g.length>0&&(n.nodes=g)}return n.object=i,n;function a(o){const c=[];for(const l in o){const h=o[l];delete h.metadata,c.push(h)}return c}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const i=t.children[n];this.add(i.clone())}return this}}de.DEFAULT_UP=new L(0,1,0);de.DEFAULT_MATRIX_AUTO_UPDATE=!0;de.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Xe=new L,ln=new L,pr=new L,cn=new L,hi=new L,ui=new L,Ao=new L,mr=new L,gr=new L,_r=new L,vr=new ce,xr=new ce,Mr=new ce;class Ve{constructor(t=new L,e=new L,n=new L){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,i){i.subVectors(n,e),Xe.subVectors(t,e),i.cross(Xe);const r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(t,e,n,i,r){Xe.subVectors(i,e),ln.subVectors(n,e),pr.subVectors(t,e);const a=Xe.dot(Xe),o=Xe.dot(ln),c=Xe.dot(pr),l=ln.dot(ln),h=ln.dot(pr),u=a*l-o*o;if(u===0)return r.set(0,0,0),null;const d=1/u,p=(l*c-o*h)*d,g=(a*h-o*c)*d;return r.set(1-p-g,g,p)}static containsPoint(t,e,n,i){return this.getBarycoord(t,e,n,i,cn)===null?!1:cn.x>=0&&cn.y>=0&&cn.x+cn.y<=1}static getInterpolation(t,e,n,i,r,a,o,c){return this.getBarycoord(t,e,n,i,cn)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(r,cn.x),c.addScaledVector(a,cn.y),c.addScaledVector(o,cn.z),c)}static getInterpolatedAttribute(t,e,n,i,r,a){return vr.setScalar(0),xr.setScalar(0),Mr.setScalar(0),vr.fromBufferAttribute(t,e),xr.fromBufferAttribute(t,n),Mr.fromBufferAttribute(t,i),a.setScalar(0),a.addScaledVector(vr,r.x),a.addScaledVector(xr,r.y),a.addScaledVector(Mr,r.z),a}static isFrontFacing(t,e,n,i){return Xe.subVectors(n,e),ln.subVectors(t,e),Xe.cross(ln).dot(i)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,i){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[i]),this}setFromAttributeAndIndices(t,e,n,i){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,i),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Xe.subVectors(this.c,this.b),ln.subVectors(this.a,this.b),Xe.cross(ln).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Ve.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Ve.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,i,r){return Ve.getInterpolation(t,this.a,this.b,this.c,e,n,i,r)}containsPoint(t){return Ve.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Ve.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,i=this.b,r=this.c;let a,o;hi.subVectors(i,n),ui.subVectors(r,n),mr.subVectors(t,n);const c=hi.dot(mr),l=ui.dot(mr);if(c<=0&&l<=0)return e.copy(n);gr.subVectors(t,i);const h=hi.dot(gr),u=ui.dot(gr);if(h>=0&&u<=h)return e.copy(i);const d=c*u-h*l;if(d<=0&&c>=0&&h<=0)return a=c/(c-h),e.copy(n).addScaledVector(hi,a);_r.subVectors(t,r);const p=hi.dot(_r),g=ui.dot(_r);if(g>=0&&p<=g)return e.copy(r);const _=p*l-c*g;if(_<=0&&l>=0&&g<=0)return o=l/(l-g),e.copy(n).addScaledVector(ui,o);const m=h*g-p*u;if(m<=0&&u-h>=0&&p-g>=0)return Ao.subVectors(r,i),o=(u-h)/(u-h+(p-g)),e.copy(i).addScaledVector(Ao,o);const f=1/(m+_+d);return a=_*f,o=d*f,e.copy(n).addScaledVector(hi,a).addScaledVector(ui,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const Wl={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Mn={h:0,s:0,l:0},us={h:0,s:0,l:0};function yr(s,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?s+(t-s)*6*e:e<1/2?t:e<2/3?s+(t-s)*6*(2/3-e):s}class Nt{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const i=t;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Ee){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Wt.colorSpaceToWorking(this,e),this}setRGB(t,e,n,i=Wt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Wt.colorSpaceToWorking(this,i),this}setHSL(t,e,n,i=Wt.workingColorSpace){if(t=_h(t,1),e=zt(e,0,1),n=zt(n,0,1),e===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=yr(a,r,t+1/3),this.g=yr(a,r,t),this.b=yr(a,r,t-1/3)}return Wt.colorSpaceToWorking(this,i),this}setStyle(t,e=Ee){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const a=i[1],o=i[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=i[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Ee){const n=Wl[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=dn(t.r),this.g=dn(t.g),this.b=dn(t.b),this}copyLinearToSRGB(t){return this.r=bi(t.r),this.g=bi(t.g),this.b=bi(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Ee){return Wt.workingToColorSpace(Se.copy(this),t),Math.round(zt(Se.r*255,0,255))*65536+Math.round(zt(Se.g*255,0,255))*256+Math.round(zt(Se.b*255,0,255))}getHexString(t=Ee){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Wt.workingColorSpace){Wt.workingToColorSpace(Se.copy(this),e);const n=Se.r,i=Se.g,r=Se.b,a=Math.max(n,i,r),o=Math.min(n,i,r);let c,l;const h=(o+a)/2;if(o===a)c=0,l=0;else{const u=a-o;switch(l=h<=.5?u/(a+o):u/(2-a-o),a){case n:c=(i-r)/u+(i<r?6:0);break;case i:c=(r-n)/u+2;break;case r:c=(n-i)/u+4;break}c/=6}return t.h=c,t.s=l,t.l=h,t}getRGB(t,e=Wt.workingColorSpace){return Wt.workingToColorSpace(Se.copy(this),e),t.r=Se.r,t.g=Se.g,t.b=Se.b,t}getStyle(t=Ee){Wt.workingToColorSpace(Se.copy(this),t);const e=Se.r,n=Se.g,i=Se.b;return t!==Ee?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(t,e,n){return this.getHSL(Mn),this.setHSL(Mn.h+t,Mn.s+e,Mn.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Mn),t.getHSL(us);const n=ir(Mn.h,us.h,e),i=ir(Mn.s,us.s,e),r=ir(Mn.l,us.l,e);return this.setHSL(n,i,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,i=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*i,this.g=r[1]*e+r[4]*n+r[7]*i,this.b=r[2]*e+r[5]*n+r[8]*i,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Se=new Nt;Nt.NAMES=Wl;let Ih=0;class Qn extends Pi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ih++}),this.uuid=Pn(),this.name="",this.type="Material",this.blending=Ei,this.side=Dn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=zr,this.blendDst=kr,this.blendEquation=Xn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Nt(0,0,0),this.blendAlpha=0,this.depthFunc=Ti,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=fo,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ni,this.stencilZFail=ni,this.stencilZPass=ni,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const i=this[e];if(i===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Ei&&(n.blending=this.blending),this.side!==Dn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==zr&&(n.blendSrc=this.blendSrc),this.blendDst!==kr&&(n.blendDst=this.blendDst),this.blendEquation!==Xn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Ti&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==fo&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==ni&&(n.stencilFail=this.stencilFail),this.stencilZFail!==ni&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==ni&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){const a=[];for(const o in r){const c=r[o];delete c.metadata,a.push(c)}return a}if(e){const r=i(t.textures),a=i(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const i=e.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}}class bn extends Qn{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Nt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new nn,this.combine=Pl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const ue=new L,ds=new ut;let Uh=0;class Ne{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Uh++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Ta,this.updateRanges=[],this.gpuType=Qe,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[t+i]=e.array[n+i];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)ds.fromBufferAttribute(this,e),ds.applyMatrix3(t),this.setXY(e,ds.x,ds.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)ue.fromBufferAttribute(this,e),ue.applyMatrix3(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)ue.fromBufferAttribute(this,e),ue.applyMatrix4(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)ue.fromBufferAttribute(this,e),ue.applyNormalMatrix(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)ue.fromBufferAttribute(this,e),ue.transformDirection(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=je(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Jt(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=je(e,this.array)),e}setX(t,e){return this.normalized&&(e=Jt(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=je(e,this.array)),e}setY(t,e){return this.normalized&&(e=Jt(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=je(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Jt(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=je(e,this.array)),e}setW(t,e){return this.normalized&&(e=Jt(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,i){return t*=this.itemSize,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array),i=Jt(i,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this}setXYZW(t,e,n,i,r){return t*=this.itemSize,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array),i=Jt(i,this.array),r=Jt(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Ta&&(t.usage=this.usage),t}}class Xl extends Ne{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class Yl extends Ne{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class ne extends Ne{constructor(t,e,n){super(new Float32Array(t),e,n)}}let Nh=0;const ze=new Zt,Sr=new de,di=new L,Ie=new jn,Bi=new jn,ge=new L;class xe extends Pi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Nh++}),this.uuid=Pn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(Vl(t)?Yl:Xl)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Ut().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(t),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return ze.makeRotationFromQuaternion(t),this.applyMatrix4(ze),this}rotateX(t){return ze.makeRotationX(t),this.applyMatrix4(ze),this}rotateY(t){return ze.makeRotationY(t),this.applyMatrix4(ze),this}rotateZ(t){return ze.makeRotationZ(t),this.applyMatrix4(ze),this}translate(t,e,n){return ze.makeTranslation(t,e,n),this.applyMatrix4(ze),this}scale(t,e,n){return ze.makeScale(t,e,n),this.applyMatrix4(ze),this}lookAt(t){return Sr.lookAt(t),Sr.updateMatrix(),this.applyMatrix4(Sr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(di).negate(),this.translate(di.x,di.y,di.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const n=[];for(let i=0,r=t.length;i<r;i++){const a=t[i];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new ne(n,3))}else{const n=Math.min(t.length,e.count);for(let i=0;i<n;i++){const r=t[i];e.setXYZ(i,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new jn);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new L(-1/0,-1/0,-1/0),new L(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,i=e.length;n<i;n++){const r=e[n];Ie.setFromBufferAttribute(r),this.morphTargetsRelative?(ge.addVectors(this.boundingBox.min,Ie.min),this.boundingBox.expandByPoint(ge),ge.addVectors(this.boundingBox.max,Ie.max),this.boundingBox.expandByPoint(ge)):(this.boundingBox.expandByPoint(Ie.min),this.boundingBox.expandByPoint(Ie.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Li);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new L,1/0);return}if(t){const n=this.boundingSphere.center;if(Ie.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){const o=e[r];Bi.setFromBufferAttribute(o),this.morphTargetsRelative?(ge.addVectors(Ie.min,Bi.min),Ie.expandByPoint(ge),ge.addVectors(Ie.max,Bi.max),Ie.expandByPoint(ge)):(Ie.expandByPoint(Bi.min),Ie.expandByPoint(Bi.max))}Ie.getCenter(n);let i=0;for(let r=0,a=t.count;r<a;r++)ge.fromBufferAttribute(t,r),i=Math.max(i,n.distanceToSquared(ge));if(e)for(let r=0,a=e.length;r<a;r++){const o=e[r],c=this.morphTargetsRelative;for(let l=0,h=o.count;l<h;l++)ge.fromBufferAttribute(o,l),c&&(di.fromBufferAttribute(t,l),ge.add(di)),i=Math.max(i,n.distanceToSquared(ge))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.position,i=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Ne(new Float32Array(4*n.count),4));const a=this.getAttribute("tangent"),o=[],c=[];for(let U=0;U<n.count;U++)o[U]=new L,c[U]=new L;const l=new L,h=new L,u=new L,d=new ut,p=new ut,g=new ut,_=new L,m=new L;function f(U,y,M){l.fromBufferAttribute(n,U),h.fromBufferAttribute(n,y),u.fromBufferAttribute(n,M),d.fromBufferAttribute(r,U),p.fromBufferAttribute(r,y),g.fromBufferAttribute(r,M),h.sub(l),u.sub(l),p.sub(d),g.sub(d);const D=1/(p.x*g.y-g.x*p.y);isFinite(D)&&(_.copy(h).multiplyScalar(g.y).addScaledVector(u,-p.y).multiplyScalar(D),m.copy(u).multiplyScalar(p.x).addScaledVector(h,-g.x).multiplyScalar(D),o[U].add(_),o[y].add(_),o[M].add(_),c[U].add(m),c[y].add(m),c[M].add(m))}let b=this.groups;b.length===0&&(b=[{start:0,count:t.count}]);for(let U=0,y=b.length;U<y;++U){const M=b[U],D=M.start,w=M.count;for(let O=D,H=D+w;O<H;O+=3)f(t.getX(O+0),t.getX(O+1),t.getX(O+2))}const E=new L,S=new L,R=new L,A=new L;function P(U){R.fromBufferAttribute(i,U),A.copy(R);const y=o[U];E.copy(y),E.sub(R.multiplyScalar(R.dot(y))).normalize(),S.crossVectors(A,y);const D=S.dot(c[U])<0?-1:1;a.setXYZW(U,E.x,E.y,E.z,D)}for(let U=0,y=b.length;U<y;++U){const M=b[U],D=M.start,w=M.count;for(let O=D,H=D+w;O<H;O+=3)P(t.getX(O+0)),P(t.getX(O+1)),P(t.getX(O+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Ne(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,p=n.count;d<p;d++)n.setXYZ(d,0,0,0);const i=new L,r=new L,a=new L,o=new L,c=new L,l=new L,h=new L,u=new L;if(t)for(let d=0,p=t.count;d<p;d+=3){const g=t.getX(d+0),_=t.getX(d+1),m=t.getX(d+2);i.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),a.fromBufferAttribute(e,m),h.subVectors(a,r),u.subVectors(i,r),h.cross(u),o.fromBufferAttribute(n,g),c.fromBufferAttribute(n,_),l.fromBufferAttribute(n,m),o.add(h),c.add(h),l.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(_,c.x,c.y,c.z),n.setXYZ(m,l.x,l.y,l.z)}else for(let d=0,p=e.count;d<p;d+=3)i.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),a.fromBufferAttribute(e,d+2),h.subVectors(a,r),u.subVectors(i,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)ge.fromBufferAttribute(t,e),ge.normalize(),t.setXYZ(e,ge.x,ge.y,ge.z)}toNonIndexed(){function t(o,c){const l=o.array,h=o.itemSize,u=o.normalized,d=new l.constructor(c.length*h);let p=0,g=0;for(let _=0,m=c.length;_<m;_++){o.isInterleavedBufferAttribute?p=c[_]*o.data.stride+o.offset:p=c[_]*h;for(let f=0;f<h;f++)d[g++]=l[p++]}return new Ne(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new xe,n=this.index.array,i=this.attributes;for(const o in i){const c=i[o],l=t(c,n);e.setAttribute(o,l)}const r=this.morphAttributes;for(const o in r){const c=[],l=r[o];for(let h=0,u=l.length;h<u;h++){const d=l[h],p=t(d,n);c.push(p)}e.morphAttributes[o]=c}e.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,c=a.length;o<c;o++){const l=a[o];e.addGroup(l.start,l.count,l.materialIndex)}return e}toJSON(){const t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const c=this.parameters;for(const l in c)c[l]!==void 0&&(t[l]=c[l]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const c in n){const l=n[c];t.data.attributes[c]=l.toJSON(t.data)}const i={};let r=!1;for(const c in this.morphAttributes){const l=this.morphAttributes[c],h=[];for(let u=0,d=l.length;u<d;u++){const p=l[u];h.push(p.toJSON(t.data))}h.length>0&&(i[c]=h,r=!0)}r&&(t.data.morphAttributes=i,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere=o.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone());const i=t.attributes;for(const l in i){const h=i[l];this.setAttribute(l,h.clone(e))}const r=t.morphAttributes;for(const l in r){const h=[],u=r[l];for(let d=0,p=u.length;d<p;d++)h.push(u[d].clone(e));this.morphAttributes[l]=h}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let l=0,h=a.length;l<h;l++){const u=a[l];this.addGroup(u.start,u.count,u.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const c=t.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const wo=new Zt,Bn=new za,fs=new Li,Ro=new L,ps=new L,ms=new L,gs=new L,Er=new L,_s=new L,Co=new L,vs=new L;class Xt extends de{constructor(t=new xe,e=new bn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){const n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(i,t);const o=this.morphTargetInfluences;if(r&&o){_s.set(0,0,0);for(let c=0,l=r.length;c<l;c++){const h=o[c],u=r[c];h!==0&&(Er.fromBufferAttribute(u,t),a?_s.addScaledVector(Er,h):_s.addScaledVector(Er.sub(e),h))}e.add(_s)}return e}raycast(t,e){const n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),fs.copy(n.boundingSphere),fs.applyMatrix4(r),Bn.copy(t.ray).recast(t.near),!(fs.containsPoint(Bn.origin)===!1&&(Bn.intersectSphere(fs,Ro)===null||Bn.origin.distanceToSquared(Ro)>(t.far-t.near)**2))&&(wo.copy(r).invert(),Bn.copy(t.ray).applyMatrix4(wo),!(n.boundingBox!==null&&Bn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Bn)))}_computeIntersections(t,e,n){let i;const r=this.geometry,a=this.material,o=r.index,c=r.attributes.position,l=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,p=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,_=d.length;g<_;g++){const m=d[g],f=a[m.materialIndex],b=Math.max(m.start,p.start),E=Math.min(o.count,Math.min(m.start+m.count,p.start+p.count));for(let S=b,R=E;S<R;S+=3){const A=o.getX(S),P=o.getX(S+1),U=o.getX(S+2);i=xs(this,f,t,n,l,h,u,A,P,U),i&&(i.faceIndex=Math.floor(S/3),i.face.materialIndex=m.materialIndex,e.push(i))}}else{const g=Math.max(0,p.start),_=Math.min(o.count,p.start+p.count);for(let m=g,f=_;m<f;m+=3){const b=o.getX(m),E=o.getX(m+1),S=o.getX(m+2);i=xs(this,a,t,n,l,h,u,b,E,S),i&&(i.faceIndex=Math.floor(m/3),e.push(i))}}else if(c!==void 0)if(Array.isArray(a))for(let g=0,_=d.length;g<_;g++){const m=d[g],f=a[m.materialIndex],b=Math.max(m.start,p.start),E=Math.min(c.count,Math.min(m.start+m.count,p.start+p.count));for(let S=b,R=E;S<R;S+=3){const A=S,P=S+1,U=S+2;i=xs(this,f,t,n,l,h,u,A,P,U),i&&(i.faceIndex=Math.floor(S/3),i.face.materialIndex=m.materialIndex,e.push(i))}}else{const g=Math.max(0,p.start),_=Math.min(c.count,p.start+p.count);for(let m=g,f=_;m<f;m+=3){const b=m,E=m+1,S=m+2;i=xs(this,a,t,n,l,h,u,b,E,S),i&&(i.faceIndex=Math.floor(m/3),e.push(i))}}}}function Fh(s,t,e,n,i,r,a,o){let c;if(t.side===we?c=n.intersectTriangle(a,r,i,!0,o):c=n.intersectTriangle(i,r,a,t.side===Dn,o),c===null)return null;vs.copy(o),vs.applyMatrix4(s.matrixWorld);const l=e.ray.origin.distanceTo(vs);return l<e.near||l>e.far?null:{distance:l,point:vs.clone(),object:s}}function xs(s,t,e,n,i,r,a,o,c,l){s.getVertexPosition(o,ps),s.getVertexPosition(c,ms),s.getVertexPosition(l,gs);const h=Fh(s,t,e,n,ps,ms,gs,Co);if(h){const u=new L;Ve.getBarycoord(Co,ps,ms,gs,u),i&&(h.uv=Ve.getInterpolatedAttribute(i,o,c,l,u,new ut)),r&&(h.uv1=Ve.getInterpolatedAttribute(r,o,c,l,u,new ut)),a&&(h.normal=Ve.getInterpolatedAttribute(a,o,c,l,u,new L),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const d={a:o,b:c,c:l,normal:new L,materialIndex:0};Ve.getNormal(ps,ms,gs,d.normal),h.face=d,h.barycoord=u}return h}class Ln extends xe{constructor(t=1,e=1,n=1,i=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:i,heightSegments:r,depthSegments:a};const o=this;i=Math.floor(i),r=Math.floor(r),a=Math.floor(a);const c=[],l=[],h=[],u=[];let d=0,p=0;g("z","y","x",-1,-1,n,e,t,a,r,0),g("z","y","x",1,-1,n,e,-t,a,r,1),g("x","z","y",1,1,t,n,e,i,a,2),g("x","z","y",1,-1,t,n,-e,i,a,3),g("x","y","z",1,-1,t,e,n,i,r,4),g("x","y","z",-1,-1,t,e,-n,i,r,5),this.setIndex(c),this.setAttribute("position",new ne(l,3)),this.setAttribute("normal",new ne(h,3)),this.setAttribute("uv",new ne(u,2));function g(_,m,f,b,E,S,R,A,P,U,y){const M=S/P,D=R/U,w=S/2,O=R/2,H=A/2,G=P+1,W=U+1;let et=0,V=0;const rt=new L;for(let ct=0;ct<W;ct++){const Et=ct*D-O;for(let Bt=0;Bt<G;Bt++){const Qt=Bt*M-w;rt[_]=Qt*b,rt[m]=Et*E,rt[f]=H,l.push(rt.x,rt.y,rt.z),rt[_]=0,rt[m]=0,rt[f]=A>0?1:-1,h.push(rt.x,rt.y,rt.z),u.push(Bt/P),u.push(1-ct/U),et+=1}}for(let ct=0;ct<U;ct++)for(let Et=0;Et<P;Et++){const Bt=d+Et+G*ct,Qt=d+Et+G*(ct+1),ie=d+(Et+1)+G*(ct+1),Yt=d+(Et+1)+G*ct;c.push(Bt,Qt,Yt),c.push(Qt,ie,Yt),V+=6}o.addGroup(p,V,y),p+=V,d+=et}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ln(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function Ci(s){const t={};for(const e in s){t[e]={};for(const n in s[e]){const i=s[e][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=i.clone():Array.isArray(i)?t[e][n]=i.slice():t[e][n]=i}}return t}function Ae(s){const t={};for(let e=0;e<s.length;e++){const n=Ci(s[e]);for(const i in n)t[i]=n[i]}return t}function Oh(s){const t=[];for(let e=0;e<s.length;e++)t.push(s[e].clone());return t}function ql(s){const t=s.getRenderTarget();return t===null?s.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Wt.workingColorSpace}const Bh={clone:Ci,merge:Ae};var zh=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,kh=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class fn extends Qn{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=zh,this.fragmentShader=kh,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Ci(t.uniforms),this.uniformsGroups=Oh(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const i in this.uniforms){const a=this.uniforms[i].value;a&&a.isTexture?e.uniforms[i]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[i]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[i]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[i]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[i]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[i]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[i]={type:"m4",value:a.toArray()}:e.uniforms[i]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class $l extends de{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Zt,this.projectionMatrix=new Zt,this.projectionMatrixInverse=new Zt,this.coordinateSystem=tn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const yn=new L,Po=new ut,Do=new ut;class ke extends $l{constructor(t=50,e=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=Aa*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(nr*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Aa*2*Math.atan(Math.tan(nr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){yn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(yn.x,yn.y).multiplyScalar(-t/yn.z),yn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(yn.x,yn.y).multiplyScalar(-t/yn.z)}getViewSize(t,e){return this.getViewBounds(t,Po,Do),e.subVectors(Do,Po)}setViewOffset(t,e,n,i,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(nr*.5*this.fov)/this.zoom,n=2*e,i=this.aspect*n,r=-.5*i;const a=this.view;if(this.view!==null&&this.view.enabled){const c=a.fullWidth,l=a.fullHeight;r+=a.offsetX*i/c,e-=a.offsetY*n/l,i*=a.width/c,n*=a.height/l}const o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,e,e-n,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const fi=-90,pi=1;class Hh extends de{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new ke(fi,pi,t,e);i.layers=this.layers,this.add(i);const r=new ke(fi,pi,t,e);r.layers=this.layers,this.add(r);const a=new ke(fi,pi,t,e);a.layers=this.layers,this.add(a);const o=new ke(fi,pi,t,e);o.layers=this.layers,this.add(o);const c=new ke(fi,pi,t,e);c.layers=this.layers,this.add(c);const l=new ke(fi,pi,t,e);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,i,r,a,o,c]=e;for(const l of e)this.remove(l);if(t===tn)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(t===zs)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const l of e)this.add(l),l.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,c,l,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),p=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,i),t.render(e,r),t.setRenderTarget(n,1,i),t.render(e,a),t.setRenderTarget(n,2,i),t.render(e,o),t.setRenderTarget(n,3,i),t.render(e,c),t.setRenderTarget(n,4,i),t.render(e,l),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,i),t.render(e,h),t.setRenderTarget(u,d,p),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class Kl extends ve{constructor(t=[],e=Ai,n,i,r,a,o,c,l,h){super(t,e,n,i,r,a,o,c,l,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class Vh extends Zn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},i=[n,n,n,n,n,n];this.texture=new Kl(i),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new Ln(5,5,5),r=new fn({name:"CubemapFromEquirect",uniforms:Ci(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:we,blending:Rn});r.uniforms.tEquirect.value=e;const a=new Xt(i,r),o=e.minFilter;return e.minFilter===$n&&(e.minFilter=qe),new Hh(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e=!0,n=!0,i=!0){const r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,i);t.setRenderTarget(r)}}class _e extends de{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Gh={type:"move"};class br{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new _e,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new _e,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new L,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new L),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new _e,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new L,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new L),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let i=null,r=null,a=null;const o=this._targetRay,c=this._grip,l=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(l&&t.hand){a=!0;for(const _ of t.hand.values()){const m=e.getJointPose(_,n),f=this._getHandJoint(l,_);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}const h=l.joints["index-finger-tip"],u=l.joints["thumb-tip"],d=h.position.distanceTo(u.position),p=.02,g=.005;l.inputState.pinching&&d>p+g?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!l.inputState.pinching&&d<=p-g&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else c!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(c.matrix.fromArray(r.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,r.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(r.linearVelocity)):c.hasLinearVelocity=!1,r.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(r.angularVelocity)):c.hasAngularVelocity=!1));o!==null&&(i=e.getPose(t.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Gh)))}return o!==null&&(o.visible=i!==null),c!==null&&(c.visible=r!==null),l!==null&&(l.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new _e;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}class Ha{constructor(t,e=25e-5){this.isFogExp2=!0,this.name="",this.color=new Nt(t),this.density=e}clone(){return new Ha(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class Wh extends de{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new nn,this.environmentIntensity=1,this.environmentRotation=new nn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class Xh{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=Ta,this.updateRanges=[],this.version=0,this.uuid=Pn()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let i=0,r=this.stride;i<r;i++)this.array[t+i]=e.array[n+i];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Pn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Pn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Te=new L;class Hs{constructor(t,e,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)Te.fromBufferAttribute(this,e),Te.applyMatrix4(t),this.setXYZ(e,Te.x,Te.y,Te.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Te.fromBufferAttribute(this,e),Te.applyNormalMatrix(t),this.setXYZ(e,Te.x,Te.y,Te.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Te.fromBufferAttribute(this,e),Te.transformDirection(t),this.setXYZ(e,Te.x,Te.y,Te.z);return this}getComponent(t,e){let n=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(n=je(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Jt(n,this.array)),this.data.array[t*this.data.stride+this.offset+e]=n,this}setX(t,e){return this.normalized&&(e=Jt(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=Jt(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=Jt(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=Jt(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=je(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=je(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=je(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=je(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,i){return t=t*this.data.stride+this.offset,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array),i=Jt(i,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this}setXYZW(t,e,n,i,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=Jt(e,this.array),n=Jt(n,this.array),i=Jt(i,this.array),r=Jt(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this.data.array[t+3]=r,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[i+r])}return new Ne(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new Hs(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class Vs extends Qn{constructor(t){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Nt(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let mi;const zi=new L,gi=new L,_i=new L,vi=new ut,ki=new ut,Jl=new Zt,Ms=new L,Hi=new L,ys=new L,Lo=new ut,Tr=new ut,Io=new ut;class wa extends de{constructor(t=new Vs){if(super(),this.isSprite=!0,this.type="Sprite",mi===void 0){mi=new xe;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Xh(e,5);mi.setIndex([0,1,2,0,2,3]),mi.setAttribute("position",new Hs(n,3,0,!1)),mi.setAttribute("uv",new Hs(n,2,3,!1))}this.geometry=mi,this.material=t,this.center=new ut(.5,.5),this.count=1}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),gi.setFromMatrixScale(this.matrixWorld),Jl.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),_i.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&gi.multiplyScalar(-_i.z);const n=this.material.rotation;let i,r;n!==0&&(r=Math.cos(n),i=Math.sin(n));const a=this.center;Ss(Ms.set(-.5,-.5,0),_i,a,gi,i,r),Ss(Hi.set(.5,-.5,0),_i,a,gi,i,r),Ss(ys.set(.5,.5,0),_i,a,gi,i,r),Lo.set(0,0),Tr.set(1,0),Io.set(1,1);let o=t.ray.intersectTriangle(Ms,Hi,ys,!1,zi);if(o===null&&(Ss(Hi.set(-.5,.5,0),_i,a,gi,i,r),Tr.set(0,1),o=t.ray.intersectTriangle(Ms,ys,Hi,!1,zi),o===null))return;const c=t.ray.origin.distanceTo(zi);c<t.near||c>t.far||e.push({distance:c,point:zi.clone(),uv:Ve.getInterpolation(zi,Ms,Hi,ys,Lo,Tr,Io,new ut),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function Ss(s,t,e,n,i,r){vi.subVectors(s,e).addScalar(.5).multiply(n),i!==void 0?(ki.x=r*vi.x-i*vi.y,ki.y=i*vi.x+r*vi.y):ki.copy(vi),s.copy(t),s.x+=ki.x,s.y+=ki.y,s.applyMatrix4(Jl)}class Yh extends ve{constructor(t=null,e=1,n=1,i,r,a,o,c,l=Ue,h=Ue,u,d){super(null,a,o,c,l,h,i,r,u,d),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Uo extends Ne{constructor(t,e,n,i=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const xi=new Zt,No=new Zt,Es=[],Fo=new jn,qh=new Zt,Vi=new Xt,Gi=new Li;class Sn extends Xt{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new Uo(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,qh)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new jn),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,xi),Fo.copy(t.boundingBox).applyMatrix4(xi),this.boundingBox.union(Fo)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new Li),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,xi),Gi.copy(t.boundingSphere).applyMatrix4(xi),this.boundingSphere.union(Gi)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const n=e.morphTargetInfluences,i=this.morphTexture.source.data.data,r=n.length+1,a=t*r+1;for(let o=0;o<n.length;o++)n[o]=i[a+o]}raycast(t,e){const n=this.matrixWorld,i=this.count;if(Vi.geometry=this.geometry,Vi.material=this.material,Vi.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Gi.copy(this.boundingSphere),Gi.applyMatrix4(n),t.ray.intersectsSphere(Gi)!==!1))for(let r=0;r<i;r++){this.getMatrixAt(r,xi),No.multiplyMatrices(n,xi),Vi.matrixWorld=No,Vi.raycast(t,Es);for(let a=0,o=Es.length;a<o;a++){const c=Es[a];c.instanceId=r,c.object=this,e.push(c)}Es.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new Uo(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const n=e.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new Yh(new Float32Array(i*this.count),i,this.count,Ua,Qe));const r=this.morphTexture.source.data.data;let a=0;for(let l=0;l<n.length;l++)a+=n[l];const o=this.geometry.morphTargetsRelative?1:1-a,c=i*t;r[c]=o,r.set(n,c+1)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const Ar=new L,$h=new L,Kh=new Ut;class Tn{constructor(t=new L(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,i){return this.normal.set(t,e,n),this.constant=i,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const i=Ar.subVectors(n,e).cross($h.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(i,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(Ar),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/i;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||Kh.getNormalMatrix(t),i=this.coplanarPoint(Ar).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const zn=new Li,Jh=new ut(.5,.5),bs=new L;class Va{constructor(t=new Tn,e=new Tn,n=new Tn,i=new Tn,r=new Tn,a=new Tn){this.planes=[t,e,n,i,r,a]}set(t,e,n,i,r,a){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(i),o[4].copy(r),o[5].copy(a),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=tn,n=!1){const i=this.planes,r=t.elements,a=r[0],o=r[1],c=r[2],l=r[3],h=r[4],u=r[5],d=r[6],p=r[7],g=r[8],_=r[9],m=r[10],f=r[11],b=r[12],E=r[13],S=r[14],R=r[15];if(i[0].setComponents(l-a,p-h,f-g,R-b).normalize(),i[1].setComponents(l+a,p+h,f+g,R+b).normalize(),i[2].setComponents(l+o,p+u,f+_,R+E).normalize(),i[3].setComponents(l-o,p-u,f-_,R-E).normalize(),n)i[4].setComponents(c,d,m,S).normalize(),i[5].setComponents(l-c,p-d,f-m,R-S).normalize();else if(i[4].setComponents(l-c,p-d,f-m,R-S).normalize(),e===tn)i[5].setComponents(l+c,p+d,f+m,R+S).normalize();else if(e===zs)i[5].setComponents(c,d,m,S).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),zn.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),zn.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(zn)}intersectsSprite(t){zn.center.set(0,0,0);const e=Jh.distanceTo(t.center);return zn.radius=.7071067811865476+e,zn.applyMatrix4(t.matrixWorld),this.intersectsSphere(zn)}intersectsSphere(t){const e=this.planes,n=t.center,i=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const i=e[n];if(bs.x=i.normal.x>0?t.max.x:t.min.x,bs.y=i.normal.y>0?t.max.y:t.min.y,bs.z=i.normal.z>0?t.max.z:t.min.z,i.distanceToPoint(bs)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Zl extends Qn{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Nt(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}}const Gs=new L,Ws=new L,Oo=new Zt,Wi=new za,Ts=new Li,wr=new L,Bo=new L;class Zh extends de{constructor(t=new xe,e=new Zl){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[0];for(let i=1,r=e.count;i<r;i++)Gs.fromBufferAttribute(e,i-1),Ws.fromBufferAttribute(e,i),n[i]=n[i-1],n[i]+=Gs.distanceTo(Ws);t.setAttribute("lineDistance",new ne(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,e){const n=this.geometry,i=this.matrixWorld,r=t.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ts.copy(n.boundingSphere),Ts.applyMatrix4(i),Ts.radius+=r,t.ray.intersectsSphere(Ts)===!1)return;Oo.copy(i).invert(),Wi.copy(t.ray).applyMatrix4(Oo);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),c=o*o,l=this.isLineSegments?2:1,h=n.index,d=n.attributes.position;if(h!==null){const p=Math.max(0,a.start),g=Math.min(h.count,a.start+a.count);for(let _=p,m=g-1;_<m;_+=l){const f=h.getX(_),b=h.getX(_+1),E=As(this,t,Wi,c,f,b,_);E&&e.push(E)}if(this.isLineLoop){const _=h.getX(g-1),m=h.getX(p),f=As(this,t,Wi,c,_,m,g-1);f&&e.push(f)}}else{const p=Math.max(0,a.start),g=Math.min(d.count,a.start+a.count);for(let _=p,m=g-1;_<m;_+=l){const f=As(this,t,Wi,c,_,_+1,_);f&&e.push(f)}if(this.isLineLoop){const _=As(this,t,Wi,c,g-1,p,g-1);_&&e.push(_)}}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function As(s,t,e,n,i,r,a){const o=s.geometry.attributes.position;if(Gs.fromBufferAttribute(o,i),Ws.fromBufferAttribute(o,r),e.distanceSqToSegment(Gs,Ws,wr,Bo)>n)return;wr.applyMatrix4(s.matrixWorld);const l=t.ray.origin.distanceTo(wr);if(!(l<t.near||l>t.far))return{distance:l,point:Bo.clone().applyMatrix4(s.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:s}}class Fs extends ve{constructor(t,e,n,i,r,a,o,c,l){super(t,e,n,i,r,a,o,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}}class jl extends ve{constructor(t,e,n=Jn,i,r,a,o=Ue,c=Ue,l,h=Zi,u=1){if(h!==Zi&&h!==ji)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const d={width:t,height:e,depth:u};super(d,i,r,a,o,c,h,n,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new Ba(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}class Ql extends ve{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}}class Ga extends xe{constructor(t=1,e=1,n=4,i=8,r=1){super(),this.type="CapsuleGeometry",this.parameters={radius:t,height:e,capSegments:n,radialSegments:i,heightSegments:r},e=Math.max(0,e),n=Math.max(1,Math.floor(n)),i=Math.max(3,Math.floor(i)),r=Math.max(1,Math.floor(r));const a=[],o=[],c=[],l=[],h=e/2,u=Math.PI/2*t,d=e,p=2*u+d,g=n*2+r,_=i+1,m=new L,f=new L;for(let b=0;b<=g;b++){let E=0,S=0,R=0,A=0;if(b<=n){const y=b/n,M=y*Math.PI/2;S=-h-t*Math.cos(M),R=t*Math.sin(M),A=-t*Math.cos(M),E=y*u}else if(b<=n+r){const y=(b-n)/r;S=-h+y*e,R=t,A=0,E=u+y*d}else{const y=(b-n-r)/n,M=y*Math.PI/2;S=h+t*Math.sin(M),R=t*Math.cos(M),A=t*Math.sin(M),E=u+d+y*u}const P=Math.max(0,Math.min(1,E/p));let U=0;b===0?U=.5/i:b===g&&(U=-.5/i);for(let y=0;y<=i;y++){const M=y/i,D=M*Math.PI*2,w=Math.sin(D),O=Math.cos(D);f.x=-R*O,f.y=S,f.z=R*w,o.push(f.x,f.y,f.z),m.set(-R*O,A,R*w),m.normalize(),c.push(m.x,m.y,m.z),l.push(M+U,P)}if(b>0){const y=(b-1)*_;for(let M=0;M<i;M++){const D=y+M,w=y+M+1,O=b*_+M,H=b*_+M+1;a.push(D,w,O),a.push(w,H,O)}}}this.setIndex(a),this.setAttribute("position",new ne(o,3)),this.setAttribute("normal",new ne(c,3)),this.setAttribute("uv",new ne(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ga(t.radius,t.height,t.capSegments,t.radialSegments,t.heightSegments)}}class Kn extends xe{constructor(t=1,e=1,n=1,i=32,r=1,a=!1,o=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:i,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:c};const l=this;i=Math.floor(i),r=Math.floor(r);const h=[],u=[],d=[],p=[];let g=0;const _=[],m=n/2;let f=0;b(),a===!1&&(t>0&&E(!0),e>0&&E(!1)),this.setIndex(h),this.setAttribute("position",new ne(u,3)),this.setAttribute("normal",new ne(d,3)),this.setAttribute("uv",new ne(p,2));function b(){const S=new L,R=new L;let A=0;const P=(e-t)/n;for(let U=0;U<=r;U++){const y=[],M=U/r,D=M*(e-t)+t;for(let w=0;w<=i;w++){const O=w/i,H=O*c+o,G=Math.sin(H),W=Math.cos(H);R.x=D*G,R.y=-M*n+m,R.z=D*W,u.push(R.x,R.y,R.z),S.set(G,P,W).normalize(),d.push(S.x,S.y,S.z),p.push(O,1-M),y.push(g++)}_.push(y)}for(let U=0;U<i;U++)for(let y=0;y<r;y++){const M=_[y][U],D=_[y+1][U],w=_[y+1][U+1],O=_[y][U+1];(t>0||y!==0)&&(h.push(M,D,O),A+=3),(e>0||y!==r-1)&&(h.push(D,w,O),A+=3)}l.addGroup(f,A,0),f+=A}function E(S){const R=g,A=new ut,P=new L;let U=0;const y=S===!0?t:e,M=S===!0?1:-1;for(let w=1;w<=i;w++)u.push(0,m*M,0),d.push(0,M,0),p.push(.5,.5),g++;const D=g;for(let w=0;w<=i;w++){const H=w/i*c+o,G=Math.cos(H),W=Math.sin(H);P.x=y*W,P.y=m*M,P.z=y*G,u.push(P.x,P.y,P.z),d.push(0,M,0),A.x=G*.5+.5,A.y=W*.5*M+.5,p.push(A.x,A.y),g++}for(let w=0;w<i;w++){const O=R+w,H=D+w;S===!0?h.push(H,H+1,O):h.push(H+1,H,O),U+=3}l.addGroup(f,U,S===!0?1:2),f+=U}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Kn(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Wa extends Kn{constructor(t=1,e=1,n=32,i=1,r=!1,a=0,o=Math.PI*2){super(0,t,e,n,i,r,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(t){return new Wa(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class pn{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){console.warn("THREE.Curve: .getPoint() not implemented.")}getPointAt(t,e){const n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let n,i=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)n=this.getPoint(a/t),r+=n.distanceTo(i),e.push(r),i=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e=null){const n=this.getLengths();let i=0;const r=n.length;let a;e?a=e:a=t*n[r-1];let o=0,c=r-1,l;for(;o<=c;)if(i=Math.floor(o+(c-o)/2),l=n[i]-a,l<0)o=i+1;else if(l>0)c=i-1;else{c=i;break}if(i=c,n[i]===a)return i/(r-1);const h=n[i],d=n[i+1]-h,p=(a-h)/d;return(i+p)/(r-1)}getTangent(t,e){let i=t-1e-4,r=t+1e-4;i<0&&(i=0),r>1&&(r=1);const a=this.getPoint(i),o=this.getPoint(r),c=e||(a.isVector2?new ut:new L);return c.copy(o).sub(a).normalize(),c}getTangentAt(t,e){const n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e=!1){const n=new L,i=[],r=[],a=[],o=new L,c=new Zt;for(let p=0;p<=t;p++){const g=p/t;i[p]=this.getTangentAt(g,new L)}r[0]=new L,a[0]=new L;let l=Number.MAX_VALUE;const h=Math.abs(i[0].x),u=Math.abs(i[0].y),d=Math.abs(i[0].z);h<=l&&(l=h,n.set(1,0,0)),u<=l&&(l=u,n.set(0,1,0)),d<=l&&n.set(0,0,1),o.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],o),a[0].crossVectors(i[0],r[0]);for(let p=1;p<=t;p++){if(r[p]=r[p-1].clone(),a[p]=a[p-1].clone(),o.crossVectors(i[p-1],i[p]),o.length()>Number.EPSILON){o.normalize();const g=Math.acos(zt(i[p-1].dot(i[p]),-1,1));r[p].applyMatrix4(c.makeRotationAxis(o,g))}a[p].crossVectors(i[p],r[p])}if(e===!0){let p=Math.acos(zt(r[0].dot(r[t]),-1,1));p/=t,i[0].dot(o.crossVectors(r[0],r[t]))>0&&(p=-p);for(let g=1;g<=t;g++)r[g].applyMatrix4(c.makeRotationAxis(i[g],p*g)),a[g].crossVectors(i[g],r[g])}return{tangents:i,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class tc extends pn{constructor(t=0,e=0,n=1,i=1,r=0,a=Math.PI*2,o=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=c}getPoint(t,e=new ut){const n=e,i=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=i;for(;r>i;)r-=i;r<Number.EPSILON&&(a?r=0:r=i),this.aClockwise===!0&&!a&&(r===i?r=-i:r=r-i);const o=this.aStartAngle+t*r;let c=this.aX+this.xRadius*Math.cos(o),l=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=c-this.aX,p=l-this.aY;c=d*h-p*u+this.aX,l=d*u+p*h+this.aY}return n.set(c,l)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class jh extends tc{constructor(t,e,n,i,r,a){super(t,e,n,n,i,r,a),this.isArcCurve=!0,this.type="ArcCurve"}}function Xa(){let s=0,t=0,e=0,n=0;function i(r,a,o,c){s=r,t=o,e=-3*r+3*a-2*o-c,n=2*r-2*a+o+c}return{initCatmullRom:function(r,a,o,c,l){i(a,o,l*(o-r),l*(c-a))},initNonuniformCatmullRom:function(r,a,o,c,l,h,u){let d=(a-r)/l-(o-r)/(l+h)+(o-a)/h,p=(o-a)/h-(c-a)/(h+u)+(c-o)/u;d*=h,p*=h,i(a,o,d,p)},calc:function(r){const a=r*r,o=a*r;return s+t*r+e*a+n*o}}}const ws=new L,Rr=new Xa,Cr=new Xa,Pr=new Xa;class Ya extends pn{constructor(t=[],e=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=i}getPoint(t,e=new L){const n=e,i=this.points,r=i.length,a=(r-(this.closed?0:1))*t;let o=Math.floor(a),c=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:c===0&&o===r-1&&(o=r-2,c=1);let l,h;this.closed||o>0?l=i[(o-1)%r]:(ws.subVectors(i[0],i[1]).add(i[0]),l=ws);const u=i[o%r],d=i[(o+1)%r];if(this.closed||o+2<r?h=i[(o+2)%r]:(ws.subVectors(i[r-1],i[r-2]).add(i[r-1]),h=ws),this.curveType==="centripetal"||this.curveType==="chordal"){const p=this.curveType==="chordal"?.5:.25;let g=Math.pow(l.distanceToSquared(u),p),_=Math.pow(u.distanceToSquared(d),p),m=Math.pow(d.distanceToSquared(h),p);_<1e-4&&(_=1),g<1e-4&&(g=_),m<1e-4&&(m=_),Rr.initNonuniformCatmullRom(l.x,u.x,d.x,h.x,g,_,m),Cr.initNonuniformCatmullRom(l.y,u.y,d.y,h.y,g,_,m),Pr.initNonuniformCatmullRom(l.z,u.z,d.z,h.z,g,_,m)}else this.curveType==="catmullrom"&&(Rr.initCatmullRom(l.x,u.x,d.x,h.x,this.tension),Cr.initCatmullRom(l.y,u.y,d.y,h.y,this.tension),Pr.initCatmullRom(l.z,u.z,d.z,h.z,this.tension));return n.set(Rr.calc(c),Cr.calc(c),Pr.calc(c)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new L().fromArray(i))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function zo(s,t,e,n,i){const r=(n-t)*.5,a=(i-e)*.5,o=s*s,c=s*o;return(2*e-2*n+r+a)*c+(-3*e+3*n-2*r-a)*o+r*s+e}function Qh(s,t){const e=1-s;return e*e*t}function tu(s,t){return 2*(1-s)*s*t}function eu(s,t){return s*s*t}function Yi(s,t,e,n){return Qh(s,t)+tu(s,e)+eu(s,n)}function nu(s,t){const e=1-s;return e*e*e*t}function iu(s,t){const e=1-s;return 3*e*e*s*t}function su(s,t){return 3*(1-s)*s*s*t}function ru(s,t){return s*s*s*t}function qi(s,t,e,n,i){return nu(s,t)+iu(s,e)+su(s,n)+ru(s,i)}class au extends pn{constructor(t=new ut,e=new ut,n=new ut,i=new ut){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new ut){const n=e,i=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(qi(t,i.x,r.x,a.x,o.x),qi(t,i.y,r.y,a.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class ou extends pn{constructor(t=new L,e=new L,n=new L,i=new L){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new L){const n=e,i=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(qi(t,i.x,r.x,a.x,o.x),qi(t,i.y,r.y,a.y,o.y),qi(t,i.z,r.z,a.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class lu extends pn{constructor(t=new ut,e=new ut){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new ut){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new ut){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class cu extends pn{constructor(t=new L,e=new L){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new L){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new L){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class hu extends pn{constructor(t=new ut,e=new ut,n=new ut){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new ut){const n=e,i=this.v0,r=this.v1,a=this.v2;return n.set(Yi(t,i.x,r.x,a.x),Yi(t,i.y,r.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class ec extends pn{constructor(t=new L,e=new L,n=new L){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new L){const n=e,i=this.v0,r=this.v1,a=this.v2;return n.set(Yi(t,i.x,r.x,a.x),Yi(t,i.y,r.y,a.y),Yi(t,i.z,r.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class uu extends pn{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new ut){const n=e,i=this.points,r=(i.length-1)*t,a=Math.floor(r),o=r-a,c=i[a===0?a:a-1],l=i[a],h=i[a>i.length-2?i.length-1:a+1],u=i[a>i.length-3?i.length-1:a+2];return n.set(zo(o,c.x,l.x,h.x,u.x),zo(o,c.y,l.y,h.y,u.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new ut().fromArray(i))}return this}}var du=Object.freeze({__proto__:null,ArcCurve:jh,CatmullRomCurve3:Ya,CubicBezierCurve:au,CubicBezierCurve3:ou,EllipseCurve:tc,LineCurve:lu,LineCurve3:cu,QuadraticBezierCurve:hu,QuadraticBezierCurve3:ec,SplineCurve:uu});class Ye extends xe{constructor(t=1,e=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:i};const r=t/2,a=e/2,o=Math.floor(n),c=Math.floor(i),l=o+1,h=c+1,u=t/o,d=e/c,p=[],g=[],_=[],m=[];for(let f=0;f<h;f++){const b=f*d-a;for(let E=0;E<l;E++){const S=E*u-r;g.push(S,-b,0),_.push(0,0,1),m.push(E/o),m.push(1-f/c)}}for(let f=0;f<c;f++)for(let b=0;b<o;b++){const E=b+l*f,S=b+l*(f+1),R=b+1+l*(f+1),A=b+1+l*f;p.push(E,S,A),p.push(S,R,A)}this.setIndex(p),this.setAttribute("position",new ne(g,3)),this.setAttribute("normal",new ne(_,3)),this.setAttribute("uv",new ne(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ye(t.width,t.height,t.widthSegments,t.heightSegments)}}class Xs extends xe{constructor(t=.5,e=1,n=32,i=1,r=0,a=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:t,outerRadius:e,thetaSegments:n,phiSegments:i,thetaStart:r,thetaLength:a},n=Math.max(3,n),i=Math.max(1,i);const o=[],c=[],l=[],h=[];let u=t;const d=(e-t)/i,p=new L,g=new ut;for(let _=0;_<=i;_++){for(let m=0;m<=n;m++){const f=r+m/n*a;p.x=u*Math.cos(f),p.y=u*Math.sin(f),c.push(p.x,p.y,p.z),l.push(0,0,1),g.x=(p.x/e+1)/2,g.y=(p.y/e+1)/2,h.push(g.x,g.y)}u+=d}for(let _=0;_<i;_++){const m=_*(n+1);for(let f=0;f<n;f++){const b=f+m,E=b,S=b+n+1,R=b+n+2,A=b+1;o.push(E,S,A),o.push(S,R,A)}}this.setIndex(o),this.setAttribute("position",new ne(c,3)),this.setAttribute("normal",new ne(l,3)),this.setAttribute("uv",new ne(h,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Xs(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}}class wn extends xe{constructor(t=1,e=32,n=16,i=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:i,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const c=Math.min(a+o,Math.PI);let l=0;const h=[],u=new L,d=new L,p=[],g=[],_=[],m=[];for(let f=0;f<=n;f++){const b=[],E=f/n;let S=0;f===0&&a===0?S=.5/e:f===n&&c===Math.PI&&(S=-.5/e);for(let R=0;R<=e;R++){const A=R/e;u.x=-t*Math.cos(i+A*r)*Math.sin(a+E*o),u.y=t*Math.cos(a+E*o),u.z=t*Math.sin(i+A*r)*Math.sin(a+E*o),g.push(u.x,u.y,u.z),d.copy(u).normalize(),_.push(d.x,d.y,d.z),m.push(A+S,1-E),b.push(l++)}h.push(b)}for(let f=0;f<n;f++)for(let b=0;b<e;b++){const E=h[f][b+1],S=h[f][b],R=h[f+1][b],A=h[f+1][b+1];(f!==0||a>0)&&p.push(E,S,A),(f!==n-1||c<Math.PI)&&p.push(S,R,A)}this.setIndex(p),this.setAttribute("position",new ne(g,3)),this.setAttribute("normal",new ne(_,3)),this.setAttribute("uv",new ne(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new wn(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class qs extends xe{constructor(t=new ec(new L(-1,-1,0),new L(-1,1,0),new L(1,1,0)),e=64,n=1,i=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:e,radius:n,radialSegments:i,closed:r};const a=t.computeFrenetFrames(e,r);this.tangents=a.tangents,this.normals=a.normals,this.binormals=a.binormals;const o=new L,c=new L,l=new ut;let h=new L;const u=[],d=[],p=[],g=[];_(),this.setIndex(g),this.setAttribute("position",new ne(u,3)),this.setAttribute("normal",new ne(d,3)),this.setAttribute("uv",new ne(p,2));function _(){for(let E=0;E<e;E++)m(E);m(r===!1?e:0),b(),f()}function m(E){h=t.getPointAt(E/e,h);const S=a.normals[E],R=a.binormals[E];for(let A=0;A<=i;A++){const P=A/i*Math.PI*2,U=Math.sin(P),y=-Math.cos(P);c.x=y*S.x+U*R.x,c.y=y*S.y+U*R.y,c.z=y*S.z+U*R.z,c.normalize(),d.push(c.x,c.y,c.z),o.x=h.x+n*c.x,o.y=h.y+n*c.y,o.z=h.z+n*c.z,u.push(o.x,o.y,o.z)}}function f(){for(let E=1;E<=e;E++)for(let S=1;S<=i;S++){const R=(i+1)*(E-1)+(S-1),A=(i+1)*E+(S-1),P=(i+1)*E+S,U=(i+1)*(E-1)+S;g.push(R,A,U),g.push(A,P,U)}}function b(){for(let E=0;E<=e;E++)for(let S=0;S<=i;S++)l.x=E/e,l.y=S/i,p.push(l.x,l.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new qs(new du[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}}class Vn extends Qn{constructor(t){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Nt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Nt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=kl,this.normalScale=new ut(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new nn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class fu extends Qn{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=ah,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class pu extends Qn{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}class nc extends de{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Nt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}class mu extends nc{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(de.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Nt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const Dr=new Zt,ko=new L,Ho=new L;class gu{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ut(512,512),this.mapType=en,this.map=null,this.mapPass=null,this.matrix=new Zt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Va,this._frameExtents=new ut(1,1),this._viewportCount=1,this._viewports=[new ce(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;ko.setFromMatrixPosition(t.matrixWorld),e.position.copy(ko),Ho.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Ho),e.updateMatrixWorld(),Dr.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Dr,e.coordinateSystem,e.reversedDepth),e.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Dr)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}class ic extends $l{constructor(t=-1,e=1,n=1,i=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=i,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,i,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let r=n-t,a=n+t,o=i+e,c=i-e;if(this.view!==null&&this.view.enabled){const l=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,a=r+l*this.view.width,o-=h*this.view.offsetY,c=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,c,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}class _u extends gu{constructor(){super(new ic(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Vo extends nc{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(de.DEFAULT_UP),this.updateMatrix(),this.target=new de,this.shadow=new _u}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}class vu extends ke{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}}const Go=new Zt;class xu{constructor(t,e,n=0,i=1/0){this.ray=new za(t,e),this.near=n,this.far=i,this.camera=null,this.layers=new ka,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,(e.near+e.far)/(e.near-e.far)).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):console.error("THREE.Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return Go.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Go),this}intersectObject(t,e=!0,n=[]){return Ra(t,this,n,e),n.sort(Wo),n}intersectObjects(t,e=!0,n=[]){for(let i=0,r=t.length;i<r;i++)Ra(t[i],this,n,e);return n.sort(Wo),n}}function Wo(s,t){return s.distance-t.distance}function Ra(s,t,e,n){let i=!0;if(s.layers.test(t.layers)&&s.raycast(t,e)===!1&&(i=!1),i===!0&&n===!0){const r=s.children;for(let a=0,o=r.length;a<o;a++)Ra(r[a],t,e,!0)}}function Xo(s,t,e,n){const i=Mu(n);switch(e){case Ol:return s*t;case Ua:return s*t/i.components*i.byteLength;case Na:return s*t/i.components*i.byteLength;case zl:return s*t*2/i.components*i.byteLength;case Fa:return s*t*2/i.components*i.byteLength;case Bl:return s*t*3/i.components*i.byteLength;case $e:return s*t*4/i.components*i.byteLength;case Oa:return s*t*4/i.components*i.byteLength;case Ls:case Is:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*8;case Us:case Ns:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case jr:case ta:return Math.max(s,16)*Math.max(t,8)/4;case Zr:case Qr:return Math.max(s,8)*Math.max(t,8)/2;case ea:case na:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*8;case ia:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case sa:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case ra:return Math.floor((s+4)/5)*Math.floor((t+3)/4)*16;case aa:return Math.floor((s+4)/5)*Math.floor((t+4)/5)*16;case oa:return Math.floor((s+5)/6)*Math.floor((t+4)/5)*16;case la:return Math.floor((s+5)/6)*Math.floor((t+5)/6)*16;case ca:return Math.floor((s+7)/8)*Math.floor((t+4)/5)*16;case ha:return Math.floor((s+7)/8)*Math.floor((t+5)/6)*16;case ua:return Math.floor((s+7)/8)*Math.floor((t+7)/8)*16;case da:return Math.floor((s+9)/10)*Math.floor((t+4)/5)*16;case fa:return Math.floor((s+9)/10)*Math.floor((t+5)/6)*16;case pa:return Math.floor((s+9)/10)*Math.floor((t+7)/8)*16;case ma:return Math.floor((s+9)/10)*Math.floor((t+9)/10)*16;case ga:return Math.floor((s+11)/12)*Math.floor((t+9)/10)*16;case _a:return Math.floor((s+11)/12)*Math.floor((t+11)/12)*16;case va:case xa:case Ma:return Math.ceil(s/4)*Math.ceil(t/4)*16;case ya:case Sa:return Math.ceil(s/4)*Math.ceil(t/4)*8;case Ea:case ba:return Math.ceil(s/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function Mu(s){switch(s){case en:case Il:return{byteLength:1,components:1};case Ki:case Ul:case ts:return{byteLength:2,components:1};case La:case Ia:return{byteLength:2,components:4};case Jn:case Da:case Qe:return{byteLength:4,components:1};case Nl:case Fl:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${s}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Pa}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Pa);/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function sc(){let s=null,t=!1,e=null,n=null;function i(r,a){e(r,a),n=s.requestAnimationFrame(i)}return{start:function(){t!==!0&&e!==null&&(n=s.requestAnimationFrame(i),t=!0)},stop:function(){s.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){s=r}}}function yu(s){const t=new WeakMap;function e(o,c){const l=o.array,h=o.usage,u=l.byteLength,d=s.createBuffer();s.bindBuffer(c,d),s.bufferData(c,l,h),o.onUploadCallback();let p;if(l instanceof Float32Array)p=s.FLOAT;else if(typeof Float16Array<"u"&&l instanceof Float16Array)p=s.HALF_FLOAT;else if(l instanceof Uint16Array)o.isFloat16BufferAttribute?p=s.HALF_FLOAT:p=s.UNSIGNED_SHORT;else if(l instanceof Int16Array)p=s.SHORT;else if(l instanceof Uint32Array)p=s.UNSIGNED_INT;else if(l instanceof Int32Array)p=s.INT;else if(l instanceof Int8Array)p=s.BYTE;else if(l instanceof Uint8Array)p=s.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)p=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:d,type:p,bytesPerElement:l.BYTES_PER_ELEMENT,version:o.version,size:u}}function n(o,c,l){const h=c.array,u=c.updateRanges;if(s.bindBuffer(l,o),u.length===0)s.bufferSubData(l,0,h);else{u.sort((p,g)=>p.start-g.start);let d=0;for(let p=1;p<u.length;p++){const g=u[d],_=u[p];_.start<=g.start+g.count+1?g.count=Math.max(g.count,_.start+_.count-g.start):(++d,u[d]=_)}u.length=d+1;for(let p=0,g=u.length;p<g;p++){const _=u[p];s.bufferSubData(l,_.start*h.BYTES_PER_ELEMENT,h,_.start,_.count)}c.clearUpdateRanges()}c.onUploadCallback()}function i(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const c=t.get(o);c&&(s.deleteBuffer(c.buffer),t.delete(o))}function a(o,c){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const l=t.get(o);if(l===void 0)t.set(o,e(o,c));else if(l.version<o.version){if(l.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(l.buffer,o,c),l.version=o.version}}return{get:i,remove:r,update:a}}var Su=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Eu=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,bu=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Tu=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Au=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,wu=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Ru=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Cu=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Pu=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Du=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Lu=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Iu=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Uu=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Nu=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Fu=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Ou=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Bu=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,zu=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,ku=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Hu=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Vu=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Gu=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,Wu=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,Xu=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Yu=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,qu=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,$u=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Ku=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Ju=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Zu=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,ju="gl_FragColor = linearToOutputTexel( gl_FragColor );",Qu=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,td=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,ed=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,nd=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,id=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,sd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,rd=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,ad=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,od=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,ld=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,cd=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,hd=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,ud=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,dd=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,fd=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,pd=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,md=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,gd=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,_d=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,vd=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,xd=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Md=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,yd=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Sd=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Ed=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,bd=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Td=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Ad=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,wd=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Rd=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Cd=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Pd=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Dd=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ld=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Id=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Ud=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Nd=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Fd=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Od=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Bd=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,zd=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,kd=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Hd=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Vd=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Gd=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Wd=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Xd=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Yd=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,qd=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,$d=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Kd=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Jd=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Zd=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,jd=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Qd=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,tf=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,ef=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,nf=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,sf=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow( sampler2D shadow, vec2 uv, float compare ) {
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare, distribution.x );
		#endif
		if ( hard_shadow != 1.0 ) {
			float distance = compare - distribution.x;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,rf=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,af=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,of=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,lf=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,cf=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,hf=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,uf=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,df=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,ff=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,pf=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,mf=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,gf=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,_f=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,vf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,xf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Mf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,yf=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Sf=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Ef=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,bf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Tf=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Af=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,wf=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Rf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Cf=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Pf=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Df=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Lf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,If=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Uf=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Nf=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Ff=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Of=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Bf=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,zf=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,kf=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Hf=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Vf=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Gf=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Wf=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Xf=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Yf=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,qf=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,$f=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Kf=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Jf=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Zf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,jf=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Qf=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,tp=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,ep=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ot={alphahash_fragment:Su,alphahash_pars_fragment:Eu,alphamap_fragment:bu,alphamap_pars_fragment:Tu,alphatest_fragment:Au,alphatest_pars_fragment:wu,aomap_fragment:Ru,aomap_pars_fragment:Cu,batching_pars_vertex:Pu,batching_vertex:Du,begin_vertex:Lu,beginnormal_vertex:Iu,bsdfs:Uu,iridescence_fragment:Nu,bumpmap_pars_fragment:Fu,clipping_planes_fragment:Ou,clipping_planes_pars_fragment:Bu,clipping_planes_pars_vertex:zu,clipping_planes_vertex:ku,color_fragment:Hu,color_pars_fragment:Vu,color_pars_vertex:Gu,color_vertex:Wu,common:Xu,cube_uv_reflection_fragment:Yu,defaultnormal_vertex:qu,displacementmap_pars_vertex:$u,displacementmap_vertex:Ku,emissivemap_fragment:Ju,emissivemap_pars_fragment:Zu,colorspace_fragment:ju,colorspace_pars_fragment:Qu,envmap_fragment:td,envmap_common_pars_fragment:ed,envmap_pars_fragment:nd,envmap_pars_vertex:id,envmap_physical_pars_fragment:pd,envmap_vertex:sd,fog_vertex:rd,fog_pars_vertex:ad,fog_fragment:od,fog_pars_fragment:ld,gradientmap_pars_fragment:cd,lightmap_pars_fragment:hd,lights_lambert_fragment:ud,lights_lambert_pars_fragment:dd,lights_pars_begin:fd,lights_toon_fragment:md,lights_toon_pars_fragment:gd,lights_phong_fragment:_d,lights_phong_pars_fragment:vd,lights_physical_fragment:xd,lights_physical_pars_fragment:Md,lights_fragment_begin:yd,lights_fragment_maps:Sd,lights_fragment_end:Ed,logdepthbuf_fragment:bd,logdepthbuf_pars_fragment:Td,logdepthbuf_pars_vertex:Ad,logdepthbuf_vertex:wd,map_fragment:Rd,map_pars_fragment:Cd,map_particle_fragment:Pd,map_particle_pars_fragment:Dd,metalnessmap_fragment:Ld,metalnessmap_pars_fragment:Id,morphinstance_vertex:Ud,morphcolor_vertex:Nd,morphnormal_vertex:Fd,morphtarget_pars_vertex:Od,morphtarget_vertex:Bd,normal_fragment_begin:zd,normal_fragment_maps:kd,normal_pars_fragment:Hd,normal_pars_vertex:Vd,normal_vertex:Gd,normalmap_pars_fragment:Wd,clearcoat_normal_fragment_begin:Xd,clearcoat_normal_fragment_maps:Yd,clearcoat_pars_fragment:qd,iridescence_pars_fragment:$d,opaque_fragment:Kd,packing:Jd,premultiplied_alpha_fragment:Zd,project_vertex:jd,dithering_fragment:Qd,dithering_pars_fragment:tf,roughnessmap_fragment:ef,roughnessmap_pars_fragment:nf,shadowmap_pars_fragment:sf,shadowmap_pars_vertex:rf,shadowmap_vertex:af,shadowmask_pars_fragment:of,skinbase_vertex:lf,skinning_pars_vertex:cf,skinning_vertex:hf,skinnormal_vertex:uf,specularmap_fragment:df,specularmap_pars_fragment:ff,tonemapping_fragment:pf,tonemapping_pars_fragment:mf,transmission_fragment:gf,transmission_pars_fragment:_f,uv_pars_fragment:vf,uv_pars_vertex:xf,uv_vertex:Mf,worldpos_vertex:yf,background_vert:Sf,background_frag:Ef,backgroundCube_vert:bf,backgroundCube_frag:Tf,cube_vert:Af,cube_frag:wf,depth_vert:Rf,depth_frag:Cf,distanceRGBA_vert:Pf,distanceRGBA_frag:Df,equirect_vert:Lf,equirect_frag:If,linedashed_vert:Uf,linedashed_frag:Nf,meshbasic_vert:Ff,meshbasic_frag:Of,meshlambert_vert:Bf,meshlambert_frag:zf,meshmatcap_vert:kf,meshmatcap_frag:Hf,meshnormal_vert:Vf,meshnormal_frag:Gf,meshphong_vert:Wf,meshphong_frag:Xf,meshphysical_vert:Yf,meshphysical_frag:qf,meshtoon_vert:$f,meshtoon_frag:Kf,points_vert:Jf,points_frag:Zf,shadow_vert:jf,shadow_frag:Qf,sprite_vert:tp,sprite_frag:ep},st={common:{diffuse:{value:new Nt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ut},alphaMap:{value:null},alphaMapTransform:{value:new Ut},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ut}},envmap:{envMap:{value:null},envMapRotation:{value:new Ut},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ut}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ut}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ut},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ut},normalScale:{value:new ut(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ut},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ut}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ut}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ut}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Nt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Nt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ut},alphaTest:{value:0},uvTransform:{value:new Ut}},sprite:{diffuse:{value:new Nt(16777215)},opacity:{value:1},center:{value:new ut(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ut},alphaMap:{value:null},alphaMapTransform:{value:new Ut},alphaTest:{value:0}}},Ze={basic:{uniforms:Ae([st.common,st.specularmap,st.envmap,st.aomap,st.lightmap,st.fog]),vertexShader:Ot.meshbasic_vert,fragmentShader:Ot.meshbasic_frag},lambert:{uniforms:Ae([st.common,st.specularmap,st.envmap,st.aomap,st.lightmap,st.emissivemap,st.bumpmap,st.normalmap,st.displacementmap,st.fog,st.lights,{emissive:{value:new Nt(0)}}]),vertexShader:Ot.meshlambert_vert,fragmentShader:Ot.meshlambert_frag},phong:{uniforms:Ae([st.common,st.specularmap,st.envmap,st.aomap,st.lightmap,st.emissivemap,st.bumpmap,st.normalmap,st.displacementmap,st.fog,st.lights,{emissive:{value:new Nt(0)},specular:{value:new Nt(1118481)},shininess:{value:30}}]),vertexShader:Ot.meshphong_vert,fragmentShader:Ot.meshphong_frag},standard:{uniforms:Ae([st.common,st.envmap,st.aomap,st.lightmap,st.emissivemap,st.bumpmap,st.normalmap,st.displacementmap,st.roughnessmap,st.metalnessmap,st.fog,st.lights,{emissive:{value:new Nt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ot.meshphysical_vert,fragmentShader:Ot.meshphysical_frag},toon:{uniforms:Ae([st.common,st.aomap,st.lightmap,st.emissivemap,st.bumpmap,st.normalmap,st.displacementmap,st.gradientmap,st.fog,st.lights,{emissive:{value:new Nt(0)}}]),vertexShader:Ot.meshtoon_vert,fragmentShader:Ot.meshtoon_frag},matcap:{uniforms:Ae([st.common,st.bumpmap,st.normalmap,st.displacementmap,st.fog,{matcap:{value:null}}]),vertexShader:Ot.meshmatcap_vert,fragmentShader:Ot.meshmatcap_frag},points:{uniforms:Ae([st.points,st.fog]),vertexShader:Ot.points_vert,fragmentShader:Ot.points_frag},dashed:{uniforms:Ae([st.common,st.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ot.linedashed_vert,fragmentShader:Ot.linedashed_frag},depth:{uniforms:Ae([st.common,st.displacementmap]),vertexShader:Ot.depth_vert,fragmentShader:Ot.depth_frag},normal:{uniforms:Ae([st.common,st.bumpmap,st.normalmap,st.displacementmap,{opacity:{value:1}}]),vertexShader:Ot.meshnormal_vert,fragmentShader:Ot.meshnormal_frag},sprite:{uniforms:Ae([st.sprite,st.fog]),vertexShader:Ot.sprite_vert,fragmentShader:Ot.sprite_frag},background:{uniforms:{uvTransform:{value:new Ut},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ot.background_vert,fragmentShader:Ot.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ut}},vertexShader:Ot.backgroundCube_vert,fragmentShader:Ot.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ot.cube_vert,fragmentShader:Ot.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ot.equirect_vert,fragmentShader:Ot.equirect_frag},distanceRGBA:{uniforms:Ae([st.common,st.displacementmap,{referencePosition:{value:new L},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ot.distanceRGBA_vert,fragmentShader:Ot.distanceRGBA_frag},shadow:{uniforms:Ae([st.lights,st.fog,{color:{value:new Nt(0)},opacity:{value:1}}]),vertexShader:Ot.shadow_vert,fragmentShader:Ot.shadow_frag}};Ze.physical={uniforms:Ae([Ze.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ut},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ut},clearcoatNormalScale:{value:new ut(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ut},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ut},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ut},sheen:{value:0},sheenColor:{value:new Nt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ut},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ut},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ut},transmissionSamplerSize:{value:new ut},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ut},attenuationDistance:{value:0},attenuationColor:{value:new Nt(0)},specularColor:{value:new Nt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ut},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ut},anisotropyVector:{value:new ut},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ut}}]),vertexShader:Ot.meshphysical_vert,fragmentShader:Ot.meshphysical_frag};const Rs={r:0,b:0,g:0},kn=new nn,np=new Zt;function ip(s,t,e,n,i,r,a){const o=new Nt(0);let c=r===!0?0:1,l,h,u=null,d=0,p=null;function g(E){let S=E.isScene===!0?E.background:null;return S&&S.isTexture&&(S=(E.backgroundBlurriness>0?e:t).get(S)),S}function _(E){let S=!1;const R=g(E);R===null?f(o,c):R&&R.isColor&&(f(R,1),S=!0);const A=s.xr.getEnvironmentBlendMode();A==="additive"?n.buffers.color.setClear(0,0,0,1,a):A==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(s.autoClear||S)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil))}function m(E,S){const R=g(S);R&&(R.isCubeTexture||R.mapping===Ys)?(h===void 0&&(h=new Xt(new Ln(1,1,1),new fn({name:"BackgroundCubeMaterial",uniforms:Ci(Ze.backgroundCube.uniforms),vertexShader:Ze.backgroundCube.vertexShader,fragmentShader:Ze.backgroundCube.fragmentShader,side:we,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(A,P,U){this.matrixWorld.copyPosition(U.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(h)),kn.copy(S.backgroundRotation),kn.x*=-1,kn.y*=-1,kn.z*=-1,R.isCubeTexture&&R.isRenderTargetTexture===!1&&(kn.y*=-1,kn.z*=-1),h.material.uniforms.envMap.value=R,h.material.uniforms.flipEnvMap.value=R.isCubeTexture&&R.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=S.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(np.makeRotationFromEuler(kn)),h.material.toneMapped=Wt.getTransfer(R.colorSpace)!==Kt,(u!==R||d!==R.version||p!==s.toneMapping)&&(h.material.needsUpdate=!0,u=R,d=R.version,p=s.toneMapping),h.layers.enableAll(),E.unshift(h,h.geometry,h.material,0,0,null)):R&&R.isTexture&&(l===void 0&&(l=new Xt(new Ye(2,2),new fn({name:"BackgroundMaterial",uniforms:Ci(Ze.background.uniforms),vertexShader:Ze.background.vertexShader,fragmentShader:Ze.background.fragmentShader,side:Dn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=R,l.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,l.material.toneMapped=Wt.getTransfer(R.colorSpace)!==Kt,R.matrixAutoUpdate===!0&&R.updateMatrix(),l.material.uniforms.uvTransform.value.copy(R.matrix),(u!==R||d!==R.version||p!==s.toneMapping)&&(l.material.needsUpdate=!0,u=R,d=R.version,p=s.toneMapping),l.layers.enableAll(),E.unshift(l,l.geometry,l.material,0,0,null))}function f(E,S){E.getRGB(Rs,ql(s)),n.buffers.color.setClear(Rs.r,Rs.g,Rs.b,S,a)}function b(){h!==void 0&&(h.geometry.dispose(),h.material.dispose(),h=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(E,S=1){o.set(E),c=S,f(o,c)},getClearAlpha:function(){return c},setClearAlpha:function(E){c=E,f(o,c)},render:_,addToRenderList:m,dispose:b}}function sp(s,t){const e=s.getParameter(s.MAX_VERTEX_ATTRIBS),n={},i=d(null);let r=i,a=!1;function o(M,D,w,O,H){let G=!1;const W=u(O,w,D);r!==W&&(r=W,l(r.object)),G=p(M,O,w,H),G&&g(M,O,w,H),H!==null&&t.update(H,s.ELEMENT_ARRAY_BUFFER),(G||a)&&(a=!1,S(M,D,w,O),H!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,t.get(H).buffer))}function c(){return s.createVertexArray()}function l(M){return s.bindVertexArray(M)}function h(M){return s.deleteVertexArray(M)}function u(M,D,w){const O=w.wireframe===!0;let H=n[M.id];H===void 0&&(H={},n[M.id]=H);let G=H[D.id];G===void 0&&(G={},H[D.id]=G);let W=G[O];return W===void 0&&(W=d(c()),G[O]=W),W}function d(M){const D=[],w=[],O=[];for(let H=0;H<e;H++)D[H]=0,w[H]=0,O[H]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:D,enabledAttributes:w,attributeDivisors:O,object:M,attributes:{},index:null}}function p(M,D,w,O){const H=r.attributes,G=D.attributes;let W=0;const et=w.getAttributes();for(const V in et)if(et[V].location>=0){const ct=H[V];let Et=G[V];if(Et===void 0&&(V==="instanceMatrix"&&M.instanceMatrix&&(Et=M.instanceMatrix),V==="instanceColor"&&M.instanceColor&&(Et=M.instanceColor)),ct===void 0||ct.attribute!==Et||Et&&ct.data!==Et.data)return!0;W++}return r.attributesNum!==W||r.index!==O}function g(M,D,w,O){const H={},G=D.attributes;let W=0;const et=w.getAttributes();for(const V in et)if(et[V].location>=0){let ct=G[V];ct===void 0&&(V==="instanceMatrix"&&M.instanceMatrix&&(ct=M.instanceMatrix),V==="instanceColor"&&M.instanceColor&&(ct=M.instanceColor));const Et={};Et.attribute=ct,ct&&ct.data&&(Et.data=ct.data),H[V]=Et,W++}r.attributes=H,r.attributesNum=W,r.index=O}function _(){const M=r.newAttributes;for(let D=0,w=M.length;D<w;D++)M[D]=0}function m(M){f(M,0)}function f(M,D){const w=r.newAttributes,O=r.enabledAttributes,H=r.attributeDivisors;w[M]=1,O[M]===0&&(s.enableVertexAttribArray(M),O[M]=1),H[M]!==D&&(s.vertexAttribDivisor(M,D),H[M]=D)}function b(){const M=r.newAttributes,D=r.enabledAttributes;for(let w=0,O=D.length;w<O;w++)D[w]!==M[w]&&(s.disableVertexAttribArray(w),D[w]=0)}function E(M,D,w,O,H,G,W){W===!0?s.vertexAttribIPointer(M,D,w,H,G):s.vertexAttribPointer(M,D,w,O,H,G)}function S(M,D,w,O){_();const H=O.attributes,G=w.getAttributes(),W=D.defaultAttributeValues;for(const et in G){const V=G[et];if(V.location>=0){let rt=H[et];if(rt===void 0&&(et==="instanceMatrix"&&M.instanceMatrix&&(rt=M.instanceMatrix),et==="instanceColor"&&M.instanceColor&&(rt=M.instanceColor)),rt!==void 0){const ct=rt.normalized,Et=rt.itemSize,Bt=t.get(rt);if(Bt===void 0)continue;const Qt=Bt.buffer,ie=Bt.type,Yt=Bt.bytesPerElement,q=ie===s.INT||ie===s.UNSIGNED_INT||rt.gpuType===Da;if(rt.isInterleavedBufferAttribute){const J=rt.data,ft=J.stride,Pt=rt.offset;if(J.isInstancedInterleavedBuffer){for(let St=0;St<V.locationSize;St++)f(V.location+St,J.meshPerAttribute);M.isInstancedMesh!==!0&&O._maxInstanceCount===void 0&&(O._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let St=0;St<V.locationSize;St++)m(V.location+St);s.bindBuffer(s.ARRAY_BUFFER,Qt);for(let St=0;St<V.locationSize;St++)E(V.location+St,Et/V.locationSize,ie,ct,ft*Yt,(Pt+Et/V.locationSize*St)*Yt,q)}else{if(rt.isInstancedBufferAttribute){for(let J=0;J<V.locationSize;J++)f(V.location+J,rt.meshPerAttribute);M.isInstancedMesh!==!0&&O._maxInstanceCount===void 0&&(O._maxInstanceCount=rt.meshPerAttribute*rt.count)}else for(let J=0;J<V.locationSize;J++)m(V.location+J);s.bindBuffer(s.ARRAY_BUFFER,Qt);for(let J=0;J<V.locationSize;J++)E(V.location+J,Et/V.locationSize,ie,ct,Et*Yt,Et/V.locationSize*J*Yt,q)}}else if(W!==void 0){const ct=W[et];if(ct!==void 0)switch(ct.length){case 2:s.vertexAttrib2fv(V.location,ct);break;case 3:s.vertexAttrib3fv(V.location,ct);break;case 4:s.vertexAttrib4fv(V.location,ct);break;default:s.vertexAttrib1fv(V.location,ct)}}}}b()}function R(){U();for(const M in n){const D=n[M];for(const w in D){const O=D[w];for(const H in O)h(O[H].object),delete O[H];delete D[w]}delete n[M]}}function A(M){if(n[M.id]===void 0)return;const D=n[M.id];for(const w in D){const O=D[w];for(const H in O)h(O[H].object),delete O[H];delete D[w]}delete n[M.id]}function P(M){for(const D in n){const w=n[D];if(w[M.id]===void 0)continue;const O=w[M.id];for(const H in O)h(O[H].object),delete O[H];delete w[M.id]}}function U(){y(),a=!0,r!==i&&(r=i,l(r.object))}function y(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:o,reset:U,resetDefaultState:y,dispose:R,releaseStatesOfGeometry:A,releaseStatesOfProgram:P,initAttributes:_,enableAttribute:m,disableUnusedAttributes:b}}function rp(s,t,e){let n;function i(l){n=l}function r(l,h){s.drawArrays(n,l,h),e.update(h,n,1)}function a(l,h,u){u!==0&&(s.drawArraysInstanced(n,l,h,u),e.update(h,n,u))}function o(l,h,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,h,0,u);let p=0;for(let g=0;g<u;g++)p+=h[g];e.update(p,n,1)}function c(l,h,u,d){if(u===0)return;const p=t.get("WEBGL_multi_draw");if(p===null)for(let g=0;g<l.length;g++)a(l[g],h[g],d[g]);else{p.multiDrawArraysInstancedWEBGL(n,l,0,h,0,d,0,u);let g=0;for(let _=0;_<u;_++)g+=h[_]*d[_];e.update(g,n,1)}}this.setMode=i,this.render=r,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=c}function ap(s,t,e,n){let i;function r(){if(i!==void 0)return i;if(t.has("EXT_texture_filter_anisotropic")===!0){const P=t.get("EXT_texture_filter_anisotropic");i=s.getParameter(P.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function a(P){return!(P!==$e&&n.convert(P)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(P){const U=P===ts&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(P!==en&&n.convert(P)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_TYPE)&&P!==Qe&&!U)}function c(P){if(P==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";P="mediump"}return P==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=e.precision!==void 0?e.precision:"highp";const h=c(l);h!==l&&(console.warn("THREE.WebGLRenderer:",l,"not supported, using",h,"instead."),l=h);const u=e.logarithmicDepthBuffer===!0,d=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control"),p=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),g=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=s.getParameter(s.MAX_TEXTURE_SIZE),m=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),f=s.getParameter(s.MAX_VERTEX_ATTRIBS),b=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),E=s.getParameter(s.MAX_VARYING_VECTORS),S=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),R=g>0,A=s.getParameter(s.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:c,textureFormatReadable:a,textureTypeReadable:o,precision:l,logarithmicDepthBuffer:u,reversedDepthBuffer:d,maxTextures:p,maxVertexTextures:g,maxTextureSize:_,maxCubemapSize:m,maxAttributes:f,maxVertexUniforms:b,maxVaryings:E,maxFragmentUniforms:S,vertexTextures:R,maxSamples:A}}function op(s){const t=this;let e=null,n=0,i=!1,r=!1;const a=new Tn,o=new Ut,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const p=u.length!==0||d||n!==0||i;return i=d,n=u.length,p},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,p){const g=u.clippingPlanes,_=u.clipIntersection,m=u.clipShadows,f=s.get(u);if(!i||g===null||g.length===0||r&&!m)r?h(null):l();else{const b=r?0:n,E=b*4;let S=f.clippingState||null;c.value=S,S=h(g,d,E,p);for(let R=0;R!==E;++R)S[R]=e[R];f.clippingState=S,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=b}};function l(){c.value!==e&&(c.value=e,c.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,d,p,g){const _=u!==null?u.length:0;let m=null;if(_!==0){if(m=c.value,g!==!0||m===null){const f=p+_*4,b=d.matrixWorldInverse;o.getNormalMatrix(b),(m===null||m.length<f)&&(m=new Float32Array(f));for(let E=0,S=p;E!==_;++E,S+=4)a.copy(u[E]).applyMatrix4(b,o),a.normal.toArray(m,S),m[S+3]=a.constant}c.value=m,c.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,m}}function lp(s){let t=new WeakMap;function e(a,o){return o===$r?a.mapping=Ai:o===Kr&&(a.mapping=wi),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===$r||o===Kr)if(t.has(a)){const c=t.get(a).texture;return e(c,a.mapping)}else{const c=a.image;if(c&&c.height>0){const l=new Vh(c.height);return l.fromEquirectangularTexture(s,a),t.set(a,l),a.addEventListener("dispose",i),e(l.texture,a.mapping)}else return null}}return a}function i(a){const o=a.target;o.removeEventListener("dispose",i);const c=t.get(o);c!==void 0&&(t.delete(o),c.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}const Si=4,Yo=[.125,.215,.35,.446,.526,.582],Yn=20,Lr=new ic,qo=new Nt;let Ir=null,Ur=0,Nr=0,Fr=!1;const Gn=(1+Math.sqrt(5))/2,Mi=1/Gn,$o=[new L(-Gn,Mi,0),new L(Gn,Mi,0),new L(-Mi,0,Gn),new L(Mi,0,Gn),new L(0,Gn,-Mi),new L(0,Gn,Mi),new L(-1,1,-1),new L(1,1,-1),new L(-1,1,1),new L(1,1,1)],cp=new L;class Ko{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,i=100,r={}){const{size:a=256,position:o=cp}=r;Ir=this._renderer.getRenderTarget(),Ur=this._renderer.getActiveCubeFace(),Nr=this._renderer.getActiveMipmapLevel(),Fr=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const c=this._allocateTargets();return c.depthBuffer=!0,this._sceneToCubeUV(t,n,i,c,o),e>0&&this._blur(c,0,0,e),this._applyPMREM(c),this._cleanup(c),c}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=jo(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Zo(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(Ir,Ur,Nr),this._renderer.xr.enabled=Fr,t.scissorTest=!1,Cs(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Ai||t.mapping===wi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Ir=this._renderer.getRenderTarget(),Ur=this._renderer.getActiveCubeFace(),Nr=this._renderer.getActiveMipmapLevel(),Fr=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:qe,minFilter:qe,generateMipmaps:!1,type:ts,format:$e,colorSpace:Ri,depthBuffer:!1},i=Jo(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Jo(t,e,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=hp(r)),this._blurMaterial=up(r,t,e)}return i}_compileMaterial(t){const e=new Xt(this._lodPlanes[0],t);this._renderer.compile(e,Lr)}_sceneToCubeUV(t,e,n,i,r){const c=new ke(90,1,e,n),l=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],u=this._renderer,d=u.autoClear,p=u.toneMapping;u.getClearColor(qo),u.toneMapping=Cn,u.autoClear=!1,u.state.buffers.depth.getReversed()&&(u.setRenderTarget(i),u.clearDepth(),u.setRenderTarget(null));const _=new bn({name:"PMREM.Background",side:we,depthWrite:!1,depthTest:!1}),m=new Xt(new Ln,_);let f=!1;const b=t.background;b?b.isColor&&(_.color.copy(b),t.background=null,f=!0):(_.color.copy(qo),f=!0);for(let E=0;E<6;E++){const S=E%3;S===0?(c.up.set(0,l[E],0),c.position.set(r.x,r.y,r.z),c.lookAt(r.x+h[E],r.y,r.z)):S===1?(c.up.set(0,0,l[E]),c.position.set(r.x,r.y,r.z),c.lookAt(r.x,r.y+h[E],r.z)):(c.up.set(0,l[E],0),c.position.set(r.x,r.y,r.z),c.lookAt(r.x,r.y,r.z+h[E]));const R=this._cubeSize;Cs(i,S*R,E>2?R:0,R,R),u.setRenderTarget(i),f&&u.render(m,c),u.render(t,c)}m.geometry.dispose(),m.material.dispose(),u.toneMapping=p,u.autoClear=d,t.background=b}_textureToCubeUV(t,e){const n=this._renderer,i=t.mapping===Ai||t.mapping===wi;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=jo()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Zo());const r=i?this._cubemapMaterial:this._equirectMaterial,a=new Xt(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;const c=this._cubeSize;Cs(e,0,0,3*c,2*c),n.setRenderTarget(e),n.render(a,Lr)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;const i=this._lodPlanes.length;for(let r=1;r<i;r++){const a=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),o=$o[(i-r-1)%$o.length];this._blur(t,r-1,r,a,o)}e.autoClear=n}_blur(t,e,n,i,r){const a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,i,"latitudinal",r),this._halfBlur(a,t,n,n,i,"longitudinal",r)}_halfBlur(t,e,n,i,r,a,o){const c=this._renderer,l=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new Xt(this._lodPlanes[i],l),d=l.uniforms,p=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*Yn-1),_=r/g,m=isFinite(r)?1+Math.floor(h*_):Yn;m>Yn&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Yn}`);const f=[];let b=0;for(let P=0;P<Yn;++P){const U=P/_,y=Math.exp(-U*U/2);f.push(y),P===0?b+=y:P<m&&(b+=2*y)}for(let P=0;P<f.length;P++)f[P]=f[P]/b;d.envMap.value=t.texture,d.samples.value=m,d.weights.value=f,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:E}=this;d.dTheta.value=g,d.mipInt.value=E-n;const S=this._sizeLods[i],R=3*S*(i>E-Si?i-E+Si:0),A=4*(this._cubeSize-S);Cs(e,R,A,3*S,2*S),c.setRenderTarget(e),c.render(u,Lr)}}function hp(s){const t=[],e=[],n=[];let i=s;const r=s-Si+1+Yo.length;for(let a=0;a<r;a++){const o=Math.pow(2,i);e.push(o);let c=1/o;a>s-Si?c=Yo[a-s+Si-1]:a===0&&(c=0),n.push(c);const l=1/(o-2),h=-l,u=1+l,d=[h,h,u,h,u,u,h,h,u,u,h,u],p=6,g=6,_=3,m=2,f=1,b=new Float32Array(_*g*p),E=new Float32Array(m*g*p),S=new Float32Array(f*g*p);for(let A=0;A<p;A++){const P=A%3*2/3-1,U=A>2?0:-1,y=[P,U,0,P+2/3,U,0,P+2/3,U+1,0,P,U,0,P+2/3,U+1,0,P,U+1,0];b.set(y,_*g*A),E.set(d,m*g*A);const M=[A,A,A,A,A,A];S.set(M,f*g*A)}const R=new xe;R.setAttribute("position",new Ne(b,_)),R.setAttribute("uv",new Ne(E,m)),R.setAttribute("faceIndex",new Ne(S,f)),t.push(R),i>Si&&i--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function Jo(s,t,e){const n=new Zn(s,t,e);return n.texture.mapping=Ys,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Cs(s,t,e,n,i){s.viewport.set(t,e,n,i),s.scissor.set(t,e,n,i)}function up(s,t,e){const n=new Float32Array(Yn),i=new L(0,1,0);return new fn({name:"SphericalGaussianBlur",defines:{n:Yn,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:qa(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Rn,depthTest:!1,depthWrite:!1})}function Zo(){return new fn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:qa(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Rn,depthTest:!1,depthWrite:!1})}function jo(){return new fn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:qa(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Rn,depthTest:!1,depthWrite:!1})}function qa(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function dp(s){let t=new WeakMap,e=null;function n(o){if(o&&o.isTexture){const c=o.mapping,l=c===$r||c===Kr,h=c===Ai||c===wi;if(l||h){let u=t.get(o);const d=u!==void 0?u.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==d)return e===null&&(e=new Ko(s)),u=l?e.fromEquirectangular(o,u):e.fromCubemap(o,u),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),u.texture;if(u!==void 0)return u.texture;{const p=o.image;return l&&p&&p.height>0||h&&p&&i(p)?(e===null&&(e=new Ko(s)),u=l?e.fromEquirectangular(o):e.fromCubemap(o),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),o.addEventListener("dispose",r),u.texture):null}}}return o}function i(o){let c=0;const l=6;for(let h=0;h<l;h++)o[h]!==void 0&&c++;return c===l}function r(o){const c=o.target;c.removeEventListener("dispose",r);const l=t.get(c);l!==void 0&&(t.delete(c),l.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:a}}function fp(s){const t={};function e(n){if(t[n]!==void 0)return t[n];let i;switch(n){case"WEBGL_depth_texture":i=s.getExtension("WEBGL_depth_texture")||s.getExtension("MOZ_WEBGL_depth_texture")||s.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=s.getExtension("EXT_texture_filter_anisotropic")||s.getExtension("MOZ_EXT_texture_filter_anisotropic")||s.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=s.getExtension("WEBGL_compressed_texture_s3tc")||s.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=s.getExtension("WEBGL_compressed_texture_pvrtc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=s.getExtension(n)}return t[n]=i,i}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){const i=e(n);return i===null&&Qi("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function pp(s,t,e,n){const i={},r=new WeakMap;function a(u){const d=u.target;d.index!==null&&t.remove(d.index);for(const g in d.attributes)t.remove(d.attributes[g]);d.removeEventListener("dispose",a),delete i[d.id];const p=r.get(d);p&&(t.remove(p),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function o(u,d){return i[d.id]===!0||(d.addEventListener("dispose",a),i[d.id]=!0,e.memory.geometries++),d}function c(u){const d=u.attributes;for(const p in d)t.update(d[p],s.ARRAY_BUFFER)}function l(u){const d=[],p=u.index,g=u.attributes.position;let _=0;if(p!==null){const b=p.array;_=p.version;for(let E=0,S=b.length;E<S;E+=3){const R=b[E+0],A=b[E+1],P=b[E+2];d.push(R,A,A,P,P,R)}}else if(g!==void 0){const b=g.array;_=g.version;for(let E=0,S=b.length/3-1;E<S;E+=3){const R=E+0,A=E+1,P=E+2;d.push(R,A,A,P,P,R)}}else return;const m=new(Vl(d)?Yl:Xl)(d,1);m.version=_;const f=r.get(u);f&&t.remove(f),r.set(u,m)}function h(u){const d=r.get(u);if(d){const p=u.index;p!==null&&d.version<p.version&&l(u)}else l(u);return r.get(u)}return{get:o,update:c,getWireframeAttribute:h}}function mp(s,t,e){let n;function i(d){n=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function c(d,p){s.drawElements(n,p,r,d*a),e.update(p,n,1)}function l(d,p,g){g!==0&&(s.drawElementsInstanced(n,p,r,d*a,g),e.update(p,n,g))}function h(d,p,g){if(g===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,p,0,r,d,0,g);let m=0;for(let f=0;f<g;f++)m+=p[f];e.update(m,n,1)}function u(d,p,g,_){if(g===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let f=0;f<d.length;f++)l(d[f]/a,p[f],_[f]);else{m.multiDrawElementsInstancedWEBGL(n,p,0,r,d,0,_,0,g);let f=0;for(let b=0;b<g;b++)f+=p[b]*_[b];e.update(f,n,1)}}this.setMode=i,this.setIndex=o,this.render=c,this.renderInstances=l,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function gp(s){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case s.TRIANGLES:e.triangles+=o*(r/3);break;case s.LINES:e.lines+=o*(r/2);break;case s.LINE_STRIP:e.lines+=o*(r-1);break;case s.LINE_LOOP:e.lines+=o*r;break;case s.POINTS:e.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function i(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:i,update:n}}function _p(s,t,e){const n=new WeakMap,i=new ce;function r(a,o,c){const l=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0;let d=n.get(o);if(d===void 0||d.count!==u){let y=function(){P.dispose(),n.delete(o),o.removeEventListener("dispose",y)};d!==void 0&&d.texture.dispose();const p=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,_=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],f=o.morphAttributes.normal||[],b=o.morphAttributes.color||[];let E=0;p===!0&&(E=1),g===!0&&(E=2),_===!0&&(E=3);let S=o.attributes.position.count*E,R=1;S>t.maxTextureSize&&(R=Math.ceil(S/t.maxTextureSize),S=t.maxTextureSize);const A=new Float32Array(S*R*4*u),P=new Gl(A,S,R,u);P.type=Qe,P.needsUpdate=!0;const U=E*4;for(let M=0;M<u;M++){const D=m[M],w=f[M],O=b[M],H=S*R*4*M;for(let G=0;G<D.count;G++){const W=G*U;p===!0&&(i.fromBufferAttribute(D,G),A[H+W+0]=i.x,A[H+W+1]=i.y,A[H+W+2]=i.z,A[H+W+3]=0),g===!0&&(i.fromBufferAttribute(w,G),A[H+W+4]=i.x,A[H+W+5]=i.y,A[H+W+6]=i.z,A[H+W+7]=0),_===!0&&(i.fromBufferAttribute(O,G),A[H+W+8]=i.x,A[H+W+9]=i.y,A[H+W+10]=i.z,A[H+W+11]=O.itemSize===4?i.w:1)}}d={count:u,texture:P,size:new ut(S,R)},n.set(o,d),o.addEventListener("dispose",y)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)c.getUniforms().setValue(s,"morphTexture",a.morphTexture,e);else{let p=0;for(let _=0;_<l.length;_++)p+=l[_];const g=o.morphTargetsRelative?1:1-p;c.getUniforms().setValue(s,"morphTargetBaseInfluence",g),c.getUniforms().setValue(s,"morphTargetInfluences",l)}c.getUniforms().setValue(s,"morphTargetsTexture",d.texture,e),c.getUniforms().setValue(s,"morphTargetsTextureSize",d.size)}return{update:r}}function vp(s,t,e,n){let i=new WeakMap;function r(c){const l=n.render.frame,h=c.geometry,u=t.get(c,h);if(i.get(u)!==l&&(t.update(u),i.set(u,l)),c.isInstancedMesh&&(c.hasEventListener("dispose",o)===!1&&c.addEventListener("dispose",o),i.get(c)!==l&&(e.update(c.instanceMatrix,s.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,s.ARRAY_BUFFER),i.set(c,l))),c.isSkinnedMesh){const d=c.skeleton;i.get(d)!==l&&(d.update(),i.set(d,l))}return u}function a(){i=new WeakMap}function o(c){const l=c.target;l.removeEventListener("dispose",o),e.remove(l.instanceMatrix),l.instanceColor!==null&&e.remove(l.instanceColor)}return{update:r,dispose:a}}const rc=new ve,Qo=new jl(1,1),ac=new Gl,oc=new Th,lc=new Kl,tl=[],el=[],nl=new Float32Array(16),il=new Float32Array(9),sl=new Float32Array(4);function Ii(s,t,e){const n=s[0];if(n<=0||n>0)return s;const i=t*e;let r=tl[i];if(r===void 0&&(r=new Float32Array(i),tl[i]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,s[a].toArray(r,o)}return r}function fe(s,t){if(s.length!==t.length)return!1;for(let e=0,n=s.length;e<n;e++)if(s[e]!==t[e])return!1;return!0}function pe(s,t){for(let e=0,n=t.length;e<n;e++)s[e]=t[e]}function $s(s,t){let e=el[t];e===void 0&&(e=new Int32Array(t),el[t]=e);for(let n=0;n!==t;++n)e[n]=s.allocateTextureUnit();return e}function xp(s,t){const e=this.cache;e[0]!==t&&(s.uniform1f(this.addr,t),e[0]=t)}function Mp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(fe(e,t))return;s.uniform2fv(this.addr,t),pe(e,t)}}function yp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(s.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(fe(e,t))return;s.uniform3fv(this.addr,t),pe(e,t)}}function Sp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(fe(e,t))return;s.uniform4fv(this.addr,t),pe(e,t)}}function Ep(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(fe(e,t))return;s.uniformMatrix2fv(this.addr,!1,t),pe(e,t)}else{if(fe(e,n))return;sl.set(n),s.uniformMatrix2fv(this.addr,!1,sl),pe(e,n)}}function bp(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(fe(e,t))return;s.uniformMatrix3fv(this.addr,!1,t),pe(e,t)}else{if(fe(e,n))return;il.set(n),s.uniformMatrix3fv(this.addr,!1,il),pe(e,n)}}function Tp(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(fe(e,t))return;s.uniformMatrix4fv(this.addr,!1,t),pe(e,t)}else{if(fe(e,n))return;nl.set(n),s.uniformMatrix4fv(this.addr,!1,nl),pe(e,n)}}function Ap(s,t){const e=this.cache;e[0]!==t&&(s.uniform1i(this.addr,t),e[0]=t)}function wp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(fe(e,t))return;s.uniform2iv(this.addr,t),pe(e,t)}}function Rp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(fe(e,t))return;s.uniform3iv(this.addr,t),pe(e,t)}}function Cp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(fe(e,t))return;s.uniform4iv(this.addr,t),pe(e,t)}}function Pp(s,t){const e=this.cache;e[0]!==t&&(s.uniform1ui(this.addr,t),e[0]=t)}function Dp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(fe(e,t))return;s.uniform2uiv(this.addr,t),pe(e,t)}}function Lp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(fe(e,t))return;s.uniform3uiv(this.addr,t),pe(e,t)}}function Ip(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(fe(e,t))return;s.uniform4uiv(this.addr,t),pe(e,t)}}function Up(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i);let r;this.type===s.SAMPLER_2D_SHADOW?(Qo.compareFunction=Hl,r=Qo):r=rc,e.setTexture2D(t||r,i)}function Np(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTexture3D(t||oc,i)}function Fp(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTextureCube(t||lc,i)}function Op(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTexture2DArray(t||ac,i)}function Bp(s){switch(s){case 5126:return xp;case 35664:return Mp;case 35665:return yp;case 35666:return Sp;case 35674:return Ep;case 35675:return bp;case 35676:return Tp;case 5124:case 35670:return Ap;case 35667:case 35671:return wp;case 35668:case 35672:return Rp;case 35669:case 35673:return Cp;case 5125:return Pp;case 36294:return Dp;case 36295:return Lp;case 36296:return Ip;case 35678:case 36198:case 36298:case 36306:case 35682:return Up;case 35679:case 36299:case 36307:return Np;case 35680:case 36300:case 36308:case 36293:return Fp;case 36289:case 36303:case 36311:case 36292:return Op}}function zp(s,t){s.uniform1fv(this.addr,t)}function kp(s,t){const e=Ii(t,this.size,2);s.uniform2fv(this.addr,e)}function Hp(s,t){const e=Ii(t,this.size,3);s.uniform3fv(this.addr,e)}function Vp(s,t){const e=Ii(t,this.size,4);s.uniform4fv(this.addr,e)}function Gp(s,t){const e=Ii(t,this.size,4);s.uniformMatrix2fv(this.addr,!1,e)}function Wp(s,t){const e=Ii(t,this.size,9);s.uniformMatrix3fv(this.addr,!1,e)}function Xp(s,t){const e=Ii(t,this.size,16);s.uniformMatrix4fv(this.addr,!1,e)}function Yp(s,t){s.uniform1iv(this.addr,t)}function qp(s,t){s.uniform2iv(this.addr,t)}function $p(s,t){s.uniform3iv(this.addr,t)}function Kp(s,t){s.uniform4iv(this.addr,t)}function Jp(s,t){s.uniform1uiv(this.addr,t)}function Zp(s,t){s.uniform2uiv(this.addr,t)}function jp(s,t){s.uniform3uiv(this.addr,t)}function Qp(s,t){s.uniform4uiv(this.addr,t)}function tm(s,t,e){const n=this.cache,i=t.length,r=$s(e,i);fe(n,r)||(s.uniform1iv(this.addr,r),pe(n,r));for(let a=0;a!==i;++a)e.setTexture2D(t[a]||rc,r[a])}function em(s,t,e){const n=this.cache,i=t.length,r=$s(e,i);fe(n,r)||(s.uniform1iv(this.addr,r),pe(n,r));for(let a=0;a!==i;++a)e.setTexture3D(t[a]||oc,r[a])}function nm(s,t,e){const n=this.cache,i=t.length,r=$s(e,i);fe(n,r)||(s.uniform1iv(this.addr,r),pe(n,r));for(let a=0;a!==i;++a)e.setTextureCube(t[a]||lc,r[a])}function im(s,t,e){const n=this.cache,i=t.length,r=$s(e,i);fe(n,r)||(s.uniform1iv(this.addr,r),pe(n,r));for(let a=0;a!==i;++a)e.setTexture2DArray(t[a]||ac,r[a])}function sm(s){switch(s){case 5126:return zp;case 35664:return kp;case 35665:return Hp;case 35666:return Vp;case 35674:return Gp;case 35675:return Wp;case 35676:return Xp;case 5124:case 35670:return Yp;case 35667:case 35671:return qp;case 35668:case 35672:return $p;case 35669:case 35673:return Kp;case 5125:return Jp;case 36294:return Zp;case 36295:return jp;case 36296:return Qp;case 35678:case 36198:case 36298:case 36306:case 35682:return tm;case 35679:case 36299:case 36307:return em;case 35680:case 36300:case 36308:case 36293:return nm;case 36289:case 36303:case 36311:case 36292:return im}}class rm{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Bp(e.type)}}class am{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=sm(e.type)}}class om{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const i=this.seq;for(let r=0,a=i.length;r!==a;++r){const o=i[r];o.setValue(t,e[o.id],n)}}}const Or=/(\w+)(\])?(\[|\.)?/g;function rl(s,t){s.seq.push(t),s.map[t.id]=t}function lm(s,t,e){const n=s.name,i=n.length;for(Or.lastIndex=0;;){const r=Or.exec(n),a=Or.lastIndex;let o=r[1];const c=r[2]==="]",l=r[3];if(c&&(o=o|0),l===void 0||l==="["&&a+2===i){rl(e,l===void 0?new rm(o,s,t):new am(o,s,t));break}else{let u=e.map[o];u===void 0&&(u=new om(o),rl(e,u)),e=u}}}class Os{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){const r=t.getActiveUniform(e,i),a=t.getUniformLocation(e,r.name);lm(r,a,this)}}setValue(t,e,n,i){const r=this.map[e];r!==void 0&&r.setValue(t,n,i)}setOptional(t,e,n){const i=e[n];i!==void 0&&this.setValue(t,n,i)}static upload(t,e,n,i){for(let r=0,a=e.length;r!==a;++r){const o=e[r],c=n[o.id];c.needsUpdate!==!1&&o.setValue(t,c.value,i)}}static seqWithValue(t,e){const n=[];for(let i=0,r=t.length;i!==r;++i){const a=t[i];a.id in e&&n.push(a)}return n}}function al(s,t,e){const n=s.createShader(t);return s.shaderSource(n,e),s.compileShader(n),n}const cm=37297;let hm=0;function um(s,t){const e=s.split(`
`),n=[],i=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=i;a<r;a++){const o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}const ol=new Ut;function dm(s){Wt._getMatrix(ol,Wt.workingColorSpace,s);const t=`mat3( ${ol.elements.map(e=>e.toFixed(4))} )`;switch(Wt.getTransfer(s)){case Bs:return[t,"LinearTransferOETF"];case Kt:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",s),[t,"LinearTransferOETF"]}}function ll(s,t,e){const n=s.getShaderParameter(t,s.COMPILE_STATUS),r=(s.getShaderInfoLog(t)||"").trim();if(n&&r==="")return"";const a=/ERROR: 0:(\d+)/.exec(r);if(a){const o=parseInt(a[1]);return e.toUpperCase()+`

`+r+`

`+um(s.getShaderSource(t),o)}else return r}function fm(s,t){const e=dm(t);return[`vec4 ${s}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function pm(s,t){let e;switch(t){case Qc:e="Linear";break;case th:e="Reinhard";break;case eh:e="Cineon";break;case Dl:e="ACESFilmic";break;case ih:e="AgX";break;case sh:e="Neutral";break;case nh:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+s+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const Ps=new L;function mm(){Wt.getLuminanceCoefficients(Ps);const s=Ps.x.toFixed(4),t=Ps.y.toFixed(4),e=Ps.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${s}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function gm(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",s.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Xi).join(`
`)}function _m(s){const t=[];for(const e in s){const n=s[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function vm(s,t){const e={},n=s.getProgramParameter(t,s.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){const r=s.getActiveAttrib(t,i),a=r.name;let o=1;r.type===s.FLOAT_MAT2&&(o=2),r.type===s.FLOAT_MAT3&&(o=3),r.type===s.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:s.getAttribLocation(t,a),locationSize:o}}return e}function Xi(s){return s!==""}function cl(s,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return s.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function hl(s,t){return s.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const xm=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ca(s){return s.replace(xm,ym)}const Mm=new Map;function ym(s,t){let e=Ot[t];if(e===void 0){const n=Mm.get(t);if(n!==void 0)e=Ot[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return Ca(e)}const Sm=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function ul(s){return s.replace(Sm,Em)}function Em(s,t,e,n){let i="";for(let r=parseInt(t);r<parseInt(e);r++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return i}function dl(s){let t=`precision ${s.precision} float;
	precision ${s.precision} int;
	precision ${s.precision} sampler2D;
	precision ${s.precision} samplerCube;
	precision ${s.precision} sampler3D;
	precision ${s.precision} sampler2DArray;
	precision ${s.precision} sampler2DShadow;
	precision ${s.precision} samplerCubeShadow;
	precision ${s.precision} sampler2DArrayShadow;
	precision ${s.precision} isampler2D;
	precision ${s.precision} isampler3D;
	precision ${s.precision} isamplerCube;
	precision ${s.precision} isampler2DArray;
	precision ${s.precision} usampler2D;
	precision ${s.precision} usampler3D;
	precision ${s.precision} usamplerCube;
	precision ${s.precision} usampler2DArray;
	`;return s.precision==="highp"?t+=`
#define HIGH_PRECISION`:s.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function bm(s){let t="SHADOWMAP_TYPE_BASIC";return s.shadowMapType===Rl?t="SHADOWMAP_TYPE_PCF":s.shadowMapType===Cl?t="SHADOWMAP_TYPE_PCF_SOFT":s.shadowMapType===hn&&(t="SHADOWMAP_TYPE_VSM"),t}function Tm(s){let t="ENVMAP_TYPE_CUBE";if(s.envMap)switch(s.envMapMode){case Ai:case wi:t="ENVMAP_TYPE_CUBE";break;case Ys:t="ENVMAP_TYPE_CUBE_UV";break}return t}function Am(s){let t="ENVMAP_MODE_REFLECTION";if(s.envMap)switch(s.envMapMode){case wi:t="ENVMAP_MODE_REFRACTION";break}return t}function wm(s){let t="ENVMAP_BLENDING_NONE";if(s.envMap)switch(s.combine){case Pl:t="ENVMAP_BLENDING_MULTIPLY";break;case Zc:t="ENVMAP_BLENDING_MIX";break;case jc:t="ENVMAP_BLENDING_ADD";break}return t}function Rm(s){const t=s.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function Cm(s,t,e,n){const i=s.getContext(),r=e.defines;let a=e.vertexShader,o=e.fragmentShader;const c=bm(e),l=Tm(e),h=Am(e),u=wm(e),d=Rm(e),p=gm(e),g=_m(r),_=i.createProgram();let m,f,b=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Xi).join(`
`),m.length>0&&(m+=`
`),f=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Xi).join(`
`),f.length>0&&(f+=`
`)):(m=[dl(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Xi).join(`
`),f=[dl(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+l:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==Cn?"#define TONE_MAPPING":"",e.toneMapping!==Cn?Ot.tonemapping_pars_fragment:"",e.toneMapping!==Cn?pm("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Ot.colorspace_pars_fragment,fm("linearToOutputTexel",e.outputColorSpace),mm(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(Xi).join(`
`)),a=Ca(a),a=cl(a,e),a=hl(a,e),o=Ca(o),o=cl(o,e),o=hl(o,e),a=ul(a),o=ul(o),e.isRawShaderMaterial!==!0&&(b=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,f=["#define varying in",e.glslVersion===po?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===po?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);const E=b+m+a,S=b+f+o,R=al(i,i.VERTEX_SHADER,E),A=al(i,i.FRAGMENT_SHADER,S);i.attachShader(_,R),i.attachShader(_,A),e.index0AttributeName!==void 0?i.bindAttribLocation(_,0,e.index0AttributeName):e.morphTargets===!0&&i.bindAttribLocation(_,0,"position"),i.linkProgram(_);function P(D){if(s.debug.checkShaderErrors){const w=i.getProgramInfoLog(_)||"",O=i.getShaderInfoLog(R)||"",H=i.getShaderInfoLog(A)||"",G=w.trim(),W=O.trim(),et=H.trim();let V=!0,rt=!0;if(i.getProgramParameter(_,i.LINK_STATUS)===!1)if(V=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(i,_,R,A);else{const ct=ll(i,R,"vertex"),Et=ll(i,A,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(_,i.VALIDATE_STATUS)+`

Material Name: `+D.name+`
Material Type: `+D.type+`

Program Info Log: `+G+`
`+ct+`
`+Et)}else G!==""?console.warn("THREE.WebGLProgram: Program Info Log:",G):(W===""||et==="")&&(rt=!1);rt&&(D.diagnostics={runnable:V,programLog:G,vertexShader:{log:W,prefix:m},fragmentShader:{log:et,prefix:f}})}i.deleteShader(R),i.deleteShader(A),U=new Os(i,_),y=vm(i,_)}let U;this.getUniforms=function(){return U===void 0&&P(this),U};let y;this.getAttributes=function(){return y===void 0&&P(this),y};let M=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return M===!1&&(M=i.getProgramParameter(_,cm)),M},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=hm++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=R,this.fragmentShader=A,this}let Pm=0;class Dm{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,i=this._getShaderStage(e),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(t);return a.has(i)===!1&&(a.add(i),i.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new Lm(t),e.set(t,n)),n}}class Lm{constructor(t){this.id=Pm++,this.code=t,this.usedTimes=0}}function Im(s,t,e,n,i,r,a){const o=new ka,c=new Dm,l=new Set,h=[],u=i.logarithmicDepthBuffer,d=i.vertexTextures;let p=i.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(y){return l.add(y),y===0?"uv":`uv${y}`}function m(y,M,D,w,O){const H=w.fog,G=O.geometry,W=y.isMeshStandardMaterial?w.environment:null,et=(y.isMeshStandardMaterial?e:t).get(y.envMap||W),V=et&&et.mapping===Ys?et.image.height:null,rt=g[y.type];y.precision!==null&&(p=i.getMaxPrecision(y.precision),p!==y.precision&&console.warn("THREE.WebGLProgram.getParameters:",y.precision,"not supported, using",p,"instead."));const ct=G.morphAttributes.position||G.morphAttributes.normal||G.morphAttributes.color,Et=ct!==void 0?ct.length:0;let Bt=0;G.morphAttributes.position!==void 0&&(Bt=1),G.morphAttributes.normal!==void 0&&(Bt=2),G.morphAttributes.color!==void 0&&(Bt=3);let Qt,ie,Yt,q;if(rt){const qt=Ze[rt];Qt=qt.vertexShader,ie=qt.fragmentShader}else Qt=y.vertexShader,ie=y.fragmentShader,c.update(y),Yt=c.getVertexShaderID(y),q=c.getFragmentShaderID(y);const J=s.getRenderTarget(),ft=s.state.buffers.depth.getReversed(),Pt=O.isInstancedMesh===!0,St=O.isBatchedMesh===!0,Ht=!!y.map,Me=!!y.matcap,C=!!et,se=!!y.aoMap,Lt=!!y.lightMap,Rt=!!y.bumpMap,gt=!!y.normalMap,re=!!y.displacementMap,_t=!!y.emissiveMap,Ft=!!y.metalnessMap,me=!!y.roughnessMap,he=y.anisotropy>0,T=y.clearcoat>0,v=y.dispersion>0,B=y.iridescence>0,Y=y.sheen>0,K=y.transmission>0,X=he&&!!y.anisotropyMap,yt=T&&!!y.clearcoatMap,nt=T&&!!y.clearcoatNormalMap,vt=T&&!!y.clearcoatRoughnessMap,xt=B&&!!y.iridescenceMap,Q=B&&!!y.iridescenceThicknessMap,lt=Y&&!!y.sheenColorMap,wt=Y&&!!y.sheenRoughnessMap,Mt=!!y.specularMap,at=!!y.specularColorMap,It=!!y.specularIntensityMap,I=K&&!!y.transmissionMap,tt=K&&!!y.thicknessMap,it=!!y.gradientMap,dt=!!y.alphaMap,Z=y.alphaTest>0,$=!!y.alphaHash,mt=!!y.extensions;let Dt=Cn;y.toneMapped&&(J===null||J.isXRRenderTarget===!0)&&(Dt=s.toneMapping);const te={shaderID:rt,shaderType:y.type,shaderName:y.name,vertexShader:Qt,fragmentShader:ie,defines:y.defines,customVertexShaderID:Yt,customFragmentShaderID:q,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:p,batching:St,batchingColor:St&&O._colorsTexture!==null,instancing:Pt,instancingColor:Pt&&O.instanceColor!==null,instancingMorph:Pt&&O.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:J===null?s.outputColorSpace:J.isXRRenderTarget===!0?J.texture.colorSpace:Ri,alphaToCoverage:!!y.alphaToCoverage,map:Ht,matcap:Me,envMap:C,envMapMode:C&&et.mapping,envMapCubeUVHeight:V,aoMap:se,lightMap:Lt,bumpMap:Rt,normalMap:gt,displacementMap:d&&re,emissiveMap:_t,normalMapObjectSpace:gt&&y.normalMapType===lh,normalMapTangentSpace:gt&&y.normalMapType===kl,metalnessMap:Ft,roughnessMap:me,anisotropy:he,anisotropyMap:X,clearcoat:T,clearcoatMap:yt,clearcoatNormalMap:nt,clearcoatRoughnessMap:vt,dispersion:v,iridescence:B,iridescenceMap:xt,iridescenceThicknessMap:Q,sheen:Y,sheenColorMap:lt,sheenRoughnessMap:wt,specularMap:Mt,specularColorMap:at,specularIntensityMap:It,transmission:K,transmissionMap:I,thicknessMap:tt,gradientMap:it,opaque:y.transparent===!1&&y.blending===Ei&&y.alphaToCoverage===!1,alphaMap:dt,alphaTest:Z,alphaHash:$,combine:y.combine,mapUv:Ht&&_(y.map.channel),aoMapUv:se&&_(y.aoMap.channel),lightMapUv:Lt&&_(y.lightMap.channel),bumpMapUv:Rt&&_(y.bumpMap.channel),normalMapUv:gt&&_(y.normalMap.channel),displacementMapUv:re&&_(y.displacementMap.channel),emissiveMapUv:_t&&_(y.emissiveMap.channel),metalnessMapUv:Ft&&_(y.metalnessMap.channel),roughnessMapUv:me&&_(y.roughnessMap.channel),anisotropyMapUv:X&&_(y.anisotropyMap.channel),clearcoatMapUv:yt&&_(y.clearcoatMap.channel),clearcoatNormalMapUv:nt&&_(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:vt&&_(y.clearcoatRoughnessMap.channel),iridescenceMapUv:xt&&_(y.iridescenceMap.channel),iridescenceThicknessMapUv:Q&&_(y.iridescenceThicknessMap.channel),sheenColorMapUv:lt&&_(y.sheenColorMap.channel),sheenRoughnessMapUv:wt&&_(y.sheenRoughnessMap.channel),specularMapUv:Mt&&_(y.specularMap.channel),specularColorMapUv:at&&_(y.specularColorMap.channel),specularIntensityMapUv:It&&_(y.specularIntensityMap.channel),transmissionMapUv:I&&_(y.transmissionMap.channel),thicknessMapUv:tt&&_(y.thicknessMap.channel),alphaMapUv:dt&&_(y.alphaMap.channel),vertexTangents:!!G.attributes.tangent&&(gt||he),vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!G.attributes.color&&G.attributes.color.itemSize===4,pointsUvs:O.isPoints===!0&&!!G.attributes.uv&&(Ht||dt),fog:!!H,useFog:y.fog===!0,fogExp2:!!H&&H.isFogExp2,flatShading:y.flatShading===!0&&y.wireframe===!1,sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:u,reversedDepthBuffer:ft,skinning:O.isSkinnedMesh===!0,morphTargets:G.morphAttributes.position!==void 0,morphNormals:G.morphAttributes.normal!==void 0,morphColors:G.morphAttributes.color!==void 0,morphTargetsCount:Et,morphTextureStride:Bt,numDirLights:M.directional.length,numPointLights:M.point.length,numSpotLights:M.spot.length,numSpotLightMaps:M.spotLightMap.length,numRectAreaLights:M.rectArea.length,numHemiLights:M.hemi.length,numDirLightShadows:M.directionalShadowMap.length,numPointLightShadows:M.pointShadowMap.length,numSpotLightShadows:M.spotShadowMap.length,numSpotLightShadowsWithMaps:M.numSpotLightShadowsWithMaps,numLightProbes:M.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:y.dithering,shadowMapEnabled:s.shadowMap.enabled&&D.length>0,shadowMapType:s.shadowMap.type,toneMapping:Dt,decodeVideoTexture:Ht&&y.map.isVideoTexture===!0&&Wt.getTransfer(y.map.colorSpace)===Kt,decodeVideoTextureEmissive:_t&&y.emissiveMap.isVideoTexture===!0&&Wt.getTransfer(y.emissiveMap.colorSpace)===Kt,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===He,flipSided:y.side===we,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:mt&&y.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(mt&&y.extensions.multiDraw===!0||St)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return te.vertexUv1s=l.has(1),te.vertexUv2s=l.has(2),te.vertexUv3s=l.has(3),l.clear(),te}function f(y){const M=[];if(y.shaderID?M.push(y.shaderID):(M.push(y.customVertexShaderID),M.push(y.customFragmentShaderID)),y.defines!==void 0)for(const D in y.defines)M.push(D),M.push(y.defines[D]);return y.isRawShaderMaterial===!1&&(b(M,y),E(M,y),M.push(s.outputColorSpace)),M.push(y.customProgramCacheKey),M.join()}function b(y,M){y.push(M.precision),y.push(M.outputColorSpace),y.push(M.envMapMode),y.push(M.envMapCubeUVHeight),y.push(M.mapUv),y.push(M.alphaMapUv),y.push(M.lightMapUv),y.push(M.aoMapUv),y.push(M.bumpMapUv),y.push(M.normalMapUv),y.push(M.displacementMapUv),y.push(M.emissiveMapUv),y.push(M.metalnessMapUv),y.push(M.roughnessMapUv),y.push(M.anisotropyMapUv),y.push(M.clearcoatMapUv),y.push(M.clearcoatNormalMapUv),y.push(M.clearcoatRoughnessMapUv),y.push(M.iridescenceMapUv),y.push(M.iridescenceThicknessMapUv),y.push(M.sheenColorMapUv),y.push(M.sheenRoughnessMapUv),y.push(M.specularMapUv),y.push(M.specularColorMapUv),y.push(M.specularIntensityMapUv),y.push(M.transmissionMapUv),y.push(M.thicknessMapUv),y.push(M.combine),y.push(M.fogExp2),y.push(M.sizeAttenuation),y.push(M.morphTargetsCount),y.push(M.morphAttributeCount),y.push(M.numDirLights),y.push(M.numPointLights),y.push(M.numSpotLights),y.push(M.numSpotLightMaps),y.push(M.numHemiLights),y.push(M.numRectAreaLights),y.push(M.numDirLightShadows),y.push(M.numPointLightShadows),y.push(M.numSpotLightShadows),y.push(M.numSpotLightShadowsWithMaps),y.push(M.numLightProbes),y.push(M.shadowMapType),y.push(M.toneMapping),y.push(M.numClippingPlanes),y.push(M.numClipIntersection),y.push(M.depthPacking)}function E(y,M){o.disableAll(),M.supportsVertexTextures&&o.enable(0),M.instancing&&o.enable(1),M.instancingColor&&o.enable(2),M.instancingMorph&&o.enable(3),M.matcap&&o.enable(4),M.envMap&&o.enable(5),M.normalMapObjectSpace&&o.enable(6),M.normalMapTangentSpace&&o.enable(7),M.clearcoat&&o.enable(8),M.iridescence&&o.enable(9),M.alphaTest&&o.enable(10),M.vertexColors&&o.enable(11),M.vertexAlphas&&o.enable(12),M.vertexUv1s&&o.enable(13),M.vertexUv2s&&o.enable(14),M.vertexUv3s&&o.enable(15),M.vertexTangents&&o.enable(16),M.anisotropy&&o.enable(17),M.alphaHash&&o.enable(18),M.batching&&o.enable(19),M.dispersion&&o.enable(20),M.batchingColor&&o.enable(21),M.gradientMap&&o.enable(22),y.push(o.mask),o.disableAll(),M.fog&&o.enable(0),M.useFog&&o.enable(1),M.flatShading&&o.enable(2),M.logarithmicDepthBuffer&&o.enable(3),M.reversedDepthBuffer&&o.enable(4),M.skinning&&o.enable(5),M.morphTargets&&o.enable(6),M.morphNormals&&o.enable(7),M.morphColors&&o.enable(8),M.premultipliedAlpha&&o.enable(9),M.shadowMapEnabled&&o.enable(10),M.doubleSided&&o.enable(11),M.flipSided&&o.enable(12),M.useDepthPacking&&o.enable(13),M.dithering&&o.enable(14),M.transmission&&o.enable(15),M.sheen&&o.enable(16),M.opaque&&o.enable(17),M.pointsUvs&&o.enable(18),M.decodeVideoTexture&&o.enable(19),M.decodeVideoTextureEmissive&&o.enable(20),M.alphaToCoverage&&o.enable(21),y.push(o.mask)}function S(y){const M=g[y.type];let D;if(M){const w=Ze[M];D=Bh.clone(w.uniforms)}else D=y.uniforms;return D}function R(y,M){let D;for(let w=0,O=h.length;w<O;w++){const H=h[w];if(H.cacheKey===M){D=H,++D.usedTimes;break}}return D===void 0&&(D=new Cm(s,M,y,r),h.push(D)),D}function A(y){if(--y.usedTimes===0){const M=h.indexOf(y);h[M]=h[h.length-1],h.pop(),y.destroy()}}function P(y){c.remove(y)}function U(){c.dispose()}return{getParameters:m,getProgramCacheKey:f,getUniforms:S,acquireProgram:R,releaseProgram:A,releaseShaderCache:P,programs:h,dispose:U}}function Um(){let s=new WeakMap;function t(a){return s.has(a)}function e(a){let o=s.get(a);return o===void 0&&(o={},s.set(a,o)),o}function n(a){s.delete(a)}function i(a,o,c){s.get(a)[o]=c}function r(){s=new WeakMap}return{has:t,get:e,remove:n,update:i,dispose:r}}function Nm(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.material.id!==t.material.id?s.material.id-t.material.id:s.z!==t.z?s.z-t.z:s.id-t.id}function fl(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.z!==t.z?t.z-s.z:s.id-t.id}function pl(){const s=[];let t=0;const e=[],n=[],i=[];function r(){t=0,e.length=0,n.length=0,i.length=0}function a(u,d,p,g,_,m){let f=s[t];return f===void 0?(f={id:u.id,object:u,geometry:d,material:p,groupOrder:g,renderOrder:u.renderOrder,z:_,group:m},s[t]=f):(f.id=u.id,f.object=u,f.geometry=d,f.material=p,f.groupOrder=g,f.renderOrder=u.renderOrder,f.z=_,f.group=m),t++,f}function o(u,d,p,g,_,m){const f=a(u,d,p,g,_,m);p.transmission>0?n.push(f):p.transparent===!0?i.push(f):e.push(f)}function c(u,d,p,g,_,m){const f=a(u,d,p,g,_,m);p.transmission>0?n.unshift(f):p.transparent===!0?i.unshift(f):e.unshift(f)}function l(u,d){e.length>1&&e.sort(u||Nm),n.length>1&&n.sort(d||fl),i.length>1&&i.sort(d||fl)}function h(){for(let u=t,d=s.length;u<d;u++){const p=s[u];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:e,transmissive:n,transparent:i,init:r,push:o,unshift:c,finish:h,sort:l}}function Fm(){let s=new WeakMap;function t(n,i){const r=s.get(n);let a;return r===void 0?(a=new pl,s.set(n,[a])):i>=r.length?(a=new pl,r.push(a)):a=r[i],a}function e(){s=new WeakMap}return{get:t,dispose:e}}function Om(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new L,color:new Nt};break;case"SpotLight":e={position:new L,direction:new L,color:new Nt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new L,color:new Nt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new L,skyColor:new Nt,groundColor:new Nt};break;case"RectAreaLight":e={color:new Nt,position:new L,halfWidth:new L,halfHeight:new L};break}return s[t.id]=e,e}}}function Bm(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ut};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ut};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ut,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[t.id]=e,e}}}let zm=0;function km(s,t){return(t.castShadow?2:0)-(s.castShadow?2:0)+(t.map?1:0)-(s.map?1:0)}function Hm(s){const t=new Om,e=Bm(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)n.probe.push(new L);const i=new L,r=new Zt,a=new Zt;function o(l){let h=0,u=0,d=0;for(let y=0;y<9;y++)n.probe[y].set(0,0,0);let p=0,g=0,_=0,m=0,f=0,b=0,E=0,S=0,R=0,A=0,P=0;l.sort(km);for(let y=0,M=l.length;y<M;y++){const D=l[y],w=D.color,O=D.intensity,H=D.distance,G=D.shadow&&D.shadow.map?D.shadow.map.texture:null;if(D.isAmbientLight)h+=w.r*O,u+=w.g*O,d+=w.b*O;else if(D.isLightProbe){for(let W=0;W<9;W++)n.probe[W].addScaledVector(D.sh.coefficients[W],O);P++}else if(D.isDirectionalLight){const W=t.get(D);if(W.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){const et=D.shadow,V=e.get(D);V.shadowIntensity=et.intensity,V.shadowBias=et.bias,V.shadowNormalBias=et.normalBias,V.shadowRadius=et.radius,V.shadowMapSize=et.mapSize,n.directionalShadow[p]=V,n.directionalShadowMap[p]=G,n.directionalShadowMatrix[p]=D.shadow.matrix,b++}n.directional[p]=W,p++}else if(D.isSpotLight){const W=t.get(D);W.position.setFromMatrixPosition(D.matrixWorld),W.color.copy(w).multiplyScalar(O),W.distance=H,W.coneCos=Math.cos(D.angle),W.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),W.decay=D.decay,n.spot[_]=W;const et=D.shadow;if(D.map&&(n.spotLightMap[R]=D.map,R++,et.updateMatrices(D),D.castShadow&&A++),n.spotLightMatrix[_]=et.matrix,D.castShadow){const V=e.get(D);V.shadowIntensity=et.intensity,V.shadowBias=et.bias,V.shadowNormalBias=et.normalBias,V.shadowRadius=et.radius,V.shadowMapSize=et.mapSize,n.spotShadow[_]=V,n.spotShadowMap[_]=G,S++}_++}else if(D.isRectAreaLight){const W=t.get(D);W.color.copy(w).multiplyScalar(O),W.halfWidth.set(D.width*.5,0,0),W.halfHeight.set(0,D.height*.5,0),n.rectArea[m]=W,m++}else if(D.isPointLight){const W=t.get(D);if(W.color.copy(D.color).multiplyScalar(D.intensity),W.distance=D.distance,W.decay=D.decay,D.castShadow){const et=D.shadow,V=e.get(D);V.shadowIntensity=et.intensity,V.shadowBias=et.bias,V.shadowNormalBias=et.normalBias,V.shadowRadius=et.radius,V.shadowMapSize=et.mapSize,V.shadowCameraNear=et.camera.near,V.shadowCameraFar=et.camera.far,n.pointShadow[g]=V,n.pointShadowMap[g]=G,n.pointShadowMatrix[g]=D.shadow.matrix,E++}n.point[g]=W,g++}else if(D.isHemisphereLight){const W=t.get(D);W.skyColor.copy(D.color).multiplyScalar(O),W.groundColor.copy(D.groundColor).multiplyScalar(O),n.hemi[f]=W,f++}}m>0&&(s.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=st.LTC_FLOAT_1,n.rectAreaLTC2=st.LTC_FLOAT_2):(n.rectAreaLTC1=st.LTC_HALF_1,n.rectAreaLTC2=st.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;const U=n.hash;(U.directionalLength!==p||U.pointLength!==g||U.spotLength!==_||U.rectAreaLength!==m||U.hemiLength!==f||U.numDirectionalShadows!==b||U.numPointShadows!==E||U.numSpotShadows!==S||U.numSpotMaps!==R||U.numLightProbes!==P)&&(n.directional.length=p,n.spot.length=_,n.rectArea.length=m,n.point.length=g,n.hemi.length=f,n.directionalShadow.length=b,n.directionalShadowMap.length=b,n.pointShadow.length=E,n.pointShadowMap.length=E,n.spotShadow.length=S,n.spotShadowMap.length=S,n.directionalShadowMatrix.length=b,n.pointShadowMatrix.length=E,n.spotLightMatrix.length=S+R-A,n.spotLightMap.length=R,n.numSpotLightShadowsWithMaps=A,n.numLightProbes=P,U.directionalLength=p,U.pointLength=g,U.spotLength=_,U.rectAreaLength=m,U.hemiLength=f,U.numDirectionalShadows=b,U.numPointShadows=E,U.numSpotShadows=S,U.numSpotMaps=R,U.numLightProbes=P,n.version=zm++)}function c(l,h){let u=0,d=0,p=0,g=0,_=0;const m=h.matrixWorldInverse;for(let f=0,b=l.length;f<b;f++){const E=l[f];if(E.isDirectionalLight){const S=n.directional[u];S.direction.setFromMatrixPosition(E.matrixWorld),i.setFromMatrixPosition(E.target.matrixWorld),S.direction.sub(i),S.direction.transformDirection(m),u++}else if(E.isSpotLight){const S=n.spot[p];S.position.setFromMatrixPosition(E.matrixWorld),S.position.applyMatrix4(m),S.direction.setFromMatrixPosition(E.matrixWorld),i.setFromMatrixPosition(E.target.matrixWorld),S.direction.sub(i),S.direction.transformDirection(m),p++}else if(E.isRectAreaLight){const S=n.rectArea[g];S.position.setFromMatrixPosition(E.matrixWorld),S.position.applyMatrix4(m),a.identity(),r.copy(E.matrixWorld),r.premultiply(m),a.extractRotation(r),S.halfWidth.set(E.width*.5,0,0),S.halfHeight.set(0,E.height*.5,0),S.halfWidth.applyMatrix4(a),S.halfHeight.applyMatrix4(a),g++}else if(E.isPointLight){const S=n.point[d];S.position.setFromMatrixPosition(E.matrixWorld),S.position.applyMatrix4(m),d++}else if(E.isHemisphereLight){const S=n.hemi[_];S.direction.setFromMatrixPosition(E.matrixWorld),S.direction.transformDirection(m),_++}}}return{setup:o,setupView:c,state:n}}function ml(s){const t=new Hm(s),e=[],n=[];function i(h){l.camera=h,e.length=0,n.length=0}function r(h){e.push(h)}function a(h){n.push(h)}function o(){t.setup(e)}function c(h){t.setupView(e,h)}const l={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:i,state:l,setupLights:o,setupLightsView:c,pushLight:r,pushShadow:a}}function Vm(s){let t=new WeakMap;function e(i,r=0){const a=t.get(i);let o;return a===void 0?(o=new ml(s),t.set(i,[o])):r>=a.length?(o=new ml(s),a.push(o)):o=a[r],o}function n(){t=new WeakMap}return{get:e,dispose:n}}const Gm=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Wm=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function Xm(s,t,e){let n=new Va;const i=new ut,r=new ut,a=new ce,o=new fu({depthPacking:oh}),c=new pu,l={},h=e.maxTextureSize,u={[Dn]:we,[we]:Dn,[He]:He},d=new fn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ut},radius:{value:4}},vertexShader:Gm,fragmentShader:Wm}),p=d.clone();p.defines.HORIZONTAL_PASS=1;const g=new xe;g.setAttribute("position",new Ne(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new Xt(g,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Rl;let f=this.type;this.render=function(A,P,U){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||A.length===0)return;const y=s.getRenderTarget(),M=s.getActiveCubeFace(),D=s.getActiveMipmapLevel(),w=s.state;w.setBlending(Rn),w.buffers.depth.getReversed()===!0?w.buffers.color.setClear(0,0,0,0):w.buffers.color.setClear(1,1,1,1),w.buffers.depth.setTest(!0),w.setScissorTest(!1);const O=f!==hn&&this.type===hn,H=f===hn&&this.type!==hn;for(let G=0,W=A.length;G<W;G++){const et=A[G],V=et.shadow;if(V===void 0){console.warn("THREE.WebGLShadowMap:",et,"has no shadow.");continue}if(V.autoUpdate===!1&&V.needsUpdate===!1)continue;i.copy(V.mapSize);const rt=V.getFrameExtents();if(i.multiply(rt),r.copy(V.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(r.x=Math.floor(h/rt.x),i.x=r.x*rt.x,V.mapSize.x=r.x),i.y>h&&(r.y=Math.floor(h/rt.y),i.y=r.y*rt.y,V.mapSize.y=r.y)),V.map===null||O===!0||H===!0){const Et=this.type!==hn?{minFilter:Ue,magFilter:Ue}:{};V.map!==null&&V.map.dispose(),V.map=new Zn(i.x,i.y,Et),V.map.texture.name=et.name+".shadowMap",V.camera.updateProjectionMatrix()}s.setRenderTarget(V.map),s.clear();const ct=V.getViewportCount();for(let Et=0;Et<ct;Et++){const Bt=V.getViewport(Et);a.set(r.x*Bt.x,r.y*Bt.y,r.x*Bt.z,r.y*Bt.w),w.viewport(a),V.updateMatrices(et,Et),n=V.getFrustum(),S(P,U,V.camera,et,this.type)}V.isPointLightShadow!==!0&&this.type===hn&&b(V,U),V.needsUpdate=!1}f=this.type,m.needsUpdate=!1,s.setRenderTarget(y,M,D)};function b(A,P){const U=t.update(_);d.defines.VSM_SAMPLES!==A.blurSamples&&(d.defines.VSM_SAMPLES=A.blurSamples,p.defines.VSM_SAMPLES=A.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new Zn(i.x,i.y)),d.uniforms.shadow_pass.value=A.map.texture,d.uniforms.resolution.value=A.mapSize,d.uniforms.radius.value=A.radius,s.setRenderTarget(A.mapPass),s.clear(),s.renderBufferDirect(P,null,U,d,_,null),p.uniforms.shadow_pass.value=A.mapPass.texture,p.uniforms.resolution.value=A.mapSize,p.uniforms.radius.value=A.radius,s.setRenderTarget(A.map),s.clear(),s.renderBufferDirect(P,null,U,p,_,null)}function E(A,P,U,y){let M=null;const D=U.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(D!==void 0)M=D;else if(M=U.isPointLight===!0?c:o,s.localClippingEnabled&&P.clipShadows===!0&&Array.isArray(P.clippingPlanes)&&P.clippingPlanes.length!==0||P.displacementMap&&P.displacementScale!==0||P.alphaMap&&P.alphaTest>0||P.map&&P.alphaTest>0||P.alphaToCoverage===!0){const w=M.uuid,O=P.uuid;let H=l[w];H===void 0&&(H={},l[w]=H);let G=H[O];G===void 0&&(G=M.clone(),H[O]=G,P.addEventListener("dispose",R)),M=G}if(M.visible=P.visible,M.wireframe=P.wireframe,y===hn?M.side=P.shadowSide!==null?P.shadowSide:P.side:M.side=P.shadowSide!==null?P.shadowSide:u[P.side],M.alphaMap=P.alphaMap,M.alphaTest=P.alphaToCoverage===!0?.5:P.alphaTest,M.map=P.map,M.clipShadows=P.clipShadows,M.clippingPlanes=P.clippingPlanes,M.clipIntersection=P.clipIntersection,M.displacementMap=P.displacementMap,M.displacementScale=P.displacementScale,M.displacementBias=P.displacementBias,M.wireframeLinewidth=P.wireframeLinewidth,M.linewidth=P.linewidth,U.isPointLight===!0&&M.isMeshDistanceMaterial===!0){const w=s.properties.get(M);w.light=U}return M}function S(A,P,U,y,M){if(A.visible===!1)return;if(A.layers.test(P.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&M===hn)&&(!A.frustumCulled||n.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(U.matrixWorldInverse,A.matrixWorld);const O=t.update(A),H=A.material;if(Array.isArray(H)){const G=O.groups;for(let W=0,et=G.length;W<et;W++){const V=G[W],rt=H[V.materialIndex];if(rt&&rt.visible){const ct=E(A,rt,y,M);A.onBeforeShadow(s,A,P,U,O,ct,V),s.renderBufferDirect(U,null,O,ct,A,V),A.onAfterShadow(s,A,P,U,O,ct,V)}}}else if(H.visible){const G=E(A,H,y,M);A.onBeforeShadow(s,A,P,U,O,G,null),s.renderBufferDirect(U,null,O,G,A,null),A.onAfterShadow(s,A,P,U,O,G,null)}}const w=A.children;for(let O=0,H=w.length;O<H;O++)S(w[O],P,U,y,M)}function R(A){A.target.removeEventListener("dispose",R);for(const U in l){const y=l[U],M=A.target.uuid;M in y&&(y[M].dispose(),delete y[M])}}}const Ym={[Hr]:Vr,[Gr]:Yr,[Wr]:qr,[Ti]:Xr,[Vr]:Hr,[Yr]:Gr,[qr]:Wr,[Xr]:Ti};function qm(s,t){function e(){let I=!1;const tt=new ce;let it=null;const dt=new ce(0,0,0,0);return{setMask:function(Z){it!==Z&&!I&&(s.colorMask(Z,Z,Z,Z),it=Z)},setLocked:function(Z){I=Z},setClear:function(Z,$,mt,Dt,te){te===!0&&(Z*=Dt,$*=Dt,mt*=Dt),tt.set(Z,$,mt,Dt),dt.equals(tt)===!1&&(s.clearColor(Z,$,mt,Dt),dt.copy(tt))},reset:function(){I=!1,it=null,dt.set(-1,0,0,0)}}}function n(){let I=!1,tt=!1,it=null,dt=null,Z=null;return{setReversed:function($){if(tt!==$){const mt=t.get("EXT_clip_control");$?mt.clipControlEXT(mt.LOWER_LEFT_EXT,mt.ZERO_TO_ONE_EXT):mt.clipControlEXT(mt.LOWER_LEFT_EXT,mt.NEGATIVE_ONE_TO_ONE_EXT),tt=$;const Dt=Z;Z=null,this.setClear(Dt)}},getReversed:function(){return tt},setTest:function($){$?J(s.DEPTH_TEST):ft(s.DEPTH_TEST)},setMask:function($){it!==$&&!I&&(s.depthMask($),it=$)},setFunc:function($){if(tt&&($=Ym[$]),dt!==$){switch($){case Hr:s.depthFunc(s.NEVER);break;case Vr:s.depthFunc(s.ALWAYS);break;case Gr:s.depthFunc(s.LESS);break;case Ti:s.depthFunc(s.LEQUAL);break;case Wr:s.depthFunc(s.EQUAL);break;case Xr:s.depthFunc(s.GEQUAL);break;case Yr:s.depthFunc(s.GREATER);break;case qr:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}dt=$}},setLocked:function($){I=$},setClear:function($){Z!==$&&(tt&&($=1-$),s.clearDepth($),Z=$)},reset:function(){I=!1,it=null,dt=null,Z=null,tt=!1}}}function i(){let I=!1,tt=null,it=null,dt=null,Z=null,$=null,mt=null,Dt=null,te=null;return{setTest:function(qt){I||(qt?J(s.STENCIL_TEST):ft(s.STENCIL_TEST))},setMask:function(qt){tt!==qt&&!I&&(s.stencilMask(qt),tt=qt)},setFunc:function(qt,sn,Ke){(it!==qt||dt!==sn||Z!==Ke)&&(s.stencilFunc(qt,sn,Ke),it=qt,dt=sn,Z=Ke)},setOp:function(qt,sn,Ke){($!==qt||mt!==sn||Dt!==Ke)&&(s.stencilOp(qt,sn,Ke),$=qt,mt=sn,Dt=Ke)},setLocked:function(qt){I=qt},setClear:function(qt){te!==qt&&(s.clearStencil(qt),te=qt)},reset:function(){I=!1,tt=null,it=null,dt=null,Z=null,$=null,mt=null,Dt=null,te=null}}}const r=new e,a=new n,o=new i,c=new WeakMap,l=new WeakMap;let h={},u={},d=new WeakMap,p=[],g=null,_=!1,m=null,f=null,b=null,E=null,S=null,R=null,A=null,P=new Nt(0,0,0),U=0,y=!1,M=null,D=null,w=null,O=null,H=null;const G=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let W=!1,et=0;const V=s.getParameter(s.VERSION);V.indexOf("WebGL")!==-1?(et=parseFloat(/^WebGL (\d)/.exec(V)[1]),W=et>=1):V.indexOf("OpenGL ES")!==-1&&(et=parseFloat(/^OpenGL ES (\d)/.exec(V)[1]),W=et>=2);let rt=null,ct={};const Et=s.getParameter(s.SCISSOR_BOX),Bt=s.getParameter(s.VIEWPORT),Qt=new ce().fromArray(Et),ie=new ce().fromArray(Bt);function Yt(I,tt,it,dt){const Z=new Uint8Array(4),$=s.createTexture();s.bindTexture(I,$),s.texParameteri(I,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(I,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let mt=0;mt<it;mt++)I===s.TEXTURE_3D||I===s.TEXTURE_2D_ARRAY?s.texImage3D(tt,0,s.RGBA,1,1,dt,0,s.RGBA,s.UNSIGNED_BYTE,Z):s.texImage2D(tt+mt,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,Z);return $}const q={};q[s.TEXTURE_2D]=Yt(s.TEXTURE_2D,s.TEXTURE_2D,1),q[s.TEXTURE_CUBE_MAP]=Yt(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),q[s.TEXTURE_2D_ARRAY]=Yt(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),q[s.TEXTURE_3D]=Yt(s.TEXTURE_3D,s.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),J(s.DEPTH_TEST),a.setFunc(Ti),Rt(!1),gt(lo),J(s.CULL_FACE),se(Rn);function J(I){h[I]!==!0&&(s.enable(I),h[I]=!0)}function ft(I){h[I]!==!1&&(s.disable(I),h[I]=!1)}function Pt(I,tt){return u[I]!==tt?(s.bindFramebuffer(I,tt),u[I]=tt,I===s.DRAW_FRAMEBUFFER&&(u[s.FRAMEBUFFER]=tt),I===s.FRAMEBUFFER&&(u[s.DRAW_FRAMEBUFFER]=tt),!0):!1}function St(I,tt){let it=p,dt=!1;if(I){it=d.get(tt),it===void 0&&(it=[],d.set(tt,it));const Z=I.textures;if(it.length!==Z.length||it[0]!==s.COLOR_ATTACHMENT0){for(let $=0,mt=Z.length;$<mt;$++)it[$]=s.COLOR_ATTACHMENT0+$;it.length=Z.length,dt=!0}}else it[0]!==s.BACK&&(it[0]=s.BACK,dt=!0);dt&&s.drawBuffers(it)}function Ht(I){return g!==I?(s.useProgram(I),g=I,!0):!1}const Me={[Xn]:s.FUNC_ADD,[Uc]:s.FUNC_SUBTRACT,[Nc]:s.FUNC_REVERSE_SUBTRACT};Me[Fc]=s.MIN,Me[Oc]=s.MAX;const C={[Bc]:s.ZERO,[zc]:s.ONE,[kc]:s.SRC_COLOR,[zr]:s.SRC_ALPHA,[Yc]:s.SRC_ALPHA_SATURATE,[Wc]:s.DST_COLOR,[Vc]:s.DST_ALPHA,[Hc]:s.ONE_MINUS_SRC_COLOR,[kr]:s.ONE_MINUS_SRC_ALPHA,[Xc]:s.ONE_MINUS_DST_COLOR,[Gc]:s.ONE_MINUS_DST_ALPHA,[qc]:s.CONSTANT_COLOR,[$c]:s.ONE_MINUS_CONSTANT_COLOR,[Kc]:s.CONSTANT_ALPHA,[Jc]:s.ONE_MINUS_CONSTANT_ALPHA};function se(I,tt,it,dt,Z,$,mt,Dt,te,qt){if(I===Rn){_===!0&&(ft(s.BLEND),_=!1);return}if(_===!1&&(J(s.BLEND),_=!0),I!==Ic){if(I!==m||qt!==y){if((f!==Xn||S!==Xn)&&(s.blendEquation(s.FUNC_ADD),f=Xn,S=Xn),qt)switch(I){case Ei:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case co:s.blendFunc(s.ONE,s.ONE);break;case ho:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case uo:s.blendFuncSeparate(s.DST_COLOR,s.ONE_MINUS_SRC_ALPHA,s.ZERO,s.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}else switch(I){case Ei:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case co:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE,s.ONE,s.ONE);break;case ho:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case uo:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}b=null,E=null,R=null,A=null,P.set(0,0,0),U=0,m=I,y=qt}return}Z=Z||tt,$=$||it,mt=mt||dt,(tt!==f||Z!==S)&&(s.blendEquationSeparate(Me[tt],Me[Z]),f=tt,S=Z),(it!==b||dt!==E||$!==R||mt!==A)&&(s.blendFuncSeparate(C[it],C[dt],C[$],C[mt]),b=it,E=dt,R=$,A=mt),(Dt.equals(P)===!1||te!==U)&&(s.blendColor(Dt.r,Dt.g,Dt.b,te),P.copy(Dt),U=te),m=I,y=!1}function Lt(I,tt){I.side===He?ft(s.CULL_FACE):J(s.CULL_FACE);let it=I.side===we;tt&&(it=!it),Rt(it),I.blending===Ei&&I.transparent===!1?se(Rn):se(I.blending,I.blendEquation,I.blendSrc,I.blendDst,I.blendEquationAlpha,I.blendSrcAlpha,I.blendDstAlpha,I.blendColor,I.blendAlpha,I.premultipliedAlpha),a.setFunc(I.depthFunc),a.setTest(I.depthTest),a.setMask(I.depthWrite),r.setMask(I.colorWrite);const dt=I.stencilWrite;o.setTest(dt),dt&&(o.setMask(I.stencilWriteMask),o.setFunc(I.stencilFunc,I.stencilRef,I.stencilFuncMask),o.setOp(I.stencilFail,I.stencilZFail,I.stencilZPass)),_t(I.polygonOffset,I.polygonOffsetFactor,I.polygonOffsetUnits),I.alphaToCoverage===!0?J(s.SAMPLE_ALPHA_TO_COVERAGE):ft(s.SAMPLE_ALPHA_TO_COVERAGE)}function Rt(I){M!==I&&(I?s.frontFace(s.CW):s.frontFace(s.CCW),M=I)}function gt(I){I!==Dc?(J(s.CULL_FACE),I!==D&&(I===lo?s.cullFace(s.BACK):I===Lc?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):ft(s.CULL_FACE),D=I}function re(I){I!==w&&(W&&s.lineWidth(I),w=I)}function _t(I,tt,it){I?(J(s.POLYGON_OFFSET_FILL),(O!==tt||H!==it)&&(s.polygonOffset(tt,it),O=tt,H=it)):ft(s.POLYGON_OFFSET_FILL)}function Ft(I){I?J(s.SCISSOR_TEST):ft(s.SCISSOR_TEST)}function me(I){I===void 0&&(I=s.TEXTURE0+G-1),rt!==I&&(s.activeTexture(I),rt=I)}function he(I,tt,it){it===void 0&&(rt===null?it=s.TEXTURE0+G-1:it=rt);let dt=ct[it];dt===void 0&&(dt={type:void 0,texture:void 0},ct[it]=dt),(dt.type!==I||dt.texture!==tt)&&(rt!==it&&(s.activeTexture(it),rt=it),s.bindTexture(I,tt||q[I]),dt.type=I,dt.texture=tt)}function T(){const I=ct[rt];I!==void 0&&I.type!==void 0&&(s.bindTexture(I.type,null),I.type=void 0,I.texture=void 0)}function v(){try{s.compressedTexImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function B(){try{s.compressedTexImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Y(){try{s.texSubImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function K(){try{s.texSubImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function X(){try{s.compressedTexSubImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function yt(){try{s.compressedTexSubImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function nt(){try{s.texStorage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function vt(){try{s.texStorage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function xt(){try{s.texImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Q(){try{s.texImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function lt(I){Qt.equals(I)===!1&&(s.scissor(I.x,I.y,I.z,I.w),Qt.copy(I))}function wt(I){ie.equals(I)===!1&&(s.viewport(I.x,I.y,I.z,I.w),ie.copy(I))}function Mt(I,tt){let it=l.get(tt);it===void 0&&(it=new WeakMap,l.set(tt,it));let dt=it.get(I);dt===void 0&&(dt=s.getUniformBlockIndex(tt,I.name),it.set(I,dt))}function at(I,tt){const dt=l.get(tt).get(I);c.get(tt)!==dt&&(s.uniformBlockBinding(tt,dt,I.__bindingPointIndex),c.set(tt,dt))}function It(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),a.setReversed(!1),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),h={},rt=null,ct={},u={},d=new WeakMap,p=[],g=null,_=!1,m=null,f=null,b=null,E=null,S=null,R=null,A=null,P=new Nt(0,0,0),U=0,y=!1,M=null,D=null,w=null,O=null,H=null,Qt.set(0,0,s.canvas.width,s.canvas.height),ie.set(0,0,s.canvas.width,s.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:J,disable:ft,bindFramebuffer:Pt,drawBuffers:St,useProgram:Ht,setBlending:se,setMaterial:Lt,setFlipSided:Rt,setCullFace:gt,setLineWidth:re,setPolygonOffset:_t,setScissorTest:Ft,activeTexture:me,bindTexture:he,unbindTexture:T,compressedTexImage2D:v,compressedTexImage3D:B,texImage2D:xt,texImage3D:Q,updateUBOMapping:Mt,uniformBlockBinding:at,texStorage2D:nt,texStorage3D:vt,texSubImage2D:Y,texSubImage3D:K,compressedTexSubImage2D:X,compressedTexSubImage3D:yt,scissor:lt,viewport:wt,reset:It}}function $m(s,t,e,n,i,r,a){const o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new ut,h=new WeakMap;let u;const d=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(T,v){return p?new OffscreenCanvas(T,v):ks("canvas")}function _(T,v,B){let Y=1;const K=he(T);if((K.width>B||K.height>B)&&(Y=B/Math.max(K.width,K.height)),Y<1)if(typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&T instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&T instanceof ImageBitmap||typeof VideoFrame<"u"&&T instanceof VideoFrame){const X=Math.floor(Y*K.width),yt=Math.floor(Y*K.height);u===void 0&&(u=g(X,yt));const nt=v?g(X,yt):u;return nt.width=X,nt.height=yt,nt.getContext("2d").drawImage(T,0,0,X,yt),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+K.width+"x"+K.height+") to ("+X+"x"+yt+")."),nt}else return"data"in T&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+K.width+"x"+K.height+")."),T;return T}function m(T){return T.generateMipmaps}function f(T){s.generateMipmap(T)}function b(T){return T.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:T.isWebGL3DRenderTarget?s.TEXTURE_3D:T.isWebGLArrayRenderTarget||T.isCompressedArrayTexture?s.TEXTURE_2D_ARRAY:s.TEXTURE_2D}function E(T,v,B,Y,K=!1){if(T!==null){if(s[T]!==void 0)return s[T];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+T+"'")}let X=v;if(v===s.RED&&(B===s.FLOAT&&(X=s.R32F),B===s.HALF_FLOAT&&(X=s.R16F),B===s.UNSIGNED_BYTE&&(X=s.R8)),v===s.RED_INTEGER&&(B===s.UNSIGNED_BYTE&&(X=s.R8UI),B===s.UNSIGNED_SHORT&&(X=s.R16UI),B===s.UNSIGNED_INT&&(X=s.R32UI),B===s.BYTE&&(X=s.R8I),B===s.SHORT&&(X=s.R16I),B===s.INT&&(X=s.R32I)),v===s.RG&&(B===s.FLOAT&&(X=s.RG32F),B===s.HALF_FLOAT&&(X=s.RG16F),B===s.UNSIGNED_BYTE&&(X=s.RG8)),v===s.RG_INTEGER&&(B===s.UNSIGNED_BYTE&&(X=s.RG8UI),B===s.UNSIGNED_SHORT&&(X=s.RG16UI),B===s.UNSIGNED_INT&&(X=s.RG32UI),B===s.BYTE&&(X=s.RG8I),B===s.SHORT&&(X=s.RG16I),B===s.INT&&(X=s.RG32I)),v===s.RGB_INTEGER&&(B===s.UNSIGNED_BYTE&&(X=s.RGB8UI),B===s.UNSIGNED_SHORT&&(X=s.RGB16UI),B===s.UNSIGNED_INT&&(X=s.RGB32UI),B===s.BYTE&&(X=s.RGB8I),B===s.SHORT&&(X=s.RGB16I),B===s.INT&&(X=s.RGB32I)),v===s.RGBA_INTEGER&&(B===s.UNSIGNED_BYTE&&(X=s.RGBA8UI),B===s.UNSIGNED_SHORT&&(X=s.RGBA16UI),B===s.UNSIGNED_INT&&(X=s.RGBA32UI),B===s.BYTE&&(X=s.RGBA8I),B===s.SHORT&&(X=s.RGBA16I),B===s.INT&&(X=s.RGBA32I)),v===s.RGB&&(B===s.UNSIGNED_INT_5_9_9_9_REV&&(X=s.RGB9_E5),B===s.UNSIGNED_INT_10F_11F_11F_REV&&(X=s.R11F_G11F_B10F)),v===s.RGBA){const yt=K?Bs:Wt.getTransfer(Y);B===s.FLOAT&&(X=s.RGBA32F),B===s.HALF_FLOAT&&(X=s.RGBA16F),B===s.UNSIGNED_BYTE&&(X=yt===Kt?s.SRGB8_ALPHA8:s.RGBA8),B===s.UNSIGNED_SHORT_4_4_4_4&&(X=s.RGBA4),B===s.UNSIGNED_SHORT_5_5_5_1&&(X=s.RGB5_A1)}return(X===s.R16F||X===s.R32F||X===s.RG16F||X===s.RG32F||X===s.RGBA16F||X===s.RGBA32F)&&t.get("EXT_color_buffer_float"),X}function S(T,v){let B;return T?v===null||v===Jn||v===Ji?B=s.DEPTH24_STENCIL8:v===Qe?B=s.DEPTH32F_STENCIL8:v===Ki&&(B=s.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):v===null||v===Jn||v===Ji?B=s.DEPTH_COMPONENT24:v===Qe?B=s.DEPTH_COMPONENT32F:v===Ki&&(B=s.DEPTH_COMPONENT16),B}function R(T,v){return m(T)===!0||T.isFramebufferTexture&&T.minFilter!==Ue&&T.minFilter!==qe?Math.log2(Math.max(v.width,v.height))+1:T.mipmaps!==void 0&&T.mipmaps.length>0?T.mipmaps.length:T.isCompressedTexture&&Array.isArray(T.image)?v.mipmaps.length:1}function A(T){const v=T.target;v.removeEventListener("dispose",A),U(v),v.isVideoTexture&&h.delete(v)}function P(T){const v=T.target;v.removeEventListener("dispose",P),M(v)}function U(T){const v=n.get(T);if(v.__webglInit===void 0)return;const B=T.source,Y=d.get(B);if(Y){const K=Y[v.__cacheKey];K.usedTimes--,K.usedTimes===0&&y(T),Object.keys(Y).length===0&&d.delete(B)}n.remove(T)}function y(T){const v=n.get(T);s.deleteTexture(v.__webglTexture);const B=T.source,Y=d.get(B);delete Y[v.__cacheKey],a.memory.textures--}function M(T){const v=n.get(T);if(T.depthTexture&&(T.depthTexture.dispose(),n.remove(T.depthTexture)),T.isWebGLCubeRenderTarget)for(let Y=0;Y<6;Y++){if(Array.isArray(v.__webglFramebuffer[Y]))for(let K=0;K<v.__webglFramebuffer[Y].length;K++)s.deleteFramebuffer(v.__webglFramebuffer[Y][K]);else s.deleteFramebuffer(v.__webglFramebuffer[Y]);v.__webglDepthbuffer&&s.deleteRenderbuffer(v.__webglDepthbuffer[Y])}else{if(Array.isArray(v.__webglFramebuffer))for(let Y=0;Y<v.__webglFramebuffer.length;Y++)s.deleteFramebuffer(v.__webglFramebuffer[Y]);else s.deleteFramebuffer(v.__webglFramebuffer);if(v.__webglDepthbuffer&&s.deleteRenderbuffer(v.__webglDepthbuffer),v.__webglMultisampledFramebuffer&&s.deleteFramebuffer(v.__webglMultisampledFramebuffer),v.__webglColorRenderbuffer)for(let Y=0;Y<v.__webglColorRenderbuffer.length;Y++)v.__webglColorRenderbuffer[Y]&&s.deleteRenderbuffer(v.__webglColorRenderbuffer[Y]);v.__webglDepthRenderbuffer&&s.deleteRenderbuffer(v.__webglDepthRenderbuffer)}const B=T.textures;for(let Y=0,K=B.length;Y<K;Y++){const X=n.get(B[Y]);X.__webglTexture&&(s.deleteTexture(X.__webglTexture),a.memory.textures--),n.remove(B[Y])}n.remove(T)}let D=0;function w(){D=0}function O(){const T=D;return T>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+T+" texture units while this GPU supports only "+i.maxTextures),D+=1,T}function H(T){const v=[];return v.push(T.wrapS),v.push(T.wrapT),v.push(T.wrapR||0),v.push(T.magFilter),v.push(T.minFilter),v.push(T.anisotropy),v.push(T.internalFormat),v.push(T.format),v.push(T.type),v.push(T.generateMipmaps),v.push(T.premultiplyAlpha),v.push(T.flipY),v.push(T.unpackAlignment),v.push(T.colorSpace),v.join()}function G(T,v){const B=n.get(T);if(T.isVideoTexture&&Ft(T),T.isRenderTargetTexture===!1&&T.isExternalTexture!==!0&&T.version>0&&B.__version!==T.version){const Y=T.image;if(Y===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(Y.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{q(B,T,v);return}}else T.isExternalTexture&&(B.__webglTexture=T.sourceTexture?T.sourceTexture:null);e.bindTexture(s.TEXTURE_2D,B.__webglTexture,s.TEXTURE0+v)}function W(T,v){const B=n.get(T);if(T.isRenderTargetTexture===!1&&T.version>0&&B.__version!==T.version){q(B,T,v);return}e.bindTexture(s.TEXTURE_2D_ARRAY,B.__webglTexture,s.TEXTURE0+v)}function et(T,v){const B=n.get(T);if(T.isRenderTargetTexture===!1&&T.version>0&&B.__version!==T.version){q(B,T,v);return}e.bindTexture(s.TEXTURE_3D,B.__webglTexture,s.TEXTURE0+v)}function V(T,v){const B=n.get(T);if(T.version>0&&B.__version!==T.version){J(B,T,v);return}e.bindTexture(s.TEXTURE_CUBE_MAP,B.__webglTexture,s.TEXTURE0+v)}const rt={[$i]:s.REPEAT,[qn]:s.CLAMP_TO_EDGE,[Jr]:s.MIRRORED_REPEAT},ct={[Ue]:s.NEAREST,[rh]:s.NEAREST_MIPMAP_NEAREST,[is]:s.NEAREST_MIPMAP_LINEAR,[qe]:s.LINEAR,[er]:s.LINEAR_MIPMAP_NEAREST,[$n]:s.LINEAR_MIPMAP_LINEAR},Et={[ch]:s.NEVER,[mh]:s.ALWAYS,[hh]:s.LESS,[Hl]:s.LEQUAL,[uh]:s.EQUAL,[ph]:s.GEQUAL,[dh]:s.GREATER,[fh]:s.NOTEQUAL};function Bt(T,v){if(v.type===Qe&&t.has("OES_texture_float_linear")===!1&&(v.magFilter===qe||v.magFilter===er||v.magFilter===is||v.magFilter===$n||v.minFilter===qe||v.minFilter===er||v.minFilter===is||v.minFilter===$n)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),s.texParameteri(T,s.TEXTURE_WRAP_S,rt[v.wrapS]),s.texParameteri(T,s.TEXTURE_WRAP_T,rt[v.wrapT]),(T===s.TEXTURE_3D||T===s.TEXTURE_2D_ARRAY)&&s.texParameteri(T,s.TEXTURE_WRAP_R,rt[v.wrapR]),s.texParameteri(T,s.TEXTURE_MAG_FILTER,ct[v.magFilter]),s.texParameteri(T,s.TEXTURE_MIN_FILTER,ct[v.minFilter]),v.compareFunction&&(s.texParameteri(T,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(T,s.TEXTURE_COMPARE_FUNC,Et[v.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(v.magFilter===Ue||v.minFilter!==is&&v.minFilter!==$n||v.type===Qe&&t.has("OES_texture_float_linear")===!1)return;if(v.anisotropy>1||n.get(v).__currentAnisotropy){const B=t.get("EXT_texture_filter_anisotropic");s.texParameterf(T,B.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,i.getMaxAnisotropy())),n.get(v).__currentAnisotropy=v.anisotropy}}}function Qt(T,v){let B=!1;T.__webglInit===void 0&&(T.__webglInit=!0,v.addEventListener("dispose",A));const Y=v.source;let K=d.get(Y);K===void 0&&(K={},d.set(Y,K));const X=H(v);if(X!==T.__cacheKey){K[X]===void 0&&(K[X]={texture:s.createTexture(),usedTimes:0},a.memory.textures++,B=!0),K[X].usedTimes++;const yt=K[T.__cacheKey];yt!==void 0&&(K[T.__cacheKey].usedTimes--,yt.usedTimes===0&&y(v)),T.__cacheKey=X,T.__webglTexture=K[X].texture}return B}function ie(T,v,B){return Math.floor(Math.floor(T/B)/v)}function Yt(T,v,B,Y){const X=T.updateRanges;if(X.length===0)e.texSubImage2D(s.TEXTURE_2D,0,0,0,v.width,v.height,B,Y,v.data);else{X.sort((Q,lt)=>Q.start-lt.start);let yt=0;for(let Q=1;Q<X.length;Q++){const lt=X[yt],wt=X[Q],Mt=lt.start+lt.count,at=ie(wt.start,v.width,4),It=ie(lt.start,v.width,4);wt.start<=Mt+1&&at===It&&ie(wt.start+wt.count-1,v.width,4)===at?lt.count=Math.max(lt.count,wt.start+wt.count-lt.start):(++yt,X[yt]=wt)}X.length=yt+1;const nt=s.getParameter(s.UNPACK_ROW_LENGTH),vt=s.getParameter(s.UNPACK_SKIP_PIXELS),xt=s.getParameter(s.UNPACK_SKIP_ROWS);s.pixelStorei(s.UNPACK_ROW_LENGTH,v.width);for(let Q=0,lt=X.length;Q<lt;Q++){const wt=X[Q],Mt=Math.floor(wt.start/4),at=Math.ceil(wt.count/4),It=Mt%v.width,I=Math.floor(Mt/v.width),tt=at,it=1;s.pixelStorei(s.UNPACK_SKIP_PIXELS,It),s.pixelStorei(s.UNPACK_SKIP_ROWS,I),e.texSubImage2D(s.TEXTURE_2D,0,It,I,tt,it,B,Y,v.data)}T.clearUpdateRanges(),s.pixelStorei(s.UNPACK_ROW_LENGTH,nt),s.pixelStorei(s.UNPACK_SKIP_PIXELS,vt),s.pixelStorei(s.UNPACK_SKIP_ROWS,xt)}}function q(T,v,B){let Y=s.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(Y=s.TEXTURE_2D_ARRAY),v.isData3DTexture&&(Y=s.TEXTURE_3D);const K=Qt(T,v),X=v.source;e.bindTexture(Y,T.__webglTexture,s.TEXTURE0+B);const yt=n.get(X);if(X.version!==yt.__version||K===!0){e.activeTexture(s.TEXTURE0+B);const nt=Wt.getPrimaries(Wt.workingColorSpace),vt=v.colorSpace===An?null:Wt.getPrimaries(v.colorSpace),xt=v.colorSpace===An||nt===vt?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,v.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,v.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,xt);let Q=_(v.image,!1,i.maxTextureSize);Q=me(v,Q);const lt=r.convert(v.format,v.colorSpace),wt=r.convert(v.type);let Mt=E(v.internalFormat,lt,wt,v.colorSpace,v.isVideoTexture);Bt(Y,v);let at;const It=v.mipmaps,I=v.isVideoTexture!==!0,tt=yt.__version===void 0||K===!0,it=X.dataReady,dt=R(v,Q);if(v.isDepthTexture)Mt=S(v.format===ji,v.type),tt&&(I?e.texStorage2D(s.TEXTURE_2D,1,Mt,Q.width,Q.height):e.texImage2D(s.TEXTURE_2D,0,Mt,Q.width,Q.height,0,lt,wt,null));else if(v.isDataTexture)if(It.length>0){I&&tt&&e.texStorage2D(s.TEXTURE_2D,dt,Mt,It[0].width,It[0].height);for(let Z=0,$=It.length;Z<$;Z++)at=It[Z],I?it&&e.texSubImage2D(s.TEXTURE_2D,Z,0,0,at.width,at.height,lt,wt,at.data):e.texImage2D(s.TEXTURE_2D,Z,Mt,at.width,at.height,0,lt,wt,at.data);v.generateMipmaps=!1}else I?(tt&&e.texStorage2D(s.TEXTURE_2D,dt,Mt,Q.width,Q.height),it&&Yt(v,Q,lt,wt)):e.texImage2D(s.TEXTURE_2D,0,Mt,Q.width,Q.height,0,lt,wt,Q.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){I&&tt&&e.texStorage3D(s.TEXTURE_2D_ARRAY,dt,Mt,It[0].width,It[0].height,Q.depth);for(let Z=0,$=It.length;Z<$;Z++)if(at=It[Z],v.format!==$e)if(lt!==null)if(I){if(it)if(v.layerUpdates.size>0){const mt=Xo(at.width,at.height,v.format,v.type);for(const Dt of v.layerUpdates){const te=at.data.subarray(Dt*mt/at.data.BYTES_PER_ELEMENT,(Dt+1)*mt/at.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,Z,0,0,Dt,at.width,at.height,1,lt,te)}v.clearLayerUpdates()}else e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,Z,0,0,0,at.width,at.height,Q.depth,lt,at.data)}else e.compressedTexImage3D(s.TEXTURE_2D_ARRAY,Z,Mt,at.width,at.height,Q.depth,0,at.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else I?it&&e.texSubImage3D(s.TEXTURE_2D_ARRAY,Z,0,0,0,at.width,at.height,Q.depth,lt,wt,at.data):e.texImage3D(s.TEXTURE_2D_ARRAY,Z,Mt,at.width,at.height,Q.depth,0,lt,wt,at.data)}else{I&&tt&&e.texStorage2D(s.TEXTURE_2D,dt,Mt,It[0].width,It[0].height);for(let Z=0,$=It.length;Z<$;Z++)at=It[Z],v.format!==$e?lt!==null?I?it&&e.compressedTexSubImage2D(s.TEXTURE_2D,Z,0,0,at.width,at.height,lt,at.data):e.compressedTexImage2D(s.TEXTURE_2D,Z,Mt,at.width,at.height,0,at.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):I?it&&e.texSubImage2D(s.TEXTURE_2D,Z,0,0,at.width,at.height,lt,wt,at.data):e.texImage2D(s.TEXTURE_2D,Z,Mt,at.width,at.height,0,lt,wt,at.data)}else if(v.isDataArrayTexture)if(I){if(tt&&e.texStorage3D(s.TEXTURE_2D_ARRAY,dt,Mt,Q.width,Q.height,Q.depth),it)if(v.layerUpdates.size>0){const Z=Xo(Q.width,Q.height,v.format,v.type);for(const $ of v.layerUpdates){const mt=Q.data.subarray($*Z/Q.data.BYTES_PER_ELEMENT,($+1)*Z/Q.data.BYTES_PER_ELEMENT);e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,$,Q.width,Q.height,1,lt,wt,mt)}v.clearLayerUpdates()}else e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,Q.width,Q.height,Q.depth,lt,wt,Q.data)}else e.texImage3D(s.TEXTURE_2D_ARRAY,0,Mt,Q.width,Q.height,Q.depth,0,lt,wt,Q.data);else if(v.isData3DTexture)I?(tt&&e.texStorage3D(s.TEXTURE_3D,dt,Mt,Q.width,Q.height,Q.depth),it&&e.texSubImage3D(s.TEXTURE_3D,0,0,0,0,Q.width,Q.height,Q.depth,lt,wt,Q.data)):e.texImage3D(s.TEXTURE_3D,0,Mt,Q.width,Q.height,Q.depth,0,lt,wt,Q.data);else if(v.isFramebufferTexture){if(tt)if(I)e.texStorage2D(s.TEXTURE_2D,dt,Mt,Q.width,Q.height);else{let Z=Q.width,$=Q.height;for(let mt=0;mt<dt;mt++)e.texImage2D(s.TEXTURE_2D,mt,Mt,Z,$,0,lt,wt,null),Z>>=1,$>>=1}}else if(It.length>0){if(I&&tt){const Z=he(It[0]);e.texStorage2D(s.TEXTURE_2D,dt,Mt,Z.width,Z.height)}for(let Z=0,$=It.length;Z<$;Z++)at=It[Z],I?it&&e.texSubImage2D(s.TEXTURE_2D,Z,0,0,lt,wt,at):e.texImage2D(s.TEXTURE_2D,Z,Mt,lt,wt,at);v.generateMipmaps=!1}else if(I){if(tt){const Z=he(Q);e.texStorage2D(s.TEXTURE_2D,dt,Mt,Z.width,Z.height)}it&&e.texSubImage2D(s.TEXTURE_2D,0,0,0,lt,wt,Q)}else e.texImage2D(s.TEXTURE_2D,0,Mt,lt,wt,Q);m(v)&&f(Y),yt.__version=X.version,v.onUpdate&&v.onUpdate(v)}T.__version=v.version}function J(T,v,B){if(v.image.length!==6)return;const Y=Qt(T,v),K=v.source;e.bindTexture(s.TEXTURE_CUBE_MAP,T.__webglTexture,s.TEXTURE0+B);const X=n.get(K);if(K.version!==X.__version||Y===!0){e.activeTexture(s.TEXTURE0+B);const yt=Wt.getPrimaries(Wt.workingColorSpace),nt=v.colorSpace===An?null:Wt.getPrimaries(v.colorSpace),vt=v.colorSpace===An||yt===nt?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,v.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,v.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,vt);const xt=v.isCompressedTexture||v.image[0].isCompressedTexture,Q=v.image[0]&&v.image[0].isDataTexture,lt=[];for(let $=0;$<6;$++)!xt&&!Q?lt[$]=_(v.image[$],!0,i.maxCubemapSize):lt[$]=Q?v.image[$].image:v.image[$],lt[$]=me(v,lt[$]);const wt=lt[0],Mt=r.convert(v.format,v.colorSpace),at=r.convert(v.type),It=E(v.internalFormat,Mt,at,v.colorSpace),I=v.isVideoTexture!==!0,tt=X.__version===void 0||Y===!0,it=K.dataReady;let dt=R(v,wt);Bt(s.TEXTURE_CUBE_MAP,v);let Z;if(xt){I&&tt&&e.texStorage2D(s.TEXTURE_CUBE_MAP,dt,It,wt.width,wt.height);for(let $=0;$<6;$++){Z=lt[$].mipmaps;for(let mt=0;mt<Z.length;mt++){const Dt=Z[mt];v.format!==$e?Mt!==null?I?it&&e.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,mt,0,0,Dt.width,Dt.height,Mt,Dt.data):e.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,mt,It,Dt.width,Dt.height,0,Dt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):I?it&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,mt,0,0,Dt.width,Dt.height,Mt,at,Dt.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,mt,It,Dt.width,Dt.height,0,Mt,at,Dt.data)}}}else{if(Z=v.mipmaps,I&&tt){Z.length>0&&dt++;const $=he(lt[0]);e.texStorage2D(s.TEXTURE_CUBE_MAP,dt,It,$.width,$.height)}for(let $=0;$<6;$++)if(Q){I?it&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,0,0,lt[$].width,lt[$].height,Mt,at,lt[$].data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,It,lt[$].width,lt[$].height,0,Mt,at,lt[$].data);for(let mt=0;mt<Z.length;mt++){const te=Z[mt].image[$].image;I?it&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,mt+1,0,0,te.width,te.height,Mt,at,te.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,mt+1,It,te.width,te.height,0,Mt,at,te.data)}}else{I?it&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,0,0,Mt,at,lt[$]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,It,Mt,at,lt[$]);for(let mt=0;mt<Z.length;mt++){const Dt=Z[mt];I?it&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,mt+1,0,0,Mt,at,Dt.image[$]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,mt+1,It,Mt,at,Dt.image[$])}}}m(v)&&f(s.TEXTURE_CUBE_MAP),X.__version=K.version,v.onUpdate&&v.onUpdate(v)}T.__version=v.version}function ft(T,v,B,Y,K,X){const yt=r.convert(B.format,B.colorSpace),nt=r.convert(B.type),vt=E(B.internalFormat,yt,nt,B.colorSpace),xt=n.get(v),Q=n.get(B);if(Q.__renderTarget=v,!xt.__hasExternalTextures){const lt=Math.max(1,v.width>>X),wt=Math.max(1,v.height>>X);K===s.TEXTURE_3D||K===s.TEXTURE_2D_ARRAY?e.texImage3D(K,X,vt,lt,wt,v.depth,0,yt,nt,null):e.texImage2D(K,X,vt,lt,wt,0,yt,nt,null)}e.bindFramebuffer(s.FRAMEBUFFER,T),_t(v)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,Y,K,Q.__webglTexture,0,re(v)):(K===s.TEXTURE_2D||K>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&K<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,Y,K,Q.__webglTexture,X),e.bindFramebuffer(s.FRAMEBUFFER,null)}function Pt(T,v,B){if(s.bindRenderbuffer(s.RENDERBUFFER,T),v.depthBuffer){const Y=v.depthTexture,K=Y&&Y.isDepthTexture?Y.type:null,X=S(v.stencilBuffer,K),yt=v.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,nt=re(v);_t(v)?o.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,nt,X,v.width,v.height):B?s.renderbufferStorageMultisample(s.RENDERBUFFER,nt,X,v.width,v.height):s.renderbufferStorage(s.RENDERBUFFER,X,v.width,v.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,yt,s.RENDERBUFFER,T)}else{const Y=v.textures;for(let K=0;K<Y.length;K++){const X=Y[K],yt=r.convert(X.format,X.colorSpace),nt=r.convert(X.type),vt=E(X.internalFormat,yt,nt,X.colorSpace),xt=re(v);B&&_t(v)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,xt,vt,v.width,v.height):_t(v)?o.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,xt,vt,v.width,v.height):s.renderbufferStorage(s.RENDERBUFFER,vt,v.width,v.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function St(T,v){if(v&&v.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(s.FRAMEBUFFER,T),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const Y=n.get(v.depthTexture);Y.__renderTarget=v,(!Y.__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),G(v.depthTexture,0);const K=Y.__webglTexture,X=re(v);if(v.depthTexture.format===Zi)_t(v)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,K,0,X):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,K,0);else if(v.depthTexture.format===ji)_t(v)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,K,0,X):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,K,0);else throw new Error("Unknown depthTexture format")}function Ht(T){const v=n.get(T),B=T.isWebGLCubeRenderTarget===!0;if(v.__boundDepthTexture!==T.depthTexture){const Y=T.depthTexture;if(v.__depthDisposeCallback&&v.__depthDisposeCallback(),Y){const K=()=>{delete v.__boundDepthTexture,delete v.__depthDisposeCallback,Y.removeEventListener("dispose",K)};Y.addEventListener("dispose",K),v.__depthDisposeCallback=K}v.__boundDepthTexture=Y}if(T.depthTexture&&!v.__autoAllocateDepthBuffer){if(B)throw new Error("target.depthTexture not supported in Cube render targets");const Y=T.texture.mipmaps;Y&&Y.length>0?St(v.__webglFramebuffer[0],T):St(v.__webglFramebuffer,T)}else if(B){v.__webglDepthbuffer=[];for(let Y=0;Y<6;Y++)if(e.bindFramebuffer(s.FRAMEBUFFER,v.__webglFramebuffer[Y]),v.__webglDepthbuffer[Y]===void 0)v.__webglDepthbuffer[Y]=s.createRenderbuffer(),Pt(v.__webglDepthbuffer[Y],T,!1);else{const K=T.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,X=v.__webglDepthbuffer[Y];s.bindRenderbuffer(s.RENDERBUFFER,X),s.framebufferRenderbuffer(s.FRAMEBUFFER,K,s.RENDERBUFFER,X)}}else{const Y=T.texture.mipmaps;if(Y&&Y.length>0?e.bindFramebuffer(s.FRAMEBUFFER,v.__webglFramebuffer[0]):e.bindFramebuffer(s.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer===void 0)v.__webglDepthbuffer=s.createRenderbuffer(),Pt(v.__webglDepthbuffer,T,!1);else{const K=T.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,X=v.__webglDepthbuffer;s.bindRenderbuffer(s.RENDERBUFFER,X),s.framebufferRenderbuffer(s.FRAMEBUFFER,K,s.RENDERBUFFER,X)}}e.bindFramebuffer(s.FRAMEBUFFER,null)}function Me(T,v,B){const Y=n.get(T);v!==void 0&&ft(Y.__webglFramebuffer,T,T.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),B!==void 0&&Ht(T)}function C(T){const v=T.texture,B=n.get(T),Y=n.get(v);T.addEventListener("dispose",P);const K=T.textures,X=T.isWebGLCubeRenderTarget===!0,yt=K.length>1;if(yt||(Y.__webglTexture===void 0&&(Y.__webglTexture=s.createTexture()),Y.__version=v.version,a.memory.textures++),X){B.__webglFramebuffer=[];for(let nt=0;nt<6;nt++)if(v.mipmaps&&v.mipmaps.length>0){B.__webglFramebuffer[nt]=[];for(let vt=0;vt<v.mipmaps.length;vt++)B.__webglFramebuffer[nt][vt]=s.createFramebuffer()}else B.__webglFramebuffer[nt]=s.createFramebuffer()}else{if(v.mipmaps&&v.mipmaps.length>0){B.__webglFramebuffer=[];for(let nt=0;nt<v.mipmaps.length;nt++)B.__webglFramebuffer[nt]=s.createFramebuffer()}else B.__webglFramebuffer=s.createFramebuffer();if(yt)for(let nt=0,vt=K.length;nt<vt;nt++){const xt=n.get(K[nt]);xt.__webglTexture===void 0&&(xt.__webglTexture=s.createTexture(),a.memory.textures++)}if(T.samples>0&&_t(T)===!1){B.__webglMultisampledFramebuffer=s.createFramebuffer(),B.__webglColorRenderbuffer=[],e.bindFramebuffer(s.FRAMEBUFFER,B.__webglMultisampledFramebuffer);for(let nt=0;nt<K.length;nt++){const vt=K[nt];B.__webglColorRenderbuffer[nt]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,B.__webglColorRenderbuffer[nt]);const xt=r.convert(vt.format,vt.colorSpace),Q=r.convert(vt.type),lt=E(vt.internalFormat,xt,Q,vt.colorSpace,T.isXRRenderTarget===!0),wt=re(T);s.renderbufferStorageMultisample(s.RENDERBUFFER,wt,lt,T.width,T.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+nt,s.RENDERBUFFER,B.__webglColorRenderbuffer[nt])}s.bindRenderbuffer(s.RENDERBUFFER,null),T.depthBuffer&&(B.__webglDepthRenderbuffer=s.createRenderbuffer(),Pt(B.__webglDepthRenderbuffer,T,!0)),e.bindFramebuffer(s.FRAMEBUFFER,null)}}if(X){e.bindTexture(s.TEXTURE_CUBE_MAP,Y.__webglTexture),Bt(s.TEXTURE_CUBE_MAP,v);for(let nt=0;nt<6;nt++)if(v.mipmaps&&v.mipmaps.length>0)for(let vt=0;vt<v.mipmaps.length;vt++)ft(B.__webglFramebuffer[nt][vt],T,v,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+nt,vt);else ft(B.__webglFramebuffer[nt],T,v,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+nt,0);m(v)&&f(s.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(yt){for(let nt=0,vt=K.length;nt<vt;nt++){const xt=K[nt],Q=n.get(xt);let lt=s.TEXTURE_2D;(T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(lt=T.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),e.bindTexture(lt,Q.__webglTexture),Bt(lt,xt),ft(B.__webglFramebuffer,T,xt,s.COLOR_ATTACHMENT0+nt,lt,0),m(xt)&&f(lt)}e.unbindTexture()}else{let nt=s.TEXTURE_2D;if((T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(nt=T.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),e.bindTexture(nt,Y.__webglTexture),Bt(nt,v),v.mipmaps&&v.mipmaps.length>0)for(let vt=0;vt<v.mipmaps.length;vt++)ft(B.__webglFramebuffer[vt],T,v,s.COLOR_ATTACHMENT0,nt,vt);else ft(B.__webglFramebuffer,T,v,s.COLOR_ATTACHMENT0,nt,0);m(v)&&f(nt),e.unbindTexture()}T.depthBuffer&&Ht(T)}function se(T){const v=T.textures;for(let B=0,Y=v.length;B<Y;B++){const K=v[B];if(m(K)){const X=b(T),yt=n.get(K).__webglTexture;e.bindTexture(X,yt),f(X),e.unbindTexture()}}}const Lt=[],Rt=[];function gt(T){if(T.samples>0){if(_t(T)===!1){const v=T.textures,B=T.width,Y=T.height;let K=s.COLOR_BUFFER_BIT;const X=T.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,yt=n.get(T),nt=v.length>1;if(nt)for(let xt=0;xt<v.length;xt++)e.bindFramebuffer(s.FRAMEBUFFER,yt.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+xt,s.RENDERBUFFER,null),e.bindFramebuffer(s.FRAMEBUFFER,yt.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+xt,s.TEXTURE_2D,null,0);e.bindFramebuffer(s.READ_FRAMEBUFFER,yt.__webglMultisampledFramebuffer);const vt=T.texture.mipmaps;vt&&vt.length>0?e.bindFramebuffer(s.DRAW_FRAMEBUFFER,yt.__webglFramebuffer[0]):e.bindFramebuffer(s.DRAW_FRAMEBUFFER,yt.__webglFramebuffer);for(let xt=0;xt<v.length;xt++){if(T.resolveDepthBuffer&&(T.depthBuffer&&(K|=s.DEPTH_BUFFER_BIT),T.stencilBuffer&&T.resolveStencilBuffer&&(K|=s.STENCIL_BUFFER_BIT)),nt){s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,yt.__webglColorRenderbuffer[xt]);const Q=n.get(v[xt]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,Q,0)}s.blitFramebuffer(0,0,B,Y,0,0,B,Y,K,s.NEAREST),c===!0&&(Lt.length=0,Rt.length=0,Lt.push(s.COLOR_ATTACHMENT0+xt),T.depthBuffer&&T.resolveDepthBuffer===!1&&(Lt.push(X),Rt.push(X),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,Rt)),s.invalidateFramebuffer(s.READ_FRAMEBUFFER,Lt))}if(e.bindFramebuffer(s.READ_FRAMEBUFFER,null),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),nt)for(let xt=0;xt<v.length;xt++){e.bindFramebuffer(s.FRAMEBUFFER,yt.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+xt,s.RENDERBUFFER,yt.__webglColorRenderbuffer[xt]);const Q=n.get(v[xt]).__webglTexture;e.bindFramebuffer(s.FRAMEBUFFER,yt.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+xt,s.TEXTURE_2D,Q,0)}e.bindFramebuffer(s.DRAW_FRAMEBUFFER,yt.__webglMultisampledFramebuffer)}else if(T.depthBuffer&&T.resolveDepthBuffer===!1&&c){const v=T.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[v])}}}function re(T){return Math.min(i.maxSamples,T.samples)}function _t(T){const v=n.get(T);return T.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function Ft(T){const v=a.render.frame;h.get(T)!==v&&(h.set(T,v),T.update())}function me(T,v){const B=T.colorSpace,Y=T.format,K=T.type;return T.isCompressedTexture===!0||T.isVideoTexture===!0||B!==Ri&&B!==An&&(Wt.getTransfer(B)===Kt?(Y!==$e||K!==en)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",B)),v}function he(T){return typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement?(l.width=T.naturalWidth||T.width,l.height=T.naturalHeight||T.height):typeof VideoFrame<"u"&&T instanceof VideoFrame?(l.width=T.displayWidth,l.height=T.displayHeight):(l.width=T.width,l.height=T.height),l}this.allocateTextureUnit=O,this.resetTextureUnits=w,this.setTexture2D=G,this.setTexture2DArray=W,this.setTexture3D=et,this.setTextureCube=V,this.rebindTextures=Me,this.setupRenderTarget=C,this.updateRenderTargetMipmap=se,this.updateMultisampleRenderTarget=gt,this.setupDepthRenderbuffer=Ht,this.setupFrameBufferTexture=ft,this.useMultisampledRTT=_t}function Km(s,t){function e(n,i=An){let r;const a=Wt.getTransfer(i);if(n===en)return s.UNSIGNED_BYTE;if(n===La)return s.UNSIGNED_SHORT_4_4_4_4;if(n===Ia)return s.UNSIGNED_SHORT_5_5_5_1;if(n===Nl)return s.UNSIGNED_INT_5_9_9_9_REV;if(n===Fl)return s.UNSIGNED_INT_10F_11F_11F_REV;if(n===Il)return s.BYTE;if(n===Ul)return s.SHORT;if(n===Ki)return s.UNSIGNED_SHORT;if(n===Da)return s.INT;if(n===Jn)return s.UNSIGNED_INT;if(n===Qe)return s.FLOAT;if(n===ts)return s.HALF_FLOAT;if(n===Ol)return s.ALPHA;if(n===Bl)return s.RGB;if(n===$e)return s.RGBA;if(n===Zi)return s.DEPTH_COMPONENT;if(n===ji)return s.DEPTH_STENCIL;if(n===Ua)return s.RED;if(n===Na)return s.RED_INTEGER;if(n===zl)return s.RG;if(n===Fa)return s.RG_INTEGER;if(n===Oa)return s.RGBA_INTEGER;if(n===Ls||n===Is||n===Us||n===Ns)if(a===Kt)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Ls)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Is)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Us)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Ns)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Ls)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Is)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Us)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Ns)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Zr||n===jr||n===Qr||n===ta)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Zr)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===jr)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Qr)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===ta)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===ea||n===na||n===ia)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===ea||n===na)return a===Kt?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===ia)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===sa||n===ra||n===aa||n===oa||n===la||n===ca||n===ha||n===ua||n===da||n===fa||n===pa||n===ma||n===ga||n===_a)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===sa)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===ra)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===aa)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===oa)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===la)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===ca)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===ha)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===ua)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===da)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===fa)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===pa)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===ma)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===ga)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===_a)return a===Kt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===va||n===xa||n===Ma)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===va)return a===Kt?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===xa)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Ma)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===ya||n===Sa||n===Ea||n===ba)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===ya)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Sa)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Ea)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===ba)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Ji?s.UNSIGNED_INT_24_8:s[n]!==void 0?s[n]:null}return{convert:e}}const Jm=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Zm=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class jm{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){const n=new Ql(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,n=new fn({vertexShader:Jm,fragmentShader:Zm,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new Xt(new Ye(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Qm extends Pi{constructor(t,e){super();const n=this;let i=null,r=1,a=null,o="local-floor",c=1,l=null,h=null,u=null,d=null,p=null,g=null;const _=typeof XRWebGLBinding<"u",m=new jm,f={},b=e.getContextAttributes();let E=null,S=null;const R=[],A=[],P=new ut;let U=null;const y=new ke;y.viewport=new ce;const M=new ke;M.viewport=new ce;const D=[y,M],w=new vu;let O=null,H=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(q){let J=R[q];return J===void 0&&(J=new br,R[q]=J),J.getTargetRaySpace()},this.getControllerGrip=function(q){let J=R[q];return J===void 0&&(J=new br,R[q]=J),J.getGripSpace()},this.getHand=function(q){let J=R[q];return J===void 0&&(J=new br,R[q]=J),J.getHandSpace()};function G(q){const J=A.indexOf(q.inputSource);if(J===-1)return;const ft=R[J];ft!==void 0&&(ft.update(q.inputSource,q.frame,l||a),ft.dispatchEvent({type:q.type,data:q.inputSource}))}function W(){i.removeEventListener("select",G),i.removeEventListener("selectstart",G),i.removeEventListener("selectend",G),i.removeEventListener("squeeze",G),i.removeEventListener("squeezestart",G),i.removeEventListener("squeezeend",G),i.removeEventListener("end",W),i.removeEventListener("inputsourceschange",et);for(let q=0;q<R.length;q++){const J=A[q];J!==null&&(A[q]=null,R[q].disconnect(J))}O=null,H=null,m.reset();for(const q in f)delete f[q];t.setRenderTarget(E),p=null,d=null,u=null,i=null,S=null,Yt.stop(),n.isPresenting=!1,t.setPixelRatio(U),t.setSize(P.width,P.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(q){r=q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(q){o=q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||a},this.setReferenceSpace=function(q){l=q},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return u===null&&_&&(u=new XRWebGLBinding(i,e)),u},this.getFrame=function(){return g},this.getSession=function(){return i},this.setSession=async function(q){if(i=q,i!==null){if(E=t.getRenderTarget(),i.addEventListener("select",G),i.addEventListener("selectstart",G),i.addEventListener("selectend",G),i.addEventListener("squeeze",G),i.addEventListener("squeezestart",G),i.addEventListener("squeezeend",G),i.addEventListener("end",W),i.addEventListener("inputsourceschange",et),b.xrCompatible!==!0&&await e.makeXRCompatible(),U=t.getPixelRatio(),t.getSize(P),_&&"createProjectionLayer"in XRWebGLBinding.prototype){let ft=null,Pt=null,St=null;b.depth&&(St=b.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,ft=b.stencil?ji:Zi,Pt=b.stencil?Ji:Jn);const Ht={colorFormat:e.RGBA8,depthFormat:St,scaleFactor:r};u=this.getBinding(),d=u.createProjectionLayer(Ht),i.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),S=new Zn(d.textureWidth,d.textureHeight,{format:$e,type:en,depthTexture:new jl(d.textureWidth,d.textureHeight,Pt,void 0,void 0,void 0,void 0,void 0,void 0,ft),stencilBuffer:b.stencil,colorSpace:t.outputColorSpace,samples:b.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}else{const ft={antialias:b.antialias,alpha:!0,depth:b.depth,stencil:b.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(i,e,ft),i.updateRenderState({baseLayer:p}),t.setPixelRatio(1),t.setSize(p.framebufferWidth,p.framebufferHeight,!1),S=new Zn(p.framebufferWidth,p.framebufferHeight,{format:$e,type:en,colorSpace:t.outputColorSpace,stencilBuffer:b.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(c),l=null,a=await i.requestReferenceSpace(o),Yt.setContext(i),Yt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function et(q){for(let J=0;J<q.removed.length;J++){const ft=q.removed[J],Pt=A.indexOf(ft);Pt>=0&&(A[Pt]=null,R[Pt].disconnect(ft))}for(let J=0;J<q.added.length;J++){const ft=q.added[J];let Pt=A.indexOf(ft);if(Pt===-1){for(let Ht=0;Ht<R.length;Ht++)if(Ht>=A.length){A.push(ft),Pt=Ht;break}else if(A[Ht]===null){A[Ht]=ft,Pt=Ht;break}if(Pt===-1)break}const St=R[Pt];St&&St.connect(ft)}}const V=new L,rt=new L;function ct(q,J,ft){V.setFromMatrixPosition(J.matrixWorld),rt.setFromMatrixPosition(ft.matrixWorld);const Pt=V.distanceTo(rt),St=J.projectionMatrix.elements,Ht=ft.projectionMatrix.elements,Me=St[14]/(St[10]-1),C=St[14]/(St[10]+1),se=(St[9]+1)/St[5],Lt=(St[9]-1)/St[5],Rt=(St[8]-1)/St[0],gt=(Ht[8]+1)/Ht[0],re=Me*Rt,_t=Me*gt,Ft=Pt/(-Rt+gt),me=Ft*-Rt;if(J.matrixWorld.decompose(q.position,q.quaternion,q.scale),q.translateX(me),q.translateZ(Ft),q.matrixWorld.compose(q.position,q.quaternion,q.scale),q.matrixWorldInverse.copy(q.matrixWorld).invert(),St[10]===-1)q.projectionMatrix.copy(J.projectionMatrix),q.projectionMatrixInverse.copy(J.projectionMatrixInverse);else{const he=Me+Ft,T=C+Ft,v=re-me,B=_t+(Pt-me),Y=se*C/T*he,K=Lt*C/T*he;q.projectionMatrix.makePerspective(v,B,Y,K,he,T),q.projectionMatrixInverse.copy(q.projectionMatrix).invert()}}function Et(q,J){J===null?q.matrixWorld.copy(q.matrix):q.matrixWorld.multiplyMatrices(J.matrixWorld,q.matrix),q.matrixWorldInverse.copy(q.matrixWorld).invert()}this.updateCamera=function(q){if(i===null)return;let J=q.near,ft=q.far;m.texture!==null&&(m.depthNear>0&&(J=m.depthNear),m.depthFar>0&&(ft=m.depthFar)),w.near=M.near=y.near=J,w.far=M.far=y.far=ft,(O!==w.near||H!==w.far)&&(i.updateRenderState({depthNear:w.near,depthFar:w.far}),O=w.near,H=w.far),w.layers.mask=q.layers.mask|6,y.layers.mask=w.layers.mask&3,M.layers.mask=w.layers.mask&5;const Pt=q.parent,St=w.cameras;Et(w,Pt);for(let Ht=0;Ht<St.length;Ht++)Et(St[Ht],Pt);St.length===2?ct(w,y,M):w.projectionMatrix.copy(y.projectionMatrix),Bt(q,w,Pt)};function Bt(q,J,ft){ft===null?q.matrix.copy(J.matrixWorld):(q.matrix.copy(ft.matrixWorld),q.matrix.invert(),q.matrix.multiply(J.matrixWorld)),q.matrix.decompose(q.position,q.quaternion,q.scale),q.updateMatrixWorld(!0),q.projectionMatrix.copy(J.projectionMatrix),q.projectionMatrixInverse.copy(J.projectionMatrixInverse),q.isPerspectiveCamera&&(q.fov=Aa*2*Math.atan(1/q.projectionMatrix.elements[5]),q.zoom=1)}this.getCamera=function(){return w},this.getFoveation=function(){if(!(d===null&&p===null))return c},this.setFoveation=function(q){c=q,d!==null&&(d.fixedFoveation=q),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=q)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(w)},this.getCameraTexture=function(q){return f[q]};let Qt=null;function ie(q,J){if(h=J.getViewerPose(l||a),g=J,h!==null){const ft=h.views;p!==null&&(t.setRenderTargetFramebuffer(S,p.framebuffer),t.setRenderTarget(S));let Pt=!1;ft.length!==w.cameras.length&&(w.cameras.length=0,Pt=!0);for(let C=0;C<ft.length;C++){const se=ft[C];let Lt=null;if(p!==null)Lt=p.getViewport(se);else{const gt=u.getViewSubImage(d,se);Lt=gt.viewport,C===0&&(t.setRenderTargetTextures(S,gt.colorTexture,gt.depthStencilTexture),t.setRenderTarget(S))}let Rt=D[C];Rt===void 0&&(Rt=new ke,Rt.layers.enable(C),Rt.viewport=new ce,D[C]=Rt),Rt.matrix.fromArray(se.transform.matrix),Rt.matrix.decompose(Rt.position,Rt.quaternion,Rt.scale),Rt.projectionMatrix.fromArray(se.projectionMatrix),Rt.projectionMatrixInverse.copy(Rt.projectionMatrix).invert(),Rt.viewport.set(Lt.x,Lt.y,Lt.width,Lt.height),C===0&&(w.matrix.copy(Rt.matrix),w.matrix.decompose(w.position,w.quaternion,w.scale)),Pt===!0&&w.cameras.push(Rt)}const St=i.enabledFeatures;if(St&&St.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&_){u=n.getBinding();const C=u.getDepthInformation(ft[0]);C&&C.isValid&&C.texture&&m.init(C,i.renderState)}if(St&&St.includes("camera-access")&&_){t.state.unbindTexture(),u=n.getBinding();for(let C=0;C<ft.length;C++){const se=ft[C].camera;if(se){let Lt=f[se];Lt||(Lt=new Ql,f[se]=Lt);const Rt=u.getCameraImage(se);Lt.sourceTexture=Rt}}}}for(let ft=0;ft<R.length;ft++){const Pt=A[ft],St=R[ft];Pt!==null&&St!==void 0&&St.update(Pt,J,l||a)}Qt&&Qt(q,J),J.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:J}),g=null}const Yt=new sc;Yt.setAnimationLoop(ie),this.setAnimationLoop=function(q){Qt=q},this.dispose=function(){}}}const Hn=new nn,t0=new Zt;function e0(s,t){function e(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function n(m,f){f.color.getRGB(m.fogColor.value,ql(s)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function i(m,f,b,E,S){f.isMeshBasicMaterial||f.isMeshLambertMaterial?r(m,f):f.isMeshToonMaterial?(r(m,f),u(m,f)):f.isMeshPhongMaterial?(r(m,f),h(m,f)):f.isMeshStandardMaterial?(r(m,f),d(m,f),f.isMeshPhysicalMaterial&&p(m,f,S)):f.isMeshMatcapMaterial?(r(m,f),g(m,f)):f.isMeshDepthMaterial?r(m,f):f.isMeshDistanceMaterial?(r(m,f),_(m,f)):f.isMeshNormalMaterial?r(m,f):f.isLineBasicMaterial?(a(m,f),f.isLineDashedMaterial&&o(m,f)):f.isPointsMaterial?c(m,f,b,E):f.isSpriteMaterial?l(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function r(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,e(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,e(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===we&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,e(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===we&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,e(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,e(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,e(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);const b=t.get(f),E=b.envMap,S=b.envMapRotation;E&&(m.envMap.value=E,Hn.copy(S),Hn.x*=-1,Hn.y*=-1,Hn.z*=-1,E.isCubeTexture&&E.isRenderTargetTexture===!1&&(Hn.y*=-1,Hn.z*=-1),m.envMapRotation.value.setFromMatrix4(t0.makeRotationFromEuler(Hn)),m.flipEnvMap.value=E.isCubeTexture&&E.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap&&(m.lightMap.value=f.lightMap,m.lightMapIntensity.value=f.lightMapIntensity,e(f.lightMap,m.lightMapTransform)),f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,e(f.aoMap,m.aoMapTransform))}function a(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,e(f.map,m.mapTransform))}function o(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function c(m,f,b,E){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*b,m.scale.value=E*.5,f.map&&(m.map.value=f.map,e(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function l(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,e(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function h(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function u(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function d(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,e(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,e(f.roughnessMap,m.roughnessMapTransform)),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function p(m,f,b){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,e(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,e(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,e(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,e(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,e(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===we&&m.clearcoatNormalScale.value.negate())),f.dispersion>0&&(m.dispersion.value=f.dispersion),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,e(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,e(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=b.texture,m.transmissionSamplerSize.value.set(b.width,b.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,e(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,e(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,e(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,e(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,e(f.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,f){f.matcap&&(m.matcap.value=f.matcap)}function _(m,f){const b=t.get(f).light;m.referencePosition.value.setFromMatrixPosition(b.matrixWorld),m.nearDistance.value=b.shadow.camera.near,m.farDistance.value=b.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function n0(s,t,e,n){let i={},r={},a=[];const o=s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS);function c(b,E){const S=E.program;n.uniformBlockBinding(b,S)}function l(b,E){let S=i[b.id];S===void 0&&(g(b),S=h(b),i[b.id]=S,b.addEventListener("dispose",m));const R=E.program;n.updateUBOMapping(b,R);const A=t.render.frame;r[b.id]!==A&&(d(b),r[b.id]=A)}function h(b){const E=u();b.__bindingPointIndex=E;const S=s.createBuffer(),R=b.__size,A=b.usage;return s.bindBuffer(s.UNIFORM_BUFFER,S),s.bufferData(s.UNIFORM_BUFFER,R,A),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,E,S),S}function u(){for(let b=0;b<o;b++)if(a.indexOf(b)===-1)return a.push(b),b;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(b){const E=i[b.id],S=b.uniforms,R=b.__cache;s.bindBuffer(s.UNIFORM_BUFFER,E);for(let A=0,P=S.length;A<P;A++){const U=Array.isArray(S[A])?S[A]:[S[A]];for(let y=0,M=U.length;y<M;y++){const D=U[y];if(p(D,A,y,R)===!0){const w=D.__offset,O=Array.isArray(D.value)?D.value:[D.value];let H=0;for(let G=0;G<O.length;G++){const W=O[G],et=_(W);typeof W=="number"||typeof W=="boolean"?(D.__data[0]=W,s.bufferSubData(s.UNIFORM_BUFFER,w+H,D.__data)):W.isMatrix3?(D.__data[0]=W.elements[0],D.__data[1]=W.elements[1],D.__data[2]=W.elements[2],D.__data[3]=0,D.__data[4]=W.elements[3],D.__data[5]=W.elements[4],D.__data[6]=W.elements[5],D.__data[7]=0,D.__data[8]=W.elements[6],D.__data[9]=W.elements[7],D.__data[10]=W.elements[8],D.__data[11]=0):(W.toArray(D.__data,H),H+=et.storage/Float32Array.BYTES_PER_ELEMENT)}s.bufferSubData(s.UNIFORM_BUFFER,w,D.__data)}}}s.bindBuffer(s.UNIFORM_BUFFER,null)}function p(b,E,S,R){const A=b.value,P=E+"_"+S;if(R[P]===void 0)return typeof A=="number"||typeof A=="boolean"?R[P]=A:R[P]=A.clone(),!0;{const U=R[P];if(typeof A=="number"||typeof A=="boolean"){if(U!==A)return R[P]=A,!0}else if(U.equals(A)===!1)return U.copy(A),!0}return!1}function g(b){const E=b.uniforms;let S=0;const R=16;for(let P=0,U=E.length;P<U;P++){const y=Array.isArray(E[P])?E[P]:[E[P]];for(let M=0,D=y.length;M<D;M++){const w=y[M],O=Array.isArray(w.value)?w.value:[w.value];for(let H=0,G=O.length;H<G;H++){const W=O[H],et=_(W),V=S%R,rt=V%et.boundary,ct=V+rt;S+=rt,ct!==0&&R-ct<et.storage&&(S+=R-ct),w.__data=new Float32Array(et.storage/Float32Array.BYTES_PER_ELEMENT),w.__offset=S,S+=et.storage}}}const A=S%R;return A>0&&(S+=R-A),b.__size=S,b.__cache={},this}function _(b){const E={boundary:0,storage:0};return typeof b=="number"||typeof b=="boolean"?(E.boundary=4,E.storage=4):b.isVector2?(E.boundary=8,E.storage=8):b.isVector3||b.isColor?(E.boundary=16,E.storage=12):b.isVector4?(E.boundary=16,E.storage=16):b.isMatrix3?(E.boundary=48,E.storage=48):b.isMatrix4?(E.boundary=64,E.storage=64):b.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",b),E}function m(b){const E=b.target;E.removeEventListener("dispose",m);const S=a.indexOf(E.__bindingPointIndex);a.splice(S,1),s.deleteBuffer(i[E.id]),delete i[E.id],delete r[E.id]}function f(){for(const b in i)s.deleteBuffer(i[b]);a=[],i={},r={}}return{bind:c,update:l,dispose:f}}class i0{constructor(t={}){const{canvas:e=vh(),context:n=null,depth:i=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1}=t;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=a;const g=new Uint32Array(4),_=new Int32Array(4);let m=null,f=null;const b=[],E=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Cn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const S=this;let R=!1;this._outputColorSpace=Ee;let A=0,P=0,U=null,y=-1,M=null;const D=new ce,w=new ce;let O=null;const H=new Nt(0);let G=0,W=e.width,et=e.height,V=1,rt=null,ct=null;const Et=new ce(0,0,W,et),Bt=new ce(0,0,W,et);let Qt=!1;const ie=new Va;let Yt=!1,q=!1;const J=new Zt,ft=new L,Pt=new ce,St={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Ht=!1;function Me(){return U===null?V:1}let C=n;function se(x,N){return e.getContext(x,N)}try{const x={alpha:!0,depth:i,stencil:r,antialias:o,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Pa}`),e.addEventListener("webglcontextlost",it,!1),e.addEventListener("webglcontextrestored",dt,!1),e.addEventListener("webglcontextcreationerror",Z,!1),C===null){const N="webgl2";if(C=se(N,x),C===null)throw se(N)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(x){throw console.error("THREE.WebGLRenderer: "+x.message),x}let Lt,Rt,gt,re,_t,Ft,me,he,T,v,B,Y,K,X,yt,nt,vt,xt,Q,lt,wt,Mt,at,It;function I(){Lt=new fp(C),Lt.init(),Mt=new Km(C,Lt),Rt=new ap(C,Lt,t,Mt),gt=new qm(C,Lt),Rt.reversedDepthBuffer&&d&&gt.buffers.depth.setReversed(!0),re=new gp(C),_t=new Um,Ft=new $m(C,Lt,gt,_t,Rt,Mt,re),me=new lp(S),he=new dp(S),T=new yu(C),at=new sp(C,T),v=new pp(C,T,re,at),B=new vp(C,v,T,re),Q=new _p(C,Rt,Ft),nt=new op(_t),Y=new Im(S,me,he,Lt,Rt,at,nt),K=new e0(S,_t),X=new Fm,yt=new Vm(Lt),xt=new ip(S,me,he,gt,B,p,c),vt=new Xm(S,B,Rt),It=new n0(C,re,Rt,gt),lt=new rp(C,Lt,re),wt=new mp(C,Lt,re),re.programs=Y.programs,S.capabilities=Rt,S.extensions=Lt,S.properties=_t,S.renderLists=X,S.shadowMap=vt,S.state=gt,S.info=re}I();const tt=new Qm(S,C);this.xr=tt,this.getContext=function(){return C},this.getContextAttributes=function(){return C.getContextAttributes()},this.forceContextLoss=function(){const x=Lt.get("WEBGL_lose_context");x&&x.loseContext()},this.forceContextRestore=function(){const x=Lt.get("WEBGL_lose_context");x&&x.restoreContext()},this.getPixelRatio=function(){return V},this.setPixelRatio=function(x){x!==void 0&&(V=x,this.setSize(W,et,!1))},this.getSize=function(x){return x.set(W,et)},this.setSize=function(x,N,z=!0){if(tt.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}W=x,et=N,e.width=Math.floor(x*V),e.height=Math.floor(N*V),z===!0&&(e.style.width=x+"px",e.style.height=N+"px"),this.setViewport(0,0,x,N)},this.getDrawingBufferSize=function(x){return x.set(W*V,et*V).floor()},this.setDrawingBufferSize=function(x,N,z){W=x,et=N,V=z,e.width=Math.floor(x*z),e.height=Math.floor(N*z),this.setViewport(0,0,x,N)},this.getCurrentViewport=function(x){return x.copy(D)},this.getViewport=function(x){return x.copy(Et)},this.setViewport=function(x,N,z,k){x.isVector4?Et.set(x.x,x.y,x.z,x.w):Et.set(x,N,z,k),gt.viewport(D.copy(Et).multiplyScalar(V).round())},this.getScissor=function(x){return x.copy(Bt)},this.setScissor=function(x,N,z,k){x.isVector4?Bt.set(x.x,x.y,x.z,x.w):Bt.set(x,N,z,k),gt.scissor(w.copy(Bt).multiplyScalar(V).round())},this.getScissorTest=function(){return Qt},this.setScissorTest=function(x){gt.setScissorTest(Qt=x)},this.setOpaqueSort=function(x){rt=x},this.setTransparentSort=function(x){ct=x},this.getClearColor=function(x){return x.copy(xt.getClearColor())},this.setClearColor=function(){xt.setClearColor(...arguments)},this.getClearAlpha=function(){return xt.getClearAlpha()},this.setClearAlpha=function(){xt.setClearAlpha(...arguments)},this.clear=function(x=!0,N=!0,z=!0){let k=0;if(x){let F=!1;if(U!==null){const j=U.texture.format;F=j===Oa||j===Fa||j===Na}if(F){const j=U.texture.type,ot=j===en||j===Jn||j===Ki||j===Ji||j===La||j===Ia,pt=xt.getClearColor(),ht=xt.getClearAlpha(),At=pt.r,Ct=pt.g,bt=pt.b;ot?(g[0]=At,g[1]=Ct,g[2]=bt,g[3]=ht,C.clearBufferuiv(C.COLOR,0,g)):(_[0]=At,_[1]=Ct,_[2]=bt,_[3]=ht,C.clearBufferiv(C.COLOR,0,_))}else k|=C.COLOR_BUFFER_BIT}N&&(k|=C.DEPTH_BUFFER_BIT),z&&(k|=C.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),C.clear(k)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",it,!1),e.removeEventListener("webglcontextrestored",dt,!1),e.removeEventListener("webglcontextcreationerror",Z,!1),xt.dispose(),X.dispose(),yt.dispose(),_t.dispose(),me.dispose(),he.dispose(),B.dispose(),at.dispose(),It.dispose(),Y.dispose(),tt.dispose(),tt.removeEventListener("sessionstart",Ke),tt.removeEventListener("sessionend",Ka),In.stop()};function it(x){x.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),R=!0}function dt(){console.log("THREE.WebGLRenderer: Context Restored."),R=!1;const x=re.autoReset,N=vt.enabled,z=vt.autoUpdate,k=vt.needsUpdate,F=vt.type;I(),re.autoReset=x,vt.enabled=N,vt.autoUpdate=z,vt.needsUpdate=k,vt.type=F}function Z(x){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",x.statusMessage)}function $(x){const N=x.target;N.removeEventListener("dispose",$),mt(N)}function mt(x){Dt(x),_t.remove(x)}function Dt(x){const N=_t.get(x).programs;N!==void 0&&(N.forEach(function(z){Y.releaseProgram(z)}),x.isShaderMaterial&&Y.releaseShaderCache(x))}this.renderBufferDirect=function(x,N,z,k,F,j){N===null&&(N=St);const ot=F.isMesh&&F.matrixWorld.determinant()<0,pt=hc(x,N,z,k,F);gt.setMaterial(k,ot);let ht=z.index,At=1;if(k.wireframe===!0){if(ht=v.getWireframeAttribute(z),ht===void 0)return;At=2}const Ct=z.drawRange,bt=z.attributes.position;let kt=Ct.start*At,$t=(Ct.start+Ct.count)*At;j!==null&&(kt=Math.max(kt,j.start*At),$t=Math.min($t,(j.start+j.count)*At)),ht!==null?(kt=Math.max(kt,0),$t=Math.min($t,ht.count)):bt!=null&&(kt=Math.max(kt,0),$t=Math.min($t,bt.count));const le=$t-kt;if(le<0||le===1/0)return;at.setup(F,k,pt,z,ht);let ee,jt=lt;if(ht!==null&&(ee=T.get(ht),jt=wt,jt.setIndex(ee)),F.isMesh)k.wireframe===!0?(gt.setLineWidth(k.wireframeLinewidth*Me()),jt.setMode(C.LINES)):jt.setMode(C.TRIANGLES);else if(F.isLine){let Tt=k.linewidth;Tt===void 0&&(Tt=1),gt.setLineWidth(Tt*Me()),F.isLineSegments?jt.setMode(C.LINES):F.isLineLoop?jt.setMode(C.LINE_LOOP):jt.setMode(C.LINE_STRIP)}else F.isPoints?jt.setMode(C.POINTS):F.isSprite&&jt.setMode(C.TRIANGLES);if(F.isBatchedMesh)if(F._multiDrawInstances!==null)Qi("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),jt.renderMultiDrawInstances(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount,F._multiDrawInstances);else if(Lt.get("WEBGL_multi_draw"))jt.renderMultiDraw(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount);else{const Tt=F._multiDrawStarts,ae=F._multiDrawCounts,Gt=F._multiDrawCount,Ce=ht?T.get(ht).bytesPerElement:1,ti=_t.get(k).currentProgram.getUniforms();for(let Pe=0;Pe<Gt;Pe++)ti.setValue(C,"_gl_DrawID",Pe),jt.render(Tt[Pe]/Ce,ae[Pe])}else if(F.isInstancedMesh)jt.renderInstances(kt,le,F.count);else if(z.isInstancedBufferGeometry){const Tt=z._maxInstanceCount!==void 0?z._maxInstanceCount:1/0,ae=Math.min(z.instanceCount,Tt);jt.renderInstances(kt,le,ae)}else jt.render(kt,le)};function te(x,N,z){x.transparent===!0&&x.side===He&&x.forceSinglePass===!1?(x.side=we,x.needsUpdate=!0,ns(x,N,z),x.side=Dn,x.needsUpdate=!0,ns(x,N,z),x.side=He):ns(x,N,z)}this.compile=function(x,N,z=null){z===null&&(z=x),f=yt.get(z),f.init(N),E.push(f),z.traverseVisible(function(F){F.isLight&&F.layers.test(N.layers)&&(f.pushLight(F),F.castShadow&&f.pushShadow(F))}),x!==z&&x.traverseVisible(function(F){F.isLight&&F.layers.test(N.layers)&&(f.pushLight(F),F.castShadow&&f.pushShadow(F))}),f.setupLights();const k=new Set;return x.traverse(function(F){if(!(F.isMesh||F.isPoints||F.isLine||F.isSprite))return;const j=F.material;if(j)if(Array.isArray(j))for(let ot=0;ot<j.length;ot++){const pt=j[ot];te(pt,z,F),k.add(pt)}else te(j,z,F),k.add(j)}),f=E.pop(),k},this.compileAsync=function(x,N,z=null){const k=this.compile(x,N,z);return new Promise(F=>{function j(){if(k.forEach(function(ot){_t.get(ot).currentProgram.isReady()&&k.delete(ot)}),k.size===0){F(x);return}setTimeout(j,10)}Lt.get("KHR_parallel_shader_compile")!==null?j():setTimeout(j,10)})};let qt=null;function sn(x){qt&&qt(x)}function Ke(){In.stop()}function Ka(){In.start()}const In=new sc;In.setAnimationLoop(sn),typeof self<"u"&&In.setContext(self),this.setAnimationLoop=function(x){qt=x,tt.setAnimationLoop(x),x===null?In.stop():In.start()},tt.addEventListener("sessionstart",Ke),tt.addEventListener("sessionend",Ka),this.render=function(x,N){if(N!==void 0&&N.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(R===!0)return;if(x.matrixWorldAutoUpdate===!0&&x.updateMatrixWorld(),N.parent===null&&N.matrixWorldAutoUpdate===!0&&N.updateMatrixWorld(),tt.enabled===!0&&tt.isPresenting===!0&&(tt.cameraAutoUpdate===!0&&tt.updateCamera(N),N=tt.getCamera()),x.isScene===!0&&x.onBeforeRender(S,x,N,U),f=yt.get(x,E.length),f.init(N),E.push(f),J.multiplyMatrices(N.projectionMatrix,N.matrixWorldInverse),ie.setFromProjectionMatrix(J,tn,N.reversedDepth),q=this.localClippingEnabled,Yt=nt.init(this.clippingPlanes,q),m=X.get(x,b.length),m.init(),b.push(m),tt.enabled===!0&&tt.isPresenting===!0){const j=S.xr.getDepthSensingMesh();j!==null&&Ks(j,N,-1/0,S.sortObjects)}Ks(x,N,0,S.sortObjects),m.finish(),S.sortObjects===!0&&m.sort(rt,ct),Ht=tt.enabled===!1||tt.isPresenting===!1||tt.hasDepthSensing()===!1,Ht&&xt.addToRenderList(m,x),this.info.render.frame++,Yt===!0&&nt.beginShadows();const z=f.state.shadowsArray;vt.render(z,x,N),Yt===!0&&nt.endShadows(),this.info.autoReset===!0&&this.info.reset();const k=m.opaque,F=m.transmissive;if(f.setupLights(),N.isArrayCamera){const j=N.cameras;if(F.length>0)for(let ot=0,pt=j.length;ot<pt;ot++){const ht=j[ot];Za(k,F,x,ht)}Ht&&xt.render(x);for(let ot=0,pt=j.length;ot<pt;ot++){const ht=j[ot];Ja(m,x,ht,ht.viewport)}}else F.length>0&&Za(k,F,x,N),Ht&&xt.render(x),Ja(m,x,N);U!==null&&P===0&&(Ft.updateMultisampleRenderTarget(U),Ft.updateRenderTargetMipmap(U)),x.isScene===!0&&x.onAfterRender(S,x,N),at.resetDefaultState(),y=-1,M=null,E.pop(),E.length>0?(f=E[E.length-1],Yt===!0&&nt.setGlobalState(S.clippingPlanes,f.state.camera)):f=null,b.pop(),b.length>0?m=b[b.length-1]:m=null};function Ks(x,N,z,k){if(x.visible===!1)return;if(x.layers.test(N.layers)){if(x.isGroup)z=x.renderOrder;else if(x.isLOD)x.autoUpdate===!0&&x.update(N);else if(x.isLight)f.pushLight(x),x.castShadow&&f.pushShadow(x);else if(x.isSprite){if(!x.frustumCulled||ie.intersectsSprite(x)){k&&Pt.setFromMatrixPosition(x.matrixWorld).applyMatrix4(J);const ot=B.update(x),pt=x.material;pt.visible&&m.push(x,ot,pt,z,Pt.z,null)}}else if((x.isMesh||x.isLine||x.isPoints)&&(!x.frustumCulled||ie.intersectsObject(x))){const ot=B.update(x),pt=x.material;if(k&&(x.boundingSphere!==void 0?(x.boundingSphere===null&&x.computeBoundingSphere(),Pt.copy(x.boundingSphere.center)):(ot.boundingSphere===null&&ot.computeBoundingSphere(),Pt.copy(ot.boundingSphere.center)),Pt.applyMatrix4(x.matrixWorld).applyMatrix4(J)),Array.isArray(pt)){const ht=ot.groups;for(let At=0,Ct=ht.length;At<Ct;At++){const bt=ht[At],kt=pt[bt.materialIndex];kt&&kt.visible&&m.push(x,ot,kt,z,Pt.z,bt)}}else pt.visible&&m.push(x,ot,pt,z,Pt.z,null)}}const j=x.children;for(let ot=0,pt=j.length;ot<pt;ot++)Ks(j[ot],N,z,k)}function Ja(x,N,z,k){const F=x.opaque,j=x.transmissive,ot=x.transparent;f.setupLightsView(z),Yt===!0&&nt.setGlobalState(S.clippingPlanes,z),k&&gt.viewport(D.copy(k)),F.length>0&&es(F,N,z),j.length>0&&es(j,N,z),ot.length>0&&es(ot,N,z),gt.buffers.depth.setTest(!0),gt.buffers.depth.setMask(!0),gt.buffers.color.setMask(!0),gt.setPolygonOffset(!1)}function Za(x,N,z,k){if((z.isScene===!0?z.overrideMaterial:null)!==null)return;f.state.transmissionRenderTarget[k.id]===void 0&&(f.state.transmissionRenderTarget[k.id]=new Zn(1,1,{generateMipmaps:!0,type:Lt.has("EXT_color_buffer_half_float")||Lt.has("EXT_color_buffer_float")?ts:en,minFilter:$n,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Wt.workingColorSpace}));const j=f.state.transmissionRenderTarget[k.id],ot=k.viewport||D;j.setSize(ot.z*S.transmissionResolutionScale,ot.w*S.transmissionResolutionScale);const pt=S.getRenderTarget(),ht=S.getActiveCubeFace(),At=S.getActiveMipmapLevel();S.setRenderTarget(j),S.getClearColor(H),G=S.getClearAlpha(),G<1&&S.setClearColor(16777215,.5),S.clear(),Ht&&xt.render(z);const Ct=S.toneMapping;S.toneMapping=Cn;const bt=k.viewport;if(k.viewport!==void 0&&(k.viewport=void 0),f.setupLightsView(k),Yt===!0&&nt.setGlobalState(S.clippingPlanes,k),es(x,z,k),Ft.updateMultisampleRenderTarget(j),Ft.updateRenderTargetMipmap(j),Lt.has("WEBGL_multisampled_render_to_texture")===!1){let kt=!1;for(let $t=0,le=N.length;$t<le;$t++){const ee=N[$t],jt=ee.object,Tt=ee.geometry,ae=ee.material,Gt=ee.group;if(ae.side===He&&jt.layers.test(k.layers)){const Ce=ae.side;ae.side=we,ae.needsUpdate=!0,ja(jt,z,k,Tt,ae,Gt),ae.side=Ce,ae.needsUpdate=!0,kt=!0}}kt===!0&&(Ft.updateMultisampleRenderTarget(j),Ft.updateRenderTargetMipmap(j))}S.setRenderTarget(pt,ht,At),S.setClearColor(H,G),bt!==void 0&&(k.viewport=bt),S.toneMapping=Ct}function es(x,N,z){const k=N.isScene===!0?N.overrideMaterial:null;for(let F=0,j=x.length;F<j;F++){const ot=x[F],pt=ot.object,ht=ot.geometry,At=ot.group;let Ct=ot.material;Ct.allowOverride===!0&&k!==null&&(Ct=k),pt.layers.test(z.layers)&&ja(pt,N,z,ht,Ct,At)}}function ja(x,N,z,k,F,j){x.onBeforeRender(S,N,z,k,F,j),x.modelViewMatrix.multiplyMatrices(z.matrixWorldInverse,x.matrixWorld),x.normalMatrix.getNormalMatrix(x.modelViewMatrix),F.onBeforeRender(S,N,z,k,x,j),F.transparent===!0&&F.side===He&&F.forceSinglePass===!1?(F.side=we,F.needsUpdate=!0,S.renderBufferDirect(z,N,k,F,x,j),F.side=Dn,F.needsUpdate=!0,S.renderBufferDirect(z,N,k,F,x,j),F.side=He):S.renderBufferDirect(z,N,k,F,x,j),x.onAfterRender(S,N,z,k,F,j)}function ns(x,N,z){N.isScene!==!0&&(N=St);const k=_t.get(x),F=f.state.lights,j=f.state.shadowsArray,ot=F.state.version,pt=Y.getParameters(x,F.state,j,N,z),ht=Y.getProgramCacheKey(pt);let At=k.programs;k.environment=x.isMeshStandardMaterial?N.environment:null,k.fog=N.fog,k.envMap=(x.isMeshStandardMaterial?he:me).get(x.envMap||k.environment),k.envMapRotation=k.environment!==null&&x.envMap===null?N.environmentRotation:x.envMapRotation,At===void 0&&(x.addEventListener("dispose",$),At=new Map,k.programs=At);let Ct=At.get(ht);if(Ct!==void 0){if(k.currentProgram===Ct&&k.lightsStateVersion===ot)return to(x,pt),Ct}else pt.uniforms=Y.getUniforms(x),x.onBeforeCompile(pt,S),Ct=Y.acquireProgram(pt,ht),At.set(ht,Ct),k.uniforms=pt.uniforms;const bt=k.uniforms;return(!x.isShaderMaterial&&!x.isRawShaderMaterial||x.clipping===!0)&&(bt.clippingPlanes=nt.uniform),to(x,pt),k.needsLights=dc(x),k.lightsStateVersion=ot,k.needsLights&&(bt.ambientLightColor.value=F.state.ambient,bt.lightProbe.value=F.state.probe,bt.directionalLights.value=F.state.directional,bt.directionalLightShadows.value=F.state.directionalShadow,bt.spotLights.value=F.state.spot,bt.spotLightShadows.value=F.state.spotShadow,bt.rectAreaLights.value=F.state.rectArea,bt.ltc_1.value=F.state.rectAreaLTC1,bt.ltc_2.value=F.state.rectAreaLTC2,bt.pointLights.value=F.state.point,bt.pointLightShadows.value=F.state.pointShadow,bt.hemisphereLights.value=F.state.hemi,bt.directionalShadowMap.value=F.state.directionalShadowMap,bt.directionalShadowMatrix.value=F.state.directionalShadowMatrix,bt.spotShadowMap.value=F.state.spotShadowMap,bt.spotLightMatrix.value=F.state.spotLightMatrix,bt.spotLightMap.value=F.state.spotLightMap,bt.pointShadowMap.value=F.state.pointShadowMap,bt.pointShadowMatrix.value=F.state.pointShadowMatrix),k.currentProgram=Ct,k.uniformsList=null,Ct}function Qa(x){if(x.uniformsList===null){const N=x.currentProgram.getUniforms();x.uniformsList=Os.seqWithValue(N.seq,x.uniforms)}return x.uniformsList}function to(x,N){const z=_t.get(x);z.outputColorSpace=N.outputColorSpace,z.batching=N.batching,z.batchingColor=N.batchingColor,z.instancing=N.instancing,z.instancingColor=N.instancingColor,z.instancingMorph=N.instancingMorph,z.skinning=N.skinning,z.morphTargets=N.morphTargets,z.morphNormals=N.morphNormals,z.morphColors=N.morphColors,z.morphTargetsCount=N.morphTargetsCount,z.numClippingPlanes=N.numClippingPlanes,z.numIntersection=N.numClipIntersection,z.vertexAlphas=N.vertexAlphas,z.vertexTangents=N.vertexTangents,z.toneMapping=N.toneMapping}function hc(x,N,z,k,F){N.isScene!==!0&&(N=St),Ft.resetTextureUnits();const j=N.fog,ot=k.isMeshStandardMaterial?N.environment:null,pt=U===null?S.outputColorSpace:U.isXRRenderTarget===!0?U.texture.colorSpace:Ri,ht=(k.isMeshStandardMaterial?he:me).get(k.envMap||ot),At=k.vertexColors===!0&&!!z.attributes.color&&z.attributes.color.itemSize===4,Ct=!!z.attributes.tangent&&(!!k.normalMap||k.anisotropy>0),bt=!!z.morphAttributes.position,kt=!!z.morphAttributes.normal,$t=!!z.morphAttributes.color;let le=Cn;k.toneMapped&&(U===null||U.isXRRenderTarget===!0)&&(le=S.toneMapping);const ee=z.morphAttributes.position||z.morphAttributes.normal||z.morphAttributes.color,jt=ee!==void 0?ee.length:0,Tt=_t.get(k),ae=f.state.lights;if(Yt===!0&&(q===!0||x!==M)){const be=x===M&&k.id===y;nt.setState(k,x,be)}let Gt=!1;k.version===Tt.__version?(Tt.needsLights&&Tt.lightsStateVersion!==ae.state.version||Tt.outputColorSpace!==pt||F.isBatchedMesh&&Tt.batching===!1||!F.isBatchedMesh&&Tt.batching===!0||F.isBatchedMesh&&Tt.batchingColor===!0&&F.colorTexture===null||F.isBatchedMesh&&Tt.batchingColor===!1&&F.colorTexture!==null||F.isInstancedMesh&&Tt.instancing===!1||!F.isInstancedMesh&&Tt.instancing===!0||F.isSkinnedMesh&&Tt.skinning===!1||!F.isSkinnedMesh&&Tt.skinning===!0||F.isInstancedMesh&&Tt.instancingColor===!0&&F.instanceColor===null||F.isInstancedMesh&&Tt.instancingColor===!1&&F.instanceColor!==null||F.isInstancedMesh&&Tt.instancingMorph===!0&&F.morphTexture===null||F.isInstancedMesh&&Tt.instancingMorph===!1&&F.morphTexture!==null||Tt.envMap!==ht||k.fog===!0&&Tt.fog!==j||Tt.numClippingPlanes!==void 0&&(Tt.numClippingPlanes!==nt.numPlanes||Tt.numIntersection!==nt.numIntersection)||Tt.vertexAlphas!==At||Tt.vertexTangents!==Ct||Tt.morphTargets!==bt||Tt.morphNormals!==kt||Tt.morphColors!==$t||Tt.toneMapping!==le||Tt.morphTargetsCount!==jt)&&(Gt=!0):(Gt=!0,Tt.__version=k.version);let Ce=Tt.currentProgram;Gt===!0&&(Ce=ns(k,N,F));let ti=!1,Pe=!1,Ui=!1;const oe=Ce.getUniforms(),Fe=Tt.uniforms;if(gt.useProgram(Ce.program)&&(ti=!0,Pe=!0,Ui=!0),k.id!==y&&(y=k.id,Pe=!0),ti||M!==x){gt.buffers.depth.getReversed()&&x.reversedDepth!==!0&&(x._reversedDepth=!0,x.updateProjectionMatrix()),oe.setValue(C,"projectionMatrix",x.projectionMatrix),oe.setValue(C,"viewMatrix",x.matrixWorldInverse);const Re=oe.map.cameraPosition;Re!==void 0&&Re.setValue(C,ft.setFromMatrixPosition(x.matrixWorld)),Rt.logarithmicDepthBuffer&&oe.setValue(C,"logDepthBufFC",2/(Math.log(x.far+1)/Math.LN2)),(k.isMeshPhongMaterial||k.isMeshToonMaterial||k.isMeshLambertMaterial||k.isMeshBasicMaterial||k.isMeshStandardMaterial||k.isShaderMaterial)&&oe.setValue(C,"isOrthographic",x.isOrthographicCamera===!0),M!==x&&(M=x,Pe=!0,Ui=!0)}if(F.isSkinnedMesh){oe.setOptional(C,F,"bindMatrix"),oe.setOptional(C,F,"bindMatrixInverse");const be=F.skeleton;be&&(be.boneTexture===null&&be.computeBoneTexture(),oe.setValue(C,"boneTexture",be.boneTexture,Ft))}F.isBatchedMesh&&(oe.setOptional(C,F,"batchingTexture"),oe.setValue(C,"batchingTexture",F._matricesTexture,Ft),oe.setOptional(C,F,"batchingIdTexture"),oe.setValue(C,"batchingIdTexture",F._indirectTexture,Ft),oe.setOptional(C,F,"batchingColorTexture"),F._colorsTexture!==null&&oe.setValue(C,"batchingColorTexture",F._colorsTexture,Ft));const Oe=z.morphAttributes;if((Oe.position!==void 0||Oe.normal!==void 0||Oe.color!==void 0)&&Q.update(F,z,Ce),(Pe||Tt.receiveShadow!==F.receiveShadow)&&(Tt.receiveShadow=F.receiveShadow,oe.setValue(C,"receiveShadow",F.receiveShadow)),k.isMeshGouraudMaterial&&k.envMap!==null&&(Fe.envMap.value=ht,Fe.flipEnvMap.value=ht.isCubeTexture&&ht.isRenderTargetTexture===!1?-1:1),k.isMeshStandardMaterial&&k.envMap===null&&N.environment!==null&&(Fe.envMapIntensity.value=N.environmentIntensity),Pe&&(oe.setValue(C,"toneMappingExposure",S.toneMappingExposure),Tt.needsLights&&uc(Fe,Ui),j&&k.fog===!0&&K.refreshFogUniforms(Fe,j),K.refreshMaterialUniforms(Fe,k,V,et,f.state.transmissionRenderTarget[x.id]),Os.upload(C,Qa(Tt),Fe,Ft)),k.isShaderMaterial&&k.uniformsNeedUpdate===!0&&(Os.upload(C,Qa(Tt),Fe,Ft),k.uniformsNeedUpdate=!1),k.isSpriteMaterial&&oe.setValue(C,"center",F.center),oe.setValue(C,"modelViewMatrix",F.modelViewMatrix),oe.setValue(C,"normalMatrix",F.normalMatrix),oe.setValue(C,"modelMatrix",F.matrixWorld),k.isShaderMaterial||k.isRawShaderMaterial){const be=k.uniformsGroups;for(let Re=0,Js=be.length;Re<Js;Re++){const Un=be[Re];It.update(Un,Ce),It.bind(Un,Ce)}}return Ce}function uc(x,N){x.ambientLightColor.needsUpdate=N,x.lightProbe.needsUpdate=N,x.directionalLights.needsUpdate=N,x.directionalLightShadows.needsUpdate=N,x.pointLights.needsUpdate=N,x.pointLightShadows.needsUpdate=N,x.spotLights.needsUpdate=N,x.spotLightShadows.needsUpdate=N,x.rectAreaLights.needsUpdate=N,x.hemisphereLights.needsUpdate=N}function dc(x){return x.isMeshLambertMaterial||x.isMeshToonMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isShadowMaterial||x.isShaderMaterial&&x.lights===!0}this.getActiveCubeFace=function(){return A},this.getActiveMipmapLevel=function(){return P},this.getRenderTarget=function(){return U},this.setRenderTargetTextures=function(x,N,z){const k=_t.get(x);k.__autoAllocateDepthBuffer=x.resolveDepthBuffer===!1,k.__autoAllocateDepthBuffer===!1&&(k.__useRenderToTexture=!1),_t.get(x.texture).__webglTexture=N,_t.get(x.depthTexture).__webglTexture=k.__autoAllocateDepthBuffer?void 0:z,k.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(x,N){const z=_t.get(x);z.__webglFramebuffer=N,z.__useDefaultFramebuffer=N===void 0};const fc=C.createFramebuffer();this.setRenderTarget=function(x,N=0,z=0){U=x,A=N,P=z;let k=!0,F=null,j=!1,ot=!1;if(x){const ht=_t.get(x);if(ht.__useDefaultFramebuffer!==void 0)gt.bindFramebuffer(C.FRAMEBUFFER,null),k=!1;else if(ht.__webglFramebuffer===void 0)Ft.setupRenderTarget(x);else if(ht.__hasExternalTextures)Ft.rebindTextures(x,_t.get(x.texture).__webglTexture,_t.get(x.depthTexture).__webglTexture);else if(x.depthBuffer){const bt=x.depthTexture;if(ht.__boundDepthTexture!==bt){if(bt!==null&&_t.has(bt)&&(x.width!==bt.image.width||x.height!==bt.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");Ft.setupDepthRenderbuffer(x)}}const At=x.texture;(At.isData3DTexture||At.isDataArrayTexture||At.isCompressedArrayTexture)&&(ot=!0);const Ct=_t.get(x).__webglFramebuffer;x.isWebGLCubeRenderTarget?(Array.isArray(Ct[N])?F=Ct[N][z]:F=Ct[N],j=!0):x.samples>0&&Ft.useMultisampledRTT(x)===!1?F=_t.get(x).__webglMultisampledFramebuffer:Array.isArray(Ct)?F=Ct[z]:F=Ct,D.copy(x.viewport),w.copy(x.scissor),O=x.scissorTest}else D.copy(Et).multiplyScalar(V).floor(),w.copy(Bt).multiplyScalar(V).floor(),O=Qt;if(z!==0&&(F=fc),gt.bindFramebuffer(C.FRAMEBUFFER,F)&&k&&gt.drawBuffers(x,F),gt.viewport(D),gt.scissor(w),gt.setScissorTest(O),j){const ht=_t.get(x.texture);C.framebufferTexture2D(C.FRAMEBUFFER,C.COLOR_ATTACHMENT0,C.TEXTURE_CUBE_MAP_POSITIVE_X+N,ht.__webglTexture,z)}else if(ot){const ht=N;for(let At=0;At<x.textures.length;At++){const Ct=_t.get(x.textures[At]);C.framebufferTextureLayer(C.FRAMEBUFFER,C.COLOR_ATTACHMENT0+At,Ct.__webglTexture,z,ht)}}else if(x!==null&&z!==0){const ht=_t.get(x.texture);C.framebufferTexture2D(C.FRAMEBUFFER,C.COLOR_ATTACHMENT0,C.TEXTURE_2D,ht.__webglTexture,z)}y=-1},this.readRenderTargetPixels=function(x,N,z,k,F,j,ot,pt=0){if(!(x&&x.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let ht=_t.get(x).__webglFramebuffer;if(x.isWebGLCubeRenderTarget&&ot!==void 0&&(ht=ht[ot]),ht){gt.bindFramebuffer(C.FRAMEBUFFER,ht);try{const At=x.textures[pt],Ct=At.format,bt=At.type;if(!Rt.textureFormatReadable(Ct)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Rt.textureTypeReadable(bt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}N>=0&&N<=x.width-k&&z>=0&&z<=x.height-F&&(x.textures.length>1&&C.readBuffer(C.COLOR_ATTACHMENT0+pt),C.readPixels(N,z,k,F,Mt.convert(Ct),Mt.convert(bt),j))}finally{const At=U!==null?_t.get(U).__webglFramebuffer:null;gt.bindFramebuffer(C.FRAMEBUFFER,At)}}},this.readRenderTargetPixelsAsync=async function(x,N,z,k,F,j,ot,pt=0){if(!(x&&x.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let ht=_t.get(x).__webglFramebuffer;if(x.isWebGLCubeRenderTarget&&ot!==void 0&&(ht=ht[ot]),ht)if(N>=0&&N<=x.width-k&&z>=0&&z<=x.height-F){gt.bindFramebuffer(C.FRAMEBUFFER,ht);const At=x.textures[pt],Ct=At.format,bt=At.type;if(!Rt.textureFormatReadable(Ct))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Rt.textureTypeReadable(bt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const kt=C.createBuffer();C.bindBuffer(C.PIXEL_PACK_BUFFER,kt),C.bufferData(C.PIXEL_PACK_BUFFER,j.byteLength,C.STREAM_READ),x.textures.length>1&&C.readBuffer(C.COLOR_ATTACHMENT0+pt),C.readPixels(N,z,k,F,Mt.convert(Ct),Mt.convert(bt),0);const $t=U!==null?_t.get(U).__webglFramebuffer:null;gt.bindFramebuffer(C.FRAMEBUFFER,$t);const le=C.fenceSync(C.SYNC_GPU_COMMANDS_COMPLETE,0);return C.flush(),await xh(C,le,4),C.bindBuffer(C.PIXEL_PACK_BUFFER,kt),C.getBufferSubData(C.PIXEL_PACK_BUFFER,0,j),C.deleteBuffer(kt),C.deleteSync(le),j}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(x,N=null,z=0){const k=Math.pow(2,-z),F=Math.floor(x.image.width*k),j=Math.floor(x.image.height*k),ot=N!==null?N.x:0,pt=N!==null?N.y:0;Ft.setTexture2D(x,0),C.copyTexSubImage2D(C.TEXTURE_2D,z,0,0,ot,pt,F,j),gt.unbindTexture()};const pc=C.createFramebuffer(),mc=C.createFramebuffer();this.copyTextureToTexture=function(x,N,z=null,k=null,F=0,j=null){j===null&&(F!==0?(Qi("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),j=F,F=0):j=0);let ot,pt,ht,At,Ct,bt,kt,$t,le;const ee=x.isCompressedTexture?x.mipmaps[j]:x.image;if(z!==null)ot=z.max.x-z.min.x,pt=z.max.y-z.min.y,ht=z.isBox3?z.max.z-z.min.z:1,At=z.min.x,Ct=z.min.y,bt=z.isBox3?z.min.z:0;else{const Oe=Math.pow(2,-F);ot=Math.floor(ee.width*Oe),pt=Math.floor(ee.height*Oe),x.isDataArrayTexture?ht=ee.depth:x.isData3DTexture?ht=Math.floor(ee.depth*Oe):ht=1,At=0,Ct=0,bt=0}k!==null?(kt=k.x,$t=k.y,le=k.z):(kt=0,$t=0,le=0);const jt=Mt.convert(N.format),Tt=Mt.convert(N.type);let ae;N.isData3DTexture?(Ft.setTexture3D(N,0),ae=C.TEXTURE_3D):N.isDataArrayTexture||N.isCompressedArrayTexture?(Ft.setTexture2DArray(N,0),ae=C.TEXTURE_2D_ARRAY):(Ft.setTexture2D(N,0),ae=C.TEXTURE_2D),C.pixelStorei(C.UNPACK_FLIP_Y_WEBGL,N.flipY),C.pixelStorei(C.UNPACK_PREMULTIPLY_ALPHA_WEBGL,N.premultiplyAlpha),C.pixelStorei(C.UNPACK_ALIGNMENT,N.unpackAlignment);const Gt=C.getParameter(C.UNPACK_ROW_LENGTH),Ce=C.getParameter(C.UNPACK_IMAGE_HEIGHT),ti=C.getParameter(C.UNPACK_SKIP_PIXELS),Pe=C.getParameter(C.UNPACK_SKIP_ROWS),Ui=C.getParameter(C.UNPACK_SKIP_IMAGES);C.pixelStorei(C.UNPACK_ROW_LENGTH,ee.width),C.pixelStorei(C.UNPACK_IMAGE_HEIGHT,ee.height),C.pixelStorei(C.UNPACK_SKIP_PIXELS,At),C.pixelStorei(C.UNPACK_SKIP_ROWS,Ct),C.pixelStorei(C.UNPACK_SKIP_IMAGES,bt);const oe=x.isDataArrayTexture||x.isData3DTexture,Fe=N.isDataArrayTexture||N.isData3DTexture;if(x.isDepthTexture){const Oe=_t.get(x),be=_t.get(N),Re=_t.get(Oe.__renderTarget),Js=_t.get(be.__renderTarget);gt.bindFramebuffer(C.READ_FRAMEBUFFER,Re.__webglFramebuffer),gt.bindFramebuffer(C.DRAW_FRAMEBUFFER,Js.__webglFramebuffer);for(let Un=0;Un<ht;Un++)oe&&(C.framebufferTextureLayer(C.READ_FRAMEBUFFER,C.COLOR_ATTACHMENT0,_t.get(x).__webglTexture,F,bt+Un),C.framebufferTextureLayer(C.DRAW_FRAMEBUFFER,C.COLOR_ATTACHMENT0,_t.get(N).__webglTexture,j,le+Un)),C.blitFramebuffer(At,Ct,ot,pt,kt,$t,ot,pt,C.DEPTH_BUFFER_BIT,C.NEAREST);gt.bindFramebuffer(C.READ_FRAMEBUFFER,null),gt.bindFramebuffer(C.DRAW_FRAMEBUFFER,null)}else if(F!==0||x.isRenderTargetTexture||_t.has(x)){const Oe=_t.get(x),be=_t.get(N);gt.bindFramebuffer(C.READ_FRAMEBUFFER,pc),gt.bindFramebuffer(C.DRAW_FRAMEBUFFER,mc);for(let Re=0;Re<ht;Re++)oe?C.framebufferTextureLayer(C.READ_FRAMEBUFFER,C.COLOR_ATTACHMENT0,Oe.__webglTexture,F,bt+Re):C.framebufferTexture2D(C.READ_FRAMEBUFFER,C.COLOR_ATTACHMENT0,C.TEXTURE_2D,Oe.__webglTexture,F),Fe?C.framebufferTextureLayer(C.DRAW_FRAMEBUFFER,C.COLOR_ATTACHMENT0,be.__webglTexture,j,le+Re):C.framebufferTexture2D(C.DRAW_FRAMEBUFFER,C.COLOR_ATTACHMENT0,C.TEXTURE_2D,be.__webglTexture,j),F!==0?C.blitFramebuffer(At,Ct,ot,pt,kt,$t,ot,pt,C.COLOR_BUFFER_BIT,C.NEAREST):Fe?C.copyTexSubImage3D(ae,j,kt,$t,le+Re,At,Ct,ot,pt):C.copyTexSubImage2D(ae,j,kt,$t,At,Ct,ot,pt);gt.bindFramebuffer(C.READ_FRAMEBUFFER,null),gt.bindFramebuffer(C.DRAW_FRAMEBUFFER,null)}else Fe?x.isDataTexture||x.isData3DTexture?C.texSubImage3D(ae,j,kt,$t,le,ot,pt,ht,jt,Tt,ee.data):N.isCompressedArrayTexture?C.compressedTexSubImage3D(ae,j,kt,$t,le,ot,pt,ht,jt,ee.data):C.texSubImage3D(ae,j,kt,$t,le,ot,pt,ht,jt,Tt,ee):x.isDataTexture?C.texSubImage2D(C.TEXTURE_2D,j,kt,$t,ot,pt,jt,Tt,ee.data):x.isCompressedTexture?C.compressedTexSubImage2D(C.TEXTURE_2D,j,kt,$t,ee.width,ee.height,jt,ee.data):C.texSubImage2D(C.TEXTURE_2D,j,kt,$t,ot,pt,jt,Tt,ee);C.pixelStorei(C.UNPACK_ROW_LENGTH,Gt),C.pixelStorei(C.UNPACK_IMAGE_HEIGHT,Ce),C.pixelStorei(C.UNPACK_SKIP_PIXELS,ti),C.pixelStorei(C.UNPACK_SKIP_ROWS,Pe),C.pixelStorei(C.UNPACK_SKIP_IMAGES,Ui),j===0&&N.generateMipmaps&&C.generateMipmap(ae),gt.unbindTexture()},this.initRenderTarget=function(x){_t.get(x).__webglFramebuffer===void 0&&Ft.setupRenderTarget(x)},this.initTexture=function(x){x.isCubeTexture?Ft.setTextureCube(x,0):x.isData3DTexture?Ft.setTexture3D(x,0):x.isDataArrayTexture||x.isCompressedArrayTexture?Ft.setTexture2DArray(x,0):Ft.setTexture2D(x,0),gt.unbindTexture()},this.resetState=function(){A=0,P=0,U=null,gt.reset(),at.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return tn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorSpace=Wt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Wt._getUnpackColorSpace()}}function s0(s,t=!1){const e=s[0].index!==null,n=new Set(Object.keys(s[0].attributes)),i=new Set(Object.keys(s[0].morphAttributes)),r={},a={},o=s[0].morphTargetsRelative,c=new xe;let l=0;for(let h=0;h<s.length;++h){const u=s[h];let d=0;if(e!==(u.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(const p in u.attributes){if(!n.has(p))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+p+'" attribute exists among all geometries, or in none of them.'),null;r[p]===void 0&&(r[p]=[]),r[p].push(u.attributes[p]),d++}if(d!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(o!==u.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(const p in u.morphAttributes){if(!i.has(p))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;a[p]===void 0&&(a[p]=[]),a[p].push(u.morphAttributes[p])}if(t){let p;if(e)p=u.index.count;else if(u.attributes.position!==void 0)p=u.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;c.addGroup(l,p,h),l+=p}}if(e){let h=0;const u=[];for(let d=0;d<s.length;++d){const p=s[d].index;for(let g=0;g<p.count;++g)u.push(p.getX(g)+h);h+=s[d].attributes.position.count}c.setIndex(u)}for(const h in r){const u=gl(r[h]);if(!u)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;c.setAttribute(h,u)}for(const h in a){const u=a[h][0].length;if(u===0)break;c.morphAttributes=c.morphAttributes||{},c.morphAttributes[h]=[];for(let d=0;d<u;++d){const p=[];for(let _=0;_<a[h].length;++_)p.push(a[h][_][d]);const g=gl(p);if(!g)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;c.morphAttributes[h].push(g)}}return c}function gl(s){let t,e,n,i=-1,r=0;for(let l=0;l<s.length;++l){const h=s[l];if(t===void 0&&(t=h.array.constructor),t!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(e===void 0&&(e=h.itemSize),e!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=h.normalized),n!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(i===-1&&(i=h.gpuType),i!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=h.count*e}const a=new t(r),o=new Ne(a,e,n);let c=0;for(let l=0;l<s.length;++l){const h=s[l];if(h.isInterleavedBufferAttribute){const u=c/e;for(let d=0,p=h.count;d<p;d++)for(let g=0;g<e;g++){const _=h.getComponent(d,g);o.setComponent(d+u,g,_)}}else a.set(h.array,c);c+=h.count*e}return i!==void 0&&(o.gpuType=i),o}const Wn=512,_l=Wn/2,vl=466,xl=3,r0=128,a0=2.2,o0=2.1,Ds=(s,t,e)=>Math.max(t,Math.min(e,s));function l0(s,t="default"){const e=new _e;e.name="Haru-shared-village-art",e.userData.appearance={gender:s,outfit:t,source:"shared-village-survivor"};const n=document.createElement("canvas");n.width=n.height=Wn;const i=n.getContext("2d");if(!i)throw new Error("주인공 그림을 준비하지 못했어요.");const r=new Fs(n);r.colorSpace=Ee,r.generateMipmaps=!1,r.minFilter=r.magFilter=qe;const a=new Vs({map:r,transparent:!0,alphaTest:.025,depthTest:!0,depthWrite:!1,toneMapped:!1}),o=new wa(a);o.center.set(_l/Wn,1-vl/Wn),o.scale.setScalar(a0*Wn/(r0*xl)),o.visible=!1,e.add(o);let c="back",l=1,h=!1,u=!1,d=-1/0,p="",g=0,_=performance.now();return{root:e,update:f=>{if(u)return;const b=performance.now(),E=Ds((b-_)/1e3,0,.1);_=b;const S=f.aimHeading??f.heading,R=Math.cos(S-(f.cameraHeading??Math.PI));R>.18?c="front":R<-.18&&(c="back"),f.screenFacing&&(l=f.screenFacing);const A=Math.max(0,f.reload??0),P=Ds(f.firing??0,0,1),U=Ds((f.dodge??0)/.28,0,1);g=(f.dead??0)>0?Math.min(1,g+E/.45):0,a.rotation=-g*1.3,a.color.set((f.hurt??0)>.05?"#ffb8aa":"#ffffff");const M=Ds(f.aimPitch??-.1,-.65,.5),D=f.moving||A>0||P>.01||U>0,w=`${c}:${l}:${D}:${A>0}:${M.toFixed(2)}`;if(h&&w===p&&(!D||f.time-d<1/30))return;i.clearRect(0,0,Wn,Wn);const O=_c(i,{x:_l,y:vl,scale:xl,time:f.time,gender:s,outfit:t,facing:l,view:c,moving:f.moving,walkDistance:f.walkDistance/o0*vc(1),recoil:P,reloadRemaining:A,dodge:U,aimPitch:M});h=O.imageReady,o.visible=h,e.userData.heroArt={gender:s,outfit:t,frame:O.frame,imageReady:h},h&&(r.needsUpdate=!0,d=f.time,p=w)},dispose(){u||(u=!0,r.dispose(),a.dispose(),e.clear())}}}const cc=Math.PI*2,un=(s,t=0,e=1)=>Math.max(t,Math.min(e,s)),Vt=(s=0,t=0,e=0)=>new L(s,t,e),c0=Vt(0,1,0),Ml=Vt(0,-1,0),h0=Vt(),u0=Vt(),d0=Vt(),f0=Vt(),yl=Vt(),p0=new Di,m0=Vt(),g0=Vt(),_0=Vt(),v0=Vt();class $a{root=new _e;geometries=new Set;materials=new Set;shapes=new Map;pigments=new Map;constructor(t){this.root.name=t}material(t,e=.8,n=0){const i=`${t}:${e}:${n}`;let r=this.pigments.get(i);return r||(r=new Vn({color:t,roughness:e,metalness:n}),this.pigments.set(i,r),this.materials.add(r)),r}shape(t){let e=this.shapes.get(t);if(!e){if(e=t==="sphere"?new wn(1,18,12):t==="box"?new Ln(1,1,1,1,1,1):t==="rounded-box"?new Ln(1,1,1,5,5,5):t==="cylinder"?new Kn(1,1,1,12,1):t==="capsule"?new Ga(.5,1,4,10):new Wa(1,1,3,1),t==="rounded-box"){const n=e.getAttribute("position"),i=e.getAttribute("normal"),r=Vt(),a=Vt();for(let o=0;o<n.count;o++)r.fromBufferAttribute(n,o),a.set(un(r.x,-.34,.34),un(r.y,-.34,.34),un(r.z,-.34,.34)),r.sub(a).normalize(),i.setXYZ(o,r.x,r.y,r.z),r.multiplyScalar(.16).add(a),n.setXYZ(o,r.x,r.y,r.z)}this.geometries.add(e),this.shapes.set(t,e)}return e}mesh(t,e,n,i,r,a){const o=new Xt(this.shape(e),typeof n=="string"?this.material(n):n);return o.position.set(...i),o.scale.set(...r),a&&o.rotation.set(...a),o.castShadow=!0,o.receiveShadow=!0,t.add(o),o}group(t,e=[0,0,0]){const n=new _e;return n.position.set(...e),t.add(n),n}ellipsoid(t,e,n,i){return this.mesh(t,"sphere",e,n,i)}box(t,e,n,i,r){return this.mesh(t,"box",e,n,i,r)}softBox(t,e,n,i,r){return this.mesh(t,"rounded-box",e,n,i,r)}strand(t,e,n,i=.009){const r=new qs(new Ya(n),10,i,5,!1);this.geometries.add(r);const a=new Xt(r,this.material(e));return a.castShadow=!0,t.add(a),a}bake(t){const e=new Map;for(const n of[...t.children])if(n instanceof Xt&&!n.userData.dynamicActor&&!Array.isArray(n.material)){const i=e.get(n.material)??[];i.push(n),e.set(n.material,i)}for(const[n,i]of e){if(i.length<2)continue;const r=i.map(c=>(c.updateMatrix(),c.geometry.clone().applyMatrix4(c.matrix))),a=s0(r,!1);if(r.forEach(c=>c.dispose()),!a)continue;this.geometries.add(a),i.forEach(c=>t.remove(c));const o=new Xt(a,n);o.castShadow=o.receiveShadow=!0,t.add(o)}}dispose(){this.geometries.forEach(t=>t.dispose()),this.materials.forEach(t=>t.dispose()),this.root.clear()}}function Sl(s,t,e,n,i,r=.4,a=.94,o=1){const c=r/.4,l=s.group(t,[e*.145*o,a,0]),h=s.group(l,[0,-r,0]),u=s.group(h,[0,-r,0]);s.mesh(l,"capsule",n,[0,-.19*c,0],[.19*o,.24*c,.21*o]),s.ellipsoid(h,n,[0,.005,-.018],[.105,.104,.12]),s.mesh(h,"capsule",n,[0,-.16*c,0],[.165*o,.21*c,.185*o]),s.box(l,"#72794c",[e*.091,-.18,.002],[.05,.17,.14]),s.box(l,"#9b9b65",[e*.12,-.125,.002],[.015,.024,.14]),s.box(h,"#4b563b",[0,.002,-.109],[.14,.13,.025]),s.ellipsoid(u,i,[0,-.09,-.065],[.115,.13,.21]),s.box(u,"#3e352b",[0,-.175,-.065],[.23,.045,.37]),s.mesh(u,"cylinder",i,[0,-.006,.01],[.094,.16,.095]);for(let d=0;d<3;d++)s.box(u,"#c8b294",[0,-.044-d*.025,-.2+d*.012],[.105,.012,.014]);return s.bake(l),s.bake(h),s.bake(u),{hip:l,knee:h,ankle:u,length:r,x:e*.145*o}}function x0(s,t,e,n,i,r=.105,a=0,o=t){const c=n?Math.cos(e)*i:0,l=.2+(n?Math.max(0,Math.sin(e))*r:0),h=h0.set(-c*Math.sin(a),l-t,c*Math.cos(a)),u=Math.min(s.length*1.98,h.length()),d=u0.copy(h).normalize(),p=d0.set(0,0,-1).addScaledVector(d,d.z).normalize(),g=f0.copy(d).multiplyScalar(u/2).addScaledVector(p,Math.sqrt(Math.max(0,s.length*s.length-u*u/4)));s.hip.position.y=o,s.hip.quaternion.setFromUnitVectors(Ml,yl.copy(g).normalize());const _=yl.copy(h).sub(g).applyQuaternion(p0.copy(s.hip.quaternion).invert()).normalize();s.knee.quaternion.setFromUnitVectors(Ml,_),s.ankle.quaternion.copy(s.hip.quaternion).multiply(s.knee.quaternion).invert()}function El(s,t,e,n,i){const r=Vt(e*.285,.445,0);s.ellipsoid(t,n,[r.x,r.y-.015,r.z],[.125,.115,.13]);const a=s.mesh(t,"capsule",n,[0,0,0],[.19,.13,.19]),o=s.mesh(t,"capsule",i,[0,0,0],[.13,.13,.13]),c=s.ellipsoid(t,i,[0,0,0],[.075,.075,.075]);a.userData.dynamicActor=o.userData.dynamicActor=c.userData.dynamicActor=!0;const l=s.group(t);s.ellipsoid(l,"#584a35",[0,0,0],[.076,.065,.083]);for(let h=0;h<3;h++)s.mesh(l,"capsule","#8b7152",[h*.025-.025,-.027,-.051],[.021,.025,.025],[Math.PI/2,0,0]);return s.ellipsoid(l,i,[e*-.055,.005,-.013],[.026,.05,.025]),s.bake(l),{upper:a,fore:o,elbow:c,hand:l,shoulder:r,pole:Vt(e*.55,-.3,-.06)}}const Br=Vt(),bl=Vt();function Tl(s,t,e,n){Br.subVectors(e,t);const i=Br.length();bl.addVectors(t,e).multiplyScalar(.5),s.position.copy(bl),s.quaternion.setFromUnitVectors(c0,Br.normalize()),s.scale.set(n,i/2,n)}function M0(s,t,e=!1){const n=m0.copy(t).sub(s.shoulder),i=un(n.length(),.08,.635);n.normalize(),t=v0.copy(s.shoulder).addScaledVector(n,i);const r=.32,a=.33,o=(r*r-a*a+i*i)/(2*i),c=g0.copy(s.pole);c.addScaledVector(n,-c.dot(n)).normalize();const l=_0.copy(s.shoulder).addScaledVector(n,o).addScaledVector(c,Math.sqrt(Math.max(0,r*r-o*o)));Tl(s.upper,s.shoulder,l,.17),Tl(s.fore,l,t,.13),s.elbow.position.copy(l),s.hand.position.copy(t),s.hand.rotation.set(e?.3:-.3,0,e?.3:0)}function y0(s,t,e,n,i,r=!1){const a=s.group(t,[0,.85,-.015]);r||a.scale.setScalar(1.17),s.ellipsoid(a,e,[0,0,0],[.255,.3,.235]);for(const o of[-1,1])s.ellipsoid(a,e,[o*.247,-.005,-.005],[.052,.08,.048]),s.ellipsoid(a,r?"#c9b88c":"#fff9e8",[o*.104,.012,-.213],[.068,.071,.023]),s.ellipsoid(a,r?"#453e24":"#47382d",[o*.107,.011,-.234],[.039,.051,.014]),s.ellipsoid(a,"#fffbe9",[o*.104-.011,.032,-.247],[.009,.012,.006]),s.box(a,n,[o*.106,.097,-.211],[.115,.02,.028],[0,0,o*-.09]),r||s.ellipsoid(a,"#cb957c",[o*.16,-.075,-.188],[.045,.018,.01]);if(s.ellipsoid(a,e,[0,-.055,-.236],[.04,.047,.045]),s.box(a,r?"#584c3a":"#8f6652",[0,-.142,-.208],[.068,.012,.009]),r){s.ellipsoid(a,n,[0,.142,.04],[.272,.205,.25]);for(let o=0;o<7;o++){const c=(o/6-.5)*2.6;s.ellipsoid(a,o%2?n:"#5c5b45",[Math.sin(c)*.22,.18+.045*Math.cos(c),-.1-Math.cos(c)*.11],[.07,.12,.085])}}else{s.ellipsoid(a,n,[0,.12,.07],[.279,.225,.25]),s.ellipsoid(a,n,[0,-.025,.15],[.25,.22,.12]);for(const[o,c,l]of[[-.13,.16,-.48],[.025,.2,-.28],[.17,.12,.45]]){const h=s.ellipsoid(a,n,[o,c,-.15],[.13,.15,.105]);h.rotation.z=l}for(const o of[-1,1])s.ellipsoid(a,n,[o*.225,-.025,-.06],[.045,.145,.07]).rotation.z=o*-.15,s.strand(a,"#60442f",[Vt(o*.05,.325,.11),Vt(o*.16,.23,.25),Vt(o*.2,.07,.26),Vt(o*.15,-.1,.23)],.007)}return s.bake(a),a}function S0(s){const t=new $a(`infected-${s}`),e=t.root,n=t.group(e),i=s==="armored",r=s==="runner",a=i?1.05:r?.93:.96;n.scale.setScalar(a);const o=i?"#79654b":r?"#59624a":"#73745a",c=t.material(i?"#a29c72":"#9ba17c");t.ellipsoid(n,o,[0,.94,0],[.25,.15,.18]);const l=[Sl(t,n,-1,r?"#565b47":"#64664d","#514b3b"),Sl(t,n,1,r?"#565b47":"#64664d","#514b3b")],h=t.group(n,[0,1.03,0]);t.ellipsoid(h,o,[0,.27,0],[.29,.32,.19]),t.box(h,i?"#9e783f":"#8d8060",[0,.24,-.15],[.43,.45,.09]);for(const _ of[-1,1])t.box(h,"#c4b56b",[_*.16,.27,-.205],[.035,.38,.024]),t.box(h,"#565c45",[_*.13,.13,-.22],[.14,.12,.025]);if(i){t.box(h,"#454d3f",[0,.27,-.22],[.36,.4,.07]);for(let _=0;_<3;_++)t.box(h,"#a69565",[0,.16+_*.11,-.263],[.35,.017,.014])}t.mesh(h,"cylinder",c,[0,.57,0],[.085,.16,.085]);const u=y0(t,h,i?"#a29c72":"#9ba17c","#4e5541",!1,!0);i&&(t.ellipsoid(u,"#b28a40",[0,.18,.012],[.285,.16,.26]),t.mesh(u,"cylinder","#8a713d",[0,.11,-.025],[.31,.032,.29]),t.box(u,"#ceaf60",[0,.31,.005],[.08,.022,.31]),t.bake(u));const d=[El(t,h,-1,o,"#9ba17c"),El(t,h,1,o,"#9ba17c")];t.bake(n),t.bake(h);const p=Vt();let g=!1;return{root:e,update(_){e.rotation.y=-_.heading;const m=_.walkDistance*cc/(r?1.05:.8),f=_.dead===void 0?0:un(_.dead/.55);n.rotation.x=-f*1.43,n.position.y=f*.18,n.scale.y=a*(1-f*.08),h.rotation.x=(r?-.2:-.13)-un(_.firing??0)*.28+un(_.hurt??0)*.28,h.rotation.z=_.moving?Math.sin(m)*(r?.045:.06):0,u.rotation.z=r?-.035:Math.sin(_.time*.7)*.035;for(let b=0;b<l.length;b++)x0(l[b],.94,m+Math.PI*b,_.moving&&!f,r?.26:.17,r?.11:.07);for(let b=0;b<2;b++){const E=b===0?-1:1,S=_.moving?Math.sin(m+b*Math.PI):0,R=p.set(E*(.27+.06*Math.cos(_.time*.8)),.16+S*.12,-.42-un(_.firing??0)*.15);M0(d[b],R,!0)}c.emissive.setHex((_.hurt??0)>.07?6958870:0)},dispose(){g||(g=!0,t.dispose())}}}function E0(s,t,e,n,i,r,a){const o=s.group(t,[e,0,n]),c=s.group(o,[0,-i,0]),l=s.group(c,[0,-i,0]);return s.mesh(o,"capsule",r,[0,-i*.48,0],[.105,i*.52,.11]),s.mesh(c,"capsule",a,[0,-i*.4,0],[.085,i*.5,.09]),s.ellipsoid(l,a,[0,-.005,-.035],[.075,.045,.11]),{hip:o,knee:c,paw:l,length:i,side:e<0?-1:1,front:n<0}}function b0(s,t,e,n,i,r){const a=n?Math.cos(e)*i:0,c=.05+(n?Math.max(0,Math.sin(e))*r:0)-t,l=Math.min(s.length*1.99,Math.hypot(c,a)),h=Math.acos(un(l/(2*s.length),-1,1));s.hip.rotation.x=Math.atan2(-a,-c)+h,s.knee.rotation.x=-h*2,s.paw.rotation.x=-(s.hip.rotation.x+s.knee.rotation.x)}function T0(s,t,e,n,i,r=.038){for(const a of[-1,1])s.ellipsoid(t,s.material("#261f17",.19),[a*e,n,i],[r,r*1.15,r*.55]),s.ellipsoid(t,"#fff6d6",[a*e-r*.22,n+r*.35,i-r*.48],[r*.22,r*.22,r*.18])}function A0(s,t,e,n,i){const r=s.group(t,[0,.12,.39]),a=n?[Vt(0,0,0),Vt(.08,.2,.08),Vt(.12,.43,.05),Vt(.03,.55,.04)]:i?[Vt(0,0,0),Vt(.06,.12,.19),Vt(.12,.23,.38),Vt(.12,.25,.49)]:[Vt(0,0,0),Vt(.09,.24,.14),Vt(.05,.37,.05),Vt(-.07,.3,-.02)],o=new qs(new Ya(a),12,i?.13:n?.035:.08,8,!1);s.geometries.add(o);const c=new Xt(o,s.material(e));return c.castShadow=!0,r.add(c),i&&s.ellipsoid(r,"#e7dbb6",[.12,.25,.46],[.1,.09,.14]),r}function w0(s){if(s==="owl")return R0();const t=new $a(`support-${s}`),e=t.root,n=s==="cat",i=s==="fox",r=s==="rabbit",a=s==="boar",o=s==="monkey",c=s==="elephant",l=s==="giraffe",h=s==="panda",u=s==="deer",d=c||l,p=c?"#a79c89":l?"#c6a461":h?"#d9d8c0":n?"#9c8667":i?"#b4723e":a?"#736047":o?"#826749":u?"#bc8f60":"#b68a52",g=n?"#e1d5b5":c?"#a29687":"#dfcfac",_=l?.35:c?.26:r?.13:u?.21:.15,m=_*1.76+.05,f=t.group(e,[0,m,0]),b=c?.39:l?.28:h?.3:n?.18:.22,E=c?.58:l?.48:n?.34:a?.42:.38;t.ellipsoid(f,p,[0,.08,.015],[b,c?.4:.23,E]),h&&t.ellipsoid(f,"#34372c",[0,.07,-.2],[.295,.25,.13]),!d&&!a&&!h&&t.ellipsoid(f,g,[0,-.06,-.08],[b*.83,.12,E*.78]);const S=[];for(const w of[-1,1])for(const O of[-1,1]){const H=h?"#34372c":d?"#857c66":g;S.push(E0(t,f,w*b*.65,O*E*.64,_,p,H))}const R=t.group(f,[0,.17,-E*.68]);if(l){t.mesh(R,"capsule",p,[0,.38,-.04],[.2,.43,.22],[-.15,0,0]);for(let w=0;w<6;w++)for(const O of[-1,1])t.ellipsoid(R,"#856742",[O*.09,.03+w*.12,-.035+Math.sin(w*2)*.02],[.019,.043,.048])}const A=t.group(R,[0,l?.83:c?.08:.1,c?-.08:-.04]),P=c?.28:h?.24:r?.17:.19;t.ellipsoid(A,p,[0,0,0],[P,c?.29:.2,c?.25:.2]),t.ellipsoid(A,g,[0,-.075,-.155],[n?.12:.145,.086,c?.13:.12]),c||t.ellipsoid(A,"#3b3027",[0,-.055,-.263],[n?.029:.043,.027,.027]),T0(t,A,P*.57,.018,h?-.214:-.174,c?.047:.036);const U=[];for(const w of[-1,1]){const O=t.group(A,[w*P*.82,.12,.02]);if(U.push(O),c?(t.ellipsoid(O,"#a4988a",[w*.14,-.045,0],[.23,.3,.066]),t.ellipsoid(O,"#b9a397",[w*.15,-.045,-.045],[.18,.23,.021])):r?(t.ellipsoid(O,p,[w*.025,.19,0],[.068,.27,.055]).rotation.z=w*-.12,t.ellipsoid(O,"#b79580",[w*.024,.19,-.045],[.033,.2,.015]).rotation.z=w*-.12):h||o||a?(t.ellipsoid(O,h?"#34372c":p,[w*.025,.035,.005],[.1,.1,.07]),t.ellipsoid(O,"#b59d81",[w*.025,.035,-.05],[.058,.06,.015])):(t.mesh(O,"cone",p,[0,.065,0],[.095,.22,.085],[-.08,0,w*-.22]),t.mesh(O,"cone","#cdb393",[0,.052,-.052],[.052,.13,.018],[-.08,0,w*-.22])),h&&t.ellipsoid(A,"#37392e",[w*.13,.012,-.158],[.075,.092,.04]),l||u){const H=t.group(A,[w*.095,.18,.015]);if(t.mesh(H,"cylinder","#7e6d47",[0,.12,0],[.023,.25,.023],[0,0,w*-.18]),l)t.ellipsoid(H,"#66563d",[w*.02,.25,0],[.04,.04,.04]);else for(let G=0;G<2;G++)t.mesh(H,"cylinder","#927e54",[w*.05,.13+G*.06,-.025],[.015,.11,.015],[.4,0,w*-.8])}}if(a){t.ellipsoid(A,"#a68c70",[0,-.08,-.265],[.1,.07,.057]);for(const w of[-1,1])t.ellipsoid(A,"#554839",[w*.04,-.08,-.316],[.017,.022,.009]),t.mesh(A,"cone","#e7d7ad",[w*.13,-.08,-.24],[.025,.12,.025],[0,0,w*-.4])}const y=c?t.group(A,[0,-.12,-.22]):null;if(y){for(let w=0;w<4;w++)t.ellipsoid(y,p,[0,-.1-w*.1,-.025-w*.02],[.09-w*.01,.105,.09-w*.01]);for(const w of[-1,1])t.mesh(A,"cone","#ded0aa",[w*.17,-.18,-.27],[.033,.22,.033],[-Math.PI/2+.25,0,w*.12]);t.bake(y)}let M;if(r?(M=t.group(f,[0,.07,E]),t.ellipsoid(M,g,[0,0,0],[.11,.11,.11])):c||l||u||a?(M=t.group(f,[0,.12,E]),t.mesh(M,"capsule",p,[0,-.08,.04],[.04,.13,.04],[.3,0,0]),t.ellipsoid(M,"#6e614a",[0,-.22,.08],[.055,.08,.05])):M=A0(t,f,p,n||o,i),n)for(let w=0;w<3;w++){t.box(f,"#6b6049",[0,.29,-.1+w*.12],[.26,.014,.025]);for(const O of[-1,1])t.box(A,"#6b6049",[O*.12,.1-w*.06,-.15],[.06,.017,.03],[0,0,O*.3])}if(l)for(let w=0;w<5;w++)for(const O of[-1,1])t.ellipsoid(f,"#856742",[O*b*.93,.11,-.24+w*.12],[.022,.09,.07]);if(s==="dog")for(const w of[-1,1])t.box(f,"#6c784c",[w*.225,.05,.03],[.11,.23,.29]),t.box(f,"#ad9a63",[w*.285,.07,.03],[.013,.035,.21]);t.mesh(R,"cylinder","#69794c",[0,-.055,.01],[P*.9,.065,P*.87]),t.ellipsoid(R,"#c1a46c",[0,-.09,-.16],[.025,.035,.015]),t.bake(f),t.bake(R),t.bake(A),U.forEach(w=>t.bake(w));let D=!1;return{root:e,update(w){e.rotation.y=-w.heading;const O=w.walkDistance*cc/(d?1.35:r?.68:.83),H=r&&w.moving?Math.max(0,Math.sin(O))*.1:0;f.position.y=m+H,f.rotation.x=w.moving?Math.sin(O*2)*(d?.008:.014):0;for(const G of S){const W=r?G.front?.55:0:d?(G.front?.5:0)*Math.PI+(G.side<0?Math.PI:0):G.front!==G.side<0?Math.PI:0;b0(G,m+H,O+W,w.moving,d?.16:r?.14:.13,d?.065:r?.08:.075)}M.rotation.y=w.moving?Math.sin(O*.7)*(d?.08:.17):0,A.rotation.y=w.moving?Math.sin(O)*.015:Math.sin(w.time*.55)*.035,y&&(y.rotation.x=w.moving?Math.sin(O)*.09:0),c&&U.forEach((G,W)=>{G.rotation.y=Math.sin(w.time*.7)*.05*(W?1:-1)})},dispose(){D||(D=!0,t.dispose())}}}function R0(){const s=new $a("support-owl"),t=s.root,e=s.group(t,[0,.3,0]);s.ellipsoid(e,"#877655",[0,.08,0],[.24,.3,.2]),s.ellipsoid(e,"#d2c19a",[0,.17,-.14],[.2,.2,.085]);for(const r of[-1,1]){s.ellipsoid(e,"#e8dcb6",[r*.09,.2,-.2],[.09,.1,.024]),s.ellipsoid(e,"#30291c",[r*.09,.2,-.223],[.047,.06,.014]),s.ellipsoid(e,"#fff5cc",[r*.09-.015,.22,-.236],[.011,.014,.005]),s.mesh(e,"cone","#8c7150",[r*.16,.37,0],[.07,.15,.07],[0,0,r*-.2]);for(let a=0;a<3;a++)s.mesh(e,"capsule","#aa8a4e",[r*.105+(a-1)*.023,-.255,-.08],[.016,.05,.018],[Math.PI/2,0,0])}s.mesh(e,"cone","#b99853",[0,.12,-.24],[.037,.08,.033],[-Math.PI/2,0,0]);const n=[-1,1].map(r=>{const a=s.group(e,[r*.19,.09,0]);return s.ellipsoid(a,"#766747",[r*.075,-.02,.02],[.1,.25,.14]),s.bake(a),a});s.bake(e),s.bake(t);let i=!1;return{root:t,update(r){t.rotation.y=-r.heading,e.position.y=r.moving?.47:.3,e.rotation.x=r.moving?-.12:0,n.forEach((a,o)=>{a.rotation.z=r.moving?(o?-1:1)*(.65+Math.sin(r.walkDistance*8)*.25):0})},dispose(){i||(i=!0,s.dispose())}}}const C0=new L(0,1,0),yi=(s,t,e)=>Math.max(t,Math.min(e,s));function P0(s){return()=>(s=Math.imul(s,1664525)+1013904223>>>0,s/4294967296)}class D0{constructor(t,e){this.canvas=t,this.options=e,this.renderer=new i0({canvas:t,alpha:!1,antialias:!0,powerPreference:"high-performance"}),this.renderer.outputColorSpace=Ee,this.renderer.toneMapping=Dl,this.renderer.toneMappingExposure=1.16,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=Cl,this.scene.fog=new Ha(e.stage===2?12896692:14138262,.0105),this.scene.add(this.staticWorld,this.actors,this.effects),this.scene.add(new mu(16773070,6647900,2.35));const n=new Vo(11913683,1.15);n.position.set(8,12,-16),this.scene.add(n),this.sun=new Vo(16766112,3.2),this.sun.position.set(-18,24,8),this.sun.castShadow=!0,this.sun.shadow.mapSize.set(1024,1024);const i=this.sun.shadow.camera;i.left=-25,i.right=25,i.top=43,i.bottom=-15,i.near=1,i.far=90,this.sun.shadow.bias=-25e-5,this.sun.shadow.normalBias=.035,this.sun.shadow.radius=3,this.scene.add(this.sun,this.sun.target),this.contactTexture=this.makeContactTexture(),this.hero=l0(e.gender,e.outfit),this.actors.add(this.hero.root),this.heroContact=this.contactShadow(1.45,.72,.28),this.actors.add(this.heroContact),this.buildSky(),this.camera.position.set(7,9,15),this.camera.lookAt(0,1,-7),this.canvas.addEventListener("webglcontextlost",this.onContextLost,!1),this.canvas.addEventListener("webglcontextrestored",this.onContextRestored,!1)}scene=new Wh;camera=new ke(48,1,.1,460);renderer;staticWorld=new _e;actors=new _e;effects=new _e;hero;enemies=new Map;pets=new Map;objectives=new Map;traces=new Map;numbers=new Map;textureCache=new Map;materials=new Map;geometryCache=new Map;sun;raycaster=new xu;aimPlane=new Tn(C0,-.9);ndc=new ut;intersection=new L;projectVector=new L;screenHead=new ut;screenTop=new ut;screenFeet=new ut;screenBody=new ut;screenAim=new ut;activeTraceIds=new Set;activeEventIds=new Set;tracePool=[];width=1;height=1;pixelRatio=0;built=!1;disposed=!1;contextLost=!1;lastHero={x:0,y:3};lastState=null;contactTexture;eventTextures=new Map;heroContact;contacts=new Map;impactGeometry=new wn(.09,6,5);impactMaterial=new bn({color:16767378,transparent:!0,depthWrite:!1});impactPool=[];onContextLost=t=>{t.preventDefault(),this.contextLost=!0,this.canvas.dispatchEvent(new CustomEvent("advancing-renderer-lost",{bubbles:!0}))};onContextRestored=()=>{this.contextLost=!1,this.canvas.dispatchEvent(new CustomEvent("advancing-renderer-restored",{bubbles:!0}))};resize(t,e,n){if(this.disposed)return;const i=Math.max(1,t),r=Math.max(1,e),a=Math.min(2,xc(i,r,n));this.width===i&&this.height===r&&this.pixelRatio===a||(this.width=i,this.height=r,this.pixelRatio=a,this.camera.aspect=this.width/this.height,this.camera.updateProjectionMatrix(),this.renderer.setPixelRatio(a),this.renderer.setSize(this.width,this.height,!1))}aimPoint(t,e){const n=this.canvas.getBoundingClientRect();return this.aimPointLocal((t-n.left)*this.width/Math.max(1,n.width),(e-n.top)*this.height/Math.max(1,n.height))}aimPointLocal(t,e){return this.ndc.set(t/this.width*2-1,1-e/this.height*2),this.raycaster.setFromCamera(this.ndc,this.camera),this.raycaster.ray.intersectPlane(this.aimPlane,this.intersection)?{x:yi(this.intersection.x,-18,18),y:yi(-this.intersection.z,this.lastHero.y-12,this.lastHero.y+65)}:{x:this.lastHero.x,y:this.lastHero.y+20}}aimTarget(t,e){const n=this.canvas.getBoundingClientRect();return this.aimTargetLocal((t-n.left)*this.width/Math.max(1,n.width),(e-n.top)*this.height/Math.max(1,n.height))}aimTargetLocal(t,e){const n=this.aimPointLocal(t,e),i=this.lastState;if(!i)return{point:n};let r;for(const a of i.enemies){const o=this.enemies.get(a.id);if(a.health<=0||!o?.actor.root.visible||(this.projectVector.set(a.x,1,-a.y).project(this.camera),this.projectVector.z<=-1||this.projectVector.z>=1))continue;const c=this.screenHead,l=this.screenTop,h=this.screenFeet,u=this.screenBody;this.projectToScreen(a,1.85,c),this.projectToScreen(a,2.3,l),this.projectToScreen(a,.12,h),this.projectToScreen(a,1.05,u);const d=Math.abs(h.y-l.y),p=yi(Math.min(this.width,this.height)*.02,9,17),g=Math.max(7,d*(a.kind==="armored"?.3:.23));if(t<u.x-g-p||t>u.x+g+p||e<Math.min(l.y,h.y)-p||e>Math.max(l.y,h.y)+p)continue;const _=Math.hypot((t-u.x)/Math.max(10,g),(e-u.y)/Math.max(14,d*.5)),m=Math.hypot(t-c.x,e-c.y)<=Math.max(5,d*.14);(!r||_<r.score)&&(r={point:{x:a.x,y:a.y},targetId:a.id,weakpoint:m,score:_})}return r?{point:r.point,targetId:r.targetId,weakpoint:r.weakpoint}:{point:n}}heroScreen(){return this.screenPoint(this.lastHero,1.1)}screenPoint(t,e=1.2){return this.projectVector.set(t.x,e,-t.y).project(this.camera),{x:(this.projectVector.x*.5+.5)*this.width,y:(-.5*this.projectVector.y+.5)*this.height}}projectToScreen(t,e,n){this.projectVector.set(t.x,e,-t.y).project(this.camera),n.set((this.projectVector.x*.5+.5)*this.width,(-.5*this.projectVector.y+.5)*this.height)}render(t,e){if(this.disposed||this.contextLost)return;this.built||(this.buildRoad(t),this.batchStaticWorld(),this.built=!0),this.lastState=t,this.lastHero.x=t.hero.x,this.lastHero.y=t.hero.y;const n=-t.hero.y;this.camera.position.set(t.hero.x*.32+7,9,n+12),this.camera.lookAt(t.hero.x*.32,1,n-10),this.camera.updateMatrixWorld(),this.sun.position.set(t.hero.x-18,24,n+8),this.sun.target.position.set(t.hero.x,0,n-16),this.hero.root.position.set(t.hero.x,0,n),this.hero.root.visible=!0,this.projectToScreen(t.hero,1.2,this.screenBody),this.projectToScreen({x:t.hero.x+Math.sin(t.hero.aimHeading)*5,y:t.hero.y+Math.cos(t.hero.aimHeading)*5},1.2,this.screenAim);const i=this.screenAim.x-this.screenBody.x,r=this.screenAim.y-this.screenBody.y;this.hero.update({heading:t.hero.heading,walkDistance:t.hero.walkDistance,moving:t.hero.walking,time:t.time,aimHeading:t.hero.aimHeading,cameraHeading:Math.atan2(this.camera.position.x-t.hero.x,-this.camera.position.z-t.hero.y),screenFacing:Math.abs(i)>1?i>0?1:-1:void 0,aimPitch:Math.atan2(r,Math.max(12,Math.abs(i))),firing:t.hero.recoil,reload:t.reloadRemaining,dodge:t.dodgeRemaining,hurt:t.hero.hurt,dead:t.hero.health<=0?Math.max(.01,t.time-(t.result?.duration??t.time)):0}),this.heroContact.position.set(t.hero.x,.022,n),this.heroContact.scale.setScalar(t.dodgeRemaining>0?.87:1);for(const a of t.enemies)this.renderEnemy(a,t);for(const a of t.pets){let o=this.pets.get(a.id);if(!o){o=w0(a.id),this.pets.set(a.id,o),this.actors.add(o.root);const c=this.contactShadow(.95,.5,.2);this.contacts.set(a.id,c),this.actors.add(c)}o.root.position.set(a.x,0,-a.y),o.update({heading:a.heading,walkDistance:a.walkDistance,moving:t.hero.walking||Math.hypot(a.x-t.hero.x,a.y-t.hero.y)>3.8,time:t.time}),this.contacts.get(a.id).position.set(a.x,.019,-a.y)}for(const a of t.objectives){const o=this.objectives.get(a.id);if(!o)continue;o.root.visible=!a.collected,o.marker.position.y=3.25+Math.sin(t.time*2+a.y)*.09;const c=Math.hypot(t.hero.x-a.x,t.hero.y-a.y)<3.8;o.marker.material.opacity=c?1:.83;const l=o.ring.material;l.opacity=c?.42:.17,o.ring.scale.setScalar(1+Math.sin(t.time*2.3)*.04)}this.renderEffects(t,e),this.renderer.render(this.scene,this.camera)}renderEnemy(t,e){const n=Math.hypot(e.hero.x-t.x,e.hero.y-t.y),i=t.defeatedAt===null?0:Math.max(.001,e.time-t.defeatedAt),r=n<52&&i<4;let a=this.enemies.get(t.id);if(!a){if(!r)return;const u=S0(t.kind),d=this.healthBar(),p=new Xt(new Xs(.72,.86,28),new bn({color:15245393,transparent:!0,opacity:.5,side:He,depthWrite:!1}));p.rotation.x=-Math.PI/2,a={actor:u,bar:d,warning:p},this.enemies.set(t.id,a),this.actors.add(u.root,d.root,p)}const{actor:o,bar:c,warning:l}=a;o.root.visible=r,r&&(o.root.position.set(t.x,0,-t.y),o.update({heading:t.heading,walkDistance:t.walkDistance,moving:t.health>0&&t.active&&t.attackRemaining<=0,time:e.time,firing:t.attackRemaining,hurt:t.hurt,dead:i})),c.root.visible=r&&t.health>0&&(t.active||e.scoutRemaining>0),c.root.position.set(t.x,t.kind==="armored"?3:2.65,-t.y),c.root.quaternion.copy(this.camera.quaternion);const h=yi(t.health/t.maxHealth,0,1);if(c.fill.scale.x=h,c.fill.position.x=-(1-h)*.75,l.visible=r&&t.health>0&&t.attackRemaining>0&&n<5,l.position.set(t.x,.03,-t.y),l.visible){const u=.35+Math.sin(e.time*20)*.14;l.material.opacity=u,l.scale.setScalar((t.kind==="armored"?2.55:1.85)/.86)}}material(t,e=.84,n=0){const i=`${t}:${e}:${n}`;let r=this.materials.get(i);return r||(r=new Vn({color:t,roughness:e,metalness:n}),this.materials.set(i,r)),r}geometry(t,e,n){const i=`box:${t}:${e}:${n}`;let r=this.geometryCache.get(i);return r||(r=new Ln(t,e,n),this.geometryCache.set(i,r)),r}box(t,e,n,i,r,a=0,o=0,c=0,l=0){const h=new Xt(this.geometry(e,n,i),this.material(r,.86,l));return h.position.set(a,o,c),h.castShadow=!0,h.receiveShadow=!0,t.add(h),h}cylinder(t,e,n,i,r,a=0,o=0,c=0,l=10){const h=`cylinder:${e}:${n}:${i}:${l}`;let u=this.geometryCache.get(h);u||(u=new Kn(e,n,i,l),this.geometryCache.set(h,u));const d=new Xt(u,this.material(r));return d.position.set(a,o,c),d.castShadow=!0,d.receiveShadow=!0,t.add(d),d}sphere(t,e,n,i,r,a,o=1,c=1,l=1){const h=`sphere:${e}`;let u=this.geometryCache.get(h);u||(u=new wn(e,9,7),this.geometryCache.set(h,u));const d=new Xt(u,this.material(n));return d.position.set(i,r,a),d.scale.set(o,c,l),d.castShadow=!0,t.add(d),d}canvasTexture(t,e,n,i){let r=this.textureCache.get(t);if(r)return r;const a=document.createElement("canvas");a.width=e,a.height=n;const o=a.getContext("2d");return i(o),r=new Fs(a),r.colorSpace=Ee,r.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy()),this.textureCache.set(t,r),r}makeContactTexture(){const t=document.createElement("canvas");t.width=t.height=64;const e=t.getContext("2d"),n=e.createRadialGradient(32,32,0,32,32,32);return n.addColorStop(0,"rgba(18,24,16,.7)"),n.addColorStop(.45,"rgba(18,24,16,.32)"),n.addColorStop(1,"rgba(18,24,16,0)"),e.fillStyle=n,e.fillRect(0,0,64,64),new Fs(t)}contactShadow(t,e,n){const i=new Xt(new Ye(t,e),new bn({map:this.contactTexture,transparent:!0,opacity:n,depthWrite:!1}));return i.rotation.x=-Math.PI/2,i.renderOrder=1,i}buildSky(){const t=new Xt(new wn(380,24,16),new fn({side:we,depthWrite:!1,uniforms:{top:{value:new Nt(7572123)},horizon:{value:new Nt(16177323)},bottom:{value:new Nt(11646624)}},vertexShader:"varying vec3 world;void main(){world=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",fragmentShader:`uniform vec3 top;uniform vec3 horizon;uniform vec3 bottom;varying vec3 world;void main(){float y=normalize(world).y;vec3 c=y>0.0?mix(horizon,top,pow(clamp(y,0.0,1.0),0.65)):mix(horizon,bottom,clamp(-y*4.0,0.0,1.0));gl_FragColor=vec4(c,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}));this.scene.add(t)}buildRoad(t){const e=P0(73218+t.stage*871),n=t.goalY+70,i=this.canvasTexture("asphalt",512,512,l=>{l.fillStyle="#777c6e",l.fillRect(0,0,512,512);for(let h=0;h<3e4;h++){const u=Math.floor(94+e()*65);l.fillStyle=`rgba(${u},${u+2},${u-4},${.05+e()*.16})`;const d=e()*1.5+.2;l.fillRect(e()*512,e()*512,d,d)}for(let h=0;h<60;h++){let u=e()*512,d=e()*512;l.beginPath(),l.moveTo(u,d);for(let p=0;p<7;p++)u+=(e()-.5)*50,d+=e()*40-5,l.lineTo(u,d);l.strokeStyle="rgba(35,43,33,.25)",l.lineWidth=e()*1.2+.5,l.stroke()}for(let h=0;h<26;h++)l.fillStyle="rgba(191,175,133,.09)",l.beginPath(),l.ellipse(e()*512,e()*512,8+e()*32,5+e()*17,e()*6,0,7),l.fill()});i.wrapS=i.wrapT=$i,i.repeat.set(2,n/12);const r=new Xt(new Ye(16,n),new Vn({map:i,roughness:1,color:13090977}));r.rotation.x=-Math.PI/2,r.position.set(0,0,-n/2+24),r.receiveShadow=!0,this.staticWorld.add(r);const a=this.canvasTexture("shoulder-soil",256,256,l=>{l.fillStyle="#8f9574",l.fillRect(0,0,256,256);for(let h=0;h<5e3;h++)l.fillStyle=h%3?"rgba(66,88,42,.13)":"rgba(206,192,139,.14)",l.fillRect(e()*256,e()*256,e()*6+1,e()*4+1)});a.wrapS=a.wrapT=$i,a.repeat.set(12,n/8);const o=new Xt(new Ye(160,n+90),new Vn({map:a,color:12961694,roughness:1}));o.rotation.x=-Math.PI/2,o.position.set(0,-.035,-n/2+20),o.receiveShadow=!0,this.staticWorld.add(o);for(let l=-12;l<t.goalY+14;l+=6.5){this.box(this.staticWorld,.11,.008,3.2,13158565,0,.012,-l);for(const h of[-7.55,7.55])this.box(this.staticWorld,.11,.012,6.1,13749936,h,.015,-l)}for(const l of[25,75,t.goalY-12])for(let h=-6;h<7;h+=1.5)this.box(this.staticWorld,.8,.01,2.8,12501154,h,.018,-l);const c=this.canvasTexture("road-arrow",128,256,l=>{l.fillStyle="rgba(231,226,190,.65)",l.beginPath(),l.moveTo(64,15),l.lineTo(110,80),l.lineTo(80,80),l.lineTo(80,232),l.lineTo(48,232),l.lineTo(48,80),l.lineTo(18,80),l.closePath(),l.fill()});for(const l of[12,58,104]){const h=new Xt(new Ye(1.3,3.5),new Vn({map:c,transparent:!0,depthWrite:!1,roughness:1}));h.rotation.x=-Math.PI/2,h.position.set(3.2,.028,-l),this.staticWorld.add(h)}this.makeVegetation(t,e),this.makeRoadsideDetails(t,e),this.makeDistantCity(t,e),this.makeCheckpoint(t);for(const l of t.obstacles)this.makeObstacle(l,e);for(const l of t.objectives){const h=new _e;h.position.set(l.x,0,-l.y),this.staticWorld.add(h),l.kind==="supply"?this.makeSupply(h):this.makeTraveler(h);const u=new Xt(new Xs(.85,.91,32),new bn({color:15191181,transparent:!0,opacity:.2,depthWrite:!1,side:He}));u.rotation.x=-Math.PI/2,u.position.y=.035,h.add(u);const d=this.textSprite(l.kind==="supply"?"물자":"구조",l.kind==="supply"?"#d9d098":"#e4c49a",2.2,.75);d.position.y=3.25,h.add(d),this.objectives.set(l.id,{root:h,marker:d,ring:u})}}batchStaticWorld(){const t=new Set;for(const n of this.objectives.values())n.root.traverse(i=>t.add(i));this.staticWorld.updateMatrixWorld(!0);const e=new Map;this.staticWorld.traverse(n=>{if(!(n instanceof Xt)||n instanceof Sn||t.has(n)||Array.isArray(n.material)||n.material.transparent)return;const i=Math.floor(n.matrixWorld.elements[14]/24),r=`${n.geometry.uuid}:${n.material.uuid}:${n.castShadow}:${n.receiveShadow}:${i}`,a=e.get(r);a?a.push(n):e.set(r,[n])});for(const n of e.values()){if(n.length<3)continue;const i=n[0],r=new Sn(i.geometry,i.material,n.length);r.castShadow=i.castShadow,r.receiveShadow=i.receiveShadow;for(let a=0;a<n.length;a++)r.setMatrixAt(a,n[a].matrixWorld),n[a].removeFromParent();r.instanceMatrix.needsUpdate=!0,r.computeBoundingBox(),r.computeBoundingSphere(),this.staticWorld.add(r)}this.staticWorld.updateMatrixWorld(!0),this.staticWorld.traverse(n=>{t.has(n)||(n.matrixAutoUpdate=!1,n.matrixWorldAutoUpdate=!1)})}makeVegetation(t,e){const n=t.goalY+55,i=new xe,r=[];for(let _=0;_<3;_++){const m=_*Math.PI/3,f=Math.cos(m),b=Math.sin(m),E=.12,S=.6+_*.1;r.push(-E*f,0,-E*b,E*f,0,E*b,.1*f,S,.1*b)}i.setAttribute("position",new ne(r,3)),i.computeVertexNormals();const a=new Vn({color:7440197,roughness:1,side:He}),o=new Sn(i,a,2200),c=new de,l=new Nt;for(let _=0;_<2200;_++){const m=e()<.5?-1:1,f=m*(8+Math.pow(e(),2)*21),b=-14+e()*n;c.position.set(f,.015,-b),c.rotation.y=e()*Math.PI*2;const E=.5+e()*1.05;c.scale.set(E,.45+e()*.9,E),c.updateMatrix(),o.setMatrixAt(_,c.matrix),l.setHSL(.19+e()*.035,.31+e()*.18,.29+e()*.17),o.setColorAt(_,l)}o.instanceMatrix.needsUpdate=!0,o.receiveShadow=!0,this.staticWorld.add(o);const h=new Sn(new Kn(.015,.022,.6,4),this.material(6913336),280),u=new Sn(new wn(.09,5,4),this.material(15261613),280);for(let _=0;_<280;_++){const m=e()<.5?-1:1,f=m*(8.8+e()*8),b=e()*t.goalY;c.position.set(f,.34,-b),c.rotation.set(0,0,(e()-.5)*.25),c.scale.setScalar(.7+e()*.7),c.updateMatrix(),h.setMatrixAt(_,c.matrix),c.position.y=.65,c.scale.set(1.4,.48,1.4),c.updateMatrix(),u.setMatrixAt(_,c.matrix),u.setColorAt(_,new Nt(_%5===0?14136665:15853250))}this.staticWorld.add(h,u);const d=48,p=new Sn(new Kn(.18,.32,4,7),this.material(6314811),d),g=new Sn(new wn(1,9,7),this.material(7701316),d*3);for(let _=0;_<d;_++){const m=_%2?-1:1,f=m*(11+e()*15),b=-4+e()*(t.goalY+30),E=3.7+e()*3;c.position.set(f,E/2,-b),c.rotation.set(0,e()*6,(e()-.5)*.09),c.scale.set(.8+e()*.6,E/4,.8+e()*.5),c.updateMatrix(),p.setMatrixAt(_,c.matrix);for(let S=0;S<3;S++)c.position.set(f+(S-1)*.9,E-.15+S*.35,-b+(S%2?-.7:.5)),c.rotation.set(0,e()*6,0),c.scale.set(1.65+e()*.65,1.1+e()*.7,1.55+e()*.8),c.updateMatrix(),g.setMatrixAt(_*3+S,c.matrix),g.setColorAt(_*3+S,new Nt().setHSL(.18+e()*.065,.31+e()*.17,.3+e()*.1))}p.castShadow=!0,g.castShadow=!0,g.receiveShadow=!0,this.staticWorld.add(p,g);for(let _=0;_<32;_++){const m=(_%2?1:-1)*(7.45+e()*.55),f=e()*t.goalY,b=this.sphere(this.staticWorld,.18+e()*.2,9867899,m,.08,-f,1.5,.5,1);b.rotation.y=e()*6}}makeRoadsideDetails(t,e){for(const n of[-1,1]){for(let i=-5;i<t.goalY+15;i+=9)this.box(this.staticWorld,.13,1.05,.14,6516571,n*9.1,.52,-i,.35),this.box(this.staticWorld,.14,.3,.16,13418373,n*9.1,.95,-i,.3);this.box(this.staticWorld,.17,.3,t.goalY+25,8884869,n*9.1,.72,-(t.goalY+15)/2+5,.4);for(let i=7;i<t.goalY;i+=29){const r=new _e;r.position.set(n*10.3,0,-i),this.staticWorld.add(r);const a=this.cylinder(r,.08,.15,6.8,6450522,0,3.4,0,7);a.rotation.z=n*.035,this.box(r,1.5,.1,.12,6450522,-n*.6,6.65,0,.2),this.box(r,.6,.12,.42,11842453,-n*1.2,6.58,0)}}for(let n=4;n<t.goalY;n+=15)for(const i of[-1,1]){const r=1.2+e()*.8;this.box(this.staticWorld,1,r,6+e()*4,9870468,i*(18+e()*5),r/2,-n)}for(let n=0;n<14;n++){const i=n%2?1:-1,r=i*(9.6+e()*2.5),a=9+e()*(t.goalY-12);this.box(this.staticWorld,.2,.12,.8,9141080,r,.08,-a)}}makeDistantCity(t,e){const n=new _e;this.staticWorld.add(n);for(let r=0;r<34;r++){const a=r%2?-1:1,o=a*(25+e()*46),c=25+e()*(t.goalY+85),l=3+e()*6,h=8+e()*20,u=4+e()*7,d=new _e;d.position.set(o,0,-c),n.add(d),this.box(d,l,h,u,r%3?9344653:10460552,0,h/2,0);for(let p=0;p<3;p++)e()>.3&&this.box(d,l*.22,1+e()*2,u*.7,8094845,(p-1)*l*.3,h+.3,0);for(let p=0;p<Math.min(9,Math.floor(h/2));p++)for(let g=0;g<3;g++)e()>.25&&this.box(d,.35,.65,.025,6716275,(g-1)*l*.27,2+p*1.8,u/2+.016)}const i=new _e;i.position.set(-35,0,-t.goalY-105),this.staticWorld.add(i),this.cylinder(i,8,16,12,9411453,0,5,0,12),this.cylinder(i,.42,.95,34,9213584,0,27,0,10),this.cylinder(i,2.2,2.5,2.2,9213584,0,43,0,12),this.cylinder(i,1.3,2.3,2.5,8885902,0,45,0,12),this.cylinder(i,.12,.26,14,8885902,0,53,0,7)}makeCheckpoint(t){const e=new _e;e.position.z=-t.goalY-4,this.staticWorld.add(e);for(const a of[-8.8,8.8])this.box(e,.55,5.2,.7,9608067,a,2.6,0),this.box(e,1.9,2.5,2.4,9739649,a,1.25,1.6),this.box(e,1.5,.8,.045,6256490,a,1.65,2.82),this.box(e,1.8,.15,2.5,11580315,a,2.55,1.6);this.box(e,20,.6,5.6,10198659,0,5.1,.2),this.box(e,20,.18,5.7,8293225,0,5.45,.2);const n=this.canvasTexture("seoul-sign",512,160,a=>{a.fillStyle="#415f48",a.fillRect(0,0,512,160),a.strokeStyle="#c7c29a",a.lineWidth=5,a.strokeRect(6,6,500,148),a.textAlign="center",a.fillStyle="#e9e1bc",a.font="bold 58px sans-serif",a.fillText("서울 SEOUL",256,78),a.font="32px sans-serif",a.fillText("↑  안전 통로",256,126)}),i=new Xt(new Ye(7.5,2.35),new Vn({map:n,roughness:1}));i.position.set(2,6.25,3.05),e.add(i);const r=this.textSprite("귀환 지점","#cde0a0",3,.95);r.position.set(3.8,3.8,3.4),e.add(r);for(const a of[-4.4,4.4]){const o=this.box(e,.12,.15,4.6,12298872,a,2.2,2.9);o.rotation.x=-1.08}}makeObstacle(t,e){const n=new _e;n.position.set(t.x,0,-t.y),this.staticWorld.add(n);const{w:i,d:r,h:a}=t;if(t.kind==="car"){const o=[7044968,9672579,10587753][Math.floor(e()*3)];this.box(n,i*.94,a*.36,r*.95,o,0,a*.35,0,.15),this.box(n,i*.79,a*.38,r*.48,o,0,a*.68,-r*.05,.14),this.box(n,i*.69,a*.24,.035,4152403,0,a*.73,-r*.292),this.box(n,i*.69,a*.24,.035,4941148,0,a*.73,r*.192);for(const c of[-1,1])this.box(n,.025,a*.24,r*.35,4087125,c*i*.402,a*.73,-r*.04);this.box(n,i*.75,a*.08,.08,7829339,0,a*.24,r*.49,.3);for(const c of[-1,1]){this.box(n,i*.18,a*.08,.035,14993801,c*i*.31,a*.42,-r*.48),this.box(n,i*.14,a*.07,.035,10250570,c*i*.32,a*.42,r*.48);for(const l of[-r*.3,r*.28]){const h=this.cylinder(n,a*.19,a*.19,i*.13,3357746,c*i*.43,a*.21,l,12);h.rotation.z=Math.PI/2;const u=this.cylinder(n,a*.095,a*.095,i*.137,8879451,c*i*.43,a*.21,l,10);u.rotation.z=Math.PI/2}}for(let c=0;c<5;c++){const l=this.box(n,.18+e()*.3,.01,.2+e()*.4,8416587,(e()-.5)*i*.75,a*.535,(e()-.5)*r*.78);l.rotation.y=e()*4}}else if(t.kind==="barrier"){this.box(n,i,a*.45,r,10263675,0,a*.225,0),this.box(n,i*.73,a*.55,r*.62,10263675,0,a*.72,0);for(let o=0;o<Math.max(2,Math.floor(i/.55));o++){const c=-i*.39+o*i*.78/Math.max(1,Math.floor(i/.55)-1),l=this.box(n,i*.075,a*.32,.018,o%2?6054480:13284980,c,a*.75,r*.315);l.rotation.z=-.25}}else{this.box(n,i,a,r,9402185,0,a/2,0);for(const o of[-i*.42,i*.42])this.box(n,i*.13,a*1.015,r*1.015,6708278,o,a/2,0);for(const o of[-r*.41,r*.41])this.box(n,i*1.015,a*.14,r*.12,11572063,0,a*.87,o)}}makeSupply(t){this.box(t,1.1,.76,.8,8614727,0,.38,0),this.box(t,1.14,.12,.84,10785369,0,.8,0);for(const e of[-.37,.37])this.box(t,.12,.91,.86,5137744,e,.45,0,.2);this.box(t,.23,.26,.015,14733984,0,.48,.412),this.box(t,.085,.2,.021,7439948,0,.48,.422),this.box(t,.2,.075,.022,7439948,0,.48,.423)}makeTraveler(t){this.cylinder(t,.32,.4,.95,10127204,0,.65,0,10),this.sphere(t,.29,12624260,0,1.35,0,1,1.15,1),this.sphere(t,.3,6708803,0,1.49,.03,1,.7,1);for(const e of[-1,1]){const n=this.cylinder(t,.09,.11,.63,12166267,e*.34,.8,-.02,7);n.rotation.z=e*.28,this.box(t,.22,.22,.6,6057297,e*.22,.17,.22),this.box(t,.23,.16,.36,5198909,e*.22,.1,.6)}this.box(t,.45,.58,.24,8155217,.54,.3,.06)}textSprite(t,e,n,i){const r=this.canvasTexture("label:"+t,256,88,o=>{o.fillStyle="rgba(29,45,32,.86)",o.beginPath(),o.roundRect(4,6,248,76,18),o.fill(),o.strokeStyle=e,o.lineWidth=3,o.stroke(),o.fillStyle=e,o.font="bold 38px sans-serif",o.textAlign="center",o.textBaseline="middle",o.fillText(t,128,47)}),a=new wa(new Vs({map:r,transparent:!0,depthTest:!0,depthWrite:!1,toneMapped:!1}));return a.scale.set(n,i,1),a}healthBar(){const t=new _e,e=new Xt(new Ye(1.65,.16),new bn({color:3554866,transparent:!0,opacity:.8,depthWrite:!1})),n=new Xt(new Ye(1.5,.07),new bn({color:14256733,depthWrite:!1}));return n.position.z=.006,t.add(e,n),{root:t,fill:n}}renderEffects(t,e){const n=this.activeTraceIds;n.clear();let i=0;for(const a of t.traces){n.add(a.id);let o=this.traces.get(a.id);const c=a.critical?1.85:1.15;if(!o){if(o=this.tracePool.pop(),!o){const p=new xe;p.setAttribute("position",new ne(new Float32Array(6),3).setUsage(gh)),o=new Zh(p,new Zl({transparent:!0,opacity:.9,depthWrite:!1})),this.effects.add(o)}const l=a.to.x-a.from.x,h=a.to.y-a.from.y,u=Math.max(.01,Math.hypot(l,h)),d=o.geometry.getAttribute("position");d.setXYZ(0,a.from.x+l/u*.72,1.45,-a.from.y-h/u*.72),d.setXYZ(1,a.to.x,c,-a.to.y),d.needsUpdate=!0,o.geometry.computeBoundingSphere(),o.material.color.setHex(a.critical?16768144:15254403),o.visible=!0,this.traces.set(a.id,o)}if(o.material.opacity=yi(a.remaining*9,0,.9),a.hit){let l=this.impactPool[i];l||(l=new Xt(this.impactGeometry,this.impactMaterial),this.effects.add(l),this.impactPool.push(l)),l.visible=!0,l.position.set(a.to.x,c,-a.to.y),l.scale.setScalar(a.critical?2.5:1.5),i++}}for(let a=i;a<this.impactPool.length;a++)this.impactPool[a].visible=!1;for(const[a,o]of this.traces)n.has(a)||(o.visible=!1,this.tracePool.push(o),this.traces.delete(a));const r=this.activeEventIds;r.clear();for(const a of t.events){if(!["damage","heal","collect","rescue"].includes(a.kind))continue;r.add(a.id);let o=this.numbers.get(a.id);if(!o){const c=a.kind==="damage"?String(Math.round(a.amount)):a.kind==="heal"?`+${Math.round(a.amount)}`:a.kind==="collect"?"물자 확보":"구조 완료",l=a.kind+c;let h=this.eventTextures.get(l);if(!h){const u=document.createElement("canvas");u.width=256,u.height=96;const d=u.getContext("2d");d.font="bold 52px sans-serif",d.textAlign="center",d.textBaseline="middle",d.lineWidth=7,d.strokeStyle="#344333",d.strokeText(c,128,49),d.fillStyle=a.kind==="damage"?"#f1d698":"#d8e6af",d.fillText(c,128,49),h=new Fs(u),h.colorSpace=Ee,this.eventTextures.set(l,h)}o=new wa(new Vs({map:h,transparent:!0,depthWrite:!1,depthTest:!1,toneMapped:!1})),o.scale.set(a.kind==="damage"?1.4:2.5,.65,1),this.numbers.set(a.id,o),this.effects.add(o)}o.position.set(a.x,2.7+(1-a.remaining)*.6,-a.y),o.material.opacity=yi(a.remaining*2.4,0,1)}for(const[a,o]of this.numbers)r.has(a)||(this.effects.remove(o),o.material.dispose(),this.numbers.delete(a))}dispose(){if(this.disposed)return;this.disposed=!0,this.canvas.removeEventListener("webglcontextlost",this.onContextLost),this.canvas.removeEventListener("webglcontextrestored",this.onContextRestored),this.hero.dispose(),this.actors.remove(this.hero.root);for(const i of this.enemies.values())i.actor.dispose(),this.actors.remove(i.actor.root);for(const i of this.pets.values())i.dispose(),this.actors.remove(i.root);const t=new Set,e=new Set,n=new Set;this.scene.traverse(i=>{i instanceof Sn&&i.dispose();const r=i;if(r.geometry&&t.add(r.geometry),r.material)for(const a of Array.isArray(r.material)?r.material:[r.material]){e.add(a);for(const o of Object.values(a))o instanceof ve&&n.add(o)}});for(const i of this.geometryCache.values())t.add(i);for(const i of this.materials.values())e.add(i);for(const i of this.textureCache.values())n.add(i);for(const i of this.eventTextures.values())n.add(i);n.add(this.contactTexture),t.add(this.impactGeometry),e.add(this.impactMaterial);for(const i of t)i.dispose();for(const i of e)i.dispose();for(const i of n)i.dispose();this.sun.shadow.dispose(),this.renderer.dispose(),this.scene.clear(),this.staticWorld.clear(),this.actors.clear(),this.effects.clear(),this.enemies.clear(),this.pets.clear(),this.objectives.clear(),this.traces.clear(),this.numbers.clear(),this.contacts.clear(),this.geometryCache.clear(),this.materials.clear(),this.textureCache.clear(),this.eventTextures.clear(),this.tracePool.length=0,this.impactPool.length=0,this.activeTraceIds.clear(),this.activeEventIds.clear(),this.lastState=null}}const Al=s=>s.replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),wl=s=>({KeyW:"w",KeyA:"a",KeyS:"s",KeyD:"d",ArrowUp:"arrowup",ArrowDown:"arrowdown",ArrowLeft:"arrowleft",ArrowRight:"arrowright",Space:" ",KeyR:"r",ShiftLeft:"shift",ShiftRight:"shift",KeyF:"f",KeyQ:"q",KeyE:"e",KeyH:"h",Escape:"escape"})[s.code]??(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," ","r","shift","f","q","e","h","escape"].includes(s.key.toLowerCase())?s.key.toLowerCase():void 0),L0=new Set(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," "]),I0=new Set(["reload","dodge","collect","supply","scout","potion","clear"]),En=s=>`<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${{aim:'<circle cx="16" cy="16" r="10"/><path d="M16 2v8m0 12v8M2 16h8m12 0h8"/><circle cx="16" cy="16" r="1"/>',reload:'<path d="M26 12a11 11 0 1 0 0 9M26 3v9H17"/>',dodge:'<circle cx="20" cy="6" r="3"/><path d="m15 10 7 4 6-1M14 11l-4 8 7 3-2 7M11 20l-8 4m10-10-7 1"/>',back:'<path d="m20 5-11 11 11 11"/>',pause:'<path d="M11 7v18M21 7v18"/>',supply:'<path d="M5 11h22v16H5zM3 5h26v6H3zM16 5v22M11 18h10"/>',scout:'<path d="M2 16s5-9 14-9 14 9 14 9-5 9-14 9S2 16 2 16Z"/><circle cx="16" cy="16" r="4"/>',collect:'<path d="M7 9h18v20H7zM11 9V5h10v4M11 17h10m-5-5v10"/>',exit:'<path d="M13 5H5v23h8m1-12h14m-6-6 6 6-6 6"/>'}[s]??'<circle cx="16" cy="16" r="8"/>'}</svg>`;class N0{constructor(t){this.options=t,this.simulation=new Pc(t),this.root=document.createElement("div"),this.root.className="adv-combat",this.root.setAttribute("role","dialog"),this.root.setAttribute("aria-modal","true"),this.root.setAttribute("aria-label","이동하며 싸우는 폐도로 탐색");const e=this.simulation.state.pets.map(r=>r.id),n=(r,a)=>e[r]||e[0]?bc(e[r]??e[0]):En(a),i=["서울 숲길 · 옛 요금소","한강 북단 · 끊어진 교량","남산 순환로 · 녹슨 검문소"];this.root.innerHTML=`<canvas class="adv-canvas" aria-label="폐도로를 직접 이동하며 조준하는 전투"></canvas>
   <header class="adv-header"><div class="adv-location"><button class="adv-glass adv-icon" data-adv="retreat" aria-label="탐색에서 귀환">${En("back")}</button><div><small>위험구역 · ${t.stage}구역</small><strong>${i[t.stage-1]}</strong></div></div><div class="adv-route"><strong data-hud="distance"></strong><div class="adv-route-track"><i data-hud="progress"></i><b></b><b></b><b></b></div><span data-hud="goals"></span></div><div class="adv-top-right"><button class="adv-clear adv-glass" data-adv="clear" hidden>${En("exit")}<span>클리어 · 귀환</span></button><time data-hud="time">00:00</time><button class="adv-glass adv-icon" data-adv="pause" aria-label="전투 일시정지">${En("pause")}</button></div></header>
   <div class="adv-instruction" data-hud="instruction">적을 모두 처치하면 클리어 · 물자 회수와 구조는 선택이에요</div>
   <aside class="adv-scout-status adv-glass" data-hud="scout-status" hidden><strong>정찰 효과 <b data-hud="scout-active"></b></strong><span>적 이동속도 −45% · 체력바 표시</span></aside>
   <div class="adv-reticle" aria-hidden="true" data-hud="reticle"><i></i><b></b></div>
   <div class="adv-hit" data-hud="hit" aria-hidden="true"></div>
   <section class="adv-survivor adv-glass"><span class="adv-portrait">${Mc(t.gender,"",t.outfit)}</span><div><strong>${Al(t.name)}</strong><div class="adv-health"><i data-hud="health"></i></div><small data-hud="health-label"></small></div><button class="adv-potion" data-adv="potion" aria-label="체력 회복 물약 · H" ${t.onUseHealthPotion?"":"hidden"}>${yc("health")}<span>물약 <b data-hud="potion-count"></b></span></button></section>
   <div class="adv-stick" data-control="move" role="button" tabindex="0" aria-label="이동 패드. 키보드는 WASD 또는 방향키"><div><i data-hud="stick"></i><span>↑</span></div><strong>이동</strong></div>
   <footer class="adv-bottom"><div class="adv-supports"><button class="adv-support adv-glass" data-adv="supply">${n(0,"supply")}<span>보급</span><em class="adv-support-hint">탄약 충전</em><small data-hud="supply-cd"></small></button><button class="adv-support adv-glass" data-adv="scout">${n(1,"scout")}<span>정찰</span><em class="adv-support-hint">적 둔화</em><small data-hud="scout-cd"></small></button></div><div class="adv-ammo adv-glass"><span>탄약</span><strong data-hud="ammo">30 <small>/ 30</small></strong><small data-hud="reload-text"></small></div></footer>
   <div class="adv-actions"><button class="adv-secondary adv-glass" data-adv="dodge" aria-label="회피 · Shift">${En("dodge")}<span>회피</span><kbd>Shift</kbd><small data-hud="dodge-cd"></small></button><button class="adv-secondary adv-glass" data-adv="reload" aria-label="재장전 · R">${En("reload")}<span data-hud="reload-label">재장전</span><kbd>R</kbd></button><button class="adv-fire adv-glass" data-control="fire" aria-label="누른 채 움직여 조준하고 사격하기 · Space">${En("aim")}<span>조준 · 사격</span></button></div>
   <button class="adv-interact adv-glass" data-adv="collect" hidden>${En("collect")}<span data-hud="interact"></span></button>
   <div class="adv-notice" data-hud="notice" role="status" aria-live="polite" hidden></div>
   <div class="adv-overlay" data-hud="overlay" hidden></div>`,this.canvas=this.root.querySelector("canvas");try{this.world=new D0(this.canvas,{gender:t.gender,stage:t.stage,outfit:t.outfit})}catch(r){throw this.canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext(),r}this.previousOverflow=document.body.style.overflow,this.previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;try{document.body.append(this.root),document.body.style.overflow="hidden",this.root.querySelectorAll("[data-hud]").forEach(r=>this.elements[r.dataset.hud]=r),this.root.querySelectorAll("button[data-adv]").forEach(r=>this.buttons[r.dataset.adv]=r),this.elements["move-pad"]=this.root.querySelector('[data-control="move"]'),this.root.addEventListener("click",this.onClick),this.root.addEventListener("pointerdown",this.onDown),this.root.addEventListener("pointermove",this.onMove),this.root.addEventListener("pointerup",this.onUp),this.root.addEventListener("pointercancel",this.onUp),this.root.addEventListener("lostpointercapture",this.onUp),window.addEventListener("blur",this.onBlur),document.addEventListener("visibilitychange",this.onVisibility),document.addEventListener("keydown",this.onKeyDown),document.addEventListener("keyup",this.onKeyUp),window.addEventListener("gameviewportchange",this.onResize),this.canvas.addEventListener("webglcontextlost",this.onContextLost),this.canvas.addEventListener("webglcontextrestored",this.onContextRestored),this.observer=new ResizeObserver(this.onResize),this.observer.observe(this.canvas),this.resize(),this.refreshHUD(),this.buttons.pause.focus(),this.requestFrame()}catch(r){throw this.destroy(),r}}simulation;root;canvas;world;observer=null;previousOverflow;previousFocus;frame=0;last=0;lastHud=0;width=1;height=1;destroyed=!1;delivered=!1;manualPause=!1;orientationBlocked=!1;confirmingRetreat=!1;contextLost=!1;resultShown=!1;renderFailed=!1;keys=new Set;pointerActionClicks=new WeakMap;move={x:0,y:0};fireHeld=!1;pointerFire=!1;aim={x:.51,y:.37};movePointer=null;firePointer=null;aimOrigin={x:0,y:0,ax:.51,ay:.37};lastMessage="";messageUntil=0;elements={};buttons={};hudText={};lastAimX=-1;lastAimY=-1;lastAmmo="";resultAnimationUntil=0;clearReadyAnnounced=!1;setOrientationBlocked(t){this.orientationBlocked=t,this.root.inert=t,this.syncPause()}destroy(){this.destroyed||(this.destroyed=!0,cancelAnimationFrame(this.frame),this.clearInput(),this.observer?.disconnect(),this.root.removeEventListener("click",this.onClick),this.root.removeEventListener("pointerdown",this.onDown),this.root.removeEventListener("pointermove",this.onMove),this.root.removeEventListener("pointerup",this.onUp),this.root.removeEventListener("pointercancel",this.onUp),this.root.removeEventListener("lostpointercapture",this.onUp),window.removeEventListener("blur",this.onBlur),document.removeEventListener("visibilitychange",this.onVisibility),document.removeEventListener("keydown",this.onKeyDown),document.removeEventListener("keyup",this.onKeyUp),window.removeEventListener("gameviewportchange",this.onResize),this.canvas.removeEventListener("webglcontextlost",this.onContextLost),this.canvas.removeEventListener("webglcontextrestored",this.onContextRestored),this.world.dispose(),this.root.remove(),document.body.style.overflow=this.previousOverflow,this.previousFocus?.focus())}onResize=()=>this.resize();resize(){const t=this.canvas.getBoundingClientRect();this.width=Math.max(1,t.width),this.height=Math.max(1,t.height),this.world.resize(this.width,this.height,devicePixelRatio||1),this.clearInput(),this.requestFrame()}clearInput(){const t=this.movePointer,e=this.firePointer;this.keys.clear(),this.move={x:0,y:0},this.fireHeld=!1,this.pointerFire=!1,this.movePointer=null,this.firePointer=null;for(const n of[this.elements["move-pad"],this.root.querySelector('[data-control="fire"]'),this.canvas])if(n)for(const i of[t,e])i!==null&&n.hasPointerCapture(i)&&n.releasePointerCapture(i);this.simulation.setInput({moveX:0,moveY:0,firing:!1}),this.elements.stick&&(this.elements.stick.style.transform="translate(-50%,-50%)")}requestFrame(){!this.destroyed&&!this.frame&&!document.hidden&&!this.contextLost&&!this.renderFailed&&!this.orientationBlocked&&(this.frame=requestAnimationFrame(this.animate))}syncPause(){cancelAnimationFrame(this.frame),this.frame=0,this.last=0,this.clearInput(),this.simulation.setPaused(this.manualPause||this.confirmingRetreat||this.orientationBlocked||this.contextLost||this.renderFailed||document.hidden),this.requestFrame()}onBlur=()=>{!this.simulation.state.result&&!this.contextLost&&!this.renderFailed&&(this.manualPause=!0,this.showPanel("pause")),this.syncPause()};onVisibility=()=>{document.hidden&&!this.simulation.state.result&&!this.contextLost&&!this.renderFailed&&(this.manualPause=!0,this.showPanel("pause")),this.syncPause()};onContextLost=t=>{t.preventDefault(),this.contextLost=!0,this.syncPause(),this.showPanel("context")};onContextRestored=()=>{this.contextLost=!1,this.manualPause=!0,this.showPanel("pause"),this.resize(),this.syncPause()};onDown=t=>{if(this.simulation.state.paused||this.simulation.state.result||t.button!==0)return;const e=t.target,n=e.closest('[data-control="move"]'),i=e.closest('[data-control="fire"]'),r=e.closest("button[data-adv]"),a=r?.dataset.adv;if(r&&!r.disabled&&a&&I0.has(a)){this.pointerActionClicks.set(r,performance.now()+1e3),this.performAction(a),t.preventDefault();return}if(n&&this.movePointer===null){this.movePointer=t.pointerId,n.setPointerCapture(t.pointerId),this.updateMove(t,n),t.preventDefault();return}if(i&&this.firePointer===null){this.firePointer=t.pointerId,this.fireHeld=!0,this.aimOrigin={x:t.clientX,y:t.clientY,ax:this.aim.x,ay:this.aim.y},i.setPointerCapture(t.pointerId),t.preventDefault();return}e===this.canvas&&this.firePointer===null&&(this.firePointer=t.pointerId,this.pointerFire=!0,this.fireHeld=!0,this.canvas.setPointerCapture(t.pointerId),this.setAim(t.clientX,t.clientY),t.preventDefault())};onMove=t=>{t.pointerId===this.movePointer?(this.updateMove(t,this.elements["move-pad"]),t.preventDefault()):t.pointerId===this.firePointer?(this.pointerFire?this.setAim(t.clientX,t.clientY):this.aim={x:Math.max(.08,Math.min(.94,this.aimOrigin.ax+(t.clientX-this.aimOrigin.x)/this.width*2.6)),y:Math.max(.12,Math.min(.8,this.aimOrigin.ay+(t.clientY-this.aimOrigin.y)/this.height*1.7))},t.preventDefault()):t.pointerType==="mouse"&&t.target===this.canvas&&this.setAim(t.clientX,t.clientY)};updateMove(t,e){const n=e.getBoundingClientRect(),i=Math.min(n.width,n.height)*.34,r=(t.clientX-n.left-n.width/2)/i,a=(n.top+n.height*.5-t.clientY)/i,o=Math.hypot(r,a),c=Math.max(0,Math.min(1,(o-.12)/.88));this.move={x:o>0?r/o*c:0,y:o>0?a/o*c:0},this.elements.stick.style.transform=`translate(calc(-50% + ${this.move.x*i}px),calc(-50% - ${this.move.y*i}px))`}onUp=t=>{t.pointerId===this.movePointer&&(this.movePointer=null,this.move={x:0,y:0},this.elements.stick.style.transform="translate(-50%,-50%)"),t.pointerId===this.firePointer&&(this.firePointer=null,this.fireHeld=!1,this.pointerFire=!1,this.simulation.setInput({firing:!1}))};setAim(t,e){const n=this.canvas.getBoundingClientRect();this.aim={x:Math.max(.02,Math.min(.98,(t-n.left)/this.width)),y:Math.max(.08,Math.min(.9,(e-n.top)/this.height))}}onClick=t=>{const e=t.target.closest("[data-adv]"),n=e?.dataset.adv;if(!n||!e)return;if((t.detail>0||t instanceof PointerEvent&&t.pointerType!=="")&&(this.pointerActionClicks.get(e)??0)>=performance.now()){this.pointerActionClicks.delete(e);return}this.performAction(n)};performAction(t){if(!(this.simulation.state.result&&t!=="finish"&&t!=="retreat")&&!((this.contextLost||this.renderFailed||this.orientationBlocked)&&t!=="retreat-confirm"&&t!=="finish")){if(t==="pause")this.manualPause=!this.manualPause,this.syncPause(),this.showPanel(this.manualPause?"pause":null);else if(t==="resume")this.manualPause=!1,this.confirmingRetreat=!1,this.syncPause(),this.showPanel(null);else if(t==="retreat"||t==="clear"){if(this.simulation.state.result){this.deliver();return}this.confirmingRetreat=!0,this.syncPause(),this.showPanel("retreat")}else if(t==="retreat-confirm")this.simulation.setPaused(!1),this.simulation.retreat(),this.deliver();else if(t==="finish")this.deliver();else if(!this.simulation.state.paused){if(t==="reload"){const e=this.simulation.state;this.simulation.reload()?this.notice("탄창을 교체하고 있어요."):this.notice(e.reloadRemaining>0?"이미 장전 중이에요.":e.dodgeRemaining>0?"회피를 마치면 장전할 수 있어요.":"탄창이 가득 차 있어요.")}if(t==="dodge"&&!this.simulation.dodge()&&this.notice("잠깐 숨을 고른 뒤 다시 피할 수 있어요."),t==="potion")if(!this.simulation.canUseHealthPotion())this.notice("체력이 무한이에요. 물약은 보관해요.");else{const e=this.options.onUseHealthPotion?.(this.simulation.state.hero.health);e?.ok&&this.simulation.restoreHealth(Sc.health.restore),this.notice(e?.message??"트럭에서 체력 물약을 준비해 주세요.")}if(t==="collect"){const e=this.simulation.nearestObjective();this.notice(this.simulation.collect()?e?.kind==="traveler"?"여행자를 구조했어요.":"물자를 회수했어요. 탄창과 체력을 보충했어요.":"물자나 여행자 가까이에서 회수할 수 있어요.")}(t==="supply"||t==="scout")&&(this.simulation.useSupport(t)?this.notice(t==="supply"?"보급: 탄창을 가득 채우고 체력을 최대 24 회복해요.":"정찰 7초: 적 이동속도 −45% · 보이는 적 체력바 표시",4200):this.notice(this.simulation.state.pets.length?"지원이 다시 준비되길 기다려 주세요.":"함께 온 동물 친구가 있어야 지원을 받을 수 있어요."))}this.refreshHUD()}}onKeyDown=t=>{if(t.key==="Tab"){const i=[...(this.elements.overlay.hidden?this.root:this.elements.overlay).querySelectorAll('button:not(:disabled),summary,[tabindex="0"]')].filter(o=>o.offsetParent!==null&&!o.closest("[inert]")),r=i[0],a=i[i.length-1];t.shiftKey&&document.activeElement===r?(a?.focus(),t.preventDefault()):!t.shiftKey&&document.activeElement===a&&(r?.focus(),t.preventDefault());return}if(this.simulation.state.result||t.ctrlKey||t.metaKey||t.altKey||this.nativePanelActivation(t))return;const e=wl(t);if(e&&(t.preventDefault(),t.stopPropagation(),!(this.contextLost||this.renderFailed||this.orientationBlocked)&&(!this.simulation.state.paused&&L0.has(e)&&this.keys.add(e),!t.repeat))){if(e==="escape"){this.confirmingRetreat?(this.confirmingRetreat=!1,this.syncPause(),this.showPanel(this.manualPause?"pause":null)):this.performAction("pause");return}if(!this.simulation.state.paused){const n={r:"reload",shift:"dodge",f:"collect",q:"supply",e:"scout",h:"potion"}[e];n&&this.performAction(n)}}};nativePanelActivation(t){return(this.simulation.state.paused||!!this.simulation.state.result)&&(t.key===" "||t.key==="Enter")&&t.target instanceof Element&&!!t.target.closest(".adv-overlay button,.adv-overlay summary")}onKeyUp=t=>{if(this.nativePanelActivation(t))return;const e=wl(t);e&&(this.keys.delete(e),!t.ctrlKey&&!t.metaKey&&!t.altKey&&t.preventDefault())};animate=t=>{if(this.frame=0,this.destroyed||document.hidden||this.contextLost||this.orientationBlocked)return;const e=this.last?Math.min(.1,(t-this.last)/1e3):0;this.last=t;const n=this.move.x+(this.keys.has("d")||this.keys.has("arrowright")?1:0)-(this.keys.has("a")||this.keys.has("arrowleft")?1:0),i=this.move.y+(this.keys.has("w")||this.keys.has("arrowup")?1:0)-(this.keys.has("s")||this.keys.has("arrowdown")?1:0),r=this.world.aimTargetLocal(this.aim.x*this.width,this.aim.y*this.height),a=r.point;if(this.simulation.setInput({moveX:n*.953-i*.303,moveY:n*.303+i*.953,aimX:a.x,aimY:a.y,targetId:r.targetId,weakpoint:r.weakpoint,firing:this.fireHeld||this.keys.has(" ")}),this.simulation.tick(e),!this.renderFailed)try{this.world.render(this.simulation.state,e)}catch{this.renderFailed=!0,this.manualPause=!0,this.syncPause(),this.showPanel("fault")}const o=this.elements.reticle;this.aim.x!==this.lastAimX&&(o.style.left=`${this.aim.x*100}%`,this.lastAimX=this.aim.x),this.aim.y!==this.lastAimY&&(o.style.top=`${this.aim.y*100}%`,this.lastAimY=this.aim.y),o.classList.toggle("firing",this.simulation.firing),this.root.classList.toggle("adv-hurt",this.simulation.state.hero.hurt>0),this.root.classList.toggle("adv-reloading",this.simulation.state.reloadRemaining>0),t-this.lastHud>90&&(this.refreshHUD(),this.lastHud=t),this.simulation.state.result&&!this.resultShown&&(this.resultShown=!0,this.resultAnimationUntil=t+650,this.clearInput(),this.showPanel("result")),!this.renderFailed&&(this.simulation.state.result?t<this.resultAnimationUntil:!this.simulation.state.paused)&&this.requestFrame()};notice(t,e=2200){this.lastMessage=t,this.messageUntil=performance.now()+e}text(t,e){this.hudText[t]!==e&&(this.hudText[t]=e,this.elements[t].textContent=e)}refreshHUD(){const t=this.simulation.state,e=this.elements,n=Math.max(0,Math.ceil(t.goalY-t.hero.y)),i=this.simulation.canClear();this.text("distance",i?"적 처치 완료 · 클리어 가능":n?"검문소까지 "+n+" m":"귀환 지점"),e.progress.style.width=`${Math.min(100,t.distance/t.goalY*100)}%`,this.text("goals",`처치 ${t.enemiesDefeated}/${Zs} · 선택 물자 ${t.supplies}/${eo} · 구조 ${t.rescued}/${no}`),this.buttons.clear.hidden=!i||!!t.result,i&&!this.clearReadyAnnounced&&(this.clearReadyAnnounced=!0,this.notice("적을 모두 처치했어요. 지금 클리어하거나 남은 물품을 더 찾을 수 있어요.",5e3)),this.text("time",`${String(Math.floor(t.time/60)).padStart(2,"0")}:${String(Math.floor(t.time%60)).padStart(2,"0")}`),e.health.style.width=`${t.hero.health}%`,this.text("health-label","체력 ∞");const r=this.options.healthPotionCount?.()??0;this.text("potion-count",String(r)),this.buttons.potion.disabled=!this.simulation.canUseHealthPotion()||r<1||!this.options.onUseHealthPotion,this.buttons.potion.setAttribute("aria-label",`체력 무한 · 물약 ${r}개 보관 중`);const a=`${t.ammo} <small>/ ${t.magazine}</small>`;a!==this.lastAmmo&&(e.ammo.innerHTML=a,this.lastAmmo=a),this.text("reload-text",t.reloadRemaining>0?"장전 "+t.reloadRemaining.toFixed(1)+"초":""),this.text("reload-label",t.reloadRemaining>0?"장전 중":"재장전"),this.buttons.reload.setAttribute("aria-label",t.reloadRemaining>0?`장전 중 · ${t.reloadRemaining.toFixed(1)}초 남음`:t.ammo>=t.magazine?"재장전 · R · 탄창이 가득 찼어요":"재장전 · R");for(const l of["supply","scout"]){const h=this.buttons[l],u=t.pets[l==="supply"?0:1]??t.pets[0],d=l==="supply"?"보급 · 탄창 완전 충전 + 체력 최대24 회복 · 재사용22초":"정찰 · 7초간 적 이동속도45% 감소 + 보이는 적 체력바 표시 · 재사용18초",p=t.supportCooldowns[l]>0?` · ${Math.ceil(t.supportCooldowns[l])}초 뒤 재사용`:"";h.title=u?Ec[u.id].name+"의 "+d+p:"함께할 동물을 편성해 주세요",h.setAttribute("aria-label",h.title),h.disabled=!this.simulation.canUseSupport(l),this.text(l+"-cd",t.supportCooldowns[l]>0?Math.ceil(t.supportCooldowns[l])+"초":"")}e["scout-status"].hidden=t.scoutRemaining<=0||!!t.result,this.text("scout-active",Math.ceil(t.scoutRemaining)+"초"),this.buttons.scout.classList.toggle("adv-support-active",t.scoutRemaining>0),this.text("dodge-cd",t.dodgeCooldown>0?Math.ceil(t.dodgeCooldown)+"초":"");const o=this.simulation.nearestObjective(),c=this.buttons.collect;if(c.hidden=!o||!!t.result,this.text("interact",o?.kind==="traveler"?"여행자 구조 · F":"보급품 회수 · F"),e.notice.hidden=performance.now()>this.messageUntil,this.text("notice",this.lastMessage),i){const l=js(t);this.text("instruction",l.hasUnclaimed?`${l.label} · 남겨도 클리어할 수 있어요`:"선택 활동도 모두 마쳤어요 · 클리어·귀환을 눌러요")}else if(t.time<9)this.text("instruction","적을 모두 처치하면 클리어 · 물자 회수와 구조는 선택이에요");else{let l,h=1/0;for(const u of t.objectives){if(u.collected)continue;const d=Math.hypot(u.x-t.hero.x,u.y-t.hero.y);d<h&&(h=d,l=u)}this.text("instruction",l?`선택 ${l.kind==="traveler"?"여행자 구조":"물자 회수"} · ${Math.round(h)} m ${l.y<t.hero.y?"뒤쪽":"앞쪽"}`:"남은 감염체를 모두 처치하면 클리어할 수 있어요.")}}showPanel(t){const e=this.elements.overlay;if(!e||(e.hidden=t===null,t===null))return;const n=this.simulation.state,i=n.result,r=this.simulation.canClear(),a=js(i??n);if(t==="result"&&i)e.innerHTML=`<section class="adv-dialog"><small>ROAD HAVEN · 위험구역 탐색</small><h2>${i.outcome==="victory"?"클리어 · 함께 길을 열었어요":i.outcome==="defeat"?"안전한 곳으로 돌아가요":"트럭으로 귀환해요"}</h2><p>${i.outcome==="victory"?"적을 모두 처치해 길을 열었어요. 클리어 보상을 받아요.":i.outcome==="defeat"?"이번 길은 여기까지. 동물 친구들은 무사해요.":"다음 여행을 위해 안전하게 돌아가요."}</p><div class="adv-result-stats"><span>전진 <b>${Math.floor(i.distance)} m</b></span><span>물자 회수 <b>${i.supplies}/${eo}</b></span><span>구조 완료 <b>${i.rescued}/${no}</b></span><span>처치 <b>${i.enemiesDefeated}/${Zs}</b></span></div>${this.unclaimedNotice(i,i.outcome==="victory")}${i.outcome==="victory"?`<p class="adv-rewards">클리어 보상 · 식량 +${6+i.stage*2} · 고철 +${i.stage*2} · 목재 +2</p>`:""}<button data-adv="finish">트럭으로 돌아가기</button></section>`;else{const o=t==="retreat",c=t==="context"||t==="fault",l=Math.max(0,Zs-n.enemiesDefeated),h=o?r?"클리어하고 돌아갈까요?":"탐색을 마치고 돌아갈까요?":t==="context"?"화면을 복구하고 있어요":t==="fault"?"안전하게 돌아가요":"잠시 쉬어 가요",u=o?r?"적을 모두 처치해 클리어할 수 있어요. 남은 물자 회수와 구조는 선택이에요.":`아직 적 ${l}마리가 남아 있어요. 지금 귀환하면 클리어 보상은 받지 못해요.`:t==="context"?"화면이 돌아오면 이어서 진행할 수 있어요. 귀환하면 전투는 마무리됩니다.":t==="fault"?"이 기기에서 전투 화면을 이어갈 수 없어요. 귀환하면 안전하게 탐색을 마무리합니다.":"WASD 이동 · 마우스 조준·사격 · R 장전 · Shift 회피 · F 회수 · H 물약 · Q/E 지원";e.innerHTML=`<section class="adv-dialog"><small>ROAD HAVEN · ${o?"귀환 안내":"잠시 숨을 고르세요"}</small><h2>${h}</h2><p>${u}</p>${o||c?this.unclaimedNotice(n,r):this.supportHelp()}${c?"":`<button data-adv="resume">${o&&a.hasUnclaimed?"물품 더 찾기":o?"탐색 이어가기":"이어서 진행하기"}</button>`}<button class="adv-dialog-secondary" data-adv="${t==="pause"?"retreat":"retreat-confirm"}">${t==="pause"?r?"클리어 · 귀환 안내":"귀환 안내":r?"그대로 클리어":"그대로 귀환"}</button></section>`}e.querySelector("button")?.focus()}unclaimedNotice(t,e){const n=js(t);return n.hasUnclaimed?`<div class="adv-unclaimed" role="status"><strong>아직 남은 선택 항목</strong><p>${Al(n.label)}</p><span>${e?"남겨 둔 항목은 회수·구조 기록에 포함되지 않아요. 클리어 보상은 그대로 받아요.":"회수하지 않은 물자와 구조하지 않은 여행자가 남아 있어요."}</span></div>`:""}supportHelp(){return'<details class="adv-support-help"><summary>보급·정찰 기능 보기</summary><dl><dt>보급 · Q</dt><dd>탄창을 가득 채우고 체력을 최대 24 회복해요.<br>다시 사용하기까지 22초</dd><dt>정찰 · E</dt><dd>7초 동안 적 이동속도를 45% 낮추고, 보이는 적의 체력바를 표시해요.<br>다시 사용하기까지 18초</dd></dl></details>'}deliver(){this.delivered||!this.simulation.state.result||(this.delivered=!0,this.options.onFinish({...this.simulation.state.result}))}}export{N0 as AdvancingBattleView};
