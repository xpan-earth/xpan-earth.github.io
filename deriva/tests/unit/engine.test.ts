import { describe, expect, it } from "vitest";
import { archiveFixtures, seedEditions } from "../../lib/data/fixtures";
import { seededRandom, stableId } from "../../lib/engine/id";
import { selectLayout } from "../../lib/engine/layout";
import { deduplicate, selectDriftItem, semanticSimilarity } from "../../lib/engine/ranking";
import { canonicalizeUrl, isSafeHttpUrl, plainText } from "../../lib/engine/text";
import { contentItemSchema, editionSchema } from "../../lib/schema";
import type { DriftOperation, EditorialLayout } from "../../lib/types";

describe("modelo editorial", () => {
  it("valida todas las piezas y ediciones de reserva", () => {
    archiveFixtures.forEach((entry) => expect(contentItemSchema.safeParse(entry).success).toBe(true));
    seedEditions.forEach((entry) => expect(editionSchema.safeParse(entry).success).toBe(true));
  });

  it("genera identificadores y recorridos deterministas", () => {
    expect(stableId("met", "42", "https://example.org/a")).toBe(stableId("met", "42", "https://example.org/a"));
    const first = seededRandom("deriva");
    const second = seededRandom("deriva");
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("deduplica por identidad y URL canónica", () => {
    const duplicate = { ...archiveFixtures[0], id: "different-id" };
    expect(deduplicate([archiveFixtures[0], duplicate])).toHaveLength(1);
  });

  it("hace que los seis operadores cambien de criterio", () => {
    const operations: DriftOperation[] = ["seguir-hilo", "acercar", "alejar", "profundizar", "cruzar-ahora", "otra-cosa"];
    const results = operations.map((operation) => selectDriftItem(archiveFixtures, archiveFixtures[0], new Set([archiveFixtures[0].id]), operation, { arquitectura: 1 }, "fixed")?.id);
    expect(results.every(Boolean)).toBe(true);
    expect(new Set(results).size).toBeGreaterThanOrEqual(3);
  });

  it("produce una similitud acotada y simétrica", () => {
    const left = semanticSimilarity(archiveFixtures[0], archiveFixtures[1]);
    const right = semanticSimilarity(archiveFixtures[1], archiveFixtures[0]);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThanOrEqual(1);
    expect(left).toBeCloseTo(right);
  });
});

describe("ocho sistemas de layout", () => {
  it("cubre cada sistema con reglas editoriales", () => {
    const expected: EditorialLayout[] = ["full-bleed", "vertical-split", "type-led", "diptych", "sequence", "diagram-field", "document-viewer", "audiovisual"];
    const visual = { ...archiveFixtures[0], kind: "imagen" as const };
    const samples = [
      { ...visual, media: [{ ...archiveFixtures[0].media[0], aspectRatio: 1.8 }] },
      { ...visual, media: [{ ...archiveFixtures[0].media[0], aspectRatio: 0.6 }] },
      { ...visual, media: [] },
      { ...seedEditions[2].events[0], relations: [{ targetId: "x", predicate: "x", explanation: "x", strength: 0.8 }] },
      { ...visual, media: [archiveFixtures[0].media[0], { ...archiveFixtures[0].media[0], url: "https://example.org/second.jpg" }] },
      { ...archiveFixtures[0], kind: "mapa" as const },
      { ...archiveFixtures[0], kind: "pdf" as const, media: [] },
      { ...archiveFixtures[0], kind: "audio" as const, media: [] },
    ];
    expect(samples.map((entry, index) => selectLayout(entry, index))).toEqual(expected);
  });
});

describe("frontera de contenido", () => {
  it("elimina HTML ejecutable y parámetros de seguimiento", () => {
    expect(plainText("<script>alert(1)</script><b>archivo</b>")).toBe("archivo");
    expect(canonicalizeUrl("https://example.org/a?utm_source=x&q=1#frag")).toBe("https://example.org/a?q=1");
  });

  it("rechaza protocolos y destinos locales", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("http://localhost:3000/private")).toBe(false);
    expect(isSafeHttpUrl("https://archive.org/details/test")).toBe(true);
  });
});
