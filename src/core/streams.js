/* Deterministic domain-stream draws keyed by the account master seed.
   nextStream advances a per-domain monotonic counter (stored in save.seq) so
   e.g. summon #42 draws the same stream on every device. streamAt is for
   naturally-indexed domains (maps by floor, combat by tick) with no counter. */
import { stream } from './rng.js';

export function streamAt(s, domain, ...indices) {
  return stream(s.masterSeed || 1, domain, ...indices);
}
export function nextStream(s, domain) {
  s.seq = s.seq || {};
  const i = s.seq[domain] || 0;
  s.seq[domain] = i + 1;
  return stream(s.masterSeed || 1, domain, i);
}
