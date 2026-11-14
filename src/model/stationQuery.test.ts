import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { stationDistance } from "./legacyStations.ts";
import {
  type StationPlacementContext,
  worldInfillStationInCell,
  worldLegacyStationsNear,
  worldStationsNear,
} from "./stations.ts";
import type { Vec } from "./types.ts";
import { worldCellOrigin, worldCellsNear, worldGrid } from "./worldCells.ts";

function exhaustive(
  context: StationPlacementContext,
  galaxy: 1 | 2 | 3 | 4 | 5 | 6,
  radius: number,
  point: Vec,
) {
  const sites = worldLegacyStationsNear(context, ECONOMY, galaxy, radius, point);
  const grid = worldGrid(context, ECONOMY.station.cellSize);
  for (const cell of worldCellsNear(grid, radius + grid.pitch, point)) {
    const site = worldInfillStationInCell(context, ECONOMY, galaxy, cell);
    if (site && stationDistance(context, site, point) <= radius) {
      sites.push(site);
    }
  }
  return sites;
}

describe("station query candidate bounds", () => {
  it.each([1, 2, 3, 4, 5, 6] as const)(
    "preserves exhaustive galaxy %i query order at cell and wrapped boundaries",
    (galaxy) => {
      for (const context of [
        {},
        { worldSide: GALAXY_SIDE },
        { stationExclusions: [{ x: 12000, y: 0 }] },
      ] satisfies StationPlacementContext[]) {
        const grid = worldGrid(context, ECONOMY.station.cellSize);
        const origin = worldCellOrigin(grid, { x: 3, y: -2 });
        for (const point of [
          origin,
          { x: origin.x + grid.pitch / 2, y: origin.y },
          { x: GALAXY_SIDE / 2 - 1, y: -GALAXY_SIDE / 2 + 1 },
        ]) {
          for (const radius of [0, 1, 450, 4000]) {
            expect(worldStationsNear(context, ECONOMY, galaxy, radius, point)).toEqual(
              exhaustive(context, galaxy, radius, point),
            );
          }
        }
        const found = exhaustive(context, galaxy, 20000, { x: 0, y: 0 }).find((site) =>
          site.id.startsWith("station:infill:"),
        );
        expect(found).toBeDefined();
        for (const delta of [0, -1e-7, 1e-7]) {
          const point = { x: found!.x + 450 + delta, y: found!.y };
          expect(worldStationsNear(context, ECONOMY, galaxy, 450, point)).toEqual(
            exhaustive(context, galaxy, 450, point),
          );
        }
      }
    },
  );
});
