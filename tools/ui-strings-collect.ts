// The text the game page can set in the AdaUI fonts, exported for Art's font producer
// (tools/ui-strings.ts writes var/ui-strings.json, art/tools/ui-fonts.ts reads it) and checked
// against the shipped subsets (src/tests/uiStrings.test.ts). It is a superset of the
// player-visible strings: every string literal and template text in shipped source, the kit
// modules and JSON it imports, the game page and the JSON art data under public/art/.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import ts from "typescript";

export interface UiString {
  readonly source: string;
  readonly text: string;
}

// Characters the interface sets in another font family, never in AdaUI, so the subsets need not
// map them. The completion check mark (src/ui/completionIndicator.ts) is set in the generic
// sans-serif family: Liberation Sans, the subsets' source, has no U+2713 glyph.
export const FALLBACK_CHARACTERS: ReadonlySet<string> = new Set(["✓"]);

const KIT = "@andornaut/game-kit";
const PAGE = "pages/play/index.html";

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

// HTML character references resolved, for text set through innerHTML or written in the page.
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (entity: string, name: string) => {
    if (/^#x/iu.test(name)) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    }
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

const posixPath = (root: string, path: string) => relative(root, path).split(sep).join("/");

function repoFiles(root: string, dir: string, keep: (path: string) => boolean): string[] {
  return readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => posixPath(root, join(entry.parentPath, entry.name)))
    .filter(keep);
}

// The bundled TypeScript under src/: neither tests, test helpers nor the build code in src/build/.
const shippedScript = (path: string) =>
  path.endsWith(".ts") &&
  !path.endsWith(".test.ts") &&
  !path.endsWith(".d.ts") &&
  !path.startsWith("src/testing/") &&
  !path.startsWith("src/tests/") &&
  !path.startsWith("src/build/") &&
  path !== "src/testSetup.ts";

// A script's string literals and template text, cooked so escapes resolve, and the module
// specifiers of its static imports, re-exports and dynamic imports.
function scanScript(
  path: string,
  source: string,
  kind: ts.ScriptKind,
): { specifiers: string[]; texts: string[] } {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, kind);
  const texts: string[] = [];
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      texts.push(decodeEntities(node.text));
    }
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { specifiers, texts };
}

// Quoted strings in CSS, such as content values.
const cssTexts = (source: string) =>
  [...source.matchAll(/(["'])(.*?)\1/gu)].map(([, , text]) => text!);

function jsonTexts(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(jsonTexts);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => [key, ...jsonTexts(item)]);
  }
  return [];
}

// The file a game-kit package specifier resolves to through the kit's exports map, or undefined
// for a types-only export.
function kitModule(root: string, specifier: string): string | undefined {
  const base = join(root, "node_modules", KIT);
  const { exports } = JSON.parse(readFileSync(join(base, "package.json"), "utf8")) as {
    exports: Record<string, string | { import?: string }>;
  };
  const subpath = `.${specifier.slice(KIT.length).replace(/\?.*$/u, "")}`;
  const target = exports[subpath];
  if (target === undefined) {
    throw new Error(`${specifier} is not exported by ${KIT}`);
  }
  const file = typeof target === "string" ? target : target.import;
  return file === undefined ? undefined : resolve(base, file);
}

/** Every text the game page can set in AdaUI, sorted by source and then text, without duplicates. */
export function collectUiStrings(root: string): UiString[] {
  const found = new Map<string, UiString>();
  const add = (source: string, text: string) => {
    if (text.trim() !== "") {
      found.set(`${source}\0${text}`, { source, text });
    }
  };
  // The art data the game fetches or imports, its manifests and names among them.
  const json = new Set(repoFiles(root, "public/art", (path) => path.endsWith(".json")));
  const kitQueue: string[] = [];
  for (const path of repoFiles(root, "src", shippedScript)) {
    const { specifiers, texts } = scanScript(
      path,
      readFileSync(join(root, path), "utf8"),
      ts.ScriptKind.TS,
    );
    texts.forEach((text) => add(path, text));
    for (const specifier of specifiers) {
      if (specifier.startsWith(".") && specifier.endsWith(".json")) {
        json.add(posixPath(root, resolve(root, dirname(path), specifier)));
      } else if (specifier.startsWith(`${KIT}/`)) {
        const file = kitModule(root, specifier);
        if (file !== undefined) {
          kitQueue.push(file);
        }
      }
    }
  }
  for (const path of repoFiles(root, "src", (path) => path.endsWith(".css"))) {
    cssTexts(readFileSync(join(root, path), "utf8")).forEach((text) => add(path, text));
  }
  add(PAGE, decodeEntities(readFileSync(join(root, PAGE), "utf8")));
  for (const path of json) {
    jsonTexts(JSON.parse(readFileSync(join(root, path), "utf8"))).forEach((text) =>
      add(path, text),
    );
  }
  // The kit modules the game imports and the kit modules they import in turn.
  const kitSeen = new Set<string>();
  while (kitQueue.length > 0) {
    const file = kitQueue.pop()!;
    if (kitSeen.has(file)) {
      continue;
    }
    kitSeen.add(file);
    const path = posixPath(root, file);
    const source = readFileSync(file, "utf8");
    if (file.endsWith(".css")) {
      cssTexts(source).forEach((text) => add(path, text));
      continue;
    }
    const { specifiers, texts } = scanScript(path, source, ts.ScriptKind.JS);
    texts.forEach((text) => add(path, text));
    for (const specifier of specifiers) {
      const next = resolve(dirname(file), specifier);
      if (specifier.startsWith(".") && existsSync(next)) {
        kitQueue.push(next);
      }
    }
  }
  const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return [...found.values()].sort((a, b) => order(a.source, b.source) || order(a.text, b.text));
}

/** The producer's input, { strings: [{ source, text }] }, without the fallback characters. */
export function uiStringsExport(strings: readonly UiString[]): { strings: UiString[] } {
  return {
    strings: strings
      .map(({ source, text }) => ({
        source,
        text: [...text].filter((character) => !FALLBACK_CHARACTERS.has(character)).join(""),
      }))
      .filter(({ text }) => text.trim() !== ""),
  };
}

/**
 * The code points a TrueType font maps to a glyph other than .notdef, from its format 12
 * Unicode cmap subtable, else its format 4 one.
 */
export function cmapCoverage(font: Uint8Array): Set<number> {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  let cmap: number | undefined;
  for (let i = 0; i < view.getUint16(4); i++) {
    const record = 12 + i * 16;
    if (String.fromCharCode(...font.subarray(record, record + 4)) === "cmap") {
      cmap = view.getUint32(record + 8);
    }
  }
  if (cmap === undefined) {
    throw new RangeError("Font has no cmap table");
  }
  let format4: number | undefined;
  let format12: number | undefined;
  for (let i = 0; i < view.getUint16(cmap + 2); i++) {
    const record = cmap + 4 + i * 8;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const offset = cmap + view.getUint32(record + 4);
    if (platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))) {
      const format = view.getUint16(offset);
      if (format === 12) {
        format12 ??= offset;
      } else if (format === 4) {
        format4 ??= offset;
      }
    }
  }
  const coverage = new Set<number>();
  if (format12 !== undefined) {
    for (let group = 0; group < view.getUint32(format12 + 12); group++) {
      const record = format12 + 16 + group * 12;
      const start = view.getUint32(record);
      const glyph = view.getUint32(record + 8);
      for (let code = start; code <= view.getUint32(record + 4); code++) {
        if (glyph + code - start !== 0) {
          coverage.add(code);
        }
      }
    }
    return coverage;
  }
  if (format4 === undefined) {
    throw new RangeError("Font has no Unicode format 4 or 12 cmap subtable");
  }
  const segments = view.getUint16(format4 + 6) / 2;
  const ends = format4 + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;
  for (let segment = 0; segment < segments; segment++) {
    const start = view.getUint16(starts + segment * 2);
    const delta = view.getInt16(deltas + segment * 2);
    const rangeAddress = ranges + segment * 2;
    const rangeOffset = view.getUint16(rangeAddress);
    for (let code = start; code <= view.getUint16(ends + segment * 2) && code < 0xffff; code++) {
      const index =
        rangeOffset === 0 ? code : view.getUint16(rangeAddress + rangeOffset + (code - start) * 2);
      if (rangeOffset !== 0 && index === 0) {
        continue;
      }
      if ((index + delta) & 0xffff) {
        coverage.add(code);
      }
    }
  }
  return coverage;
}

const control = (code: number) => code < 0x20 || (code >= 0x7f && code <= 0x9f);

/**
 * One message per character a font does not map, at its first use: C0 and C1 controls and the
 * fallback characters are exempt.
 */
export function uncoveredCharacters(
  font: string,
  coverage: ReadonlySet<number>,
  strings: readonly UiString[],
): string[] {
  const missing = new Map<number, string>();
  for (const { source, text } of strings) {
    for (const character of text) {
      const code = character.codePointAt(0)!;
      if (
        !control(code) &&
        !FALLBACK_CHARACTERS.has(character) &&
        !coverage.has(code) &&
        !missing.has(code)
      ) {
        const hex = code.toString(16).toUpperCase().padStart(4, "0");
        const excerpt = text.length > 80 ? `${text.slice(0, 77)}...` : text;
        missing.set(code, `${font} lacks U+${hex} "${character}" in ${source}: "${excerpt}"`);
      }
    }
  }
  return [...missing.values()];
}
