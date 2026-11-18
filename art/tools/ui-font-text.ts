// Interim UI string export: every string literal and template text the game page can show,
// written in the shape the font producer reads ({ strings: [{ source, text }] }). It is a
// superset of the player-visible strings and the input to the subset verification.
// CLEANUP (added 2026-11-18): remove once the build writes var/ui-strings.json and the
// coverage check reads it.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export interface UiText {
  readonly source: string;
  readonly text: string;
}

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

// Collected characters Liberation Sans has no glyph for. The completion check mark is set
// in the generic sans-serif font, so it is not exported.
const FALLBACK = /\u2713/gu;

const ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: "\u00a0",
  quot: '"',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity: string, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    }
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

function files(root: string, dir: string, keep: (path: string) => boolean): string[] {
  return readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .filter(keep)
    .sort();
}

// String literals and template text in shipped TypeScript, cooked, so escapes resolve.
function scriptTexts(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const texts: string[] = [];
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
    ts.forEachChild(node, visit);
  };
  visit(file);
  return texts;
}

function jsonStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(jsonStrings);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => [key, ...jsonStrings(item)]);
  }
  return [];
}

// Every text source the game page can show in Liberation Sans: shipped src TypeScript
// (Gameplay's copy, UI labels, templates, loading-failure and crash screens), quoted CSS
// strings, the game page HTML, the art manifests' string values and Gameplay's player copy.
export function collectUiTexts(root: string = ROOT): UiText[] {
  const shipped = (path: string) =>
    path.endsWith(".ts") &&
    !path.endsWith(".test.ts") &&
    !path.endsWith(".d.ts") &&
    !path.startsWith("src/testing/") &&
    !path.startsWith("src/tests/") &&
    path !== "src/testSetup.ts";
  const texts: UiText[] = [];
  for (const path of files(root, "src", shipped)) {
    for (const text of scriptTexts(path, readFileSync(join(root, path), "utf8"))) {
      texts.push({ source: path, text });
    }
  }
  for (const path of files(root, "src", (path) => path.endsWith(".css"))) {
    for (const [, , text] of readFileSync(join(root, path), "utf8").matchAll(/(["'])(.*?)\1/g)) {
      texts.push({ source: path, text: text! });
    }
  }
  const page = "pages/play/index.html";
  texts.push({ source: page, text: decodeEntities(readFileSync(join(root, page), "utf8")) });
  for (const path of files(root, "public/art", (path) => path.endsWith("/manifest.json"))) {
    for (const text of jsonStrings(JSON.parse(readFileSync(join(root, path), "utf8")))) {
      texts.push({ source: path, text });
    }
  }
  const copy = "gameplay/player-copy.md";
  texts.push({ source: copy, text: readFileSync(join(root, copy), "utf8") });
  return texts
    .map(({ source, text }) => ({ source, text: text.replace(FALLBACK, "") }))
    .filter(({ text }) => text.trim() !== "");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    throw new Error("Usage: node art/tools/ui-font-text.ts <ui-strings.json>");
  }
  writeFileSync(resolve(process.argv[2]!), `${JSON.stringify({ strings: collectUiTexts() })}\n`);
}
