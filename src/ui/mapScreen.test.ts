import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { MapPlace, MapSymbol } from "../model/map.ts";
import { MAP_FACES, MAP_GLYPHS } from "./layout/mapScreen.ts";
import {
  chipFace,
  chipGlyph,
  emptyPanelHeight,
  MAP_SCREEN_STYLE,
  mapDistance,
  mapScreenLabels,
  panelHeight,
  placeLines,
  travelState,
} from "./mapScreen.ts";

// Gameplay's player copy, with its line wrapping undone, and the quests document as written.
const COPY = readFileSync(new URL("../../gameplay/player-copy.md", import.meta.url), "utf8")
  .replace(/\s+/gu, " ")
  .trim();
const QUESTS = readFileSync(new URL("../../gameplay/quests.md", import.meta.url), "utf8");
const LABELS = mapScreenLabels(CONTENT.labels);
const ADA = { x: 0, y: 0 };
const place = (symbol: MapSymbol, change: Partial<MapPlace> = {}): MapPlace => ({
  id: symbol,
  job: false,
  kind: "destination",
  label: symbol,
  objective: false,
  symbol,
  travel: false,
  x: 400,
  y: 0,
  ...change,
});

describe("map screen strings", () => {
  it("use the player copy's tool labels, type names, type line and distances", () => {
    expect(COPY).toContain(
      `Map tools, accessible labels: ${LABELS.centerOnAda}; ${LABELS.zoomIn}; ${LABELS.zoomOut}.`,
    );
    expect([LABELS.centerOnAda, LABELS.zoomIn, LABELS.zoomOut]).toEqual([
      "Center on Ada",
      "Zoom in",
      "Zoom out",
    ]);
    const { beacon, holodisk, nebula, outpost, station, story, wreck } = LABELS.types;
    expect(COPY).toContain(
      `a line naming its kind: ${station}, ${outpost}, ${story} (other story destinations, ` +
        `such as the whale and its family; the mining hub is a ${station}), ` +
        `${holodisk}, ${nebula}, ${wreck} or ${beacon}, then " · " and the distance from Ada.`,
    );
    expect(LABELS.typeLine).toBe("{type} · {distance}");
    expect(COPY).toContain(`the job's "${LABELS.jobObjective}" line follows.`);
    expect(COPY).toContain(`("${LABELS.distance.replace("{distance}", "0.4")}")`);
    expect(COPY).toContain(`("${LABELS.distance.replace("{distance}", "12")}")`);
    expect(COPY).toContain(`and "${LABELS.distanceOne}" when it rounds to 1.`);
    // The towing reason is the quests document's towTravel string.
    const row = QUESTS.split("\n").find((line) => line.startsWith("| `towTravel`"));
    expect(row?.split("|")[2]?.trim()).toBe(LABELS.towTravel);
  });

  it("offer Galaxies and Quests by the player copy's local map and Quests modal lines", () => {
    expect(LABELS.galaxies).toBe("Galaxies");
    expect(COPY).toContain(
      `Local map: Map; {percent}% mapped; Travel here; ${LABELS.galaxies}; ${LABELS.quests}.`,
    );
    expect(COPY).toContain(
      `Quests modal: ${LABELS.quests}; ${LABELS.questsStoryComplete}; ${LABELS.jobObjective}; ` +
        `${LABELS.questsJobBoards}; ${LABELS.questsEmpty}`,
    );
  });

  it("give every label a string", () => {
    const { types, ...flat } = LABELS;
    for (const [key, value] of Object.entries({ ...flat, ...types })) {
      expect(value, key).not.toBe("");
    }
  });
});

describe("map distances", () => {
  it("read light-years of 1000 world units: one decimal below 10, whole from 10", () => {
    // In world units, so each boundary is exact.
    const at = (units: number) => mapDistance(LABELS, units);
    expect(at(400)).toBe("0.4 light-years");
    expect(at(940)).toBe("0.9 light-years");
    expect(at(950)).toBe("1 light-year");
    expect(at(1000)).toBe("1 light-year");
    expect(at(1050)).toBe("1.1 light-years");
    expect(at(9940)).toBe("9.9 light-years");
    expect(at(9950)).toBe("10 light-years");
    expect(at(10000)).toBe("10 light-years");
    expect(at(12400)).toBe("12 light-years");
    expect(at(1_000_000)).toBe("1,000 light-years");
  });
});

describe("map place type lines", () => {
  it("name each place type with its distance from Ada", () => {
    const lines = (symbol: MapSymbol) => placeLines(LABELS, ADA, null, place(symbol));
    expect(lines("station")).toEqual(["Station · 0.4 light-years"]);
    for (const outpost of ["growers", "workshop", "salvagers"] as const) {
      expect(lines(outpost)).toEqual(["Outpost · 0.4 light-years"]);
    }
    expect(lines("destination")).toEqual(["Story place · 0.4 light-years"]);
    expect(lines("holodisk")).toEqual(["Holodisk · 0.4 light-years"]);
    expect(lines("nebula")).toEqual(["Nebula · 0.4 light-years"]);
    expect(lines("wreck")).toEqual(["Wreck · 0.4 light-years"]);
    expect(lines("beacon")).toEqual(["Beacon · 0.4 light-years"]);
  });

  it("follow the type line with the job line on the held job's target only", () => {
    const target = place("station", { job: true, x: 0, y: 12000 });
    expect(placeLines(LABELS, ADA, "Deliver a seed pod", target)).toEqual([
      "Station · 12 light-years",
      "Job: Deliver a seed pod",
    ]);
    expect(placeLines(LABELS, ADA, "Deliver a seed pod", place("station"))).toEqual([
      "Station · 0.4 light-years",
    ]);
    // A job's own spot is named by the job: it has no type line and no second job line.
    const spot = place("job", { job: true, kind: "job", label: "Find a lost toolbox" });
    expect(placeLines(LABELS, ADA, "Find a lost toolbox", spot)).toEqual([]);
  });
});

describe("map screen place panel", () => {
  it("offers Travel here only for destinations and stations, refused in danger, towing, then carrying", () => {
    expect(travelState(false, false, false, null)).toEqual({ offered: false, reason: null });
    expect(travelState(false, false, false, { travel: true })).toEqual({
      offered: true,
      reason: null,
    });
    expect(travelState(true, true, false, { travel: true })).toEqual({
      offered: true,
      reason: "danger",
    });
    expect(travelState(false, true, false, { travel: true })).toEqual({
      offered: true,
      reason: "towing",
    });
    // Carrying a job item refuses as towing does, after danger and towing.
    expect(travelState(false, false, true, { travel: true })).toEqual({
      offered: true,
      reason: "carrying",
    });
    expect(travelState(false, true, true, { travel: true })).toEqual({
      offered: true,
      reason: "towing",
    });
    expect(travelState(false, false, true, { travel: false })).toEqual({
      offered: false,
      reason: null,
    });
  });

  it("gives the danger reason for every selection and none, and towing only beside Travel here", () => {
    expect(travelState(true, false, false, null)).toEqual({ offered: false, reason: "danger" });
    expect(travelState(true, true, false, { travel: false })).toEqual({
      offered: false,
      reason: "danger",
    });
    expect(travelState(false, true, false, { travel: false })).toEqual({
      offered: false,
      reason: null,
    });
    expect(travelState(false, true, false, null)).toEqual({ offered: false, reason: null });
  });

  it("holds the reason alone in 52, or after the empty note in 80", () => {
    expect(panelHeight(true, 0)).toBe(52);
    expect(emptyPanelHeight(true)).toBe(80);
    expect(emptyPanelHeight(false)).toBe(52);
  });

  it("is 80 high, or 108 with the reason line, and 100 with a third text line", () => {
    expect(panelHeight(false)).toBe(80);
    expect(panelHeight(true)).toBe(108);
    expect(panelHeight(false, 1)).toBe(80);
    expect(panelHeight(false, 3)).toBe(100);
    expect(panelHeight(true, 3)).toBe(128);
  });

  it("marks every held job on the orange face: a target keeps its glyph, a job's spot its type's", () => {
    // The chip's inline face is its only face: no stylesheet rule competes with it.
    expect(chipFace(place("station", { job: true }))).toBe("#feae34");
    expect(chipFace(place("job", { job: true, kind: "job" }))).toBe("#feae34");
    expect(chipFace(place("station"))).toBe(MAP_FACES.station);
    expect(MAP_SCREEN_STYLE).not.toMatch(/\[data-job\]\{[^}]*--face/u);
    expect(chipGlyph(place("station", { job: true }))).toBe(MAP_GLYPHS.station);
    for (const type of ["survey", "delivery", "rescue", "hunt"] as const) {
      expect(chipGlyph(place("job", { job: true, jobType: type, kind: "job" }))).toBe(
        `map-job-${type}`,
      );
      expect(
        existsSync(new URL(`../../public/art/ui/icons/map-job-${type}.svg`, import.meta.url)),
      ).toBe(true);
    }
    // The job spot is a round chip like every other: no diamond, one ring rule for every chip.
    expect(MAP_SCREEN_STYLE).not.toContain("rotate(45deg)");
    expect(MAP_SCREEN_STYLE.match(/\[aria-pressed="true"\]::after\{/gu)).toHaveLength(1);
  });

  it("sizes the panel to its content between the card floor and the script-set maximum", () => {
    const panel = (() => {
      const from = MAP_SCREEN_STYLE.indexOf("/* The place panel:");
      return MAP_SCREEN_STYLE.slice(from, MAP_SCREEN_STYLE.indexOf("}", from));
    })();
    expect(panel).toContain("width:max-content");
    expect(panel).toContain("min-width:");
    expect(panel).not.toContain("max-width");
  });
});
