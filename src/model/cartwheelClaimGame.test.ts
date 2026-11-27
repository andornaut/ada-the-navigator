import { expect, it } from "vitest";

import { CARTWHEEL_CLAIM, CARTWHEEL_CLAIM_CUES } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { type ConversationLine, CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { poiDiscoveryPool } from "../data/poiDiscoveryLore.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import {
  completeCartwheelHubIntroductionFixture,
  visitCartwheelHubFixture,
} from "../testing/cartwheelFixture.ts";
import { readStory, relaunch } from "../testing/launch.ts";
import { capitalBossActor } from "./capitalBossEncounter.ts";
import { pennyInstance, pennyPoints } from "./conversations.ts";
import { outlineContact, worldParts } from "./convex.ts";
import { enemyStardust } from "./drops.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { damageEnemy } from "./enemyAi.ts";
import { enemyHull, enemyPartOutline } from "./enemyBody.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { ensureStation } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldSyncFlightRegion } from "./geography.ts";
import { flightLandmarkSites } from "./landmarks.ts";
import { ORE_FIELD_ROLE, worldOreFieldsNear } from "./oreFields.ts";
import { flightStationContext, worldStationsNear } from "./stations.ts";
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
  const model = new GameModel(CONTENT, () => seeds.shift() ?? 503, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 3, 4, 5, 2];
  model.state.progress[2].opened = true;
  model.startGalaxy(2);
  const hub = visitCartwheelHubFixture(CONTENT, model);
  const flight = model.state.flight!;
  const progress = model.state.progress[2];
  completeCartwheelHubIntroductionFixture(model);
  expect(progress.stage).toBe(1);
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
    optionalEncounter: true,
    travel: true,
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

function shootMount(flight: FlightState, actor: SpaceObject, hardpointId: string, damage: number) {
  const outline = enemyPartOutline(ROUTE_POSITION[2], actor.enemy!, hardpointId)!;
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
    damage,
    enemy: false,
    hitIds: flight.objects.filter((object) => object !== actor).map(({ id }) => id),
    id: `claim-hit:${hardpointId}`,
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
  });
}

it.each(["stern-left", "stern-right"])(
  "reports the actual %s Mine Layer loss and lets the other mount lay mines",
  (side) => {
    const model = beginClaim();
    const flight = model.state.flight!;
    const actor = capitalBossActor(flight, id)!;
    flyTo(model, { x: actor.x + 300, y: actor.y });
    endArrivalGrace(flight);
    model.step(0.01, idle);
    hearCue(model, CARTWHEEL_CLAIM_CUES.approach);
    const mount = (key: string) => actor.enemy!.hardpoints.find(({ id }) => id === key)!;
    const remaining = side === "stern-left" ? "stern-right" : "stern-left";
    const before = mount(side).hp;
    const oldMine = {
      age: 1,
      damage: 3,
      id: "already-laid",
      ownerId: id,
      x: actor.x,
      y: actor.y + 200,
    };
    flight.mines = [oldMine];

    shootMount(flight, actor, side, 1);
    model.step(0.000001, idle);
    expect(mount(side).hp).toBe(before - 1);
    expect(model.flightEvents.some(({ type }) => type === "enemyMineLayerDisabled")).toBe(false);
    shootMount(flight, actor, side, before);
    model.step(0.000001, idle);
    expect(model.flightEvents).toContainEqual({
      hardpointId: side,
      id,
      type: "enemyMineLayerDisabled",
    });
    expect(mount(side).hp).toBe(0);
    expect(mount(remaining).hp).toBeGreaterThan(0);
    expect(model.state.progress[2].claim?.phase).toBe("active");
    hearCue(model, CARTWHEEL_CLAIM_CUES.mineLayer);
    expect(flight.mines.find(({ id }) => id === oldMine.id)).toMatchObject({
      damage: oldMine.damage,
      ownerId: id,
      x: oldMine.x,
      y: oldMine.y,
    });
    expect(flight.mines.find(({ id }) => id === oldMine.id)?.end).toBeUndefined();

    const existing = new Set(flight.mines.map(({ id }) => id));
    for (const part of actor.enemy!.hardpoints) {
      part.cooldown = part.id === side || part.id === remaining ? 0 : 10;
    }
    model.step(0.01, idle);
    expect(mount(side).cooldown).toBe(0);
    expect(mount(remaining).cooldown).toBeGreaterThan(1);
    expect(flight.mines.filter(({ id }) => !existing.has(id))).toHaveLength(1);
    expect(model.flightEvents.some(({ type }) => type === "enemyMineLayerDisabled")).toBe(false);
  },
);

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
    model = new GameModel(CONTENT, () => 503, SAVE_RESTORE, model.save());
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
      shootMount(flight, actor, mount.id, mount.hp);
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
      shootMount(flight, actor, "stern-left", 1000);
      flight.shots.push(shot, { ...shot, id: "claim-second-hit" });
      model.step(0.000001, idle);
      expect(model.flightEvents).toContainEqual({
        hardpointId: "stern-left",
        id,
        type: "enemyMineLayerDisabled",
      });
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
      travel: true,
    });
    expect(model.state.progress[2].holodisk).toBe(false);
    hearCue(model, CARTWHEEL_CLAIM_CUES.resolved);
    if (outcome === "defeated") {
      model.dismissConversation();
      model.step(0.001, idle);
      expect(model.conversation?.text).not.toBe(CARTWHEEL_CLAIM_CUES.mineLayer.text);
      expect(model.state.seenConversations).not.toContain(`${id}:mineLayer:stern-left`);
    }

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
    model = new GameModel(CONTENT, () => 907, SAVE_RESTORE, model.save());
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

it("hosts the authored docking exchange in station Talk through replay and Continue", () => {
  let model = beginClaim();
  let flight = model.state.flight!;
  const goTo = (id: string) => {
    const object = flight.objects.find((object) => object.id === id)!;
    flyTo(model, object);
  };
  flight.freshDistance =
    CONTENT.tuning.introFreshDistance + 4 * CONTENT.tuning.encounterFreshDistance;
  model.step(0.001, idle);
  goTo("visitors");
  model.step(0.001, idle);
  model.interact();
  expect(model.state.dialogue?.context).toBe("visitors");
  model.choose("continue");
  goTo("hub");
  expect(model.state.progress[2].stage).toBe(4);
  // Read the earlier blocked-approach reaction before asserting ordinary Dock readiness.
  for (let step = 0; step < 40 && flight.storyScene?.lineDue; step++) {
    if (model.conversation) {
      model.dismissConversation();
    }
    model.step(0.05, idle);
  }
  expect(flight.storyScene).toMatchObject({ id: "blocked", lineDue: false });
  expect(model.contextAction).toBe("dock");
  const finalDeposit = CONTENT.tuning.miningMilestones[2];
  flight.cargo = finalDeposit - model.state.progress[2].deposited;
  expect(model.contextAction).toBe("deposit");
  model.interact();
  expect(model.state.dialogue?.context).toBe("deposit");
  expect(model.state.progress[2]).toMatchObject({
    deposited: finalDeposit,
    questComplete: true,
    stage: 5,
  });
  model.choose("continue");

  const scene = flight.storyScene!;
  const { duration } = CARTWHEEL_STORY_SHIPS.scenes.docking;
  expect(scene).toEqual({ at: flight.time, id: "docking", lineDue: true });
  const money = model.state.economy.stardust;
  flight.time = scene.at + duration / 2;
  model.step(0.001, idle);
  expect(model.contextAction).toBeUndefined();
  model.interact();
  expect(model.state.dialogue).toBeNull();

  model = relaunch(CONTENT, model.save());
  flight = model.state.flight!;
  expect(flight.storyScene).toEqual(scene);
  expect(model.contextAction).toBeUndefined();
  flight.dangerFor = 0;
  model.returnHome();
  expect(model.state.progress[2].replayScene).toBe("docking");

  model = new GameModel(CONTENT, () => 907, SAVE_RESTORE, model.save());
  model.startGalaxy(2);
  flight = model.state.flight!;
  expect(model.state.progress[2].replayScene).toBe("docking");
  goTo("hub");
  expect(flight.storyScene).toBeUndefined();
  expect(model.contextAction).toBeUndefined();
  model.interact();
  expect(model.state.docked).toBeNull();
  model.step(0.001, idle);
  let replay = flight.storyScene!;
  expect(replay).toEqual({ at: flight.time, id: "docking", lineDue: true });
  expect(model.state.progress[2].replayScene).toBeUndefined();

  flight.time = replay.at + duration - 0.001;
  expect(model.contextAction).toBeUndefined();
  model.step(0.002, idle);
  expect(model.state.dialogue).toBeNull();
  expect(flight.storyScene).toBe(replay);
  expect(replay.lineDue).toBe(true);
  expect(model.contextAction).toBe("talk");

  const other = worldStationsNear(
    flightStationContext(flight),
    ECONOMY,
    2,
    40_000,
    flight.player,
  ).find(
    (site) =>
      Math.hypot(site.x - flight.player.x, site.y - flight.player.y) > 2 * CONTENT.tuning.talkRange,
  )!;
  const station = ensureStation(CONTENT, other.id, flight)!;
  model.state.progress[2].stations.push(other.id);
  flyTo(model, { x: station.x + 1200, y: station.y });
  // Continue clears transient chatter from the Hub; keep unrelated lessons spent.
  model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  model = relaunch(CONTENT, model.save());
  flight = model.state.flight!;
  replay = flight.storyScene!;
  const marker = model.targetMarkers(GAME_AREA).find(({ id }) => id === other.id);
  expect(marker?.id).toBe(other.id);
  model.flightMarkerShown(marker!);
  flyTo(model, { x: station.x + 100, y: station.y });
  const sensed = pennyPoints(
    model.state.progress[2],
    false,
    flightLandmarkSites(flight),
    flight,
    flight.topology?.side,
  );
  model.state.seenConversations.push(...sensed.map((id) => pennyInstance(2, id)));
  const arrivalKey = `poi:arrival:2:${other.id}:0`;
  model.step(0.05, idle);
  expect(model.conversation).toMatchObject({
    ...poiDiscoveryPool(2, { id: other.id, kind: "station" })[0]!.lines[0],
    key: arrivalKey,
  });
  expect(replay.lineDue).toBe(true);
  expect(model.state.dialogue).toBeNull();
  expect(model.state.docked).toBeNull();
  flight.dangerFor = 0;
  expect(model.contextAction).toBe("dock");
  model.interact();
  expect(model.state.docked).toBe(other.id);
  expect(model.state.dialogue).toBeNull();
  expect(replay.lineDue).toBe(true);
  model.undock();

  goTo("hub");
  flight.cargo = 2;
  expect(model.contextAction).toBe("deposit");
  model.interact();
  expect(model.state.dialogue?.context).toBe("deposit");
  model.choose("continue");
  expect(model.state.progress[2].deposited).toBe(finalDeposit + 2);
  expect(model.contextAction).toBe("talk");

  model = relaunch(CONTENT, model.save());
  flight = model.state.flight!;
  const time = flight.time;
  model.step(0.002, idle);
  expect(flight.time).toBeGreaterThan(time);
  expect(model.state.dialogue).toBeNull();
  expect(model.contextAction).toBe("talk");
  model.step(0.001, { ...idle, use: true });
  expect(model.state.docked).toBe("hub");
  expect(model.state.dialogue).toBeNull();
  expect(model.stationServices).toMatchObject({
    equipment: true,
    exchange: true,
    jobs: true,
    weaponsAmmo: true,
  });
  const start = model.stationTalk!.panel!;
  expect(start).toMatchObject({
    context: "approach",
    text: CONTENT.chapters[2]!.dialogue.approach!.text,
  });
  expect(model.stationTalk?.panel).toBe(start);
  expect(model.shopGroups()).toBeDefined();
  expect(model.jobBoard().length).toBeGreaterThan(0);
  expect(model.stationTalk?.panel).toBe(start);
  expect(flight.storyScene?.talkPage).toBeUndefined();

  const oldSave = relaunch(CONTENT, model.save());
  expect(oldSave.state.dialogue).toBeNull();
  expect(oldSave.stationTalk?.panel).toEqual(start);
  model.chooseStationTalk(start, "continue");
  const narration = model.stationTalk!.panel!;
  expect(narration).toMatchObject({
    context: "approachDocking",
    text: CONTENT.chapters[2]!.dialogue.approachDocking!.text,
  });
  expect(model.state.dialogue).toBeNull();
  expect(flight.storyScene).toMatchObject({ lineDue: true, talkPage: "approachDocking" });
  model.chooseStationTalk(start, "continue");
  expect(model.stationTalk?.panel).toBe(narration);

  const saved = model.saveDocument();
  expect(restoreSave(saved)?.flight?.storyScene).toEqual(flight.storyScene);
  for (const bad of [
    { ...saved.flight!.storyScene, talkPage: "other" },
    { ...saved.flight!.storyScene, talkPage: "approach" },
    { ...saved.flight!.storyScene, lineDue: false },
    { ...saved.flight!.storyScene, id: "blocked" },
    { ...saved.flight!.storyScene, at: flight.time },
  ]) {
    expect(restoreSave({ ...saved, flight: { ...saved.flight, storyScene: bad } })).toBeNull();
  }

  model = relaunch(CONTENT, saved);
  flight = model.state.flight!;
  expect(model.state.docked).toBe("hub");
  expect(model.state.dialogue).toBeNull();
  expect(model.stationTalk?.panel).toEqual(narration);
  model.undock();
  expect(model.stationTalk).toBeNull();
  expect(model.contextAction).toBe("talk");
  model.interact();
  expect(model.stationTalk?.panel).toEqual(narration);
  expect(model.stationTalk?.panel).not.toBe(narration);

  model.chooseStationTalk(model.stationTalk!.panel!, "continue");
  const thanks = model.stationTalk!.panel!;
  expect(thanks).toMatchObject({
    context: "approachThanks",
    text: CONTENT.chapters[2]!.dialogue.approachThanks!.text,
  });
  expect(relaunch(CONTENT, model.save()).stationTalk?.panel).toEqual(thanks);
  model.chooseStationTalk(thanks, "continue");
  model.chooseStationTalk(thanks, "continue");
  expect(model.state.dialogue).toBeNull();
  expect(model.stationTalk?.panel).toBeNull();
  expect(flight.storyScene?.lineDue).toBe(false);
  expect(flight.storyScene?.talkPage).toBeUndefined();
  expect(model.state.economy.stardust).toBe(money);
  expect(model.state.progress[2]).toMatchObject({
    deposited: finalDeposit + 2,
    questComplete: true,
    stage: 5,
  });

  model.undock();
  expect(model.contextAction).toBe("dock");
  model.interact();
  expect(model.state.docked).toBe("hub");
  expect(model.stationTalk?.panel).toBeNull();
  model.state.economy.stardust = HOLODISKS.hubPrice;
  expect(model.buy({ kind: "holodisk" })).toEqual({ kind: "bought", price: HOLODISKS.hubPrice });
  readStory(model);
  expect(model.state.progress[2].holodisk).toBe(true);
  expect(model.state.progress[2].claim?.phase).toBe("active");
});
