import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// Every DOM UI size reads src/ui/layout (art/layout.md "Verification"): outside it, src/ui writes
// no raw CSS px and assigns no numeric literal to a geometry property.

const UI = new URL("../", import.meta.url).pathname;

interface Allowed {
  readonly file: string;
  readonly reason: string;
  // Only CSS rules whose selector matches; the whole file without one.
  readonly selectors?: RegExp;
}

const ALLOWED: readonly Allowed[] = [
  { file: "touch-chrome.ts", reason: "Procedural stick chrome draws in its frames' own px" },
  // CLEANUP (added 2026-11-11): remove once station.ts and weapons.ts read src/ui/layout
  { file: "station.ts", reason: "Station card, shop and Stardust pill are the economy worker's" },
  { file: "weapons.ts", reason: "Weapon buttons are the economy worker's" },
  {
    file: "settings.ts",
    reason: "The weapon selector's rules and the base button under it and the station rows",
    selectors: /\.ada-weapon-selector|^\.ada-controls button(:focus-visible)?$/u,
  },
];

const GEOMETRY = "width|height|x|y|left|top|right|bottom|gap|padding|margin|inset";
// Each check skips the literal 0.
const CHECKS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  // An Npx length.
  { name: "raw px", pattern: /(?<![\w$.-])-?(?:\d*\.)?\d+px\b/gu },
  // A computed value written out in px.
  { name: "computed px", pattern: /\}px\b/gu },
  // A numeric literal assigned to a geometry property.
  {
    name: "numeric geometry",
    pattern: new RegExp(`\\.(?:${GEOMETRY})\\s*=\\s*-?(?:\\d*\\.)?\\d+(?![\\w.])`, "gu"),
  },
  {
    name: "numeric geometry",
    pattern: new RegExp(
      `setProperty\\(\\s*["'\`](?:${GEOMETRY})[\\w-]*["'\`]\\s*,\\s*["'\`]?-?(?:\\d*\\.)?\\d`,
      "gu",
    ),
  },
  // A logical size given as a literal rather than a layout token.
  { name: "literal units", pattern: /\bunits\(\s*-?(?:\d*\.)?\d+\s*\)/gu },
];

// The same text with comments blanked, keeping offsets and lines.
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, " "))
    .replace(/(^|\s)\/\/.*$/gmu, (comment) => comment.replace(/[^\n]/gu, " "));
}

// The same text with template substitutions blanked, so CSS braces can be matched.
function withoutSubstitutions(text: string): string {
  const chars = [...text];
  for (let index = text.indexOf("${"); index >= 0; index = text.indexOf("${", index + 1)) {
    let depth = 0;
    let end = index + 1;
    for (; end < text.length; end++) {
      if (text[end] === "{") {
        depth++;
      }
      if (text[end] === "}" && --depth === 0) {
        break;
      }
    }
    for (let at = index; at <= end && at < chars.length; at++) {
      if (chars[at] !== "\n") {
        chars[at] = " ";
      }
    }
  }
  return chars.join("");
}

// The selector of the CSS rule holding offset, or "" outside one.
function selectorAt(blanked: string, offset: number): string {
  const open = blanked.lastIndexOf("{", offset);
  const close = blanked.lastIndexOf("}", offset);
  if (open < 0 || close > open) {
    return "";
  }
  const start = Math.max(blanked.lastIndexOf("}", open), blanked.lastIndexOf("`", open)) + 1;
  return blanked.slice(start, open).trim().replace(/\s+/gu, " ");
}

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "layout" ? [] : sources(path);
    }
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

export function rawPixelFindings(file: string, text: string): string[] {
  const code = withoutComments(text);
  const blanked = withoutSubstitutions(code);
  const findings: string[] = [];
  for (const { name, pattern } of CHECKS) {
    for (const match of code.matchAll(pattern)) {
      const literal = /-?(?:\d*\.)?\d+(?=\D*$)/u.exec(match[0]);
      if (literal && Number(literal[0]) === 0) {
        continue;
      }
      const selector = selectorAt(blanked, match.index);
      const allowed = ALLOWED.some(
        (entry) =>
          entry.file === file && (entry.selectors === undefined || entry.selectors.test(selector)),
      );
      if (!allowed) {
        const line = code.slice(0, match.index).split("\n").length;
        findings.push(`${file}:${line} ${name}: ${match[0]}${selector ? ` in ${selector}` : ""}`);
      }
    }
  }
  return findings;
}

describe("DOM UI sizes", () => {
  it("come from src/ui/layout, never raw px or numeric geometry", () => {
    const findings = sources(UI).flatMap((path) =>
      rawPixelFindings(relative(UI, path), readFileSync(path, "utf8")),
    );
    expect(findings).toEqual([]);
  });

  it("are caught in CSS strings, computed px, geometry assignments and literal units", () => {
    const text = [
      "const A = `.x{gap:4px}`;",
      // A template substitution followed by px, written without one here.
      ["el.style.width = `$", "{w}px`;"].join(""),
      "el.height = 20;",
      'el.style.setProperty("left", "3");',
      "const b = units(48);",
      "const ok = `.y{margin:0;top:0px}`; el.width = 0; units(SPACING.gap);",
    ].join("\n");
    expect(rawPixelFindings("example.ts", text)).toEqual([
      "example.ts:1 raw px: 4px in .x",
      "example.ts:2 computed px: }px",
      "example.ts:3 numeric geometry: .height = 20",
      'example.ts:4 numeric geometry: setProperty("left", "3',
      "example.ts:5 literal units: units(48)",
    ]);
  });

  it("allow only the listed files and rules", () => {
    expect(
      rawPixelFindings("settings.ts", "`.ada-controls .ada-weapon-selector{gap:4px}`"),
    ).toEqual([]);
    expect(rawPixelFindings("settings.ts", "`.ada-controls .ada-use{gap:4px}`")).toHaveLength(1);
    expect(ALLOWED.every((entry) => entry.reason.length > 0)).toBe(true);
  });
});
