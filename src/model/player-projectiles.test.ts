import { describe, expect, it } from "vitest";

import { WEAPON_CATALOG } from "../data/weapon-catalog.ts";
import { planPlayerVolley, projectileOpacity, type VolleyContext } from "./player-projectiles.ts";

const context: VolleyContext = {
  aim: { x: 1, y: 0 },
  baseDamage: 2,
  baseLifetime: 2,
  baseSpeed: 600,
  origin: { x: -200, y: 90 },
  viewportWidth: 720,
};

describe("pure player projectile volleys", () => {
  it("makes automatic missiles slower and more powerful without adding homing or splash", () => {
    const basic = planPlayerVolley(WEAPON_CATALOG.basic, context);
    const missiles = planPlayerVolley(WEAPON_CATALOG.missiles, context);
    expect(missiles.interval).toBeGreaterThan(basic.interval);
    expect(missiles.projectiles).toHaveLength(1);
    const missile = missiles.projectiles[0]!;
    expect(Math.hypot(missile.velocity.x, missile.velocity.y)).toBeCloseTo(context.baseSpeed * 0.6);
    expect(missile.damage).toBe(context.baseDamage * 4);
    expect(missile.projectile).toBe("missile");
    expect(missile.life).toBe(context.baseLifetime);
    expect(missile).toMatchObject(context.origin);
    expect(missile.fade).toBeUndefined();
  });

  it("keeps laser and scatter fans at their visible offsets for cardinal and diagonal world headings", () => {
    const cases = [
      { definition: WEAPON_CATALOG.tripleLaser, degrees: [-20, 0, 20] },
      { definition: WEAPON_CATALOG.scattershot, degrees: [-30, -20, -10, 0, 10, 20, 30] },
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
          expect(Math.hypot(shot.velocity.x, shot.velocity.y)).toBeCloseTo(context.baseSpeed);
          expect(shot.damage).toBeCloseTo(context.baseDamage * definition.damageRatio);
          expect(shot.projectile).toBe(definition.projectileKind);
        }
      }
    }
  });

  it("expires every scatter pellet at half the actual projected view width for different headings and views", () => {
    for (const viewportWidth of [720, 1080]) {
      for (const aim of [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
      ]) {
        const volley = planPlayerVolley(WEAPON_CATALOG.scattershot, {
          ...context,
          aim,
          viewportWidth,
        });
        expect(volley.projectiles).toHaveLength(7);
        for (const shot of volley.projectiles) {
          const dx = shot.velocity.x * shot.life;
          const dy = shot.velocity.y * shot.life;
          expect(Math.hypot(dx - dy, (dx + dy) / 2)).toBeCloseTo(viewportWidth / 2);
          expect(shot.damage).toBeCloseTo(context.baseDamage * 0.35);
          expect(shot.projectile).toBe("dot");
          expect(shot.fade?.projectedRange).toBe(viewportWidth / 2);
        }
      }
    }
  });

  it("keeps dots opaque through sixty-five percent of range and fades to zero at expiry", () => {
    const shot = planPlayerVolley(WEAPON_CATALOG.scattershot, context).projectiles[0]!;
    const fade = shot.fade!;
    expect(projectileOpacity(fade, shot.life)).toBe(1);
    expect(projectileOpacity(fade, shot.life * 0.35)).toBeCloseTo(1);
    expect(projectileOpacity(fade, shot.life * 0.175)).toBeCloseTo(0.5);
    expect(projectileOpacity(fade, 0)).toBe(0);
    expect(projectileOpacity(fade, -0.1)).toBe(0);
  });

  it("does not fire on zero aim or mutate the supplied origin, heading or authored definition", () => {
    const before = JSON.stringify({ context, definition: WEAPON_CATALOG.scattershot });
    expect(
      planPlayerVolley(WEAPON_CATALOG.basic, { ...context, aim: { x: 0, y: 0 } }).projectiles,
    ).toEqual([]);
    planPlayerVolley(WEAPON_CATALOG.scattershot, context);
    expect(JSON.stringify({ context, definition: WEAPON_CATALOG.scattershot })).toBe(before);
    expect(() =>
      planPlayerVolley(WEAPON_CATALOG.scattershot, { ...context, viewportWidth: 0 }),
    ).toThrow(RangeError);
  });
});
