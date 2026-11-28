import { beforeAll, describe, expect, it } from "vitest";

import { WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import type { Vec } from "../data/types.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { relaunch } from "../testing/launch.ts";
import { worldParts } from "./convex.ts";
import { mantaEscortMayFire, mantaEscortPhase } from "./earlyEncounterPatterns.ts";
import { enemyHull } from "./enemyBody.ts";
import { hit } from "./flight/hitResolution.ts";
import { routeBlocked, stepFlight, syncFlightRegion } from "./flight/index.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
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

function reachGuardedSite(model: GameModel, id: "whale" | "family", distance: number): SpaceObject {
  const flight = flightOf(model);
  flight.freshDistance = distance;
  model.step(0.01, idle);
  const site = flight.objects.find((object) => object.id === id)!;
  flyTo(model, site);
  const guard = stationPopulationObjects(flight).find((actor) => actor.routeId === id)!;
  expect(guard.enemy?.archetype).toBe("capital");
  expect(routeBlocked(id, flight)).toBe(true);
  hit(CONTENT, guard.hp, null, guard, flight, []);
  model.step(0.01, idle);
  expect(progressOf(model).known).toContain(id);
  return site;
}

function clearWhaleDebris(model: GameModel): void {
  const flight = flightOf(model);
  const debris = flight.objects.filter(({ id }) => id.startsWith("whale-debris:"));
  expect(debris).toHaveLength(CONTENT.tuning.whaleDebris.count);
  for (const rock of debris) {
    // This story case needs the destruction event. The separate flight test covers each rock's full HP.
    rock.hp = 1;
    flyTo(model, { x: rock.x - 100, y: rock.y });
    const present = () => flight.objects.some(({ id }) => id === rock.id);
    for (let shot = 0; shot < 400 && present(); shot++) {
      model.step(0.05, { ...idle, aim: { x: 1, y: 0 } });
    }
    expect(present()).toBe(false);
  }
  expect(progressOf(model).stage).toBe(2);
}

function revealSounder() {
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
  expect(model.state.dialogue).toBeNull();
  expect(progressOf(model)).toMatchObject({ introduced: false, stage: 0 });
  expect(model.contextAction).toBe("talk");
  model.interact();
  expect(model.state.dialogue).toMatchObject({
    context: "whale",
    text: CONTENT.chapters[3]!.dialogue.whale!.text,
  });
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
  expect(waypoint(model)).toMatchObject({ ...diskSite, travel: true });
  expect(progressOf(model).sounder).toEqual({ phase: "active" });
  model.choose("continue");
  expect(waypoint(model)).toMatchObject({
    label: CONTENT.labels.mapHolodiskWaypoint,
    objective: true,
  });
  expect(model.map?.quests.find(({ kind }) => kind === "story")).toMatchObject({
    target: "holodisk",
    text: model.objective,
  });

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

  return { diskSite, model, whale };
}

function sounderActor(model: GameModel): SpaceObject {
  const boss = stationPopulationObjects(flightOf(model)).find(
    ({ id }) => id === WHIRLPOOL_CAPITAL_BOSS.id,
  )!;
  expect(boss).toBeDefined();
  return boss;
}

function escortClock(boss: SpaceObject) {
  const clock = boss.enemy?.earlyEncounter;
  if (clock?.kind !== "manta") {
    throw new Error("Expected the active Manta escort clock");
  }
  return clock;
}

function flyMantaPass(model: GameModel, frames: number) {
  const flight = flightOf(model);
  const boss = sounderActor(model);
  const escorts = [0, 1].map((index) =>
    stationPopulationObjects(flight).find(({ id }) => id === `${boss.id}:escort:${index}`)!,
  );
  const first = escorts[0]!;
  const beforeCrossing = { x: first.x, y: first.y };
  const emitted = new Set<number>();
  // The scene's maximum update still advances flight in 1/60-second slices.
  const seconds = 0.05;
  for (let frame = 0; frame < frames; frame++) {
    const time = escortClock(boss).elapsed;
    const phase = mantaEscortPhase(time);
    const active = escorts[phase.escort ?? 0]!;
    flight.player = { x: active.x + 125, y: active.y };
    flight.velocity = { x: 0, y: 0 };
    flight.shield = model.shieldMax;
    const volleys = escorts.map((actor) => actor.enemy!.tactic.volleys);
    stepFlight(CONTENT, seconds, idle, flight);
    for (const [index, actor] of escorts.entries()) {
      if (actor.enemy!.tactic.volleys > volleys[index]!) {
        const escort = index === 0 ? 0 : 1;
        expect(mantaEscortMayFire(time + seconds, escort) || mantaEscortMayFire(time, escort)).toBe(
          true,
        );
        emitted.add(index);
      }
    }
  }
  return { beforeCrossing, emitted, first };
}

let revealed: { diskSite: Vec; save: string; whale: Vec };

beforeAll(() => {
  const { diskSite, model, whale } = revealSounder();
  revealed = { diskSite, save: model.save(), whale };
});

describe("Manta escort passes", () => {
  let intermission: { clock: ReturnType<typeof escortClock>; save: string };

  beforeAll(() => {
    const model = relaunch(CONTENT, revealed.save);
    const boss = sounderActor(model);
    flyTo(model, { x: boss.x + 300, y: boss.y });
    model.step(0.01, idle);
    expect(model.bossHud()).toMatchObject({
      captain: "Captain Sounder",
      id: boss.id,
      ship: "Manta Dreadnought",
    });
    expect(mantaEscortPhase(escortClock(boss).elapsed)).toMatchObject({
      escort: 0,
      kind: "approach",
    });
    expect(model.conversation).toMatchObject({
      speaker: "astra",
      text: "The escorts are taking turns. Use the gap between passes.",
    });
    const { beforeCrossing, emitted, first } = flyMantaPass(model, 70);
    expect(first).not.toMatchObject(beforeCrossing);
    expect(emitted).toEqual(new Set([0]));
    const clock = escortClock(boss);
    expect(mantaEscortPhase(clock.elapsed).kind).toBe("reposition");
    // The second pass starts from the actual intermission saved by the first.
    intermission = { clock, save: model.save() };
  });

  it("fires on each pass and resumes the second escort from the saved intermission", () => {
    const model = relaunch(CONTENT, intermission.save);
    expect(escortClock(sounderActor(model))).toEqual(intermission.clock);
    expect(flyMantaPass(model, 80).emitted).toEqual(new Set([1]));
  });
});

it("keeps the family's disk blocked by Sounder and collectible once after resolution and return", () => {
  const { diskSite, whale } = revealed;
  let model = relaunch(CONTENT, revealed.save);
  const flight = flightOf(model);
  const boss = sounderActor(model);
  flyTo(model, { x: boss.x + 300, y: boss.y });
  model.step(0.01, idle);
  const hull = enemyHull(boss.enemy!, ROUTE_POSITION[3])!;
  const at = worldParts(hull)[0]![0]!;
  flight.shots.push({
    damage: boss.hp,
    enemy: false,
    hitIds: flight.objects.filter(({ id }) => id !== boss.id).map(({ id }) => id),
    id: "sounder-hull-hit",
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
    x: boss.x + at.x,
    y: boss.y + at.y,
  });
  model.step(0.000001, idle);
  expect(model.flightEvents.filter(({ type }) => type === "enemyDestroyed")).toEqual([
    { id: boss.id, type: "enemyDestroyed" },
  ]);
  expect(progressOf(model).sounder).toEqual({ outcome: "defeated", phase: "resolved" });
  expect(progressOf(model).holodisk).toBe(false);

  flyTo(model, whale);
  flight.dangerFor = 0;
  model.returnHome();
  expect(model.state.flight).toBeNull();
  model = new GameModel(CONTENT, () => 503, SAVE_RESTORE, model.save());
  model.startGalaxy(3);
  expect(flightOf(model)).toMatchObject({ encounterSeed: 503, seed: 173 });
  expect(progressOf(model).sounder).toEqual({ outcome: "defeated", phase: "resolved" });
  expect(waypoint(model)).toMatchObject({ ...diskSite, travel: true });
  expect(stationPopulationObjects(flightOf(model)).some(({ id }) => id === boss.id)).toBe(false);

  flyTo(model, waypoint(model)!);
  model.step(0.01, idle);
  expect(progressOf(model).holodisk).toBe(true);
  expect(progressOf(model).known).not.toContain("holodisk");
  expect(model.screen).toBe("space");
  expect(model.storyView).toBeNull();
  expect(model.state.dialogue).toBeNull();
  expect(model.conversation).toMatchObject({
    speaker: "astra",
    text: "Memory restored. I've found new coordinates.",
  });
  model.dismissConversation();
  const pickupTime = flightOf(model).time;
  model.step(0.01, idle);
  expect(flightOf(model).time).toBeGreaterThan(pickupTime);
  expect(model.screen).toBe("space");
  expect(model.conversation).toMatchObject({
    speaker: "astra",
    text: "I carried that fleet from galaxy to galaxy. But whose fleet?",
  });
  expect(waypoint(model)).toBeUndefined();
  expect(flightOf(model).objects.some(({ id }) => id === "holodisk")).toBe(false);
});
