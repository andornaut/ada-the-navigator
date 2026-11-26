import { expect, it } from "vitest";

import { CARTWHEEL_CLAIM, CARTWHEEL_CLAIM_CUES } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import type { ConversationLine } from "../data/conversations.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { visitCartwheelHubFixture } from "../testing/cartwheelFixture.ts";
import { readStory, relaunch } from "../testing/launch.ts";
import { capitalBossActor } from "./capitalBossEncounter.ts";
import { outlineContact, worldParts } from "./convex.ts";
import { enemyStardust } from "./drops.ts";
import { damageEnemy } from "./enemyAi.ts";
import { enemyHull, enemyPartOutline } from "./enemyBody.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldSyncFlightRegion } from "./geography.ts";
import { ORE_FIELD_ROLE, worldOreFieldsNear } from "./oreFields.ts";
import { restoreSave } from "./save.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const { id } = CARTWHEEL_CLAIM;

function flyTo(model: GameModel, { x, y }: Vec): void {
  const flight = model.state.flight!;
  flight.player = { x, y };
  flight.velocity = { x: 0, y: 0 };
  worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
}

function beginClaim(): GameModel {
  const seeds = [173, 301];
  const model = new GameModel(CONTENT, () => seeds.shift() ?? 503);
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 3, 4, 5, 2];
  model.state.progress[2].opened = true;
  model.startGalaxy(2);
  const hub = visitCartwheelHubFixture(CONTENT, model);
  const flight = model.state.flight!;
  const progress = model.state.progress[2];
  expect(progress.stage).toBe(1);
  model.choose("continue");
  expect(progress.claim).toBeUndefined();
  const [first, second] = CONTENT.tuning.miningMilestones;
  flight.cargo = first;
  model.interact();
  model.choose("continue");
  expect(progress.stage).toBe(2);
  expect(progress.claim).toBeUndefined();
  const blocked = flight.storyScene!;
  flight.time = blocked.at + CARTWHEEL_STORY_SHIPS.scenes.blocked.duration;
  model.step(0.001, idle);
  model.choose("continue");

  flyTo(model, hub);
  flight.cargo = second - first;
  model.interact();
  model.choose("continue");
  expect(progress.deposited).toBe(second);
  expect(progress.claim).toBeUndefined();
  expect(model.map?.places.some((place) => place.id === id)).toBe(false);

  const miner = flight.objects.find((object) => object.id === "miner")!;
  flyTo(model, miner);
  model.step(0.001, idle);
  model.interact();
  expect(model.state.dialogue?.context).toBe("miner");
  expect(progress.stage).toBe(3);
  expect(progress.claim?.phase).toBe("active");
  model.choose("continue");
  expect(model.map?.places.find((place) => place.id === id)).toMatchObject({
    ...progress.claim!.site,
    label: "Outrigger Carrier",
    objective: false,
    travel: false,
  });
  return model;
}

function fieldRocks(flight: FlightState, fieldId: string): SpaceObject[] {
  return flight.objects.filter(
    (object) => object.role === ORE_FIELD_ROLE && object.id.startsWith(`${fieldId}:`),
  );
}

function stardustDropped(flight: FlightState): number {
  return flight.objects
    .filter(({ role }) => role === "stardust")
    .reduce((amount, object) => amount + (object.amount ?? 0), 0);
}

function hearCue(model: GameModel, cue: ConversationLine): void {
  for (let beat = 0; beat < 8 && model.conversation?.text !== cue.text; beat++) {
    model.dismissConversation();
    model.step(0.001, idle);
  }
  expect(model.conversation).toMatchObject(cue);
}

function hullImpact(actor: SpaceObject): Vec {
  const position = ROUTE_POSITION[2];
  const enemy = actor.enemy!;
  const parts = enemy.hardpoints.map(({ id }) => enemyPartOutline(position, enemy, id));
  const point = worldParts(enemyHull(enemy, position)!)
    .map((polygon) =>
      polygon.reduce(
        (point, vertex) => ({
          x: point.x + vertex.x / polygon.length,
          y: point.y + vertex.y / polygon.length,
        }),
        { x: actor.x, y: actor.y },
      ),
    )
    .find((point) =>
      parts.every((part) => !part || outlineContact(part, actor, point, 8) === null),
    );
  expect(point).toBeDefined();
  return point!;
}

it.each(["defeated", "salvaged"] as const)(
  "opens the same canonical Cartwheel field once when Claim is %s and preserves ordinary mining",
  (outcome) => {
    let model = beginClaim();
    const claim = model.state.progress[2].claim!;
    const field = worldOreFieldsNear(
      flightWorldContext(model.state.flight!),
      2,
      1,
      claim.fieldSite,
    )[0]!;
    expect(field).toMatchObject({ ...claim.fieldSite, guard: null, id: claim.fieldId });
    const active = capitalBossActor(model.state.flight!, id)!;
    expect(active.routeId).toBeUndefined();
    flyTo(model, field);
    model.step(0.01, idle);
    expect(fieldRocks(model.state.flight!, field.id)).toEqual([]);
    expect(restoreSave(model.save())?.progress[2].claim).toEqual(claim);
    model = relaunch(CONTENT, model.save());
    expect(capitalBossActor(model.state.flight!, id)).toEqual(active);

    const beforeReturn = capitalBossActor(model.state.flight!, id);
    model.state.flight!.dangerFor = 0;
    model.returnHome();
    expect(model.state.progress[2].claim?.phase).toBe("away");
    model = new GameModel(CONTENT, () => 503, model.save());
    model.startGalaxy(2);
    expect(model.state.progress[2].claim).toEqual(claim);
    expect(capitalBossActor(model.state.flight!, id)).toEqual(beforeReturn);

    const flight = model.state.flight!;
    flyTo(model, field);
    model.step(0.01, idle);
    expect(fieldRocks(flight, field.id)).toEqual([]);
    const actor = capitalBossActor(flight, id)!;
    flyTo(model, { x: actor.x + 300, y: actor.y });
    endArrivalGrace(flight);
    model.step(0.01, idle);
    expect(model.bossHud()).toMatchObject({ captain: "Captain Claim", disabled: false, id });
    hearCue(model, CARTWHEEL_CLAIM_CUES.approach);
    const milestone = outcome === "salvaged" ? { firstHardpointLost: true as const } : {};

    if (outcome === "salvaged") {
      const definition = enemyEquipmentDefinition(2, actor.enemy!);
      const mount = definition.hardpoints.find(({ kind }) => kind === "weapon")!;
      const outline = enemyPartOutline(ROUTE_POSITION[2], actor.enemy!, mount.id)!;
      const polygon = worldParts(outline)[0]!;
      const point = polygon.reduce(
        (point, vertex) => ({
          x: point.x + vertex.x / polygon.length,
          y: point.y + vertex.y / polygon.length,
        }),
        { x: actor.x, y: actor.y },
      );
      flight.shots.push({
        ...point,
        damage: mount.hp,
        enemy: false,
        hitIds: flight.objects.filter((object) => object !== actor).map(({ id }) => id),
        id: "claim-first-hardpoint",
        life: 1,
        piercing: false,
        velocity: { x: 0, y: 0 },
      });
      model.step(0.000001, idle);
      expect(model.flightEvents).toContainEqual({ id, type: "enemyFirstHardpointLost" });
      hearCue(model, CARTWHEEL_CLAIM_CUES.hardpoint);
      for (const part of definition.hardpoints.filter(({ kind }) => kind === "weapon")) {
        actor.enemy = damageEnemy(
          definition,
          { amount: part.hp, hardpointId: part.id },
          actor.enemy!,
        );
      }
      expect(model.bossHud()).toBeNull();
      flyTo(model, { x: actor.x + CONTENT.tuning.talkRange - 1, y: actor.y });
      expect(model.bossHud()).toMatchObject({ disabled: true, id });
      const expected = Math.floor(enemyStardust({ id, seed: flight.seed }, "capital") / 2);
      const oldStardust = stardustDropped(flight);
      model.interact();
      expect(stardustDropped(flight) - oldStardust).toBe(expected);
      model.interact();
      expect(stardustDropped(flight) - oldStardust).toBe(expected);
    } else {
      const shot = {
        damage: 1000,
        enemy: false,
        hitIds: flight.objects.filter((object) => object !== actor).map(({ id }) => id),
        id: "claim-hull-hit",
        life: 1,
        piercing: false,
        velocity: { x: 0, y: 0 },
        ...hullImpact(actor),
      };
      flight.shots.push(shot, { ...shot, id: "claim-second-hit" });
      model.step(0.000001, idle);
      expect(model.flightEvents.filter(({ type }) => type === "enemyDestroyed")).toEqual([
        { id, type: "enemyDestroyed" },
      ]);
    }
    expect(model.state.progress[2].claim).toEqual({
      ...claim,
      ...milestone,
      outcome,
      phase: "resolved",
    });
    expect(model.bossHud()).toBeNull();
    expect(model.map?.places.find((place) => place.id === field.id)).toMatchObject({
      ...claim.fieldSite,
      label: CARTWHEEL_CLAIM.fieldLabel,
      objective: false,
      travel: false,
    });
    expect(model.state.progress[2].holodisk).toBe(false);
    hearCue(model, CARTWHEEL_CLAIM_CUES.resolved);

    flyTo(model, { x: field.x, y: field.y });
    model.step(0.01, idle);
    const rocks = fieldRocks(flight, field.id);
    expect(rocks.length).toBeGreaterThan(0);
    for (const rock of rocks) {
      const index = Number(rock.id.split(":").at(-1));
      expect(rock).toMatchObject(field.rocks[index]!);
    }
    const rock = rocks[0]!;
    flight.shots.push({
      damage: 1000,
      enemy: false,
      hitIds: flight.objects.filter((other) => other !== rock).map(({ id }) => id),
      id: "mine-open-field",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
      x: rock.x,
      y: rock.y,
    });
    model.step(0.01, idle);
    expect(model.flightEvents).toContainEqual(
      expect.objectContaining({ id: rock.id, type: "asteroidDestroyed" }),
    );
    expect(flight.objects.some(({ role }) => role === "cargo")).toBe(true);

    flight.dangerFor = 0;
    model.returnHome();
    model = new GameModel(CONTENT, () => 907, model.save());
    model.startGalaxy(2);
    expect(capitalBossActor(model.state.flight!, id)).toBeUndefined();
    expect(model.state.progress[2].claim).toEqual({
      ...claim,
      ...milestone,
      outcome,
      phase: "resolved",
    });
    flyTo(model, field);
    model.step(0.01, idle);
    expect(fieldRocks(model.state.flight!, field.id).length).toBeGreaterThan(0);
  },
);

it("keeps buying and inserting Cartwheel's disk independent of an unresolved Claim", () => {
  const model = beginClaim();
  const progress = model.state.progress[2];
  const flight = model.state.flight!;
  const visit = (id: string) => {
    const object = flight.objects.find((object) => object.id === id)!;
    flyTo(model, object);
    model.step(0.001, idle);
    model.interact();
  };
  flight.freshDistance =
    CONTENT.tuning.introFreshDistance + 4 * CONTENT.tuning.encounterFreshDistance;
  model.step(0.001, idle);
  visit("visitors");
  expect(model.state.dialogue?.context).toBe("visitors");
  model.choose("continue");
  expect(progress.stage).toBe(4);
  flight.cargo = CONTENT.tuning.miningMilestones[2] - progress.deposited;
  visit("hub");
  model.choose("continue");
  expect(progress.questComplete).toBe(true);
  const scene = flight.storyScene!;
  flight.time = scene.at + CARTWHEEL_STORY_SHIPS.scenes.docking.duration;
  model.step(0.001, idle);
  for (let page = 0; page < 4 && model.state.dialogue; page++) {
    model.choose("continue");
  }
  visit("hub");
  expect(model.state.docked).toBe("hub");
  model.state.economy.stardust = HOLODISKS.hubPrice;
  expect(model.buy({ kind: "holodisk" })).toEqual({ kind: "bought", price: HOLODISKS.hubPrice });
  readStory(model);
  expect(progress.holodisk).toBe(true);
  expect(progress.claim?.phase).toBe("active");
});
