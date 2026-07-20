import { mkdir, writeFile } from "node:fs/promises";
import { buildCurrentEdition } from "../lib/server/news";
import { seedEditions } from "../lib/data/fixtures";

const output = "public/data/edition-latest.json";
await mkdir("public/data", { recursive: true });
try {
  const edition = await buildCurrentEdition();
  await writeFile(output, `${JSON.stringify(edition, null, 2)}\n`, "utf8");
  console.log(`Edición ${edition.id}: ${edition.events.length} acontecimientos.`);
} catch (error) {
  const fallback = seedEditions.at(-1)!;
  await writeFile(output, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  console.warn(`Ingestión remota no disponible; se escribió la reserva verificada: ${error instanceof Error ? error.message : error}`);
}
