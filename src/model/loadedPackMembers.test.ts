import { expect, it } from "vitest";

import { enemyCatalog } from "../data/enemyCatalog.ts";
import { createEnemy, type EnemyContext, stepEnemy } from "./enemyAi.ts";

const definition = enemyCatalog.swarm;
function fixture() {
  const state = createEnemy(
    definition,
    { archetype: "swarm", id: "active", packId: "pack", phase: 0 },
    { x: 0, y: 0 },
  );
  const context: EnemyContext = {
    adaWidth: 20,
    dt: 1 / 60,
    initialPackSizes: { pack: 4 },
    lead: 1,
    peers: [state],
    player: { x: 300, y: 0 },
    playerVelocity: { x: 0, y: 0 },
    targetable: true,
    visibility: "visible",
  };
  return { context, state };
}

it("counts loaded disabled survivors without adding them to active steering peers", () => {
  const { context, state } = fixture();
  const full = stepEnemy(definition, { ...context, loadedPackMembers: { pack: 4 } }, state);
  const retained = stepEnemy(
    definition,
    { ...context, dormantPackMembers: { pack: 3 }, loadedPackMembers: { pack: 1 } },
    state,
  );
  expect(full).toEqual(retained);
  expect(full.state.fleeing).toBe(false);
  expect(full.fire).toHaveLength(1);
  const losses = stepEnemy(definition, { ...context, loadedPackMembers: { pack: 2 } }, state);
  expect(losses.state.fleeing).toBe(true);
  expect(losses.fire).toEqual([]);
});

it("uses peers only when loaded survivor counts are absent", () => {
  const { context, state } = fixture();
  const peers = [state, ...[1, 2, 3].map((i) => ({ ...state, id: `survivor-${i}` }))];
  const legacy = stepEnemy(definition, { ...context, peers }, state);
  expect(legacy.state.fleeing).toBe(false);
  const explicit = stepEnemy(
    definition,
    { ...context, loadedPackMembers: { pack: 4 }, peers },
    state,
  );
  expect(explicit).toEqual(legacy);
  const missing = stepEnemy(definition, { ...context, loadedPackMembers: {}, peers }, state);
  expect(missing.state.fleeing).toBe(true);
  const zero = stepEnemy(definition, { ...context, loadedPackMembers: { pack: 0 }, peers }, state);
  expect(zero).toEqual(missing);
});
