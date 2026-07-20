import { z } from "zod";
import { CONTENT_KINDS } from "./types";

const safeHttpUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value), "URL must use HTTP(S)");

export const mediaAssetSchema = z.object({
  url: safeHttpUrl,
  thumbnail: safeHttpUrl.optional(),
  type: z.enum(["image", "video", "audio", "pdf"]),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  aspectRatio: z.number().positive().optional(),
  alt: z.string().min(1),
  license: z.string().optional(),
  attribution: z.string().optional(),
});

export const contentItemSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(8),
  kind: z.enum(CONTENT_KINDS),
  originalTitle: z.string().min(1),
  presentedTitle: z.string().min(1),
  summary: z.string().min(1),
  originalDescription: z.string().optional(),
  creator: z.array(z.string()).optional(),
  institution: z.string().min(1),
  objectDate: z.string().optional(),
  publishedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  canonicalUrl: safeHttpUrl,
  sourceUrl: safeHttpUrl,
  sources: z.array(z.object({
    name: z.string().min(1),
    url: safeHttpUrl,
    publishedAt: z.string().optional(),
    author: z.string().optional(),
  })),
  media: z.array(mediaAssetSchema),
  thumbnail: safeHttpUrl.optional(),
  rights: z.string().optional(),
  license: z.string().optional(),
  attribution: z.string().optional(),
  language: z.string().min(2),
  place: z.array(z.string()).optional(),
  topics: z.array(z.string()),
  entities: z.array(z.string()),
  materials: z.array(z.string()),
  operations: z.array(z.string()),
  scores: z.object({
    visualQuality: z.number().min(0).max(1),
    relevance: z.number().min(0).max(1),
    novelty: z.number().min(0).max(1),
    distance: z.number().min(0).max(1),
    reliability: z.number().min(0).max(1),
  }),
  relations: z.array(z.object({
    targetId: z.string(),
    predicate: z.string(),
    explanation: z.string(),
    evidence: z.array(z.string()).optional(),
    strength: z.number().min(0).max(1),
  })),
  verification: z.enum(["verificado", "fuente-unica", "en-desarrollo", "sin-verificar"]),
  provenance: z.object({
    adapter: z.string(),
    rawId: z.string(),
    fetchedAt: z.string(),
    cacheKey: z.string(),
  }),
  selectionReasons: z.array(z.string()),
  firstIngestedAt: z.string(),
  lastIngestedAt: z.string(),
});

export const newsEventSchema = contentItemSchema.extend({
  kind: z.literal("noticia"),
  category: z.string(),
  whyItMatters: z.string().optional(),
  continuationOf: z.array(z.string()).optional(),
});

export const editionSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string(),
  date: z.string(),
  slot: z.enum(["10:00", "15:00", "20:00"]),
  generatedAt: z.string(),
  timezone: z.literal("America/Mexico_City"),
  title: z.string(),
  dek: z.string(),
  events: z.array(newsEventSchema).min(1).max(9),
  continuedIds: z.array(z.string()),
  newIds: z.array(z.string()),
  sourceHealth: z.array(z.any()),
  reasons: z.record(z.string(), z.array(z.string())),
});

