import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { COLOURS, UNLISTED_COLOURS } from "./colours.ts";

// Every DOM UI size reads src/ui/layout (art/layout.md "Verification"): outside it, src/ui writes
// no raw CSS px and assigns no numeric literal to a geometry property. The style modules inside
// it (those exporting a *_STYLE stylesheet, and its .css files) and src/style.css follow the same
// rules, so every size in a stylesheet is a named token. Every UI colour reads the colour module
// (colours.ts): no other source in src/ui, and not src/style.css, writes a hex colour.

const UI = new URL("../", import.meta.url).pathname;
const PAGE_STYLE = new URL("../../style.css", import.meta.url).pathname;

interface Allowed {
  readonly file: string;
  readonly reason: string;
  // Only CSS rules whose selector matches; the whole file without one.
  readonly selectors?: RegExp;
}

const ALLOWED: readonly Allowed[] = [
  {
    file: "layout/bootSplash.css",
    reason: "Loads before the interface script, so it cannot read the layout or colour modules",
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

// A module in src/ui/layout that exports a stylesheet.
const STYLE_MODULE = /^export const [A-Z][A-Z_]*_STYLE = `/mu;

function isStyleModule(path: string): boolean {
  return path.endsWith(".css") || STYLE_MODULE.test(readFileSync(path, "utf8"));
}

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "layout"
        ? sources(path).filter((file) => isStyleModule(file))
        : sources(path);
    }
    return /\.(?:css|ts)$/u.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const UI_SOURCES = [...sources(UI), PAGE_STYLE];

// Every source in src/ui, layout data modules included, and the page stylesheet, but the colour
// module itself.
const COLOUR_MODULE = "layout/colours.ts";
function allSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return allSources(path);
    }
    return /\.(?:css|ts)$/u.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}
const COLOUR_SOURCES = [...allSources(UI), PAGE_STYLE].filter(
  (path) => relative(UI, path) !== COLOUR_MODULE,
);
const HEX_COLOUR = /#[\da-f]{3,8}\b/giu;

function isAllowed(file: string, selector: string): boolean {
  return ALLOWED.some(
    (entry) =>
      entry.file === file && (entry.selectors === undefined || entry.selectors.test(selector)),
  );
}

export function colourFindings(file: string, text: string): string[] {
  const code = withoutComments(text);
  const blanked = withoutSubstitutions(code);
  return [...code.matchAll(HEX_COLOUR)].flatMap((match) => {
    const selector = selectorAt(blanked, match.index);
    if (isAllowed(file, selector)) {
      return [];
    }
    const line = code.slice(0, match.index).split("\n").length;
    return [`${file}:${line} hex colour: ${match[0]}${selector ? ` in ${selector}` : ""}`];
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
      if (!isAllowed(file, selector)) {
        const line = code.slice(0, match.index).split("\n").length;
        findings.push(`${file}:${line} ${name}: ${match[0]}${selector ? ` in ${selector}` : ""}`);
      }
    }
  }
  return findings;
}

describe("DOM UI sizes", () => {
  it("come from src/ui/layout, never raw px or numeric geometry", () => {
    const findings = UI_SOURCES.flatMap((path) =>
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
    expect(rawPixelFindings("layout/bootSplash.css", "#boot-splash img{width:4px}")).toEqual([]);
    expect(rawPixelFindings("settings.ts", "`.ada-controls button{gap:4px}`")).toHaveLength(1);
    expect(rawPixelFindings("../style.css", "button{min-height:44px}")).toHaveLength(1);
    expect(rawPixelFindings("station.ts", "`.ada-controls .ada-shop-row{gap:4px}`")).toHaveLength(
      1,
    );
    expect(rawPixelFindings("weapons.ts", "`.ada-controls .ada-weapon{gap:4px}`")).toHaveLength(1);
    expect(ALLOWED.every((entry) => entry.reason.length > 0)).toBe(true);
  });

  it("draw every colour from the colour module, never a hex literal", () => {
    const findings = COLOUR_SOURCES.flatMap((path) =>
      colourFindings(relative(UI, path), readFileSync(path, "utf8")),
    );
    expect(findings).toEqual([]);
    expect(COLOUR_SOURCES.map((path) => relative(UI, path))).toEqual(
      expect.arrayContaining(["../style.css", "layout/mapScreen.ts", "modal.ts"]),
    ); // One token per colour value.
    const values = [...Object.values(COLOURS), ...Object.values(UNLISTED_COLOURS)].map((value) =>
      value.toLowerCase(),
    );
    expect(new Set(values).size).toBe(values.length);
  });

  it("catch hex colours in CSS strings and string literals, but not ids or comments", () => {
    const text = [
      "const A = `.x{color:#ead4aa}`;",
      ["const ok = `#app .y{color:$", "{COLOURS.ink}}`; // #181425"].join(""),
    ].join("\n");
    expect(colourFindings("example.ts", text)).toEqual(["example.ts:1 hex colour: #ead4aa in .x"]);
    expect(colourFindings("example.ts", 'const face = "#FF6B6B", mask = "#000";')).toEqual([
      "example.ts:1 hex colour: #FF6B6B",
      "example.ts:1 hex colour: #000",
    ]);
    expect(colourFindings("layout/bootSplash.css", "html{background:#101010}")).toEqual([]);
  });

  it("cover the layout style modules and the page stylesheet, and allow only existing files", () => {
    const checked = UI_SOURCES.map((path) => relative(UI, path));
    expect(checked).toEqual(
      expect.arrayContaining([
        "../style.css",
        "layout/bootSplash.css",
        "layout/questsScreen.ts",
        "layout/stationStyle.ts",
      ]),
    );
    expect(checked).not.toContain("layout/css.ts");
    expect(
      ALLOWED.filter((entry) => !existsSync(join(UI, entry.file)) || !checked.includes(entry.file)),
    ).toEqual([]);
  });
});
