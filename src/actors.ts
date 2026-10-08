/** Original layered chibi artwork, shared by the deck and roadside adventures. */
export type HeroPose = 'idle' | 'walk' | 'sow' | 'water' | 'harvest' | 'chop' | 'attack' | 'skill' | 'hurt' | 'celebrate';
export interface HeroOptions {
  x: number; y: number; scale: number; time: number;
  gender: 'female' | 'male'; pose: HeroPose; facing: 1 | -1; progress?: number;
}
const paths = new Map<string, Path2D>();
function geometry(d: string) { let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p); } return p; }
const TAU = Math.PI * 2;

/** x/y anchor the soles. At scale=1 the standing character is about 120px tall. */
export function drawHero(c: CanvasRenderingContext2D, o: HeroOptions): void {
  const female = o.gender === 'female', t = o.time, pose = o.pose;
  const moving = pose === 'walk', working = ['sow', 'water', 'harvest', 'chop'].includes(pose);
  const phase = o.progress === undefined ? (t * (pose === 'chop' ? 1.6 : 1.15)) % 1 : Math.max(0, Math.min(1, o.progress));
  const cycle = Math.sin(phase * TAU), stride = Math.sin(t * 10), action = Math.sin(phase * Math.PI);
  const ink = '#34374c', hair = female ? '#754535' : '#293e57', hairLight = female ? '#bd7850' : '#567899';
  const coat = female ? '#438e86' : '#536d9e', coatLight = female ? '#86c6ad' : '#87a7cd';
  const bob = moving ? -Math.abs(stride) * 3 : pose === 'celebrate' ? -Math.abs(Math.sin(t * 7)) * 8 : Math.sin(t * 2.8) * .8;
  const lean = moving ? .075 : working ? .10 + action * .07 : pose === 'attack' || pose === 'skill' ? action * .16 : pose === 'hurt' ? -.13 : 0;
  const fill = (d: string, color: string | CanvasGradient, stroke = ink, width = 1.3) => {
    const p = geometry(d); c.fillStyle = color; c.fill(p);
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(p); }
  };
  const line = (d: string, color: string, width = 1.4) => { c.strokeStyle = color; c.lineWidth = width; c.stroke(new Path2D(d)); };
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string | CanvasGradient, outline = '') => {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = color; c.fill();
    if (outline) { c.strokeStyle = outline; c.lineWidth = 1.2; c.stroke(); }
  };
  const gradient = (y1: number, y2: number, a: string, b: string) => { const g = c.createLinearGradient(-12, y1, 18, y2); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const limb = (points: [number, number][], color: string | CanvasGradient, width: number) => {
    c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
    c.strokeStyle = ink; c.lineWidth = width + 2.2; c.stroke(); c.strokeStyle = color; c.lineWidth = width; c.stroke();
  };
  const hand = (x: number, y: number) => { ellipse(x, y, 4.2, 4.6, '#f6cbb1', '#7e6666'); line(`M${x - 2},${y + 1}l3,1`, '#da9e8a', .8); };
  c.save(); c.translate(o.x, o.y); c.scale(o.scale * o.facing, o.scale); c.lineJoin = 'round'; c.lineCap = 'round';
  ellipse(1, 1, 22, 5, 'rgba(30,43,49,.18)');
  c.translate(0, bob); c.rotate(lean);

  // Trailing scarf, hair, and satchel sit behind the articulated body.
  c.save(); c.translate(-12, -64); c.rotate(Math.sin(t * 4) * .07 + (moving ? -.24 : 0));
  fill('M0 0Q-12 0-24 8L-22 15-15 11-13 16Q-8 9 4 6Z', female ? '#f6b664' : '#73cdbd');
  line('M-2 3Q-13 7-19 11', female ? '#d08353' : '#38948e'); c.restore();
  if (female) {
    fill('M-21-99Q-31-85-27-63L-31-58-23-55-19-58Q-15-47-7-55L18-54Q29-56 25-77L25-99Z', gradient(-105, -54, hairLight, hair));
    c.save(); c.translate(-22, -77); c.rotate(Math.sin(t * 4.5) * .09 + (moving ? -.13 : 0));
    for (let n = 0; n < 4; n++) { ellipse(n % 2 ? -1 : 1, n * 6, 5.6 - n * .45, 5.2, n % 2 ? '#965b3f' : '#ad6c45', '#684234'); line(`M-2 ${n * 6 - 1}l4 3`, '#d39763', .9); }
    fill('M-5 19-9 23-4 27 0 23 5 26 7 21 1 20Z', '#e9ac65'); c.restore();
  }
  fill('M-19-55Q-29-56-28-43L-23-28-12-29-10-49Z', '#b88454');
  fill('M-25-50-14-51-15-41-26-41Z', '#d9ad71'); line('M-22-44v6', '#745341');

  const leftFoot = moving ? stride * 8 : pose === 'attack' || pose === 'skill' ? -action * 6 : 0;
  const rightFoot = moving ? -stride * 8 : pose === 'attack' || pose === 'skill' ? action * 7 : 1;
  const legs = (x: number, foot: number, back: boolean) => {
    const lift = moving ? Math.max(0, back ? -stride : stride) * 4 : 0;
    limb([[x, -30], [x + foot * .35, -18 - lift], [x + foot, -7 - lift]], back ? '#40485f' : '#525b73', 8);
    c.save(); c.translate(x + foot, -lift); c.rotate(moving ? foot * -.016 : 0);
    fill('M-4-12 4-12 5-5Q12-5 11 0L-5 0Q-7-5-4-12Z', gradient(-12, 0, '#94745d', '#514957'));
    fill('M-5-3Q2-1 11-2L11 1-5 1Z', '#303749'); line('M-3-9h6M-3-6h6', '#e4bd84', 1.1); c.restore();
  };
  legs(-8, leftFoot, true); legs(8, rightFoot, false);

  let near: [number, number] = [20, -38], elbow: [number, number] = [22, -49];
  let far: [number, number] = [-19, -38];
  if (moving) { near = [17 + stride * 11, -37 - Math.max(0, stride) * 5]; elbow = [19 + stride * 4, -48]; far = [-19 - stride * 9, -38 + stride * 3]; }
  if (pose === 'sow') { near = [25 + cycle * 7, -43 + cycle * 3]; elbow = [23, -53]; far = [-11, -39]; }
  if (pose === 'water') { near = [28, -43 + cycle]; elbow = [23, -50]; far = [10, -42]; }
  if (pose === 'harvest') { near = [28 + cycle * 5, -31 + cycle * 6]; elbow = [21, -46]; far = [-15, -31]; }
  if (pose === 'chop') { near = [17 + action * 21, -81 + action * 39]; elbow = [22, -65 + action * 11]; far = [near[0] - 10, near[1] + 6]; }
  if (pose === 'attack' || pose === 'skill') { near = [14 + action * 25, -62 + action * 16]; elbow = [23 + action * 5, -55]; far = [-23 - action * 2, -47]; }
  if (pose === 'celebrate') { near = [28, -82 + Math.sin(t * 7) * 3]; elbow = [27, -65]; far = [-28, -77]; }
  if (pose === 'hurt') { near = [10, -48]; elbow = [24, -44]; far = [-14, -47]; }
  limb([[-13, -59], [-22, -48], far], coat, 9); hand(...far);

  // Layered expedition jacket, crossbody strap, stitching, and small belt pouches.
  fill('M-13-67Q-20-58-19-42L-21-27Q-2-20 20-27L16-45Q20-58 12-65Z', gradient(-68, -23, coatLight, coat));
  fill('M-7-63 9-62 12-30-10-29Z', '#f5e9ce');
  fill('M-14-62-6-64-3-49-8-43-4-27-19-28Z', coat);
  fill('M9-63 15-59 18-28 6-27 6-45 11-49Z', coat);
  line('M-16-39-8-39M11-39h5', female ? '#b6dfc0' : '#abc5e2', 1);
  if (female) { fill('M-15-30 15-30 20-21Q3-17-19-23Z', '#344a66'); line('M-10-27-12-22M0-27v5M10-27l2 5', '#647695', 1); }
  fill('M-17-34 18-34 19-29-18-29Z', '#785647');
  fill('M-1-35 5-35 5-28-1-28Z', '#e1b866'); fill('M1-33 3-33 3-30 1-30Z', '#785647', '', 0);
  fill('M11-34 20-33 20-24 11-24Z', '#bb8854'); line('M12-30h7', '#e3b576'); ellipse(15.5, -28, 1, 1, '#f9d481');
  line('M-12-62 11-35', '#594941', 5); line('M-12-62 11-35', '#bd9465', 2.4);
  fill('M-13-66Q0-58 15-66L15-58Q1-53-14-60Z', female ? '#ffc16e' : '#87d9c5');
  line('M-11-62Q0-57 11-61', female ? '#d79350' : '#4aaca3', 1.2);
  fill('M2-60 10-61 14-50 8-46 5-52Z', female ? '#efaa5d' : '#68bdb0');
  ellipse(12, -55, 2, 2, '#ffdf90', '#776951');

  // Head follows the body with a softer, delayed tilt.
  c.save(); c.translate(1, -81); c.rotate(-lean * .6 + Math.sin(t * 2.1) * .019); c.translate(-1, 81);
  if (!female) fill('M-24-80Q-31-101-14-113L-20-115Q-9-120 2-116L10-121 17-114 25-116 24-108Q33-98 24-78L16-71-15-73Z', gradient(-120, -72, hairLight, hair));
  else fill('M-25-79Q-32-105-11-117Q10-125 24-105L28-78 17-67-18-70Z', gradient(-119, -75, hairLight, hair));
  ellipse(-21, -84, 5, 7, '#edb89e', '#875c50'); ellipse(24, -82, 4, 6, '#edb89e', '#875c50');
  fill('M-21-98Q-17-111 3-110Q23-107 24-90L22-79Q18-66 3-65Q-12-65-20-78Z', gradient(-106, -64, '#fff0cf', '#f3c4a5'), '#915f52');
  const cheek = (x: number) => { const g = c.createRadialGradient(x, -78, 0, x, -78, 7); g.addColorStop(0, 'rgba(231,116,117,.40)'); g.addColorStop(1, 'rgba(231,116,117,0)'); ellipse(x, -78, 7, 4, g); };
  cheek(-12); cheek(18);
  const blink = (t + (female ? 0 : 1.7)) % 5.4 < .13, hurt = pose === 'hurt';
  const eye = (x: number, y: number, size: number) => {
    if (blink || hurt || pose === 'celebrate') { line(`M${x-5*size} ${y}q${5*size} ${hurt ? 4 : -5} ${10*size} 0`, ink, 1.8); return; }
    c.save(); c.translate(x,y); c.scale(size,size);
    fill('M-5-4Q0-8 5-3L5 3Q1 7-4 4Z', '#fffaf0', '#574a50', .9);
    ellipse(1, 0, 3.9, 5.4, gradient(-5,5, female ? '#755231' : '#254d74', female ? '#e2ad5c' : '#70c8d0'));
    ellipse(1, -1, 1.9, 3.8, '#303645'); ellipse(-.4, -2.8, 1.7, 1.9, '#fffdf4'); ellipse(2.5, 2, 1.0, .9, '#fff9ce');
    line('M-6-3Q-1-8 5-3', '#343745', 1.8); line('M-5-4-7-6', '#343745', 1.1); c.restore();
  };
  eye(-7,-85,.94); eye(13,-84,1.05);
  line('M-12-94q4-2 8 0M9-93q4-2 8 0', hair, 1.2);
  line('M5-79l1 1-2 1', '#d79d85', .9);
  if (pose === 'celebrate' || pose === 'skill') { fill('M-1-73Q5-70 10-73Q9-66 5-66Q1-66-1-73Z', '#904e58', '#9b6261', .8); ellipse(5,-68,3,1.5,'#efad9c'); }
  else line('M1-72q4 3 8-1', '#a26763', 1.2);
  // Chunky locks overlap the upper face, with individual lit strands.
  if (female) {
    fill('M-26-91Q-28-110-10-117Q11-123 22-108Q27-98 25-87L19-89 14-100Q11-92 3-89L4-102Q-4-91-11-89L-10-102Q-14-94-21-90L-20-81-26-83Z', gradient(-120,-83, '#bb774d', '#764739'));
    line('M-19-104q7-11 18-10M5-114q8 1 13 9', '#e0a271', 2.3); line('M-16-97q4-7 9-10M9-106l-2 9', '#d09160', 1.4);
    fill('M-24-96-30-101-28-91-22-92-20-86-16-93Z', '#8dcab4', '#46695f', 1);
    ellipse(-23,-94,2.4,2.4,'#f5d185','#967f59');
    line('M16-104l6 2M16-102l6 2', '#f5cd83', 1.5);
  } else {
    fill('M-25-87-27-102-20-109-23-112-10-112-6-117 4-112 14-116 17-109 25-111 23-102 27-92 19-88 14-98 7-91 6-102-4-91-5-102-14-94-15-103-22-89Z', gradient(-119,-85, '#6888a8', '#304b68'));
    line('M-19-108l10-3M-8-110l5 2M4-109l8-2', '#a6c4d6', 2); line('M-19-101l6-4M-2-103l5-3M16-102l4-1', '#739bb8', 1.2);
    fill('M-22-98-20-91-17-92-18-99Z', '#b8bc99', '#637f84', .7);
  }
  c.restore();

  // The near sleeve and hand are drawn last to keep tools readable against the face.
  limb([[13,-59], elbow, [near[0]-2,near[1]-2]], gradient(-60,-37,coatLight,coat), 9);
  limb([[near[0]-3,near[1]-5],[near[0]-1,near[1]-2]], '#ede2c6', 9);
  hand(...near);
  c.save(); c.translate(...near);
  if (pose === 'sow') {
    fill('M-3 4Q-7 10-4 17L5 18Q9 12 4 4Z', '#d5ad6d', '#816343'); line('M-3 7h7', '#9d7545');
    for (let n=0;n<5;n++) { const p=(phase+n*.19)%1; ellipse(6+p*27, 1-p*17+p*p*43, 1.3, 2, '#f5d693', '#987249'); }
  }
  if (pose === 'water') {
    c.rotate(.16 + Math.sin(t * 4)*.04);
    line('M0 6Q-7-9 5-9Q14-7 10 7', '#387788', 3.5);
    fill('M-5 0 12-1 13 15-4 15Z', gradient(0,16,'#94d4d9','#448d9b'));
    fill('M11 7 23 1 25 5 13 14Z', '#6aabb4'); fill('M22 0 27-2 29 5 25 7Z', '#acdae0');
    line('M-1 3v8', '#d1eeee', 2);
    for (let n=0;n<7;n++) { const p=(t*1.6+n*.15)%1; ellipse(28+p*10+(n%2)*2,4+p*27, .9, 1.8,'#9de5eb'); }
  }
  if (pose === 'harvest') {
    c.rotate(-.8+cycle*.6);
    line('M0 4 3 18', '#72503f', 5); line('M0 4 3 18', '#c39053', 2.7);
    fill('M1 5Q-15 3-11-10Q-8-19 4-16Q-6-12-6-6Q-5 0 2 1Z', gradient(-18,5,'#eef6dc','#89acac'), '#546879');
  }
  if (pose === 'chop') {
    c.rotate(-1.35 + action*1.9);
    line('M0 9 1-29','#654b40',5); line('M0 9 1-29','#c59762',2.8);
    fill('M0-29 12-33 19-28 16-18 1-22Z', gradient(-32,-18,'#f1eacb','#8ba4ae'), '#506371');
    line('M14-30l-2 10', '#d9e5d5', 2);
  }
  if (pose === 'attack' || pose === 'skill') {
    c.rotate(-1.15 + action * 1.75);
    if (pose === 'skill') { c.save(); c.globalAlpha=.45 + action*.3; c.shadowBlur=15; c.shadowColor='#92f5e3'; line('M1-11 3-48','#b4ffef',10); c.restore(); }
    fill('M-3-9-3-39 2-52 7-40 6-9Z', gradient(-50,-9,'#fffbe4','#8cb6c7'), '#415878');
    line('M2-46 2-12', '#e4f4e9', 1.5); fill('M-9-12 12-12 11-7-8-7Z', '#e8bf68');
    line('M1-5 1 7','#674849',4.5); line('M0-3l3 1M0 1l3 1', '#d0a769', 1);
  }
  c.restore();
  if (pose === 'skill' && action > .25) {
    c.save(); c.globalAlpha=action*.75;
    c.strokeStyle='#b6ffea'; c.lineWidth=5; c.beginPath(); c.ellipse(19,-59,49,40,-.25,-1.2,1.6); c.stroke();
    c.strokeStyle='#fff9c9'; c.lineWidth=1.5; c.beginPath(); c.ellipse(19,-59,54,43,-.25,-1,1.3); c.stroke(); c.restore();
  }
  c.restore();
}
