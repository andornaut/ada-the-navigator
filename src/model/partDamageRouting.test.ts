import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition, PHANTOM_FLAGSHIP_ID } from "../data/enemyCatalog.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, relaunch, supportEntropy } from "../testing/launch.ts";
import { worldParts } from "./convex.ts";
import { createEnemy, damageEnemy, enemyEffects } from "./enemyAi.ts";
import { enemyPartOutline } from "./enemyBody.ts";
import { activeBlastFlashes, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";

function heavy(galaxy: GalaxyNumber = 1, id = "routing:heavy") {
  const definition = enemyDefinition(galaxy, "capital", id);
  const state = createEnemy(
    definition,
    { archetype: "capital", id, packId: null, phase: 0 },
    { x: 300, y: 0 },
  );
  return { definition, state };
}

describe("single-target heavy damage routing", () => {
  it.each([1, 2, 3, 4, 5, 6] as const)("routes a part hit to the hull in galaxy %i", (galaxy) => {
    const { definition, state } = heavy(galaxy);
    const part = state.hardpoints.find(
      (part) => definition.hardpoints.find((value) => value.id === part.id)?.kind === "weapon",
    )!;
    const snapshot = structuredClone(state);
    const amount = 2.5;
    const hit = damageEnemy(definition, { amount, hardpointId: part.id }, state);
    expect(hit.hp).toBe(state.hp - amount);
    expect(hit.hardpoints).toEqual(state.hardpoints);
    expect(hit.disabled).toBe(false);
    expect(state).toEqual(snapshot);
  });

  it("routes a hull hit only to hull HP", () => {
    const { definition, state } = heavy();
    const hit = damageEnemy(definition, { amount: 2.5, hardpointId: null }, state);
    expect(hit.hp).toBe(state.hp - 2.5);
    expect(hit.hardpoints).toEqual(state.hardpoints);
    expect(
      enemyEffects(
        definition,
        damageEnemy(definition, { amount: state.hp * 3, hardpointId: null }, state),
      ).defeated,
    ).toBe(true);
  });

  it("lets a context-free flagship hit take the hull to zero from either contact surface", () => {
    const { definition, state } = heavy(6, PHANTOM_FLAGSHIP_ID);
    for (const hardpointId of [state.hardpoints[0]!.id, null]) {
      const hit = damageEnemy(definition, { amount: 1000, hardpointId }, state);
      expect(hit.hp).toBe(0);
      expect(hit.hardpoints).toEqual(state.hardpoints);
    }
  });

  it("applies repeated weapon contacts to the same hull without disabling it", () => {
    const { definition, state } = heavy();
    const weapons = definition.hardpoints.filter((part) => part.kind === "weapon");
    let hit = state;
    weapons.forEach((part, index) => {
      hit = damageEnemy(definition, { amount: 1, hardpointId: part.id }, hit);
      expect(hit.hp).toBe(state.hp - index - 1);
      expect(hit.disabled).toBe(false);
    });
    expect(hit.hardpoints).toEqual(state.hardpoints);
    expect(enemyEffects(definition, hit)).toMatchObject({
      defeated: false,
      disabled: false,
      movementStopped: false,
    });
  });

  it("ignores stale part metadata when applying a valid hull hit", () => {
    const { definition, state } = heavy();
    const damage = { amount: 1, hardpointId: "unknown-part" };
    expect(damageEnemy(definition, damage, state)).toEqual(
      damageEnemy(definition, { ...damage, hardpointId: null }, state),
    );
  });

  it("hits the primary hull once through a part outline and resumes exactly", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.startGalaxy(1);
    playOpening(model);
    const flight = model.state.flight!;
    flight.player = { x: 0, y: 0 };
    flight.velocity = { x: 0, y: 0 };
    flight.fireCooldown = 100;
    flight.objects = [];
    const { definition, state } = heavy();
    for (const part of state.hardpoints) {
      part.cooldown = 999;
    }
    const part = definition.hardpoints.find(
      (part) => part.kind === "weapon" && enemyPartOutline(1, state, part.id),
    )!;
    const points = worldParts(enemyPartOutline(1, state, part.id)!).flat();
    const at = {
      x: state.position.x + points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: state.position.y + points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
    const target = {
      enemy: state,
      hp: state.hp,
      id: state.id,
      kind: "enemy" as const,
      radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
      ...state.position,
    };
    flight.objects = [target];
    const weapon = WEAPON_CATALOG.rapidMissile[0];
    flight.shots = [
      {
        ...at,
        blast: weapon.blastRadius!,
        damage: weapon.damageRatio,
        enemy: false,
        hitIds: [],
        id: "routing:missile",
        life: 1,
        piercing: false,
        projectile: "missile",
        velocity: { x: 1, y: 0 },
      },
    ];
    const before = state.hardpoints.map(({ hp }) => hp);
    const input = {
      aim: { x: 0, y: 0 },
      fire: false,
      move: { x: 0, y: 0 },
      use: false,
    };
    stepFlight(CONTENT, 0.000001, input, flight);
    expect(target.enemy.hp).toBeCloseTo(state.hp - weapon.damageRatio);
    expect(target.hp).toBe(target.enemy.hp);
    expect(target.enemy.hardpoints.map(({ hp }) => hp)).toEqual(before);
    expect(activeBlastFlashes(flight)).toHaveLength(1);
    const saved = model.save();
    expect(restoreSave(JSON.parse(saved))).not.toBeNull();
    const resumed = relaunch(CONTENT, saved);
    expect(resumed.state).toEqual(model.state);
    const restored = resumed.state.flight!.objects.find((object) => object.id === target.id)!;
    const nextHit = { amount: 1000, hardpointId: part.id };
    expect(damageEnemy(definition, nextHit, restored.enemy!)).toEqual(
      damageEnemy(definition, nextHit, target.enemy),
    );
  });
});
