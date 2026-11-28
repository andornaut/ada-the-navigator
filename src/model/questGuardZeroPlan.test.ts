import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { ensureRouteEncounter, routeBlocked, routeGuardPlanResult } from "./flight/index.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval } from "./geography.ts";
import { rememberRequiredSite } from "./requiredEncounterPlans.ts";
import type { Vec } from "./types.ts";
import { flightWorldContext } from "./world/index.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function fixture(point?: Vec) {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.progress[1].opened = true;
  model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  if (point) {
    rememberRequiredSite(model.state.progress[1], "growers", point);
  }
  model.startGalaxy(1);
  model.state.dialogue = null;
  const flight = model.state.flight!;
  const before = {
    kills: model.state.progress[1].destroyedEnemies,
    stardust: model.state.economy.stardust,
  };
  flight.freshDistance = CONTENT.tuning.introFreshDistance;
  model.step(SIMULATION_STEP_SECONDS, idle);
  const guard = flight.objects.find((actor) => actor.routeId === "growers")!;
  expect(guard).toBeDefined();
  return { before, flight, guard, model };
}

it("retains one required leader with zero support through Continue without claiming defeat or rewards", () => {
  const { before, flight, guard, model } = fixture();
  expect(flight.objects.filter((actor) => actor.enemy?.escortOf === guard.id)).toEqual([]);
  expect(routeGuardPlanResult(flight, "growers").status).toBe("admitted");
  expect(flight.combat!.routeEncounters).toEqual(["growers"]);
  expect(flight.combat!.emptyRoutePlans).toBeUndefined();
  expect(model.state.progress[1].destroyedEnemies).toBe(before.kills);
  expect(model.state.economy.stardust).toBe(before.stardust);
  guard.enemy!.hardpoints[0]!.cooldown = 0.73;
  guard.enemy!.firePhasesInitialized = true;
  const snapshot = structuredClone(guard);
  const resumed = relaunch(CONTENT, model.save());
  const restored = resumed.state.flight!;
  expect(restored).not.toBeNull();
  expect(restored.objects.find((actor) => actor.id === guard.id)).toEqual(snapshot);
  expect(ensureRouteEncounter(CONTENT, "growers", restored)).toEqual(snapshot);
  expect(routeBlocked("growers", restored)).toBe(true);
  expect(restored.combat!.routeEncounters).toEqual(["growers"]);
  expect(resumed.state.progress[1]).toMatchObject({
    destroyedEnemies: before.kills,
    introduced: false,
    questItem: null,
    stage: 0,
  });
  expect(resumed.state.economy.stardust).toBe(before.stardust);
});

it("preserves admitted support casualties and surviving full states without replenishment on Continue", () => {
  const { before, flight, guard, model } = fixture({ x: 15000, y: 0 });
  const support = flight.objects.filter((actor) => actor.enemy?.escortOf === guard.id);
  expect(support).toHaveLength(2);
  const casualty = support[0]!;
  const survivor = support[1]!;
  guard.enemy!.hardpoints[0]!.cooldown = 0.73;
  guard.enemy!.firePhasesInitialized = true;
  survivor.hp -= 1;
  survivor.enemy!.hp = survivor.hp;
  worldRecordObjectRemoval(flightWorldContext(flight), CONTENT, casualty, flight);
  flight.objects = flight.objects.filter((actor) => actor.id !== casualty.id);
  const leaderState = structuredClone(guard);
  const survivorState = structuredClone(survivor);
  const resumed = relaunch(CONTENT, model.save());
  const restored = resumed.state.flight!;
  expect(restored).not.toBeNull();
  expect(ensureRouteEncounter(CONTENT, "growers", restored)).toEqual(leaderState);
  expect(restored.objects.filter((actor) => actor.enemy?.escortOf === guard.id)).toEqual([
    survivorState,
  ]);
  expect(restored.world.notables[casualty.id]).toBeNull();
  expect(restored.combat!.routeEncounters).toEqual(["growers"]);
  expect(routeBlocked("growers", restored)).toBe(true);
  expect(resumed.state.progress[1].introduced).toBe(false);
  expect(resumed.state.progress[1].destroyedEnemies).toBe(before.kills);
  expect(resumed.state.economy.stardust).toBe(before.stardust);
});
