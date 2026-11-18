import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { subsetWoff2 } from "@andornaut/art-kit/build/woff2";

const USAGE = "Usage: node art/tools/ui-fonts.ts [--strings <ui-strings.json>] [output-directory]";

// Printable ASCII and the no-break space: digits, signs and separators for numbers,
// percents, prices, counts, versions and the build label, whatever their source.
const SAFETY_TEXT = String.fromCodePoint(
  ...Array.from({ length: 0x7f - 0x20 }, (_, i) => 0x20 + i),
  0xa0,
);

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = `${root}art/sources/fonts/liberation`;
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { strings: { type: "string" } },
});
if (positionals.length > 1) {
  throw new Error(USAGE);
}
const output = positionals[0] ? resolve(positionals[0]) : `${root}public/art/ui/fonts/adaui`;
const stringsPath = resolve(values.strings ?? `${root}var/ui-strings.json`);

// The build's export of every string set in the UI fonts: { strings: [{ source, text }] }.
const exported: unknown = JSON.parse(readFileSync(stringsPath, "utf8"));
if (
  !exported ||
  typeof exported !== "object" ||
  !("strings" in exported) ||
  !Array.isArray(exported.strings) ||
  !exported.strings.every(
    (item: unknown) =>
      !!item &&
      typeof item === "object" &&
      "source" in item &&
      typeof item.source === "string" &&
      "text" in item &&
      typeof item.text === "string",
  )
) {
  throw new Error(`${stringsPath} is not { strings: [{ source, text }] }`);
}
const strings = [SAFETY_TEXT, ...(exported.strings as { text: string }[]).map(({ text }) => text)];

// The OFL header reserves these font names, and a subset is a Modified Version, so each
// subset is renamed AdaUI. Copyright (0), version (5) and licence (13, 14) records stay.
const RESERVED = ["Liberation", "Arimo", "Tinos", "Cousine"];

// subsetWoff2 throws naming every character the TTF does not map, so an exported string the
// font cannot draw fails the run instead of shipping a fallback. It also throws when a
// replaced name still contains a reserved name.
const fonts = [];
for (const weight of ["Regular", "Bold"]) {
  const name = `AdaUI-${weight}`;
  const font = readFileSync(`${source}/LiberationSans-${weight}.ttf`);
  const names = {
    family: "AdaUI",
    fullName: `AdaUI ${weight}`,
    postScriptName: name,
    reserved: RESERVED,
    uniqueId: `AdaUI ${weight} 2.1.5 subset`,
  };
  fonts.push({ name, bytes: await subsetWoff2({ label: name, names, strings }, font) });
}

mkdirSync(output, { recursive: true });
for (const { name, bytes } of fonts) {
  writeFileSync(`${output}/${name}.woff2`, bytes);
}
