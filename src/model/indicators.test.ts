import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import {
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

// Far away, so only an indicator could point there.
const FAR = 50_000;
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
      ],
      player: ORIGIN,
    },
    holodiskWaypoint: false,
    objective: "workshop",
    progress: { known: ["growers", "workshop"], stations: NEAR_STATIONS },
    questItem: null,
    sector: 1,
    ...overrides,
  };
}
const marked = (from: IndicatorContext, sources = INDICATOR_SOURCES) =>
  indicatorTargets(sources, from).map(({ id, kind }) => `${kind}:${id}`);

describe("direction indicators", () => {
  it("mark the current objective's mapped destination at any distance", () => {
    expect(marked(context())).toEqual(["objective:workshop"]);
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

  it("mark the holodisk waypoint at any distance only until it is recovered", () => {
    expect(marked(context({ holodiskWaypoint: true, objective: null }))).toEqual([
      "holodisk:holodisk",
    ]);
    expect(marked(context({ objective: null }))).toEqual([]);
  });

  it("never mark ordinary enemies or optional discoveries", () => {
    const all = marked(context({ holodiskWaypoint: true, questItem: "growers" }));
    expect(all.some((target) => /drone|cache/u.test(target))).toBe(false);
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
