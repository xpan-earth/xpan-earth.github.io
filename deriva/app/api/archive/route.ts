import { NextRequest, NextResponse } from "next/server";
import { queryDocumentSources } from "../../../lib/server/document";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = sanitizeQuery(url.searchParams.get("q") || "structure mechanism");
  const seed = sanitizeQuery(url.searchParams.get("seed") || `${query}-${new Date().toISOString().slice(0, 10)}`);
  const result = await queryDocumentSources(query, seed);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sanitizeQuery(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s._-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "structure mechanism";
}

