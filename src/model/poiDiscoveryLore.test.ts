import { seededRandom } from "@andornaut/game-kit/runtime/random";
import { expect, it } from "vitest";

import { ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { CONVERSATION_TUNING, CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { LANDMARK_KINDS } from "../data/jobs.ts";
import { poiAmbientLine, poiApproachPool, poiDiscoveryPool } from "../data/poiDiscoveryLore.ts";
import deck from "../data/poiFlavourCopy.json";
import { SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, relaunch, supportEntropy } from "../testing/launch.ts";
import { worldNearestSettlerStation } from "./andromedaPlaces.ts";
import {
  ConversationDirector,
  type ConversationFacts,
  pennyInstance,
  pennyPoints,
} from "./conversations.ts";
import { GAME_AREA, gameAreaPoint, inGameArea } from "./edgeMarkers.ts";
import { damageEnemy } from "./enemyAi.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { ensureDestination, ensureStation } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { galaxyRoute, GameModel } from "./game.ts";
import { worldSyncFlightRegion } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { flightLandmarkSites, landmarkSites } from "./landmarks.ts";
import { stardustPickupReach } from "./pickupBody.ts";
import { ambientSecondThread } from "./poiDiscourse.ts";
import { retainedLandmarkSites } from "./retainedLandmarks.ts";
import { discoveryStardustId } from "./stardustPlacement.ts";
import { flightStationContext, worldStationsNear } from "./stations.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

const facts: ConversationFacts = {
  aimed: false,
  capitalInSight: false,
  collectedStardust: false,
  docked: false,
  dronesNear: false,
  encounters: [],
  frigateInSight: false,
  guardCues: [],
  heavyDisabled: false,
  holodisks: 0,
  inCurrent: false,
  inDanger: false,
  jobMoments: [],
  lostItemNear: null,
  moved: false,
  newStation: false,
  newlyMapped: [],
  pennyPoints: [],
  shieldFraction: 1,
  stardustInSight: false,
  stationsDiscovered: [],
  stationsNear: [],
};

it("binds all authored pools to the exact established identities and their two distinct lines", () => {
  let pools = 0;
  for (const galaxy of GALAXY_NUMBERS) {
    const copy = deck[galaxy];
    const sites = retainedLandmarkSites(galaxy);
    expect(Object.keys(copy.namedLandmark).sort()).toEqual(sites.map(({ id }) => id).sort());
    expect(Object.keys(copy.generatedLandmark).sort()).toEqual([...LANDMARK_KINDS].sort());
    const story = new Set(galaxyRoute(galaxy));
    if (galaxy === 3 || galaxy === 4) {
      story.add("holodisk");
    }
    // Needle practice and the Eye are both authored scene destinations.
    if (galaxy === 4) {
      story.add("needlePractice");
    }
    if (galaxy === 5) {
      story.add(ANDROMEDA_PLACES.settlement);
    }
    expect(new Set(Object.keys(copy.storyPlace))).toEqual(story);
    for (const { id, kind, name } of sites) {
      const variants = poiDiscoveryPool(galaxy, { id, kind: "landmark", symbol: kind });
      const candidate = (
        copy.namedLandmark as Record<
          string,
          {
            nameKey: string;
            variants: readonly unknown[];
          }
        >
      )[id]!;
      expect(candidate.nameKey).toBe(name);
      expect(variants.map(({ lines }) => lines[0])).toEqual(candidate.variants);
      expect(new Set(variants.map(({ lines }) => lines[0]?.text)).size).toBe(2);
    }
    for (const symbol of LANDMARK_KINDS) {
      const variants = poiDiscoveryPool(galaxy, { id: "generated", kind: "landmark", symbol });
      expect(variants.map(({ lines }) => lines[0])).toEqual(copy.generatedLandmark[symbol]);
    }
    for (const id of story) {
      expect(
        poiDiscoveryPool(galaxy, { id, kind: "storyPlace" }).map(({ lines }) => lines[0]),
      ).toEqual((copy.storyPlace as Record<string, unknown>)[id]);
    }
    for (const kind of ["station", "cache"] as const) {
      expect(poiDiscoveryPool(galaxy, { kind }).map(({ lines }) => lines[0])).toEqual(copy[kind]);
    }
    pools += sites.length + LANDMARK_KINDS.length + story.size + 2;
  }
  expect(pools).toBe(121);
  expect(poiDiscoveryPool(1, { id: "family", kind: "storyPlace" })).toEqual([]);
  expect(poiDiscoveryPool(1, { id: "constructor", kind: "storyPlace" })).toEqual([]);
});

function newFlight() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.achievements.unlocked.push("newNavigator");
  model.state.progress[1].opened = true;
  model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  model.startGalaxy(1);
  playOpening(model);
  const flight = model.state.flight!;
  const target = retainedLandmarkSites(1)[0]!;
  const arrival = { ...flight.player };
  flight.player = { x: target.x, y: target.y };
  return { arrival, model, target };
}

function settleUnrelatedCues(model: GameModel) {
  const flight = model.state.flight!;
  const progress = model.state.progress[flight.galaxy];
  const nearby = pennyPoints(
    progress,
    false,
    flightLandmarkSites(flight),
    flight,
    flight.topology?.side,
  );
  model.state.seenConversations.push(...nearby.map((id) => pennyInstance(flight.galaxy, id)));
}

function clearFixtureThreats(model: GameModel) {
  const flight = model.state.flight!;
  const danger = flight.objects.filter((object) => object.kind === "enemy");
  for (const { id } of danger) {
    flight.world.notables[id] = null;
  }
  flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
  flight.shots = flight.shots.filter((shot) => !shot.enemy);
  flight.dangerFor = 0;
}

/**
 * Steps idle play for `seconds`, collecting each line. Each step first clears the threats and
 * the rocks and debris the previous step generated: no line depends on scenery, and each step
 * would otherwise resolve Ada and every moving piece against all of it.
 */
function hear(model: GameModel, seconds = CONVERSATION_TUNING.cooldownSeconds + 1) {
  settleUnrelatedCues(model);
  const played = [];
  const steps = Math.ceil(seconds / 0.05);
  for (let index = 0; index < steps; index++) {
    clearFixtureThreats(model);
    const flight = model.state.flight!;
    flight.objects = flight.objects.filter(
      (object) => object.kind !== "rock" && object.kind !== "debris",
    );
    model.step(0.05, idle);
    if (model.conversation) {
      played.push(model.conversation.text);
      model.dismissConversation();
    }
  }
  return played;
}

it("uses the real Scan outcome, following the unchanged receipt, without repeating on Continue", () => {
  const { model, target } = newFlight();
  expect(model.contextAction).toBe("scan");
  const before = model.state.economy.stardust;
  model.interact();
  const [outcome] = model.drainScanOutcomes();
  expect(outcome?.targetId).toBe(target.id);
  expect(model.conversation?.text).toBe(`Scan complete: ${outcome!.target.name}.`);
  expect(model.conversation?.discoveryFadeEnd).toBeUndefined();
  model.dismissConversation();
  model.dismissNotice();
  const variants = poiDiscoveryPool(1, { id: target.id, kind: "landmark", symbol: target.kind });
  const words = variants.map(({ lines }) => lines[0]!.text);
  const played = hear(model);
  expect(
    played.filter((line) => words.includes(line)),
    JSON.stringify(played),
  ).toHaveLength(1);
  expect(model.state.economy.stardust).toBe(before);
  const resumed = relaunch(CONTENT, model.save());
  expect(resumed.state.progress[1].charted).toContain(target.id);
  resumed.markerTargetDisplayed(target.id);
  expect(hear(resumed, 1).filter((line) => words.includes(line))).toEqual([]);
});

it("identifies a rendered landmark once, without charting it or repeating its lore after Scan", () => {
  const { model, target } = newFlight();
  const variants = poiDiscoveryPool(1, { id: target.id, kind: "landmark", symbol: target.kind });
  const words = variants.map(({ lines }) => lines[0]!.text);
  model.pennyNoticeDisplayed(`penny:1:${target.id}:0`);
  expect(model.state.progress[1].charted).toEqual([]);
  model.markerTargetDisplayed("unknown:landmark");
  model.markerTargetDisplayed(target.id);
  model.markerTargetDisplayed(target.id);
  const played = hear(model);
  expect(
    played.filter((line) => words.includes(line)),
    JSON.stringify(played),
  ).toHaveLength(1);
  expect(model.state.progress[1].charted).toEqual([]);
  expect(landmarkSites(1).map(({ id }) => id)).toContain(target.id);
  model.state.flight!.player = { x: target.x, y: target.y };
  expect(model.contextAction).toBe("scan");
  model.interact();
  expect(model.drainScanOutcomes()).toHaveLength(1);
  model.dismissConversation();
  model.dismissNotice();
  expect(hear(model).filter((line) => words.includes(line))).toEqual([]);
});

it("uses the existing conversation shuffle to choose both variants across independent seeds", () => {
  const slot = retainedLandmarkSites(1)[0]!;
  const expected = deck[1].namedLandmark["landmark:1:0"].variants;
  expect(slot.id).toBe("landmark:1:0");
  const picked = new Set<string>();
  for (const seed of [1, 17, 149, 2027, 11801, 803550167]) {
    const talk = new ConversationDirector([], [], seededRandom(seed));
    talk.beginFlight(1);
    expect(talk.poiDiscovered({ id: slot.id, kind: "landmark", symbol: slot.kind })).toBe(true);
    talk.step(0.05, null, facts);
    const line = talk.showing?.line.text;
    expect(expected.map(({ text }) => text)).toContain(line);
    picked.add(line!);
  }
  expect(picked.size).toBe(2);
});

it("binds a confirmed friendly station discovery to its galaxy pool and leaves returns alone", () => {
  const { model } = newFlight();
  const flight = model.state.flight!;
  const site = worldStationsNear(flightStationContext(flight), ECONOMY, 1, 25000, {
    x: 0,
    y: 0,
  })[0]!;
  expect(ensureStation(CONTENT, site.id, flight)?.id).toBe(site.id);
  flight.player = { x: site.x + ECONOMY.station.discoveryRadius - 30, y: site.y };
  expect(model.state.progress[1].stations).not.toContain(site.id);
  const words = deck[1].station.map(({ text }) => text);
  const played = hear(model, 10);
  expect(
    played.filter((line) => words.includes(line)),
    JSON.stringify(played),
  ).toHaveLength(1);
  expect(model.state.progress[1].stations).toContain(site.id);
  expect(hear(model, 1).filter((line) => words.includes(line))).toEqual([]);
});

it("deduplicates visible legacy and bundled caches by group, with no marker, reward or survey write", () => {
  const { arrival, model } = newFlight();
  model.state.flight!.player = arrival;
  const marker = structuredClone(model.state.progress[1].markerKnowledge);
  const stardust = model.state.economy.stardust;
  const words = deck[1].cache.map(({ text }) => text);
  const groups = ["chunk:0,1:2", "chunk:1,0:4"];
  for (const [index, group] of groups.entries()) {
    const amount = index === 0 ? 1 : ECONOMY.discoveryStardust;
    model.state.flight!.objects.push({
      amount,
      hp: 1,
      id: discoveryStardustId(group, index === 0 ? 1 : 0),
      kind: "pickup",
      radius: stardustPickupReach(ECONOMY.stardustPickupRadius, amount),
      role: "stardust",
      x: arrival.x + 300 + index * 100,
      y: arrival.y,
    });
    model.discoveryCacheDisplayed(group);
    model.discoveryCacheDisplayed(group);
  }
  model.discoveryCacheDisplayed("chunk:1,0:99");
  const received = hear(model, CONVERSATION_TUNING.cooldownSeconds + 1);
  expect(received.filter((line) => words.includes(line))).toHaveLength(2);
  expect(new Set(received.filter((line) => words.includes(line))).size).toBe(2);
  expect(model.state.progress[1].markerKnowledge).toEqual(marker);
  expect(model.state.progress[1].charted).toEqual([]);
  expect(model.state.economy.stardust).toBe(stardust);
});

it("queues Whirlpool holodisk lore only for the loaded body without recovering it", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 3];
  model.state.achievements.unlocked.push("newNavigator");
  model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  model.state.progress[1].holodisk = true;
  model.startGalaxy(3);
  playOpening(model);
  Object.assign(model.state.progress[3], {
    introduced: true,
    known: ["whale", "family"],
    stage: 5,
  });
  const words = deck[3].storyPlace.holodisk.map(({ text }) => text);
  model.markerTargetDisplayed("holodisk");
  expect(hear(model, 0.05).filter((line) => words.includes(line))).toEqual([]);
  const progress = model.state.progress[3];
  progress.questComplete = true;
  model.step(0.05, idle);
  const flight = model.state.flight!;
  const site = progress.requiredSites!.holodisk!;
  flight.player = { x: site.x + 300, y: site.y };
  worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
  expect(model.map?.places.find(({ id }) => id === "holodisk")).toMatchObject(site);
  expect(flight.objects.some(({ id }) => id === "holodisk")).toBe(false);
  model.markerTargetDisplayed("holodisk");
  settleUnrelatedCues(model);
  model.step(0.05, idle);
  expect(words).not.toContain(model.conversation?.text);
  expect(progress.sounder?.phase).toBe("active");
  const sounder = stationPopulationObjects(flight).find(
    ({ id }) => id === WHIRLPOOL_CAPITAL_BOSS.id,
  )!;
  const definition = enemyEquipmentDefinition(3, sounder.enemy!);
  for (const part of definition.hardpoints.filter(({ kind }) => kind === "weapon")) {
    sounder.enemy = damageEnemy(
      definition,
      { amount: part.hp, hardpointId: part.id },
      sounder.enemy!,
    );
  }
  expect(sounder.enemy?.disabled).toBe(true);
  model.step(0.05, idle);
  expect(progress.sounder).toEqual({ outcome: "disabled", phase: "resolved" });
  const disk = flight.objects.find(({ id }) => id === "holodisk");
  expect(disk).toMatchObject({ ...site, kind: "destination" });
  model.markerTargetDisplayed("holodisk");
  model.markerTargetDisplayed("holodisk");
  expect(hear(model).filter((line) => words.includes(line))).toHaveLength(1);
  expect(model.state.progress[3].holodisk).toBe(false);
});

it("distinguishes an actually displayed Penny cue from a silent point passed during her rest", () => {
  const penny = CONVERSATIONS.find(({ trigger }) => trigger.kind === "penny")!;
  const heard: string[] = [];
  const talk = new ConversationDirector([penny], heard);
  talk.beginFlight(1);
  talk.step(0.05, null, { ...facts, pennyPoints: ["spoken"] });
  expect(talk.heardPennyPoint("spoken")).toBe(false);
  expect(talk.showing?.instance).toBe(pennyInstance(1, "spoken"));
  expect(talk.heardPennyPoint("spoken")).toBe(true);
  talk.step(0.05, null, { ...facts, pennyPoints: ["spoken", "passed"] });
  expect(heard).toContain(pennyInstance(1, "passed"));
  expect(talk.heardPennyPoint("passed")).toBe(false);
});

it("allows a closing, already sensed target without revealing its identity and expires on reversal", () => {
  const { model, target } = newFlight();
  const flight = model.state.flight!;
  model.state.seenConversations.push(`poi:heard:${pennyInstance(1, target.id)}`);
  const point = { x: target.x - 1200, y: target.y };
  flight.player = point;
  flight.velocity = { x: 0, y: 0 };
  // Page this actual neighbourhood and finish any first warnings before the controlled approach.
  hear(model, CONVERSATION_TUNING.cooldownSeconds + 2);
  flight.player = point;
  flight.velocity = { x: -180, y: 0 };
  const lines = poiApproachPool(1, "unknown").map(({ lines }) => lines[0]!.text);
  clearFixtureThreats(model);
  model.step(0.05, idle);
  expect(lines).not.toContain(model.conversation?.text);
  flight.velocity = { x: 180, y: 0 };
  clearFixtureThreats(model);
  model.step(0.05, idle);
  expect(lines).toContain(model.conversation?.text);
  const approach = model.conversation?.key;
  expect(approach).toContain(target.id);
  expect(model.state.progress[1].charted).not.toContain(target.id);

  flight.velocity = { x: -180, y: 0 };
  expect(lines).not.toContain(model.conversation?.text);
  flight.velocity = { x: 180, y: 0 };
  const continued = relaunch(CONTENT, model.save());
  settleUnrelatedCues(continued);
  clearFixtureThreats(continued);
  continued.step(0.05, idle);
  expect(continued.conversation?.key).not.toBe(approach);
});

it("distinguishes displayed Scan instruction from fulfilling it before it is heard", () => {
  const lesson = CONVERSATIONS.find(
    ({ trigger }) => trigger.kind === "lesson" && trigger.lesson === "scan",
  )!;
  const heard: string[] = [];
  const talk = new ConversationDirector([lesson], heard);
  talk.beginFlight(1);
  talk.requestScanLesson();
  talk.step(0.05, null, facts);
  expect(talk.heardScanLesson).toBe(false);
  expect(talk.showing?.instance).toBe("lesson:scan");
  expect(talk.heardScanLesson).toBe(true);

  const completedEarly = new ConversationDirector([lesson], []);
  completedEarly.beginFlight(1);
  completedEarly.completeScanLesson();
  completedEarly.requestScanLesson();
  completedEarly.step(0.05, null, facts);
  expect(completedEarly.showing).toBeNull();
  expect(completedEarly.heardScanLesson).toBe(false);
});

it("prioritizes a receipt over an interrupted approach and discards a context that expired", () => {
  const talk = new ConversationDirector([], []);
  talk.beginFlight(1);
  let closing = true;
  const seen = { instance: "test:exact-target", kind: "unknown" as const, relevant: () => closing };
  talk.step(0.05, null, { ...facts, poiApproach: seen });
  expect(talk.showing?.instance).toBe(seen.instance);
  talk.scanOutcome({
    completions: [],
    galaxy: 1,
    source: "scan",
    target: { id: "test", name: "Test landmark", symbol: "beacon" },
    targetId: "test",
  });
  expect(talk.showing?.line.text).toBe("Scan complete: Test landmark.");
  closing = false;
  talk.advance();
  talk.step(0.05, null, facts);
  expect(talk.showing).toBeNull();
});

it("delivers distinct mixed confirmation events in order without starting a new cooldown between them", () => {
  const talk = new ConversationDirector([], []);
  talk.beginFlight(1);
  talk.step(0.05, null, {
    ...facts,
    poiConfirmations: [
      { cue: { id: "station:1,2", kind: "station" } },
      { cue: { id: "growers", kind: "storyPlace" } },
      { cue: { id: "station:2,3", kind: "station" } },
    ],
  });
  const instances = [];
  for (let i = 0; i < 3; i++) {
    instances.push(talk.showing?.instance);
    talk.advance();
    talk.step(0.05, null, facts);
  }
  expect(instances).toEqual([
    "poi:1:station:station:1,2",
    "poi:1:storyPlace:growers",
    "poi:1:station:station:2,3",
  ]);
});

it("uses the existing quiet window, and revalidates speculative and known wording when covered", () => {
  const talk = new ConversationDirector([], []);
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  const progress = model.state.progress[1];
  const poiAmbient = () => {
    const second = ambientSecondThread(1, progress);
    return second === undefined ? undefined : poiAmbientLine(1, second);
  };
  talk.beginFlight(1);
  talk.step(CONVERSATION_TUNING.quietSeconds, null, { ...facts, poiAmbient });
  expect(talk.showing).toBeNull();
  progress.known.push("growers");
  talk.step(CONVERSATION_TUNING.quietSeconds - 0.05, null, { ...facts, poiAmbient });
  expect(talk.showing).toBeNull();
  talk.step(0.05, null, { ...facts, poiAmbient });
  expect(talk.showing?.line).toEqual(poiAmbientLine(1, false).lines[0]);

  progress.known.push("workshop");
  expect(talk.showing).toBeNull();
  talk.step(CONVERSATION_TUNING.quietSeconds, null, { ...facts, poiAmbient });
  expect(talk.showing?.line).toEqual({
    speaker: "ada",
    text: "The growers and the workshop both have their own way of solving things.",
  });
  talk.advance();
  expect(talk.showing?.line).toEqual({
    speaker: "ada",
    text: "I wonder what they'd make if they shared a bench.",
  });
});

it("uses only recorded chapter or map facts for each ambient anchor and second thread", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  const p = model.state.progress;
  for (const galaxy of GALAXY_NUMBERS) {
    expect(ambientSecondThread(galaxy, p[galaxy])).toBeUndefined();
  }
  p[2].stations.push("hub");
  p[3].introduced = true;
  p[4].needle = { ...p[4].needle!, met: true };
  p[5].stage = 3;
  p[6].known.push("phantomSettlement3");
  for (const galaxy of [2, 3, 4, 5, 6] as const) {
    expect(ambientSecondThread(galaxy, p[galaxy])).toBe(false);
  }
  p[2].known.push("miner");
  p[3].known.push("family");
  p[4].known.push("needlePractice");
  p[5].known.push("darkBeacon");
  p[6].known.push("phantomSettlement2");
  for (const galaxy of [2, 3, 4, 5, 6] as const) {
    expect(ambientSecondThread(galaxy, p[galaxy])).toBe(true);
  }
});

function moveTo(model: GameModel, point: { x: number; y: number }): void {
  const flight = model.state.flight!;
  flight.player = { ...point };
  flight.velocity = { x: 0, y: 0 };
  worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
  clearFixtureThreats(model);
}

function markUnknownPoi(model: GameModel, id: string, point: { x: number; y: number }) {
  const flight = model.state.flight!;
  moveTo(model, { x: point.x - 1200, y: point.y });
  const otherPoints = pennyPoints(
    model.state.progress[flight.galaxy],
    false,
    flightLandmarkSites(flight),
    flight,
    flight.topology?.side,
  ).filter((other) => other !== id);
  model.state.seenConversations.push(
    ...otherPoints.map((other) => pennyInstance(flight.galaxy, other)),
  );
  model.step(0.05, idle);
  const line = model.conversation;
  expect(line?.key).toBe(`${pennyInstance(flight.galaxy, id)}:0`);
  model.pennyNoticeDisplayed(line!.key);
  const marker = model.targetMarkers(GAME_AREA).find((candidate) => candidate.id === id);
  expect(marker).toMatchObject({ id, identified: false, x: point.x, y: point.y });
  expect(inGameArea(gameAreaPoint(flight.player, marker!))).toBe(false);
  model.dismissConversation();
  return marker!;
}

function showMarker(model: GameModel, id: string): void {
  const marker = model.targetMarkers(GAME_AREA).find((candidate) => candidate.id === id);
  expect(marker?.id).toBe(id);
  model.flightMarkerShown(marker!);
}

it("guides a sensed Pip arrival before introduction and inspection without taking an action", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.achievements.unlocked.push("newNavigator");
  model.state.unlocked.push(5);
  model.state.progress[5].opened = true;
  model.state.seenConversations.push(
    ...CONVERSATIONS.filter(({ trigger }) => trigger.kind !== "penny").map(({ id }) => id),
  );
  model.startGalaxy(5);
  const flight = model.state.flight!;
  const pip =
    flight.world.notables[ANDROMEDA_PLACES.pip] ??
    flight.objects.find(({ id }) => id === ANDROMEDA_PLACES.pip)!;
  expect(pip).toMatchObject({ id: "pip", kind: "destination" });
  const projected = markUnknownPoi(model, pip.id, pip);

  const beforeIntro = "Ask at a settlers’ station about the guide beacons.";
  const beforeInspection = "Check the dark guide beacon first.";
  const near = { x: pip.x + 80, y: pip.y };
  moveTo(model, near);
  model.markerTargetDisplayed(pip.id);
  expect(hear(model)).not.toContain(beforeIntro);

  moveTo(model, { x: pip.x - 1200, y: pip.y });
  showMarker(model, projected.id);
  moveTo(model, near);
  model.step(0.05, idle);
  moveTo(model, { x: pip.x - 400, y: pip.y });
  expect(hear(model)).not.toContain(beforeIntro);

  moveTo(model, near);
  expect(hear(model).filter((line) => line === beforeIntro)).toEqual([beforeIntro]);
  expect(model.state.progress[5]).toMatchObject({ introduced: false, questItem: null, stage: 0 });
  expect(model.state.docked).toBeNull();
  expect(model.state.dialogue).toBeNull();
  expect(model.state.tasks[5]).toBeUndefined();
  expect(model.contextAction).toBe("use");
  expect(model.state.notice).toBe("");
  expect(hear(model)).not.toContain(beforeIntro);
  model.interact();
  expect(model.state.notice).toBe(beforeIntro);
  expect(model.state.dialogue).toBeNull();

  const station = worldNearestSettlerStation(flightStationContext(flight), ECONOMY, flight.player);
  ensureStation(CONTENT, station.id, flight);
  moveTo(model, station);
  model.step(0.001, idle);
  expect(model.state.dialogue).toBeNull();
  expect(model.state.progress[5].stage).toBe(0);
  expect(hear(model)).toContain("A traveler! Be careful. One of our guide beacons has gone dark.");
  model.interact();
  expect(model.state.dialogue).toBeNull();
  expect(model.state.docked).toBe(station.id);
  const wick = model.stationTalk?.panel;
  expect(wick?.context).toBe("andromeda:arrival");
  model.chooseStationTalk(wick!, "continue");
  model.undock();
  expect(model.state.progress[5]).toMatchObject({ introduced: true, stage: 1 });

  moveTo(model, { x: pip.x - 1200, y: pip.y });
  showMarker(model, pip.id);
  moveTo(model, near);
  model.markerTargetDisplayed(pip.id);
  expect(hear(model).filter((line) => line === beforeInspection)).toEqual([beforeInspection]);
  expect(model.state.progress[5].stage).toBe(1);
  expect(model.state.dialogue).toBeNull();
  expect(model.useTarget).toEqual({ action: "talk", id: pip.id });

  const beacon =
    flight.objects.find(({ id }) => id === ANDROMEDA_PLACES.beacon) ??
    flight.world.notables[ANDROMEDA_PLACES.beacon];
  expect(beacon).toMatchObject({ id: "darkBeacon", kind: "destination" });
  moveTo(model, beacon!);
  model.step(0.05, idle);
  expect(model.state.dialogue).toBeNull();
  expect(model.state.progress[5].stage).toBe(1);
  expect(hear(model)).toContain(
    "This beacon isn't shot. It's dented, like something bumped into it.",
  );
  model.interact();
  expect(model.state.dialogue?.context).toBe("andromeda:dent");
  expect(model.conversation).toBeNull();
  model.choose("continue");
  expect(model.state.progress[5].stage).toBe(2);

  moveTo(model, { x: pip.x - 1200, y: pip.y });
  showMarker(model, pip.id);
  moveTo(model, near);
  const eligible = model.objective;
  expect(eligible).toBe("Talk with Pip.");
  expect(hear(model).filter((line) => line === eligible)).toEqual([eligible]);
  expect(model.state.progress[5].stage).toBe(2);
  model.interact();
  expect(model.state.dialogue?.context).toBe("andromeda:confession");
  model.choose("continue");
  expect(model.state.progress[5].stage).toBe(3);

  const saved = model.save();
  const continued = relaunch(CONTENT, saved);
  expect(continued.state.progress[5]).toMatchObject({ introduced: true, stage: 3 });
  moveTo(continued, { x: pip.x - 1200, y: pip.y });
  showMarker(continued, pip.id);
  moveTo(continued, near);
  const currentObjective = continued.objective;
  const arrival = hear(continued);
  expect(arrival.filter((line) => line === currentObjective)).toEqual([currentObjective]);
  expect(arrival).not.toContain(beforeIntro);
  expect(arrival).not.toContain(beforeInspection);
});

it("uses an identified landmark's spoken discovery for its first approach and speaks again on reentry", () => {
  const { model, target } = newFlight();
  const words = poiDiscoveryPool(1, { id: target.id, kind: "landmark", symbol: target.kind }).map(
    ({ lines }) => lines[0]!.text,
  );
  model.flightMarkerShown(markUnknownPoi(model, target.id, target));
  moveTo(model, target);
  model.markerTargetDisplayed(target.id);
  const arrival = hear(model).filter((line) => words.includes(line));
  expect(arrival).toHaveLength(1);
  expect(hear(model).filter((line) => words.includes(line))).toEqual([]);
  const outside = { x: target.x + 400, y: target.y };
  moveTo(model, outside);
  model.step(0.001, idle);
  moveTo(model, target);
  expect(hear(model).filter((line) => words.includes(line))).toHaveLength(1);
  expect(model.state.progress[1].charted).not.toContain(target.id);
  expect(model.drainScanOutcomes()).toEqual([]);
});

it("reuses station discovery and non-Pip destination dialogue for shown physical markers", () => {
  const { model } = newFlight();
  const flight = model.state.flight!;
  const site = worldStationsNear(flightStationContext(flight), ECONOMY, 1, 25000, {
    x: 0,
    y: 0,
  })[0]!;
  const station = ensureStation(CONTENT, site.id, flight)!;
  model.flightMarkerShown(markUnknownPoi(model, station.id, station));
  moveTo(model, { x: station.x + 130, y: station.y });
  expect(
    hear(model).filter((line) => deck[1].station.some(({ text }) => text === line)),
  ).toHaveLength(1);
  expect(model.state.docked).toBeNull();

  const growers = ensureDestination(CONTENT, "growers", flight)!;
  expect(growers).toMatchObject({ id: "growers", kind: "destination" });
  // Known destinations get their own authored lines even when their marker is station-like.
  model.state.progress[1].known.push(growers.id);
  moveTo(model, { x: growers.x - 1200, y: growers.y });
  showMarker(model, growers.id);
  moveTo(model, { x: growers.x + 100, y: growers.y });
  const words = deck[1].storyPlace.growers.map(({ text }) => text);
  model.step(0.05, idle);
  expect(model.state.dialogue?.context).toBe("grower");
  expect(model.conversation).toBeNull();
  model.choose("continue");
  expect(hear(model).filter((line) => words.includes(line))).toEqual([]);

  moveTo(model, { x: growers.x - 1200, y: growers.y });
  model.step(0.05, idle);
  moveTo(model, { x: growers.x + 100, y: growers.y });
  expect(hear(model).filter((line) => words.includes(line))).toHaveLength(1);
  expect(model.state.dialogue).toBeNull();
});
