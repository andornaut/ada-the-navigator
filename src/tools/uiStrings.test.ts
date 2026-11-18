import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  cmapCoverage,
  collectUiStrings,
  FALLBACK_CHARACTERS,
  type UiString,
  uiStringsExport,
  uncoveredCharacters,
} from "./uiStrings.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));
const { decompress } = createRequire(import.meta.url)("wawoff2") as {
  decompress(font: Uint8Array): Promise<Uint8Array>;
};

let strings: UiString[];
// Parsing every shipped script and the art JSON takes a few seconds.
beforeAll(() => {
  strings = collectUiStrings(root);
}, 60_000);

describe("the shipped AdaUI subsets", () => {
  // A failure names the font, the code point, the source and the string. Fix it by rerunning
  // node tools/ui-strings.ts and node art/tools/ui-fonts.ts and committing the fonts.
  it.each(["Regular", "Bold"])(
    "AdaUI-%s maps every character the UI sets in it",
    async (weight) => {
      const font = `AdaUI-${weight}.woff2`;
      const bytes = readFileSync(`${root}public/art/ui/fonts/adaui/${font}`);
      const coverage = cmapCoverage(await decompress(bytes));
      expect(uncoveredCharacters(font, coverage, strings)).toEqual([]);
    },
  );

  it("allows only fallback characters the UI still uses", () => {
    for (const character of FALLBACK_CHARACTERS) {
      expect(strings.some(({ text }) => text.includes(character))).toBe(true);
    }
  });
});

describe("collectUiStrings", () => {
  it("reads shipped copy, kit modules the game imports, imported data and art manifests", () => {
    const sources = new Set(strings.map(({ source }) => source));
    expect(strings).toContainEqual(
      expect.objectContaining({
        source: "src/data/content.ts",
        text: expect.stringContaining("’"),
      }),
    );
    // The build label's separator comes from the kit, not from game source.
    expect(strings).toContainEqual({
      source: "node_modules/@andornaut/game-kit/dist/web/build/buildLabel.js",
      text: " · ",
    });
    expect(sources).toContain("public/art/ship-paint.json");
    expect(sources).toContain("public/art/manifest.json");
    expect(sources).toContain("pages/play/index.html");
    expect([...sources].some((source) => /\.test\.ts$|^src\/(testing|tools)\//u.test(source))).toBe(
      false,
    );
  });
});

describe("uiStringsExport", () => {
  it("drops fallback characters and strings left empty", () => {
    expect(
      uiStringsExport([
        { source: "a.ts", text: "✓" },
        { source: "a.ts", text: "Done ✓" },
      ]),
    ).toEqual({ strings: [{ source: "a.ts", text: "Done " }] });
  });
});

describe("uncoveredCharacters", () => {
  const ascii = new Set(Array.from({ length: 0x5f }, (_, i) => 0x20 + i));

  it("names the first use of each unmapped character", () => {
    expect(
      uncoveredCharacters("F.woff2", ascii, [
        { source: "a.ts", text: "café" },
        { source: "b.ts", text: "été" },
      ]),
    ).toEqual(['F.woff2 lacks U+00E9 "é" in a.ts: "café"']);
  });

  it("exempts controls and fallback characters", () => {
    expect(
      uncoveredCharacters("F.woff2", ascii, [{ source: "a.ts", text: "a\nb\u0085✓" }]),
    ).toEqual([]);
  });
});
