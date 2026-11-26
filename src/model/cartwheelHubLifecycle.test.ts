import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import {
  activateCartwheelHubFixture,
  visitCartwheelHubFixture,
} from "../testing/cartwheelFixture.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { ensureDestination, routeBlocked } from "./flight.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { readRequiredRolePlan } from "./requiredRolePlans.ts";

function launched() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [1, 2] });
  model.state.progress[2].opened = true;
  model.startGalaxy(2);
  return model;
}

it("admits the guarded hub, then actual weapon defeat enables repeat Dock and strict Continue", () => {
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
  expect(model.state.progress[2]).toMatchObject({ introduced: true, known: ["hub"], stage: 1 });
  expect(model.state.dialogue).not.toBeNull();
  model.choose("continue");
  expect(model.contextAction).toBe("dock");
  model.interact();
  expect(model.state.docked).toBe("hub");
  const resumed = relaunch(CONTENT, model.save());
  expect(resumed.state).toEqual(model.state);
  resumed.undock();
  expect(resumed.contextAction).toBe("dock");
  resumed.interact();
  expect(resumed.state.docked).toBe("hub");
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
