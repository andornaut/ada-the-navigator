import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { EDGE_MARKER_GLYPHS } from "../data/edgeMarkers.ts";
import { MAP_FACES, MAP_GLYPHS, MAP_SYMBOL,mapGlyphSize } from "./layout/mapScreen.ts";
import { chipFace, chipGlyph, travelState } from "./mapScreen.ts";

it("uses the native hostile-station asset while retaining friendly station identity", () => {
  expect(chipGlyph({ symbol: "hostileStation" })).toBe("map-hostile-station");
  expect(chipGlyph({ symbol: "station" })).toBe("map-station");
  expect(MAP_GLYPHS.hostileStation).not.toBe(MAP_GLYPHS.station);
  const source = readFileSync(
    new URL("../../public/art/ui/icons/map-hostile-station.svg", import.meta.url),
    "utf8",
  );
  expect(source).toContain(`width="${EDGE_MARKER_GLYPHS.hostileStation.icon}"`);
  expect(source).toContain(`height="${EDGE_MARKER_GLYPHS.hostileStation.icon}"`);
  expect(mapGlyphSize("hostileStation")).toBe(EDGE_MARKER_GLYPHS.hostileStation.icon);
  expect(mapGlyphSize("station")).toBe(MAP_SYMBOL.glyph);
  expect(mapGlyphSize("job")).toBe(MAP_SYMBOL.glyph);
});

it("retains the canonical station palette and existing target emphasis without a new action", () => {
  expect(chipFace({ job: false, symbol: "hostileStation" })).toBe(MAP_FACES.station);
  expect(chipFace({ job: true, symbol: "hostileStation" })).toBe(MAP_FACES.job);
  expect(travelState(false, false, false, { travel: false })).toEqual({
    offered: false,
    reason: null,
  });
});
