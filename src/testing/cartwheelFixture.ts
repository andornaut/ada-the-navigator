import type { GameContent } from "../data/types.ts";
import { hit } from "../model/flight/hitResolution.ts";
import type { GameModel } from "../model/game.ts";
import { stationPopulationObjects } from "../model/hostileStations.ts";
import { HUB_STATION } from "../model/stations.ts";
import type { SpaceObject } from "../model/types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

/** Test support: exercise actual intro admission, retaining the authored guard for combat assertions. */
export function activateCartwheelHubFixture(content: GameContent, model: GameModel): SpaceObject {
  const flight = model.state.flight;
  if (!flight || flight.galaxy !== 2 || model.state.dialogue || model.state.docked) {
    throw new Error("Cartwheel admission requires an active unobstructed flight");
  }
  flight.freshDistance = Math.max(flight.freshDistance, content.tuning.introFreshDistance);
  model.step(1 / 60, idle);
  const hub = stationPopulationObjects(flight).find(
    (object) => object.kind === "destination" && object.id === HUB_STATION,
  );
  if (!hub) {
    throw new Error(
      "Actual Cartwheel intro did not admit the hub; configure story state before launch",
    );
  }
  return hub;
}

/** Test support: visit the real hub and defeat its approach guard through canonical hull damage. */
export function visitCartwheelHubFixture(content: GameContent, model: GameModel): SpaceObject {
  const hub = activateCartwheelHubFixture(content, model);
  const flight = model.state.flight!;
  flight.player = { x: hub.x, y: hub.y };
  flight.velocity = { x: 0, y: 0 };
  model.step(1 / 60, idle);
  const guard = stationPopulationObjects(flight).find((object) => object.routeId === HUB_STATION);
  if (!guard?.enemy) {
    throw new Error("Expected the actual Cartwheel approach capital before friendly interaction");
  }
  hit(content, guard.enemy.hp, null, guard, flight, []);
  model.step(1 / 60, idle);
  return hub;
}

/** Test support: complete the first hosted Hub exchange and leave the berth for flight controls. */
export function completeCartwheelHubIntroductionFixture(model: GameModel): void {
  model.state.flight!.dangerFor = 0;
  model.interact();
  const intro = model.stationTalk?.panel;
  if (intro?.context !== "hub") {
    throw new Error("Expected the authored Hub introduction in station Talk");
  }
  model.chooseStationTalk(intro, "continue");
  model.undock();
}
