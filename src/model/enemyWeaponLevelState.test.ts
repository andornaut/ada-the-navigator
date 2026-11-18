import { expect, it } from "vitest";

import { enemyCatalog } from "../data/enemyCatalog.ts";
import { createEnemy, stepEnemy } from "./enemyAi.ts";

const identity = { archetype: "fighter" as const, id: "level-state", packId: null, phase: 0 };
const definition = enemyCatalog.fighter;
const position = { x: 300, y: 0 };

it("preserves an explicitly equipped level without altering mechanism state or firing", () => {
  const legacy = createEnemy(definition, identity, position);
  legacy.primaryCooldown = 0.37;
  const context = {
    adaWidth: 32,
    dt: 0.01,
    inPlayView: true,
    initialPackSizes: {},
    lead: 1,
    peers: [legacy],
    player: { x: 0, y: 0 },
    playerVelocity: { x: 0, y: 0 },
    targetable: false,
    visibility: "unknown" as const,
  };
  const expected = stepEnemy(definition, context, legacy);
  for (const level of [1, 2, 3] as const) {
    const enemy = createEnemy(definition, { ...identity, weaponLevel: level }, position);
    enemy.primaryCooldown = legacy.primaryCooldown;
    expect(enemy.weaponLevel).toBe(level);
    const result = stepEnemy(definition, context, enemy);
    const { weaponLevel, ...state } = result.state;
    expect(weaponLevel).toBe(level);
    expect(state).toEqual(expected.state);
    expect(result.fire).toEqual(expected.fire);
    expect(result.aim).toEqual(expected.aim);
    expect(result.velocity).toEqual(expected.velocity);
  }
});

it("retains legacy absence without rolling or adding an equipped level during reads", () => {
  const enemy = createEnemy(definition, identity, position);
  expect(Object.hasOwn(enemy, "weaponLevel")).toBe(false);
  expect(enemy.weaponLevel).toBeUndefined();
  const result = stepEnemy(
    definition,
    {
      adaWidth: 32,
      dt: 0.01,
      inPlayView: true,
      initialPackSizes: {},
      lead: 1,
      peers: [enemy],
      player: position,
      playerVelocity: { x: 0, y: 0 },
      targetable: false,
      visibility: "unknown",
    },
    enemy,
  );
  expect(Object.hasOwn(result.state, "weaponLevel")).toBe(false);
});
