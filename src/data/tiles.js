/* Real DCSS tiles (CC0, from crawl/crawl rltiles), inlined as data URIs at build time. */
const mods = import.meta.glob('../assets/tiles/*.png', { query: '?inline', eager: true, import: 'default' });

export const TILES = {};
for (const p in mods) {
  const key = p.split('/').pop().replace('.png', '');
  TILES[key] = mods[p];
}
export const tileURL = k => TILES[k];

const imgCache = {};
export function tileImg(k) {
  let im = imgCache[k];
  if (!im) {
    im = new Image();
    im.src = TILES[k] || TILES.m_rat;
    imgCache[k] = im;
  }
  return im;
}
