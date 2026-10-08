import forestUrl from './assets/battle-forest.png';
import bridgeUrl from './assets/battle-bridge.png';
import checkpointUrl from './assets/battle-checkpoint.png';

/** Shared stage illustrations: the expedition cards show the actual road. */
export const BATTLE_ART_URLS = [forestUrl, bridgeUrl, checkpointUrl] as const;
export const battleImages = BATTLE_ART_URLS.map(url => {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image;
});

const TAU = Math.PI * 2;

/** The painted asphalt begins at 60%; all actor feet stand at 77%. */
export function drawBattleLandscape(c: CanvasRenderingContext2D, width: number,
  height: number, stage: number, time: number, reducedMotion: boolean): void {
  const index = Math.max(0, Math.min(2, stage - 1));
  const image = battleImages[index];
  c.save();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (image.complete && image.naturalWidth) {
    // A centre crop preserves the toll canopy, river and Namsan landmark on
    // a portrait phone. It never stretches the painterly scene or the road.
    const cover = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / cover, sourceHeight = height / cover;
    c.drawImage(image, (image.naturalWidth - sourceWidth) / 2,
      (image.naturalHeight - sourceHeight) / 2, sourceWidth, sourceHeight,
      0, 0, width, height);
  } else {
    // Only visible while the locally bundled illustration is decoding.
    const wash = c.createLinearGradient(0, 0, 0, height);
    wash.addColorStop(0, index === 1 ? '#688e92' : index === 2 ? '#b3a29d' : '#a5b18b');
    wash.addColorStop(.57, '#c1c6a2'); wash.addColorStop(1, '#8c8271');
    c.fillStyle = wash; c.fillRect(0, 0, width, height);
  }

  // A quiet foreground glaze makes the painted sprites readable without
  // changing the environment palette; amber dust lives behind the combat.
  const vignette = c.createLinearGradient(0, height * .62, 0, height);
  vignette.addColorStop(0, 'rgba(41,39,35,0)');
  vignette.addColorStop(1, 'rgba(41,39,35,.17)');
  c.fillStyle = vignette; c.fillRect(0, height * .62, width, height * .38);
  const clock = reducedMotion ? 0 : time;
  c.fillStyle = index === 1 ? '#ebf2e6' : '#ffedb1';
  c.shadowColor = index === 1 ? '#a4c7bc' : '#ffd893'; c.shadowBlur = 5;
  for (let i = 0; i < 15; i++) {
    const x = ((i * 113 + clock * (3 + i % 3)) % (width + 24)) - 12;
    const y = height * .18 + (i * 47) % (height * .43) + Math.sin(clock * .6 + i) * 6;
    const radius = .6 + i % 3 * .35;
    c.globalAlpha = .24 + (Math.sin(clock * .9 + i * 1.7) + 1) * .18;
    c.beginPath(); c.ellipse(x, y, radius, radius * .6, i, 0, TAU); c.fill();
  }
  c.restore();
}
