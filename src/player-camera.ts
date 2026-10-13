export type PlayerCameraPoint = readonly [number, number];

/** One close gameplay scale is shared by deck, stairs, road and outdoor work.
 * Map size and the destination never change the resident's on-screen size. */
export function framePlayerCamera(point: PlayerCameraPoint, availableWidth: number, availableHeight: number) {
  const width = Math.max(100, availableWidth), height = Math.max(70, availableHeight);
  const scale = Math.max(.8, Math.min(1.15, width / 360, height / 190));
  return { x: point[0], y: point[1] - 36, width: width / scale, height: height / scale, zoom: 1, scale };
}

/** Confine follow lag to the usable viewport without changing magnification.
 * An explicit zoom may make the body taller than the viewport; in that case
 * keep its centre visible and allow balanced cropping rather than zooming out. */
export function keepPlayerVisible(camera: { x: number; y: number }, feet: PlayerCameraPoint,
  usableWidth: number, usableHeight: number, scale: number, bodyHeight = 128 * .64): { x: number; y: number } {
  if (!Number.isFinite(scale) || scale <= 0) return { ...camera };
  const width = Math.max(0, usableWidth), height = Math.max(0, usableHeight);
  const side = Math.min(24, width / 2), horizontal = (width / 2 - side) / scale;
  const minY = feet[1] - (height / 2 - 4) / scale;
  const maxY = feet[1] - bodyHeight + (height / 2 - 8) / scale;
  return {
    x: Math.max(feet[0] - horizontal, Math.min(feet[0] + horizontal, camera.x)),
    y: minY <= maxY ? Math.max(minY, Math.min(maxY, camera.y)) : feet[1] - bodyHeight / 2 - 2 / scale,
  };
}
