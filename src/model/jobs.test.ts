import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { ROUTE } from "../data/galaxies.ts";
import { carriedItemName } from "../data/itemNames.ts";
import {
  JOB_REWARDS,
  JOB_TUNING,
  LANDMARK_GALAXIES,
  LANDMARK_KINDS,
  LANDMARK_TUNING,
  landmarkNameKey,
} from "../data/jobs.ts";
import { galaxyCard } from "../data/storybook.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { relaunch } from "../testing/launch.ts";
import { ensureStation, stepFlight, towing } from "./flight.ts";
import { GameModel, newGameState } from "./game.ts";
import {
  acceptJob,
  type BoardContext,
  completeJob,
  dropJob,
  type JobBook,
  pullTow,
  stationBoard,
} from "./jobs.ts";
import { chartLandmarks, landmarkSites } from "./landmarks.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import type { FlightState, HeldJob, Vec } from "./types.ts";
import { noLevels, shipTuning } from "./upgrades.ts";

/** The same held target is absent beyond 3000 and present just inside it, without advancing play. */
function expectJobIndicatorRange(model: GameModel, target: Vec & { id: string }): void {
  const flight = model.state.flight!;
  const before = flight.player;
  const match = expect.objectContaining({ id: target.id, kind: "job", x: target.x, y: target.y });
  flight.player = { x: target.x + 3001, y: target.y };
  expect(model.indicatorTargets).not.toContainEqual(match);
  flight.player = { x: target.x + 2999, y: target.y };
  expect(model.indicatorTargets).toContainEqual(match);
  flight.player = before;
}

const QUESTS = readFileSync(new URL("../../gameplay/quests.md", import.meta.url), "utf8");
/** A Markdown table's body rows as trimmed cells, from the table after a heading or lead-in. */
function tableRows(after: string): string[][] {
  const from = QUESTS.indexOf(after);
  expect(from, after).toBeGreaterThanOrEqual(0);
  const lines = QUESTS.slice(from).split("\n");
  const start = lines.findIndex((line) => line.startsWith("|"));
  const table = lines
    .slice(start)
    .filter((_, index, all) => all.slice(0, index + 1).every((line) => line.startsWith("|")));
  return table.slice(2).map((line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim()),
  );
}
// Landmark names by their legacy galaxy number (LandmarkGalaxy): Phantom is 4.
// By galaxy: Sunflower, Cartwheel, Whirlpool, Needle, Andromeda, Phantom.
const GALAXY_NAMES = ["Sunflower", "Cartwheel", "Whirlpool", "Needle", "Andromeda", "Phantom"];
const label = (key: string) => CONTENT.labels[key];

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const use = { ...idle, use: true };
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const emptyBook = (made = 0): JobBook => ({ jobs: { boards: {}, made }, tasks: {} });
const context = (galaxy: GalaxyNumber = 1, charted: string[] = []): BoardContext => ({
  galaxy,
  hostiles: [],
  outposts: [],
  progress: { charted, stations: [] },
});
/** Galaxy one's station nearest the world origin. */
function firstStation(galaxy: GalaxyNumber = 1) {
  const [site] = stationsNear(ECONOMY, galaxy, 20_000, { x: 0, y: 0 }).sort(
    (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y),
  );
  return site!;
}
/** A galaxy-one flight docked at its first station. */
function docked(): {
  model: GameModel;
  flight: FlightState;
  station: ReturnType<typeof firstStation>;
} {
  const model = new GameModel(CONTENT);
  // Every lesson and lore line but the jobs' is already heard, so only job lines and Penny talk.
  model.state.seenConversations.push(
    ...CONVERSATIONS.filter(
      ({ trigger }) => trigger.kind !== "job" && trigger.kind !== "jobLore",
    ).map(({ id }) => id),
  );
  model.startGalaxy(1);
  const flight = model.state.flight!;
  const station = firstStation();
  ensureStation(CONTENT, station.id, flight);
  flight.player = { x: station.x, y: station.y };
  model.state.docked = station.id;
  return { flight, model, station };
}
/** Takes the docked board's offer of a type and undocks. */
function take(model: GameModel, type: HeldJob["type"]): HeldJob {
  const offer = model.jobBoard().find((row) => row.type === type);
  expect(offer).toBeDefined();
  expect(model.acceptJob(offer!.id)).toBe("accepted");
  model.undock();
  return structuredClone(model.state.tasks[1] as HeldJob);
}
/** Places Ada at a point at rest with a full shield, out of danger, and steps once. */
function flyTo(model: GameModel, point: Vec, input = idle): void {
  const flight = model.state.flight!;
  flight.player = { ...point };
  flight.velocity = { x: 0, y: 0 };
  flight.dangerFor = 0;
  flight.shield = model.shieldMax;
  model.state.dialogue = null;
  model.step(0.05, input);
}
/** Removes the flight's drones, their shots, hazards and moving debris: everything that damages. */
function calm(flight: FlightState): void {
  flight.objects = flight.objects.filter(
    (object) => object.kind !== "enemy" && object.kind !== "hazard" && object.kind !== "debris",
  );
  flight.shots = flight.shots.filter((shot) => !shot.enemy);
  flight.dangerFor = 0;
}
/**
 * Holds Ada at a point for seconds in calm space, tapping through each line; returns the
 * instances heard. The space around the point is generated first and its drones cleared, so a
 * drone warning in the launch's world never takes the box's slot from the line listened for.
 */
function listen(model: GameModel, point: Vec, seconds: number): string[] {
  const flight = model.state.flight!;
  flight.player = { ...point };
  stepFlight(CONTENT, 0.05, idle, flight);
  const heard: string[] = [];
  for (let step = 0; step < seconds / 0.05; step++) {
    calm(flight);
    flyTo(model, point);
    const line = model.conversation;
    if (line) {
      const instance = line.key.slice(0, line.key.lastIndexOf(":"));
      if (!heard.includes(instance)) {
        heard.push(instance);
      }
      model.advanceConversation();
    }
  }
  return heard;
}

describe("landmarks", () => {
  it("place twelve per galaxy within 25000 of the origin, 3000 apart and 1500 from stations", () => {
    for (const galaxy of [1, 2, 3] as const) {
      const sites = landmarkSites(galaxy);
      expect(sites).toHaveLength(LANDMARK_TUNING.count);
      expect(new Set(sites.map(({ kind }) => kind))).toEqual(
        new Set(["nebula", "wreck", "beacon"]),
      );
      for (const site of sites) {
        expect(Math.hypot(site.x, site.y)).toBeLessThanOrEqual(25_000);
        expect(stationsNear(ECONOMY, galaxy, 1500, site)).toEqual([]);
        for (const other of sites.filter((entry) => entry !== site)) {
          expect(distance(site, other)).toBeGreaterThanOrEqual(3000);
        }
      }
    }
  });

  it("have four of each kind per galaxy, the seed's kinds and names on every flight", () => {
    for (const galaxy of [1, 2, 3] as const) {
      const sites = landmarkSites(galaxy);
      for (const kind of LANDMARK_KINDS) {
        // Names follow the table's order within a kind, in id order.
        expect(sites.filter((site) => site.kind === kind).map(({ name }) => name)).toEqual(
          [1, 2, 3, 4].map((nth) => landmarkNameKey(galaxy, kind, nth)),
        );
      }
      // The seed assigns the kinds: not the plain nebula, wreck, beacon cycle.
      expect(sites.map(({ kind }) => kind)).not.toEqual(
        sites.map((_, index) => LANDMARK_KINDS[index % 3]),
      );
    }
    // Two flights with different seeds chart the same landmark under the same name.
    const names = [11, 22].map((seed) => {
      const model = new GameModel(CONTENT);
      model.startGalaxy(1);
      const flight = model.state.flight!;
      flight.seed = seed;
      const site = landmarkSites(1)[5]!;
      model.state.progress[1].charted.push(site.id);
      return model.map?.places.find(({ id }) => id === site.id)?.label;
    });
    expect(names[0]).toBe(label(landmarkSites(1)[5]!.name));
    expect(names[1]).toBe(names[0]);
  });

  it("name all 72 landmarks, twelve in every galaxy, as quests.md's table does", () => {
    const rows = tableRows("Each galaxy has four landmarks of each kind.");
    // The table lists all six galaxies in route order.
    expect(rows.map(([galaxy]) => galaxy)).toEqual(ROUTE.map((galaxy) => galaxyCard(galaxy).name));
    const named = LANDMARK_GALAXIES.flatMap((galaxy) =>
      LANDMARK_KINDS.flatMap((kind) =>
        [1, 2, 3, 4].map((nth) => label(landmarkNameKey(galaxy, kind, nth))),
      ),
    );
    expect(named).toHaveLength(72);
    expect(new Set(named).size).toBe(72);
    for (const galaxy of LANDMARK_GALAXIES) {
      const row = rows.find(([name]) => name === GALAXY_NAMES[galaxy - 1])!;
      const cells = row.slice(1).map((cell) => cell.split(", "));
      // Table columns: nebulae, wrecks, beacons.
      expect(cells).toEqual(
        LANDMARK_KINDS.map((kind) =>
          [1, 2, 3, 4].map((nth) => label(landmarkNameKey(galaxy, kind, nth))),
        ),
      );
    }
  });

  it("use quests.md's player strings", () => {
    const rows = tableRows("### Player strings");
    expect(rows.length).toBeGreaterThan(20);
    for (const [key, text] of rows) {
      expect(label(key!.replaceAll("`", "")), key).toBe(text);
    }
    expect(CONTENT.labels.surveyTitle).toBe("Chart the {landmark}");
  });

  it("chart within 300 of Ada at once and only once", () => {
    const [site] = landmarkSites(1);
    const progress = { charted: [] as string[] };
    expect(chartLandmarks(1, progress, { x: site!.x + 301, y: site!.y })).toEqual([]);
    expect(chartLandmarks(1, progress, { x: site!.x + 299, y: site!.y })).toEqual([site!.id]);
    expect(chartLandmarks(1, progress, site!)).toEqual([]);
    expect(progress.charted).toEqual([site!.id]);
  });
});

describe("job boards", () => {
  it("pays the exact approved reward table by route position", () => {
    expect(JOB_REWARDS).toEqual({
      1: { deliveryLong: 75, deliveryShort: 45, hunt: 45, rescue: 75, survey: 30 },
      2: { deliveryLong: 105, deliveryShort: 60, hunt: 60, rescue: 105, survey: 45 },
      3: { deliveryLong: 150, deliveryShort: 90, hunt: 90, rescue: 150, survey: 60 },
      4: { deliveryLong: 150, deliveryShort: 90, hunt: 90, rescue: 150, survey: 60 },
      5: { deliveryLong: 150, deliveryShort: 90, hunt: 90, rescue: 150, survey: 60 },
      6: { rescue: 150, survey: 60 },
    });
  });

  it("never send a delivery to a story place that takes none, only to stations and outposts", () => {
    const station = firstStation(3);
    // The whale family, the whale and the hub's buoy-held miner and visitors, nearer than any
    // station and past the delivery minimum: none takes a delivery.
    const story = ["family", "whale", "miner", "visitors"].map((id, index) => ({
      id,
      x: station.x + 3200 + index * 10,
      y: station.y,
    }));
    // A known station farther off, so boards still offer deliveries.
    const far = stationsNear(ECONOMY, 3, 40_000, station).find(
      (site) => site.id !== station.id && distance(site, station) >= 3000,
    )!;
    const known = { ...context(3), progress: { charted: [], stations: [far.id] } };
    const deliveries = [];
    for (let made = 0; made < 40; made++) {
      const board = stationBoard({ ...known, outposts: story }, emptyBook(made), station);
      deliveries.push(...board.filter(({ type }) => type === "delivery"));
    }
    expect(deliveries.length).toBeGreaterThan(0);
    for (const offer of deliveries) {
      expect(offer.target.id).toBe(far.id);
    }
    // An outpost there takes one.
    const sunflower = firstStation();
    const growers = { id: "growers", x: sunflower.x + 3100, y: sunflower.y };
    const boards = Array.from({ length: 40 }, (_, made) =>
      stationBoard({ ...context(), outposts: [growers] }, emptyBook(made), sunflower),
    );
    expect(
      boards.flat().some(({ target, type }) => type === "delivery" && target.id === "growers"),
    ).toBe(true);
  });

  it("offer three jobs of distinct types with targets in their ranges and table rewards", () => {
    const station = firstStation();
    const book = emptyBook();
    const outpost = { id: "growers", x: station.x + 4000, y: station.y };
    const board = stationBoard({ ...context(), outposts: [outpost] }, book, station);
    expect(board).toHaveLength(3);
    expect(new Set(board.map(({ type }) => type)).size).toBe(3);
    for (const offer of board) {
      expect(offer.station).toBe(station.id);
      const reach = distance(offer.target, station);
      if (offer.type === "delivery") {
        expect(offer.target.id).toBe("growers");
        expect(offer.reward).toBe(JOB_REWARDS[1]!.deliveryShort);
      } else if (offer.type === "survey") {
        expect(landmarkSites(1).some(({ id }) => id === offer.target.id)).toBe(true);
        expect(offer.reward).toBe(JOB_REWARDS[1]!.survey);
      } else {
        expect(reach).toBeGreaterThanOrEqual(3000);
        expect(reach).toBeLessThanOrEqual(7000);
        expect(offer.reward).toBe(JOB_REWARDS[1]![offer.type]);
      }
      if (offer.type === "hunt") {
        expect(distance(offer.spot!, offer.target)).toBeLessThan(JOB_TUNING.hunt.radius);
      }
    }
    // Offers stay until taken.
    expect(stationBoard(context(), book, station)).toEqual(board);
  });

  it("deliver to the nearest known station or outpost at least 3000 away, with no upper limit", () => {
    const station = firstStation();
    const deliveryTo = (stations: string[], outposts: BoardContext["outposts"]) => {
      for (let made = 0; made < 40; made++) {
        const offer = stationBoard(
          { ...context(), outposts, progress: { charted: [], stations } },
          emptyBook(made),
          station,
        ).find(({ type }) => type === "delivery");
        if (offer) {
          return offer;
        }
      }
      return undefined;
    };
    const near = { id: "growers", x: station.x + 2999, y: station.y };
    const far = { id: "workshop", x: station.x, y: station.y + 20_000 };
    const farther = { id: "salvagers", x: station.x, y: station.y - 30_000 };
    // Nothing known at 3000 or more: no delivery.
    expect(deliveryTo([station.id], [near])).toBeUndefined();
    const offer = deliveryTo([station.id], [near, farther, far]);
    expect(offer?.target).toEqual(far);
    expect(offer?.reward).toBe(JOB_REWARDS[1]!.deliveryLong);
    // A discovered station nearer than the outposts is preferred; undiscovered ones never count.
    // Station sites are at least 8000 apart, so a neighbour sits between 3000 and the outpost.
    const [other] = stationsNear(ECONOMY, 1, 19_000, station)
      .filter(({ id }) => id !== station.id)
      .sort((a, b) => distance(a, station) - distance(b, station));
    expect(deliveryTo([], [far])?.target.id).toBe("workshop");
    expect(deliveryTo([station.id, other!.id], [far])?.target.id).toBe(other!.id);
  });

  it("keep rescue and hunt targets 1000 from frigates and capitals", () => {
    const station = firstStation();
    const hostiles = Array.from({ length: 36 }, (_, index) => ({
      x: station.x + Math.cos(index / 6) * 5000,
      y: station.y + Math.sin(index / 6) * 5000,
    }));
    for (let made = 0; made < 20; made++) {
      const book = emptyBook(made);
      for (const offer of stationBoard({ ...context(), hostiles }, book, station)) {
        if (offer.type === "rescue" || offer.type === "hunt") {
          for (const hostile of hostiles) {
            expect(distance(hostile, offer.target)).toBeGreaterThanOrEqual(1000);
          }
        }
      }
    }
  });

  it("stop offering surveys once every landmark is charted, replacing a stale survey", () => {
    const station = firstStation();
    const book = emptyBook();
    const board = stationBoard(context(), book, station);
    const survey = board.find(({ type }) => type === "survey")!;
    const slot = board.indexOf(survey);
    const charted = landmarkSites(1).map(({ id }) => id);
    const after = stationBoard(context(1, charted), book, station);
    expect(after.some(({ type }) => type === "survey")).toBe(false);
    expect(after[slot]?.id).not.toBe(survey.id);
  });

  it("hold one job per galaxy, refuse others while held and return a dropped job", () => {
    const station = firstStation();
    const book = emptyBook();
    const [first, second] = stationBoard(context(), book, station);
    expect(acceptJob(1, station.id, first!.id, book)).toBe("accepted");
    expect(acceptJob(1, station.id, second!.id, book)).toBe("busy");
    expect(dropJob(1, book)).toBe(true);
    expect(stationBoard(context(), book, station)[0]).toEqual(first);
    expect(acceptJob(1, station.id, second!.id, book)).toBe("accepted");
  });

  it("refill a completed job's slot from the pool and pay its reward", () => {
    const station = firstStation();
    const book = emptyBook();
    const board = stationBoard(context(), book, station);
    const taken = board[1]!;
    acceptJob(1, station.id, taken.id, book);
    expect(completeJob(context(), station, book)).toBe(taken.reward);
    expect(book.tasks[1]).toBeUndefined();
    const after = stationBoard(context(), book, station);
    expect(after).toHaveLength(3);
    expect(after[1]!.id).not.toBe(taken.id);
    expect(after[0]).toEqual(board[0]);
  });
});

describe("tow handling", () => {
  it("pulls the craft only while the 80 unit line is taut", () => {
    const tow = { x: 50, y: 0 };
    pullTow({ x: 0, y: 0 }, tow);
    expect(tow).toEqual({ x: 50, y: 0 });
    pullTow({ x: -100, y: 0 }, tow);
    expect(tow.x).toBeCloseTo(-20);
    expect(tow.y).toBeCloseTo(0);
  });

  it("scales Ada's current handling: top speed 0.65, speed changes 2, turns 1.5", () => {
    const physics = shipTuning(ECONOMY, CONTENT, newGameState().economy.levels).physics;
    expect(towing({}, physics)).toBe(physics);
    expect(towing({ tow: { x: 0, y: 0 } }, physics)).toEqual({
      ...physics,
      accelerationSeconds: physics.accelerationSeconds * 2,
      brakingSeconds: physics.brakingSeconds * 2,
      maxSpeed: physics.maxSpeed * 0.65,
      turnSeconds: physics.turnSeconds * 1.5,
    });
    // The base engine's 175 tows at 113.75.
    expect(towing({ tow: { x: 0, y: 0 } }, physics).maxSpeed).toBeCloseTo(113.75, 9);
  });

  it("slows a flight with a craft in tow", () => {
    const run = (tow: boolean) => {
      const { flight, model } = docked();
      model.state.docked = null;
      flight.player = { x: 0, y: 0 };
      // Each launch draws a random flight seed, so scenery near the origin could slow either
      // run; clear space leaves the tow as the only difference.
      flight.objects = [];
      flight.shots = [];
      if (tow) {
        flight.tow = { x: 0, y: 0 };
      }
      for (let step = 0; step < 120; step++) {
        stepFlight(CONTENT, 1 / 60, { ...idle, move: { x: 1, y: 0 } }, flight);
        flight.dangerFor = 0;
      }
      return Math.hypot(flight.velocity.x, flight.velocity.y);
    };
    expect(run(true)).toBeLessThan(run(false) * 0.66);
  });
});

describe("jobs in play", () => {
  it("show the held job at the top of every board in its galaxy, marked Active", () => {
    const { model } = docked();
    const held = take(model, "survey");
    const sites = stationsNear(ECONOMY, 1, 30_000, { x: 0, y: 0 }).filter(
      ({ id }) => id !== held.station,
    );
    const capabilities = new Set<boolean>();
    for (const site of sites) {
      ensureStation(CONTENT, site.id, model.state.flight!);
      model.state.docked = site.id;
      const services = model.stationServices!;
      capabilities.add(services.jobs);
      expect(services.heldTask).toBe(true);
      const rows = model.jobBoard();
      expect(rows[0]).toMatchObject({ id: held.id, state: "held" });
      if (services.jobs) {
        expect(rows.length).toBeGreaterThan(1);
        expect(rows.slice(1).every(({ state }) => state === "busy")).toBe(true);
        expect(model.acceptJob(rows[1]!.id)).toBe("busy");
      } else {
        expect(rows).toHaveLength(1);
        expect(model.acceptJob(held.id)).toBe("missing");
      }
      expect(model.jobObjective).toBe(model.jobText(held).title);
    }
    expect(capabilities).toEqual(new Set([true, false]));
    const nonJobs = sites.find(({ id }) => {
      model.state.docked = id;
      return !model.stationServices!.jobs;
    })!;
    model.state.docked = nonJobs.id;
    // Dropping returns it to the board that offered it.
    expect(model.dropJob()).toBe(true);
    model.state.docked = held.station;
    expect(model.jobBoard().some(({ id, state }) => id === held.id && state === "offer")).toBe(
      true,
    );
  });

  it("complete a survey on charting its landmark: notice, reward, refill and a lore line", () => {
    const { model } = docked();
    const held = take(model, "survey");
    const stardust = model.state.economy.stardust;
    expectJobIndicatorRange(model, held.target);
    flyTo(model, held.target);
    expect(model.state.progress[1].charted).toContain(held.target.id);
    // Charting and the completed job count toward Cartographer and Helping Hand.
    expect(model.state.achievements.charted[1]).toEqual([held.target.id]);
    expect(model.state.achievements.jobs).toBe(1);
    expect(model.state.achievements.unlocked).toContain("helpingHand");
    expect(model.state.tasks[1]).toBeUndefined();
    expect(model.state.economy.stardust).toBe(stardust + held.reward);
    expect(model.state.notice).toBe(`Job complete: +${held.reward} Stardust`);
    const board = model.state.jobs.boards[1]![held.station]!;
    expect(board).toHaveLength(3);
    expect(board.some(({ id }) => id === held.id)).toBe(false);
    // The lore line waits under the notice, then shows after the new place's reaction, which was
    // asked for first; a world's drone warning and Penny may each come before both.
    model.dismissNotice();
    const heard = listen(model, held.target, 120);
    expect(heard).toContain("jobLore:1:0");
    expect(heard.indexOf("reaction:mapped")).toBeLessThan(heard.indexOf("jobLore:1:0"));
  });

  it("mark the job's target on the Map and show charted landmarks there by name", () => {
    const { model } = docked();
    const held = take(model, "survey");
    const title = model.jobObjective!;
    const site = landmarkSites(1).find(({ id }) => id === held.target.id)!;
    // Surveys name their landmark.
    expect(title).toBe(`Chart the ${label(site.name)}`);
    // An uncharted landmark is not on the Map, so the target shows as the job's own spot.
    expect(model.map?.places.find(({ job }) => job)).toMatchObject({
      kind: "job",
      label: title,
      travel: false,
      x: site.x,
      y: site.y,
    });
    const before = model.map!.mapped;
    flyTo(model, site);
    const charted = model.map!.places.find(({ id }) => id === site.id)!;
    expect(charted).toMatchObject({ job: false, kind: "landmark", travel: false });
    expect(charted.label).toBe(label(site.name));
    expect(model.map!.places.some(({ job }) => job)).toBe(false);
    expect(model.map!.mapped).toBeGreaterThanOrEqual(before);
  });

  it("mark a delivery's station on the Map once known, and show the Job line's objective", () => {
    const { model, station } = docked();
    model.state.progress[1].stations.push(station.id);
    model.state.tasks[1] = {
      carrying: false,
      id: "job:map",
      item: "seeds",
      kind: "job",
      reward: 15,
      station: station.id,
      target: { id: "growers", x: 0, y: 0 },
      type: "delivery",
    };
    model.undock();
    // Without the item, Ada goes back to the issuing station, which the Map marks.
    expect(model.map?.places.find(({ id }) => id === station.id)?.job).toBe(true);
    expect(model.jobObjective).toBe("Deliver seeds to the growers' outpost");
  });

  it("tow a rescue: Tow within 120, Travel refused, the tow saved and returned on Return home", () => {
    const { model, station } = docked();
    model.state.progress[1].stations.push(station.id);
    const held = take(model, "rescue");
    const flight = model.state.flight!;
    flyTo(model, { x: held.target.x + 121, y: held.target.y });
    expect(model.contextLabel).not.toBe("Tow");
    flyTo(model, { x: held.target.x + 100, y: held.target.y });
    expect(model.contextAction).toBe("tow");
    expect(model.contextLabel).toBe("Tow");
    flyTo(model, { x: held.target.x + 100, y: held.target.y }, use);
    expect(flight.tow).toEqual({ x: held.target.x, y: held.target.y });
    expect(model.towing).toBe(true);
    expect(model.state.dialogue?.context).toBe("tow");
    model.choose("continue");
    expect(model.jobScenery).toMatchObject({ craft: flight.tow, towing: true });
    // Out of danger, so towing alone refuses Travel.
    flight.dangerFor = 0;
    model.teleport(station.id);
    expect(model.state.notice).toBe("Unavailable while towing.");
    expect(distance(flight.player, held.target)).toBeLessThan(200);
    // Closing the game resumes the tow exactly.
    expect(relaunch(CONTENT, model.save()).state.flight!.tow).toEqual(flight.tow);
    flight.dangerFor = 0;
    model.returnHome();
    expect(model.state.flight).toBeNull();
    expect(model.state.tasks[1]).toEqual(held);
    model.startGalaxy(1);
    expect(model.jobScenery).toMatchObject({
      craft: { x: held.target.x, y: held.target.y },
      towing: false,
    });
  });

  it("launch a mid-flight save on the start screen; Continue resumes that flight exactly", () => {
    const { model, station } = docked();
    model.state.progress[1].stations.push(station.id);
    const held = take(model, "rescue");
    flyTo(model, { x: held.target.x + 100, y: held.target.y }, use);
    const flight = model.state.flight!;
    expect(flight.tow).not.toBeNull();
    flight.dangerFor = 4;
    expect(model.inDanger).toBe(true);
    model.state.notice = "Unavailable while towing.";
    const saved = model.save();
    const launched = new GameModel(CONTENT, saved);
    expect(launched.screen).toBe("start");
    // The flight's notice waits with it.
    expect(launched.state.notice).toBe("");
    // Nothing in flight runs behind the start screen, and the save stays as it was.
    launched.step(1, { ...idle, move: { x: 1, y: 0 } });
    expect(launched.conversation).toBeNull();
    expect(launched.save()).toBe(saved);
    launched.continueGame();
    expect(launched.screen).toBe("space");
    expect(launched.state).toEqual(JSON.parse(saved));
    expect(launched.state.selectedGalaxy).toBe(1);
    expect(launched.state.flight!.player).toEqual(flight.player);
    expect(launched.state.flight!.tow).toEqual(flight.tow);
    expect(launched.towing).toBe(true);
    expect(launched.inDanger).toBe(true);
    expect(launched.state.notice).toBe("Unavailable while towing.");
    // Restart from that start screen clears the held flight with the rest of the story.
    const restarted = new GameModel(CONTENT, saved);
    restarted.restart();
    expect(restarted.screen).toBe("start");
    expect(JSON.parse(restarted.save())).toMatchObject({
      flight: null,
      mode: "home",
      notice: "",
      started: false,
      tasks: {},
    });
  });

  it("complete a rescue once the craft is within 400 of the issuing station", () => {
    const { model, station } = docked();
    const held = take(model, "rescue");
    const flight = model.state.flight!;
    flyTo(model, held.target, use);
    expect(flight.tow).toBeDefined();
    const stardust = model.state.economy.stardust;
    flight.tow = { x: station.x + 410, y: station.y };
    flyTo(model, { x: station.x + 480, y: station.y });
    expect(model.state.tasks[1]).toBeDefined();
    flight.tow = { x: station.x + 390, y: station.y };
    flyTo(model, { x: station.x + 460, y: station.y });
    expect(model.state.tasks[1]).toBeUndefined();
    expect(flight.tow).toBeUndefined();
    expect(model.state.economy.stardust).toBe(stardust + held.reward);
  });

  it("find a lost item: the area's indicator shows outside it and contact collects the item", () => {
    const { model } = docked();
    const held = take(model, "hunt");
    const spot = held.spot!;
    expectJobIndicatorRange(model, { ...held.target, id: `job:${held.id}` });
    expect(model.jobScenery.area).toEqual({ radius: 900, x: held.target.x, y: held.target.y });
    // The far side of the area from the item, so nothing is collected on entry.
    const away = Math.atan2(held.target.y - spot.y, held.target.x - spot.x);
    flyTo(model, {
      x: held.target.x + Math.cos(away) * 899,
      y: held.target.y + Math.sin(away) * 899,
    });
    expect((model.state.tasks[1] as HeldJob | undefined)?.entered).toBe(true);
    expect(model.indicatorTargets.some(({ kind }) => kind === "job")).toBe(false);
    flyTo(model, { x: spot.x + 161, y: spot.y });
    expect(model.jobScenery.glint).toBeNull();
    flyTo(model, { x: spot.x + 150, y: spot.y });
    expect(model.jobScenery.glint).toEqual(spot);
    const stardust = model.state.economy.stardust;
    flyTo(model, spot);
    expect(model.state.tasks[1]).toBeUndefined();
    // Collected at contact, with the event the view zips its glint into the ship from.
    expect(model.flightEvents).toContainEqual({
      id: "hunt-glint",
      lostItem: true,
      type: "collected",
      x: spot.x,
      y: spot.y,
    });
    expect(model.state.economy.stardust).toBe(stardust + held.reward);
  });

  it.each([
    [1, 60, 120],
    [2, 90, 160],
    [3, 120, 200],
  ])(
    "pulls a lost item at tractor level %i from within %i at %i a second, as every pickup",
    (level, radius, speed) => {
      const { model } = docked();
      const held = take(model, "hunt");
      const spot = { ...held.spot! };
      model.state.flight!.levels = { ...noLevels(), tractor: level };
      flyTo(model, { x: spot.x + radius - 1, y: spot.y });
      const moved = (model.state.tasks[1] as HeldJob).spot!;
      expect(moved.x).toBeCloseTo(spot.x + speed * 0.05, 6);
      expect(moved.y).toBeCloseTo(spot.y, 9);
      // Just outside the pull radius it stays put.
      const still = { ...moved };
      flyTo(model, { x: still.x + radius + 1, y: still.y });
      expect((model.state.tasks[1] as HeldJob).spot).toEqual(still);
    },
  );

  it("deliver to a station with Use before Dock, and replace a lost item on docking at the issuing station", () => {
    const { model, station } = docked();
    const target = stationsNear(ECONOMY, 1, 20_000, station).find(({ id }) => id !== station.id)!;
    model.state.tasks[1] = {
      carrying: true,
      id: "job:test",
      item: "seeds",
      kind: "job",
      reward: 15,
      station: station.id,
      target: { id: target.id, x: target.x, y: target.y },
      type: "delivery",
    };
    model.undock();
    expect(model.jobObjective).toBe("Deliver seeds to the station");
    model.state.flight!.dangerFor = 0;
    model.returnHome();
    // The item stays aboard with the job (rules.md "What each event keeps"), so the indicator
    // marks the destination.
    expect(model.state.tasks[1]?.carrying).toBe(true);
    model.startGalaxy(1);
    expectJobIndicatorRange(model, target);
    (model.state.tasks[1] as HeldJob).carrying = false;
    const reach = (site: Vec & { id: string }) => {
      ensureStation(CONTENT, site.id, model.state.flight!);
      flyTo(model, { x: site.x + 100, y: site.y });
    };
    // Docking at the issuing station replaces the lost item.
    reach(station);
    expect(model.contextAction).toBe("dock");
    model.interact();
    expect(model.state.docked).toBe(station.id);
    expect(model.state.tasks[1]?.carrying).toBe(true);
    model.undock();
    // At the target, Use delivers before Dock.
    const stardust = model.state.economy.stardust;
    reach(target);
    expect(model.contextAction).toBe("deliver");
    model.interact();
    expect(model.state.docked).toBeNull();
    expect(model.state.tasks[1]).toBeUndefined();
    expect(model.state.economy.stardust).toBe(stardust + 15);
    expect(model.state.dialogue?.context).toBe("deliver");
    model.choose("continue");
    expect(model.contextAction).toBe("dock");
  });

  it("report the towed craft, then a carried item, as what Ada has aboard", () => {
    const { model } = docked();
    const held = take(model, "rescue");
    expect(model.aboard).toBeNull();
    model.state.flight!.tow = { x: 1, y: 2 };
    expect(model.aboard).toEqual({ kind: "towing", name: carriedItemName(held.item) });
    expect(model.ship.aboard).toEqual(model.aboard);
    delete model.state.flight!.tow;
    (model.state.tasks[1] as HeldJob).carrying = true;
    expect(model.aboard).toEqual({ kind: "carrying", name: carriedItemName(held.item) });
    expect(model.aboard?.name).toMatch(/^[A-Z]/u);
    model.returnHome();
    expect(model.aboard).toBeNull();
  });

  it("give the Ship card the flight's ore, the levels, holodisks and owned weapons in HUD order", () => {
    const { model } = docked();
    model.state.flight!.cargo = 7;
    model.state.progress[1].holodisk = true;
    const ship = model.ship;
    expect(ship).toMatchObject({
      engine: 1,
      holodisks: 1,
      ore: 7,
      shield: 1,
      stardust: model.state.economy.stardust,
      tractor: 1,
    });
    expect(ship.weapons.map(({ id }) => id)).toEqual(model.weapons().map(({ id }) => id));
    expect(ship.weapons[0]).toEqual({ ammo: null, id: "laser", level: 1 });
  });

  it("restore saved jobs, charted landmarks and the tow, and reject invalid ones", () => {
    const { model } = docked();
    take(model, "rescue");
    model.state.progress[1].charted.push(landmarkSites(1)[0]!.id);
    model.state.flight!.tow = { x: 1, y: 2 };
    const saved = JSON.parse(model.save()) as ReturnType<typeof newGameState>;
    expect(restoreSave(saved)).toEqual(model.state);
    const badLandmark = structuredClone(saved);
    badLandmark.progress[1].charted = ["landmark:1:99"];
    expect(restoreSave(badLandmark)).toBeNull();
    const badJob = structuredClone(saved);
    (badJob.tasks[1] as HeldJob).station = "station:nowhere";
    expect(restoreSave(badJob)).toBeNull();
  });

  it("let Penny sense a lost item within 350 during her usual rest", () => {
    const { model } = docked();
    const held = take(model, "hunt");
    const spot = held.spot!;
    // Near an uncharted landmark Penny senses an ordinary point (it or a cache beside it), which
    // starts her 60 s rest.
    const landmark = landmarkSites(1).find(
      (site) => distance(site, spot) > 5000 && distance(site, held.target) > 5000,
    )!;
    const sensed = listen(model, { x: landmark.x + 600, y: landmark.y }, 2);
    expect(sensed.filter((instance) => instance.startsWith("penny:1:"))).toHaveLength(1);
    expect(listen(model, { x: spot.x + 340, y: spot.y }, 30)).toContain(`penny:1:job:${held.id}`);
  });
});

describe("job conversations", () => {
  it("include the tow, search and every galaxy's lore lines", () => {
    expect(CONVERSATIONS.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "job:towAttached",
        "job:searchEntered",
        "jobLore:1:0",
        "jobLore:1:1",
        "jobLore:2:0",
        "jobLore:2:1",
        "jobLore:3:0",
        "jobLore:3:1",
      ]),
    );
  });
});
