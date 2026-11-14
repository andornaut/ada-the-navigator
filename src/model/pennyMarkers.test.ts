import { describe, expect, it } from "vitest";

import { CONVERSATION_TUNING } from "../data/conversations.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { pennyIndicatorTargets, PennyMarkers, type PennyPoint } from "./pennyMarkers.ts";

const player = { x: 0, y: 0 };
const point = (id: string, x = 1450): PennyPoint => ({
  id,
  known: false,
  symbol: "wreck",
  x,
  y: 0,
});

describe("Penny's displayed target markers", () => {
  it("admits only displayed targets and never substitutes a nearer queued point", () => {
    const tracker = new PennyMarkers(),
      flight = {};
    const points = [point("displayed"), point("queued", 500)];
    expect(tracker.targets(flight, GAME_AREA, new Set(), undefined, player, points)).toEqual([]);
    tracker.displayed(flight, "displayed");
    expect(tracker.targets(flight, GAME_AREA, new Set(), undefined, player, points)).toMatchObject([
      { id: "displayed", identified: false, x: 1450 },
    ]);
    // No conversation is needed to keep the same target after its notice fades.
    expect(
      tracker.targets(flight, GAME_AREA, new Set(), undefined, player, points.slice().reverse())[0]
        ?.id,
    ).toBe("displayed");
  });

  it("identifies only after visible or known, retaining identity beyond the old 1400 cutoff", () => {
    const tracker = new PennyMarkers(),
      flight = {};
    tracker.displayed(flight, "a");
    const narrow = { height: 200, width: 500, x: 100, y: 80 };
    expect(
      tracker.targets(flight, narrow, new Set(), undefined, player, [point("a", 250)])[0]
        ?.identified,
    ).toBe(false);
    expect(
      tracker.targets(flight, GAME_AREA, new Set(), undefined, player, [point("a", 200)]),
    ).toEqual([]);
    expect(
      tracker.targets(flight, GAME_AREA, new Set(), undefined, player, [point("a")])[0]?.identified,
    ).toBe(true);
    const other = new PennyMarkers();
    other.displayed(flight, "known");
    expect(
      other.targets(flight, GAME_AREA, new Set(), undefined, player, [
        { ...point("known"), known: true },
      ])[0]?.identified,
    ).toBe(true);
  });

  it("clears reached, removed and out-of-range targets without reviving on later lines", () => {
    for (const replacement of [[], [point("a", 100)], [point("a", 1501)]]) {
      const tracker = new PennyMarkers(),
        flight = {};
      tracker.displayed(flight, "a");
      expect(tracker.targets(flight, GAME_AREA, new Set(), undefined, player, replacement)).toEqual(
        [],
      );
      tracker.displayed(flight, "a");
      expect(
        tracker.targets(flight, GAME_AREA, new Set(), undefined, player, [point("a")]),
      ).toEqual([]);
    }
  });

  it("gives reserved indicators priority without losing target identity", () => {
    const tracker = new PennyMarkers(),
      flight = {};
    tracker.displayed(flight, "a");
    expect(
      tracker.targets(flight, GAME_AREA, new Set(["a"]), undefined, player, [point("a")]),
    ).toEqual([]);
    expect(
      tracker.targets(flight, GAME_AREA, new Set(), undefined, player, [point("a")])[0]?.id,
    ).toBe("a");
    expect(tracker.targets({}, GAME_AREA, new Set(), undefined, player, [point("a")])).toEqual([]);
  });

  it("uses the nearest wrapped image and the ordinary inclusive 1500 boundary", () => {
    const tracker = new PennyMarkers(),
      flight = {};
    tracker.displayed(flight, "seam");
    const markers = tracker.targets(flight, GAME_AREA, new Set(), 10000, { x: 4900, y: 0 }, [
      point("seam", -3600),
    ]);
    expect(CONVERSATION_TUNING.pennyRange).toBe(1500);
    expect(markers).toMatchObject([{ id: "seam", identified: false, x: 6400 }]);
  });
});

it("does not identify a geometrically on-screen item while its actual glint is hidden", () => {
  const tracker = new PennyMarkers(),
    flight = {};
  tracker.displayed(flight, "hidden");
  const markers = tracker.targets(flight, GAME_AREA, new Set(), undefined, player, [
    { ...point("hidden", 200), identifiable: false },
  ]);
  expect(markers).toMatchObject([{ id: "hidden", identified: false }]);
});

it("retains an identified station after visiting it, including 1450 away", () => {
  const tracker = new PennyMarkers(),
    flight = {};
  tracker.displayed(flight, "station");
  expect(
    tracker.targets(flight, GAME_AREA, new Set(), undefined, player, [
      { ...point("station", 100), known: true, symbol: "station" },
    ]),
  ).toEqual([]);
  expect(
    tracker.targets(flight, GAME_AREA, new Set(), undefined, player, [
      { ...point("station"), known: true, symbol: "station" },
    ]),
  ).toMatchObject([{ id: "station", identified: true }]);
});

it("removes replaced station and hunt arrows while preserving objective, quest and holodisk priority", () => {
  const targets = [
    { id: "station", kind: "station" as const, x: 0, y: 0 },
    { id: "hunt", kind: "job" as const, x: 0, y: 0 },
    { id: "objective", kind: "objective" as const, x: 0, y: 0 },
    { id: "quest", kind: "questItem" as const, x: 0, y: 0 },
    { id: "holodisk", kind: "holodisk" as const, x: 0, y: 0 },
  ];
  expect(pennyIndicatorTargets(new Set(targets.map(({ id }) => id)), targets)).toEqual(
    targets.slice(2),
  );
});
