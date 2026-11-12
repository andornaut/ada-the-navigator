import { describe, expect, it } from "vitest";

import { ACTIVITIES, CALF, MINING_CONTRACT_DEPOSITS } from "../data/activities.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { HUNTING_PACKS } from "../data/galaxyFeatures.ts";
import { JOB_TUNING } from "../data/jobs.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { playOpening, relaunch } from "../testing/launch.ts";
import { activityOffer, heldActivity } from "./activities.ts";
import { calfRouteMidpoint, calfStart, crossesCurrent } from "./calf.ts";
import { ensureDestination, ensureStation } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import type { GameState, HeldActivity, Vec } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

// A flight in a galaxy whose chapter is complete, with Ada at one of its story places.
/** Docks at the hub and takes the mining contract from the head of its board, then undocks. */
function takeContract(model: GameModel): void {
  model.interact();
  expect(model.state.docked).toBe("hub");
  expect(model.acceptJob("miningContract")).toBe("accepted");
  model.undock();
}

function atPlace(galaxy: GalaxyNumber, place: string, resolved = true) {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 2, 3];
  model.startGalaxy(galaxy);
  playOpening(model);
  const progress = model.state.progress[galaxy];
  Object.assign(progress, {
    holodisk: true,
    introduced: true,
    questComplete: true,
    resolved,
    stage: galaxy === 1 ? 4 : 5,
  });
  progress.known = [...new Set([...progress.known, place])];
  model.state.dialogue = null;
  const flight = model.state.flight!;
  flight.objects = [];
  const at = ensureDestination(CONTENT, place, flight);
  // Sunflower's supply runs go to a known station at least 3000 from the issuer.
  if (galaxy === 1) {
    progress.stations = [supplyStation(at).id];
  }
  flight.player = { x: at.x, y: at.y };
  flight.velocity = { x: 0, y: 0 };
  return model;
}

/** Galaxy one's nearest station at least the delivery minimum from a point. */
function supplyStation(from: Vec) {
  const gap = (site: Vec) => Math.hypot(site.x - from.x, site.y - from.y);
  return stationsNear(ECONOMY, 1, 40_000, from)
    .filter((site) => gap(site) >= JOB_TUNING.delivery.min)
    .sort((a, b) => gap(a) - gap(b))[0]!;
}

/** Ada at a known place in the flight, at rest. */
function flyTo(model: GameModel, place: string) {
  const flight = model.state.flight!;
  if (!model.state.progress[flight.galaxy].known.includes(place)) {
    model.state.progress[flight.galaxy].known.push(place);
  }
  const at = ensureDestination(CONTENT, place, flight);
  flight.player = { x: at.x, y: at.y };
  flight.velocity = { x: 0, y: 0 };
  model.state.dialogue = null;
}

const OFFERS = [
  [1, "growers", "Fresh food for the station traders. Would you carry it?", "Grower"],
  [1, "workshop", "A station ordered these repaired tools. Could you take them?", "Workshop"],
  [1, "salvagers", "A station shop needs these spare parts. Will you bring them?", "Salvager"],
  [
    3,
    "family",
    "One of our young ones swam off to play. Could you guide them home? Stay close. They follow friends.",
    "Whale family",
  ],
] as const;

// A family position whose first guide has a qualifying calf start.
const FAMILY = ((): Vec => {
  for (let x = -20000; x <= 20000; x += 2500) {
    for (let y = -20000; y <= 20000; y += 2500) {
      if (calfStart(3, { x, y }, 0)) {
        return { x, y };
      }
    }
  }
  throw new Error("no family position with a calf start");
})();

// Whirlpool with the family at FAMILY and Ada there.
function atFamily() {
  const model = atPlace(3, "family");
  const flight = model.state.flight!;
  const family = flight.objects.find((o) => o.kind === "destination" && o.id === "family")!;
  Object.assign(family, FAMILY);
  flight.player = { ...FAMILY };
  return { family, flight, model };
}

describe("repeatable activities", () => {
  it.each(OFFERS)(
    "galaxy %i's %s offers its activity through Talk with Accept and Not now",
    (galaxy, place, line, speaker) => {
      const model = galaxy === 3 ? atFamily().model : atPlace(galaxy, place);
      model.interact();
      expect(model.state.dialogue).toMatchObject({
        choices: [
          { id: "take", label: "Accept" },
          { id: "skip", label: "Not now" },
        ],
        text: line,
        title: speaker,
      });
      model.choose("take");
      expect(model.state.dialogue).toBeNull();
      expect(model.state.tasks[galaxy]).toMatchObject({
        id: ACTIVITIES[galaxy]!.id,
        kind: "activity",
        place,
      });
    },
  );

  it("offers nothing before the chapter is complete, and Not now leaves the slot empty", () => {
    const early = atPlace(1, "growers", false);
    early.interact();
    expect(early.state.dialogue?.context).not.toMatch(/^activity/);
    const model = atPlace(1, "growers");
    model.interact();
    model.choose("skip");
    expect(model.state.dialogue).toBeNull();
    expect(model.state.tasks[1]).toBeUndefined();
  });

  it("refuses the hub board's contract while a job holds the slot, and job offers while an activity does", () => {
    const model = atPlace(2, "hub");
    model.state.tasks[2] = {
      id: "job:0",
      item: "an ore pod",
      kind: "job",
      reward: 35,
      station: "s",
      target: { id: "", x: 0, y: 0 },
      type: "rescue",
    };
    expect(activityOffer(2, model.state.progress[2], model.state, "hub")).toBeUndefined();
    model.interact();
    expect(model.state.docked).toBe("hub");
    expect(model.jobBoard()[0]).toMatchObject({ id: "miningContract", state: "busy" });
    expect(model.acceptJob("miningContract")).toBe("busy");
    expect(model.state.tasks[2]).toMatchObject({ kind: "job" });
    expect(model.jobBusyLine).toBe("Finish or drop your current job first.");
    // An activity in the slot: the board keeps its jobs, and Accept refuses with its own line.
    model.state.tasks[2] = {
      deposited: 4,
      id: "miningContract",
      kind: "activity",
      place: "hub",
      reward: 60,
    };
    expect(model.jobBusyLine).toBe("Finish your activity first.");
    model.state.dialogue = null;
    model.state.docked = stationsNear(ECONOMY, 2, 100000, { x: 0, y: 0 })[0]!.id;
    const offer = model.jobBoard().find((row) => row.kind === "job")!;
    expect(offer.state).toBe("busy");
    expect(model.acceptJob(offer.id)).toBe("busy");
    // The slot is per galaxy.
    expect(activityOffer(1, model.state.progress[1], model.state, "growers")).toBeUndefined();
    model.state.progress[1].resolved = true;
    expect(activityOffer(1, model.state.progress[1], model.state, "growers")).toBe(ACTIVITIES[1]);
  });

  it("heads every board in its galaxy with the active activity, marked Active with Drop", () => {
    const model = atPlace(2, "hub");
    takeContract(model);
    model.state.docked = stationsNear(ECONOMY, 2, 100000, { x: 0, y: 0 })[0]!.id;
    const rows = model.jobBoard();
    expect(rows[0]).toMatchObject({
      detail: "Deposit 30 ore at the hub.",
      kind: "activity",
      reward: 60,
      state: "held",
      title: "Mining contract",
    });
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.slice(1).every((row) => row.kind === "job" && row.state === "busy")).toBe(true);
    expect(model.dropJob()).toBe(true);
    expect(model.state.tasks[2]).toBeUndefined();
  });

  it("drops the mining contract from the hub's board, losing its progress", () => {
    const model = atPlace(2, "hub");
    takeContract(model);
    heldActivity(2, model.state)!.deposited = 9;
    expect(model.jobObjective).toBe("Deposit ore at the hub: 9 of 30.");
    model.interact();
    expect(model.jobBoard()[0]).toMatchObject({ id: "miningContract", state: "held" });
    expect(model.dropJob()).toBe(true);
    expect(model.state.tasks[2]).toBeUndefined();
    expect(model.jobBoard()[0]).toMatchObject({ id: "miningContract", state: "offer" });
  });

  it("counts only hub deposits made after accepting the mining contract, and pays at 30", () => {
    const model = atPlace(2, "hub");
    const flight = model.state.flight!;
    flight.cargo = 12;
    model.interact();
    // The deposit before accepting is the story's, not the contract's.
    expect(model.state.dialogue).toBeNull();
    takeContract(model);
    expect(heldActivity(2, model.state)?.deposited).toBe(0);
    expect(model.jobObjective).toBe("Deposit ore at the hub: 0 of 30.");
    const before = model.state.economy.stardust;
    const story = model.state.progress[2].deposited;
    const count = model.state.achievements.activities;
    // Partial loads count, and the story's total keeps counting alongside.
    for (const load of [12, 12]) {
      flight.cargo = load;
      model.interact();
      model.state.dialogue = null;
    }
    expect(heldActivity(2, model.state)?.deposited).toBe(24);
    expect(model.state.progress[2].deposited).toBe(story + 24);
    expect(model.state.economy.stardust).toBe(before);
    flight.cargo = MINING_CONTRACT_DEPOSITS - 24;
    model.interact();
    expect(model.state.tasks[2]).toBeUndefined();
    expect(model.state.economy.stardust).toBe(before + 60);
    expect(model.state.notice).toBe("Job complete: +60 Stardust");
    expect(model.state.achievements.activities).toBe(count + 1);
    // Offered again at the head of the hub's board.
    model.interact();
    expect(model.jobBoard()[0]).toMatchObject({ id: "miningContract", state: "offer" });
  });

  it("sends a supply run to the nearest known station 3000 away, paying the delivery reward", () => {
    const model = atPlace(1, "growers");
    const flight = model.state.flight!;
    const growers = flight.objects.find((o) => o.kind === "destination" && o.id === "growers")!;
    const site = supplyStation(growers);
    // A nearer station under the minimum and a farther one do not change the destination.
    const others = stationsNear(ECONOMY, 1, 40_000, growers).filter(({ id }) => id !== site.id);
    model.state.progress[1].stations = [site.id, ...others.map(({ id }) => id)];
    model.interact();
    model.choose("take");
    const length = Math.hypot(site.x - growers.x, site.y - growers.y);
    const reward = length >= JOB_TUNING.delivery.longFrom ? 25 : 15;
    expect(heldActivity(1, model.state)).toMatchObject({
      carrying: true,
      place: "growers",
      reward,
      target: { id: site.id, x: site.x, y: site.y },
    });
    expect(model.jobObjective).toBe("Carry fresh food to the station.");
    // Sentences name a known station in lower case, as delivery titles do; the Map keeps Station.
    const delivery = {
      id: "job:x",
      item: "seeds",
      reward: 15,
      station: site.id,
      target: { id: site.id, x: site.x, y: site.y },
      type: "delivery",
    } as const;
    expect(model.jobText(delivery).title).toBe("Deliver seeds to the station");
    expect(model.map?.places.find(({ id }) => id === site.id)?.label).toBe("Station");
    expect(model.indicatorTargets).toContainEqual(
      expect.objectContaining({ id: site.id, kind: "job", x: site.x, y: site.y }),
    );
    // Kept with the activity on leaving the galaxy (rules.md "What each event keeps").
    flight.dangerFor = 0;
    model.returnHome();
    expect(heldActivity(1, model.state)?.carrying).toBe(true);
    model.startGalaxy(1);
    playOpening(model);
    model.state.dialogue = null;
    // At the station Use delivers, before Dock.
    const before = model.state.economy.stardust;
    ensureStation(CONTENT, site.id, model.state.flight!);
    const next = model.state.flight!;
    next.player = { x: site.x + 100, y: site.y };
    next.velocity = { x: 0, y: 0 };
    next.dangerFor = 0;
    model.state.dialogue = null;
    model.step(0.05, idle);
    expect(model.state.docked).toBeNull();
    expect(model.contextAction).toBe("deliver");
    model.interact();
    expect(model.state.docked).toBeNull();
    expect(model.contextAction).toBe("dock");
    expect(model.state.tasks[1]).toBeUndefined();
    expect(model.state.economy.stardust).toBe(before + reward);
    expect(model.state.notice).toBe(`Job complete: +${reward} Stardust`);
  });

  it("makes no supply run offer without a known station 3000 from the outpost", () => {
    const model = atPlace(1, "growers");
    model.state.progress[1].stations = [];
    model.interact();
    expect(model.state.dialogue).toMatchObject({ context: "grower" });
    expect(model.state.tasks[1]).toBeUndefined();
  });

  it("refuses Accept at another outpost while one outpost's supply run is held", () => {
    const model = atPlace(1, "growers");
    model.interact();
    model.choose("take");
    flyTo(model, "workshop");
    model.interact();
    expect(model.state.dialogue).toMatchObject({
      choices: [{ id: "take", refused: true }, { id: "skip" }],
      context: "activity:workshop",
    });
    model.choose("take");
    expect(model.state.notice).toBe("Finish your activity first.");
    expect(heldActivity(1, model.state)?.place).toBe("growers");
  });

  it("keeps an accepted activity through save and restore, and rejects one not the galaxy's", () => {
    const model = atPlace(2, "hub");
    model.interact();
    model.choose("take");
    const saved = JSON.parse(model.save()) as GameState;
    expect(restoreSave(JSON.stringify(saved))!.tasks[2]).toEqual(saved.tasks[2]);
    for (const bad of [
      { deposited: 0, id: "supplyRun", kind: "activity", place: "hub", reward: 35 },
      { deposited: 0, id: "miningContract", kind: "activity", place: "growers", reward: 35 },
      { deposited: 0, id: "miningContract", kind: "activity", place: "hub", reward: 50 },
      { id: "miningContract", kind: "activity", place: "hub", reward: 35 },
      { deposited: -1, id: "miningContract", kind: "activity", place: "hub", reward: 35 },
      {
        carrying: true,
        deposited: 0,
        id: "miningContract",
        kind: "activity",
        place: "hub",
        reward: 35,
      },
      {
        deposited: 0,
        id: "miningContract",
        kind: "activity",
        place: "hub",
        reward: 35,
        target: { id: "x", x: 0, y: 0 },
      },
    ]) {
      const broken = JSON.parse(JSON.stringify(saved)) as { tasks: Record<number, unknown> };
      broken.tasks[2] = bad;
      expect(restoreSave(JSON.stringify(broken)), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("Guide a calf", () => {
  it("starts the calf 5000 to 8000 from the family, with the line home crossing a current", () => {
    for (let guides = 0; guides < 6; guides++) {
      const start = calfStart(3, FAMILY, guides);
      if (!start) {
        continue;
      }
      const reach = Math.hypot(start.x, start.y);
      expect(reach).toBeGreaterThanOrEqual(CALF.distance[0]);
      expect(reach).toBeLessThanOrEqual(CALF.distance[1]);
      expect(crossesCurrent(3, { x: FAMILY.x + start.x, y: FAMILY.y + start.y }, FAMILY)).toBe(
        true,
      );
    }
    // The same galaxy and count give the same spot.
    expect(calfStart(3, FAMILY, 0)).toEqual(calfStart(3, FAMILY, 0));
    // With no current to cross, no spot qualifies and the family makes no offer.
    expect(calfStart(1, { x: 0, y: 0 }, 0)).toBeNull();
  });

  it("waits with its pack, follows Ada from 160 to 340, and completes home with the family", () => {
    const { family, flight, model } = atFamily();
    model.interact();
    model.choose("take");
    const held = heldActivity(3, model.state) as HeldActivity;
    expect(held.start).toEqual(calfStart(3, FAMILY, 0));
    expect(model.state.progress[3].guides).toBe(1);
    expect(model.calfAway).toBe(true);
    model.step(0.05, idle);
    const start = { x: FAMILY.x + held.start!.x, y: FAMILY.y + held.start!.y };
    // Placed at its start; a current there may already have drifted it a little.
    expect(flight.calf).toMatchObject({ following: false });
    expect(Math.hypot(flight.calf!.x - start.x, flight.calf!.y - start.y)).toBeLessThan(5);
    expect(model.jobObjective).toBe("Find the whale calf.");
    expect(model.indicatorTargets).toContainEqual(
      expect.objectContaining({ id: "activity:calf", kind: "job" }),
    );
    // One pack of 3 to 4 fighters waits at the midpoint of the straight line home.
    const pack = flight.objects.filter((o) => o.enemy?.packId === "hunt:calf");
    expect(pack.length).toBeGreaterThanOrEqual(HUNTING_PACKS.count[0]);
    expect(pack.length).toBeLessThanOrEqual(HUNTING_PACKS.count[1]);
    const middle = calfRouteMidpoint(FAMILY, held.start!);
    for (const member of pack) {
      expect(Math.hypot(member.x - middle.x, member.y - middle.y)).toBeLessThan(
        HUNTING_PACKS.spread + 1,
      );
    }
    // Ada within 160 starts the follow; the indicator turns to the family.
    flight.objects = flight.objects.filter((o) => o.kind !== "enemy");
    flight.player = { x: flight.calf!.x + CALF.follow - 10, y: flight.calf!.y };
    model.state.dialogue = null;
    model.step(0.05, idle);
    expect(flight.calf!.following).toBe(true);
    expect(model.jobObjective).toBe("Guide the calf home.");
    expect(model.indicatorTargets).toContainEqual(
      expect.objectContaining({ id: "family", kind: "job", x: family.x, y: family.y }),
    );
    // It keeps following out to 340, then waits.
    flight.player = { x: flight.calf!.x + CALF.release - 10, y: flight.calf!.y };
    model.step(0.05, idle);
    expect(flight.calf!.following).toBe(true);
    flight.player = { x: flight.calf!.x + CALF.release + 10, y: flight.calf!.y };
    model.step(0.05, idle);
    expect(flight.calf!.following).toBe(false);
    // Home with the family completes the guide, paying 50 with the notice alone.
    const before = model.state.economy.stardust;
    Object.assign(flight.calf!, { x: family.x + CALF.home - 1, y: family.y });
    model.step(0.05, idle);
    expect(model.state.tasks[3]).toBeUndefined();
    expect(flight.calf).toBeUndefined();
    expect(model.calfAway).toBe(false);
    expect(model.state.economy.stardust).toBe(before + 50);
    expect(model.state.notice).toBe("Job complete: +50 Stardust");
  });

  it("returns the calf to its start and places its pack again on reset, Drop and leaving", () => {
    const { flight, model } = atFamily();
    model.interact();
    model.choose("take");
    const held = heldActivity(3, model.state)!;
    model.step(0.05, idle);
    const start = { x: flight.calf!.x, y: flight.calf!.y };
    Object.assign(flight.calf!, { following: true, x: start.x + 900, y: start.y });
    flight.objects = flight.objects.filter((o) => o.enemy?.packId !== "hunt:calf");
    model.resetActivity(3);
    model.state.dialogue = null;
    model.step(0.05, idle);
    expect(flight.calf).toMatchObject({ following: false });
    expect(Math.hypot(flight.calf!.x - start.x, flight.calf!.y - start.y)).toBeLessThan(1);
    expect(flight.objects.some((o) => o.enemy?.packId === "hunt:calf")).toBe(true);
    // Closing the game resumes the guide exactly.
    Object.assign(flight.calf!, { following: true, x: start.x + 300, y: start.y });
    const restored = relaunch(CONTENT, model.save());
    expect(restored.state.flight!.calf).toEqual(flight.calf);
    // Leaving the galaxy: the next flight's calf starts again from the family, wherever it is.
    flight.dangerFor = 0;
    model.returnHome();
    model.startGalaxy(3);
    playOpening(model);
    model.state.dialogue = null;
    model.step(0.05, idle);
    const next = model.state.flight!;
    const family = next.objects.find((o) => o.kind === "destination" && o.id === "family");
    if (family) {
      expect(next.calf).toMatchObject({ following: false });
      expect(
        Math.hypot(
          next.calf!.x - family.x - held.start!.x,
          next.calf!.y - family.y - held.start!.y,
        ),
      ).toBeLessThan(5);
    }
  });

  it("ends the follow on Travel here, leaving the calf where it is", () => {
    const { flight, model } = atFamily();
    model.interact();
    model.choose("take");
    model.step(0.05, idle);
    flight.calf!.following = true;
    const at = { x: flight.calf!.x, y: flight.calf!.y };
    flight.objects = flight.objects.filter((o) => o.kind !== "enemy");
    flight.dangerFor = 0;
    model.state.dialogue = null;
    model.teleport("family");
    expect(flight.calf).toMatchObject({ following: false, x: at.x, y: at.y });
  });

  it("rejects a saved calf that is not a position, velocity and follow flag", () => {
    const { flight, model } = atFamily();
    model.interact();
    model.choose("take");
    model.step(0.05, idle);
    expect(flight.calf).toBeDefined();
    const saved = JSON.parse(model.save()) as { flight: { calf: Record<string, unknown> } };
    for (const bad of [{ following: "yes" }, { velocity: null }, { x: "far" }]) {
      const broken = structuredClone(saved);
      Object.assign(broken.flight.calf, bad);
      expect(restoreSave(JSON.stringify(broken)), JSON.stringify(bad)).toBeNull();
    }
  });
});
