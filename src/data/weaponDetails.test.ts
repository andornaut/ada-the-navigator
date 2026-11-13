import { describe, expect, it } from "vitest";

import { WEAPON_CATALOG, weaponAt } from "./weaponCatalog.ts";
import { WEAPON_DETAIL_LABELS, weaponDetailLines } from "./weaponDetails.ts";

describe("weapon detail copy", () => {
  it("uses canonical level-dependent projectile counts for both spread weapons", () => {
    for (const weapon of ["multiLaser", "scattershot"] as const) {
      const counts = new Set<number>();
      for (const level of [1, 2, 3]) {
        const count = weaponAt(weapon, level).anglesDegrees.length;
        counts.add(count);
        expect(weaponDetailLines(weapon, level)[0]).toContain(` ${count} `);
      }
      expect(counts.size).toBe(3);
    }
  });

  it("covers every current weapon without unresolved placeholders or exact combat figures", () => {
    for (const weapon of Object.keys(WEAPON_CATALOG) as (keyof typeof WEAPON_CATALOG)[]) {
      const lines = weaponDetailLines(weapon, 2);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.join(" ")).not.toMatch(/[{}]|damage|seconds|units/u);
    }
  });
});

describe("approved concise detail fixtures", () => {
  it("keeps impact, blast and level distinctions while removing repeated spread claims", () => {
    expect(weaponDetailLines("heavyMissile", 2)).toEqual([
      "Fires slowly but hits hard.",
      "Explodes on impact or after a short distance, with a large blast.",
      "Each level hits harder.",
    ]);
    expect(weaponDetailLines("rapidMissile", 2)).toEqual([
      "Fires small missiles quickly.",
      "Explodes on impact or after a short distance.",
      "Each level fires faster.",
    ]);
    for (const level of [1, 2, 3]) {
      expect(weaponDetailLines("multiLaser", level)).toEqual([
        `Fires a fan of ${weaponAt("multiLaser", level).anglesDegrees.length} laser bolts.`,
        "Each level adds a bolt.",
      ]);
      expect(weaponDetailLines("scattershot", level)).toEqual([
        `Fires a wide spread of ${weaponAt("scattershot", level).anglesDegrees.length} short-range shots.`,
        "Each level adds shots that hit harder.",
      ]);
    }
  });

  it("retains the ammo and unlimited-ammo facts alongside concise descriptions", () => {
    expect(WEAPON_DETAIL_LABELS).toEqual({
      detailAmmoLeft: "Ammo: {count} left",
      detailIncludesAmmo: "Comes with 3 ammo packs.",
      detailUnlimited: "Never runs out.",
    });
  });
});
