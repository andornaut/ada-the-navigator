import { expect, it } from "vitest";

import { enemyActorDefinition } from "./enemyActorDefinition.ts";
import { enemyCatalog, enemyDefinition, enemyFire } from "./enemyCatalog.ts";
import { ROUTE } from "./galaxies.ts";
import { hostileStationDefinition } from "./hostileStations.ts";

it("keeps approved station hulls and all-weapon prefixes with one Ring and all other Rapid", () => {
  for (const [galaxy, count, hp, partHp] of [
    [5, 6, 175, 12],
    [2, 7, 200, 14],
    [6, 8, 225, 14],
  ] as const) {
    const definition = enemyActorDefinition(galaxy, "hostileStation", "station", 3);
    expect(definition.hp).toBe(hp);
    expect(definition.hullFloor).toBeUndefined();
    expect(definition.sizeRatio).toBe(7);
    expect(definition.hardpoints.map(({ id }) => id)).toEqual(
      Array.from({ length: count }, (_, index) => `weapon-${index}`),
    );
    expect(
      definition.hardpoints.every((part) => part.kind === "weapon" && part.hp === partHp),
    ).toBe(true);
    for (const part of definition.hardpoints) {
      if (part.kind !== "weapon") {
        throw Error("expected station weapon");
      }
      expect([part.fire.weapon, part.fire.level]).toEqual(
        part.id === "weapon-5" ? ["ringBurst", 1] : ["rapidMissile", 3],
      );
    }
    expect(definition.physics).toBe(enemyCatalog.platform.physics);
    expect(definition.physics.maxSpeed).toBe(0);
    expect(definition.navigation).toBeNull();
  }
});

it("uses the standard Rapid Missile fraction and the fixed Ring Burst interval", () => {
  const station = enemyActorDefinition(5, "hostileStation", "station", 3);
  const weapon = (id: string) => {
    const part = station.hardpoints.find((part) => part.id === id)!;
    if (part.kind !== "weapon") {
      throw Error("expected station weapon");
    }
    return part.fire;
  };
  expect(weapon("weapon-0").interval).toBeCloseTo(0.3 / 0.35, 12);
  expect(weapon("weapon-5").interval).toBe(3);
  expect(station).toBe(enemyActorDefinition(5, "hostileStation", "another", 3));
  expect(station).not.toBe(enemyActorDefinition(5, "hostileStation", "station", 1));
});

it("preserves ship profiles and rejects unsupported station definitions before materialization", () => {
  expect(enemyActorDefinition(6, "fighter", "same", 2)).toBe(
    enemyDefinition(6, "fighter", "same", 2),
  );
  expect(Object.hasOwn(enemyCatalog, "hostileStation")).toBe(false);
  for (const galaxy of ROUTE.slice(0, 3)) {
    expect(() => enemyActorDefinition(galaxy, "hostileStation")).toThrow(RangeError);
  }
});

it("uses phased station clocks even when the supplied platform base is continuous", () => {
  const definition = hostileStationDefinition(
    {
      base: enemyCatalog.platform,
      fire: (weapon) => enemyFire("platform", { level: 2, weapon }),
      hullScale: 1,
      partHp: 7,
    },
    { galaxy: 5, weaponLevel: 2 },
  );
  expect(definition.fireClockPolicy).toBe("staggered-and-paused");
  expect(definition.hp).toBe(175);
  expect(definition.hardpoints.every(({ hp }) => hp === 7)).toBe(true);
});
