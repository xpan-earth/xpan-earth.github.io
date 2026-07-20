import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("contrato PWA", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  const worker = readFileSync("public/sw.js", "utf8");

  it("declara instalación, iconos maskable, capturas y accesos directos", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
    expect(manifest.screenshots).toHaveLength(2);
    expect(manifest.shortcuts).toHaveLength(2);
  });

  it("versiona cachés, limpia versiones viejas y ofrece fallback offline", () => {
    expect(worker).toContain("deriva-v2.0.0");
    expect(worker).toContain("caches.delete");
    expect(worker).toContain("/offline.html");
    expect(worker).toContain("SKIP_WAITING");
  });
});
