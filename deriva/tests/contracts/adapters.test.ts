import { describe, expect, it } from "vitest";
import { archiveFixtures } from "../../lib/data/fixtures";
import { contentItemSchema } from "../../lib/schema";
import { adapters, configuredSourceHealth } from "../../lib/server/document";

describe("contratos de fuentes documentales", () => {
  it("registra adaptadores ejecutables con documentación oficial", () => {
    expect(adapters.length).toBeGreaterThanOrEqual(9);
    for (const adapter of adapters) {
      expect(adapter.id).toMatch(/^[a-z0-9-]+$/);
      expect(adapter.docs).toMatch(/^https:\/\//);
      expect(typeof adapter.search).toBe("function");
    }
  });

  it("expone sin simulación las fuentes que requieren clave o apertura externa", () => {
    const states = new Map(configuredSourceHealth.map((source) => [source.id, source.status]));
    expect(states.get("europeana")).toBe("needs-key");
    expect(states.get("smithsonian")).toBe("needs-key");
    expect(states.get("google-patents")).toBe("external-only");
    expect(states.get("personal")).toBe("active");
  });

  it("valida fixtures heterogéneos para modo offline y fallos de fuente", () => {
    expect(new Set(archiveFixtures.map((entry) => entry.kind)).size).toBeGreaterThanOrEqual(8);
    archiveFixtures.forEach((entry) => expect(contentItemSchema.parse(entry).id).toBe(entry.id));
    expect(archiveFixtures.some((entry) => entry.media.length === 0)).toBe(true);
  });
});
