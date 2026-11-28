import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../../../data/content.ts";
import { enemyActorDefinition } from "../../../data/enemyActorDefinition.ts";
import type { EnemyArchetype } from "../../../data/enemyCatalog.ts";
import { ROUTE_POSITION } from "../../../data/galaxies.ts";
import { PHANTOM_FLAGSHIP, PHANTOM_TUNING } from "../../../data/phantom.ts";
import { GALAXY_SIDE } from "../../../data/world.ts";
import { createEnemy } from "../../ai/index.ts";
import { ASTEROID_SHAPES } from "../../asteroids.ts";
import { partsReach, worldParts } from "../../convex.ts";
import { enemyPhysicalBody } from "../../enemyBody.ts";
import { createUnpopulatedFlight } from "../../flight/index.ts";
import * as placement from "../../stations/formation/index.ts";
import type { SpaceObject, Vec } from "../../types.ts";
import { flightWorldContext, worldDelta, worldDistance, wrapPoint } from "../../world/index.ts";
import { type PhantomEncounterPlacementContext, placePhantomEncounter } from "./index.ts";

const waypoint = { x: 10000, y: 10000 };
function fixture(at = waypoint): PhantomEncounterPlacementContext {
  const flight = createUnpopulatedFlight(CONTENT, 6, 173, undefined, 301);
  flight.player = { x: at.x + PHANTOM_TUNING.battleReach * 2, y: at.y };
  return {
    arrivals: [],
    content: CONTENT,
    drawnOf: () => null,
    fixedIds: new Set(),
    flight,
    frameOf: () => 0,
    waypoint: at,
  };
}
function actor(id: string, point: Vec, archetype: EnemyArchetype = "fighter"): SpaceObject {
  const position = { x: point.x, y: point.y };
  const definition = enemyActorDefinition(6, archetype, id, 2);
  const enemy = createEnemy(
    definition,
    { archetype, id, packId: "explicit-group", phase: 0.25, weaponLevel: 2 },
    position,
  );
  enemy.home = { x: 9000, y: 8000 };
  enemy.velocity = { x: 12, y: -7 };
  enemy.age = 12.5;
  enemy.primaryCooldown = 0.375;
  enemy.hardpoints = enemy.hardpoints.map((part) => ({ ...part, burst: 1, cooldown: 0.6 }));
  return {
    ...position,
    enemy,
    hp: enemy.hp,
    id,
    kind: "enemy",
    persistent: true,
    radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
    role: "unchanged-role",
  };
}
function group(at = waypoint): SpaceObject[] {
  return [
    actor("primary", { x: at.x - 600, y: at.y }, "frigate"),
    actor("supplied-left", { x: at.x - 600, y: at.y - 110 }),
    actor("supplied-right", { x: at.x - 600, y: at.y + 110 }),
  ];
}
function nonPosition(subject: SpaceObject) {
  const value = structuredClone(subject);
  Reflect.deleteProperty(value, "x");
  Reflect.deleteProperty(value, "y");
  if (value.enemy) {
    Reflect.deleteProperty(value.enemy, "position");
  }
  return value;
}
function expectPlacement(
  context: PhantomEncounterPlacementContext,
  original: readonly SpaceObject[],
  result: readonly SpaceObject[],
) {
  expect(result.map(({ id }) => id)).toEqual(original.map(({ id }) => id));
  expect(placement.stationFormationClear(context, result)).toBe(true);
  const world = flightWorldContext(context.flight);
  for (const [index, placed] of result.entries()) {
    const before = original[index]!;
    expect(nonPosition(placed)).toEqual(nonPosition(before));
    expect(placed.enemy!.home).toBe(before.enemy!.home);
    expect(placed.enemy!.velocity).toBe(before.enemy!.velocity);
    expect(placed.enemy!.hardpoints).toBe(before.enemy!.hardpoints);
    expect(placed.enemy!.position).toEqual({ x: placed.x, y: placed.y });
    const reach = partsReach(worldParts(enemyPhysicalBody(ROUTE_POSITION[6], placed.enemy!)!));
    expect(worldDistance(world, context.waypoint, placed) + reach).toBeLessThanOrEqual(
      PHANTOM_TUNING.battleReach,
    );
  }
}

describe("Phantom encounter group placement", () => {
  it("keeps clear originals in caller order and changes neither input world nor full actor state", () => {
    const context = fixture();
    const first = group();
    const second = [actor("other", { x: waypoint.x + 600, y: waypoint.y })];
    const before = structuredClone({ flight: context.flight, groups: [first, second] });
    const result = placePhantomEncounter(context, [first, second])!;
    expect(result).toEqual([...first, ...second]);
    expect(result[0]).toBe(first[0]);
    expectPlacement(context, [...first, ...second], result);
    expect({ flight: context.flight, groups: [first, second] }).toEqual(before);
    expect(placePhantomEncounter(context, [])).toEqual([]);
  });

  it.each(["live", "disabled", "retained", "salvaged"] as const)(
    "moves the explicit group around a real %s old hull without moving, deleting or healing it",
    (kind) => {
      const context = fixture();
      const incoming = group();
      const clear = [actor("clear-original", { x: waypoint.x + 600, y: waypoint.y })];
      const old = actor(
        "old",
        incoming[0]!,
        kind === "live" || kind === "retained" ? "fighter" : "frigate",
      );
      if (kind === "disabled" || kind === "salvaged") {
        old.enemy!.disabled = true;
        old.enemy!.hardpoints.forEach((part) => {
          part.hp = 0;
        });
        old.enemy!.salvaged = kind === "salvaged";
      }
      if (kind === "retained") {
        context.flight.world.notables[old.id] = old;
      } else {
        context.flight.objects.push(old);
      }
      expect(placement.stationFormationClear(context, [...incoming, ...clear])).toBe(false);
      const before = structuredClone({ flight: context.flight, groups: [incoming, clear] });
      const result = placePhantomEncounter(context, [incoming, clear]);
      expect(result).not.toBeNull();
      expectPlacement(context, [...incoming, ...clear], result!);
      expect({ x: result![0]!.x, y: result![0]!.y }).not.toEqual({
        x: incoming[0]!.x,
        y: incoming[0]!.y,
      });
      expect(result![3]).toBe(clear[0]);
      for (let index = 1; index < incoming.length; index++) {
        expect(worldDelta({}, result![0]!, result![index]!)).toEqual(
          worldDelta({}, incoming[0]!, incoming[index]!),
        );
      }
      expect(placePhantomEncounter(context, [incoming, clear])).toEqual(result);
      expect({ flight: context.flight, groups: [incoming, clear] }).toEqual(before);
    },
  );

  it("places the recorded nine-hull next-wave layout around a retained old hull", () => {
    const at = { x: 6744.64282421457, y: -3543.8795950939616 };
    const context = fixture(at);
    const first = [
      actor("phantom:wave:2:0:0", { x: 6613.082382531751, y: -2856.3537045383973 }, "frigate"),
      actor("phantom:wave:2:0:0:escort:0", { x: 6613.082382531751, y: -2746.3537045383973 }),
      actor("phantom:wave:2:0:0:escort:1", { x: 6613.082382531751, y: -2966.3537045383973 }),
    ];
    const second = [
      actor("phantom:wave:2:1:0", { x: 6780.93808267172, y: -4239.9885025747535 }, "frigate"),
      actor("phantom:wave:2:1:0:escort:0", { x: 6780.93808267172, y: -4129.9885025747535 }),
      actor("phantom:wave:2:1:0:escort:1", { x: 6780.93808267172, y: -4349.9885025747535 }),
      actor("phantom:wave:2:1:1", { x: 6560.93808267172, y: -4239.9885025747535 }, "frigate"),
      actor("phantom:wave:2:1:1:escort:0", { x: 6560.93808267172, y: -4129.9885025747535 }),
      actor("phantom:wave:2:1:1:escort:1", { x: 6560.93808267172, y: -4349.9885025747535 }),
    ];
    expect(placement.stationFormationClear(context, [...first, ...second])).toBe(true);
    const old = actor("retained-disabled-hull", first[0]!, "frigate");
    old.enemy!.disabled = true;
    old.enemy!.hardpoints.forEach((part) => {
      part.hp = 0;
    });
    context.flight.world.notables[old.id] = old;
    expect(placement.stationFormationClear(context, [...first, ...second])).toBe(false);
    const before = structuredClone({ flight: context.flight, groups: [first, second] });
    const result = placePhantomEncounter(context, [first, second]);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(9);
    expectPlacement(context, [...first, ...second], result!);
    expect({ flight: context.flight, groups: [first, second] }).toEqual(before);
  });

  it("keeps a fixed flagship at its waypoint while moving only the separately supplied fighter group", () => {
    const context = fixture();
    const flagship = actor(PHANTOM_FLAGSHIP, waypoint, "capital");
    const fighters = [
      actor("first-escort", { x: waypoint.x + 300, y: waypoint.y }),
      actor("second-escort", { x: waypoint.x + 300, y: waypoint.y + 180 }),
    ];
    context.flight.objects.push(actor("surviving-fighter", fighters[0]!));
    const fixed = { ...context, fixedIds: new Set([flagship.id]) };
    expect(placement.stationFormationClear(fixed, [...fighters, flagship])).toBe(false);
    const before = structuredClone({ flight: context.flight, groups: [fighters, [flagship]] });
    const result = placePhantomEncounter(fixed, [fighters, [flagship]])!;
    expect(result).not.toBeNull();
    expect(result[2]).toBe(flagship);
    expect({ x: result[2]!.x, y: result[2]!.y }).toEqual(waypoint);
    expectPlacement(fixed, [...fighters, flagship], result);
    expect(worldDelta({}, result[0]!, result[1]!)).toEqual(
      worldDelta({}, fighters[0]!, fighters[1]!),
    );
    expect({ flight: context.flight, groups: [fighters, [flagship]] }).toEqual(before);
  });

  it("defers a blocked fixed body instead of moving the waypoint or silently dropping its group", () => {
    const context = fixture();
    const flagship = actor(PHANTOM_FLAGSHIP, waypoint, "capital");
    context.flight.objects.push(actor("blocking-old-body", waypoint));
    const fixed = { ...context, fixedIds: new Set([flagship.id]) };
    const incoming = [group(), [flagship]];
    const before = structuredClone({ flight: context.flight, incoming, waypoint });
    expect(placePhantomEncounter(fixed, incoming)).toBeNull();
    expect({ flight: context.flight, incoming, waypoint }).toEqual(before);
  });

  it("uses canonical protected and scenery admission without removing any obstacle", () => {
    const context = fixture();
    const shape = [...ASTEROID_SHAPES.values()].find((value) => value.size === "large")!;
    const rock: SpaceObject = {
      asteroid: shape.id,
      hp: 1,
      id: "rock",
      kind: "rock",
      radius: shape.radius,
      x: waypoint.x + 200,
      y: waypoint.y,
    };
    context.flight.objects.push(rock, {
      hp: 1,
      id: "protected-site",
      kind: "destination",
      radius: 30,
      ...waypoint,
    });
    const incoming = [actor("new-body", waypoint)];
    const before = structuredClone(context.flight);
    expect(placement.stationFormationClear(context, incoming)).toBe(false);
    const result = placePhantomEncounter(context, [incoming])!;
    expect(result).not.toBeNull();
    expectPlacement(context, incoming, result);
    expect(context.flight).toEqual(before);
  });

  it("returns null within a geometry-derived finite query bound when the entire arena is blocked", () => {
    const context = fixture();
    context.flight.objects.push({
      hp: 1,
      id: "opaque-obstacle",
      kind: "wreck",
      radius: PHANTOM_TUNING.battleReach * 2,
      ...waypoint,
    });
    const incoming = [actor("blocked", waypoint)];
    const reach = partsReach(
      worldParts(enemyPhysicalBody(ROUTE_POSITION[6], incoming[0]!.enemy!)!),
    );
    const queries = vi.spyOn(placement, "stationFormationClear");
    try {
      expect(placePhantomEncounter(context, [incoming])).toBeNull();
      const gridSide = 2 * Math.ceil(PHANTOM_TUNING.battleReach / (2 * reach)) + 1;
      expect(queries.mock.calls.length).toBeGreaterThan(1);
      expect(queries.mock.calls.length).toBeLessThanOrEqual(gridSide ** 2 + 2);
    } finally {
      queries.mockRestore();
    }
  });

  it("translates a complete wrapped group using the same local image and canonicalizes only new positions", () => {
    const at = { x: GALAXY_SIDE / 2 - 20, y: 10000 };
    const context = fixture(at);
    context.flight.topology = { kind: "torus", side: GALAXY_SIDE, version: 1 };
    const first = wrapPoint(GALAXY_SIDE, { x: at.x + 600, y: at.y });
    const incoming = [actor("seam-a", first), actor("seam-b", { x: first.x, y: first.y + 120 })];
    context.flight.objects.push(actor("old-seam-body", first));
    const before = structuredClone({ flight: context.flight, incoming });
    const result = placePhantomEncounter(context, [incoming])!;
    expect(result).not.toBeNull();
    expectPlacement(context, incoming, result);
    const world = flightWorldContext(context.flight);
    const actual = worldDelta(world, result[0]!, result[1]!);
    const expected = worldDelta(world, incoming[0]!, incoming[1]!);
    expect(actual.x).toBeCloseTo(expected.x, 8);
    expect(actual.y).toBeCloseTo(expected.y, 8);
    for (const value of result) {
      expect(value.x).toBeGreaterThanOrEqual(-GALAXY_SIDE / 2);
      expect(value.x).toBeLessThan(GALAXY_SIDE / 2);
    }
    expect({ flight: context.flight, incoming }).toEqual(before);
  });
});
