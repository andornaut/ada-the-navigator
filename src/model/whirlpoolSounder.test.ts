import { expect, it } from "vitest";

import { WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import type { Vec } from "../data/types.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { readStory, relaunch } from "../testing/launch.ts";
import { damageEnemy } from "./enemyAi.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { routeBlocked, syncFlightRegion } from "./flight.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import type { SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const flightOf = (model: GameModel) => model.state.flight!;
const progressOf = (model: GameModel) => model.state.progress[3];
const waypoint = (model: GameModel) => model.map?.places.find(({ id }) => id === "holodisk");

function flyTo(model: GameModel, { x, y }: Vec): void {
  const flight = flightOf(model);
  flight.player = { x, y };
  flight.velocity = { x: 0, y: 0 };
  syncFlightRegion(CONTENT, flight);
}

function disableWeapons(actor: SpaceObject): void {
  const definition = enemyEquipmentDefinition(3, actor.enemy!);
  for (const part of definition.hardpoints.filter(({ kind }) => kind === "weapon")) {
    actor.enemy = damageEnemy(definition, { amount: part.hp, hardpointId: part.id }, actor.enemy!);
  }
  expect(actor.enemy?.disabled).toBe(true);
}

function reachGuardedSite(model: GameModel, id: "whale" | "family", distance: number): SpaceObject {
  const flight = flightOf(model);
  flight.freshDistance = distance;
  model.step(0.01, idle);
  const site = flight.objects.find((object) => object.id === id)!;
  flyTo(model, site);
  const guard = stationPopulationObjects(flight).find((actor) => actor.routeId === id)!;
  expect(guard.enemy?.archetype).toBe("capital");
  expect(routeBlocked(id, flight)).toBe(true);
  disableWeapons(guard);
  model.step(0.01, idle);
  expect(progressOf(model).known).toContain(id);
  return site;
}

function clearWhaleDebris(model: GameModel): void {
  const flight = flightOf(model);
  const debris = flight.objects.filter(({ id }) => id.startsWith("whale-debris:"));
  expect(debris).toHaveLength(CONTENT.tuning.whaleDebris.count);
  for (const rock of debris) {
    flyTo(model, { x: rock.x - 100, y: rock.y });
    const present = () => flight.objects.some(({ id }) => id === rock.id);
    for (let shot = 0; shot < 400 && present(); shot++) {
      model.step(0.05, { ...idle, aim: { x: 1, y: 0 } });
    }
    expect(present()).toBe(false);
  }
  expect(progressOf(model).stage).toBe(2);
}

it("keeps the family's disk blocked by Sounder and collectible once after resolution and return", () => {
  const seeds = [173, 301];
  let model = new GameModel(CONTENT, () => seeds.shift()!, SAVE_RESTORE);
  model.state.unlocked = [1, 3];
  model.state.prologueSeen = true;
  model.state.progress[1].holodisk = true;
  progressOf(model).opened = true;
  model.startGalaxy(3);
  expect(flightOf(model)).toMatchObject({ encounterSeed: 301, galaxy: 3, seed: 173 });
  expect(waypoint(model)).toBeUndefined();
  expect(progressOf(model).sounder).toBeUndefined();
  const site = progressOf(model).requiredSites?.holodisk;
  expect(site).toBeDefined();
  const diskSite = { x: site!.x, y: site!.y };

  const { encounterFreshDistance, introFreshDistance } = CONTENT.tuning;
  const whale = reachGuardedSite(model, "whale", introFreshDistance);
  expect(model.state.dialogue).not.toBeNull();
  model.choose("continue");
  clearWhaleDebris(model);
  flyTo(model, whale);
  model.interact();
  expect(model.state.dialogue?.context).toBe("freed");
  model.choose("continue");
  reachGuardedSite(model, "family", introFreshDistance + 3 * encounterFreshDistance);
  model.interact();
  expect(model.state.dialogue?.context).toBe("family");
  model.choose("continue");
  expect(progressOf(model).sounder).toBeUndefined();
  expect(waypoint(model)).toBeUndefined();

  flyTo(model, whale);
  model.interact();
  for (const context of ["reunion", "reunionDeparture", "holodiskLead"]) {
    expect(model.state.dialogue?.context).toBe(context);
    expect(waypoint(model)).toBeUndefined();
    expect(progressOf(model).sounder).toEqual({ phase: "hidden" });
    model.choose("continue");
  }
  expect(model.state.dialogue).toMatchObject({
    context: "holodiskLeadSong",
    title: "Whale family",
  });
  expect(waypoint(model)).toMatchObject({ ...diskSite, travel: false });
  expect(progressOf(model).sounder).toEqual({ phase: "active" });
  model.choose("continue");

  flyTo(model, waypoint(model)!);
  model.step(0.01, idle);
  expect(progressOf(model).holodisk).toBe(false);
  expect(waypoint(model)).toMatchObject(diskSite);
  expect(flightOf(model).objects.some(({ id }) => id === "holodisk")).toBe(false);
  expect(model.destinations().map(({ id }) => id)).not.toContain("holodisk");

  model = relaunch(CONTENT, model.save());
  expect(progressOf(model).sounder?.phase).toBe("active");
  expect(progressOf(model).holodisk).toBe(false);
  expect(waypoint(model)).toMatchObject(diskSite);

  const flight = flightOf(model);
  const boss = stationPopulationObjects(flight).find(({ id }) => id === WHIRLPOOL_CAPITAL_BOSS.id)!;
  expect(boss).toBeDefined();
  flyTo(model, { x: boss.x + 300, y: boss.y });
  model.step(0.01, idle);
  expect(model.bossHud()).toMatchObject({
    captain: "Captain Sounder",
    id: boss.id,
    ship: "Manta Dreadnought",
  });
  disableWeapons(boss);
  model.step(0.01, idle);
  expect(progressOf(model).sounder).toEqual({ outcome: "disabled", phase: "resolved" });
  expect(progressOf(model).holodisk).toBe(false);

  flyTo(model, whale);
  flight.dangerFor = 0;
  model.returnHome();
  expect(model.state.flight).toBeNull();
  model = new GameModel(CONTENT, () => 503, SAVE_RESTORE, model.save());
  model.startGalaxy(3);
  expect(flightOf(model)).toMatchObject({ encounterSeed: 503, seed: 173 });
  expect(progressOf(model).sounder).toEqual({ outcome: "disabled", phase: "resolved" });
  expect(waypoint(model)).toMatchObject({ ...diskSite, travel: false });
  expect(stationPopulationObjects(flightOf(model)).some(({ id }) => id === boss.id)).toBe(false);

  flyTo(model, waypoint(model)!);
  model.step(0.01, idle);
  expect(progressOf(model).holodisk).toBe(true);
  expect(progressOf(model).known).not.toContain("holodisk");
  expect(readStory(model).map(({ text }) => text)).toContain(
    "Ada slides the holodisk into Astra's drive.",
  );
  model.step(0.01, idle);
  expect(model.screen).toBe("space");
  expect(waypoint(model)).toBeUndefined();
  expect(flightOf(model).objects.some(({ id }) => id === "holodisk")).toBe(false);
});
