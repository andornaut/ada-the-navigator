import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import {
  INDICATOR_KINDS,
  INDICATOR_SOURCES,
  type IndicatorContext,
  type IndicatorSource,
  indicatorTargets,
  objectiveDestination,
  questItemDestination,
} from "./indicators.ts";
import { stationIndicatorTarget, stationsNear } from "./stations.ts";
import type { SpaceObject } from "./types.ts";

const object = (id: string, kind: SpaceObject["kind"], x: number, extra = {}): SpaceObject => ({
  hp: 1,
  id,
  kind,
  radius: 10,
  x,
  y: 0,
  ...extra,
});

// Off screen but within direction-indicator range.
const FAR = 800;
const ORIGIN = { x: 0, y: 0 };
// Every station near Ada, discovered, so the station source marks none unless a test says so.
const NEAR_STATIONS = stationsNear(ECONOMY, 1, ECONOMY.station.indicatorRange, ORIGIN).map(
  ({ id }) => id,
);

function context(overrides: Partial<IndicatorContext> = {}): IndicatorContext {
  return {
    flight: {
      objects: [
        object("growers", "destination", FAR),
        object("workshop", "destination", -FAR),
        object("salvagers", "destination", 2 * FAR),
        object("holodisk", "destination", 3 * FAR),
        object("station:1:0", "station", 400),
        object("drone", "enemy", 300),
        object("cache", "pickup", 200, { role: "discovery" }),
        object("ore", "resource", 250, { role: "discovery" }),
      ],
      player: ORIGIN,
    },
    galaxy: 1,
    holodiskWaypoint: false,
    job: null,
    objective: "workshop",
    progress: { known: ["growers", "workshop"], stations: NEAR_STATIONS },
    questItem: null,
    ...overrides,
  };
}
const marked = (from: IndicatorContext, sources = INDICATOR_SOURCES) =>
  indicatorTargets(sources, from).map(({ id, kind }) => `${kind}:${id}`);

describe("direction indicators", () => {
  it("mark the current objective's mapped destination within range", () => {
    expect(marked(context())).toEqual(["objective:workshop"]);
  });

  it.each(INDICATOR_KINDS)("limits %s radially from Ada, including the 3000 boundary", (kind) => {
    const player = { x: 100, y: -200 };
    const sources = {
      ...INDICATOR_SOURCES,
      [kind]: () => [
        { id: "inside", kind, x: player.x + 1799.9, y: player.y + 2400 },
        { id: "boundary", kind, x: player.x + 1800, y: player.y + 2400 },
        { id: "outside", kind, x: player.x + 1800.1, y: player.y + 2400 },
      ],
    };
    const from = context({ flight: { objects: [], player }, objective: null });
    expect(
      indicatorTargets(sources, from)
        .filter((target) => target.kind === kind)
        .map(({ id }) => id),
    ).toEqual(["inside", "boundary"]);
  });

  it("removes distant real destinations and jobs while keeping nearby targets", () => {
    const from = context({
      flight: {
        objects: [
          object("growers", "destination", 3000),
          object("workshop", "destination", -3001),
          object("holodisk", "destination", 3001),
        ],
        player: ORIGIN,
      },
      holodiskWaypoint: true,
      job: { id: "job", kind: "job", x: 0, y: -3001 },
      questItem: "growers",
    });
    expect(marked(from)).toEqual(["questItem:growers"]);
    expect(marked({ ...from, job: { id: "job", kind: "job", x: 0, y: -3000 } })).toEqual([
      "questItem:growers",
      "job:job",
    ]);
  });

  it("do not reveal an objective's destination before it is mapped", () => {
    expect(marked(context({ objective: "salvagers" }))).toEqual([]);
  });

  it("mark where a carried quest item goes, once when it is also the objective", () => {
    expect(marked(context({ objective: "growers", questItem: "workshop" }))).toEqual([
      "objective:growers",
      "questItem:workshop",
    ]);
    expect(marked(context({ questItem: "workshop" }))).toEqual(["objective:workshop"]);
  });

  it("mark the holodisk waypoint within range only until it is recovered", () => {
    expect(marked(context({ holodiskWaypoint: true, objective: null }))).toEqual([
      "holodisk:holodisk",
    ]);
    expect(marked(context({ objective: null }))).toEqual([]);
  });

  it("never mark ordinary enemies, optional discovery caches or resource rocks", () => {
    const all = marked(context({ holodiskWaypoint: true, questItem: "growers" }));
    expect(all).toEqual(["holodisk:holodisk", "objective:workshop", "questItem:growers"]);
    expect(all.some((target) => /drone|cache|ore/u.test(target))).toBe(false);
  });

  it("mark the hub while a mining objective sends Ada to deposit there", () => {
    const mining = context({
      flight: { objects: [object("hub", "destination", FAR)], player: ORIGIN },
      galaxy: 2,
      objective: objectiveDestination(
        2,
        { holodisk: false, introduced: true, questComplete: false, questItem: null, stage: 1 },
        false,
      ),
      progress: { known: ["hub"], stations: NEAR_STATIONS },
    });
    expect(marked(mining)).toEqual(["objective:hub"]);
  });

  it("mark a station only while it is undiscovered and within 3000 of Ada", () => {
    const range = ECONOMY.station.indicatorRange;
    expect(range).toBe(3000);
    // Points across galaxy one: any station marked is the nearest undiscovered site in range.
    for (let i = 0; i < 40; i++) {
      const player = { x: i * 1234 - 20_000, y: i * 777 - 15_000 };
      const sites = stationsNear(ECONOMY, 1, range, player);
      const targets = INDICATOR_SOURCES.station({
        ...context(),
        flight: { objects: [], player },
        progress: { known: [], stations: [] },
      });
      const [target] = targets;
      if (sites.length === 0) {
        expect(targets).toEqual([]);
        continue;
      }
      expect(target).toBeDefined();
      expect(Math.hypot(target!.x - player.x, target!.y - player.y)).toBeLessThanOrEqual(range);
      expect(
        INDICATOR_SOURCES.station({
          ...context(),
          flight: { objects: [], player },
          progress: { known: [], stations: sites.map(({ id }) => id) },
        }),
      ).toEqual([]);
    }
  });

  it("mark the nearest undiscovered station within the indicator range", () => {
    // A point a little way from galaxy one's nearest station site.
    const [site] = stationsNear(ECONOMY, 1, 50 * ECONOMY.station.indicatorRange, ORIGIN);
    expect(site).toBeDefined();
    const near = { x: site!.x + ECONOMY.station.indicatorRange / 2, y: site!.y };
    const expected = stationIndicatorTarget(ECONOMY, 1, [], near);
    const at = (stations: string[]) =>
      context({
        flight: { objects: [], player: near },
        objective: null,
        progress: { known: [], stations },
      });
    expect(marked(at([]))).toEqual([`station:${expected!.id}`]);
    expect(marked(at([expected!.id]))).not.toContain(`station:${expected!.id}`);
    const far = { x: site!.x + 3 * ECONOMY.station.indicatorRange, y: site!.y };
    expect(INDICATOR_SOURCES.station({ ...at([]), flight: { objects: [], player: far } })).toEqual(
      stationIndicatorTarget(ECONOMY, 1, [], far)
        ? [expect.objectContaining({ kind: "station" })]
        : [],
    );
  });

  it("let a source be swapped without touching the others", () => {
    const station: IndicatorSource = ({ flight }) =>
      flight.objects
        .filter((entry) => entry.kind === "station")
        .map(({ id, x, y }) => ({ id, kind: "station", x, y }));
    expect(marked(context(), { ...INDICATOR_SOURCES, station })).toEqual([
      "objective:workshop",
      "station:station:1:0",
    ]);
  });
});

describe("objective destinations", () => {
  const progress = (stage: number, extra = {}) => ({
    holodisk: false,
    introduced: true,
    questComplete: false,
    questItem: null,
    stage,
    ...extra,
  });

  it("follow galaxy one's delivery chain and its holodisk handover", () => {
    expect(objectiveDestination(1, progress(0, { introduced: false }), false)).toBe("growers");
    expect(objectiveDestination(1, progress(1), false)).toBe("growers");
    expect(objectiveDestination(1, progress(1, { questItem: "food" }), false)).toBe("workshop");
    expect(objectiveDestination(1, progress(2, { questItem: "toolkit" }), false)).toBe("salvagers");
    expect(objectiveDestination(1, progress(3, { questItem: "parts" }), false)).toBe("workshop");
    expect(objectiveDestination(1, progress(4, { questComplete: true }), false)).toBe("workshop");
    expect(
      objectiveDestination(1, progress(4, { holodisk: true, questComplete: true }), false),
    ).toBeNull();
  });

  it("follow galaxy two's hub, miner and visitors", () => {
    expect(objectiveDestination(2, progress(1), false)).toBe("hub");
    expect(objectiveDestination(2, progress(2), false)).toBe("hub");
    expect(objectiveDestination(2, progress(2), true)).toBe("miner");
    expect(objectiveDestination(2, progress(3), true)).toBe("visitors");
    expect(objectiveDestination(2, progress(4), true)).toBe("hub");
    expect(objectiveDestination(2, progress(5, { questComplete: true }), true)).toBe("hub");
  });

  it("follow galaxy three's whale and family, leaving the holodisk to its waypoint", () => {
    expect(objectiveDestination(3, progress(1), false)).toBe("whale");
    expect(objectiveDestination(3, progress(3), false)).toBe("family");
    expect(objectiveDestination(3, progress(4), false)).toBe("whale");
    expect(objectiveDestination(3, progress(5, { questComplete: true }), false)).toBeNull();
  });

  it("send each carried quest item to its outpost", () => {
    expect(questItemDestination({ questItem: "food" })).toBe("workshop");
    expect(questItemDestination({ questItem: "toolkit" })).toBe("salvagers");
    expect(questItemDestination({ questItem: "parts" })).toBe("workshop");
    expect(questItemDestination({ questItem: null })).toBeNull();
  });
});

describe("space view", () => {
  it("draws no in-world name labels", () => {
    const game = new URL("../game/", import.meta.url);
    const sources = readdirSync(game)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => readFileSync(new URL(file, game), "utf8"));
    expect(sources.filter((source) => /\.add\s*\.text\(/u.test(source))).toEqual([]);
  });
});

it("uses the shortest seam image only with explicit torus context, without disclosing unknown targets", () => {
  const side = 1_152_000;
  const player = { x: side / 2 - 100, y: 0 };
  const destination = object("workshop", "destination", -side / 2 + 100);
  const periodic = context({ flight: { objects: [destination], player }, worldSide: side });
  const targets = indicatorTargets({ ...INDICATOR_SOURCES, station: () => [] }, periodic);
  expect(targets).toEqual([{ id: "workshop", kind: "objective", x: side / 2 + 100, y: 0 }]);
  expect(
    indicatorTargets(
      { ...INDICATOR_SOURCES, station: () => [] },
      context({ flight: periodic.flight }),
    ),
  ).toEqual([]);
  expect(
    indicatorTargets(
      { ...INDICATOR_SOURCES, station: () => [] },
      { ...periodic, progress: { known: [], stations: [] } },
    ),
  ).toEqual([]);
  expect(destination.x).toBe(-side / 2 + 100);
});
