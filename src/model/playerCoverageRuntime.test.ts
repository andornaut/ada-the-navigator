import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { PLAYER_WEAPON_COVERAGE } from "../data/playerWeaponCoverage.ts";
import type { Weapon } from "../data/types.ts";
import { WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { fromScreen, toScreen } from "./convex.ts";
import { activeBeamFlashes, createFlight, stepFlight } from "./flight.ts";
import { nosePoint } from "./nose.ts";
import { planPlayerVolley } from "./playerProjectiles.ts";
import { playerWeaponCoverage } from "./playerWeaponCoverage.ts";
import type { Vec } from "./types.ts";
import { collectWeapon } from "./weapons.ts";

const idle = { aim: { x: 0, y: 0 }, fire: false, move: { x: 0, y: 0 }, use: false };
const context = { centre: { x: 0, y: 0 }, viewportHeight: 360, viewportWidth: 720 };
function boundary(view: typeof context, point: Vec): number {
  const projected = toScreen({ x: point.x - view.centre.x, y: point.y - view.centre.y });
  const shape = PLAYER_WEAPON_COVERAGE;
  return (
    Math.abs(projected.x / ((shape.halfWidth * view.viewportWidth) / shape.viewportWidth)) **
      shape.exponent +
    Math.abs(projected.y / ((shape.halfHeight * view.viewportHeight) / shape.viewportHeight)) **
      shape.exponent
  );
}
function armed(weapon: Weapon, aim: Vec) {
  const flight = createFlight(CONTENT, 1, 173, { known: [] });
  flight.objects = [];
  flight.shots = [];
  flight.player = { x: 0, y: 0 };
  flight.velocity = { x: 0, y: 0 };
  if (weapon !== "laser") {
    collectWeapon(weapon, flight);
  }
  flight.weapon = weapon;
  const length = Math.hypot(aim.x, aim.y);
  flight.facing = { x: aim.x / length, y: aim.y / length };
  return flight;
}

describe("player viewport coverage wiring", () => {
  it.each([1, 2, 3] as const)(
    "samples each level %i Multi-Laser ray independently at its actual muzzle",
    (level) => {
      const coverage = {
        ...context,
        centre: { x: 900, y: -500 },
        viewportHeight: 540,
        viewportWidth: 960,
      };
      const aim = fromScreen({ x: 1, y: 0.5 });
      const origin = nosePoint(aim, coverage.centre);
      const volley = planPlayerVolley(WEAPON_CATALOG.multiLaser[level - 1]!, {
        aim,
        baseDamage: 2,
        baseLifetime: 2,
        baseSpeed: 600,
        coverage,
        origin,
        viewportWidth: coverage.viewportWidth,
      });
      const distances: number[] = [];
      for (const shot of volley.projectiles) {
        const speed = Math.hypot(shot.velocity.x, shot.velocity.y);
        const direction = { x: shot.velocity.x / speed, y: shot.velocity.y / speed };
        const expected = playerWeaponCoverage(coverage, { direction, origin });
        distances.push(expected);
        expect(shot.life * speed).toBeCloseTo(expected, 9);
        expect(
          boundary(coverage, {
            x: shot.x + shot.velocity.x * shot.life,
            y: shot.y + shot.velocity.y * shot.life,
          }),
        ).toBeCloseTo(1, 9);
      }
      expect(new Set(distances.map((value) => value.toFixed(6))).size).toBeGreaterThan(1);
    },
  );

  it.each(["laser", "multiLaser", "phaser"] as const)(
    "uses actual full viewport dimensions for player %s and snapshots existing fire",
    (weapon) => {
      for (const viewport of [
        { viewportHeight: 360, viewportWidth: 720 },
        { viewportHeight: 360, viewportWidth: 1200 },
        { viewportHeight: 800, viewportWidth: 720 },
      ]) {
        for (const screenAim of [
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
          { x: -1, y: 1 },
        ]) {
          const aim = fromScreen(screenAim);
          const flight = armed(weapon, aim);
          const view = { ...context, ...viewport };
          stepFlight(CONTENT, 0.001, { ...idle, ...viewport, aim, fire: true }, flight);
          const ends =
            weapon === "phaser"
              ? activeBeamFlashes(flight).map((flash) => flash.to)
              : flight.shots.map((shot) => ({
                  x: shot.x + shot.velocity.x * shot.life,
                  y: shot.y + shot.velocity.y * shot.life,
                }));
          expect(ends.length).toBeGreaterThan(0);
          for (const point of ends) {
            expect(boundary(view, point)).toBeCloseTo(1, 7);
          }
          const snapshots = ends.map((point) => ({ ...point }));
          flight.fireCooldown = 100;
          flight.player = { x: 50, y: 50 };
          stepFlight(CONTENT, 0.001, { ...idle, viewportHeight: 180, viewportWidth: 360 }, flight);
          const after =
            weapon === "phaser"
              ? activeBeamFlashes(flight).map((flash) => flash.to)
              : flight.shots.map((shot) => ({
                  x: shot.x + shot.velocity.x * shot.life,
                  y: shot.y + shot.velocity.y * shot.life,
                }));
          expect(after).toHaveLength(snapshots.length);
          after.forEach((point, index) => {
            expect(point.x).toBeCloseTo(snapshots[index]!.x, 7);
            expect(point.y).toBeCloseTo(snapshots[index]!.y, 7);
          });
        }
      }
    },
  );

  it.each(["rapidMissile", "heavyMissile", "scattershot"] as const)(
    "keeps %s fixed range and fade identical with or without player coverage",
    (weapon) => {
      const base = {
        aim: { x: 1, y: 0 },
        baseDamage: 2,
        baseLifetime: 2,
        baseSpeed: 600,
        origin: { x: 0, y: 0 },
        viewportWidth: 720,
      };
      const legacy = planPlayerVolley(WEAPON_CATALOG[weapon][0], base);
      expect(planPlayerVolley(WEAPON_CATALOG[weapon][0], { ...base, coverage: context })).toEqual(
        legacy,
      );
      for (const shot of legacy.projectiles) {
        expect(shot.life * Math.hypot(shot.velocity.x, shot.velocity.y)).toBeCloseTo(
          weapon === "scattershot" ? 100 : 220,
          9,
        );
      }
    },
  );

  it("keeps the ally volley contract on canonical fixed bolt range when coverage is omitted", () => {
    const volley = planPlayerVolley(WEAPON_CATALOG.laser[0], {
      aim: { x: 1, y: 0 },
      baseDamage: 2,
      baseLifetime: 2,
      baseSpeed: 600,
      origin: { x: 0, y: 0 },
      viewportWidth: 1200,
    });
    expect(
      volley.projectiles[0]!.life *
        Math.hypot(volley.projectiles[0]!.velocity.x, volley.projectiles[0]!.velocity.y),
    ).toBe(WEAPON_CATALOG.laser[0].rangeWorld);
  });
});
