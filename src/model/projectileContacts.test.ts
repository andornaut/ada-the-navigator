import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyCatalog, enemyDefinition } from "../data/enemyCatalog.ts";
import { BEAM, MISSILE_HIT_RADIUS, WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { ModelFeedback } from "../game/feedback.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, supportEntropy } from "../testing/launch.ts";
import { ASTEROID_SHAPES, worldSceneryContact } from "./asteroids.ts";
import { worldParts } from "./convex.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyPartOutline } from "./enemyBody.ts";
import { activeBlastFlashes, activeProjectileImpacts, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import type { Shot, SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, fire: false, move: { x: 0, y: 0 }, use: false };
function fixture() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  playOpening(model);
  const flight = model.state.flight!;
  flight.player = { x: 0, y: 0 };
  flight.velocity = { x: 0, y: 0 };
  flight.objects = [];
  flight.shots = [];
  flight.mines = [];
  flight.fireCooldown = 100;
  return { flight, model };
}
function missile(overrides: Partial<Shot> = {}): Shot {
  const definition = WEAPON_CATALOG.rapidMissile[0];
  return {
    blast: definition.blastRadius!,
    damage: definition.damageRatio,
    enemy: false,
    hitIds: [],
    id: "test:shot",
    life: 1,
    piercing: false,
    projectile: "missile",
    velocity: { x: 10000, y: 0 },
    x: 50,
    y: 0,
    ...overrides,
  };
}
function rock(overrides: Partial<SpaceObject> = {}): SpaceObject {
  return { hp: 100, id: "target", kind: "rock", radius: 40, x: 200, y: 0, ...overrides };
}
describe("projectile contact positions and detonation", () => {
  it.each(["rock", "debris"] as const)("detonates once at the near edge of a large %s", (kind) => {
    const { flight, model } = fixture();
    const target = rock({ kind });
    flight.objects = [target];
    flight.shots = [missile()];
    const feedback = new ModelFeedback();
    feedback.observe(100, model.state);
    stepFlight(CONTENT, 0.02, idle, flight);
    expect(target.hp).toBe(100 - WEAPON_CATALOG.rapidMissile[0].damageRatio);
    expect(activeBlastFlashes(flight)).toHaveLength(1);
    const blast = activeBlastFlashes(flight)[0]!;
    expect(blast.x).toBeCloseTo(160, 4);
    expect(blast.y).toBeCloseTo(0, 4);
    expect(blast.radius).toBe(WEAPON_CATALOG.rapidMissile[0].blastRadius);
    feedback.observe(100, model.state);
    expect(feedback.pulses.find((pulse) => pulse.kind === "hit")?.x).toBeCloseTo(blast.x, 4);
    stepFlight(CONTENT, 0.02, idle, flight);
    expect(activeBlastFlashes(flight)).toHaveLength(1);
  });

  it.each(["bolt", "dot"] as const)(
    "keeps a consumed %s impact on the edge in feedback",
    (projectile) => {
      const { flight, model } = fixture();
      flight.objects = [rock()];
      const shot = missile({ projectile });
      delete shot.blast;
      flight.shots = [shot];
      const feedback = new ModelFeedback();
      feedback.observe(100, model.state);
      stepFlight(CONTENT, 0.02, idle, flight);
      expect(flight.shots).toHaveLength(0);
      feedback.observe(100, model.state);
      expect(feedback.pulses.find((pulse) => pulse.kind === "hit")?.x).toBeCloseTo(160, 4);
      expect(activeBlastFlashes(flight)).toHaveLength(0);
    },
  );

  it("measures secondary blast damage from the edge rather than the target centre", () => {
    const { flight } = fixture();
    const direct = rock();
    const mob = (id: string, x: number, y: number) => {
      const enemy = createEnemy(
        enemyCatalog.retaliator,
        { archetype: "retaliator", id, packId: null, phase: 0 },
        { x, y },
      );
      enemy.hp = 10;
      return rock({ enemy, hp: 10, id, kind: "enemy", radius: 20, x, y });
    };
    const near = mob("near", 160, 45);
    const far = mob("far", 225, 20);
    flight.objects = [direct, near, far];
    flight.shots = [missile()];
    stepFlight(CONTENT, 0.02, idle, flight);
    expect(direct.hp).toBe(98.5);
    expect(near.hp).toBe(8.5);
    expect(far.hp).toBe(10);
    expect(activeBlastFlashes(flight)).toHaveLength(1);
  });

  it.each([5.5, 6.5])("uses the full 12-world-unit missile width at offset %f", (gap) => {
    const { flight } = fixture();
    const target = rock({ radius: 10, y: 10 + gap });
    flight.objects = [target];
    flight.shots = [missile()];
    stepFlight(CONTENT, 0.03, idle, flight);
    expect(target.hp < 100).toBe(gap < MISSILE_HIT_RADIUS);
    expect(activeBlastFlashes(flight)).toHaveLength(gap < MISSILE_HIT_RADIUS ? 1 : 0);
  });

  it("keeps a fast swept hit on an irregular drawn edge, away from its pivot", () => {
    const { flight } = fixture();
    const art = [...ASTEROID_SHAPES.values()].find((shape) => shape.size === "huge")!;
    const target = rock({ asteroid: art.id, radius: art.radius, x: 250 });
    flight.objects = [target];
    flight.shots = [missile({ velocity: { x: 100000, y: 0 } })];
    stepFlight(CONTENT, 0.01, { ...idle, reducedMotion: true }, flight);
    const at = activeBlastFlashes(flight)[0]!;
    expect(at).toBeDefined();
    expect(at.x).toBeLessThan(target.x - 10);
    expect(worldSceneryContact({}, target, at, 0.1)).not.toBeNull();
    expect(activeProjectileImpacts(flight)[0]).toMatchObject({ x: at.x, y: at.y });
  });

  it("places mob impact feedback at its hull edge and applies primary damage only once", () => {
    const { flight } = fixture();
    const enemy = createEnemy(
      enemyCatalog.retaliator,
      { archetype: "retaliator", id: "mob", packId: null, phase: 0 },
      { x: 200, y: 0 },
    );
    enemy.hp = 100;
    const target = rock({ enemy, id: "mob", kind: "enemy", radius: 20 });
    flight.objects = [target];
    flight.shots = [missile()];
    stepFlight(CONTENT, 0.02, idle, flight);
    const at = activeBlastFlashes(flight)[0]!;
    expect(at.x).toBeLessThan(target.x - 5);
    expect(target.enemy!.hp).toBeCloseTo(100 - WEAPON_CATALOG.rapidMissile[0].damageRatio);
    expect(activeBlastFlashes(flight)).toHaveLength(1);
  });

  it("detonates once on an armed mine instead of consuming the missile silently", () => {
    const { flight } = fixture();
    flight.mines = [{ age: 1, damage: 3, id: "mine", ownerId: "enemy", x: 150, y: 0 }];
    flight.shots = [missile()];
    stepFlight(CONTENT, 0.02, idle, flight);
    expect(flight.mines[0]!.end?.kind).toBe("pop");
    expect(activeBlastFlashes(flight)).toHaveLength(1);
    expect(activeBlastFlashes(flight)[0]!.x).toBeLessThan(150);
    expect(flight.shots).toHaveLength(0);
  });

  it("detonates once at range expiry and passes stations and landmarks", () => {
    const { flight } = fixture();
    flight.objects = [
      rock({ kind: "station", x: 80 }),
      rock({ id: "landmark", kind: "destination", x: 90 }),
    ];
    flight.shots = [missile({ life: 0.01, velocity: { x: 1000, y: 0 } })];
    stepFlight(CONTENT, 0.02, idle, flight);
    expect(activeBlastFlashes(flight)).toHaveLength(1);
    expect(activeBlastFlashes(flight)[0]!.x).toBeCloseTo(60);
    expect(flight.objects.every((object) => object.hp === 100)).toBe(true);
  });

  it("keeps whole-object asteroid destruction at the pivot while the impact stays on its edge", () => {
    const { flight } = fixture();
    const art = [...ASTEROID_SHAPES.values()].find((shape) => shape.size === "huge")!;
    const target = rock({ asteroid: art.id, hp: 1, radius: art.radius, x: 250 });
    flight.objects = [target];
    flight.shots = [missile()];
    const events = stepFlight(CONTENT, 0.03, { ...idle, reducedMotion: true }, flight);
    expect(events.find((event) => event.type === "asteroidDestroyed")).toMatchObject({
      x: 250,
      y: 0,
    });
    expect(activeBlastFlashes(flight)[0]!.x).toBeLessThan(240);
  });

  it("resolves a live hardpoint contact before its hull and does not repeat primary damage", () => {
    const { flight } = fixture();
    const definition = enemyDefinition(1, "frigate", "heavy");
    const enemy = createEnemy(
      definition,
      { archetype: "frigate", id: "heavy", packId: null, phase: 0 },
      { x: 300, y: 0 },
    );
    for (const part of enemy.hardpoints) {
      part.cooldown = 999;
    }
    const part = enemy.hardpoints.find((part) => enemyPartOutline(1, enemy, part.id))!;
    const points = worldParts(enemyPartOutline(1, enemy, part.id)!).flat();
    const at = {
      x: 300 + points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
    const target = rock({ enemy, id: "heavy", kind: "enemy", radius: 100, x: 300 });
    flight.objects = [target];
    flight.shots = [missile({ ...at, velocity: { x: 1, y: 0 } })];
    const before = enemy.hardpoints.reduce((sum, part) => sum + part.hp, 0);
    stepFlight(CONTENT, 0.000001, idle, flight);
    const after = target.enemy!.hardpoints.reduce((sum, part) => sum + part.hp, 0);
    expect(before - after).toBeCloseTo(WEAPON_CATALOG.rapidMissile[0].damageRatio);
    expect(activeBlastFlashes(flight)).toHaveLength(1);
    expect(activeProjectileImpacts(flight)[0]!.x).not.toBe(target.x);
  });

  it("uses the final approved Phaser hit width", () => {
    expect(BEAM.halfWidth * 2).toBe(12);
  });
});
