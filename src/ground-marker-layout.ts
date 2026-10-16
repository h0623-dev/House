import { layoutProductionBubbles } from './production-bubble-layout';
import type { GroundResourceId, GroundResourceKind, GroundResource } from './ground-resources';

export type GroundMarkerStatus = 'ready' | 'working' | 'cooldown' | 'unaffordable';
export interface GroundMarkerInput {
  id: GroundResourceId; index: number; kind: GroundResourceKind; resource: GroundResource;
  ready: boolean; active: boolean; affordable: boolean; remainingSeconds: number;
  anchor: [number, number]; spriteBounds: [number, number, number, number]; distance: number;
}
export interface GroundMarker {
  nodeId: GroundResourceId; index: number; nodeIds: GroundResourceId[]; resource: GroundResource;
  label: string; status: GroundMarkerStatus; remainingSeconds: number; count: number; readyCount: number;
  anchor: [number, number]; screenBounds: [number, number, number, number];
  hitScreenBounds: [number, number, number, number]; displaced: boolean;
}
export interface GroundMarkerViewport { left: number; top: number; right: number; bottom: number }
export const GROUND_MARKER_LABELS: Record<GroundResourceKind, string> = {
  tree: '나무', scrap: '고철', seed: '씨앗', water: '연못',
};
const WIDTH = 68, HEIGHT = 34, TOUCH_HEIGHT = 44;

/** One label per visible resource kind keeps the scenery and resident clear.
 * Every underlying sprite still selects its own node without an extra menu. */
export function layoutGroundMarkers(nodes: readonly GroundMarkerInput[], _scale: number,
  viewport: GroundMarkerViewport, placementViewport: GroundMarkerViewport = viewport, avoid: readonly GroundMarkerViewport[] = []): GroundMarker[] {
  const visible = nodes.filter(node => node.spriteBounds[2] >= viewport.left && node.spriteBounds[0] <= viewport.right
    && node.spriteBounds[3] >= viewport.top && node.spriteBounds[1] <= viewport.bottom);
  const groups = new Map<string, GroundMarkerInput[]>();
  for (const node of visible) {
    const key = node.kind;
    const group = groups.get(key) ?? []; group.push(node); groups.set(key, group);
  }
  const pending = [...groups.values()].map(group => {
    const ordered = [...group].sort((a, b) => Number(b.active) - Number(a.active)
      || Number(b.ready) - Number(a.ready) || (a.ready ? a.distance - b.distance : a.remainingSeconds - b.remainingSeconds)
      || a.index - b.index);
    const lead = ordered[0], readyCount = group.filter(node => node.ready).length;
    const anchor: [number, number] = [(lead.spriteBounds[0] + lead.spriteBounds[2]) / 2, lead.spriteBounds[1]];
    const x = anchor[0], y = anchor[1] - 23;
    return { lead, group, readyCount, anchor, x, y };
  });
  const inset = { left: placementViewport.left + 4, top: placementViewport.top + 4, right: placementViewport.right - 4, bottom: placementViewport.bottom - 4 };
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(Math.max(min, max), value));
  const anchors = pending.map(({ lead, x, y }) => ({ id: lead.index,
    x: clamp(x, inset.left + WIDTH / 2, inset.right - WIDTH / 2),
    y: clamp(y, inset.top + TOUCH_HEIGHT / 2, inset.bottom - TOUCH_HEIGHT / 2), width: WIDTH, height: TOUCH_HEIGHT }));
  const positions = layoutProductionBubbles(anchors, inset);
  const markers = pending.map(({ lead, group, readyCount, anchor }, i): GroundMarker => {
    const position = positions.get(lead.index) ?? anchors[i];
    const status: GroundMarkerStatus = lead.active ? 'working' : !lead.ready ? 'cooldown' : !lead.affordable ? 'unaffordable' : 'ready';
    return { nodeId: lead.id, index: lead.index, nodeIds: group.map(node => node.id), resource: lead.resource,
      label: GROUND_MARKER_LABELS[lead.kind], status, remainingSeconds: lead.remainingSeconds,
      count: group.length, readyCount, anchor,
      screenBounds: [position.x - WIDTH / 2, position.y - HEIGHT / 2, position.x + WIDTH / 2, position.y + HEIGHT / 2],
      hitScreenBounds: [position.x - WIDTH / 2, position.y - TOUCH_HEIGHT / 2, position.x + WIDTH / 2, position.y + TOUCH_HEIGHT / 2],
      displaced: 'displaced' in position && position.displaced,
    };
  });
  const overlaps = (a: readonly number[], b: readonly number[]) => a[0] < b[2] + 4 && a[2] > b[0] - 4 && a[1] < b[3] + 4 && a[3] > b[1] - 4;
  const blocked = avoid.map(box => [box.left, box.top, box.right, box.bottom]);
  for (const marker of markers) {
    if (!blocked.some(box => overlaps(marker.hitScreenBounds, box))) continue;
    const cx = (marker.hitScreenBounds[0] + marker.hitScreenBounds[2]) / 2,
      cy = (marker.hitScreenBounds[1] + marker.hitScreenBounds[3]) / 2;
    let placed = false;
    for (let radius = 4; radius <= 240 && !placed; radius += 4) {
      for (const [dx,dy] of [[1,0],[-1,0],[0,-1],[0,1],[.707,-.707],[-.707,-.707],[.707,.707],[-.707,.707]]) {
        const x = cx + dx * radius, y = cy + dy * radius,
          bounds: [number,number,number,number] = [x-WIDTH/2,y-TOUCH_HEIGHT/2,x+WIDTH/2,y+TOUCH_HEIGHT/2];
        if (bounds[0] < inset.left || bounds[1] < inset.top || bounds[2] > inset.right || bounds[3] > inset.bottom
          || blocked.some(box => overlaps(bounds,box)) || markers.some(other => other !== marker && overlaps(bounds,other.hitScreenBounds))) continue;
        marker.hitScreenBounds = bounds; marker.screenBounds = [x-WIDTH/2,y-HEIGHT/2,x+WIDTH/2,y+HEIGHT/2];
        marker.displaced = true; placed = true; break;
      }
    }
  }
  return markers;
}
