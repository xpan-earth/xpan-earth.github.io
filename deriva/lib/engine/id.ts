export function stableHash(input: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b1;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}

export function stableId(adapter: string, rawId: string, canonicalUrl = ""): string {
  return `${adapter}-${stableHash(`${adapter}|${rawId}|${canonicalUrl}`)}`;
}

export function seededRandom(seed: string): () => number {
  let state = Number.parseInt(stableHash(seed).slice(0, 8), 36) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

