import { describe, expect, it } from "vitest";

import { DESTINATIONS } from "../data/destinations.ts";
import { ECONOMY } from "../data/economy.ts";
import { LANDMARK_TUNING } from "../data/jobs.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/story-ships.ts";
import type { SectorId } from "../data/types.ts";
import { playOpening } from "../testing/launch.ts";
import { ensureDestination } from "./flight.ts";
import { galaxyRoute, GameModel } from "./game.ts";
import { landmarkSites } from "./landmarks.ts";
import {
  chartedChunk,
  CHARTING_RADIUS,
  chartingChunks,
  chunkId,
  galaxyMap,
  type LandmarkChart,
  type MapContext,
  NO_LANDMARKS,
  placeType,
  recordExplored,
  validExplored,
} from "./map.ts";
import { restoreSave } from "./save.ts";
import { stationInCell, stationsNear } from "./stations.ts";
import type { GameState, SectorProgress } from "./types.ts";

// A first flight in galaxy one with nothing discovered.
function flying() {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  playOpening(model);
  return model;
}

const inside = stationsNear(ECONOMY, 1, CHARTING_RADIUS, { x: 0, y: 0 });
// A station beyond the charted area, three cells past its radius.
const beyond = stationInCell(ECONOMY, 1, {
  x: Math.ceil(CHARTING_RADIUS / ECONOMY.station.cellSize) + 3,
  y: 0,
})!;

function context(
  model: GameModel,
  progress: MapContext["progress"],
  landmarks: LandmarkChart = NO_LANDMARKS,
  objective: string | null = null,
  job: MapContext["job"] = null,
  quests: MapContext["quests"] = { job: null, story: "", storyComplete: false },
): MapContext {
  return {
    catalog: ECONOMY,
    chunkSize: PROTOTYPE.tuning.chunkSize,
    destinations: galaxyRoute(1),
    explored: [],
    flight: model.state.flight!,
    holodisk: null,
    job,
    label: (id, kind) => `${kind}:${id}`,
    landmarks,
    objective,
    progress,
    quests,
  };
}

describe("galaxy map", () => {
  it("charts a circle of 25000 world units holding several stations", () => {
    expect(CHARTING_RADIUS).toBe(25000);
    expect(inside.length).toBeGreaterThan(3);
    expect(Math.hypot(beyond.x, beyond.y)).toBeGreaterThan(CHARTING_RADIUS);
  });

  it("shows only Ada with nothing discovered, never an undiscovered place", () => {
    const model = flying();
    const flight = model.state.flight!;
    ensureDestination(PROTOTYPE, "growers", flight);
    const map = galaxyMap(context(model, { known: [], stations: [] }));
    expect(map.places).toEqual([]);
    expect(map.mapped).toBe(0);
    expect(map.player).toEqual(flight.player);
  });

  it("shows each discovered destination at its place, marking the objective once mapped", () => {
    const model = flying();
    const growers = ensureDestination(PROTOTYPE, "growers", model.state.flight!);
    ensureDestination(PROTOTYPE, "workshop", model.state.flight!);
    const map = galaxyMap(
      context(model, { known: ["growers"], stations: [] }, NO_LANDMARKS, "growers"),
    );
    expect(map.places).toEqual([
      {
        id: "growers",
        job: false,
        kind: "destination",
        label: "destination:growers",
        objective: true,
        symbol: "growers",
        travel: true,
        x: growers.x,
        y: growers.y,
      },
    ]);
    // An objective not yet mapped never shows.
    const unmapped = galaxyMap(
      context(model, { known: ["growers"], stations: [] }, NO_LANDMARKS, "workshop"),
    );
    expect(unmapped.places.map(({ id, objective }) => [id, objective])).toEqual([
      ["growers", false],
    ]);
  });

  it("shows discovered stations, counting only those in the charted area", () => {
    const model = flying();
    const near = inside[0]!;
    const map = galaxyMap(context(model, { known: [], stations: [near.id, beyond.id] }));
    expect(map.places.map(({ id, kind, x, y }) => [id, kind, x, y])).toEqual([
      [near.id, "station", near.x, near.y],
      [beyond.id, "station", beyond.x, beyond.y],
    ]);
    const total = galaxyRoute(1).length + inside.length;
    expect(map.mapped).toBe(Math.floor(100 / total));
  });

  it("counts discovered destinations and charted-area stations as the percent mapped", () => {
    const model = flying();
    for (const id of galaxyRoute(1)) {
      ensureDestination(PROTOTYPE, id, model.state.flight!);
    }
    const all = galaxyMap(
      context(model, { known: [...galaxyRoute(1)], stations: inside.map(({ id }) => id) }),
    );
    expect(all.mapped).toBe(100);
    const half = galaxyMap(context(model, { known: ["growers"], stations: [inside[0]!.id] }));
    expect(half.mapped).toBe(Math.floor((100 * 2) / (galaxyRoute(1).length + inside.length)));
  });

  it("charts landmarks through their slot: shown, counted, and never a Travel target", () => {
    const model = flying();
    const landmarks: LandmarkChart = {
      charted: [{ id: "comet", kind: "nebula", label: "Comet", x: 1000, y: 2000 }],
      total: 2,
    };
    const map = galaxyMap(context(model, { known: [], stations: [] }, landmarks));
    expect(map.places).toEqual([
      {
        id: "comet",
        job: false,
        kind: "landmark",
        label: "Comet",
        objective: false,
        symbol: "nebula",
        travel: false,
        x: 1000,
        y: 2000,
      },
    ]);
    expect(map.mapped).toBe(Math.floor(100 / (galaxyRoute(1).length + inside.length + 2)));
  });

  it("marks the held job's target: a shown place, or its own spot that counts for nothing", () => {
    const model = flying();
    const growers = ensureDestination(PROTOTYPE, "growers", model.state.flight!);
    const onPlace = galaxyMap(
      context(model, { known: ["growers"], stations: [] }, NO_LANDMARKS, null, {
        area: null,
        id: "growers",
        label: "Deliver seeds to Grower",
        type: "delivery",
        x: growers.x,
        y: growers.y,
      }),
    );
    expect(onPlace.places.map(({ id, job, kind }) => [id, job, kind])).toEqual([
      ["growers", true, "destination"],
    ]);
    const spot = galaxyMap(
      context(model, { known: ["growers"], stations: [] }, NO_LANDMARKS, null, {
        area: 900,
        id: "job:7",
        label: "Find a lost toolbox",
        type: "hunt",
        x: 5000,
        y: 0,
      }),
    );
    // A hunt's own spot carries its job type's glyph and the search area around it.
    expect(spot.searchArea).toEqual({ radius: 900, x: 5000, y: 0 });
    expect(onPlace.searchArea).toBeNull();
    expect(spot.places.at(-1)).toEqual({
      id: "job:7",
      job: true,
      jobType: "hunt",
      kind: "job",
      label: "Find a lost toolbox",
      objective: false,
      symbol: "job",
      travel: false,
      x: 5000,
      y: 0,
    });
    expect(spot.mapped).toBe(onPlace.mapped);
  });

  it("lists the Quests lines in order, each story and job line tied to its mapped target", () => {
    const model = flying();
    const growers = ensureDestination(PROTOTYPE, "growers", model.state.flight!);
    const job = {
      area: null,
      id: "growers",
      label: "Deliver seeds to Grower",
      type: "delivery",
      x: growers.x,
      y: growers.y,
    } as const;
    const quests = {
      job: "Deliver seeds to Grower",
      story: "Find the growers.",
      storyComplete: false,
    };
    const unmapped = galaxyMap(
      context(model, { known: [], stations: [] }, NO_LANDMARKS, "growers", null, quests),
    );
    expect(unmapped.quests).toEqual([
      { kind: "story", target: null, text: "Find the growers." },
      { kind: "job", target: null, text: "Deliver seeds to Grower" },
    ]);
    const mapped = galaxyMap(
      context(model, { known: ["growers"], stations: [] }, NO_LANDMARKS, "growers", job, quests),
    );
    expect(mapped.quests).toEqual([
      { kind: "story", target: "growers", text: "Find the growers." },
      { kind: "job", target: "growers", text: "Deliver seeds to Grower" },
    ]);
    // A job's own spot is its line's target.
    const spot = {
      area: 900,
      id: "job:7",
      label: "Find a lost toolbox",
      type: "hunt",
      x: 5000,
      y: 0,
    } as const;
    expect(
      galaxyMap(
        context(model, { known: [], stations: [] }, NO_LANDMARKS, null, spot, {
          job: "Find a lost toolbox",
          story: "",
          storyComplete: false,
        }),
      ).quests,
    ).toEqual([{ kind: "job", target: "job:7", text: "Find a lost toolbox" }]);
  });

  it("says the story is complete once resolved, hints at job boards and lists nothing else", () => {
    const model = flying();
    const station = [inside[0]!.id];
    const done = { job: null, story: "Return to Earth when ready.", storyComplete: true };
    expect(
      galaxyMap(context(model, { known: [], stations: station }, NO_LANDMARKS, null, null, done))
        .quests,
    ).toEqual([{ kind: "storyComplete" }, { kind: "jobBoards" }]);
    // The mining hub's board counts once it is a discovered station, though it draws as its
    // destination, not a second station place.
    const hub = galaxyMap(
      context(model, { known: [], stations: ["hub"] }, NO_LANDMARKS, null, null, done),
    );
    expect(hub.quests).toEqual([{ kind: "storyComplete" }, { kind: "jobBoards" }]);
    expect(hub.places.some(({ id }) => id === "hub")).toBe(false);
    // No job board hint without a discovered station; nothing to do lists no lines.
    const none = { job: null, story: "", storyComplete: false };
    expect(
      galaxyMap(context(model, { known: [], stations: [] }, NO_LANDMARKS, null, null, none)).quests,
    ).toEqual([]);
    expect(model.map?.quests).toEqual([{ kind: "story", target: null, text: model.objective }]);
  });

  it("gives each place its symbol and keeps Ada's facing, the landmark pips and explored chunks", () => {
    const model = flying();
    const flight = model.state.flight!;
    ensureDestination(PROTOTYPE, "workshop", flight);
    ensureDestination(PROTOTYPE, "growers", flight);
    const map = galaxyMap(
      context(
        model,
        { known: ["workshop", "growers"], stations: [inside[0]!.id] },
        {
          charted: [{ id: "w", kind: "wreck", label: "Sleepy Tug", x: 0, y: 0 }],
          total: 12,
        },
      ),
    );
    expect(map.places.map(({ symbol }) => symbol)).toEqual([
      "workshop",
      "growers",
      "station",
      "wreck",
    ]);
    expect(map.landmarks).toEqual({ charted: 1, total: 12 });
    expect(map.facing).toEqual(flight.facing);
    // The flight starts in chunk 0,0, which the galaxy's explored record holds.
    const size = PROTOTYPE.tuning.chunkSize;
    expect(model.state.progress[1].explored).toEqual(["0,0"]);
    expect(model.map?.explored).toEqual([{ x: size / 2, y: size / 2 }]);
  });

  it("is the model's Map in flight, labelled as the destinations list, and absent at home", () => {
    const model = flying();
    expect(model.map?.places).toEqual([]);
    expect(model.map?.mapped).toBe(0);
    model.state.progress[1].stations = [inside[0]!.id];
    expect(model.map?.places.map(({ label }) => label)).toEqual([PROTOTYPE.labels.station]);
    model.returnHome();
    expect(model.map).toBeNull();
  });

  it("shows a landmark once Ada flies close, counts it and never travels there", () => {
    const model = flying();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    flight.objects = [];
    flight.velocity = { x: 0, y: 0 };
    const landmark = landmarkSites(1)[0]!;
    flight.player = { x: landmark.x + LANDMARK_TUNING.chart / 2, y: landmark.y };
    model.step(0.05, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    expect(model.state.progress[1].charted).toContain(landmark.id);
    // The landmark's own name, from its player-string key.
    const label = PROTOTYPE.labels[landmark.name];
    expect(label).toBeTruthy();
    expect(model.map?.places).toEqual([
      {
        id: landmark.id,
        job: false,
        kind: "landmark",
        label,
        objective: false,
        symbol: landmark.kind,
        travel: false,
        x: landmark.x,
        y: landmark.y,
      },
    ]);
    const total = galaxyRoute(1).length + inside.length + landmarkSites(1).length;
    expect(model.map?.mapped).toBe(Math.floor(100 / total));
    const at = { ...flight.player };
    model.teleport(landmark.id);
    expect(model.state.flight!.player).toEqual(at);
  });

  it("places every landmark inside the charted area, so the whole galaxy can be mapped", () => {
    expect(LANDMARK_TUNING.radius).toBeLessThanOrEqual(CHARTING_RADIUS);
    for (const sector of [1, 2, 3] as const) {
      const sites = landmarkSites(sector);
      expect(sites, `galaxy ${sector}`).toHaveLength(LANDMARK_TUNING.count);
      for (const site of sites) {
        expect(Math.hypot(site.x, site.y), site.id).toBeLessThanOrEqual(CHARTING_RADIUS);
      }
    }
  });

  it("shows the known holodisk waypoint as a Holodisk chip without Travel until it is recovered", () => {
    const model = new GameModel(PROTOTYPE);
    model.state.unlocked = [1, 2, 3];
    model.startSector(3);
    Object.assign(model.state.progress[3], { introduced: true, questComplete: true, stage: 5 });
    model.state.dialogue = null;
    const flight = model.state.flight!;
    expect(model.map?.places.some(({ kind }) => kind === "holodisk")).toBe(false);
    model.step(0.01, IDLE);
    const disk = flight.objects.find((o) => o.kind === "destination" && o.id === "holodisk")!;
    expect(model.map?.places.find(({ kind }) => kind === "holodisk")).toEqual({
      id: "holodisk",
      job: false,
      kind: "holodisk",
      label: "Lost holodisk",
      objective: false,
      symbol: "holodisk",
      travel: false,
      x: disk.x,
      y: disk.y,
    });
    model.state.progress[3].holodisk = true;
    expect(model.map?.places.some(({ kind }) => kind === "holodisk")).toBe(false);
  });

  it("gives every kind of place a symbol and a type line kind, except a job's own spot", () => {
    const symbols = [
      "beacon",
      "destination",
      "growers",
      "holodisk",
      "job",
      "nebula",
      "salvagers",
      "station",
      "workshop",
      "wreck",
    ] as const;
    expect(symbols.map((symbol) => [symbol, placeType({ symbol })])).toEqual([
      ["beacon", "beacon"],
      ["destination", "story"],
      ["growers", "outpost"],
      ["holodisk", "holodisk"],
      ["job", null],
      ["nebula", "nebula"],
      ["salvagers", "outpost"],
      ["station", "station"],
      ["workshop", "outpost"],
      ["wreck", "wreck"],
    ]);
  });

  it("keeps the explored chunks across flights and clears them on Restart", () => {
    const size = PROTOTYPE.tuning.chunkSize;
    const far = { x: 5000, y: 3000 };
    const centre = { x: 9.5 * size, y: 5.5 * size };
    const model = flying();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    flight.objects = [];
    flight.velocity = { x: 0, y: 0 };
    flight.player = { ...far };
    model.step(0.05, IDLE);
    expect(model.state.progress[1].explored).toContain(chunkId(size, far));
    // An encounter the far chunk rolls would keep Ada in danger and refuse the trip home.
    flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
    flight.dangerFor = 0;
    model.returnHome();
    model.startSector(1);
    playOpening(model);
    // A new flight starts at the origin, and the record still reveals the far chunk.
    expect(model.state.flight!.player).toEqual({ x: 0, y: 0 });
    expect(model.map?.explored).toContainEqual(centre);
    model.returnHome();
    const reloaded = new GameModel(PROTOTYPE, model.save());
    expect(reloaded.state.progress[1].explored).toContain(chunkId(size, far));
    reloaded.restart();
    expect(reloaded.screen).toBe("start");
    expect(reloaded.state.progress[1].explored).toEqual([]);
    reloaded.startSector(1);
    playOpening(reloaded);
    expect(reloaded.map?.explored).not.toContainEqual(centre);
  });

  it("records only charting-disc chunks, once each, bounded by the disc's 7500 chunks", () => {
    const size = PROTOTYPE.tuning.chunkSize;
    expect(chartingChunks(size)).toBe(7500);
    const explored: string[] = [];
    recordExplored(size, explored, { x: 10, y: 10 });
    recordExplored(size, explored, { x: 20, y: 20 });
    recordExplored(size, explored, { x: CHARTING_RADIUS + size, y: 0 });
    expect(explored).toEqual(["0,0"]);
    expect(chartedChunk(size, { x: 48, y: 0 })).toBe(true);
    expect(chartedChunk(size, { x: 49, y: 0 })).toBe(false);
    expect(validExplored(size, ["0,0", "-3,7"])).toBe(true);
    expect(validExplored(size, [])).toBe(true);
    for (const bad of [["0,0", "0,0"], ["49,0"], ["0, 0"], ["01,0"], [0], "0,0", null]) {
      expect(validExplored(size, bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("loads a save without an explored record as empty, and refuses an invalid record", () => {
    const saved = JSON.parse(new GameModel(PROTOTYPE).save()) as GameState;
    delete (saved.progress[2] as Partial<SectorProgress>).explored;
    expect(restoreSave(saved)?.progress[2].explored).toEqual([]);
    saved.progress[2].explored = ["0,0", "1,-1"];
    expect(restoreSave(saved)?.progress[2].explored).toEqual(["0,0", "1,-1"]);
    for (const bad of [["0,0", "0,0"], ["200,0"], ["x"], {}]) {
      saved.progress[2].explored = bad as string[];
      expect(restoreSave(saved), JSON.stringify(bad)).toBeNull();
    }
  });

  it("shows a discovered destination wherever a new flight places it, fog or not", () => {
    const model = flying();
    model.state.progress[1].known = ["growers"];
    model.returnHome();
    model.startSector(1);
    playOpening(model);
    const growers = model.state.flight!.objects.find((o) => o.id === "growers")!;
    expect(model.map?.places.find(({ id }) => id === "growers")).toMatchObject({
      x: growers.x,
      y: growers.y,
    });
  });

  it("keeps every seeded station and landmark, and each story place from them, 1020 apart", () => {
    for (const sector of [1, 2, 3] as const) {
      const fixed = seeded(sector);
      expect(fixed.length, `galaxy ${sector}`).toBeGreaterThan(LANDMARK_TUNING.count);
      expect(tooClose(fixed), `galaxy ${sector}`).toEqual([]);
      const placed = launched(sector).filter(({ id }) => !waiting(sector, id));
      const across = placed.flatMap((place) =>
        tooClose([place, ...fixed]).filter((pair) => pair.startsWith(`${place.id} `)),
      );
      expect(across, `galaxy ${sector}`).toEqual([]);
    }
  });

  it("spaces a launch's mapped places 1020 apart and its story destinations 1200 apart", () => {
    for (const sector of [1, 2, 3] as const) {
      const story = launched(sector).filter(({ id }) => !waiting(sector, id));
      // Sunflower's three outposts, Cartwheel's hub, and the whale, family and waypoint.
      expect(story.length, `galaxy ${sector}`).toBe(sector === 2 ? 1 : 3);
      expect(tooClose([...story, ...seeded(sector)]), `galaxy ${sector}`).toEqual([]);
      expect(tooClose(story, PROTOTYPE.tuning.storySpacing), `galaxy ${sector}`).toEqual([]);
    }
  });

  it("leaves Cartwheel's waiting miner and visitors off the Map, with the hub standing for them", () => {
    const model = new GameModel(PROTOTYPE);
    model.state.unlocked = [1, 2];
    model.startSector(2);
    model.state.dialogue = null;
    const flight = model.state.flight!;
    for (const id of ["miner", "visitors"]) {
      ensureDestination(PROTOTYPE, id, flight);
    }
    const context = {
      catalog: ECONOMY,
      chunkSize: PROTOTYPE.tuning.chunkSize,
      destinations: galaxyRoute(2),
      explored: [],
      flight,
      holodisk: null,
      job: null,
      label: (id: string) => id,
      landmarks: NO_LANDMARKS,
      objective: "miner",
      progress: { known: ["hub", "miner", "visitors"], stations: [] },
      quests: { job: null, story: "", storyComplete: false },
    } satisfies MapContext;
    const map = galaxyMap(context);
    expect(map.places.map(({ id, objective }) => [id, objective])).toEqual([["hub", true]]);
    // The percent counts the hub alone of the three.
    const none = galaxyMap({ ...context, progress: { known: [], stations: [] } });
    const hub = galaxyMap({ ...context, progress: { known: ["hub"], stations: [] } });
    expect(map.mapped).toBe(hub.mapped);
    expect(hub.mapped).toBeGreaterThanOrEqual(none.mapped);
  });

  it("reads each story destination's Map kind from its data: the hub a Station", () => {
    // Every destination of galaxies one to three, the holodisk waypoint included, declares one.
    const ids = [...([1, 2, 3] as const).flatMap((sector) => galaxyRoute(sector)), "holodisk"];
    expect(Object.keys(DESTINATIONS).sort()).toEqual([...new Set(ids)].sort());
    expect(DESTINATIONS.hub?.mapKind).toBe("station");
    expect(placeType({ symbol: DESTINATIONS.hub!.mapKind })).toBe("station");
    for (const story of ["whale", "family"]) {
      expect(placeType({ symbol: DESTINATIONS[story]!.mapKind }), story).toBe("story");
    }
    // The Map's hub place reads its kind from that field.
    const model = new GameModel(PROTOTYPE);
    model.state.unlocked = [1, 2];
    model.startSector(2);
    model.state.dialogue = null;
    model.state.progress[2].known = ["hub"];
    ensureDestination(PROTOTYPE, "hub", model.state.flight!);
    expect(model.map?.places.find(({ id }) => id === "hub")).toMatchObject({
      kind: "destination",
      symbol: DESTINATIONS.hub?.mapKind,
      travel: true,
    });
  });

  it("has stations outside the charting disc in every galaxy: the catalog fills every cell", () => {
    for (const sector of [1, 2, 3] as const) {
      const far = stationInCell(ECONOMY, sector, {
        x: Math.ceil(CHARTING_RADIUS / ECONOMY.station.cellSize) + 3,
        y: 0,
      });
      expect(far && Math.hypot(far.x, far.y), `galaxy ${sector}`).toBeGreaterThan(CHARTING_RADIUS);
    }
  });
});

const IDLE = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

// Gameplay keeps every mapped place at least 1020 world units apart (art/map.md scale rule).
const SPACING = 1020;
function tooClose(
  places: readonly { id: string; x: number; y: number }[],
  spacing = SPACING,
): string[] {
  return places.flatMap((a, index) =>
    places.slice(index + 1).flatMap((b) => {
      const apart = Math.hypot(a.x - b.x, a.y - b.y);
      return apart < spacing ? [`${a.id} ${b.id} ${Math.round(apart)}`] : [];
    }),
  );
}
// Cartwheel's miner and visitors wait beside the hub and are not map places.
const waiting = (sector: SectorId, id: string) =>
  sector === CARTWHEEL_STORY_SHIPS.sector && Object.hasOwn(CARTWHEEL_STORY_SHIPS.destinations, id);
// A galaxy's seeded places: its stations in the charting disc and its landmarks.
function seeded(sector: SectorId) {
  return [
    ...stationsNear(ECONOMY, sector, CHARTING_RADIUS, { x: 0, y: 0 }),
    ...landmarkSites(sector),
  ];
}
// A launch that knows the whole route, and galaxy three's waypoint, places them from the start.
function launched(sector: SectorId) {
  const model = new GameModel(PROTOTYPE);
  model.state.unlocked = [1, 2, 3];
  model.startSector(sector);
  const flight = model.state.flight!;
  return [...galaxyRoute(sector), ...(sector === 3 ? ["holodisk"] : [])].map((id) => {
    const { x, y } = ensureDestination(PROTOTYPE, id, flight);
    return { id, x, y };
  });
}
