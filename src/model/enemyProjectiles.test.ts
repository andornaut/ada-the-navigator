import { describe, expect, it } from "vitest";

import { enemyFire } from "../data/enemyCatalog.ts";
import { PLAYER_WEAPON_COVERAGE } from "../data/playerWeaponCoverage.ts";
import { WEAPON_CATALOG, weaponAt } from "../data/weaponCatalog.ts";
import { fromScreen, toScreen } from "./convex.ts";
import { enemyBeamReach, planEnemyProjectile } from "./enemyProjectiles.ts";
import { planPlayerVolley, projectileOpacity } from "./playerProjectiles.ts";
import type { Vec } from "./types.ts";

const coverage = { centre: { x: 700, y: -300 }, viewportHeight: 360, viewportWidth: 720 };
const zero = { x: 0, y: 0 };
const unit = (point: Vec) => {
  const size = Math.hypot(point.x, point.y);
  return { x: point.x / size, y: point.y / size };
};
const ray = (projected: Vec) => ({
  aim: unit(fromScreen(projected)),
  origin: { ...coverage.centre },
});

describe("enemy projectile launch", () => {
  it.each([
    { x: 80, y: 0 },
    { x: -80, y: 0 },
    { x: 0, y: 57 },
    { x: 0, y: 0 },
  ])("adds the actual shooter velocity once without changing lifetime: %j", (velocity) => {
    const profile = enemyFire("fighter", { level: 2, weapon: "rapidMissile" });
    const fire = { ...ray({ x: 1, y: 0 }), speed: profile.projectileSpeed };
    const definition = weaponAt("rapidMissile", 2);
    const moving = planEnemyProjectile(
      { baseLifetime: 4, coverage, definition, inheritedVelocity: velocity },
      fire,
    );
    const still = planEnemyProjectile(
      { baseLifetime: 4, coverage, definition, inheritedVelocity: zero },
      fire,
    );
    expect(moving.velocity).toEqual({
      x: still.velocity.x + velocity.x,
      y: still.velocity.y + velocity.y,
    });
    expect(moving.life).toBe(still.life);
    expect(moving.blast).toBe(definition.blastRadius);
    const launch = { ...moving.velocity };
    velocity.x += 100;
    velocity.y -= 100;
    expect(moving.velocity).toEqual(launch);
  });

  it.each(["laser", "multiLaser"] as const)(
    "matches Ada's directional boundary for %s",
    (weapon) => {
      for (const heading of [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ]) {
        const fire = {
          ...ray(heading),
          speed: enemyFire("fighter", { level: 3, weapon }).projectileSpeed,
        };
        const definition = weaponAt(weapon, 3);
        const enemy = planEnemyProjectile(
          { baseLifetime: 4, coverage, definition, inheritedVelocity: zero },
          fire,
        );
        const player = planPlayerVolley(
          { ...definition, anglesDegrees: [0] },
          {
            aim: fire.aim,
            baseDamage: 1,
            baseLifetime: 4,
            baseSpeed: fire.speed / definition.speedRatio,
            coverage,
            origin: fire.origin,
            viewportWidth: coverage.viewportWidth,
          },
        ).projectiles[0]!;
        expect(enemy.life).toBeCloseTo(player.life, 12);
        const endpoint = toScreen({
          x: fire.aim.x * fire.speed * enemy.life,
          y: fire.aim.y * fire.speed * enemy.life,
        });
        const shape = PLAYER_WEAPON_COVERAGE;
        expect(
          (Math.abs(endpoint.x) / shape.halfWidth) ** shape.exponent +
            (Math.abs(endpoint.y) / shape.halfHeight) ** shape.exponent,
        ).toBeCloseTo(1, 10);
      }
    },
  );

  it("uses actual muzzle offset and viewport dimensions for bolts and Phaser", () => {
    const fire = ray({ x: 1, y: 0 });
    const offset = fromScreen({ x: 30, y: 0 });
    fire.origin.x += offset.x;
    fire.origin.y += offset.y;
    const expected = (PLAYER_WEAPON_COVERAGE.halfWidth - 30) / Math.SQRT2;
    expect(enemyBeamReach(coverage, fire)).toBeCloseTo(expected, 10);
    expect(
      enemyBeamReach({ ...coverage, viewportWidth: coverage.viewportWidth / 2 }, fire),
    ).toBeCloseTo((PLAYER_WEAPON_COVERAGE.halfWidth / 2 - 30) / Math.SQRT2, 10);
    const definition = weaponAt("laser", 1);
    const speed = enemyFire("fighter", { level: 1, weapon: "laser" }).projectileSpeed;
    const shot = planEnemyProjectile(
      { baseLifetime: 4, coverage, definition, inheritedVelocity: { x: 20, y: -7 } },
      { ...fire, speed },
    );
    expect(shot.life * speed).toBeCloseTo(expected, 10);
  });

  it.each(["rapidMissile", "heavyMissile", "scattershot"] as const)(
    "retains canonical range/blast/fade and speed policy for %s",
    (weapon) => {
      for (const level of [1, 2, 3] as const) {
        const definition = WEAPON_CATALOG[weapon][level - 1]!;
        const profile = enemyFire("fighter", { level, weapon });
        const fire = { ...ray({ x: 0, y: 1 }), speed: profile.projectileSpeed };
        const context = {
          baseLifetime: 4,
          coverage,
          definition,
          inheritedVelocity: { x: -91, y: 27 },
        };
        const shot = planEnemyProjectile(context, fire);
        expect(shot.life * fire.speed).toBeCloseTo(definition.rangeWorld!, 12);
        expect(shot.blast ?? null).toBe(definition.blastRadius);
        if (definition.fadeStartFraction !== null) {
          expect(shot.fade?.fadeStartFraction).toBe(definition.fadeStartFraction);
          expect(
            projectileOpacity(shot.fade!, shot.life * (1 - definition.fadeStartFraction)),
          ).toBeCloseTo(1, 12);
          expect(projectileOpacity(shot.fade!, 0)).toBe(0);
        } else {
          expect(shot.fade).toBeUndefined();
        }
        const launch = { ...shot.velocity };
        context.inheritedVelocity.x = 999;
        expect(shot.velocity).toEqual(launch);
      }
    },
  );

  it("retains enemy-only lifetime and velocity for an excluded ring shot", () => {
    const fire = { ...ray({ x: -1, y: 0 }), speed: 157 };
    const shot = planEnemyProjectile(
      { baseLifetime: 3.7, coverage, definition: null, inheritedVelocity: { x: 41, y: -23 } },
      fire,
    );
    expect(shot.life).toBe(3.7);
    expect(shot.velocity).toEqual({
      x: fire.aim.x * fire.speed,
      y: fire.aim.y * fire.speed,
    });
    expect(shot.blast).toBeUndefined();
    expect(shot.fade).toBeUndefined();
  });
});
