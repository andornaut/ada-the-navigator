// Writes the text the game page can set in AdaUI, { strings: [{ source, text }] }, for the UI
// font producer (art/tools/ui-fonts.ts), which reads var/ui-strings.json by default.
// Usage: node tools/ui-strings.ts [output.json]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collectUiStrings, uiStringsExport } from "./ui-strings-collect.ts";

if (process.argv.length > 3) {
  throw new Error("Usage: node tools/ui-strings.ts [output.json]");
}
const root = fileURLToPath(new URL("..", import.meta.url));
const output = resolve(process.argv[2] ?? `${root}var/ui-strings.json`);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(uiStringsExport(collectUiStrings(root)))}\n`);
