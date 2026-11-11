import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { ensureDestination } from "./flight.ts";
import { galaxyRoute, GameModel } from "./game.ts";
import {
  CHARTING_RADIUS,
  galaxyMap,
  type LandmarkChart,
  type MapContext,
  NO_LANDMARKS,
} from "./map.ts";
import { stationInCell, stationsNear } from "./stations.ts";
import { playOpening } from "./test-launch.ts";

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
): MapContext {
  return {
    catalog: ECONOMY,
    destinations: galaxyRoute(1),
    flight: model.state.flight!,
    label: (id, kind) => `${kind}:${id}`,
    landmarks,
    objective,
    progress,
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
        kind: "destination",
        label: "destination:growers",
        objective: true,
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
      charted: [{ id: "comet", label: "Comet", x: 1000, y: 2000 }],
      total: 2,
    };
    const map = galaxyMap(context(model, { known: [], stations: [] }, landmarks));
    expect(map.places).toEqual([
      {
        id: "comet",
        kind: "landmark",
        label: "Comet",
        objective: false,
        travel: false,
        x: 1000,
        y: 2000,
      },
    ]);
    expect(map.mapped).toBe(Math.floor(100 / (galaxyRoute(1).length + inside.length + 2)));
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
});
