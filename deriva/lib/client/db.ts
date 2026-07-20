import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ContentItem, LocalArchiveRecord, LocalPreferences } from "../types";

interface DerivaDB extends DBSchema {
  archive: { key: string; value: LocalArchiveRecord; indexes: { "by-saved": string; "by-collection": string } };
  history: { key: string; value: { id: string; item: ContentItem; openedAt: string; operation: string }; indexes: { "by-opened": string } };
  preferences: { key: string; value: { key: string; value: unknown } };
  queue: { key: number; value: { id?: number; action: string; payload: unknown; createdAt: string }; keyPath: "id" };
}

let dbPromise: Promise<IDBPDatabase<DerivaDB>> | null = null;

export function getLocalDb() {
  if (typeof window === "undefined") throw new Error("IndexedDB is only available in the browser");
  dbPromise ??= openDB<DerivaDB>("deriva", 3, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        const archive = db.createObjectStore("archive", { keyPath: "item.id" });
        archive.createIndex("by-saved", "savedAt");
        archive.createIndex("by-collection", "collection");
        const history = db.createObjectStore("history", { keyPath: "id" });
        history.createIndex("by-opened", "openedAt");
        db.createObjectStore("preferences", { keyPath: "key" });
      }
      if (oldVersion < 2) db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
      if (oldVersion < 3 && transaction.objectStoreNames.contains("archive")) {
        const store = transaction.objectStore("archive");
        void store.openCursor().then(function migrate(cursor): Promise<void> | void {
          if (!cursor) return;
          const record = cursor.value;
          if (!record.collection) record.collection = "general";
          cursor.update(record);
          return cursor.continue().then(migrate);
        });
      }
    },
  });
  return dbPromise;
}

export const DEFAULT_PREFERENCES: LocalPreferences = {
  editionTimes: ["10:00", "15:00", "20:00"],
  sessionLength: 12,
  distance: 55,
  explanationVisible: true,
  reducedData: false,
  learnedTopics: {},
};

export async function saveItem(item: ContentItem, note = "", collection = "general", origin: LocalArchiveRecord["origin"] = "saved") {
  const db = await getLocalDb();
  const previous = await db.get("archive", item.id);
  await db.put("archive", { item, savedAt: previous?.savedAt ?? new Date().toISOString(), lastOpenedAt: new Date().toISOString(), note, collection, origin });
}

export async function removeItem(id: string) { await (await getLocalDb()).delete("archive", id); }
export async function listSaved() { return (await (await getLocalDb()).getAllFromIndex("archive", "by-saved")).reverse(); }
export async function updateSaved(record: LocalArchiveRecord) { await (await getLocalDb()).put("archive", record); }

export async function addHistory(item: ContentItem, operation: string) {
  const db = await getLocalDb();
  await db.put("history", { id: `${Date.now()}-${item.id}`, item, openedAt: new Date().toISOString(), operation });
  const all = await db.getAllFromIndex("history", "by-opened");
  if (all.length > 500) await Promise.all(all.slice(0, all.length - 500).map((record) => db.delete("history", record.id)));
}

export async function getPreferences(): Promise<LocalPreferences> {
  const stored = await (await getLocalDb()).get("preferences", "main");
  return { ...DEFAULT_PREFERENCES, ...(stored?.value as Partial<LocalPreferences> ?? {}) };
}

export async function setPreferences(value: LocalPreferences) { await (await getLocalDb()).put("preferences", { key: "main", value }); }

export async function clearLearnedProfile() {
  const preferences = await getPreferences();
  preferences.learnedTopics = {};
  await setPreferences(preferences);
  return preferences;
}

export async function exportArchive(): Promise<string> {
  const db = await getLocalDb();
  return JSON.stringify({ schemaVersion: 3, exportedAt: new Date().toISOString(), archive: await db.getAll("archive"), preferences: await getPreferences() }, null, 2);
}

export async function importArchive(payload: string): Promise<number> {
  const parsed = JSON.parse(payload) as { archive?: LocalArchiveRecord[]; preferences?: LocalPreferences } | LocalArchiveRecord[];
  const records = Array.isArray(parsed) ? parsed : parsed.archive ?? [];
  const db = await getLocalDb();
  const transaction = db.transaction("archive", "readwrite");
  await Promise.all(records.filter((record) => record?.item?.id).map((record) => transaction.store.put(record)));
  await transaction.done;
  if (!Array.isArray(parsed) && parsed.preferences) await setPreferences({ ...DEFAULT_PREFERENCES, ...parsed.preferences });
  return records.length;
}

