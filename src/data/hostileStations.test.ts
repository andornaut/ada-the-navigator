import { expect, it } from "vitest";

import { enemyActorDefinition } from "./enemyActorDefinition.ts";
import { enemyCatalog, enemyDefinition, enemyFire } from "./enemyCatalog.ts";
import { ROUTE } from "./galaxies.ts";
import { hostileStationDefinition } from "./hostileStations.ts";

it("keeps approved station hulls and all-weapon prefixes with one Ring and all other Rapid", () => {
  for (const [galaxy, count, hp, partHp] of [
    [5, 6, 144, 12],
    [2, 7, 196, 14],
    [6, 8, 224, 14],
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

it("uses final shared cadence without stacking the old curve and retains enemy-only Ring cadence", () => {
  const station = enemyActorDefinition(5, "hostileStation", "station", 3);
  const weapon = (id: string) => {
    const part = station.hardpoints.find((part) => part.id === id)!;
    if (part.kind !== "weapon") {
      throw Error("expected station weapon");
    }
    return part.fire;
  };
  expect(weapon("weapon-0").interval).toBeCloseTo(0.2 / 0.3, 12);
  expect(weapon("weapon-5").interval).toBeCloseTo(3.5 / 1.88, 12);
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

it("keeps station clocks continuous even when the supplied base is phased", () => {
  const definition = hostileStationDefinition(
    {
      base: { ...enemyCatalog.platform, fireClockPolicy: "staggered-and-paused" },
      fire: (weapon) => enemyFire("platform", { level: 2, weapon }),
      partHp: 7,
    },
    { galaxy: 5, weaponLevel: 2 },
  );
  expect(definition.fireClockPolicy).toBe("continuous");
});
