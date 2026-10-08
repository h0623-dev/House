export type GesturePoint = { x: number; y: number };
export type PinchChange = { from: GesturePoint; to: GesturePoint; ratio: number };

export const MIN_MAP_ZOOM = .75;
export const MAX_MAP_ZOOM = 2.5;

export function clampMapZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom)) : 1;
}

/** Keep the world point under the fingers fixed as their midpoint moves and zoom changes. */
export function anchoredCameraChange(input: {
  camera: GesturePoint; scale: number; zoom: number; nextZoom: number;
  origin: GesturePoint; center: GesturePoint; from: GesturePoint; to: GesturePoint;
}): { zoom: number; ratio: number; delta: GesturePoint } {
  const zoom = clampMapZoom(input.nextZoom), ratio = zoom / input.zoom;
  const world = { x: (input.from.x - input.origin.x) / input.scale, y: (input.from.y - input.origin.y) / input.scale };
  const nextScale = input.scale * ratio;
  return { zoom, ratio, delta: {
    x: world.x - (input.to.x - input.center.x) / nextScale - input.camera.x,
    y: world.y - (input.to.y - input.center.y) / nextScale - input.camera.y,
  } };
}

/** A pinch consumes every participating finger until they are all lifted, including a third finger. */
export class MapPinchGesture {
  private pointers = new Map<number, GesturePoint>();
  private pinching = false;
  private previous: { middle: GesturePoint; distance: number } | null = null;

  get active() { return this.pinching; }
  get pointerIds() { return [...this.pointers.keys()]; }

  down(pointerId: number, point: GesturePoint): boolean {
    this.pointers.set(pointerId, point);
    if (this.pointers.size >= 2) this.pinching = true;
    this.previous = this.measure();
    return this.pinching;
  }

  move(pointerId: number, point: GesturePoint): { consumed: boolean; change: PinchChange | null } {
    if (!this.pointers.has(pointerId)) return { consumed: this.pinching, change: null };
    this.pointers.set(pointerId, point);
    const next = this.measure(), previous = this.previous;
    this.previous = next;
    if (!this.pinching || !previous || !next) return { consumed: this.pinching, change: null };
    return { consumed: true, change: { from: previous.middle, to: next.middle, ratio: next.distance / previous.distance } };
  }

  up(pointerId: number): boolean {
    const consumed = this.pinching;
    this.pointers.delete(pointerId);
    this.previous = this.measure();
    if (!this.pointers.size) this.pinching = false;
    return consumed;
  }

  reset() { this.pointers.clear(); this.previous = null; this.pinching = false; }

  private measure() {
    const points = [...this.pointers.values()];
    if (points.length < 2) return null;
    return { middle: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
      distance: Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)) };
  }
}
