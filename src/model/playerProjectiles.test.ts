import { describe, expect, it } from "vitest";

import { WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { planPlayerVolley, projectileOpacity, type VolleyContext } from "./playerProjectiles.ts";

const context: VolleyContext = {
  aim: { x: 1, y: 0 },
  baseDamage: 2,
  baseLifetime: 2,
  baseSpeed: 600,
  origin: { x: -200, y: 90 },
  viewportWidth: 720,
};

describe("pure player projectile volleys", () => {
  it.each([
    ["rapidMissile", 0.3, 1.3, 1.5, 25],
    ["heavyMissile", 1.2, 0.6, 8, 60],
  ] as const)(
    "plans one straight %s at interval %f, speed x%f, damage x%f and blast %i",
    (weapon, interval, speed, damage, blast) => {
      const volley = planPlayerVolley(WEAPON_CATALOG[weapon][0], context);
      expect(volley.interval).toBe(interval);
      expect(volley.projectiles).toHaveLength(1);
      const missile = volley.projectiles[0]!;
      expect(Math.hypot(missile.velocity.x, missile.velocity.y)).toBeCloseTo(
        context.baseSpeed * speed,
      );
      expect(missile.damage).toBe(context.baseDamage * damage);
      expect(missile.blast).toBe(blast);
      expect(missile.projectile).toBe("missile");
      expect(missile.life).toBe(context.baseLifetime);
      expect(missile).toMatchObject(context.origin);
      expect(missile.fade).toBeUndefined();
    },
  );

  it("gives bolts and dots no blast and refuses the hitscan Phaser", () => {
    for (const weapon of ["laser", "multiLaser", "scattershot"] as const) {
      for (const shot of planPlayerVolley(WEAPON_CATALOG[weapon][0], context).projectiles) {
        expect(shot.blast).toBeUndefined();
      }
    }
    expect(() => planPlayerVolley(WEAPON_CATALOG.phaser[0], context)).toThrow(RangeError);
  });

  it.each([
    [1, [-20, 0, 20], [-30, -20, -10, 0, 10, 20, 30]],
    [2, [-20, -20 / 3, 20 / 3, 20], [-30, -22.5, -15, -7.5, 0, 7.5, 15, 22.5, 30]],
    [3, [-20, -10, 0, 10, 20], [-30, -24, -18, -12, -6, 0, 6, 12, 18, 24, 30]],
  ])("fans level %i Multi-Laser bolts and Scattershot dots evenly", (level, bolts, dots) => {
    const multi = WEAPON_CATALOG.multiLaser[level - 1]!;
    const scatter = WEAPON_CATALOG.scattershot[level - 1]!;
    expect(multi.anglesDegrees).toHaveLength(bolts.length);
    multi.anglesDegrees.forEach((angle, index) => expect(angle).toBeCloseTo(bolts[index]!, 9));
    expect(scatter.anglesDegrees).toHaveLength(dots.length);
    scatter.anglesDegrees.forEach((angle, index) => expect(angle).toBeCloseTo(dots[index]!, 9));
    // Every level reaches the same 360 world units; levels add only dots.
    expect(scatter.rangeWorld).toBe(360);
  });

  it("keeps laser and scatter fans at their visible offsets for cardinal and diagonal world headings", () => {
    const cases = [
      { definition: WEAPON_CATALOG.multiLaser[0], degrees: [-20, 0, 20] },
      { definition: WEAPON_CATALOG.scattershot[0], degrees: [-30, -20, -10, 0, 10, 20, 30] },
    ];
    for (const { definition, degrees } of cases) {
      for (const aim of [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: -1, y: 1 },
        { x: -1, y: 0 },
        { x: -1, y: -1 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
      ]) {
        const volley = planPlayerVolley(definition, { ...context, aim });
        const forward = { x: aim.x - aim.y, y: (aim.x + aim.y) / 2 };
        expect(volley.projectiles).toHaveLength(degrees.length);
        for (const [index, expected] of degrees.entries()) {
          const shot = volley.projectiles[index]!;
          const screen = {
            x: shot.velocity.x - shot.velocity.y,
            y: (shot.velocity.x + shot.velocity.y) / 2,
          };
          const cross = forward.x * screen.y - forward.y * screen.x;
          const dot = forward.x * screen.x + forward.y * screen.y;
          expect((Math.atan2(cross, dot) * 180) / Math.PI).toBeCloseTo(expected);
          expect(Math.hypot(shot.velocity.x, shot.velocity.y)).toBeCloseTo(
            context.baseSpeed * definition.speedRatio,
          );
          expect(shot.damage).toBeCloseTo(context.baseDamage * definition.damageRatio);
          expect(shot.projectile).toBe(definition.projectileKind);
        }
      }
    }
  });

  it("expires every scatter dot 360 world units along its heading, whatever the view", () => {
    for (const viewportWidth of [720, 1080]) {
      for (const aim of [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
      ]) {
        const volley = planPlayerVolley(WEAPON_CATALOG.scattershot[0], {
          ...context,
          aim,
          viewportWidth,
        });
        expect(volley.projectiles).toHaveLength(7);
        for (const shot of volley.projectiles) {
          const dx = shot.velocity.x * shot.life;
          const dy = shot.velocity.y * shot.life;
          expect(Math.hypot(dx, dy)).toBeCloseTo(360);
          expect(shot.damage).toBeCloseTo(context.baseDamage * 0.35);
          expect(shot.projectile).toBe("dot");
          expect(shot.fade?.projectedRange).toBe(360);
        }
      }
    }
  });

  it("keeps dots opaque through sixty-five percent of range and fades to zero at expiry", () => {
    const shot = planPlayerVolley(WEAPON_CATALOG.scattershot[0], context).projectiles[0]!;
    const fade = shot.fade!;
    expect(projectileOpacity(fade, shot.life)).toBe(1);
    expect(projectileOpacity(fade, shot.life * 0.35)).toBeCloseTo(1);
    expect(projectileOpacity(fade, shot.life * 0.175)).toBeCloseTo(0.5);
    expect(projectileOpacity(fade, 0)).toBe(0);
    expect(projectileOpacity(fade, -0.1)).toBe(0);
  });

  it("does not fire on zero aim or mutate the supplied origin, heading or authored definition", () => {
    const before = JSON.stringify({ context, definition: WEAPON_CATALOG.scattershot[0] });
    expect(
      planPlayerVolley(WEAPON_CATALOG.laser[0], { ...context, aim: { x: 0, y: 0 } }).projectiles,
    ).toEqual([]);
    planPlayerVolley(WEAPON_CATALOG.scattershot[0], context);
    expect(JSON.stringify({ context, definition: WEAPON_CATALOG.scattershot[0] })).toBe(before);
    expect(() =>
      planPlayerVolley(WEAPON_CATALOG.scattershot[0], { ...context, viewportWidth: 0 }),
    ).toThrow(RangeError);
  });
});
