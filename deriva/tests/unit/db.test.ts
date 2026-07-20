import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { archiveFixtures } from "../../lib/data/fixtures";
import { exportArchive, getPreferences, importArchive, listSaved, saveItem, setPreferences } from "../../lib/client/db";

beforeAll(() => { vi.stubGlobal("window", globalThis); });

describe("archivo IndexedDB", () => {
  it("guarda, anota y exporta una pieza", async () => {
    await saveItem(archiveFixtures[0], "nota", "pruebas");
    const records = await listSaved();
    expect(records[0].note).toBe("nota");
    expect(records[0].collection).toBe("pruebas");
    expect(JSON.parse(await exportArchive()).schemaVersion).toBe(3);
  });

  it("importa y conserva preferencias explícitas", async () => {
    const preferences = { ...(await getPreferences()), distance: 82, sessionLength: 20 };
    await setPreferences(preferences);
    const payload = JSON.stringify({ archive: [{ item: archiveFixtures[1], savedAt: "2026-01-01", lastOpenedAt: "2026-01-01", note: "", collection: "mapas", origin: "imported" }], preferences });
    expect(await importArchive(payload)).toBe(1);
    expect((await getPreferences()).distance).toBe(82);
    expect((await listSaved()).some((record) => record.item.id === archiveFixtures[1].id)).toBe(true);
  });
});
