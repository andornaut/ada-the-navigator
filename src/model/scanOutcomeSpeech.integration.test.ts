import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import { relaunch } from "../testing/launch.ts";
import { activateRequiredRoute, ensureDestination } from "./flight.ts";
import { GameModel } from "./game.ts";
import { landmarkSites } from "./landmarks.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
it("shares one actual immutable scan receipt with the UI drain and preserves it under an authored modal", () => {
  const model = new GameModel(CONTENT);
  model.state.prologueSeen = true;
  model.state.progress[1].opened = true;
  model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  model.startGalaxy(1);
  const flight = model.state.flight!;
  const site = landmarkSites(1)[0]!;
  flight.player = { x: site.x, y: site.y };
  expect(model.contextAction).toBe("scan");
  model.interact();
  const [receipt] = model.drainScanOutcomes();
  expect(receipt).toBeDefined();
  expect(Object.isFrozen(receipt)).toBe(true);
  expect(receipt!.completions).toEqual([]);
  expect(model.drainScanOutcomes()).toEqual([]);
  const entered = activateRequiredRoute(CONTENT, "growers", flight);
  if (entered.status !== "created" && entered.status !== "existing") {
    throw new Error(entered.status);
  }
  entered.guard.enemy!.disabled = true;
  const growers = ensureDestination(CONTENT, "growers", flight);
  flight.player = { x: growers.x, y: growers.y };
  model.step(SIMULATION_STEP_SECONDS, idle);
  const modal = model.state.dialogue;
  expect(modal).not.toBeNull();
  const saved = model.save();
  model.step(5, { ...idle, move: { x: 1, y: 0 } });
  expect(model.save()).toBe(saved);
  expect(model.state.dialogue).toBe(modal);
  model.closeInteraction();
  expect(model.conversation).toMatchObject({
    name: "Astra",
    text: `Scan complete: ${receipt!.target.name}.`,
  });
  expect(model.conversation!.elapsed).toBe(0);
  expect(model.reopenInteraction()).toBe(true);
  expect(model.state.dialogue).toBe(modal);
  const resumed = relaunch(CONTENT, model.save());
  expect(resumed.drainScanOutcomes()).toEqual([]);
  resumed.closeInteraction();
  expect(resumed.conversation?.text).not.toBe(`Scan complete: ${receipt!.target.name}.`);
  expect(resumed.state.economy.stardust).toBe(model.state.economy.stardust);
});
