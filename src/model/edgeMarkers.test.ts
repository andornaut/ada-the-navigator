import { describe, expect, it } from "vitest";

import {
  BLOCKING_MARKER_KINDS,
  EDGE_MARKER_GLYPHS,
  EDGE_MARKERS,
  edgeMarkerInset,
  ENEMY_MARKER_KINDS,
} from "../data/edgeMarkers.ts";
import { type EnemyArchetype, enemyCatalog } from "../data/enemyCatalog.ts";
import { SCREEN } from "../data/screen.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { logicalView, NO_INSETS, playView, safeGameArea } from "../ui/layout/playView.ts";
import {
  createEdgeMarkerTracker,
  type EdgeMarkerFlight,
  edgeMarkerKind,
  edgePoint,
  GAME_AREA,
  gameAreaPoint,
  inGameArea,
} from "./edgeMarkers.ts";
import { createEnemy } from "./enemyAi.ts";
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
  summonedGuards?: string[];
}
function flight(objects: SpaceObject[], galaxy: GalaxyNumber = 1): TestFlight {
  return { galaxy, objects, player: { x: 0, y: 0 } };
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

  it("marks a heavy that still blocks its route as guard, and as heavy once it is disabled", () => {
    expect(BLOCKING_MARKER_KINDS).toEqual({ heavy: "guard" });
    for (const archetype of ["frigate", "capital", "platform"] as const) {
      const guard = { ...enemy(archetype, NEAR), routeId: "quest" };
      expect(edgeMarkerKind(guard)).toBe("guard");
      guard.enemy!.disabled = true;
      expect(edgeMarkerKind(guard)).toBe("heavy");
    }
    // A small craft guarding a route, such as the holodisk leader, keeps the enemy marker.
    expect(edgeMarkerKind({ ...enemy("fighter", NEAR), routeId: "holodisk" })).toBe("enemy");
  });

  it("draws enemies as a 6 disc, heavies as a 10 disc, guards barred and stations as a diamond", () => {
    expect(EDGE_MARKER_GLYPHS).toEqual({
      enemy: { disc: 6 },
      guard: { bar: { height: 2, width: 7 }, disc: 10 },
      heavy: { disc: 10 },
      station: { diamond: 10, stroke: 2 },
    });
    expect(range).toBe(1400);
    expect(gap).toBe(1);
    // Half the drawn extent, plus the outline, plus 1.
    expect(edgeMarkerInset(0, "enemy")).toBe(4);
    expect(edgeMarkerInset(1, "enemy")).toBe(5);
    expect(edgeMarkerInset(0, "heavy")).toBe(6);
    expect(edgeMarkerInset(0, "guard")).toBe(6);
    expect(edgeMarkerInset(1, "guard")).toBe(7);
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

  it("marks a summoned guard off screen before it is seen, until it reaches the game area", () => {
    const tracker = createEdgeMarkerTracker();
    const guard = { ...enemy("capital", { x: range + 500, y: 0 }, "guard"), routeId: "quest" };
    const state = flight([guard]);
    expect(tracker.update(state, new Set())).toEqual([]);
    state.summonedGuards = ["guard"];
    // Past the range and never seen, it is still marked, as a guard.
    expect(tracker.update(state, new Set())).toEqual([
      { bar: 1, id: "guard", kind: "guard", x: range + 500, y: 0 },
    ]);
    // A direction indicator on it still draws instead.
    expect(tracker.update(state, new Set(["guard"]))).toEqual([]);
    Object.assign(guard, NEAR);
    expect(tracker.update(state, new Set())).toEqual([]);
    // Released once seen, it follows the usual rule: seen, then left, so marked.
    delete state.summonedGuards;
    Object.assign(guard, OFF);
    expect(tracker.update(state, new Set())).toEqual([
      { bar: 1, id: "guard", kind: "guard", ...OFF },
    ]);
  });

  it("keeps a disabled guard's marker, fading its bar out over 150 ms as it becomes a heavy", () => {
    expect(EDGE_MARKERS.swapMs).toBe(150);
    const tracker = createEdgeMarkerTracker();
    const guard = { ...enemy("frigate", NEAR, "guard"), routeId: "quest" };
    const state = flight([guard]);
    tracker.update(state, new Set(), 900);
    Object.assign(guard, OFF);
    expect(tracker.update(state, new Set(), 1000)).toEqual([
      { bar: 1, id: "guard", kind: "guard", ...OFF },
    ]);
    // Its weapons go; its hull holds, so it keeps a marker, now the heavy's.
    guard.enemy!.disabled = true;
    expect(guard.hp).toBeGreaterThan(0);
    expect(tracker.update(state, new Set(), 1000)).toEqual([
      { bar: 1, id: "guard", kind: "heavy", ...OFF },
    ]);
    const bar = (now: number) => tracker.update(state, new Set(), now)[0]!.bar;
    expect(bar(1075)).toBeCloseTo(0.5, 9);
    expect(bar(1120)).toBeCloseTo(0.2, 9);
    expect(tracker.update(state, new Set(), 1150)).toEqual([
      { id: "guard", kind: "heavy", ...OFF },
    ]);
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
      expect(tracker.update({ ...state, galaxy: 2 }, new Set())).toEqual([]);
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
        const at = edgePoint(GAME_AREA, inset, from, to);
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
    const point = edgePoint(GAME_AREA, inset, centre, to);
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
      const point = edgePoint(GAME_AREA, inset, centre, {
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

describe("edge markers inside the safe game area", () => {
  // art/layout.md "Edge markers": each view's safe game area and the 10-across kinds' centre
  // lines on a dark field, in logical view px. Phone insets are 43 at the sides and 19 below.
  const phone = { bottom: 19, left: 43, right: 43, top: 0 };
  const wide = logicalView({ height: 390, width: 844 });
  it.each([
    ["720x360", SCREEN, NO_INSETS, [0, 720, 0, 360], [6, 714, 6, 354]],
    ["720x360, phone insets", SCREEN, phone, [43, 677, 0, 341], [49, 671, 6, 335]],
    ["844x390", wide, NO_INSETS, [29, 749, 0, 360], [35, 743, 6, 354]],
    ["844x390, insets 43", wide, phone, [43, 736.08, 0, 341], [49, 730.08, 6, 335]],
  ] as const)("%s", (_, view, insets, safe, centres) => {
    const area = safeGameArea(insets, view);
    const left = playView(view).x;
    expect(area.x + left).toBeCloseTo(safe[0], 2);
    expect(area.x + area.width + left).toBeCloseTo(safe[1], 2);
    expect(area.y).toBeCloseTo(safe[2], 9);
    expect(area.y + area.height).toBeCloseTo(safe[3], 9);
    const inset = edgeMarkerInset(0, "guard");
    const from = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
    const at = (to: Vec) => edgePoint(area, inset, from, to);
    expect(at({ x: -1e5, y: from.y }).x + left).toBeCloseTo(centres[0], 2);
    expect(at({ x: 1e5, y: from.y }).x + left).toBeCloseTo(centres[1], 2);
    expect(at({ x: from.x, y: -1e5 }).y).toBeCloseTo(centres[2], 9);
    expect(at({ x: from.x, y: 1e5 }).y).toBeCloseTo(centres[3], 9);
  });
});
