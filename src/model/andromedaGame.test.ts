import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { BUILT, GALAXY_NUMBERS, ROUTE_POSITION } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { readStory, relaunch } from "../testing/launch.ts";
import { nearestSettlerStation } from "./andromedaPlaces.ts";
import { ANDROMEDA_REDACT, andromedaRedactEligible } from "./andromedaRedact.ts";
import { capitalBossActor } from "./capitalBossEncounter.ts";
import { interactionCopy } from "./conversations.ts";
import { outlineContact, worldParts } from "./convex.ts";
import { damageEnemy } from "./enemyAi.ts";
import { enemyHull, enemyPartOutline } from "./enemyBody.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { ensureStation } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldSyncFlightRegion } from "./geography.ts";
import { restoreSave } from "./save.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

// Exercise the staged runtime through its real model without promoting the production roster.
const built = BUILT as Set<GalaxyNumber>;
beforeAll(() => built.add(5));
afterAll(() => built.delete(5));

function launch(seed?: number): GameModel {
  const model = new GameModel(CONTENT, undefined, seed === undefined ? undefined : () => seed);
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
  const station = nearestSettlerStation(ECONOMY, flight.player);
  ensureStation(CONTENT, station.id, flight);
  visit(model, station.id);
  if (!model.state.dialogue) {
    model.interact();
  }
  continuePanel(model, "andromeda:arrival");
  expect(model.state.docked).toBeNull();
}

function repairBeacon(initial: GameModel): GameModel {
  let model = initial;
  arrival(model);
  visit(model, "pip");
  model.interact();
  continuePanel(model, "andromeda:confession");
  const station = model.state.progress[5].andromeda!.station!;
  visit(model, station);
  expect(model.contextAction).toBe("talk");
  model.interact();
  continuePanel(model, "andromeda:ownsUp");
  const settlement = model.state.progress[5].andromeda!.settlement!;
  expect(settlement).toMatch(/^settlement:/u);
  expect(settlement).not.toBe(station);
  visit(model, settlement);
  expect(model.contextAction).toBe("deliver");
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

describe("mounted Andromeda chapter", () => {
  it.each([false, true])("uses the approved Pip introduction after inspection=%s", (inspected) => {
    const model = launch();
    arrival(model);
    if (inspected) {
      visit(model, "darkBeacon");
      continuePanel(model, "andromeda:dent");
    }
    visit(model, "pip");
    model.interact();
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
    model.interact();
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
    const { redact, ...completed } = structuredClone(model.state.progress[5]);
    expect(redact?.phase).toBe("away");
    model.startGalaxy(5);
    visit(model, "pip");
    model.interact();
    const { redact: resumed, ...story } = model.state.progress[5];
    expect(story).toEqual(completed);
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
        travel: false,
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

      model = relaunch(CONTENT, model.save());
      flight = model.state.flight!;
      expect(model.flightLog).toEqual([entry]);
      flight.dangerFor = 0;
      model.teleport(relayId);
      expect(flight.player).toMatchObject(active.relay);
      model.step(0.01, idle);
      expect(model.flightEvents).not.toContainEqual({ id: relayId, type: "discovered" });
      expect(model.state.progress[5].discoveries).toBe(discoveries + 1);
      flight.dangerFor = 0;
      model.returnHome();
      expect(model.state.flight).toBeNull();
      model = new GameModel(CONTENT, model.save(), () => 301);
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
