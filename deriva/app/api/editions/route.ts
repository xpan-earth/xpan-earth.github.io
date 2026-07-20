import { NextRequest, NextResponse } from "next/server";
import { seedEditions } from "../../../lib/data/fixtures";
import { buildCurrentEdition, currentEditionDate, currentEditionSlot } from "../../../lib/server/news";
import { getEdition, listEditions, putEdition } from "../../../lib/server/edition-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const refresh = url.searchParams.get("refresh") === "1";
  if (all) {
    const stored = await listEditions(12);
    const merged = [...stored, ...seedEditions].filter((edition, index, array) => array.findIndex((candidate) => candidate.id === edition.id) === index);
    return json({ editions: merged.slice(0, 12), live: stored.length > 0 });
  }

  const id = `edition-${currentEditionDate()}-${currentEditionSlot().replace(":", "")}`;
  if (!refresh) {
    const stored = await getEdition(id);
    if (stored) return json({ edition: stored, live: true, cached: true });
  }

  try {
    const edition = await buildCurrentEdition();
    await putEdition(edition);
    return json({ edition, live: true, cached: false });
  } catch (error) {
    const fallback = seedEditions.find((edition) => edition.slot === currentEditionSlot()) ?? seedEditions[0];
    return json({ edition: fallback, live: false, cached: false, warning: error instanceof Error ? error.message : "ingestión no disponible" }, 200);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "public, max-age=120, s-maxage=600, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
