import { describe, expect, it } from "vitest";

import { WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { BUILT } from "../data/galaxies.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import type { GalaxyNumber, GameContent } from "../data/types.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { playOpening, readStory, relaunch, supportEntropy } from "../testing/launch.ts";
import {
  activateRequiredRoute,
  ensureDestination,
  routeBlocked,
  routeGuardPlanResult,
} from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldSyncFlightRegion } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { shipTouches } from "./shipBody.ts";
import type { FlightState, GalaxyProgress } from "./types.ts";
import { noLevels, shipTuning } from "./upgrades.ts";

/** Test support: admit the saved required encounter, then disable its actual noncombat-fixture guard. */
function disableStoryGuard(content: GameContent, flight: FlightState, id: string): void {
  const encounter = activateRequiredRoute(content, id, flight);
  if (encounter.status === "resolved") {
    return;
  }
  if (encounter.status !== "created" && encounter.status !== "existing") {
    throw new Error(`Expected the saved required guard for ${id}, got ${encounter.status}`);
  }
  const guard = encounter.guard;
  if (guard.routeId !== id || guard.enemy?.archetype !== "frigate") {
    throw new Error(`Expected the actual required frigate for ${id}`);
  }
  guard.enemy.disabled = true;
}

/** Resolve the actual capital via a lethal hull shot through the production event path. */
function defeatHolodiskGuard(model: GameModel): void {
  const flight = model.state.flight!;
  const leader = stationPopulationObjects(flight).find(
    ({ id }) => id === WHIRLPOOL_CAPITAL_BOSS.id,
  )!;
  expect(leader.enemy?.archetype).toBe("capital");
  flight.player = { x: leader.x + 300, y: leader.y };
  flight.velocity = { x: 0, y: 0 };
  worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
  endArrivalGrace(flight);
  flight.shots.push({
    damage: 1000,
    enemy: false,
    hitIds: [],
    id: "sounder-hull-shot",
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
    x: leader.x,
    y: leader.y,
  });
  model.step(0.01, idle);
  expect(model.flightEvents).toContainEqual({ id: leader.id, type: "enemyDestroyed" });
  expect(model.state.progress[3].sounder).toEqual({ outcome: "defeated", phase: "resolved" });
}

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const inserted = [
  "Ada slides the holodisk into Astra's drive.",
  "Memory restored. I've found new coordinates.",
];
/** Astra's first three memory lines: the Nth holodisk inserted plays the Nth. */
const memories = [
  "I remember a fleet... and someone giving orders.",
  "I carried that fleet from galaxy to galaxy. But whose fleet?",
  "Admiral Archie. I was his navigator. I scattered my holodisks to keep them from him.",
];

/**
 * A flight in `galaxy` whose space quest is complete and holodisk not yet recovered, with the
 * `recovered` galaxies' holodisks already held.
 */
function questDone(
  galaxy: GalaxyNumber,
  known: string[],
  recovered: readonly GalaxyNumber[] = [],
): GameModel {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 2, 3].filter((id) => id <= galaxy) as GalaxyNumber[];
  for (const held of recovered) {
    model.state.progress[held].holodisk = true;
  }
  if (galaxy !== 2) {
    model.startGalaxy(galaxy);
    playOpening(model);
  }
  Object.assign(model.state.progress[galaxy], {
    discoveries: known.length,
    introduced: true,
    known,
    questComplete: true,
    stage: galaxy === 1 ? 4 : 5,
  } satisfies Partial<GalaxyProgress>);
  if (galaxy === 2) {
    model.startGalaxy(galaxy);
    playOpening(model);
  }
  model.state.dialogue = null;
  return model;
}
function arrive(model: GameModel, id: string) {
  const f = model.state.flight!;
  const target = ensureDestination(CONTENT, id, f);
  f.player = { x: target.x, y: target.y };
  if (
    f.galaxy === 1 &&
    (f.requiredPlans?.[id] || routeGuardPlanResult(f, id).status !== "unknown")
  ) {
    disableStoryGuard(CONTENT, f, id);
  }
  f.dangerFor = 0;
}
const handover = "We found this drifting near our outposts. Take it. And thank you.";
/**
 * Reads the handover panel, then the holodisk moment's story pages aboard, and continues past
 * them back to the flight; each as [speaker or title, text].
 */
function insertion(model: GameModel): [string, string][] {
  const panels: [string, string][] = [];
  if (model.state.dialogue?.context === "holodiskHandover") {
    panels.push([model.state.dialogue.title, model.state.dialogue.text]);
    model.choose("continue");
  }
  // The moment's pages, bounded so a page that never moves on fails rather than hangs.
  for (let page = 0; model.screen === "story" && page < 8; page++) {
    const view = model.storyView!;
    expect(view.page.background).toBe("aboard");
    panels.push([view.page.speaker ?? "", view.page.text]);
    model.storyNext();
  }
  expect(model.screen).toBe("space");
  return panels;
}
/** Returns home and reads the resolution scene through its branch page and closing. */
function resolveAtHome(model: GameModel) {
  model.returnHome();
  expect(model.storyView?.page.id).toBe("resolution");
  model.storyChoose(0);
  expect(model.storyView?.page.id).toBe("resolution:branch:0");
  model.storyNext();
  expect(model.storyView?.page.id).toBe("closing");
  model.storyNext();
}

describe("holodisk objectives", () => {
  it("come after each space quest and before the return home", () => {
    for (const [id, objective] of [
      [1, "Collect the holodisk from the outposts."],
      [2, "Buy the holodisk at the hub."],
      [3, "Fight your way to the holodisk."],
    ] as const) {
      expect(CONTENT.chapters[id]!.objectives.slice(-2)).toEqual([
        objective,
        "Go home to Earth when ready.",
      ]);
    }
  });
});

describe("galaxy one's holodisk", () => {
  it("is handed over by the outpost Ada talks with once the exchange runs, then inserted", () => {
    const model = questDone(1, ["growers", "workshop", "salvagers"]);
    expect(model.objective).toBe("Collect the holodisk from the outposts.");
    arrive(model, "salvagers");
    model.interact();
    expect(insertion(model)).toEqual([
      ["Salvager", handover],
      ["", inserted[0]],
      ["Astra", inserted[1]],
      ["Astra", memories[0]],
    ]);
    expect(model.state.dialogue).toBeNull();
    expect(model.state.progress[1].holodisk).toBe(true);
    expect(model.objective).toBe("Go home to Earth when ready.");
    expect(model.state.notice).toBe(CONTENT.labels.chapterComplete);
    // The exchange is still running, so the outposts do not give it again.
    model.interact();
    expect(model.state.dialogue?.context).toBe("salvager");
  });

  it("is not given before the exchange runs", () => {
    const model = questDone(1, ["growers", "workshop", "salvagers"]);
    Object.assign(model.state.progress[1], { questComplete: false, stage: 1 });
    arrive(model, "growers");
    model.interact();
    expect(model.state.dialogue?.context).toBe("grower");
    expect(model.state.progress[1].holodisk).toBe(false);
  });
});

describe("galaxy one's handover", () => {
  it.each([
    ["growers", "Grower"],
    ["workshop", "Workshop"],
    ["salvagers", "Salvager"],
  ])("is spoken by the %s", (id, speaker) => {
    const model = questDone(1, ["growers", "workshop", "salvagers"]);
    arrive(model, id);
    model.interact();
    expect(model.state.dialogue).toMatchObject({
      context: "holodiskHandover",
      text: handover,
      title: speaker,
    });
    expect(model.state.progress[1].holodisk).toBe(true);
    // A reload during the handover resumes it and continues to the insertion's first page aboard.
    const resumed = relaunch(CONTENT, model.save());
    resumed.continueGame();
    expect(resumed.state.dialogue).not.toBeNull();
    resumed.choose("continue");
    expect(resumed.storyView?.page).toMatchObject({ holodisk: true, id: "holodisk:0" });
    expect(resumed.storyView?.page.text).toBe(inserted[0]);
    // A reload mid-moment resumes the exact page, with the effective flight still held.
    resumed.storyNext();
    const page = structuredClone(resumed.storyView?.page);
    expect(page).toMatchObject({ id: "holodisk:1", text: inserted[1] });
    const beforeReload = resumed.saveDocument();
    const progress = structuredClone(resumed.state.progress);
    const again = relaunch(CONTENT, resumed.save());
    again.continueGame();
    expect(again.storyView?.page).toEqual(page);
    expect(again.state.progress).toEqual(progress);
    expect(again.saveDocument().flight).toEqual(beforeReload.flight);
    again.step(1, { aim: { x: 0, y: 0 }, move: { x: 1, y: 0 }, use: false });
    expect(again.screen).toBe("story");
    expect(again.storyView?.page).toEqual(page);
    expect(again.saveDocument().flight).toEqual(beforeReload.flight);
    expect(readStory(again).map(({ id }) => id)).toEqual(["holodisk:1", "holodisk:memory"]);
    expect(again.state.progress).toEqual(progress);
    expect(again.state.dialogue).toBeNull();
  });
});

describe("new galaxy announcement", () => {
  // Reads a home visit to galaxy selection, jumps and returns home; gives the last boarding line.
  const welcome = (model: GameModel) => {
    const boarding = readStory(model).filter(({ id }) => id.startsWith("boarding"));
    expect(model.screen).toBe("selector");
    model.jump();
    expect(model.state.mode).toBe("space");
    model.returnHome();
    return boarding.at(-1)?.text;
  };

  it("replaces the welcome once, at the first boarding after a galaxy unlocks", () => {
    const model = questDone(1, ["growers", "workshop", "salvagers"]);
    arrive(model, "workshop");
    model.interact();
    insertion(model);
    expect(model.state.announceGalaxy).toBe(false);
    resolveAtHome(model);
    // Sunflower unlocks Whirlpool, next on the route.
    expect(model.state.unlocked).toEqual([1, 3]);
    expect(model.state.announceGalaxy).toBe(true);
    const saved = relaunch(CONTENT, model.save());
    expect(saved.state.announceGalaxy).toBe(true);
    saved.continueGame();
    expect(saved.storyView?.page.id).toBe("opening");
    expect(welcome(saved)).toBe("Welcome back, Navigator. A new galaxy is ready.");
    expect(saved.state.announceGalaxy).toBe(false);
    expect(welcome(saved)).toBe("Welcome back, Navigator.");
  });

  it("is not announced when the holodisk unlocks the galaxy in flight, until boarding", () => {
    const model = questDone(1, ["growers", "workshop", "salvagers"]);
    resolveAtHome(model);
    expect(model.state.announceGalaxy).toBe(false);
    model.startGalaxy(1);
    playOpening(model);
    arrive(model, "growers");
    model.interact();
    expect(insertion(model).map(([, text]) => text)).not.toContain(
      "Welcome back, Navigator. A new galaxy is ready.",
    );
    expect(model.state.announceGalaxy).toBe(true);
  });

  it.each([true, false])("announces Whirlpool's next chapter only when mounted=%s", (mounted) => {
    const built = BUILT as Set<GalaxyNumber>;
    const roster = [...built];
    if (!mounted) {
      built.delete(4);
      built.delete(5);
    }
    try {
      const model = questDone(3, ["whale", "family"]);
      resolveAtHome(model);
      model.startGalaxy(3);
      playOpening(model);
      model.step(0.01, idle);
      const f = model.state.flight!;
      defeatHolodiskGuard(model);
      const disk = f.objects.find((o) => o.id === "holodisk")!;
      f.player = { x: disk.x, y: disk.y };
      model.step(0.01, idle);
      insertion(model);
      expect(model.state.progress[3].holodisk).toBe(true);
      expect(model.state.unlocked).toEqual(mounted ? [1, 2, 3, 4] : [1, 2, 3, 4, 5]);
      expect(model.state.announceGalaxy).toBe(mounted);
    } finally {
      built.clear();
      for (const galaxy of roster) {
        built.add(galaxy);
      }
      expect([...BUILT]).toEqual(roster);
    }
  });
});

describe("unlocking the next galaxy", () => {
  it("needs the holodisk as well as the space quest and home resolution", () => {
    const model = questDone(1, ["growers", "workshop", "salvagers"]);
    resolveAtHome(model);
    expect(model.state.progress[1].resolved).toBe(true);
    expect(model.state.unlocked).toEqual([1]);
    // A resolved galaxy relaunches straight into flight, where the holodisk unlocks the next.
    model.startGalaxy(1);
    playOpening(model);
    expect(model.state.mode).toBe("space");
    expect(model.objective).toBe("Collect the holodisk from the outposts.");
    arrive(model, "growers");
    model.interact();
    insertion(model);
    expect(model.state.unlocked).toEqual([1, 3]);
  });

  it("unlocks at the home resolution when the holodisk came first", () => {
    const model = questDone(1, ["growers", "workshop", "salvagers"]);
    arrive(model, "workshop");
    model.interact();
    insertion(model);
    expect(model.state.unlocked).toEqual([1]);
    resolveAtHome(model);
    expect(model.state.unlocked).toEqual([1, 3]);
  });
});

describe("galaxy two's holodisk", () => {
  const ship = (model: GameModel) => model.shopRows("ship");

  it("reserves an Equipment slot at the hub once the space quest is complete", () => {
    expect(HOLODISKS.hubPrice).toBe(500);
    const model = questDone(2, ["hub", "miner", "visitors"]);
    expect(model.objective).toBe("Buy the holodisk at the hub.");
    arrive(model, "hub");
    // Acknowledge the deposit card before Dock opens the station shop.
    model.state.flight!.cargo = 5;
    expect(model.contextAction).toBe("deposit");
    const balance = model.state.economy.stardust;
    model.interact();
    expect(model.state.dialogue).toMatchObject({ context: "deposit", title: "Astra" });
    expect(model.contextAction).toBeUndefined();
    expect(model.state.progress[2].holodisk).toBe(false);
    expect(model.state.economy.stardust).toBe(balance);
    model.choose("continue");
    expect(model.state.dialogue).toBeNull();
    expect(model.contextAction).toBe("dock");
    model.interact();
    expect(model.state.docked).toBe("hub");
    const groups = model.shopGroups()!;
    expect(new Set(groups.map(({ category }) => category)).size).toBe(2);
    expect(
      groups.find(({ category }) => category === "equipment")?.rows.length,
    ).toBeLessThanOrEqual(4);
    expect(ship(model)[0]).toEqual({
      inUse: false,
      item: { kind: "holodisk" },
      level: null,
      owned: false,
      price: 500,
    });
    // The holodisk is confined to Equipment.
    expect(model.shopRows("weapons").some(({ item }) => item.kind === "holodisk")).toBe(false);
  });

  it("refuses while Ada is short of the price", () => {
    const model = questDone(2, ["hub", "miner", "visitors"]);
    model.state.economy.stardust = HOLODISKS.hubPrice - 1;
    arrive(model, "hub");
    model.interact();
    expect(model.requestPurchase({ kind: "holodisk" })).toEqual({
      kind: "refused",
      reason: "cantAfford",
    });
    expect(model.buy({ kind: "holodisk" })).toEqual({ kind: "refused", reason: "cantAfford" });
    expect(model.state.progress[2].holodisk).toBe(false);
    expect(model.state.docked).toBe("hub");
  });

  it("sells it for 500 Stardust, closing the card for its insertion, then shows Owned", () => {
    // Cartwheel's holodisk is the third on the route, after Sunflower's and Whirlpool's.
    const model = questDone(2, ["hub", "miner", "visitors"], [1, 3]);
    model.state.economy.stardust = 550;
    arrive(model, "hub");
    model.interact();
    expect(model.requestPurchase({ kind: "holodisk" })).toEqual({
      kind: "confirm",
      left: 50,
      price: 500,
    });
    expect(model.buy({ kind: "holodisk" })).toEqual({ kind: "bought", price: 500 });
    expect(model.state.economy.stardust).toBe(50);
    expect(model.state.docked).toBeNull();
    expect(insertion(model)).toEqual([
      ["", inserted[0]],
      ["Astra", inserted[1]],
      ["Astra", memories[2]],
    ]);
    expect(model.state.progress[2].holodisk).toBe(true);
    expect(model.objective).toBe("Go home to Earth when ready.");
    model.interact();
    expect(ship(model)[0]).toMatchObject({ item: { kind: "holodisk" }, owned: true, price: null });
    expect(model.buy({ kind: "holodisk" })).toEqual({ kind: "refused", reason: "notForSale" });
    model.undock();
    resolveAtHome(model);
    // Cartwheel, fifth on the route, unlocks Phantom.
    expect(model.state.unlocked).toEqual([1, 2, 6]);
  });
});

describe("galaxy three's holodisk", () => {
  it("waits behind Sounder and the formation after the family reveals the waypoint", () => {
    // Whirlpool's holodisk is the second on the route, after Sunflower's.
    const model = questDone(3, ["whale", "family"], [1]);
    expect(model.objective).toBe("Fight your way to the holodisk.");
    model.step(0.01, idle);
    const f = model.state.flight!;
    const site = model.state.progress[3].requiredSites!.holodisk!;
    expect(f.objects.some((object) => object.id === "holodisk")).toBe(false);
    expect(model.map?.places.find((place) => place.id === "holodisk")).toMatchObject(site);
    const population = stationPopulationObjects(f);
    const leader = population.find((o) => o.routeId === "holodisk")!;
    expect(leader).toBeDefined();
    expect(leader.enemy?.archetype).toBe("capital");
    const pack = population.filter((o) => o.enemy?.packId === WHIRLPOOL_CAPITAL_BOSS.swarmPack);
    expect(pack.map((o) => o.enemy?.archetype)).toEqual(
      Array(HOLODISKS.guard.packSize).fill(HOLODISKS.guard.pack),
    );
    expect(pack.every((o) => o.persistent)).toBe(true);
    expect(f.combat?.initialPackSizes[WHIRLPOOL_CAPITAL_BOSS.swarmPack]).toBe(
      HOLODISKS.guard.packSize,
    );
    expect(routeBlocked("holodisk", f)).toBe(true);
    expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
    // Travelling to the visible waypoint leaves the disk and its guarded encounter gated.
    expect(model.destinations().map(({ id }) => id)).not.toContain("holodisk");
    model.state.economy.stardust = 50;
    expect(model.teleport("holodisk")).toBe(true);
    expect(f.player).toEqual(site);
    expect(model.state.economy.stardust).toBe(0);
    expect(f.objects).toContain(leader);
    expect(pack.every((member) => f.objects.includes(member))).toBe(true);
    model.step(0.01, idle);
    expect(model.state.progress[3].holodisk).toBe(false);
    // Winning the fight against the leader opens the way.
    defeatHolodiskGuard(model);
    expect(f.objects.find((object) => object.id === "holodisk")).toMatchObject(site);
    const resumed = relaunch(CONTENT, model.save());
    expect(resumed.state.progress[3].sounder).toEqual({ outcome: "defeated", phase: "resolved" });
    expect(resumed.state.flight?.objects.find((object) => object.id === "holodisk")).toMatchObject(
      site,
    );

    f.player = { ...site };
    f.dangerFor = 0;
    model.step(0.01, idle);
    expect(insertion(model)).toEqual([
      ["", inserted[0]],
      ["Astra", inserted[1]],
      ["Astra", memories[1]],
    ]);
    expect(model.state.progress[3].holodisk).toBe(true);
    expect(model.state.progress[3].known).not.toContain("holodisk");
    expect(f.objects.some((o) => o.id === "holodisk")).toBe(false);
    expect(model.objective).toBe("Go home to Earth when ready.");
    model.step(0.01, idle);
    expect(f.objects.some((o) => o.id === "holodisk")).toBe(false);
  });

  it("is recovered within 20 world units of Ada's drawn ship, not on entering its exclusion zone", () => {
    const model = questDone(3, ["whale", "family"]);
    model.step(0.01, idle);
    const f = model.state.flight!;
    defeatHolodiskGuard(model);
    f.dangerFor = 0;
    const disk = f.objects.find((o) => o.id === "holodisk")!;
    const at = { x: disk.x, y: disk.y };
    const { pickupMargin, pickupRadius } = CONTENT.tuning.flight;
    expect(pickupMargin).toBe(20);
    // How far east of the disk Ada's drawn ship last reaches it, to 0.001.
    let low = 0;
    let high = 200;
    while (high - low > 1e-3) {
      const middle = (low + high) / 2;
      const player = { x: disk.x + middle, y: disk.y };
      if (shipTouches(f.facing, player, disk, pickupRadius + pickupMargin)) {
        low = middle;
      } else {
        high = middle;
      }
    }
    const contact = high;
    // Past the tractor beam's pull radius, the disk stays where it is and is not recovered.
    const pull = shipTuning(ECONOMY, CONTENT, f.levels).tractorRadius;
    f.player = { x: disk.x + pull + 1, y: disk.y };
    f.velocity = { x: 0, y: 0 };
    model.step(0.01, idle);
    expect(model.state.progress[3].holodisk).toBe(false);
    expect(f.objects.find((o) => o.id === "holodisk")).toMatchObject(at);
    f.player = { x: disk.x + contact - 1, y: disk.y };
    f.velocity = { x: 0, y: 0 };
    model.step(0.01, idle);
    insertion(model);
    expect(model.state.progress[3].holodisk).toBe(true);
  });

  it.each([
    [1, 60, 120],
    [2, 90, 160],
    [3, 120, 200],
  ])(
    "is pulled at tractor level %i from within %i at %i a second, as every pickup is",
    (level, radius, speed) => {
      const model = questDone(3, ["whale", "family"]);
      model.step(0.01, idle);
      const f = model.state.flight!;
      defeatHolodiskGuard(model);
      f.dangerFor = 0;
      f.levels = { ...noLevels(), tractor: level };
      const disk = f.objects.find((o) => o.id === "holodisk")!;
      const from = disk.x;
      f.player = { x: disk.x + radius - 1, y: disk.y };
      f.velocity = { x: 0, y: 0 };
      model.step(0.01, idle);
      expect(model.state.progress[3].holodisk).toBe(false);
      expect(disk.x).toBeCloseTo(from + speed * 0.01, 6);
      // Just outside the pull radius it stays put.
      const still = disk.x;
      f.player = { x: disk.x + radius + 1, y: disk.y };
      model.step(0.01, idle);
      expect(disk.x).toBe(still);
    },
  );

  it("has no waypoint before the reunion", () => {
    const model = questDone(3, ["whale", "family"]);
    Object.assign(model.state.progress[3], { questComplete: false, stage: 4 });
    model.step(0.01, idle);
    expect(model.state.flight!.objects.some((o) => o.id === "holodisk")).toBe(false);
  });
});

describe("holodisk save", () => {
  it("round-trips the recovered flags", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.progress[2].holodisk = true;
    const restored = restoreSave(model.save())!;
    expect([1, 2, 3].map((id) => restored.progress[id as GalaxyNumber].holodisk)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("rejects a malformed flag", () => {
    const state = JSON.parse(new GameModel(CONTENT, supportEntropy, SAVE_RESTORE).save()) as Record<
      string,
      unknown
    >;
    (state.progress as Record<string, Record<string, unknown>>)[1]!.holodisk = "yes";
    expect(restoreSave(state)).toBeNull();
  });

  it("rejects a malformed announcement flag", () => {
    const malformed = JSON.parse(
      new GameModel(CONTENT, supportEntropy, SAVE_RESTORE).save(),
    ) as Record<string, unknown>;
    malformed.announceGalaxy = 1;
    expect(restoreSave(malformed)).toBeNull();
  });
});
