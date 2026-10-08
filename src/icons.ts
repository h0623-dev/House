import { portraitCrops, survivorAtlasUrl } from './character-art';
import itemAtlasUrl from './assets/items-anime.png';
import skillsFarmAtlasUrl from './assets/skills-farm-anime.png';

// Original painted equipment shares the survivors' ink, leather and gold
// palette. A runtime SVG crop retains the small, responsive icon API while
// bundling one atlas for the native app and standalone browser build.
const itemCells: Record<string, number> = {
 wood:0, scrap:1, food:2, water:3,
 seeds:4, leaf:4, home:5, axe:6, hunt:7, sword:7,
 bag:8, map:9, bed:10, truck:11,
 flag:12, book:13, paw:14, hammer:15, expand:15,
};
const atlasSize = 1254;
const itemCellSize = atlasSize / 4;
const extraCells: Record<string, number> = { sweep:0, dash:1, heal:2, 'plot-empty':3, 'plot-sprout':4, 'plot-ready':5 };
let illustrationCropId = 0;

const paths: Record<string,string> = {
 move: '<path d="M9 11V4a1.5 1.5 0 0 1 3 0v7-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7h-1c-3 0-5-2-6-4l-4-6a1.5 1.5 0 0 1 2.4-1.8L9 15v-4Z"/>',
 home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
 leaf: '<path d="M20 3c-8-1-16 3-16 9a7 7 0 0 0 7 7c6 0 10-8 9-16Z"/><path d="M4 21 15 10M8 17v-5m0 5h5"/>',
 wood: '<path d="m5 15 9-10 6 6-10 9Z"/><ellipse cx="7.5" cy="17.5" rx="4" ry="3.5" transform="rotate(45 7.5 17.5)"/><path d="m11 9 5 5m-1-9 3-2 4 5-2 3M6 17l2 2"/>',
 scrap: '<path d="m12 3 9 5v9l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5m-9 5v9M8 5l9 5"/>',
 food: '<path d="M7 7c-4 0-5 4-3 9s5 7 8 4c3 3 6 1 8-4s1-9-3-9c-2 0-3 1-5 1S9 7 7 7Z"/><path d="M12 8V4m0 1c0-3 3-3 5-3 0 3-2 4-5 3"/>',
 water: '<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
 seeds: '<path d="M12 22V10M12 15C5 15 3 11 3 7c7 0 9 4 9 8Zm0-5c0-6 3-8 9-8 0 6-3 8-9 8Z"/>',
 hunt: '<path d="M4 20 20 4M4 4c10 0 16 6 16 16L4 4Zm16 0v6m0-6h-6M4 16v4h4"/>',
 hammer: '<path d="m5 3 6 1 5 5-4 4-5-5-3 1-2-2Zm7 9 9 9m-2-13 3 3-3 3-3-3"/>',
 bag: '<rect x="5" y="7" width="14" height="15" rx="4"/><path d="M8 7V5a4 4 0 0 1 8 0v2M5 13h14M9 16h6"/>',
 map: '<path d="m2 6 7-3 6 3 7-3v16l-7 3-6-3-7 3ZM9 3v16m6-13v16"/>',
 flag: '<path d="M5 22V3m0 1c4-5 9 5 15 0v10c-6 5-11-5-15 0"/>',
 settings: '<path d="m10 2 4 0 1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1Z"/><circle cx="12" cy="12" r="3"/>',
 sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
 moon: '<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
 heart: '<path d="M20 4c-3-2-6-1-8 2C10 3 7 2 4 4-1 8 4 14 12 21 20 14 25 8 20 4Z"/>',
 bolt: '<path d="m14 2-11 12h8l-1 8L21 9h-8Z"/>',
 paw: '<ellipse cx="6" cy="7" rx="2" ry="3" transform="rotate(-20 6 7)"/><ellipse cx="18" cy="7" rx="2" ry="3" transform="rotate(20 18 7)"/><ellipse cx="11" cy="4" rx="2" ry="3"/><path d="M12 10c-3 0-3 3-6 5-3 3 0 7 3 5 2-1 4-1 6 0 3 2 6-2 3-5-3-2-3-5-6-5Z"/>',
 arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
 chevron: '<path d="m9 5 7 7-7 7"/>',
 close: '<path d="m6 6 12 12M6 18 18 6"/>',
 check: '<path d="m5 12 4 4L20 5"/>',
 plus: '<path d="M12 5v14M5 12h14"/>',
 truck: '<path d="M2 6h12v12H2Zm12 5h5l3 4v3h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M18 11v4h4"/>',
 pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
 clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
 play: '<path d="m8 4 12 8-12 8Z"/>',
 pause: '<path d="M8 5v14M16 5v14"/>',
 volume: '<path d="M11 3 5 8H1v8h4l6 5Zm5 4a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
 mute: '<path d="M11 3 5 8H1v8h4l6 5Zm5 6 6 6m0-6-6 6"/>',
 bed: '<path d="M3 5v16m18-10v10M3 17h18M3 9h15a3 3 0 0 1 3 3v5M6 9v5h15"/>',
 download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 sparkle: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
 book: '<path d="M12 5c-3-3-7-3-10-2v16c4-1 7-1 10 2 3-3 6-3 10-2V3c-3-1-7-1-10 2Zm0 0v16"/>',
 refresh: '<path d="M20 8a9 9 0 1 0 1 7M20 2v6h-6"/>',
 shield: '<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6Z"/><path d="m8 12 3 3 5-6"/>',
 expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
};
export function icon(name:string, cls=''):string {
 const extra=extraCells[name];
 if(extra!==undefined){
  // The strike trail drops a few pixels past the nominal row. Bed crops
  // begin at their actual timber edge so no floating skill particles leak
  // into the next row's farm illustrations.
  const x=(extra%3)*512,y=extra<3?0:560,height=extra<3?552:420;
  const crop=`illustration-crop-${++illustrationCropId}`;
  return `<svg class="icon illustrated-icon ${cls}" viewBox="${x} ${y} 512 ${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="${crop}"><rect x="${x}" y="${y}" width="512" height="${height}"/></clipPath></defs><image href="${skillsFarmAtlasUrl}" x="0" y="0" width="1536" height="1024" clip-path="url(#${crop})"/></svg>`;
 }
 const cell=itemCells[name];
 if(cell!==undefined){
  const x=(cell%4)*itemCellSize,y=Math.floor(cell/4)*itemCellSize;
  return `<svg class="icon illustrated-icon ${cls}" viewBox="${x} ${y} ${itemCellSize} ${itemCellSize}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><image href="${itemAtlasUrl}" x="0" y="0" width="${atlasSize}" height="${atlasSize}"/></svg>`;
 }
 return `<svg class="icon glyph-icon ${cls}" viewBox="0 0 24 24" fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??paths.sparkle}</svg>`;
}
export function portrait(gender: 'male' | 'female', cls = ''): string {
  const crop = portraitCrops[gender];
  // Inline SVG preserves the existing responsive portrait API while cropping
  // the full-resolution illustration without extra requests or raster edits.
  return `<svg class="portrait ${cls}" viewBox="${crop.x} ${crop.y} ${crop.size} ${crop.size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="border-radius:20%;overflow:hidden"><rect x="${crop.x}" y="${crop.y}" width="${crop.size}" height="${crop.size}" rx="${crop.size*.2}" fill="${crop.backdrop}"/><circle cx="${crop.x+crop.size*.74}" cy="${crop.y+crop.size*.2}" r="${crop.size*.38}" fill="#fff9e5" opacity=".52"/><image href="${survivorAtlasUrl}" x="0" y="0" width="1536" height="1024"/></svg>`;
}
