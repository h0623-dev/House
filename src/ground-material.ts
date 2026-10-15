import { GROUND_RESOURCE_NODES, type GroundResourceNode } from './ground-resources';
import { GROUND_LANDSCAPE_BOUNDS } from './ground-visuals';

type Point = readonly [number, number];
const tones = {
  tree: ['#9ca27b', '#afa184', '#8e9774'],
  seed: ['#acb387', '#b4b690', '#9ca97e'],
  scrap: ['#b7ac96', '#a69c88', '#beb39c'],
  water: ['#a3afa0', '#afb59d', '#96a69a'],
} as const;

function random(seed: number) {
  let value = seed >>> 0;
  return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** A wash has no rim or hard silhouette. Overlapping brush marks create one
 * forest floor/meadow/bank, rather than a round display plinth per collectible. */
function wash(c: CanvasRenderingContext2D, point: Point, radius: number, color: string, alpha: number) {
  c.save(); c.translate(point[0], point[1]); c.scale(radius, radius * .43);
  const paint = c.createRadialGradient(0, 0, .08, 0, 0, 1);
  paint.addColorStop(0, color); paint.addColorStop(.38, `${color}bb`); paint.addColorStop(1, `${color}00`);
  c.globalAlpha *= alpha; c.fillStyle = paint; c.fillRect(-1, -1, 2, 2); c.restore();
}

/** Authored resource positions receive their material inside the same cached
 * terrain painting. This is scenery only; no new targets or obstacles exist. */
export function paintGatheringGround(c: CanvasRenderingContext2D, width: number, height: number) {
  const b = GROUND_LANDSCAPE_BOUNDS;
  c.save(); c.scale(width / (b.right - b.left), height / (b.bottom - b.top)); c.translate(-b.left, -b.top);
  GROUND_RESOURCE_NODES.forEach((node, index) => {
    const rng = random(0x71a3 + index * 977), palette = tones[node.kind], [x, y] = node.point;
    // Break up the bank into offset, differently sized brush marks.
    for (let mark = 0; mark < 7; mark++) {
      const angle = rng() * Math.PI * 2, distance = rng() * 34 * node.scale;
      wash(c, [x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * .45],
        (28 + rng() * 30) * node.scale, palette[mark % palette.length], .20);
    }
    // Join nearby habitats gently so forest trees grow out of shared soil.
    const neighbours = GROUND_RESOURCE_NODES.filter(other => other !== node && other.regionId === node.regionId)
      .map(other => ({ node: other, distance: Math.hypot(other.point[0] - x, other.point[1] - y) }))
      .filter(other => other.distance < 210).sort((a, b) => a.distance - b.distance).slice(0, 2);
    for (const neighbour of neighbours) {
      const otherIndex = GROUND_RESOURCE_NODES.indexOf(neighbour.node);
      if (otherIndex < index) continue;
      const steps = Math.max(2, Math.ceil(neighbour.distance / 23));
      for (let step = 1; step < steps; step++) {
        const t = step / steps;
        wash(c, [x + (neighbour.node.point[0] - x) * t + (rng() - .5) * 14,
          y + (neighbour.node.point[1] - y) * t + (rng() - .5) * 9], 25 + rng() * 18,
          palette[step % palette.length], .10);
      }
    }
    scatter(c, node, rng);
  });
  c.restore();
}

function scatter(c: CanvasRenderingContext2D, node: GroundResourceNode, rng: () => number) {
  const [x, y] = node.point;
  for (let index = 0; index < 20; index++) {
    const angle = rng() * Math.PI * 2, distance = 12 + rng() * 43 * node.scale,
      px = x + Math.cos(angle) * distance, py = y + Math.sin(angle) * distance * .43;
    c.save(); c.translate(px, py); c.rotate((rng() - .5) * 1.1);
    c.globalAlpha = .12 + rng() * .15;
    if (node.kind === 'scrap' || node.kind === 'water') {
      c.fillStyle = index % 2 ? '#87917b' : '#d2c4a6'; c.beginPath();
      c.ellipse(0, 0, 1.5 + rng() * 2.6, .6 + rng(), 0, 0, Math.PI * 2); c.fill();
    } else {
      c.strokeStyle = node.kind === 'tree' ? '#867c59' : '#8d9d6b'; c.lineWidth = .8 + rng() * .6;
      c.beginPath(); c.moveTo(-2, 1); c.quadraticCurveTo(-1, -2, 2, -3 - rng() * 3); c.stroke();
    }
    c.restore();
  }
}
