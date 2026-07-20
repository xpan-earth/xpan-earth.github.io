import { describe, expect, it } from "vitest";
import { currentEditionDate, currentEditionSlot, parseFeedXml } from "../../lib/server/news";

const feed = { id: "fixture", name: "Fuente", url: "https://example.org/rss", category: "ciencia", language: "es", reliability: 0.9 };

describe("normalización RSS/Atom", () => {
  it("normaliza RSS, fecha inválida y ausencia de imagen", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[<b>Hallazgo</b> verificable]]></title><link>https://example.org/a?utm_source=rss</link><description><![CDATA[Una descripción suficientemente clara para el acontecimiento.]]></description><pubDate>fecha rota</pubDate></item></channel></rss>`;
    const [entry] = parseFeedXml(xml, feed, "2026-07-20T12:00:00.000Z");
    expect(entry.presentedTitle).toBe("Hallazgo verificable");
    expect(entry.canonicalUrl).toBe("https://example.org/a");
    expect(entry.publishedAt).toBe("2026-07-20T12:00:00.000Z");
    expect(entry.media).toEqual([]);
  });

  it("normaliza Atom con imagen y enlace atribuido", () => {
    const xml = `<feed><entry><title>Objeto orbital</title><link href="https://example.org/orbit"/><summary><![CDATA[<img src="https://images.example.org/orbit.jpg">Observación orbital.]]></summary><published>2026-07-20T10:00:00Z</published></entry></feed>`;
    const [entry] = parseFeedXml(xml, feed);
    expect(entry.media[0].url).toBe("https://images.example.org/orbit.jpg");
    expect(entry.attribution).toContain("Fuente");
  });
});

describe("reloj editorial de Ciudad de México", () => {
  it("mantiene la edición nocturna hasta las 10:00", () => {
    const beforeTen = new Date("2026-07-20T15:59:00Z");
    expect(currentEditionSlot(beforeTen)).toBe("20:00");
    expect(currentEditionDate(beforeTen)).toBe("2026-07-19");
  });

  it("abre exactamente las tres ventanas", () => {
    expect(currentEditionSlot(new Date("2026-07-20T16:00:00Z"))).toBe("10:00");
    expect(currentEditionSlot(new Date("2026-07-20T21:00:00Z"))).toBe("15:00");
    expect(currentEditionSlot(new Date("2026-07-21T02:00:00Z"))).toBe("20:00");
  });
});
