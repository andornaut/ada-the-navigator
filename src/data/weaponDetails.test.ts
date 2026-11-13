import { describe, expect, it } from "vitest";

import { WEAPON_CATALOG, weaponAt } from "./weaponCatalog.ts";
import { weaponDetailLines } from "./weaponDetails.ts";

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
