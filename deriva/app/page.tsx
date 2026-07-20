import DerivaApp from "../components/DerivaApp";
import { archiveFixtures, seedEditions } from "../lib/data/fixtures";

const views = new Set(["ahora", "deriva", "cruces", "archivo", "ediciones"]);

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string; scope?: string }> }) {
  const query = await searchParams;
  const requested = query.view ?? "ahora";
  const initialView = views.has(requested) ? requested as "ahora" | "deriva" | "cruces" | "archivo" | "ediciones" : "ahora";
  return <DerivaApp initialEditions={seedEditions} initialArchive={archiveFixtures} initialView={initialView} initialArchiveScope={query.scope === "fuentes" ? "fuentes" : "guardados"} />;
}
