import type { ContentItem, DriftOperation, NewsEvent } from "../types";
import { seededRandom } from "./id";
import { jaccard, tokens } from "./text";

export function deduplicate<T extends ContentItem>(items: T[]): T[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  return items.filter((item) => {
    if (seenIds.has(item.id) || seenUrls.has(item.canonicalUrl)) return false;
    seenIds.add(item.id);
    seenUrls.add(item.canonicalUrl);
    return true;
  });
}

export function clusterNews(items: NewsEvent[]): NewsEvent[] {
  const clusters: NewsEvent[][] = [];
  for (const item of deduplicate(items)) {
    const itemTokens = tokens(`${item.presentedTitle} ${item.entities.join(" ")}`);
    const cluster = clusters.find((group) => {
      const head = group[0];
      const overlap = jaccard(itemTokens, tokens(`${head.presentedTitle} ${head.entities.join(" ")}`));
      const sharedEntity = item.entities.some((entity) => head.entities.includes(entity));
      return overlap >= 0.42 || (sharedEntity && overlap >= 0.22);
    });
    if (cluster) cluster.push(item);
    else clusters.push([item]);
  }

  return clusters.map((group) => {
    const head = [...group].sort((a, b) => b.scores.reliability - a.scores.reliability)[0];
    const sources = [...new Map(group.flatMap((item) => item.sources).map((source) => [source.url, source])).values()];
    return {
      ...head,
      sources,
      verification: sources.length > 1 ? "verificado" : head.verification,
      selectionReasons: [...new Set([...head.selectionReasons, sources.length > 1 ? `corroborado por ${sources.length} fuentes` : "fuente única visible"])],
    };
  });
}

export function selectEdition(items: NewsEvent[], limit = 8): NewsEvent[] {
  const categoryCounts = new Map<string, number>();
  const institutionCounts = new Map<string, number>();
  return [...clusterNews(items)]
    .sort((a, b) => editionScore(b) - editionScore(a))
    .filter((item) => {
      const categoryCount = categoryCounts.get(item.category) ?? 0;
      const institutionCount = institutionCounts.get(item.institution) ?? 0;
      if (categoryCount >= 2 || institutionCount >= 2) return false;
      categoryCounts.set(item.category, categoryCount + 1);
      institutionCounts.set(item.institution, institutionCount + 1);
      return true;
    })
    .slice(0, limit);
}

function editionScore(item: NewsEvent): number {
  const corroboration = Math.min(item.sources.length / 3, 1);
  const spanishEdition = item.language === "es" ? 0.06 : 0;
  return item.scores.relevance * 0.29 + item.scores.reliability * 0.23 + item.scores.novelty * 0.18 + item.scores.visualQuality * 0.12 + corroboration * 0.18 + spanishEdition;
}

export function semanticSimilarity(a: ContentItem, b: ContentItem): number {
  const lexical = jaccard(
    tokens(`${a.presentedTitle} ${a.summary} ${a.topics.join(" ")}`),
    tokens(`${b.presentedTitle} ${b.summary} ${b.topics.join(" ")}`),
  );
  const entityOverlap = jaccard(a.entities.map((value) => value.toLowerCase()), b.entities.map((value) => value.toLowerCase()));
  const materialOverlap = jaccard(a.materials, b.materials);
  const operationOverlap = jaccard(a.operations, b.operations);
  return Math.min(1, lexical * 0.46 + entityOverlap * 0.28 + materialOverlap * 0.14 + operationOverlap * 0.12);
}

export function selectDriftItem(
  pool: ContentItem[],
  current: ContentItem | null,
  seen: Set<string>,
  operation: DriftOperation,
  learnedTopics: Record<string, number>,
  seed: string,
): ContentItem | null {
  const random = seededRandom(`${operation}:${seed}`);
  const candidates = deduplicate(pool).filter((item) => !seen.has(item.id));
  const scored = candidates.map((item) => {
    const similarity = current ? semanticSimilarity(current, item) : 0.4;
    const learned = item.topics.reduce((sum, topic) => sum + (learnedTopics[topic] ?? 0), 0) / Math.max(item.topics.length, 1);
    const depth = Math.min(1, (item.sources.length + item.relations.length + item.materials.length) / 8);
    const diversity = current && item.institution !== current.institution && item.kind !== current.kind ? 1 : 0.35;
    const weights: Record<DriftOperation, number> = {
      "seguir-hilo": similarity * 0.62 + depth * 0.14 + item.scores.relevance * 0.18,
      acercar: learned * 0.4 + (1 - item.scores.distance) * 0.28 + similarity * 0.17 + item.scores.visualQuality * 0.1,
      alejar: item.scores.distance * 0.36 + (1 - similarity) * 0.28 + diversity * 0.2 + item.scores.novelty * 0.08,
      profundizar: depth * 0.44 + similarity * 0.3 + item.scores.reliability * 0.16,
      "cruzar-ahora": similarity * 0.48 + item.scores.relevance * 0.3 + item.sources.length * 0.03,
      "otra-cosa": diversity * 0.32 + item.scores.novelty * 0.26 + item.scores.visualQuality * 0.2 + (1 - similarity) * 0.12,
    };
    return { item, score: weights[operation] + random() * 0.08 - (seen.has(item.id) ? 1 : 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.item ?? null;
}
