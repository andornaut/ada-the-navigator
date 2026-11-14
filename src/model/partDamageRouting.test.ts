import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition, PHANTOM_FLAGSHIP_ID } from "../data/enemyCatalog.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { playOpening, relaunch } from "../testing/launch.ts";
import { worldParts } from "./convex.ts";
import { createEnemy, damageEnemy, enemyEffects } from "./enemyAi.ts";
import { enemyPartOutline } from "./enemyBody.ts";
import { activeBlastFlashes, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";

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
  it.each([1, 2, 3, 4, 5, 6] as const)(
    "routes a part hit without hull loss or spill in galaxy %i",
    (galaxy) => {
      const { definition, state } = heavy(galaxy);
      const part = state.hardpoints.find(
        (part) => definition.hardpoints.find((value) => value.id === part.id)?.kind === "weapon",
      )!;
      const snapshot = structuredClone(state);
      const amount = part.hp + definition.hp * 3;
      const hit = damageEnemy(definition, { amount, hardpointId: part.id }, state);
      expect(hit.hp).toBe(state.hp);
      expect(hit.hardpoints.find((value) => value.id === part.id)!.hp).toBe(0);
      expect(hit.hardpoints.filter((value) => value.id !== part.id)).toEqual(
        state.hardpoints.filter((value) => value.id !== part.id),
      );
      expect(damageEnemy(definition, { amount, hardpointId: part.id }, hit).hp).toBe(state.hp);
      expect(state).toEqual(snapshot);
    },
  );

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

  it("retains the flagship hull floor for hull hits and preserves it entirely for part hits", () => {
    const { definition, state } = heavy(6, PHANTOM_FLAGSHIP_ID);
    const part = state.hardpoints[0]!;
    expect(damageEnemy(definition, { amount: 1000, hardpointId: part.id }, state).hp).toBe(
      state.hp,
    );
    const hull = damageEnemy(definition, { amount: 1000, hardpointId: null }, state);
    expect(hull.hp).toBe(1);
    expect(hull.hardpoints).toEqual(state.hardpoints);
  });

  it("disables after the last weapon is destroyed, with engines and command still intact", () => {
    const { definition, state } = heavy();
    let hit = state;
    const weapons = definition.hardpoints.filter((part) => part.kind === "weapon");
    weapons.forEach((part, index) => {
      hit = damageEnemy(definition, { amount: part.hp * 2, hardpointId: part.id }, hit);
      expect(hit.disabled).toBe(index === weapons.length - 1);
      expect(hit.hp).toBe(state.hp);
    });
    expect(
      hit.hardpoints.filter((part) => !weapons.some((weapon) => weapon.id === part.id)),
    ).toEqual(state.hardpoints.filter((part) => !weapons.some((weapon) => weapon.id === part.id)));
    expect(enemyEffects(definition, hit)).toMatchObject({
      defeated: false,
      disabled: true,
      movementStopped: false,
    });
  });

  it("does not redirect an invalid part target to the hull", () => {
    const { definition, state } = heavy();
    expect(damageEnemy(definition, { amount: 1000, hardpointId: "unknown-part" }, state)).toBe(
      state,
    );
  });

  it("keeps one missile hit on one part, excludes the primary target from blast damage, and resumes exactly", () => {
    const model = new GameModel(CONTENT);
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
    const before = state.hardpoints.reduce((sum, part) => sum + part.hp, 0);
    const input = { aim: { x: 0, y: 0 }, fire: false, move: { x: 0, y: 0 }, use: false };
    stepFlight(CONTENT, 0.000001, input, flight);
    expect(target.enemy.hp).toBe(state.hp);
    expect(target.hp).toBe(state.hp);
    expect(before - target.enemy.hardpoints.reduce((sum, part) => sum + part.hp, 0)).toBeCloseTo(
      weapon.damageRatio,
    );
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
