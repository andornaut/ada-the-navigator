import { describe, expect, it } from "vitest";

import { planPlayerVolley } from "../model/playerProjectiles.ts";
import { sceneryImpactDamage } from "./collisionDamage.ts";
import { CONTENT } from "./content.ts";
import { weaponAt } from "./weaponCatalog.ts";

describe("scenery impact damage", () => {
  it("keeps the current fixed contract of one damage per impact", () => {
    expect(sceneryImpactDamage(CONTENT.tuning.flight)).toBe(1);
  });

  it.each([0.5, 2, 4])("derives one basic Laser hit when base damage is %i", (baseDamage) => {
    const tuning = { ...CONTENT.tuning.flight, playerShotDamage: baseDamage };
    const volley = planPlayerVolley(weaponAt("laser", 1), {
      aim: { x: 1, y: 0 },
      baseDamage,
      baseLifetime: tuning.projectileLifetime,
      baseSpeed: tuning.projectileSpeed,
      origin: { x: 0, y: 0 },
      viewportWidth: 720,
    });
    expect(sceneryImpactDamage(tuning)).toBe(baseDamage);
    expect(volley.projectiles).toHaveLength(1);
    expect(sceneryImpactDamage(tuning)).toBe(volley.projectiles[0]!.damage);
  });

  it("uses the basic Laser rather than an upgraded Laser's hit", () => {
    const tuning = { ...CONTENT.tuning.flight, playerShotDamage: 4 };
    expect(sceneryImpactDamage(tuning)).toBe(4);
    expect(tuning.playerShotDamage * weaponAt("laser", 2).damageRatio).toBe(5);
    expect(tuning.playerShotDamage * weaponAt("laser", 3).damageRatio).toBe(6);
  });
});
