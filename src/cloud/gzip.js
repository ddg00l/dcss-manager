/* Tiny gzip via the browser CompressionStream, with a raw-JSON fallback for
   environments without it (older browsers, node tests). Both directions detect
   the gzip magic bytes, so a save written either way reads back correctly. */
const MAGIC = [0x1f, 0x8b];

export function gzip(str) {
  const bytes = new TextEncoder().encode(str);
  if (typeof CompressionStream === 'undefined') return bytes; // fallback: store raw
  // sync wrapper is impossible; callers await writeState, so expose async path:
  return bytes; // CompressionStream path handled in gzipAsync when available
}

export function gunzip(u8) {
  if (u8[0] === MAGIC[0] && u8[1] === MAGIC[1] && typeof DecompressionStream !== 'undefined') {
    // handled by gunzipAsync; drive.js uses the async variants below
  }
  return new TextDecoder().decode(u8);
}

/* async variants actually used by drive.js */
export async function gzipAsync(str) {
  const bytes = new TextEncoder().encode(str);
  if (typeof CompressionStream === 'undefined') return bytes;
  const cs = new CompressionStream('gzip');
  const w = cs.writable.getWriter(); w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
export async function gunzipAsync(u8) {
  if (u8[0] === MAGIC[0] && u8[1] === MAGIC[1] && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const w = ds.writable.getWriter(); w.write(u8); w.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new TextDecoder().decode(new Uint8Array(buf));
  }
  return new TextDecoder().decode(u8);
}
