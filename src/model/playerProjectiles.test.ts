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
    ["rapidMissile", 0.3, 500 / 600, 1.5, 30],
    ["heavyMissile", 2, 400 / 600, 5, 60],
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
      // Every missile reaches 220: its lifetime is that over its speed.
      expect(missile.life).toBeCloseTo(220 / (context.baseSpeed * speed), 9);
      expect(missile).toMatchObject(context.origin);
      expect(missile.fade).toBeUndefined();
    },
  );

  it("marks each Multi-Laser bolt with its volley's count and fire point, and nothing else", () => {
    for (const level of [0, 1, 2] as const) {
      const bolts = planPlayerVolley(WEAPON_CATALOG.multiLaser[level], context).projectiles;
      expect(bolts.map(({ fan }) => fan)).toEqual(
        bolts.map(() => ({ count: bolts.length, origin: context.origin })),
      );
    }
    for (const weapon of ["laser", "scattershot", "rapidMissile", "heavyMissile"] as const) {
      for (const shot of planPlayerVolley(WEAPON_CATALOG[weapon][2], context).projectiles) {
        expect(shot.fan).toBeUndefined();
      }
    }
  });

  it("gives bolts and dots no blast and refuses the hitscan Phaser", () => {
    for (const weapon of ["laser", "multiLaser", "scattershot"] as const) {
      for (const shot of planPlayerVolley(WEAPON_CATALOG[weapon][0], context).projectiles) {
        expect(shot.blast).toBeUndefined();
      }
    }
    expect(() => planPlayerVolley(WEAPON_CATALOG.phaser[0], context)).toThrow(RangeError);
  });

  it.each([
    [1, [-8, 0, 8], [[-30, -20, -10, 0, 10, 20, 30], [-15, 0, 15], [0]]],
    [
      2,
      [-8, -8 / 3, 8 / 3, 8],
      [[-30, -22.5, -15, -7.5, 0, 7.5, 15, 22.5, 30], [-15, -5, 5, 15], [0]],
    ],
    [
      3,
      [-8, -4, 0, 4, 8],
      [
        [-30, -24, -18, -12, -6, 0, 6, 12, 18, 24, 30],
        [-15, -7.5, 0, 7.5, 15],
        [-4, 4],
      ],
    ],
  ])(
    "fans level %i Multi-Laser bolts and staggers three even Scattershot rows",
    (level, bolts, rows) => {
      const multi = WEAPON_CATALOG.multiLaser[level - 1]!;
      const scatter = WEAPON_CATALOG.scattershot[level - 1]!;
      expect(multi.anglesDegrees).toHaveLength(bolts.length);
      multi.anglesDegrees.forEach((angle, index) => expect(angle).toBeCloseTo(bolts[index]!, 9));
      expect(scatter.anglesDegrees).toEqual(rows.flat());
      const volley = planPlayerVolley(scatter, context);
      expect(volley.projectiles.map((shot) => shot.delay ?? 0)).toEqual(
        rows.flatMap((row, index) => row.map(() => [0, 0.06, 0.12][index])),
      );
      // Every level reaches the same 100 world units; levels add only dots.
      expect(scatter.rangeWorld).toBe(100);
    },
  );

  it("keeps laser and scatter fans at their visible offsets for cardinal and diagonal world headings", () => {
    const cases = [
      { definition: WEAPON_CATALOG.multiLaser[0], degrees: [-8, 0, 8] },
      {
        definition: WEAPON_CATALOG.scattershot[0],
        degrees: [-30, -20, -10, 0, 10, 20, 30, -15, 0, 15, 0],
      },
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

  it("expires every scatter dot 100 world units along its heading, whatever the view", () => {
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
        expect(volley.projectiles).toHaveLength(11);
        for (const shot of volley.projectiles) {
          const dx = shot.velocity.x * shot.life;
          const dy = shot.velocity.y * shot.life;
          expect(Math.hypot(dx, dy)).toBeCloseTo(100);
          expect(shot.damage).toBeCloseTo(context.baseDamage * 0.8);
          expect(shot.projectile).toBe("dot");
          expect(shot.fade?.projectedRange).toBe(100);
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

  it.each([
    ["forward", { x: 170, y: 0 }],
    ["backward", { x: -170, y: 0 }],
    ["strafe", { x: 0, y: 170 }],
    ["stationary", { x: 0, y: 0 }],
    ["opposed at weapon speed", { x: -600, y: 0 }],
  ])("adds the %s launch velocity once to each projectile", (_, inheritedVelocity) => {
    for (const weapon of [
      "laser",
      "multiLaser",
      "rapidMissile",
      "heavyMissile",
      "scattershot",
    ] as const) {
      const definition = WEAPON_CATALOG[weapon][0];
      const baseline = planPlayerVolley(definition, context);
      const moving = planPlayerVolley(definition, { ...context, inheritedVelocity });
      expect(moving.interval).toBe(baseline.interval);
      moving.projectiles.forEach((shot, index) => {
        const original = baseline.projectiles[index]!;
        expect(shot.velocity.x).toBeCloseTo(original.velocity.x + inheritedVelocity.x);
        expect(shot.velocity.y).toBeCloseTo(original.velocity.y + inheritedVelocity.y);
        expect({ ...shot, velocity: original.velocity }).toEqual(original);
      });
    }
  });

  it("snapshots launch velocity without retaining later shooter motion or aim", () => {
    const inheritedVelocity = { x: 57, y: -91 };
    const aim = { x: 0.3, y: 0.7 };
    const volley = planPlayerVolley(WEAPON_CATALOG.multiLaser[0], {
      ...context,
      aim,
      inheritedVelocity,
    });
    const snapshot = structuredClone(volley);
    inheritedVelocity.x = -450;
    inheritedVelocity.y = 212;
    aim.x = -1;
    aim.y = 0;
    expect(volley).toEqual(snapshot);
  });

  it("keeps the fire-time coverage, fade and lifetime independent of combined speed", () => {
    const coverage = { centre: { ...context.origin }, viewportHeight: 360, viewportWidth: 720 };
    for (const weapon of ["laser", "multiLaser", "scattershot"] as const) {
      const definition = WEAPON_CATALOG[weapon][0];
      const baseline = planPlayerVolley(definition, { ...context, coverage });
      const moving = planPlayerVolley(definition, {
        ...context,
        coverage,
        inheritedVelocity: { x: -711, y: 283 },
      });
      moving.projectiles.forEach((shot, index) => {
        const original = baseline.projectiles[index]!;
        expect(shot.life).toBe(original.life);
        expect(shot.fade).toEqual(original.fade);
        if (shot.fade) {
          for (const fraction of [1, 0.35, 0.175, 0]) {
            expect(projectileOpacity(shot.fade, shot.life * fraction)).toBe(
              projectileOpacity(original.fade!, original.life * fraction),
            );
          }
        }
      });
      coverage.centre.x += 96;
      coverage.viewportWidth = 1080;
      expect(moving.projectiles.map((shot) => shot.life)).toEqual(
        baseline.projectiles.map((shot) => shot.life),
      );
    }
  });

  it("preserves default allied volleys and rejects invalid inherited velocity", () => {
    const definition = WEAPON_CATALOG.rapidMissile[0];
    expect(planPlayerVolley(definition, { ...context, inheritedVelocity: { x: 0, y: 0 } })).toEqual(
      planPlayerVolley(definition, context),
    );
    for (const inheritedVelocity of [
      { x: NaN, y: 0 },
      { x: 0, y: Infinity },
    ]) {
      expect(() => planPlayerVolley(definition, { ...context, inheritedVelocity })).toThrow(
        RangeError,
      );
    }
  });
});
