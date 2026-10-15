import { heroImages } from './character-art';

export type GatheringToolKind = 'chop' | 'mine' | 'pluck' | 'scoop';

const sourceScale = 128 / 453;
const axeHeadOutline: ReadonlyArray<readonly [number, number]> = [
  [1443, 105], [1453, 81], [1467, 73], [1483, 84], [1495, 97],
  [1522, 110], [1521, 126], [1511, 145], [1491, 158], [1480, 134], [1462, 119],
];

function woodHandle(c: CanvasRenderingContext2D, topX: number, topY: number): void {
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(-4, 13); c.quadraticCurveTo(4, -11, topX, topY);
  c.strokeStyle = '#59432f'; c.lineWidth = 5.3; c.stroke();
  const grain = c.createLinearGradient(-4, 0, 8, 2);
  grain.addColorStop(0, '#956239'); grain.addColorStop(.45, '#d2a365'); grain.addColorStop(1, '#90613c');
  c.strokeStyle = grain; c.lineWidth = 3.5; c.stroke();
  c.beginPath(); c.moveTo(-3.7, 11); c.quadraticCurveTo(3, -9, topX - .8, topY + 1);
  c.strokeStyle = 'rgba(242,207,145,.5)'; c.lineWidth = .7; c.stroke();
  for (let i = 0; i < 3; i++) {
    const y = 8 - i * 2.4;
    c.beginPath(); c.moveTo(-4 + i * .65, y); c.lineTo(-.8 + i * .65, y + 1);
    c.strokeStyle = 'rgba(94,66,41,.55)'; c.lineWidth = .8; c.stroke();
  }
}

function paintedAxe(c: CanvasRenderingContext2D): void {
  woodHandle(c, 13, -42);
  const atlas = heroImages.actions;
  if (atlas.complete && atlas.naturalWidth > 0) {
    // The metal blade belongs to the existing survivor painting. Follow its
    // outline so the neighbouring hair, fingers and old shaft are excluded.
    c.save();
    c.beginPath();
    axeHeadOutline.forEach(([x, y], i) => {
      const localX = (x - 1425) * sourceScale;
      const localY = (y - 234) * sourceScale;
      if (i === 0) c.moveTo(localX, localY); else c.lineTo(localX, localY);
    });
    c.closePath(); c.clip();
    c.drawImage(atlas, 1440, 70, 86, 90,
      (1440 - 1425) * sourceScale, (70 - 234) * sourceScale,
      86 * sourceScale, 90 * sourceScale);
    c.restore();
    return;
  }
  // A painted palette keeps the tool legible during the atlas's first load.
  const steel = c.createLinearGradient(5, -47, 29, -24);
  steel.addColorStop(0, '#e3d8bd'); steel.addColorStop(.28, '#a8aaa0');
  steel.addColorStop(.7, '#777c78'); steel.addColorStop(1, '#d5c9ae');
  c.beginPath(); c.moveTo(8, -46); c.lineTo(18, -41);
  c.quadraticCurveTo(22, -35, 29, -34); c.quadraticCurveTo(27, -26, 20, -23);
  c.lineTo(15, -33); c.lineTo(5, -38); c.closePath();
  c.fillStyle = steel; c.fill(); c.strokeStyle = '#635b4f'; c.lineWidth = 1; c.stroke();
}

function paintedPick(c: CanvasRenderingContext2D): void {
  woodHandle(c, 12, -38);
  const steel = c.createLinearGradient(-7, -42, 31, -29);
  steel.addColorStop(0, '#d1c7ad'); steel.addColorStop(.3, '#8e9892');
  steel.addColorStop(.58, '#c0beb0'); steel.addColorStop(1, '#646f6b');
  c.beginPath(); c.moveTo(-9, -32); c.quadraticCurveTo(-2, -44, 12, -43);
  c.quadraticCurveTo(27, -44, 32, -31); c.quadraticCurveTo(21, -38, 12, -37);
  c.quadraticCurveTo(1, -39, -9, -32); c.closePath();
  c.fillStyle = steel; c.fill(); c.strokeStyle = '#505b54'; c.lineWidth = 1; c.stroke();
  c.beginPath(); c.moveTo(-5, -35); c.quadraticCurveTo(11, -44, 27, -35);
  c.strokeStyle = '#e4d9bd'; c.lineWidth = .7; c.stroke();
  c.fillStyle = '#6d7367'; c.fillRect(9, -42, 5, 7);
  c.fillStyle = '#b6b69d'; c.fillRect(10, -41, 1.2, 5);
}

function pickedSprig(c: CanvasRenderingContext2D): void {
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, 1); c.quadraticCurveTo(5, 7, 12, 9);
  c.strokeStyle = '#6e6c37'; c.lineWidth = 1.6; c.stroke();
  const leaf = c.createLinearGradient(2, 0, 12, 9);
  leaf.addColorStop(0, '#bacb72'); leaf.addColorStop(.5, '#7f994e'); leaf.addColorStop(1, '#536e3c');
  c.fillStyle = leaf; c.strokeStyle = '#5b733b'; c.lineWidth = .45;
  for (const [x, y, angle] of [[3, 3, -.8], [6, 6, .75], [9, 7, -.75]]) {
    c.save(); c.translate(x, y); c.rotate(angle);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-2, -4, 1, -6);
    c.quadraticCurveTo(5, -3, 0, 0); c.fill(); c.stroke(); c.restore();
  }
  const pod = c.createRadialGradient(11, 8, .4, 11.5, 9, 3.2);
  pod.addColorStop(0, '#e4c779'); pod.addColorStop(.6, '#b6964f'); pod.addColorStop(1, '#7c6b39');
  c.beginPath(); c.ellipse(11.5, 9, 2.7, 2, .3, 0, Math.PI * 2);
  c.fillStyle = pod; c.fill();
}

function waterPail(c: CanvasRenderingContext2D, angle: number): void {
  // The grip remains at the origin while the pail tilts with the wrist.
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(-3, 7); c.bezierCurveTo(-5, -4, 13, -5, 15, 6);
  c.strokeStyle = '#5a6552'; c.lineWidth = 2.8; c.stroke();
  c.strokeStyle = '#c5bda0'; c.lineWidth = 1.2; c.stroke();
  const body = c.createLinearGradient(-5, 7, 16, 12);
  body.addColorStop(0, '#798975'); body.addColorStop(.26, '#aab39a');
  body.addColorStop(.65, '#718570'); body.addColorStop(1, '#4f695b');
  c.beginPath(); c.moveTo(-4, 5); c.lineTo(-1, 19);
  c.quadraticCurveTo(6, 23, 13, 18); c.lineTo(16, 5); c.closePath();
  c.fillStyle = body; c.fill(); c.strokeStyle = '#526653'; c.lineWidth = 1; c.stroke();
  c.beginPath(); c.ellipse(6, 5, 10, 3.9, 0, 0, Math.PI * 2);
  c.fillStyle = '#536c61'; c.fill(); c.strokeStyle = '#c2c3a5'; c.lineWidth = 1.6; c.stroke();
  c.save();
  c.beginPath(); c.ellipse(6, 5, 8.4, 2.7, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = 'rgba(137,195,187,.8)'; c.fillRect(-4, 3.6 + Math.sin(angle * 2) * .9, 21, 6);
  c.beginPath(); c.ellipse(5, 4.7 + Math.sin(angle * 2) * .7, 5.7, 1, -.12, 0, Math.PI);
  c.strokeStyle = 'rgba(219,239,211,.75)'; c.lineWidth = .8; c.stroke(); c.restore();
  c.beginPath(); c.moveTo(-.1, 9); c.lineTo(2, 18);
  c.strokeStyle = 'rgba(213,218,183,.55)'; c.lineWidth = 1.2; c.stroke();
  c.fillStyle = '#6c6448';
  c.beginPath(); c.ellipse(0, -.1, 3, 1.5, 0, 0, Math.PI * 2); c.fill();
}

/** Draw at the survivor's moving grip and return its rotated contact point. */
export function drawGatheringTool(
  c: CanvasRenderingContext2D,
  kind: GatheringToolKind,
  angle: number,
): { x: number; y: number } {
  c.save(); c.rotate(angle);
  if (kind === 'chop') paintedAxe(c);
  else if (kind === 'mine') paintedPick(c);
  else if (kind === 'pluck') pickedSprig(c);
  else waterPail(c, angle);
  c.restore();
  const contact = kind === 'chop' || kind === 'mine' ? { x: 15, y: -35 } : { x: 7, y: 6 };
  return {
    x: contact.x * Math.cos(angle) - contact.y * Math.sin(angle),
    y: contact.x * Math.sin(angle) + contact.y * Math.cos(angle),
  };
}
