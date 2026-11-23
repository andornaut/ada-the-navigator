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
  heavyLoadout,
  PHANTOM_FLAGSHIP_ID,
  type WeaponMounts,
} from "./enemyCatalog.ts";
import { ROUTE_POSITION, type RoutePosition } from "./galaxies.ts";
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
  it("uses approved six damage for Lance without changing Mine or Ring", () => {
    expect(fireDamageRatio({ level: 1, weapon: "chargedLance" })).toBe(6);
    expect(fireDamageRatio({ level: 1, weapon: "mineLayer" })).toBe(3);
    expect(fireDamageRatio({ level: 1, weapon: "ringBurst" })).toBe(1.5);
  });

  it("deals Ada's level 1 damage with every shared weapon, no exceptions", () => {
    for (const weapon of Object.keys(WEAPON_CATALOG) as Weapon[]) {
      expect(fireDamageRatio({ level: 1, weapon }), weapon).toBe(weaponAt(weapon, 1).damageRatio);
    }
    expect(fireDamageRatio({ level: 1, weapon: "heavyMissile" })).toBe(8);
    expect(fireDamageRatio({ level: 1, weapon: "phaser" })).toBe(13 / 3);
    expect(fireDamageRatio({ level: 1, weapon: "rapidMissile" })).toBe(1.5);
    expect(fireDamageRatio({ level: 1, weapon: "multiLaser" })).toBe(0.7);
    // A Scattershot volley has seven pellets at 0.8 damage each.
    expect(fireDamageRatio({ level: 1, weapon: "scattershot" }) * 7).toBeCloseTo(5.6, 9);
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

  it("assigns exactly two signature types without changing armed mount counts", () => {
    for (const position of ROUTE_POSITIONS) {
      for (const archetype of ["capital", "frigate"] as const) {
        const mounts = HEAVY_MOUNTS[archetype];
        const tier = tiersAt(mounts, position)[0]!;
        const active = mounts.fill.filter((id) => tier.mounts[id]);
        for (const id of ["ship:0", "ship:1"]) {
          const loadout = heavyLoadout(archetype, position, id)!;
          expect([...loadout.keys()]).toEqual(active);
          expect(new Set(loadout.values()).size).toBe(2);
          const special =
            archetype === "frigate"
              ? "heavyMissile"
              : position < 5 || loadout.get("weapon-left") === "chargedLance"
                ? "chargedLance"
                : "mineLayer";
          expect([...loadout.values()].filter((weapon) => weapon === special)).toHaveLength(1);
          expect(
            loadout.get(
              archetype === "frigate"
                ? "port"
                : special === "mineLayer"
                  ? "stern-right"
                  : "weapon-left",
            ),
          ).toBe(special);
          expect([...heavyLoadout(archetype, position, id)!]).toEqual([...loadout]);
        }
      }
    }
    expect(heavyLoadout("fighter", 3, "ship:0")).toBeNull();
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
      ).toEqual(["port laser 1", "starboard laser 1", ...(galaxy === 6 ? ["aft laser 1"] : [])]);
    }
    // Engines and command stay; every hardpoint takes the position's HP.
    const capital = enemyDefinition(6, "capital").hardpoints;
    expect(capital.filter((part) => part.kind !== "weapon").map((part) => part.id)).toEqual([
      "command",
      "engine-left",
      "engine-right",
    ]);
    expect(new Set(capital.map((part) => part.hp))).toEqual(new Set([7]));
  });

  it("arms small craft by position with the shared player cadence and unchanged projectile speeds", () => {
    const fire = (galaxy: GalaxyNumber, archetype: EnemyArchetype) => {
      const profile = enemyDefinition(galaxy, archetype).fire;
      return [profile.weapon, profile.level, profile.interval, profile.projectileSpeed];
    };
    // Sunflower and Whirlpool share 25%, Needle 30%, and Phantom 35% of the player rate.
    expect(fire(1, "swarm")).toEqual(["laser", 1, 0.3 / (0.25 * (7 / 9)), 300]);
    expect(fire(1, "fighter")).toEqual(["multiLaser", 1, 0.3 / 0.25, 240]);
    expect(fire(1, "interceptor")).toEqual(["phaser", 1, 1 / 0.25, 0]);
    expect(fire(1, "retaliator")).toEqual(["rapidMissile", 1, 0.3 / (0.25 * 1.25), 300]);
    expect(fire(4, "swarm")).toEqual(["laser", 1, 0.3 / (0.3 * (7 / 9)), 300]);
    expect(fire(4, "fighter")).toEqual(["multiLaser", 1, 0.3 / 0.3, 240]);
    expect(fire(4, "interceptor")).toEqual(["phaser", 1, 1 / 0.3, 0]);
    expect(fire(4, "retaliator")).toEqual(["rapidMissile", 1, 0.3 / (0.3 * 1.25), 300]);
    expect(fire(6, "fighter")).toEqual(["multiLaser", 1, 0.3 / 0.35, 240]);
    expect(fire(6, "interceptor")).toEqual(["phaser", 1, 1 / 0.35, 0]);
    expect(enemyFire("frigate", { level: 1, weapon: "heavyMissile" }).interval).toBe(
      weaponAt("heavyMissile", 1).intervalSeconds,
    );
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
    expect(ENEMY_FIRE.chargedLance.interval).toBe(6);
    // The platform's Laser fires two-shot bursts 0.15 s apart.
    const turret = enemyDefinition(2, "platform").hardpoints[0]!;
    expect(turret.kind === "weapon" && turret.fire.burst).toEqual({ count: 2, gap: 0.15 });
  });
});

describe("approved heavy health and independent rewards", () => {
  it("applies route part HP alongside the approved hull HP", () => {
    const partHp = [5, 5, 6, 6, 7, 7];
    const hulls = {
      capital: [40, 44, 60, 64, 88, 96],
      frigate: [20, 22, 30, 32, 44, 48],
      platform: [10, 11, 15, 16, 22, 24],
    };
    for (const galaxy of GALAXY_NUMBERS) {
      const index = ROUTE_POSITION[galaxy] - 1;
      for (const archetype of ["capital", "frigate", "platform"] as const) {
        const definition = enemyDefinition(galaxy, archetype);
        expect(definition.hardpoints.length).toBeGreaterThan(0);
        expect(definition.hardpoints.every((part) => part.hp === partHp[index])).toBe(true);
        expect(definition.hp).toBe(hulls[archetype][index]);
      }
    }
  });

  it("keeps the flagship hull and floor while assigning nine HP to every part", () => {
    const flagship = enemyDefinition(6, "capital", PHANTOM_FLAGSHIP_ID);
    expect(flagship.hardpoints.every((part) => part.hp === 9)).toBe(true);
    expect(flagship.hp).toBe(160);
    expect(flagship.hullFloor).toBe(1);
  });
});
