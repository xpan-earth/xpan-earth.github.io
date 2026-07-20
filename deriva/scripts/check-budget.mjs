import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const directory = "dist/client/assets";
const files = readdirSync(directory).filter((name) => /\.(js|css)$/.test(name));
const assets = files.map((name) => {
  const path = join(directory, name);
  const source = readFileSync(path);
  return { name, raw: statSync(path).size, gzip: gzipSync(source).byteLength };
});
const totalGzip = assets.reduce((sum, asset) => sum + asset.gzip, 0);
const largest = assets.sort((a, b) => b.gzip - a.gzip)[0];
if (totalGzip > 155_000 || largest.gzip > 80_000) {
  throw new Error(`Presupuesto excedido: total ${totalGzip} B gzip; mayor ${largest?.name} ${largest?.gzip} B gzip`);
}
console.log(JSON.stringify({ totalGzip, largest, assets }, null, 2));
