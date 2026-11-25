import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { HOSTILE_STATION_COPY } from "../data/hostileStationCopy.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import type { HostileStationMapStatus, KnownHostileStationMapPlace } from "../model/map.ts";
import { MAP_FACES, MAP_GLYPHS, MAP_SYMBOL, mapGlyphSize } from "./layout/mapScreen.ts";
import { createMapPresentationRevision } from "./mapRenderQueue.ts";
import { chipFace, chipGlyph, mapScreenLabels, placeLines, travelState } from "./mapScreen.ts";

it("uses the native hostile-station asset while retaining friendly station identity", () => {
  expect(chipGlyph({ symbol: "hostileStation" })).toBe("map-hostile-station");
  expect(chipGlyph({ symbol: "station" })).toBe("map-station");
  expect(MAP_GLYPHS.hostileStation).not.toBe(MAP_GLYPHS.station);
  const source = readFileSync(
    new URL(`../../public${uiIconUrl("map-hostile-station")}`, import.meta.url),
    "utf8",
  );
  expect(source).toContain(`width="${MAP_SYMBOL.hostileStationGlyph}"`);
  expect(source).toContain(`height="${MAP_SYMBOL.hostileStationGlyph}"`);
  expect(mapGlyphSize("hostileStation")).toBe(MAP_SYMBOL.hostileStationGlyph);
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

it("presents canonical identified rows without granting services in any current body state", () => {
  const labels = mapScreenLabels(CONTENT.labels);
  const statuses: readonly HostileStationMapStatus[] = [
    "present",
    "disabled",
    "removed",
    "unresolved",
  ];
  for (const hostileStationStatus of statuses) {
    const row: KnownHostileStationMapPlace = {
      hostileStationStatus,
      id: "hostile-site:5:1",
      job: false,
      kind: "hostileStation",
      label: HOSTILE_STATION_COPY.label,
      objective: false,
      symbol: "hostileStation",
      travel: false,
      x: 300,
      y: 400,
    };
    expect(row.label).toBe("Hostile station");
    expect(chipGlyph(row)).toBe("map-hostile-station");
    expect(mapGlyphSize(row.symbol)).toBe(24);
    expect(placeLines(labels, { x: 0, y: 0 }, null, row)).toEqual([
      labels.typeLine
        .replace("{type}", labels.types.station)
        .replace("{distance}", labels.distance.replace("{distance}", "0.5")),
    ]);
    for (const inDanger of [false, true]) {
      expect(travelState(inDanger, true, true, row).offered).toBe(false);
    }
  }
});

it("invalidates a retained identified row when only authoritative body status changes", () => {
  const revision = createMapPresentationRevision();
  const state = { map: { places: [{ hostileStationStatus: "present", id: "hostile-site:5:1" }] } };
  expect(revision.changed({}, state)).toBe(true);
  expect(revision.changed({}, structuredClone(state))).toBe(false);
  for (const status of ["disabled", "removed", "unresolved", "present"]) {
    state.map.places[0]!.hostileStationStatus = status;
    expect(revision.changed({}, state)).toBe(true);
    expect(revision.changed({}, structuredClone(state))).toBe(false);
  }
});
