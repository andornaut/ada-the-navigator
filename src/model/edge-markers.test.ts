import { describe, expect, it } from "vitest";

import {
  EDGE_MARKER_GLYPHS,
  EDGE_MARKERS,
  edgeMarkerInset,
  ENEMY_MARKER_KINDS,
} from "../data/edge-markers.ts";
import { type EnemyArchetype, enemyCatalog } from "../data/enemy-catalog.ts";
import { SCREEN } from "../data/screen.ts";
import type { SectorId } from "../data/types.ts";
import {
  createEdgeMarkerTracker,
  type EdgeMarkerFlight,
  edgeMarkerKind,
  edgePoint,
  gameAreaPoint,
  inGameArea,
} from "./edge-markers.ts";
import { createEnemy } from "./enemy-ai.ts";
import type { SpaceObject, Vec } from "./types.ts";

const { gap, range } = EDGE_MARKERS;
// The heavy disc's dark-field inset, which the ray tests below use.
const inset = edgeMarkerInset(0, "heavy");

function enemy(archetype: EnemyArchetype, at: Vec, id = "drone"): SpaceObject {
  return {
    ...at,
    enemy: createEnemy(enemyCatalog[archetype], { archetype, id, packId: null, phase: 0 }, at),
    hp: 1,
    id,
    kind: "enemy",
    radius: 10,
  };
}

/** A flight the test moves its objects through, with Ada at the origin. */
interface TestFlight extends EdgeMarkerFlight {
  objects: SpaceObject[];
}
function flight(objects: SpaceObject[], sector: SectorId = 1): TestFlight {
  return { objects, player: { x: 0, y: 0 }, sector };
}

// World offsets from Ada: 100 east is on screen; 600 east is off it but within range.
const NEAR = { x: 100, y: 0 };
const OFF = { x: 600, y: 0 };

describe("edge marker kinds", () => {
  it("marks small enemies as enemy, the large ships as heavy, stations and outposts as station", () => {
    expect(ENEMY_MARKER_KINDS).toEqual({
      capital: "heavy",
      fighter: "enemy",
      frigate: "heavy",
      interceptor: "enemy",
      platform: "heavy",
      retaliator: "enemy",
      swarm: "enemy",
    });
    for (const archetype of Object.keys(enemyCatalog) as EnemyArchetype[]) {
      expect(edgeMarkerKind(enemy(archetype, NEAR))).toBe(ENEMY_MARKER_KINDS[archetype]);
    }
    const base = { hp: 1, radius: 30, x: 0, y: 0 };
    expect(edgeMarkerKind({ ...base, id: "station:1:2", kind: "station" })).toBe("station");
    for (const id of ["growers", "workshop", "salvagers", "hub"]) {
      expect(edgeMarkerKind({ ...base, id, kind: "destination" })).toBe("station");
    }
    // Friendly places Ada flies through, and everything else, get none.
    for (const id of ["whale", "family", "holodisk", "miner", "visitors"]) {
      expect(edgeMarkerKind({ ...base, id, kind: "destination" })).toBeNull();
    }
    for (const kind of ["rock", "resource", "debris", "pickup", "wreck", "hazard"] as const) {
      expect(edgeMarkerKind({ ...base, id: kind, kind })).toBeNull();
    }
    expect(edgeMarkerKind({ ...enemy("fighter", NEAR), hp: 0 })).toBeNull();
  });

  it("draws enemies as a 6 disc, heavies as a 10 disc and stations as a 10 diamond", () => {
    expect(EDGE_MARKER_GLYPHS).toEqual({
      enemy: { disc: 6 },
      heavy: { disc: 10 },
      station: { diamond: 10, stroke: 2 },
    });
    expect(range).toBe(1400);
    expect(gap).toBe(1);
    // Half the drawn extent, plus the outline, plus 1.
    expect(edgeMarkerInset(0, "enemy")).toBe(4);
    expect(edgeMarkerInset(1, "enemy")).toBe(5);
    expect(edgeMarkerInset(0, "heavy")).toBe(6);
    expect(edgeMarkerInset(1, "station")).toBe(7);
  });
});

describe("edge marker lifecycle", () => {
  it("marks an object only after it has been in the game area and left it", () => {
    const tracker = createEdgeMarkerTracker();
    const drone = enemy("fighter", NEAR);
    const state = flight([drone]);
    expect(inGameArea(gameAreaPoint(state.player, drone))).toBe(true);
    expect(tracker.update(state, new Set())).toEqual([]);
    Object.assign(drone, OFF);
    expect(inGameArea(gameAreaPoint(state.player, drone))).toBe(false);
    expect(tracker.update(state, new Set())).toEqual([{ id: "drone", kind: "enemy", ...OFF }]);
    // Back in the game area, the object itself shows and the marker goes.
    Object.assign(drone, NEAR);
    expect(tracker.update(state, new Set())).toEqual([]);
  });

  it("never marks an object that was never in the game area", () => {
    const tracker = createEdgeMarkerTracker();
    const state = flight([enemy("frigate", OFF)]);
    for (let frame = 0; frame < 3; frame++) {
      expect(tracker.update(state, new Set())).toEqual([]);
    }
  });

  it("forgets an object past the range, and marks it again only after it is seen again", () => {
    const tracker = createEdgeMarkerTracker();
    const drone = enemy("swarm", NEAR);
    const state = flight([drone]);
    tracker.update(state, new Set());
    Object.assign(drone, { x: range - 1, y: 0 });
    expect(tracker.update(state, new Set())).toHaveLength(1);
    Object.assign(drone, { x: range + 1, y: 0 });
    expect(tracker.update(state, new Set())).toEqual([]);
    // Back within range, but not seen since: no marker.
    Object.assign(drone, OFF);
    expect(tracker.update(state, new Set())).toEqual([]);
    Object.assign(drone, NEAR);
    tracker.update(state, new Set());
    Object.assign(drone, OFF);
    expect(tracker.update(state, new Set())).toHaveLength(1);
  });

  it("clears on destruction, unloading, a galaxy change, leaving the flight and a new flight", () => {
    const seenThenLeft = (state: TestFlight) => {
      const tracker = createEdgeMarkerTracker();
      const drone = state.objects[0]!;
      Object.assign(drone, NEAR);
      tracker.update(state, new Set());
      Object.assign(drone, OFF);
      expect(tracker.update(state, new Set())).toHaveLength(1);
      return { drone, tracker };
    };
    {
      const state = flight([enemy("fighter", NEAR)]);
      const { drone, tracker } = seenThenLeft(state);
      drone.hp = 0;
      tracker.update(state, new Set());
      drone.hp = 1;
      expect(tracker.update(state, new Set())).toEqual([]);
    }
    {
      const state = flight([enemy("fighter", NEAR)]);
      const { drone, tracker } = seenThenLeft(state);
      state.objects = [];
      tracker.update(state, new Set());
      state.objects = [drone];
      expect(tracker.update(state, new Set())).toEqual([]);
    }
    {
      const state = flight([enemy("fighter", NEAR)]);
      const { tracker } = seenThenLeft(state);
      expect(tracker.update({ ...state, sector: 2 }, new Set())).toEqual([]);
    }
    {
      const state = flight([enemy("fighter", NEAR)]);
      const { tracker } = seenThenLeft(state);
      tracker.update(null, new Set());
      expect(tracker.update(state, new Set())).toEqual([]);
    }
    {
      // A reload builds a new flight from the save; the tracker starts empty for it.
      const state = flight([enemy("fighter", NEAR)]);
      const { tracker } = seenThenLeft(state);
      expect(tracker.update(structuredClone(state), new Set())).toEqual([]);
    }
  });

  it("lets a direction indicator on the same object draw instead of the marker", () => {
    const tracker = createEdgeMarkerTracker();
    const station: SpaceObject = { hp: 1, id: "station:1:4", kind: "station", radius: 30, ...NEAR };
    const state = flight([station]);
    tracker.update(state, new Set());
    Object.assign(station, OFF);
    expect(tracker.update(state, new Set(["station:1:4"]))).toEqual([]);
    expect(tracker.update(state, new Set())).toEqual([
      { id: "station:1:4", kind: "station", ...OFF },
    ]);
  });
});

describe("edge marker placement", () => {
  it.each(
    (["enemy", "heavy", "station"] as const).flatMap((kind) =>
      [0, 1].map((outline) => [kind, outline] as const),
    ),
  )(
    "draws a %s marker's outermost pixel 1 in on every side and corner, outline %i",
    (kind, outline) => {
      const glyph: { readonly diamond?: number; readonly disc?: number } = EDGE_MARKER_GLYPHS[kind];
      // The drawn half extent: the disc's radius or the diamond's vertex, with the outline around it.
      const half = (glyph.disc ?? glyph.diamond ?? 0) / 2 + outline;
      const from = { x: SCREEN.width / 2, y: SCREEN.height / 2 };
      const far = 100000;
      const inset = edgeMarkerInset(outline, kind);
      // A target far along the ray through the inset rect's corner puts the marker in that corner.
      const corner = (x: number, y: number) => ({
        x: from.x + (x - from.x) * far,
        y: from.y + (y - from.y) * far,
      });
      const edge = { bottom: SCREEN.height - inset, right: SCREEN.width - inset };
      for (const [name, to, sides] of [
        ["left", { x: -far, y: from.y }, ["left"]],
        ["right", { x: far, y: from.y }, ["right"]],
        ["top", { x: from.x, y: -far }, ["top"]],
        ["bottom", { x: from.x, y: far }, ["bottom"]],
        ["top-left", corner(inset, inset), ["left", "top"]],
        ["top-right", corner(edge.right, inset), ["right", "top"]],
        ["bottom-left", corner(inset, edge.bottom), ["left", "bottom"]],
        ["bottom-right", corner(edge.right, edge.bottom), ["right", "bottom"]],
      ] as const) {
        const at = edgePoint(inset, from, to);
        const room = {
          bottom: SCREEN.height - (at.y + half),
          left: at.x - half,
          right: SCREEN.width - (at.x + half),
          top: at.y - half,
        };
        for (const side of sides) {
          expect(room[side], `${kind} ${name} ${side}`).toBeCloseTo(1, 9);
        }
        expect(Math.min(...Object.values(room)), `${kind} ${name}`).toBeCloseTo(1, 9);
      }
    },
  );

  const centre = { x: SCREEN.width / 2, y: SCREEN.height / 2 };
  const right = SCREEN.width - inset;
  const bottom = SCREEN.height - inset;
  it.each([
    ["right", { x: 2000, y: 180 }, { x: right, y: 180 }],
    ["left", { x: -2000, y: 180 }, { x: inset, y: 180 }],
    ["top", { x: 360, y: -900 }, { x: 360, y: inset }],
    ["bottom", { x: 360, y: 900 }, { x: 360, y: bottom }],
    [
      "top-right corner",
      { x: 360 + 10 * (right - 360), y: 180 + 10 * (inset - 180) },
      { x: right, y: inset },
    ],
    [
      "bottom-left corner",
      { x: 360 + 10 * (inset - 360), y: 180 + 10 * (bottom - 180) },
      { x: inset, y: bottom },
    ],
  ] as const)("sits on the inset rect along the ray, %s", (_, to, expected) => {
    const point = edgePoint(inset, centre, to);
    expect(point.x).toBeCloseTo(expected.x, 9);
    expect(point.y).toBeCloseTo(expected.y, 9);
    // On the ray from the centre toward the object.
    const cross =
      (to.x - centre.x) * (point.y - centre.y) - (to.y - centre.y) * (point.x - centre.x);
    expect(cross).toBeCloseTo(0, 6);
  });

  it("follows the object's direction from Ada at any angle", () => {
    for (let turn = 0; turn < 16; turn++) {
      const angle = (turn / 16) * 2 * Math.PI;
      const point = edgePoint(inset, centre, {
        x: centre.x + 5000 * Math.cos(angle),
        y: centre.y + 5000 * Math.sin(angle),
      });
      const onVertical = Math.abs(point.x - inset) < 1e-9 || Math.abs(point.x - right) < 1e-9;
      const onHorizontal = Math.abs(point.y - inset) < 1e-9 || Math.abs(point.y - bottom) < 1e-9;
      expect(onVertical || onHorizontal).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(inset - 1e-9);
      expect(point.x).toBeLessThanOrEqual(right + 1e-9);
      expect(point.y).toBeGreaterThanOrEqual(inset - 1e-9);
      expect(point.y).toBeLessThanOrEqual(bottom + 1e-9);
    }
  });
});
