import { afterEach, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import * as enemyAi from "./ai/index.ts";
import { stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval } from "./geography.ts";
import type { SpaceObject } from "./types.ts";
import { flightWorldContext } from "./world/index.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
afterEach(() => vi.restoreAllMocks());

function fixture() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.progress[1].opened = true;
  model.startGalaxy(1);
  const flight = model.state.flight!;
  flight.objects = [];
  flight.world = { notables: {}, version: 1 };
  const actors = (["swarm", "frigate"] as const).map((kind, index): SpaceObject => {
    const id = `peer-proof:${kind}`;
    const point = { x: 200 + index * 400, y: 200 };
    const definition = enemyDefinition(1, kind, id);
    const state = enemyAi.createEnemy(
      definition,
      { archetype: kind, id, packId: "peer-proof", phase: 0 },
      point,
    );
    if (kind === "frigate") {
      state.disabled = true;
      state.hp -= 1;
      for (const mount of state.hardpoints) {
        mount.hp = 0;
      }
      state.velocity = { x: 10, y: 0 };
    }
    return {
      ...point,
      enemy: state,
      hp: state.hp,
      id,
      kind: "enemy",
      persistent: true,
      radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
    };
  });
  flight.objects.push(...actors);
  flight.combat!.initialPackSizes["peer-proof"] = actors.length;
  return { active: actors[0]!, disabled: actors[1]!, flight, model };
}

it("reactivates a legacy damaged hull without changing the loaded pack count", () => {
  const { active, disabled, flight } = fixture();
  const before = { hp: disabled.hp, x: disabled.x };
  const spy = vi.spyOn(enemyAi, "stepEnemy");
  const events = stepFlight(CONTENT, SIMULATION_STEP_SECONDS, idle, flight);
  expect(disabled.enemy!.disabled).toBe(false);
  spy.mockClear();
  stepFlight(CONTENT, SIMULATION_STEP_SECONDS, idle, flight);
  const observations = spy.mock.calls
    .filter(([, , state]) => [active.id, disabled.id].includes(state.id))
    .map(([, context]) => context);
  expect(observations).toHaveLength(2);
  for (const context of observations) {
    expect(context.peers.map(({ id }) => id)).toEqual([active.id, disabled.id]);
    expect(context.loadedPackMembers?.["peer-proof"]).toBe(2);
    expect(context.loadedPackMembers).toBe(observations[0]!.loadedPackMembers);
    expect(Object.isFrozen(context.loadedPackMembers)).toBe(true);
  }
  expect(active.enemy!.fleeing).toBe(false);
  expect(disabled.hp).toBe(before.hp);
  expect(disabled.x).toBeGreaterThan(before.x);
  expect(events.some(({ type }) => type === "enemyDestroyed")).toBe(false);
  expect(flight).not.toHaveProperty("loadedPackMembers");
});

it("retains damaged survivors on Continue and counts an authoritative removal as a pack loss", () => {
  const { active, disabled, flight, model } = fixture();
  const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
  resumed.continueGame();
  expect(resumed.state.flight).toEqual(flight);
  const retained = resumed.state.flight!.objects.find(({ id }) => id === disabled.id)!;
  expect(retained.enemy!.disabled).toBe(true);
  expect(retained.enemy!.hardpoints.every(({ hp }) => hp === 0)).toBe(true);
  stepFlight(CONTENT, SIMULATION_STEP_SECONDS, idle, resumed.state.flight!);
  expect(retained.enemy!.disabled).toBe(false);
  worldRecordObjectRemoval(flightWorldContext(flight), CONTENT, disabled, flight);
  flight.objects = flight.objects.filter(({ id }) => id !== disabled.id);
  const spy = vi.spyOn(enemyAi, "stepEnemy");
  stepFlight(CONTENT, SIMULATION_STEP_SECONDS, idle, flight);
  const context = spy.mock.calls.find(([, , state]) => state.id === active.id)![1];
  expect(context.loadedPackMembers?.["peer-proof"]).toBe(1);
  expect(context.initialPackSizes["peer-proof"]).toBe(2);
  expect(active.enemy!.fleeing).toBe(true);
  expect(flight.world.notables[disabled.id]).toBeNull();
});
