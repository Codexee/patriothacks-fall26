// PROTOTYPE signing for surface probe readings: a keyed FNV-1a hash. Both the probes (in the world) and Witness
// (in the residents' system) use it. A real Witness would use public-key signatures (for example Ed25519), so
// that checking a reading never needs the secret key.
export function probeSig(key: string, device: string, day: number, value: number): string {
  const text = `${key}|${device}|${day}|${value.toFixed(2)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
