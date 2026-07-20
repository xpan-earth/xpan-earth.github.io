import type { Edition } from "../types";

async function ready(): Promise<D1Database | null> {
  const { env } = await import("cloudflare:workers");
  const db = env.DB as D1Database | undefined;
  if (!db) return null;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS editions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      slot TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS editions_date_slot_idx ON editions(date, slot)"),
  ]);
  return db;
}

export async function getEdition(id: string): Promise<Edition | null> {
  try {
    const db = await ready();
    if (!db) return null;
    const row = await db.prepare("SELECT payload FROM editions WHERE id = ? LIMIT 1").bind(id).first<{ payload: string }>();
    return row?.payload ? JSON.parse(row.payload) as Edition : null;
  } catch {
    return null;
  }
}

export async function listEditions(limit = 12): Promise<Edition[]> {
  try {
    const db = await ready();
    if (!db) return [];
    const rows = await db.prepare("SELECT payload FROM editions ORDER BY generated_at DESC LIMIT ?").bind(limit).all<{ payload: string }>();
    return rows.results.flatMap((row) => {
      try { return [JSON.parse(row.payload) as Edition]; } catch { return []; }
    });
  } catch {
    return [];
  }
}

export async function putEdition(edition: Edition): Promise<void> {
  try {
    const db = await ready();
    if (!db) return;
    await db.prepare(`INSERT INTO editions (id, date, slot, generated_at, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET generated_at = excluded.generated_at, payload = excluded.payload, created_at = excluded.created_at`)
      .bind(edition.id, edition.date, edition.slot, edition.generatedAt, JSON.stringify(edition), Date.now()).run();
  } catch {
    // The edition remains available to the current request even if persistence is degraded.
  }
}
