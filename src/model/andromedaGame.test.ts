import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { COURIER } from "../data/activities.ts";
import { CONTENT } from "../data/content.ts";
import { CONVERSATION_TUNING } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { BUILT, GALAXY_NUMBERS, ROUTE_POSITION } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { readStory, relaunch, supportEntropy } from "../testing/launch.ts";
import {
  andromedaCourierActor,
  andromedaCourierAttempt,
  andromedaCourierMarkers,
  takeAndromedaCourierWarning,
} from "./andromeda.ts";
import {
  COURIER_AMBUSH_ID,
  courierAmbushLeg,
  courierAmbushTerrainCovered,
  planCourierAmbush,
} from "./andromedaCourierAmbush.ts";
import { andromedaLaneCourier } from "./andromedaLane.ts";
import { nearestSettlement, worldNearestSettlerStation } from "./andromedaPlaces.ts";
import { ANDROMEDA_REDACT, andromedaRedactEligible } from "./andromedaRedact.ts";
import { placementRadius, worldSceneryBlocksSegment } from "./asteroids.ts";
import { capitalBossActor } from "./capitalBossEncounter.ts";
import { interactionCopy } from "./conversations.ts";
import { closestOnSegment, outlineContact, worldParts } from "./convex.ts";
import { GAME_AREA, gameAreaPoint, inGameArea } from "./edgeMarkers.ts";
import { damageEnemy } from "./enemyAi.ts";
import { enemyHull, enemyPartOutline } from "./enemyBody.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { ensureStation, questGuardPlacementContext } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval, worldSyncFlightRegion } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { stationDisplayName } from "./stationIdentity.ts";
import { flightStationContext, worldStationById } from "./stations.ts";
import { worldDelta, worldDistance, worldPoint } from "./worldContacts.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

// Exercise the staged runtime through its real model without promoting the production roster.
const built = BUILT as Set<GalaxyNumber>;
beforeAll(() => built.add(5));
afterAll(() => built.delete(5));

function launch(seed?: number): GameModel {
  const model = new GameModel(
    CONTENT,
    seed === undefined ? supportEntropy : () => seed,
    SAVE_RESTORE,
  );
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  for (const progress of Object.values(model.state.progress)) {
    progress.opened = true;
  }
  model.startGalaxy(5);
  return model;
}
function visit(model: GameModel, id: string): void {
  const flight = model.state.flight!;
  const target = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
  expect(target, id).toBeDefined();
  Object.assign(flight.player, { x: target!.x, y: target!.y });
  flight.velocity = { x: 0, y: 0 };
  model.step(0.001, idle);
}
function continuePanel(model: GameModel, context: string): void {
  expect(model.state.dialogue?.context).toBe(context);
  expect(model.state.dialogue?.choices.map(({ id }) => id)).toEqual(["continue"]);
  model.choose("continue");
}
function arrival(model: GameModel): void {
  const flight = model.state.flight!;
  const station = worldNearestSettlerStation(flightStationContext(flight), ECONOMY, flight.player);
  ensureStation(CONTENT, station.id, flight);
  visit(model, station.id);
  expect(model.state.dialogue).toBeNull();
  expect(model.state.progress[5].stage).toBe(0);
  model.interact();
  continuePanel(model, "andromeda:arrival");
  expect(model.state.docked).toBeNull();
}

function acceptCourierLeg(
  model: GameModel,
  beforeOwnsUp?: (flight: NonNullable<GameModel["state"]["flight"]>, stationId: string) => void,
): GameModel {
  arrival(model);
  visit(model, "pip");
  model.interact();
  continuePanel(model, "andromeda:confession");
  const station = model.state.progress[5].andromeda!.station!;
  visit(model, station);
  expect(model.useTarget).toEqual({ action: "talk", id: station });
  expect(model.map?.places.find(({ id }) => id === station)).toMatchObject({
    kind: "station",
    label: stationDisplayName("Andromeda", station),
    objective: true,
    travel: true,
  });
  expect(model.map?.quests.find(({ kind }) => kind === "story")).toMatchObject({
    target: station,
    text: CONTENT.chapters[5]!.objectives[3],
  });
  model.interact();
  beforeOwnsUp?.(model.state.flight!, station);
  continuePanel(model, "andromeda:ownsUp");
  return model;
}

function repairBeacon(initial: GameModel): GameModel {
  let model = acceptCourierLeg(initial);
  const { settlement, station } = model.state.progress[5].andromeda!;
  expect(settlement).toMatch(/^settlement:/u);
  expect(settlement).not.toBe(station);
  visit(model, settlement!);
  expect(model.useTarget).toEqual({ action: "talk", id: settlement });
  expect(model.map?.places.find(({ id }) => id === settlement)).toMatchObject({
    label: CONTENT.labels.settlement,
    objective: true,
  });
  expect(model.map?.quests.find(({ kind }) => kind === "story")).toMatchObject({
    target: settlement,
    text: CONTENT.chapters[5]!.objectives[4],
  });
  model.interact();
  expect(model.state.progress[5]).toMatchObject({ questItem: null, stage: 4 });
  const partsPanel = model.state.dialogue;
  model.closeInteraction();
  const saved = model.save();
  expect(restoreSave(saved)).not.toBeNull();
  model = relaunch(CONTENT, saved);
  expect(model.state.progress[5].andromeda).toEqual({ settlement, station });
  model.interact();
  expect(model.state.dialogue).toEqual(partsPanel);
  continuePanel(model, "andromeda:parts");
  expect(model.state.progress[5]).toMatchObject({ questItem: "beaconParts", stage: 5 });
  const carrying = model.save();
  expect(restoreSave(carrying)).not.toBeNull();
  model = relaunch(CONTENT, carrying);
  expect(model.ship.aboard).toEqual({ kind: "carrying", name: "Beacon parts" });
  visit(model, "darkBeacon");
  expect(model.contextAction).toBe("deliver");
  model.interact();
  const redactEligible = () =>
    andromedaRedactEligible({
      content: CONTENT,
      flight: model.state.flight!,
      progress: model.state.progress[5],
    });
  expect(redactEligible()).toBe(false);
  expect(model.state.progress[5].redact).toBeUndefined();
  expect(model.map?.places.some(({ id }) => id === ANDROMEDA_REDACT.id)).toBe(false);
  continuePanel(model, "andromeda:repaired");
  expect(redactEligible()).toBe(true);
  expect(model.state.progress[5].redact?.phase).toBe("active");
  expect(model.state.progress[5]).toMatchObject({
    questComplete: true,
    questItem: null,
    stage: 6,
  });
  return model;
}

describe("repaired Andromeda lane", () => {
  const baseSpeed = CONTENT.tuning.physics.maxSpeed;
  const sample = (model: GameModel) =>
    andromedaLaneCourier({ baseSpeed, progress: model.state.progress[5] }, model.state.flight!);

  it("runs out and back on the wrapped leg to the accepted station as scenery", () => {
    const launched = launch(301);
    expect(sample(launched)).toBeNull();
    launched.andromedaCourierDisplayed(launched.state.flight!);
    expect(launched.state.seenConversations).not.toContain("andromeda:lane-courier:sighted");
    const model = repairBeacon(launched);
    const flight = model.state.flight!;
    const progress = model.state.progress[5];
    const beacon = progress.requiredSites!.darkBeacon!;
    const station = worldStationById(
      flightStationContext(flight),
      ECONOMY,
      5,
      progress.andromeda!.station!,
    )!;
    const world = flightWorldContext(flight);
    const leg = worldDelta(world, beacon, station);
    const crossing = Math.hypot(leg.x, leg.y) / (baseSpeed * COURIER.speedFraction);
    const objects = flight.objects.slice();
    const economy = structuredClone(model.state.economy);

    flight.time = 0;
    expect(sample(model)).toEqual({ ...worldPoint(world, flight.player, beacon), heading: leg });
    flight.time = crossing;
    const stop = sample(model)!;
    const endpoint = worldPoint(world, flight.player, station);
    expect(stop.x).toBeCloseTo(endpoint.x);
    expect(stop.y).toBeCloseTo(endpoint.y);
    flight.time = crossing * 1.5;
    const returning = sample(model)!;
    expect(returning.heading).toEqual({ x: -leg.x, y: -leg.y });
    flight.time = crossing / 2;
    const outbound = sample(model)!;
    expect(outbound.heading).toEqual(leg);
    expect(outbound.x).toBeCloseTo(returning.x);
    expect(outbound.y).toBeCloseTo(returning.y);
    expect(flight.objects).toEqual(objects);
    expect(model.state.economy).toEqual(economy);
    expect(model.map?.places.some(({ id }) => id === "andromeda:lane-courier")).toBe(false);
    expect(model.state.seenConversations).not.toContain("andromeda:lane-courier:sighted");
  });

  it("restores a pending real sight on Continue and never repeats Pip's line on later visits", () => {
    let model = repairBeacon(launch(301));
    const heard = "andromeda:lane-courier";
    const sighted = "andromeda:lane-courier:sighted";
    const line = "Look. They're using the lane again.";
    const flight = model.state.flight!;
    model.andromedaCourierDisplayed({ ...flight });
    expect(model.state.seenConversations).not.toContain(sighted);
    model.andromedaCourierDisplayed(flight);
    model.andromedaCourierDisplayed(flight);
    expect(model.state.seenConversations.filter((id) => id === sighted)).toHaveLength(1);
    expect(model.state.seenConversations).not.toContain(heard);
    const before = sample(model);
    model = relaunch(CONTENT, model.save());
    expect(sample(model)).toEqual(before);
    endArrivalGrace(model.state.flight!);
    for (let i = 0; i < 240 && model.conversation?.text !== line; i += 1) {
      model.step(0.05, idle);
    }
    expect(model.conversation).toMatchObject({ speaker: "pip", text: line });
    expect(model.state.seenConversations.filter((id) => id === heard)).toHaveLength(1);
    model = relaunch(CONTENT, model.save());
    model.state.flight!.dangerFor = 0;
    model.returnHome();
    readStory(model);
    model.startGalaxy(5);
    expect(sample(model)).not.toBeNull();
    endArrivalGrace(model.state.flight!);
    for (let i = 0; i < 240; i += 1) {
      model.andromedaCourierDisplayed(model.state.flight!);
      model.step(0.05, idle);
      expect(model.conversation?.text).not.toBe(line);
    }
    expect(model.state.seenConversations.filter((id) => id === heard)).toHaveLength(1);
  });
});

describe("mounted Andromeda chapter", () => {
  it.each([0, 3, 4, 5, 6])(
    "answers Use at Pip without advancing an unavailable stage %s",
    (stage) => {
      const model = launch();
      const progress = model.state.progress[5];
      Object.assign(progress, {
        holodisk: stage === 6,
        introduced: stage > 0,
        questComplete: stage === 6,
        stage,
      });
      visit(model, "pip");
      expect(progress.known).toContain("pip");
      expect(model.state.notice).not.toBe("Ask at a settlers’ station about the guide beacons.");
      expect(model.state.notice).not.toBe("Saved to the map. We can come back any time.");
      expect(model.contextAction).toBe("use");
      expect(model.useTarget).toEqual({ action: "use", id: "pip" });
      const before = structuredClone(progress);
      const economy = structuredClone(model.state.economy);
      for (let press = 0; press < 2; press += 1) {
        model.step(0.001, { ...idle, use: true });
        expect(model.state.notice).toBe(
          stage === 0
            ? "Ask at a settlers’ station about the guide beacons."
            : "Saved to the map. We can come back any time.",
        );
        expect(model.state.dialogue).toBeNull();
        expect(progress).toEqual(before);
        expect(model.state.economy).toEqual(economy);
        expect(model.state.tasks[5]).toBeUndefined();
        model.state.notice = "";
      }
    },
  );

  it("answers at a real settlement before the parts are due without creating a quest", () => {
    const model = launch();
    const flight = model.state.flight!;
    const settlement = nearestSettlement(ECONOMY, flight.player);
    flight.player = { x: settlement.x, y: settlement.y };
    model.step(0.001, idle);
    const progress = model.state.progress[5];
    expect(progress.known).toContain(settlement.id);
    expect(model.useTarget).toEqual({ action: "use", id: settlement.id });
    expect(model.contextQuestDetails).toBeNull();
    expect(model.state.notice).not.toBe("Explore the galaxy.");
    const before = structuredClone(progress);
    model.interact();
    expect(model.state.notice).toBe("Explore the galaxy.");
    expect(model.state.dialogue).toBeNull();
    expect(model.state.docked).toBeNull();
    expect(progress).toEqual(before);
  });

  it.each([false, true])("uses the approved Pip introduction after inspection=%s", (inspected) => {
    const model = launch();
    arrival(model);
    if (inspected) {
      visit(model, "darkBeacon");
      expect(model.state.dialogue).toBeNull();
      expect(model.state.progress[5].stage).toBe(1);
      model.interact();
      continuePanel(model, "andromeda:dent");
    }
    visit(model, "pip");
    expect(model.useTarget).toEqual({ action: "talk", id: "pip" });
    model.step(0.001, { ...idle, use: true });
    const panel = model.state.dialogue!;
    const copy = interactionCopy({ galaxy: 5, progress: model.state.progress[5] }, panel);
    expect(copy.party).toBe("Pip");
    expect(copy.lines[0]?.text).toBe(
      inspected
        ? "Pip, did you see the dent in the beacon?"
        : "Pip, do you know what happened to the beacon?",
    );
    expect(copy.topics).toHaveLength(2);
    expect(model.state.progress[5].stage).toBe(inspected ? 2 : 1);
    model.closeInteraction();
    const saved = model.save();
    expect(restoreSave(saved)).not.toBeNull();
    const loaded = relaunch(CONTENT, saved);
    expect(loaded.state.progress[5].stage).toBe(inspected ? 2 : 1);
    loaded.interact();
    expect(loaded.state.dialogue).toEqual(panel);
    continuePanel(loaded, "andromeda:confession");
    expect(loaded.state.progress[5].stage).toBe(3);
    expect(loaded.state.progress[5].andromeda?.station).toMatch(/^station:/u);
    expect(loaded.state.docked).toBeNull();
  });

  it("commits parts, repair and the disk once through real Use and Continue across reload", () => {
    let model = launch();
    model = repairBeacon(model);
    visit(model, "pip");
    expect(model.useTarget).toEqual({ action: "talk", id: "pip" });
    model.step(0.001, { ...idle, use: true });
    continuePanel(model, "andromeda:holodisk");
    expect(model.state.progress[5].holodisk).toBe(true);
    expect(model.state.progress[5].redact?.phase).toBe("active");
    expect(restoreSave(model.save())).not.toBeNull();
    expect(model.state.dialogue?.context).toBe("holodiskMoment");
    readStory(model);
    expect(model.state.dialogue).toBeNull();
    model.returnHome();
    readStory(model);
    expect(model.state.progress[5].resolved).toBe(true);
    const { explored, redact, ...completed } = structuredClone(model.state.progress[5]);
    expect(redact?.phase).toBe("away");
    model.startGalaxy(5);
    visit(model, "pip");
    model.interact();
    const { explored: revisited, redact: resumed, ...story } = model.state.progress[5];
    expect(revisited.slice(0, explored.length)).toEqual(explored);
    expect(revisited).toHaveLength(explored.length + 1);
    expect(story).toEqual(completed);
    expect(model.state.dialogue?.context).toBe("activity:courier");
    expect(resumed).toMatchObject({ phase: "active", site: redact?.site });
  });

  it.each(["defeated", "salvaged"] as const)(
    "reveals the same one relay on %s and retains it for normal chart travel",
    (outcome) => {
      let model = repairBeacon(launch(173));
      let flight = model.state.flight!;
      const { id, relayId, relayLabel } = ANDROMEDA_REDACT;
      const active = model.state.progress[5].redact!;
      const boss = capitalBossActor(flight, id)!;
      expect(boss).toMatchObject({ ...active.site, kind: "enemy", persistent: true });
      expect(boss.routeId).toBeUndefined();
      expect(model.map?.places.find((place) => place.id === id)).toMatchObject({
        ...active.site,
        label: "Broad Wing",
        objective: false,
        optionalEncounter: true,
        travel: true,
      });
      expect(flight.objects.some((object) => object.id === relayId)).toBe(false);
      expect(model.flightLog).toEqual([]);
      model = relaunch(CONTENT, model.save());
      flight = model.state.flight!;
      const retained = capitalBossActor(flight, id)!;
      expect(retained).toEqual(boss);
      expect(model.state.progress[5].redact).toEqual(active);

      flight.player = { x: retained.x + 300, y: retained.y };
      flight.velocity = { x: 0, y: 0 };
      worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
      endArrivalGrace(flight);
      model.step(0.01, idle);
      expect(model.bossHud()).toMatchObject({
        captain: "Captain Redact",
        disabled: false,
        id,
        ship: "Broad Wing",
      });
      const discoveries = model.state.progress[5].discoveries;
      if (outcome === "salvaged") {
        const definition = enemyEquipmentDefinition(5, retained.enemy!);
        for (const part of definition.hardpoints.filter(({ kind }) => kind === "weapon")) {
          retained.enemy = damageEnemy(
            definition,
            { amount: part.hp, hardpointId: part.id },
            retained.enemy!,
          );
        }
        expect(model.bossHud()).toBeNull();
        flight.player = { x: retained.x + CONTENT.tuning.talkRange - 1, y: retained.y };
        expect(model.contextAction).toBe("salvage");
        expect(model.bossHud()).toMatchObject({ disabled: true, id });
        model.interact();
        const rewards = flight.objects.filter(({ role }) => role === "stardust");
        expect(rewards.length).toBeGreaterThan(0);
        model.interact();
        expect(flight.objects.filter(({ role }) => role === "stardust")).toEqual(rewards);
      } else {
        const position = ROUTE_POSITION[5];
        const enemy = retained.enemy!;
        const hull = enemyHull(enemy, position)!;
        const parts = enemy.hardpoints.map(({ id }) => enemyPartOutline(position, enemy, id));
        const impact = worldParts(hull)
          .map((polygon) =>
            polygon.reduce(
              (point, vertex) => ({
                x: point.x + vertex.x / polygon.length,
                y: point.y + vertex.y / polygon.length,
              }),
              { x: retained.x, y: retained.y },
            ),
          )
          .find((point) =>
            parts.every(
              (outline) => !outline || outlineContact(outline, retained, point, 8) === null,
            ),
          );
        expect(impact).toBeDefined();
        const shot = {
          damage: 1000,
          enemy: false,
          hitIds: flight.objects.filter(({ id: other }) => other !== id).map(({ id }) => id),
          id: "redact-hull-hit",
          life: 1,
          piercing: false,
          velocity: { x: 0, y: 0 },
          ...impact!,
        };
        flight.shots.push(shot, { ...shot, id: "redact-second-hit" });
        model.step(0.000001, idle);
        expect(model.flightEvents.filter(({ type }) => type === "enemyDestroyed")).toEqual([
          { id, type: "enemyDestroyed" },
        ]);
      }
      const progress = model.state.progress[5];
      expect(progress).toMatchObject({ holodisk: false, redact: { outcome, phase: "resolved" } });
      expect(model.bossHud()).toBeNull();
      expect(progress.discoveries).toBe(discoveries + 1);
      expect(
        model.flightEvents.filter((event) => event.type === "discovered" && event.id === relayId),
      ).toEqual([{ id: relayId, type: "discovered" }]);
      const waypoint = { ...active.relay, id: relayId };
      const entry = { id: relayId, text: relayLabel, waypoint };
      expect(model.flightLog).toEqual([entry]);
      expect(model.map?.places.filter((place) => place.id === relayId)).toEqual([
        expect.objectContaining({ ...waypoint, label: relayLabel, objective: false, travel: true }),
      ]);
      expect(model.map?.places.some((place) => place.id === id)).toBe(false);

      if (outcome === "salvaged") {
        // The return visit starts with the introductory tutorials already heard.
        for (const id of ["lesson:move", "lesson:aim", "lesson:stardust"] as const) {
          if (!model.state.seenConversations.includes(id)) {
            model.state.seenConversations.push(id);
          }
        }
      }
      model = relaunch(CONTENT, model.save());
      flight = model.state.flight!;
      expect(model.flightLog).toEqual([entry]);
      if (outcome === "salvaged") {
        const world = flightWorldContext(flight);
        flight.player = worldPoint(world, active.relay, {
          x: active.relay.x + 1200,
          y: active.relay.y,
        });
        flight.velocity = { x: 0, y: 0 };
        worldSyncFlightRegion(world, CONTENT, flight);
        const marker = model.targetMarkers(GAME_AREA).find(({ id }) => id === relayId);
        expect(marker).toMatchObject({ id: relayId, identified: true });
        expect(inGameArea(gameAreaPoint(flight.player, marker!))).toBe(false);
        model.flightMarkerShown(marker!);

        visit(model, relayId);
        expect(model.useTarget).toBeUndefined();
        const arrivals = [];
        // Leave the restored reveal in the normal queue and isolate it from passing patrols.
        const quietLimit = CONVERSATION_TUNING.cooldownSeconds * 2 + 5;
        for (let elapsed = 0; elapsed < quietLimit; elapsed += 0.5) {
          flight.objects = flight.objects.filter(({ kind }) => kind !== "enemy");
          flight.shots = flight.shots.filter(({ enemy }) => !enemy);
          flight.dangerFor = 0;
          model.step(0.5, idle);
          const line = model.conversation;
          if (line?.key.startsWith(`poi:arrival:5:${relayId}:`)) {
            arrivals.push({ speaker: line.speaker, text: line.text });
          }
          if (line) {
            model.dismissConversation();
          }
        }
        expect(arrivals).toEqual([
          { speaker: "astra", text: "Saved to the map. We can come back any time." },
        ]);
        expect(model.state.dialogue).toBeNull();
        expect(model.state.docked).toBeNull();
        expect(model.state.progress[5].discoveries).toBe(discoveries + 1);
      }
      flight.dangerFor = 0;
      model.state.economy.stardust = 50;
      expect(model.teleport(relayId)).toBe(true);
      expect(flight.player).toMatchObject(active.relay);
      model.step(0.01, idle);
      expect(model.flightEvents).not.toContainEqual({ id: relayId, type: "discovered" });
      expect(model.state.progress[5].discoveries).toBe(discoveries + 1);
      flight.dangerFor = 0;
      model.returnHome();
      expect(model.state.flight).toBeNull();
      model = new GameModel(CONTENT, () => 301, SAVE_RESTORE, model.save());
      model.startGalaxy(5);
      expect(capitalBossActor(model.state.flight!, id)).toBeUndefined();
      expect(model.flightLog).toEqual([entry]);
      expect(model.map?.places.filter((place) => place.id === relayId)).toHaveLength(1);
      expect(model.state.progress[5].discoveries).toBe(discoveries + 1);
    },
  );

  it("rejects invented settlement targets and a carried chapter item in another galaxy", () => {
    const model = launch();
    const saved = JSON.parse(model.save()) as { progress: Record<number, Record<string, unknown>> };
    saved.progress[5]!.andromeda = { settlement: "settlement:invented" };
    expect(restoreSave(saved)).toBeNull();
    delete saved.progress[5]!.andromeda;
    saved.progress[1]!.questItem = "beaconParts";
    expect(restoreSave(saved)).toBeNull();
  });
});

function routeBeforeWarning(model: GameModel) {
  const flight = model.state.flight!;
  const progress = model.state.progress[5];
  const world = flightWorldContext(flight);
  const leg = courierAmbushLeg(flight, progress)!;
  expect(leg.settlement.id).toBe(progress.andromeda?.settlement);
  expect(world.worldSide).toBe(GALAXY_SIDE);
  const plan = planCourierAmbush(world, leg)!;
  const { forward, warning } = plan;
  Object.assign(flight, {
    facing: forward,
    player: { x: warning.x - forward.x, y: warning.y - forward.y },
    velocity: { x: 0, y: 0 },
  });
  worldSyncFlightRegion(world, CONTENT, flight);
  endArrivalGrace(flight);
  model.step(0.001, idle);
  expect(andromedaCourierAttempt(progress)).toBeUndefined();
  return { flight, leg, plan, progress, world };
}

function crossCourierLine(
  model: GameModel,
  plan: ReturnType<typeof routeBeforeWarning>["plan"],
  line = plan.warning,
) {
  const flight = model.state.flight!;
  const { forward } = plan;
  const world = flightWorldContext(flight);
  const offset = () => {
    const { x, y } = worldDelta(world, line, flight.player);
    return x * forward.x + y * forward.y;
  };
  expect(model.state.dialogue).toBeNull();
  expect(offset()).toBeLessThan(0);
  flight.velocity = { x: forward.x * 240, y: forward.y * 240 };
  for (let step = 0; step < 10 && offset() < 0; step++) {
    model.step(1 / 60, { ...idle, move: forward });
  }
  expect(
    offset(),
    JSON.stringify({ player: flight.player, velocity: flight.velocity, warning: line }),
  ).toBeGreaterThanOrEqual(0);
}

function courierActors(model: GameModel) {
  return stationPopulationObjects(model.state.flight!).filter(({ id }) =>
    id.startsWith(`${COURIER_AMBUSH_ID}:fighter:`),
  );
}

it("reserves Pip's unmodified seeded route and gates the real fighter pairs through Continue", () => {
  let model = acceptCourierLeg(launch(173));
  model.step(0.001, idle);
  const beforeWarning = model.save();
  expect(restoreSave(beforeWarning)).not.toBeNull();
  model = relaunch(CONTENT, beforeWarning);
  const route = routeBeforeWarning(model);
  expect(courierAmbushTerrainCovered({ content: CONTENT, flight: route.flight }, route.plan)).toBe(
    true,
  );
  crossCourierLine(model, route.plan);
  expect(andromedaCourierAttempt(route.progress)?.state).toEqual({ elapsed: 0, phase: "warned" });
  const warningCue = {
    speaker: "astra",
    text: "Fighters on both sides. Keep going toward the settlement.",
  };
  const unheard = relaunch(CONTENT, model.save());
  unheard.step(0.01, idle);
  expect(unheard.conversation).toMatchObject(warningCue);
  expect(model.conversation).toMatchObject(warningCue);
  const heard = relaunch(CONTENT, model.save());
  heard.step(0.01, idle);
  expect(heard.conversation?.text).not.toBe(warningCue.text);
  expect(takeAndromedaCourierWarning(route.flight)).toBeUndefined();
  expect(andromedaCourierMarkers(route.flight)?.escape).toEqual(route.plan.escape);
  const actors = courierActors(model);
  const ids = actors.map(({ id }) => id);
  expect(actors).toHaveLength(4);
  expect(new Set(actors.map(({ enemy }) => enemy?.packId)).size).toBe(2);
  expect(ids.map((id) => andromedaCourierActor(route.flight, id))).toEqual([
    "held",
    "held",
    "held",
    "held",
  ]);

  const hit = actors[0]!;
  hit.enemy = damageEnemy(
    enemyEquipmentDefinition(5, hit.enemy!),
    { amount: 1, hardpointId: null },
    hit.enemy!,
  );
  hit.hp = hit.enemy.hp;
  const { forward, warning } = route.plan;
  route.flight.player = { x: warning.x + 525 * forward.x, y: warning.y + 525 * forward.y };
  route.flight.velocity = { x: 0, y: 0 };
  worldSyncFlightRegion(route.world, CONTENT, route.flight);
  model.step(0.1, idle);
  expect(courierActors(model).every(({ enemy }) => !enemy?.engaged)).toBe(true);
  expect(route.flight.shots.some(({ enemy }) => enemy)).toBe(false);
  expect(hit.enemy.hp).toBe(hit.hp);
  model.step(2.88, idle);
  const placement = questGuardPlacementContext(CONTENT, route.flight);
  const scenery = () =>
    route.flight.objects.filter(
      (object) => object.hp > 0 && (object.kind === "rock" || object.kind === "debris"),
    );
  const blocks = (
    object: ReturnType<typeof scenery>[number],
    from: { x: number; y: number },
    to: { x: number; y: number },
    width = 0,
  ) =>
    worldSceneryBlocksSegment(
      route.world,
      object,
      from,
      worldPoint(route.world, from, to),
      width,
      placement.frameOf(object),
      placement.drawnOf(object),
    );
  const occluded = (actor: (typeof actors)[number], player = route.flight.player) =>
    scenery().some((object) => blocks(object, actor, player));
  const present = courierActors(model);
  const [lead, wing] = present;
  const pairCentre = { x: (lead!.x + wing!.x) / 2, y: (lead!.y + wing!.y) / 2 };
  const viewpoints = [180, 240, 320, 430, 540].flatMap((radius) =>
    Array.from({ length: 24 }, (_, index) => {
      const angle = (index * Math.PI) / 12;
      return {
        x: pairCentre.x + radius * Math.cos(angle),
        y: pairCentre.y + radius * Math.sin(angle),
      };
    }),
  );
  const inRange = (actor: (typeof actors)[number], point: { x: number; y: number }) => {
    const distance = worldDistance(route.world, actor, point);
    return distance > 75 && distance < enemyEquipmentDefinition(5, actor.enemy!).perception;
  };
  const free = (point: { x: number; y: number }) =>
    !scenery().some((object) => blocks(object, point, point, CONTENT.tuning.flight.shipRadius));
  // Start within the existing wing fighter's sight range, with an actual solid rock in the way.
  const blindApproach = viewpoints.find(
    (point) =>
      inRange(wing!, point) &&
      scenery().some((object) => object.kind === "rock" && blocks(object, wing!, point)) &&
      free(point),
  );
  expect(blindApproach, "a flyable approach occluded by seeded terrain").toBeDefined();
  route.flight.player = blindApproach!;
  route.flight.velocity = { x: 0, y: 0 };
  worldSyncFlightRegion(route.world, CONTENT, route.flight);
  model.step(0.03, idle);
  model.step(0.02, idle);
  const firstRelease = ["released", "released", "held", "held"];
  expect(ids.map((id) => andromedaCourierActor(route.flight, id))).toEqual(firstRelease);
  expect(wing!.enemy?.engaged).toBe(false);
  expect(inRange(wing!, route.flight.player)).toBe(true);
  expect(occluded(wing!)).toBe(true);

  // Choose a nearby clear point from the live chart while both pairs remain in sight range.
  const approach = viewpoints.find(
    (point) =>
      present.every((actor) => inRange(actor, point) && !occluded(actor, point)) && free(point),
  );
  expect(approach, "a clear approach within perception of both pairs").toBeDefined();
  route.flight.player = approach!;
  route.flight.velocity = { x: 0, y: 0 };
  worldSyncFlightRegion(route.world, CONTENT, route.flight);
  for (const actor of courierActors(model)) {
    const definition = enemyEquipmentDefinition(5, actor.enemy!);
    expect(worldDistance(route.world, actor, route.flight.player)).toBeLessThan(
      definition.perception,
    );
    expect(occluded(actor)).toBe(false);
  }
  model.step(1 / 60, idle);
  expect(ids.map((id) => andromedaCourierActor(route.flight, id))).toEqual(firstRelease);
  expect(courierActors(model).map(({ enemy }) => enemy?.engaged)).toEqual([
    true,
    true,
    false,
    false,
  ]);
  const casualty = actors[1]!;
  worldRecordObjectRemoval(route.world, CONTENT, casualty, route.flight);
  route.flight.objects = route.flight.objects.filter(({ id }) => id !== casualty.id);
  // Fly out of active cells while keeping the normal persistent records for this flight.
  route.flight.player = { x: 70_000, y: 80_000 };
  route.flight.velocity = { x: 0, y: 0 };
  worldSyncFlightRegion(route.world, CONTENT, route.flight);
  expect(route.flight.objects.some(({ id }) => ids.includes(id))).toBe(false);
  expect(ids.map((id) => andromedaCourierActor(route.flight, id))).toEqual([
    "released",
    "released",
    "held",
    "held",
  ]);

  const saved = model.save();
  expect(restoreSave(saved)).not.toBeNull();
  model = relaunch(CONTENT, saved);
  const resumed = model.state.flight!;
  expect(takeAndromedaCourierWarning(resumed)).toBeUndefined();
  expect(andromedaCourierMarkers(resumed)?.escape).toEqual(route.plan.escape);
  expect(resumed.world.notables[casualty.id]).toBeNull();
  expect(courierActors(model).map(({ id }) => id)).toEqual([ids[0], ids[2], ids[3]]);
  expect(resumed.world.notables[hit.id]?.enemy?.hp).toBe(hit.hp);
  model.step(1.21, idle);
  expect(ids.map((id) => andromedaCourierActor(resumed, id))).toEqual([
    "released",
    "released",
    "released",
    "released",
  ]);

  const { escape } = route.plan;
  resumed.player = { x: escape.to.x - forward.x, y: escape.to.y - forward.y };
  worldSyncFlightRegion(route.world, CONTENT, resumed);
  crossCourierLine(model, route.plan, escape.to);
  expect(andromedaCourierMarkers(resumed)).toBeNull();
  expect(ids.map((id) => andromedaCourierActor(resumed, id))).toEqual([
    "ended",
    "ended",
    "ended",
    "ended",
  ]);
  const returned = resumed.objects.find(({ id }) => id === hit.id)!;
  expect(returned.enemy?.hp).toBe(hit.hp);
  returned.enemy!.engaged = true;
  returned.enemy!.lastSeen = { ...resumed.player };
  model.step(0.03, idle);
  expect(returned.enemy?.engaged).toBe(false);
  expect(returned.enemy?.lastSeen).toBeNull();
  visit(model, route.leg.settlement.id);
  expect(model.contextAction).toBe("talk");
  model.interact();
  continuePanel(model, "andromeda:parts");
  expect(model.state.progress[5]).toMatchObject({ questItem: "beaconParts", stage: 5 });
  expect(andromedaCourierMarkers(resumed)).toBeNull();
  expect(ids.map((id) => andromedaCourierActor(resumed, id))).toEqual([
    "ended",
    "ended",
    "ended",
    "ended",
  ]);
});

it("keeps a blocked seeded leg open and refuses to spend another attempt after Continue", () => {
  const previsitedBlockers = new Set<string>();
  const launched = launch(3);
  let model = acceptCourierLeg(launched, (flight, stationId) => {
    const player = { ...flight.player };
    const station = flight.objects.find(({ id }) => id === stationId)!;
    const settlement = nearestSettlement(ECONOMY, station);
    const world = flightWorldContext(flight);
    const plan = planCourierAmbush(world, { settlement, station })!;
    const represented = new Set(stationPopulationObjects(flight).map(({ id }) => id));
    // Visit during normal flight before accepting Pip's delivery or reserving its terrain.
    launched.closeInteraction();
    flight.player = { ...plan.warning };
    flight.velocity = { x: 0, y: 0 };
    launched.step(0.001, idle);
    const { from, halfWidth, to } = plan.escape;
    const end = worldPoint(world, from, to);
    for (const rock of flight.objects) {
      if (rock.kind !== "rock" || rock.hp <= 0 || represented.has(rock.id)) {
        continue;
      }
      const point = worldPoint(world, from, rock);
      const nearest = closestOnSegment(point, from, end);
      if (
        Math.hypot(point.x - nearest.x, point.y - nearest.y) <
        halfWidth + placementRadius(rock)
      ) {
        previsitedBlockers.add(rock.id);
      }
    }
    expect(previsitedBlockers.size).toBeGreaterThan(0);
    flight.player = player;
    expect(launched.reopenInteraction()).toBe(true);
  });
  const route = routeBeforeWarning(model);
  expect(courierAmbushTerrainCovered({ content: CONTENT, flight: route.flight }, route.plan)).toBe(
    true,
  );
  crossCourierLine(model, route.plan);
  expect(route.flight.objects.some(({ hp, id }) => hp > 0 && previsitedBlockers.has(id))).toBe(
    true,
  );
  const skipped = andromedaCourierAttempt(route.progress);
  expect(skipped?.state.phase).toBe("skipped");
  expect(courierActors(model)).toEqual([]);
  expect(takeAndromedaCourierWarning(route.flight)).toBeUndefined();
  const saved = model.save();
  expect(restoreSave(saved)).not.toBeNull();
  model = relaunch(CONTENT, saved);
  const retry = model.state.flight!;
  const { forward, warning } = route.plan;
  retry.player = { x: warning.x - forward.x, y: warning.y - forward.y };
  crossCourierLine(model, route.plan);
  expect(andromedaCourierAttempt(model.state.progress[5])).toEqual(skipped);
  expect(courierActors(model)).toEqual([]);
  expect(takeAndromedaCourierWarning(retry)).toBeUndefined();
  visit(model, route.leg.settlement.id);
  expect(model.contextAction).toBe("talk");
  model.interact();
  continuePanel(model, "andromeda:parts");
  expect(model.state.progress[5]).toMatchObject({ questItem: "beaconParts", stage: 5 });
});
