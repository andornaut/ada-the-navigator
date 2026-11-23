import { existsSync, readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { UI_ICON_SHEETS, uiIconUrl } from "./uiIconUrl.ts";

it("maps every packed icon to one view in its physical SVG sheet", () => {
  const sheets = new Set(Object.values(UI_ICON_SHEETS));
  expect(Object.keys(UI_ICON_SHEETS)).toHaveLength(105);
  expect(sheets.size).toBe(6);
  for (const sheet of sheets) {
    const keys = Object.keys(UI_ICON_SHEETS).filter((key) => UI_ICON_SHEETS[key] === sheet);
    const svg = readFileSync(
      new URL(`../../public/art/ui/icons/${sheet}`, import.meta.url),
      "utf8",
    );
    expect([...svg.matchAll(/<view id="([^"]+)"/gu)].map(([, key]) => key).sort()).toEqual(keys);
    for (const key of keys) {
      expect(existsSync(new URL(`../../public/art/ui/icons/${key}.svg`, import.meta.url))).toBe(
        false,
      );
      expect(uiIconUrl(key)).toBe(`/art/ui/icons/${sheet}#${key}`);
    }
  }
});
