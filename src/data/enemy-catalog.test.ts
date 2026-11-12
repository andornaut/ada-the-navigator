import { describe, expect, it } from "vitest";

import { enemyCatalog, type FireProfile, type WeaponMounts } from "./enemy-catalog.ts";
import type { RoutePosition } from "./galaxies.ts";
import type { Weapon } from "./types.ts";
import { WEAPON_CATALOG, weaponAt } from "./weapon-catalog.ts";

const ROUTE_POSITIONS: readonly RoutePosition[] = [1, 2, 3, 4, 5, 6];

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

describe("enemy fire profiles", () => {
  const profiles: FireProfile[] = Object.values(enemyCatalog).flatMap((definition) => [
    definition.fire,
    ...definition.hardpoints.flatMap((part) => (part.kind === "weapon" ? [part.fire] : [])),
  ]);

  it("fire a shared weapon's own projectile kind at their level", () => {
    const shared = profiles.filter((profile) => Object.hasOwn(WEAPON_CATALOG, profile.weapon));
    expect(shared.length).toBeGreaterThan(0);
    for (const profile of shared) {
      const kind = weaponAt(profile.weapon as Weapon, profile.level).projectileKind;
      expect(kind, profile.id).toBe(profile.projectile);
    }
  });
});
