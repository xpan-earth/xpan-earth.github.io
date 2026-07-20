const STOPWORDS = new Set([
  "para", "como", "desde", "sobre", "entre", "esta", "este", "estos", "estas", "that", "with", "from", "into", "their",
  "news", "latest", "after", "have", "more", "will", "cuando", "donde", "haber", "hacia", "pero", "porque", "ante", "una", "unos",
  "unas", "los", "las", "del", "por", "con", "and", "the", "for", "are", "was", "were", "its", "not", "all", "new",
]);

export function plainText(value: string, limit = 1600): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, dec) => {
      const code = Number.parseInt(hex ?? dec, hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function normalizeToken(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function tokens(value: string): string[] {
  return [...new Set(normalizeToken(value).split(/\s+/).filter((word) => word.length > 2 && !STOPWORDS.has(word)))];
}

export function jaccard(a: string[], b: string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  const intersection = [...left].filter((value) => right.has(value)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function extractEntities(value: string): string[] {
  const candidates = value.match(/(?:[A-ZÁÉÍÓÚÑ][\p{L}\d.-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}\d.-]+){0,3})/gu) ?? [];
  return [...new Set(candidates.map((item) => plainText(item, 80)).filter((item) => item.length > 3))].slice(0, 12);
}

export function summarize(value: string, minWords = 40, maxWords = 90): string {
  const clean = plainText(value, 1200);
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return clean;
  const sliced = words.slice(0, maxWords).join(" ");
  const sentence = sliced.replace(/[,;:]?\s+[^.!?]*$/, "");
  return `${(sentence.split(/\s+/).length >= minWords ? sentence : sliced).replace(/[,.!?;:]$/, "")}…`;
}

export function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach((key) => url.searchParams.delete(key));
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

export function isSafeHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) && !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

