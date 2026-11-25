import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
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
import { GALAXY_SIDE } from "../data/world.ts";
import { displayMarkerFixtures, markerEdges, markerModel } from "../testing/markerModel.ts";
import { logicalView, NO_INSETS, playView, safeGameArea } from "../ui/layout/playView.ts";
import { edgeMarkerKind, edgePoint, GAME_AREA } from "./edgeMarkers.ts";
import { createEnemy } from "./enemyAi.ts";
import { createFlight } from "./flight.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";

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

type TestFlight = FlightState;
function flight(objects: SpaceObject[], galaxy: GalaxyNumber = 1): TestFlight {
  const state = createFlight(CONTENT, galaxy, 7, { known: [] });
  state.objects = objects;
  state.player = { x: 0, y: 0 };
  return state;
}

// World offsets from Ada: 100 east is on screen; 600 east is off it but within range.
const NEAR = { x: 100, y: 0 };
const OFF = { x: 600, y: 0 };

describe("edge marker kinds", () => {
  it("maps native hostile station actors without a friendly station or route-guard substitution", () => {
    const kind = ENEMY_MARKER_KINDS.hostileStation;
    expect(kind).toBe("hostileStation");
    expect(BLOCKING_MARKER_KINDS[kind]).toBeUndefined();
    // A hostile station draws the heavy's disc.
    expect(EDGE_MARKER_GLYPHS[kind]).toEqual(EDGE_MARKER_GLYPHS.heavy);
    expect(edgeMarkerInset(0, kind)).toBe(7);
  });

  it("marks small enemies as enemy, the large ships as heavy, stations and outposts as station", () => {
    expect(ENEMY_MARKER_KINDS).toEqual({
      capital: "heavy",
      fighter: "enemy",
      frigate: "heavy",
      hostileStation: "hostileStation",
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
    for (const kind of ["rock", "debris", "pickup", "wreck", "hazard"] as const) {
      expect(edgeMarkerKind({ ...base, id: kind, kind })).toBeNull();
    }
    expect(edgeMarkerKind({ ...enemy("fighter", NEAR), hp: 0 })).toBeNull();
  });

  it("keeps a route guard icon unchanged after its weapons are disabled", () => {
    expect(BLOCKING_MARKER_KINDS).toEqual({ heavy: "guard" });
    for (const archetype of ["frigate", "capital", "platform"] as const) {
      const guard = { ...enemy(archetype, NEAR), routeId: "quest" };
      expect(edgeMarkerKind(guard)).toBe("guard");
      guard.enemy!.disabled = true;
      expect(edgeMarkerKind(guard)).toBe("guard");
    }
    // A small craft guarding a route, such as the holodisk leader, keeps the enemy marker.
    expect(edgeMarkerKind({ ...enemy("fighter", NEAR), routeId: "holodisk" })).toBe("enemy");
  });

  it("keeps generic enemies at six pixels and heavy, guard, hostile and station icons at twelve", () => {
    expect(EDGE_MARKER_GLYPHS).toEqual({
      enemy: { disc: 6 },
      guard: { bar: { height: 2, width: 7 }, disc: 12 },
      heavy: { disc: 12 },
      hostileStation: { disc: 12 },
      station: { diamond: 12, stroke: 2 },
    });
    expect(range).toBe(5000);
    expect(gap).toBe(1);
    // Half the drawn extent, plus the outline, plus 1.
    expect(edgeMarkerInset(0, "enemy")).toBe(4);
    expect(edgeMarkerInset(1, "enemy")).toBe(5);
    expect(edgeMarkerInset(0, "heavy")).toBe(7);
    expect(edgeMarkerInset(0, "guard")).toBe(7);
    expect(edgeMarkerInset(1, "guard")).toBe(8);
    // The guard is the heavy's disc with the ink bar, whose corners sit 2.36 inside the disc.
    const { bar, disc } = EDGE_MARKER_GLYPHS.guard;
    expect(disc).toBe(EDGE_MARKER_GLYPHS.heavy.disc);
    expect(disc / 2 - Math.hypot(bar.width / 2, bar.height / 2)).toBeCloseTo(2.36, 2);
    expect(edgeMarkerInset(1, "station")).toBe(8);
  });
});

describe("canonical edge marker lifecycle", () => {
  it("uses actual display knowledge, hides the edge icon on screen and restores it off screen", () => {
    const drone = enemy("fighter", NEAR),
      state = flight([drone]),
      model = markerModel(state);
    expect(markerEdges(model)).toEqual([]);
    displayMarkerFixtures(model);
    Object.assign(drone, OFF);
    expect(markerEdges(model)).toEqual([{ id: "drone", kind: "enemy", ...OFF }]);
    Object.assign(drone, NEAR);
    expect(markerEdges(model)).toEqual([]);
  });
  it("does not disclose a generic summoned guard and retains its icon after actual display", () => {
    const guard = { ...enemy("capital", { x: range + 500, y: 0 }, "guard"), routeId: "quest" };
    const state = flight([guard]),
      model = markerModel(state);
    expect(markerEdges(model)).toEqual([]);
    state.summonedGuards = [guard.id];
    expect(markerEdges(model)).toEqual([]);
    expect(markerEdges(model)).toEqual([]);
    Object.assign(guard, NEAR);
    displayMarkerFixtures(model);
    expect(markerEdges(model)).toEqual([]);
    delete state.summonedGuards;
    Object.assign(guard, OFF);
    expect(markerEdges(model)).toEqual([{ bar: 1, id: "guard", kind: "guard", ...OFF }]);
  });
  it("retains the identical blocking icon after a guard is disabled, independent of time", () => {
    const guard = { ...enemy("frigate", NEAR, "guard"), routeId: "quest" };
    const state = flight([guard]),
      model = markerModel(state);
    displayMarkerFixtures(model);
    Object.assign(guard, OFF);
    const expected = [{ bar: 1, id: "guard", kind: "guard", ...OFF }];
    expect(markerEdges(model)).toEqual(expected);
    guard.enemy!.disabled = true;
    for (const now of [1000, 1075, 1120, 1150, 100000]) {
      state.time = now / 1000;
      expect(markerEdges(model)).toEqual(expected);
    }
  });
  it("does not identify an ordinary target it has not displayed", () => {
    const model = markerModel(flight([enemy("frigate", OFF)]));
    for (let frame = 0; frame < 3; frame++) {
      expect(markerEdges(model)).toEqual([]);
    }
  });
  it("hides outside5000 and restores within range without a second sighting", () => {
    const drone = enemy("swarm", NEAR),
      state = flight([drone]),
      model = markerModel(state);
    displayMarkerFixtures(model);
    Object.assign(drone, { x: range - 1, y: 0 });
    expect(markerEdges(model)).toHaveLength(1);
    drone.x = range + 1;
    expect(markerEdges(model)).toEqual([]);
    Object.assign(drone, OFF);
    expect(markerEdges(model)).toHaveLength(1);
  });
  it("clears authoritative destruction but retains unloaded knowledge and restores it from full state", () => {
    const drone = enemy("fighter", NEAR),
      state = flight([drone]),
      model = markerModel(state);
    displayMarkerFixtures(model);
    Object.assign(drone, OFF);
    expect(markerEdges(model)).toHaveLength(1);
    state.objects = [];
    expect(markerEdges(model)).toEqual([]);
    state.world.notables[drone.id] = drone;
    expect(markerEdges(model)).toHaveLength(1);
    state.world.notables[drone.id] = null;
    expect(markerEdges(model)).toEqual([]);
    state.objects = [drone];
    expect(markerEdges(model)).toEqual([]);
  });
  it("reconstructs recorded actors on Continue while a fresh flight has its own empty knowledge", () => {
    const drone = enemy("fighter", NEAR),
      state = flight([drone]),
      model = markerModel(state);
    displayMarkerFixtures(model);
    Object.assign(drone, OFF);
    expect(markerEdges(model)).toHaveLength(1);
    expect(markerEdges(markerModel(structuredClone(state)))).toHaveLength(1);
    expect(markerEdges(markerModel(flight([enemy("fighter", OFF)])))).toEqual([]);
    expect(markerEdges(markerModel(flight([enemy("fighter", OFF)], 2)))).toEqual([]);
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
  // art/layout.md "Edge markers": each view's safe game area and the 12-across kinds' centre
  // lines on a dark field, in logical view px. Phone insets are 43 at the sides and 19 below.
  const phone = { bottom: 19, left: 43, right: 43, top: 0 };
  const wide = logicalView({ height: 390, width: 844 });
  it.each([
    ["720x360", SCREEN, NO_INSETS, [0, 720, 0, 360], [7, 713, 7, 353]],
    ["720x360, phone insets", SCREEN, phone, [43, 677, 0, 341], [50, 670, 7, 334]],
    ["844x390", wide, NO_INSETS, [29, 749, 0, 360], [36, 742, 7, 353]],
    ["844x390, insets 43", wide, phone, [43, 736.08, 0, 341], [50, 729.08, 7, 334]],
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

it("retains one identity across a seam only with actual topology metadata", () => {
  const side = GALAXY_SIDE;
  const object = enemy("fighter", { x: -side / 2 + 50, y: 0 });
  const current = flight([object]);
  current.player.x = side / 2 - 200;
  current.topology = { kind: "torus", side, version: 1 };
  const periodic = markerModel(current);
  displayMarkerFixtures(periodic);
  expect(markerEdges(periodic)).toEqual([]);
  object.x += 600;
  expect(markerEdges(periodic)).toEqual([
    { id: object.id, kind: "enemy", x: object.x + side, y: 0 },
  ]);
  expect(markerEdges(periodic)).toHaveLength(1);
  const legacy = flight([{ ...object }]);
  legacy.player.x = current.player.x;
  const model = markerModel(legacy);
  displayMarkerFixtures(model);
  expect(markerEdges(model)).toEqual([]);
  legacy.objects[0]!.x += 100;
  expect(markerEdges(model)).toEqual([]);
  expect(legacy.objects[0]!.x).toBe(-side / 2 + 750);
});
