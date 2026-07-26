export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296}}

/* FNV-1a string hash → 32-bit seed. Deterministic and stable across devices. */
export function hashSeed(...parts) {
  let h = 0x811c9dc5 >>> 0;
  const str = parts.join('\u0001');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/* An independent RNG stream keyed by (masterSeed, domain, ...indices).
   A divergence in one domain never cascades into another — the core of
   deterministic, device-portable randomness. */
export function stream(masterSeed, domain, ...indices) {
  return mulberry32(hashSeed(masterSeed, domain, ...indices));
}
