import { describe, expect, it } from "vitest";

import {
  ENEMY_DAMAGE,
  ENEMY_FIRE,
  type EnemyArchetype,
  enemyCatalog,
  enemyDefinition,
  fireDamageRatio,
  type FireProfile,
  type WeaponMounts,
} from "./enemyCatalog.ts";
import type { RoutePosition } from "./galaxies.ts";
import type { GalaxyNumber, Weapon } from "./types.ts";
import { WEAPON_CATALOG, weaponAt } from "./weaponCatalog.ts";

const ROUTE_POSITIONS: readonly RoutePosition[] = [1, 2, 3, 4, 5, 6];
const GALAXY_NUMBERS: readonly GalaxyNumber[] = [1, 2, 3, 4, 5, 6];

const HEAVY_MOUNTS: Readonly<Record<"capital" | "frigate", WeaponMounts>> = {
  capital: enemyCatalog.capital.mounts,
  frigate: enemyCatalog.frigate.mounts,
};
/** Weapons per heavy at positions 1 to 6 (gameplay/ships.md "Difficulty", Heavies). */
const WEAPON_COUNTS = {
  capital: [4, 4, 6, 6, 8, 8],
  frigate: [2, 2, 3, 3, 4, 4],
} as const;

const tiersAt = (mounts: WeaponMounts, position: number) =>
  mounts.tiers.filter(({ positions: [from, to] }) => from <= position && position <= to);

describe("heavy weapon mounts", () => {
  it.each(["capital", "frigate"] as const)(
    "gives the %s one tier per route position with Gameplay's weapon count",
    (archetype) => {
      const mounts = HEAVY_MOUNTS[archetype];
      const counts = ROUTE_POSITIONS.map((position) => {
        const tiers = tiersAt(mounts, position);
        expect(tiers).toHaveLength(1);
        expect(Object.keys(tiers[0]!.mounts).sort()).toEqual([...mounts.fill].sort());
        return Object.values(tiers[0]!.mounts).filter(Boolean).length;
      });
      expect(counts).toEqual(WEAPON_COUNTS[archetype]);
    },
  );

  it.each(["capital", "frigate"] as const)(
    "fills the %s's mounts in fill order and mirrors each pair",
    (archetype) => {
      const mounts = HEAVY_MOUNTS[archetype];
      for (const tier of mounts.tiers) {
        const filled = mounts.fill.map((id) => tier.mounts[id] !== null);
        // Filled mounts are a prefix of the fill order: pairs first, then centreline mounts.
        expect(filled).toEqual([...filled].sort((a, b) => Number(b) - Number(a)));
      }
      const offsets = mounts.fill.map((id) => mounts.offsets[id]!);
      for (let index = 0; index < offsets.length; index++) {
        const offset = offsets[index]!;
        const partner = offsets[index + 1];
        if (offset.x < 0 && partner) {
          expect(partner).toEqual({ x: -offset.x, y: offset.y });
          index++;
        } else {
          expect(offset.x).toBe(0);
        }
      }
    },
  );

  it.each(["capital", "frigate"] as const)(
    "anchors each of the %s's weapon hardpoints on its mount",
    (archetype) => {
      const { hardpoints } = enemyCatalog[archetype];
      const mounts = HEAVY_MOUNTS[archetype];
      for (const part of hardpoints.filter((part) => part.kind === "weapon")) {
        expect(part.offset).toEqual(mounts.offsets[part.id]);
      }
    },
  );
});

describe("enemy weapon damage", () => {
  it("keeps enemy Phaser and Scattershot below Ada's, the other shared weapons as hers", () => {
    expect(fireDamageRatio({ level: 1, weapon: "phaser" })).toBe(4);
    expect(weaponAt("phaser", 1).damageRatio).toBe(9);
    expect(fireDamageRatio({ level: 1, weapon: "scattershot" })).toBe(0.35);
    expect(weaponAt("scattershot", 1).damageRatio).toBe(0.46);
    // Levels 2 and 3 share 1.5 and 2.25 times the level 1 volley across their dots.
    const volley = (level: 1 | 2 | 3) =>
      fireDamageRatio({ level, weapon: "scattershot" }) *
      weaponAt("scattershot", level).anglesDegrees.length;
    expect(volley(2) / volley(1)).toBeCloseTo(1.5, 9);
    expect(volley(3) / volley(1)).toBeCloseTo(2.25, 9);
    expect(Object.keys(ENEMY_DAMAGE).sort()).toEqual(["phaser", "scattershot"]);
    for (const weapon of ["laser", "multiLaser", "rapidMissile", "heavyMissile"] as const) {
      expect(fireDamageRatio({ level: 2, weapon })).toBe(weaponAt(weapon, 2).damageRatio);
    }
  });
});

describe("enemy fire profiles", () => {
  const archetypes = Object.keys(enemyCatalog) as EnemyArchetype[];
  const profiles: FireProfile[] = GALAXY_NUMBERS.flatMap((galaxy) =>
    archetypes.flatMap((archetype) => {
      const definition = enemyDefinition(galaxy, archetype);
      return [
        definition.fire,
        ...definition.hardpoints.flatMap((part) => (part.kind === "weapon" ? [part.fire] : [])),
      ];
    }),
  );

  it("fire a shared weapon's own projectile kind and fan at their level", () => {
    const shared = profiles.filter((profile) => Object.hasOwn(WEAPON_CATALOG, profile.weapon));
    expect(shared.length).toBeGreaterThan(0);
    for (const profile of shared) {
      const definition = weaponAt(profile.weapon as Weapon, profile.level);
      expect(profile.projectile, profile.weapon).toBe(definition.projectileKind);
      expect(profile.angles, profile.weapon).toEqual(definition.anglesDegrees);
    }
  });

  it("arms each heavy at every position with its tier's mounted weapons, capped mounts left out", () => {
    // Weapons and levels in fill order (gameplay/ships.md "Enemy weapons").
    const loadout = (galaxy: GalaxyNumber, archetype: EnemyArchetype) =>
      enemyDefinition(galaxy, archetype).hardpoints.flatMap((part) =>
        part.kind === "weapon" ? [`${part.id} ${part.fire.weapon} ${part.fire.level}`] : [],
      );
    // Galaxy (route position): Sunflower 1 (1), Whirlpool 3 (2), Needle 4 (3), Andromeda 5 (4),
    // Cartwheel 2 (5), Phantom 6 (6).
    expect(loadout(1, "frigate")).toEqual(["port laser 1", "starboard laser 1"]);
    expect(loadout(3, "frigate")).toEqual(["port laser 1", "starboard laser 1"]);
    expect(loadout(4, "frigate")).toEqual([
      "port laser 2",
      "starboard laser 2",
      "spine rapidMissile 2",
    ]);
    expect(loadout(2, "frigate")).toEqual([
      "port laser 3",
      "starboard laser 3",
      "spine rapidMissile 3",
      "bow chargedLance 1",
    ]);
    expect(loadout(1, "capital")).toEqual([
      "weapon-left laser 1",
      "weapon-right laser 1",
      "weapon-rear-left multiLaser 1",
      "weapon-rear-right multiLaser 1",
    ]);
    expect(loadout(5, "capital")).toEqual([
      "weapon-left laser 2",
      "weapon-right laser 2",
      "weapon-rear-left multiLaser 2",
      "weapon-rear-right multiLaser 2",
      "claw-left rapidMissile 2",
      "claw-right heavyMissile 1",
    ]);
    expect(loadout(6, "capital")).toEqual([
      "weapon-left laser 3",
      "weapon-right laser 3",
      "weapon-rear-left rapidMissile 3",
      "weapon-rear-right rapidMissile 3",
      "claw-left phaser 1",
      "claw-right heavyMissile 1",
      "stern-left ringBurst 1",
      "stern-right mineLayer 1",
    ]);
    expect(loadout(1, "platform")).toEqual(["port laser 1", "starboard laser 1"]);
    expect(loadout(5, "platform")).toEqual(["port laser 2", "starboard laser 2"]);
    expect(loadout(6, "platform")).toEqual(["port laser 3", "starboard laser 3"]);
    // Engines and command stay; every hardpoint takes the position's HP.
    const capital = enemyDefinition(6, "capital").hardpoints;
    expect(capital.filter((part) => part.kind !== "weapon").map((part) => part.id)).toEqual([
      "command",
      "engine-left",
      "engine-right",
    ]);
    expect(new Set(capital.map((part) => part.hp))).toEqual(new Set([6]));
  });

  it("arms small craft by position and fires at the enemy cadence over the position's fire rate", () => {
    const fire = (galaxy: GalaxyNumber, archetype: EnemyArchetype) => {
      const profile = enemyDefinition(galaxy, archetype).fire;
      return [profile.weapon, profile.level, profile.interval, profile.projectileSpeedRatio];
    };
    // Sunflower (position 1, fire +44%), Needle (3, +81%) and Phantom (6, +100%).
    expect(fire(1, "swarm")).toEqual(["laser", 1, 1.8 / 1.44, 1.5]);
    expect(fire(1, "fighter")).toEqual(["laser", 1, 1.4 / 1.44, 1.7]);
    expect(fire(1, "interceptor")).toEqual(["laser", 1, 1.4 / 1.44, 1.7]);
    expect(fire(1, "retaliator")).toEqual(["multiLaser", 1, 2.2 / 1.44, 1.7]);
    expect(fire(4, "swarm")).toEqual(["laser", 2, 1.8 / 1.81, 1.5]);
    expect(fire(4, "fighter")).toEqual(["rapidMissile", 2, 2 / 1.81, 1.3]);
    expect(fire(4, "interceptor")).toEqual(["scattershot", 2, 2.4 / 1.81, 1.7]);
    expect(fire(4, "retaliator")).toEqual(["multiLaser", 2, 2.2 / 1.81, 1.7]);
    expect(fire(6, "fighter")).toEqual(["rapidMissile", 3, 2 / 2, 1.3]);
    expect(fire(6, "interceptor")).toEqual(["scattershot", 3, 2.4 / 2, 1.7]);
    expect(ENEMY_FIRE.heavyMissile).toEqual({ interval: 4, projectileSpeedRatio: 0.6 });
    expect(ENEMY_FIRE.phaser.interval).toBe(3);
    // The platform's Laser fires two-shot bursts 0.15 s apart.
    const turret = enemyDefinition(2, "platform").hardpoints[0]!;
    expect(turret.kind === "weapon" && turret.fire.burst).toEqual({ count: 2, gap: 0.15 });
  });
});
