export const CONTENT_KINDS = [
  "noticia",
  "imagen",
  "objeto",
  "mapa",
  "patente",
  "paper",
  "pdf",
  "libro",
  "audio",
  "video",
  "sitio",
  "archivo-personal",
] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

export type MediaAsset = {
  url: string;
  thumbnail?: string;
  type: "image" | "video" | "audio" | "pdf";
  width?: number;
  height?: number;
  aspectRatio?: number;
  alt: string;
  license?: string;
  attribution?: string;
};

export type SourceLink = {
  name: string;
  url: string;
  publishedAt?: string;
  author?: string;
};

export type ExplainedRelation = {
  targetId: string;
  predicate: string;
  explanation: string;
  evidence?: string[];
  strength: number;
};

export type ContentScores = {
  visualQuality: number;
  relevance: number;
  novelty: number;
  distance: number;
  reliability: number;
};

export type ContentItem = {
  schemaVersion: 2;
  id: string;
  kind: ContentKind;
  originalTitle: string;
  presentedTitle: string;
  summary: string;
  originalDescription?: string;
  creator?: string[];
  institution: string;
  objectDate?: string;
  publishedAt?: string;
  updatedAt?: string;
  canonicalUrl: string;
  sourceUrl: string;
  sources: SourceLink[];
  media: MediaAsset[];
  thumbnail?: string;
  rights?: string;
  license?: string;
  attribution?: string;
  language: string;
  place?: string[];
  topics: string[];
  entities: string[];
  materials: string[];
  operations: string[];
  scores: ContentScores;
  relations: ExplainedRelation[];
  verification: "verificado" | "fuente-unica" | "en-desarrollo" | "sin-verificar";
  provenance: {
    adapter: string;
    rawId: string;
    fetchedAt: string;
    cacheKey: string;
  };
  selectionReasons: string[];
  firstIngestedAt: string;
  lastIngestedAt: string;
};

export type NewsEvent = ContentItem & {
  kind: "noticia";
  category: string;
  whyItMatters?: string;
  continuationOf?: string[];
};

export type EditionSlot = "10:00" | "15:00" | "20:00";

export type Edition = {
  schemaVersion: 2;
  id: string;
  date: string;
  slot: EditionSlot;
  generatedAt: string;
  timezone: "America/Mexico_City";
  title: string;
  dek: string;
  events: NewsEvent[];
  continuedIds: string[];
  newIds: string[];
  sourceHealth: SourceHealth[];
  reasons: Record<string, string[]>;
};

export type SourceHealth = {
  id: string;
  name: string;
  type: "rss" | "api" | "external" | "personal";
  status: "active" | "degraded" | "down" | "needs-key" | "external-only" | "configurable";
  checkedAt: string;
  latencyMs?: number;
  itemCount?: number;
  message: string;
  officialDocs?: string;
};

export type DriftOperation =
  | "otra-cosa"
  | "seguir-hilo"
  | "acercar"
  | "alejar"
  | "profundizar"
  | "cruzar-ahora";

export type EditorialLayout =
  | "full-bleed"
  | "vertical-split"
  | "type-led"
  | "document-viewer"
  | "diagram-field"
  | "diptych"
  | "audiovisual"
  | "sequence";

export type LocalArchiveRecord = {
  item: ContentItem;
  savedAt: string;
  lastOpenedAt: string;
  note: string;
  collection: string;
  origin: "saved" | "imported";
};

export type LocalPreferences = {
  editionTimes: EditionSlot[];
  sessionLength: number;
  distance: number;
  explanationVisible: boolean;
  reducedData: boolean;
  learnedTopics: Record<string, number>;
};

