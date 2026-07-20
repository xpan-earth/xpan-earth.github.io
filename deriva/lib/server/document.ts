/* eslint-disable @typescript-eslint/no-explicit-any -- External collection APIs are deliberately isolated at this normalization boundary. */
import { XMLParser } from "fast-xml-parser";
import type { ContentItem, ContentKind, SourceHealth } from "../types";
import { archiveFixtures } from "../data/fixtures";
import { stableId, seededRandom } from "../engine/id";
import { extractEntities, plainText, summarize, tokens } from "../engine/text";
import { deduplicate } from "../engine/ranking";
import { fetchJson, fetchWithPolicy } from "./fetch";

type AdapterOutput = { items: ContentItem[]; health: SourceHealth };
type DocumentAdapter = { id: string; name: string; docs: string; search(query: string): Promise<ContentItem[]> };

function item(input: Partial<ContentItem> & Pick<ContentItem, "kind" | "presentedTitle" | "summary" | "institution" | "canonicalUrl">, adapter: string, rawId: string): ContentItem {
  const fetchedAt = new Date().toISOString();
  const id = stableId(adapter, rawId, input.canonicalUrl);
  return {
    schemaVersion: 2,
    id,
    kind: input.kind,
    originalTitle: input.originalTitle ?? input.presentedTitle,
    presentedTitle: input.presentedTitle,
    summary: summarize(input.summary, 16, 84),
    originalDescription: input.originalDescription ?? input.summary,
    creator: input.creator ?? [],
    institution: input.institution,
    objectDate: input.objectDate,
    publishedAt: input.publishedAt,
    updatedAt: input.updatedAt,
    canonicalUrl: input.canonicalUrl,
    sourceUrl: input.sourceUrl ?? input.canonicalUrl,
    sources: input.sources ?? [{ name: input.institution, url: input.canonicalUrl }],
    media: input.media ?? [],
    thumbnail: input.thumbnail ?? input.media?.[0]?.thumbnail ?? input.media?.[0]?.url,
    rights: input.rights ?? "consultar ficha de origen",
    license: input.license ?? "consultar ficha de origen",
    attribution: input.attribution ?? input.institution,
    language: input.language ?? "und",
    place: input.place ?? [],
    topics: input.topics ?? tokens(`${input.presentedTitle} ${input.summary}`).slice(0, 8),
    entities: input.entities ?? extractEntities(`${input.presentedTitle} ${input.summary}`),
    materials: input.materials ?? [],
    operations: input.operations ?? [],
    scores: input.scores ?? { visualQuality: input.media?.length ? 0.82 : 0.42, relevance: 0.62, novelty: 0.76, distance: 0.55, reliability: 0.88 },
    relations: input.relations ?? [],
    verification: input.verification ?? "verificado",
    provenance: { adapter, rawId, fetchedAt, cacheKey: id },
    selectionReasons: input.selectionReasons ?? [`resultado normalizado de ${input.institution}`],
    firstIngestedAt: fetchedAt,
    lastIngestedAt: fetchedAt,
  };
}

function imageMedia(url: string | undefined, alt: string, attribution: string, license?: string, width?: number, height?: number) {
  if (!url || !/^https?:\/\//i.test(url)) return [];
  return [{ url, type: "image" as const, width, height, aspectRatio: width && height ? width / height : undefined, alt, attribution, license }];
}

function array<T>(value: T | T[] | undefined): T[] { return value == null ? [] : Array.isArray(value) ? value : [value]; }
function firstText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return firstText(value[0]);
  if (value && typeof value === "object") return firstText((value as Record<string, unknown>)["#text"] ?? "");
  return "";
}

export const adapters: DocumentAdapter[] = [
  {
    id: "wikimedia", name: "Wikimedia Commons", docs: "https://www.mediawiki.org/wiki/API:Imageinfo",
    async search(query) {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=12&prop=imageinfo|info&iiprop=url|extmetadata&iiurlwidth=1600&inprop=url&format=json&formatversion=2&origin=*`;
      const data = await fetchJson<any>(url);
      return array(data?.query?.pages).filter((raw: any) => raw.imageinfo?.[0]?.thumburl).map((raw: any) => {
        const info = raw.imageinfo[0]; const meta = info.extmetadata ?? {}; const title = plainText(meta.ObjectName?.value || raw.title?.replace(/^File:/, ""), 220);
        return item({ kind: "imagen", presentedTitle: title, summary: plainText(meta.ImageDescription?.value || "Registro visual de Wikimedia Commons."), institution: "Wikimedia Commons", canonicalUrl: raw.fullurl, objectDate: meta.DateTimeOriginal?.value || meta.DateTime?.value, creator: [plainText(meta.Artist?.value || "", 120)].filter(Boolean), media: imageMedia(info.thumburl, title, plainText(meta.Credit?.value || "Wikimedia Commons"), plainText(meta.LicenseShortName?.value || "")), rights: plainText(meta.UsageTerms?.value || ""), license: plainText(meta.LicenseShortName?.value || ""), language: "und" }, "wikimedia", String(raw.pageid));
      });
    },
  },
  {
    id: "internet-archive", name: "Internet Archive", docs: "https://archive.org/developers/index-apis.html",
    async search(query) {
      const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(`(${query}) AND mediatype:(texts OR movies OR image OR audio)`)}&fl[]=identifier,title,description,date,mediatype,creator,licenseurl&rows=12&page=1&output=json`;
      const data = await fetchJson<any>(url);
      return array(data?.response?.docs).map((raw: any) => {
        const title = firstText(raw.title) || raw.identifier;
        const kind: ContentKind = raw.mediatype === "movies" ? "video" : raw.mediatype === "audio" ? "audio" : raw.mediatype === "texts" ? "libro" : "imagen";
        return item({ kind, presentedTitle: title, summary: plainText(firstText(raw.description) || "Objeto digital conservado por Internet Archive."), institution: "Internet Archive", canonicalUrl: `https://archive.org/details/${raw.identifier}`, objectDate: firstText(raw.date), creator: array(raw.creator).map(String), media: imageMedia(`https://archive.org/services/img/${raw.identifier}`, title, "Internet Archive", firstText(raw.licenseurl)), license: firstText(raw.licenseurl), language: "und" }, "internet-archive", raw.identifier);
      });
    },
  },
  {
    id: "met", name: "The Met Open Access", docs: "https://metmuseum.github.io/",
    async search(query) {
      const search = await fetchJson<any>(`https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(query)}`);
      const ids = array<number>(search.objectIDs).slice(0, 8);
      const objects = await Promise.all(ids.map((id) => fetchJson<any>(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, { timeoutMs: 4200, retries: 0 })));
      return objects.filter((raw) => raw.primaryImageSmall && raw.objectURL).map((raw) => item({ kind: "objeto", presentedTitle: raw.title || "Sin título", summary: [raw.artistDisplayName, raw.medium, raw.culture, raw.objectDate].filter(Boolean).join(" · "), institution: "The Met Open Access", canonicalUrl: raw.objectURL, objectDate: raw.objectDate, creator: [raw.artistDisplayName].filter(Boolean), media: imageMedia(raw.primaryImageSmall, raw.title || "Objeto del Met", "The Metropolitan Museum of Art", raw.isPublicDomain ? "Public Domain" : "consultar ficha"), license: raw.isPublicDomain ? "Public Domain" : "consultar ficha", materials: tokens(raw.medium || "").slice(0, 6), language: "en" }, "met", String(raw.objectID)));
    },
  },
  {
    id: "loc", name: "Library of Congress", docs: "https://www.loc.gov/apis/",
    async search(query) {
      const data = await fetchJson<any>(`https://www.loc.gov/search/?fo=json&c=12&q=${encodeURIComponent(query)}`);
      return array(data.results).filter((raw: any) => raw.id && raw.image_url?.length).map((raw: any) => item({ kind: raw.original_format?.includes("map") ? "mapa" : "imagen", presentedTitle: raw.title || "Sin título", summary: firstText(raw.description) || array(raw.subject).slice(0, 6).join(" · ") || "Registro digital de la Library of Congress.", institution: "Library of Congress", canonicalUrl: raw.id, objectDate: raw.date, creator: array(raw.contributor).map(String), media: imageMedia(raw.image_url.at(-1), raw.title || "Registro de la Library of Congress", "Library of Congress", firstText(raw.rights_advisory)), rights: firstText(raw.rights_advisory), language: firstText(raw.language) || "und" }, "loc", String(raw.id)));
    },
  },
  {
    id: "nasa", name: "NASA Image and Video Library", docs: "https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf",
    async search(query) {
      const data = await fetchJson<any>(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image,video,audio&page_size=12`);
      return array(data?.collection?.items).map((raw: any) => {
        const datum = raw.data?.[0] ?? {}; const mediaType = datum.media_type; const kind: ContentKind = mediaType === "video" ? "video" : mediaType === "audio" ? "audio" : "imagen";
        return item({ kind, presentedTitle: datum.title || datum.nasa_id, summary: plainText(datum.description_508 || datum.description || "Registro de NASA."), institution: "NASA Image and Video Library", canonicalUrl: `https://images.nasa.gov/details/${datum.nasa_id}`, objectDate: datum.date_created?.slice(0, 10), creator: [datum.photographer, datum.secondary_creator].filter(Boolean), media: imageMedia(raw.links?.[0]?.href, datum.title || "Registro NASA", "NASA", "NASA media usage guidelines"), rights: "NASA media usage guidelines", license: "NASA media usage guidelines", language: "en" }, "nasa", datum.nasa_id);
      });
    },
  },
  {
    id: "artic", name: "Art Institute of Chicago", docs: "https://api.artic.edu/docs/",
    async search(query) {
      const fields = "id,title,artist_display,date_display,medium_display,image_id,is_public_domain,thumbnail";
      const data = await fetchJson<any>(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(query)}&limit=12&fields=${fields}`);
      const base = data?.config?.iiif_url || "https://www.artic.edu/iiif/2";
      return array(data.data).filter((raw: any) => raw.image_id).map((raw: any) => item({ kind: "imagen", presentedTitle: raw.title, summary: [raw.artist_display, raw.medium_display, raw.date_display].filter(Boolean).join(" · "), institution: "Art Institute of Chicago", canonicalUrl: `https://www.artic.edu/artworks/${raw.id}`, objectDate: raw.date_display, creator: [raw.artist_display].filter(Boolean), media: imageMedia(`${base}/${raw.image_id}/full/843,/0/default.jpg`, raw.thumbnail?.alt_text || raw.title, "Art Institute of Chicago", raw.is_public_domain ? "CC0 / Public Domain" : "consultar ficha"), license: raw.is_public_domain ? "CC0 / Public Domain" : "consultar ficha", language: "en" }, "artic", String(raw.id)));
    },
  },
  {
    id: "cleveland", name: "Cleveland Museum of Art", docs: "https://openaccess-api.clevelandart.org/",
    async search(query) {
      const data = await fetchJson<any>(`https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(query)}&has_image=1&limit=12`);
      return array(data.data).filter((raw: any) => raw.url && raw.images?.web?.url).map((raw: any) => item({ kind: "objeto", presentedTitle: raw.title || "Sin título", summary: [raw.creators?.[0]?.description, raw.technique, raw.date_text].filter(Boolean).join(" · "), institution: "Cleveland Museum of Art", canonicalUrl: raw.url, objectDate: raw.date_text, creator: array(raw.creators).map((creator: any) => creator.description).filter(Boolean), media: imageMedia(raw.images.web.url, raw.title || "Objeto del Cleveland Museum of Art", "Cleveland Museum of Art", raw.share_license_status || "CC0"), license: raw.share_license_status || "CC0", materials: tokens(raw.technique || "").slice(0, 6), language: "en" }, "cleveland", String(raw.id)));
    },
  },
  {
    id: "wellcome", name: "Wellcome Collection", docs: "https://developers.wellcomecollection.org/api/catalogue",
    async search(query) {
      const data = await fetchJson<any>(`https://api.wellcomecollection.org/catalogue/v2/works?query=${encodeURIComponent(query)}&include=images&limit=12`);
      return array(data.results).map((raw: any) => {
        const image = raw.thumbnail?.url || raw.images?.[0]?.thumbnail?.url; const workUrl = `https://wellcomecollection.org/works/${raw.id}`;
        return item({ kind: raw.workType?.id === "b" ? "libro" : "objeto", presentedTitle: raw.title || "Sin título", summary: [raw.description, raw.production?.[0]?.label, raw.workType?.label].filter(Boolean).join(" · ") || "Registro de Wellcome Collection.", institution: "Wellcome Collection", canonicalUrl: workUrl, objectDate: raw.production?.[0]?.dates?.[0]?.label, creator: array(raw.contributors).map((creator: any) => creator.agent?.label).filter(Boolean), media: imageMedia(image, raw.title || "Registro Wellcome", "Wellcome Collection", raw.thumbnail?.license?.label), license: raw.thumbnail?.license?.label || "consultar ficha", language: raw.languages?.[0]?.id || "und" }, "wellcome", raw.id);
      });
    },
  },
  {
    id: "arxiv", name: "arXiv", docs: "https://info.arxiv.org/help/api/user-manual.html",
    async search(query) {
      const response = await fetchWithPolicy(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=8&sortBy=submittedDate&sortOrder=descending`, { timeoutMs: 6200, retries: 0, cacheTtlSeconds: 3600 });
      const xml = new XMLParser({ ignoreAttributes: false, textNodeName: "#text" }).parse(await response.text());
      return array(xml?.feed?.entry).map((raw: any) => {
        const url = firstText(raw.id); const title = plainText(firstText(raw.title), 260);
        return item({ kind: "paper", presentedTitle: title, summary: plainText(firstText(raw.summary), 1000), institution: "arXiv", canonicalUrl: url, publishedAt: firstText(raw.published), updatedAt: firstText(raw.updated), creator: array(raw.author).map((author: any) => firstText(author.name)).filter(Boolean), language: "en", topics: array(raw.category).map((category: any) => category?.["@_term"]).filter(Boolean) }, "arxiv", url);
      });
    },
  },
];

export const configuredSourceHealth: SourceHealth[] = [
  { id: "europeana", name: "Europeana", type: "api", status: "needs-key", checkedAt: new Date().toISOString(), message: "Search API vigente; requiere EUROPEANA_API_KEY", officialDocs: "https://europeana.atlassian.net/wiki/spaces/EF/pages/2385739812/Search+API+Documentation" },
  { id: "smithsonian", name: "Smithsonian Open Access", type: "api", status: "needs-key", checkedAt: new Date().toISOString(), message: "API vigente en api.data.gov; requiere SMITHSONIAN_API_KEY", officialDocs: "https://www.si.edu/openaccess/devtools" },
  { id: "dpla", name: "DPLA", type: "api", status: "needs-key", checkedAt: new Date().toISOString(), message: "API viable; requiere DPLA_API_KEY", officialDocs: "https://pro.dp.la/developers/api-codex" },
  { id: "arena", name: "Are.na", type: "api", status: "configurable", checkedAt: new Date().toISOString(), message: "API v3 vigente; requiere canales seleccionados y token cuando aplique", officialDocs: "https://www.are.na/developers/explore/channel" },
  { id: "google-patents", name: "Google Patents", type: "external", status: "external-only", checkedAt: new Date().toISOString(), message: "sin API pública oficial soportada; se abre búsqueda externa, nunca se presenta como fuente viva", officialDocs: "https://patents.google.com/" },
  { id: "public-domain-review", name: "Public Domain Review", type: "rss", status: "configurable", checkedAt: new Date().toISOString(), message: "sitio y feed editorial disponibles; no ofrece API documental pública", officialDocs: "https://publicdomainreview.org/" },
  { id: "personal", name: "Archivo personal", type: "personal", status: "active", checkedAt: new Date().toISOString(), message: "importación local de enlaces, JSON y archivos" },
];

export async function queryDocumentSources(query: string, seed = query): Promise<{ items: ContentItem[]; health: SourceHealth[] }> {
  const random = seededRandom(seed);
  const selectedAdapters = [...adapters].sort(() => random() - 0.5).slice(0, 6);
  const outputs: AdapterOutput[] = await Promise.all(selectedAdapters.map(async (adapter) => {
    const started = Date.now();
    try {
      const items = await adapter.search(query);
      return { items, health: { id: adapter.id, name: adapter.name, type: "api", status: items.length ? "active" : "degraded", checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, itemCount: items.length, message: items.length ? "adaptador verificado" : "respuesta sin resultados", officialDocs: adapter.docs } };
    } catch (error) {
      return { items: [], health: { id: adapter.id, name: adapter.name, type: "api", status: "down", checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, itemCount: 0, message: error instanceof Error ? error.message : "fallo de adaptador", officialDocs: adapter.docs } };
    }
  }));
  const live = deduplicate(outputs.flatMap((output) => output.items));
  const fixtures = archiveFixtures.filter((fixture) => tokens(`${fixture.presentedTitle} ${fixture.summary} ${fixture.topics.join(" ")}`).some((token) => tokens(query).includes(token)));
  return {
    items: deduplicate([...live, ...fixtures, ...archiveFixtures]).slice(0, 48),
    health: [...outputs.map((output) => output.health), ...configuredSourceHealth],
  };
}
