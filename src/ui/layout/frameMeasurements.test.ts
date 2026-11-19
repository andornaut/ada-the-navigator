import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// A portrait touch screen turns the page frame a quarter turn (game-kit frameTurn), and
// getBoundingClientRect measures on the page, so its width and height swap and its edges move to
// other sides. Layout reads boxes through src/ui/layout/frameBox.ts; only the uses below read
// page boxes, each for the reason given.

const SRC = new URL("../../", import.meta.url).pathname;

const PAGE_BOX_USES: Readonly<Record<string, string>> = {
  "input/controls.ts":
    "Maps a pointer's client point into the game through pageToGame and the turn",
  "ui/layout/frameBox.ts": "The frame measurement helpers",
  "ui/layoutTreeMeasurements.ts": "Turns every box into the host's frame axes with frameRect",
  "ui/mapRenderQueue.ts": "A change key for re-rendering, compared and never laid out",
  "ui/mapScreen.ts": "Maps a pointer's client point into the map's frame with framePoint",
  "ui/markerFootprints.ts": "Turns each footprint into the host's frame axes with frameRect",
  "ui/pennyMarkers.ts":
    "Turns each marker box into the frame axes with frameRect and frameDeviceOrigin",
};

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sources(path);
    }
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const files = sources(SRC).map((path) => ({
  file: relative(SRC, path),
  text: readFileSync(path, "utf8"),
}));

describe("turned-frame measurements", () => {
  it("read page boxes only where a use needs page coordinates or turns them itself", () => {
    const users = files
      .filter(({ text }) => text.includes(".getBoundingClientRect()"))
      .map(({ file }) => file)
      .sort();
    expect(users).toEqual(Object.keys(PAGE_BOX_USES).sort());
  });

  it("never take a page box's size or edge straight off getBoundingClientRect", () => {
    const direct = /\.getBoundingClientRect\(\)\??\.(?:width|height|top|bottom|left|right|x|y)\b/u;
    const offenders = files
      .filter(({ file, text }) => file !== "ui/layout/frameBox.ts" && direct.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
