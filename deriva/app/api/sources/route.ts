import { NextResponse } from "next/server";
import { adapters, configuredSourceHealth } from "../../../lib/server/document";
import { NEWS_FEEDS } from "../../../lib/server/news";

export async function GET() {
  const checkedAt = new Date().toISOString();
  return NextResponse.json({
    checkedAt,
    sources: [
      ...NEWS_FEEDS.map((source) => ({ id: source.id, name: source.name, type: "rss", status: "active", checkedAt, message: "feed registrado; su salud se verifica durante cada ingestión" })),
      ...adapters.map((adapter) => ({ id: adapter.id, name: adapter.name, type: "api", status: "active", checkedAt, message: "adaptador server-side registrado", officialDocs: adapter.docs })),
      ...configuredSourceHealth,
    ],
  }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=1800" } });
}

