/* eslint-disable @typescript-eslint/no-explicit-any -- XML feeds have provider-specific untyped shapes at the normalization boundary. */
import { XMLParser } from "fast-xml-parser";
import type { Edition, EditionSlot, NewsEvent, SourceHealth } from "../types";
import { stableId } from "../engine/id";
import { canonicalizeUrl, extractEntities, plainText, summarize, tokens } from "../engine/text";
import { selectEdition } from "../engine/ranking";
import { seedEditions } from "../data/fixtures";
import { fetchWithPolicy } from "./fetch";

type FeedConfig = {
  id: string;
  name: string;
  url: string;
  category: string;
  language: string;
  reliability: number;
};

export const NEWS_FEEDS: FeedConfig[] = [
  { id: "bbc-mundo", name: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml", category: "mundo", language: "es", reliability: 0.92 },
  { id: "un-es", name: "Noticias ONU", url: "https://news.un.org/feed/subscribe/es/news/all/rss.xml", category: "mundo", language: "es", reliability: 0.93 },
  { id: "dw-es", name: "DW Español", url: "https://rss.dw.com/rdf/rss-sp-all", category: "mundo", language: "es", reliability: 0.9 },
  { id: "elpais-mx", name: "EL PAÍS México", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/mexico/portada", category: "méxico", language: "es", reliability: 0.86 },
  { id: "guardian-world", name: "The Guardian", url: "https://www.theguardian.com/world/rss", category: "mundo", language: "en", reliability: 0.87 },
  { id: "guardian-science", name: "The Guardian Science", url: "https://www.theguardian.com/science/rss", category: "ciencia", language: "en", reliability: 0.86 },
  { id: "guardian-culture", name: "The Guardian Culture", url: "https://www.theguardian.com/culture/rss", category: "cultura", language: "en", reliability: 0.84 },
  { id: "nasa", name: "NASA", url: "https://www.nasa.gov/feed/", category: "ciencia", language: "en", reliability: 0.95 },
  { id: "gaceta-unam", name: "Gaceta UNAM", url: "https://www.gaceta.unam.mx/feed/", category: "ciencia", language: "es", reliability: 0.87 },
  { id: "dezeen", name: "Dezeen", url: "https://www.dezeen.com/feed/", category: "diseño", language: "en", reliability: 0.78 },
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", processEntities: true });

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return textValue(record["#text"] ?? record.href ?? record["@_href"] ?? "");
  }
  return "";
}

export function parseFeedXml(xml: string, feed: FeedConfig, fetchedAt = new Date().toISOString()): NewsEvent[] {
  const parsed = parser.parse(xml) as Record<string, any>;
  const rssItems = asArray(parsed?.rss?.channel?.item);
  const atomItems = asArray(parsed?.feed?.entry);
  return [...rssItems, ...atomItems].map((raw: Record<string, any>) => normalizeFeedItem(raw, feed, fetchedAt)).filter(Boolean) as NewsEvent[];
}

export function normalizeFeedItem(raw: Record<string, any>, feed: FeedConfig, fetchedAt: string): NewsEvent | null {
  const originalTitle = plainText(textValue(raw.title), 240);
  const rawLink = textValue(raw.link) || textValue(asArray(raw.link)[0]);
  if (!originalTitle || !rawLink) return null;
  const canonicalUrl = canonicalizeUrl(rawLink);
  const descriptionRaw = textValue(raw.description ?? raw.summary ?? raw["content:encoded"] ?? raw.content ?? "");
  const description = summarize(descriptionRaw || originalTitle, 28, 84);
  const publishedAt = validDate(textValue(raw.pubDate ?? raw.published ?? raw.updated ?? raw["dc:date"])) ?? fetchedAt;
  const media = extractMedia(raw, originalTitle, feed.name);
  const id = stableId(feed.id, textValue(raw.guid) || canonicalUrl, canonicalUrl);
  const ageHours = Math.max(0, (Date.now() - Date.parse(publishedAt)) / 3_600_000);
  const novelty = Math.max(0.25, 1 - ageHours / 168);
  const entitySource = `${originalTitle} ${description}`;
  return {
    schemaVersion: 2,
    id,
    kind: "noticia",
    originalTitle,
    presentedTitle: originalTitle,
    summary: description,
    originalDescription: plainText(descriptionRaw, 1000),
    creator: textValue(raw.author ?? raw["dc:creator"]) ? [plainText(textValue(raw.author ?? raw["dc:creator"]), 120)] : [],
    institution: feed.name,
    publishedAt,
    updatedAt: validDate(textValue(raw.updated)) ?? publishedAt,
    canonicalUrl,
    sourceUrl: canonicalUrl,
    sources: [{ name: feed.name, url: canonicalUrl, publishedAt }],
    media,
    thumbnail: media[0]?.thumbnail ?? media[0]?.url,
    rights: plainText(textValue(raw.copyright ?? raw.rights), 240) || "consultar fuente",
    license: "consultar fuente",
    attribution: media.length ? `${feed.name} — vía feed oficial` : undefined,
    language: feed.language,
    place: [],
    topics: tokens(`${originalTitle} ${feed.category}`).slice(0, 8),
    entities: extractEntities(entitySource),
    materials: [],
    operations: tokens(description).filter((word) => /cion$|ment$|ing$|ar$|er$|ir$/.test(word)).slice(0, 5),
    scores: {
      visualQuality: media.length ? 0.82 : 0.42,
      relevance: Math.min(1, 0.64 + novelty * 0.25),
      novelty,
      distance: 0.5,
      reliability: feed.reliability,
    },
    relations: [],
    verification: "fuente-unica",
    provenance: { adapter: feed.id, rawId: textValue(raw.guid) || canonicalUrl, fetchedAt, cacheKey: id },
    selectionReasons: [ageHours < 24 ? "publicado en las últimas 24 horas" : "continuidad vigente", `fuente: ${feed.name}`],
    firstIngestedAt: fetchedAt,
    lastIngestedAt: fetchedAt,
    category: feed.category,
    whyItMatters: undefined,
    continuationOf: [],
  };
}

function extractMedia(raw: Record<string, any>, title: string, source: string) {
  const candidates: unknown[] = [
    raw["media:content"], raw["media:thumbnail"], raw.enclosure, raw.image, raw.thumbnail,
  ];
  const description = textValue(raw.description ?? raw.summary ?? "");
  const htmlMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (htmlMatch) candidates.push({ "@_url": htmlMatch });
  for (const candidate of candidates.flatMap(asArray)) {
    const record = typeof candidate === "object" && candidate ? candidate as Record<string, unknown> : {};
    const url = textValue(record["@_url"] ?? record.url ?? candidate);
    if (/^https?:\/\//i.test(url) && !/\.mp3(?:\?|$)/i.test(url)) {
      const width = Number(record["@_width"] ?? 0) || undefined;
      const height = Number(record["@_height"] ?? 0) || undefined;
      return [{ url, type: "image" as const, width, height, aspectRatio: width && height ? width / height : undefined, alt: title, attribution: source, license: "consultar fuente" }];
    }
  }
  return [];
}

function validDate(value: string): string | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export async function ingestNews(): Promise<{ items: NewsEvent[]; health: SourceHealth[] }> {
  const results = await Promise.all(NEWS_FEEDS.map(async (feed) => {
    const started = Date.now();
    try {
      const response = await fetchWithPolicy(feed.url, { timeoutMs: 4800, retries: 1, cacheTtlSeconds: 600 });
      const items = parseFeedXml(await response.text(), feed);
      return {
        items,
        health: { id: feed.id, name: feed.name, type: "rss", status: items.length ? "active" : "degraded", checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, itemCount: items.length, message: items.length ? "feed verificado" : "feed respondió sin elementos" } satisfies SourceHealth,
      };
    } catch (error) {
      return {
        items: [] as NewsEvent[],
        health: { id: feed.id, name: feed.name, type: "rss", status: "down", checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, itemCount: 0, message: error instanceof Error ? error.message : "fallo de fuente" } satisfies SourceHealth,
      };
    }
  }));
  return { items: results.flatMap((result) => result.items), health: results.map((result) => result.health) };
}

export function currentEditionSlot(date = new Date()): EditionSlot {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "2-digit", hour12: false }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  if (hour >= 20) return "20:00";
  if (hour >= 15) return "15:00";
  if (hour >= 10) return "10:00";
  return "20:00";
}

export function mexicoDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** The 20:00 edition remains current until the next day's 10:00 release. */
export function currentEditionDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "2-digit", hour12: false }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  if (hour >= 10) return mexicoDate(date);
  const localNoon = Date.parse(`${mexicoDate(date)}T12:00:00Z`);
  return mexicoDate(new Date(localNoon - 86_400_000));
}

export async function buildCurrentEdition(): Promise<Edition> {
  const slot = currentEditionSlot();
  const date = currentEditionDate();
  const { items, health } = await ingestNews();
  const selected = selectEdition(items, 8);
  const seed = seedEditions.find((edition) => edition.slot === slot) ?? seedEditions[0];
  const events = selected.length >= 6 ? selected : [...selected, ...seed.events.filter((event) => !selected.some((item) => item.id === event.id))].slice(0, 8);
  const generatedAt = new Date().toISOString();
  const id = `edition-${date}-${slot.replace(":", "")}`;
  return {
    schemaVersion: 2,
    id,
    date,
    slot,
    generatedAt,
    timezone: "America/Mexico_City",
    title: slot === "10:00" ? "mañana" : slot === "15:00" ? "tarde" : "noche",
    dek: "una edición finita construida con fuentes abiertas, contraste y diversidad temática.",
    events,
    continuedIds: [],
    newIds: events.map((event) => event.id),
    sourceHealth: health,
    reasons: Object.fromEntries(events.map((event) => [event.id, event.selectionReasons])),
  };
}
