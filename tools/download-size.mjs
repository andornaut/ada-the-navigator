import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const gzipBytes = promisify(gzip);
const brotliBytes = promisify(brotliCompress);
const [directory, output] = process.argv.slice(2);
if (!directory || !output) {
  throw new Error("Usage: node tools/download-size.mjs DIST OUTPUT.json");
}
const root = resolve(directory);
const entries = await readdir(root, { recursive: true, withFileTypes: true });
const paths = entries
  .filter((entry) => entry.isFile())
  .map((entry) => relative(root, join(entry.parentPath, entry.name)))
  .sort();
const files = [];
let next = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < paths.length) {
      const path = paths[next++];
      // Four workers bound simultaneous compression buffers.
      // eslint-disable-next-line no-await-in-loop
      const bytes = await readFile(join(root, path));
      // eslint-disable-next-line no-await-in-loop
      const [gz, br] = await Promise.all([
        gzipBytes(bytes, { level: 9 }),
        brotliBytes(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }),
      ]);
      files.push({
        path,
        raw: bytes.length,
        gzip: gz.length,
        brotli: br.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }),
);
files.sort((a, b) => a.path.localeCompare(b.path));
const sum = (items) =>
  items.reduce(
    (total, file) => ({
      count: total.count + 1,
      raw: total.raw + file.raw,
      gzip: total.gzip + file.gzip,
      brotli: total.brotli + file.brotli,
    }),
    { count: 0, raw: 0, gzip: 0, brotli: 0 },
  );
const families = {};
for (const file of files) {
  const family = file.path.startsWith("art/")
    ? file.path.split("/").length > 2
      ? file.path.split("/").slice(0, 2).join("/")
      : "art/root"
    : file.path.split("/")[0];
  (families[family] ??= []).push(file);
}
// The build manifest the pointer names lists every file the complete build installs.
const pointer = JSON.parse(await readFile(join(root, ".game-kit/build.json"), "utf8"));
const manifest = JSON.parse(
  await readFile(join(root, pointer.manifest.replace(/^\//, "")), "utf8"),
);
const urls = manifest.files.map((file) => file.url);
if (!urls.length) {
  throw new Error("The build manifest lists no files");
}
const precached = urls.map((url) => {
  const path = url === "/play/" ? "play/index.html" : url.replace(/^\//, "");
  const file = files.find((item) => item.path === path);
  if (!file) {
    throw new Error(`Missing precache file: ${url}`);
  }
  return file;
});
const report = {
  compression: { gzipLevel: 9, brotliQuality: 6, perFile: true },
  total: sum(files),
  precache: { ...sum(precached), urls },
  families: Object.fromEntries(Object.entries(families).map(([name, items]) => [name, sum(items)])),
  extensions: Object.fromEntries(
    [...new Set(files.map((file) => extname(file.path)))].map((extension) => [
      extension,
      sum(files.filter((file) => extname(file.path) === extension)),
    ]),
  ),
  largest: [...files].sort((a, b) => b.raw - a.raw).slice(0, 25),
  files,
  limitations: [
    "Compression sizes are local per-file estimates, not observed HTTP transfers or headers.",
    "Initial transfer, browser cache reuse and deployed incremental updates are unmeasured.",
    "Production output excludes repository history, source art and dependencies.",
  ],
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({ total: report.total, precache: sum(precached), extensions: report.extensions }),
);
