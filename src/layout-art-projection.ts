import type { LayoutDirection } from './layout-direction';

/** Deck axes, expressed as screen slopes. Vertical walls remain vertical. */
export const DECK_ART_SLOPES = { u: .34 / .91, v: -.47 / .67 } as const;

export interface AlignedArtTransform { xScale:number; yShear:number; yScale:number }

/**
 * The paintings use a symmetric isometric base, whereas the truck has unequal
 * axes. Fit that base to the actual deck without rotating upright walls/roofs.
 * The opposite facing swaps those axes and includes the matching shear; a bare
 * horizontal flip would leave its foundation pointing across the planks.
 */
export function getAlignedArtTransform(width:number,height:number,positiveSlope:number,negativeSlope:number,direction:LayoutDirection=0):AlignedArtTransform {
  const spread=positiveSlope-negativeSlope;
  const yScale=(DECK_ART_SLOPES.u-DECK_ART_SLOPES.v)/spread;
  const yShear=(direction===0?DECK_ART_SLOPES.u:-DECK_ART_SLOPES.v)-positiveSlope*yScale;
  // Keep the complete corrected roof inside the original allocated art box.
  const fit=Math.min(1,height/(height*yScale+Math.abs(yShear)*width/2));
  return {xScale:(direction===0?1:-1)*fit,yShear:yShear*fit,yScale:yScale*fit};
}

export function alignArtContext(c:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,
  positiveSlope:number,negativeSlope:number,direction:LayoutDirection=0):AlignedArtTransform {
  const matrix=getAlignedArtTransform(width,height,positiveSlope,negativeSlope,direction);
  c.translate(x,y);c.transform(matrix.xScale,matrix.yShear,0,matrix.yScale,0,0);
  return matrix;
}
