import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { INTERACTION_COPY } from "../data/conversations.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import {
  activateCartwheelHubFixture,
  visitCartwheelHubFixture,
} from "../testing/cartwheelFixture.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { interactionCopy } from "./conversations.ts";
import { ensureDestination, routeBlocked } from "./flight.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { readRequiredRolePlan } from "./requiredRolePlans.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function launched() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [1, 2] });
  model.state.progress[2].opened = true;
  model.startGalaxy(2);
  return model;
}

it("admits the guarded Hub and resolves its hosted introduction before Deposit", () => {
  const model = launched();
  const flight = model.state.flight!;
  expect(readRequiredRolePlan(flight, "hub")).not.toBeNull();
  expect(model.map!.places.some(({ id }) => id === "hub")).toBe(false);
  const hub = activateCartwheelHubFixture(CONTENT, model);
  expect(readRequiredRolePlan(flight, "hub")).toBeNull();
  expect(routeBlocked("hub", flight)).toBe(true);
  expect(stationPopulationObjects(flight).filter(({ routeId }) => routeId === "hub")).toHaveLength(
    1,
  );
  const visited = visitCartwheelHubFixture(CONTENT, model);
  expect(visited.id).toBe(hub.id);
  expect(routeBlocked("hub", flight)).toBe(false);
  flight.cargo = CONTENT.tuning.miningMilestones[0];
  const beforeTalk = { deposited: 0, introduced: false, known: ["hub"], stage: 0 };
  expect(model.state.progress[2]).toMatchObject(beforeTalk);
  expect(model.state.dialogue).toBeNull();
  const time = flight.time;
  model.step(1 / 60, idle);
  expect(flight.time).toBeGreaterThan(time);
  expect(model.state.dialogue).toBeNull();
  expect(model.state.docked).toBeNull();
  expect(model.contextAction).toBe("talk");
  expect(model.state.progress[2]).toMatchObject(beforeTalk);

  const resumed = relaunch(CONTENT, model.save());
  expect(resumed.state).toEqual(model.state);
  expect(resumed.contextAction).toBe("talk");
  const continuedFlight = resumed.state.flight!;
  continuedFlight.dangerFor = 1;
  resumed.interact();
  expect(resumed.state.notice).toBe(CONTENT.labels.travelUnavailable);
  expect(resumed.state.docked).toBeNull();
  expect(resumed.stationTalk).toBeNull();
  expect(resumed.state.progress[2]).toMatchObject(beforeTalk);
  expect(continuedFlight.cargo).toBe(flight.cargo);
  continuedFlight.dangerFor = 0;

  resumed.step(1 / 60, { ...idle, use: true });
  expect(resumed.state.docked).toBe("hub");
  expect(resumed.state.dialogue).toBeNull();
  const intro = resumed.stationTalk!.panel!;
  expect(intro).toMatchObject({ context: "hub", title: "Station" });
  expect(interactionCopy(2, intro)).toEqual(INTERACTION_COPY["2.hub"]);
  expect(resumed.dockGreeting()?.displayName).toBe("Quartz");
  expect(resumed.stationServices).toMatchObject({
    equipment: true,
    exchange: true,
    jobs: true,
    weaponsAmmo: true,
  });
  expect(resumed.shopGroups()).toBeDefined();
  expect(resumed.stationTalk?.panel).toBe(intro);
  expect(resumed.state.progress[2]).toMatchObject(beforeTalk);
  resumed.undock();
  expect(resumed.contextAction).toBe("talk");
  expect(resumed.stationTalk).toBeNull();
  resumed.interact();
  expect(resumed.stationTalk?.panel).toEqual(intro);
  expect(resumed.stationTalk?.panel).not.toBe(intro);

  const docked = relaunch(CONTENT, resumed.save());
  expect(docked.state.docked).toBe("hub");
  expect(docked.stationTalk?.panel).toEqual(intro);
  docked.chooseStationTalk(intro, "continue");
  expect(docked.state.progress[2]).toMatchObject(beforeTalk);
  const current = docked.stationTalk!.panel!;
  docked.chooseStationTalk(current, "continue");
  docked.chooseStationTalk(current, "continue");
  expect(docked.state.progress[2]).toMatchObject({ deposited: 0, introduced: true, stage: 1 });
  expect(docked.stationTalk?.panel).toBeNull();
  expect(docked.state.flight!.cargo).toBe(flight.cargo);
  const introduced = relaunch(CONTENT, docked.save());
  expect(introduced.stationTalk?.panel).toBeNull();
  introduced.undock();
  expect(introduced.contextAction).toBe("deposit");
  introduced.interact();
  expect(introduced.state.dialogue?.context).toBe("deposit");
  expect(introduced.state.progress[2]).toMatchObject({
    deposited: flight.cargo,
    introduced: true,
    stage: 2,
  });
  expect(introduced.state.flight?.storyScene).toMatchObject({ id: "blocked", lineDue: true });
});

it("delivers a legitimately held job before starting the Hub introduction", () => {
  const model = launched();
  const hub = visitCartwheelHubFixture(CONTENT, model);
  const flight = model.state.flight!;
  model.state.tasks[2] = {
    carrying: true,
    id: "job:delivery",
    item: "parts",
    kind: "job",
    reward: 15,
    station: "station:-3,-2",
    target: { id: hub.id, x: hub.x, y: hub.y },
    type: "delivery",
  };
  flight.cargo = 3;
  expect(model.contextAction).toBe("deliver");
  model.interact();
  expect(model.state.dialogue?.context).toBe("deliver");
  expect(model.state.tasks[2]).toBeUndefined();
  expect(model.state.progress[2]).toMatchObject({ deposited: 0, introduced: false, stage: 0 });
  expect(model.state.docked).toBeNull();
  expect(flight.cargo).toBe(3);
  model.choose("continue");
  expect(model.contextAction).toBe("talk");
});

it("classifies direct ensureDestination after launch as a detached plan read, not activation", () => {
  const model = launched();
  const flight = model.state.flight!;
  const before = structuredClone(model.state);
  const hub = ensureDestination(CONTENT, "hub", flight);
  expect(hub).toBe(readRequiredRolePlan(flight, "hub")!.site);
  expect(flight.objects.some(({ id }) => id === "hub")).toBe(false);
  expect(model.state).toEqual(before);
});

it("resolved board fixtures configured before launch have a loaded hub without a new guard", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [1, 2] });
  Object.assign(model.state.progress[2], {
    introduced: true,
    known: ["hub"],
    opened: true,
    questComplete: true,
    resolved: true,
    stage: 5,
  });
  model.startGalaxy(2);
  const flight = model.state.flight!;
  const hub = stationPopulationObjects(flight).find(({ id }) => id === "hub")!;
  expect(hub).toBeDefined();
  expect(readRequiredRolePlan(flight, "hub")).toBeNull();
  expect(stationPopulationObjects(flight).some(({ routeId }) => routeId === "hub")).toBe(false);
  flight.player = { x: hub.x, y: hub.y };
  model.step(1 / 60, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
  expect(model.contextAction).toBe("dock");
  model.interact();
  expect(model.state.docked).toBe("hub");
});
