import { describe, expect, it } from "vitest";

import {
  ENEMY_FIRE,
  ENEMY_SPEED_SHARE,
  type EnemyArchetype,
  enemyCatalog,
  enemyDefinition,
  enemyFire,
  fireDamageRatio,
  type FireProfile,
  HEAVY_POOLS,
  HEAVY_TYPES,
  heavyLoadout,
  SINGLE_MOUNT_WEAPONS,
  type WeaponMounts,
} from "./enemyCatalog.ts";
import type { RoutePosition } from "./galaxies.ts";
import type { EnemyWeapon, GalaxyNumber, Weapon } from "./types.ts";
import { WEAPON_CATALOG, weaponAt, weaponSpeed } from "./weaponCatalog.ts";

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
  it("deals Ada's level 1 damage with every shared weapon, no exceptions", () => {
    for (const weapon of Object.keys(WEAPON_CATALOG) as Weapon[]) {
      expect(fireDamageRatio({ level: 1, weapon }), weapon).toBe(weaponAt(weapon, 1).damageRatio);
    }
    expect(fireDamageRatio({ level: 1, weapon: "heavyMissile" })).toBe(10);
    expect(fireDamageRatio({ level: 1, weapon: "phaser" })).toBe(6.5);
    expect(fireDamageRatio({ level: 1, weapon: "rapidMissile" })).toBe(2);
    expect(fireDamageRatio({ level: 1, weapon: "multiLaser" })).toBe(0.7);
    // A Scattershot volley of 6 across its 7 dots.
    expect(fireDamageRatio({ level: 1, weapon: "scattershot" }) * 7).toBeCloseTo(6, 9);
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

  it("arms each heavy's mounts with up to three of its position's pool, seeded by the ship", () => {
    const ids = Array.from({ length: 200 }, (_, index) => `ship:${index}`);
    const counts = { capital: [4, 6, 8], frigate: [2, 3, 4] } as const;
    for (const archetype of ["capital", "frigate"] as const) {
      for (const position of ROUTE_POSITIONS) {
        const band = Math.ceil(position / 2) - 1;
        const pool = HEAVY_POOLS[archetype][band]!;
        const seen = new Set<string>();
        for (const id of ids) {
          const loadout = heavyLoadout(archetype, position, id)!;
          const weapons = [...loadout.values()];
          // Its tier's armed mounts, every one armed, each from the pool.
          expect(loadout.size).toBe(counts[archetype][band]);
          expect(weapons.every((weapon) => pool.includes(weapon))).toBe(true);
          expect(new Set(weapons).size).toBeLessThanOrEqual(Math.min(HEAVY_TYPES, pool.length));
          for (const single of SINGLE_MOUNT_WEAPONS) {
            expect(weapons.filter((weapon) => weapon === single).length).toBeLessThanOrEqual(1);
          }
          // The same ship draws the same loadout on every call, so after save and resume.
          expect([...heavyLoadout(archetype, position, id)!]).toEqual([...loadout]);
          weapons.forEach((weapon) => seen.add(weapon));
        }
        // Over many ships the whole pool shows.
        expect([...seen].sort(), `${archetype} ${position}`).toEqual([...pool].sort());
      }
    }
    expect(heavyLoadout("fighter", 3, "ship:0")).toBeNull();
  });

  it("deals a heavy's mounts in turn among its types, a single-mount weapon on one at most", () => {
    // A capital at position 5 whose types include a single-mount weapon.
    const id = Array.from({ length: 200 }, (_, index) => `ship:${index}`).find((ship) =>
      [...heavyLoadout("capital", 5, ship)!.values()].includes("phaser"),
    )!;
    const loadout = [...heavyLoadout("capital", 5, id)!.values()];
    const types = [...new Set(loadout)];
    expect(types.length).toBe(3);
    expect(loadout.filter((weapon) => weapon === "phaser")).toHaveLength(1);
    // Each repeatable type takes a fair share of the rest.
    const repeatable = types.filter((weapon) => !SINGLE_MOUNT_WEAPONS.has(weapon));
    const shares = repeatable.map((weapon) => loadout.filter((at) => at === weapon).length);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });

  it("arms a heavy's definition with the ship's loadout, every weapon at level 1", () => {
    const loadout = heavyLoadout("capital", 6, "ship:7")!;
    const armed = enemyDefinition(6, "capital", "ship:7").hardpoints.flatMap((part) =>
      part.kind === "weapon" ? [[part.id, part.fire.weapon, part.fire.level]] : [],
    );
    expect(armed).toEqual([...loadout].map(([id, weapon]) => [id, weapon, 1]));
    for (const galaxy of [1, 5, 6] as const) {
      expect(
        enemyDefinition(galaxy, "platform").hardpoints.map((part) =>
          part.kind === "weapon" ? `${part.id} ${part.fire.weapon} ${part.fire.level}` : part.id,
        ),
      ).toEqual(["port laser 1", "starboard laser 1"]);
    }
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
      return [profile.weapon, profile.level, profile.interval, profile.projectileSpeed];
    };
    // Sunflower (position 1, fire +44%), Needle (3, +81%) and Phantom (6, +100%).
    expect(fire(1, "swarm")).toEqual(["laser", 1, 1.8 / 1.44, 300]);
    expect(fire(1, "fighter")).toEqual(["laser", 1, 1.4 / 1.44, 300]);
    expect(fire(1, "interceptor")).toEqual(["laser", 1, 1.4 / 1.44, 300]);
    expect(fire(1, "retaliator")).toEqual(["multiLaser", 1, 2.2 / 1.44, 240]);
    expect(fire(4, "swarm")).toEqual(["laser", 1, 1.8 / 1.81, 300]);
    expect(fire(4, "fighter")).toEqual(["rapidMissile", 1, 2 / 1.81, 300]);
    expect(fire(4, "interceptor")).toEqual(["multiLaser", 1, 2.2 / 1.81, 240]);
    expect(fire(4, "retaliator")).toEqual(["multiLaser", 1, 2.2 / 1.81, 240]);
    expect(fire(6, "fighter")).toEqual(["rapidMissile", 1, 2 / 2, 300]);
    expect(fire(6, "interceptor")).toEqual(["multiLaser", 1, 2.2 / 2, 240]);
    expect(ENEMY_FIRE.heavyMissile).toEqual({ interval: 4 });
    // Every enemy projectile flies 0.6 of Ada's level 1 speed for its weapon, the ring burst a
    // fixed 240; the Phaser and the lance are hitscan and mines lie still.
    const speed = (weapon: EnemyWeapon) =>
      enemyFire("frigate", { level: 1, weapon }).projectileSpeed;
    expect(
      (
        [
          "laser",
          "multiLaser",
          "rapidMissile",
          "heavyMissile",
          "scattershot",
          "phaser",
          "ringBurst",
          "chargedLance",
          "mineLayer",
        ] as const
      ).map((weapon) => Math.round(speed(weapon) * 1e9) / 1e9),
    ).toEqual([300, 240, 300, 240, 360, 0, 240, 0, 0]);
    expect(speed("laser")).toBeCloseTo(ENEMY_SPEED_SHARE * weaponSpeed("laser", 1), 9);
    expect(ENEMY_FIRE.phaser.interval).toBe(3);
    // The platform's Laser fires two-shot bursts 0.15 s apart.
    const turret = enemyDefinition(2, "platform").hardpoints[0]!;
    expect(turret.kind === "weapon" && turret.fire.burst).toEqual({ count: 2, gap: 0.15 });
  });
});
