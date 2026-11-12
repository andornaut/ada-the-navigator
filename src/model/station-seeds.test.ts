import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { JOB_POOL } from "../data/jobs.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import type { SectorId } from "../data/types.ts";
import { playOpening } from "../testing/launch.ts";
import { ensureStation } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";

/** A flight in a galaxy docked at its station nearest the origin. */
function dockedIn(sector: SectorId): GameModel {
  const model = new GameModel(PROTOTYPE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [1, 2, 3, 4, 5, 6] });
  model.startSector(sector);
  playOpening(model);
  model.state.dialogue = null;
  const site = stationsNear(ECONOMY, sector, 40000, { x: 0, y: 0 }).sort(
    (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y),
  )[0]!;
  const flight = model.state.flight!;
  ensureStation(PROTOTYPE, site.id, flight);
  model.state.progress[sector].stations = [site.id];
  flight.objects = flight.objects.filter((object) => !object.enemy);
  flight.player = { x: site.x + 100, y: site.y };
  flight.velocity = { x: 0, y: 0 };
  flight.dangerFor = 0;
  model.interact();
  expect(model.state.docked).toBe(site.id);
  return model;
}

describe("stations in Needle, Andromeda and Phantom", () => {
  it.each([4, 5] as const)("galaxy %i's stations offer its pool's jobs", (sector) => {
    const model = dockedIn(sector);
    const board = model.jobBoard().filter((row) => row.kind === "job");
    expect(board).toHaveLength(3);
    const offers = model.state.jobs.boards[sector]![model.state.docked!]!;
    const pool = JOB_POOL[sector]!;
    for (const offer of offers) {
      const items =
        offer.type === "delivery"
          ? pool.delivery
          : offer.type === "rescue"
            ? pool.craft
            : offer.type === "hunt"
              ? pool.lost
              : null;
      if (items) {
        expect(items, offer.type).toContain(offer.item);
      }
    }
    // Saves keep the galaxy's board and its docked station.
    const restored = restoreSave(model.save());
    expect(restored?.docked).toBe(model.state.docked);
    expect(restored?.jobs.boards[sector]).toEqual(model.state.jobs.boards[sector]);
  });

  it("offers only surveys and rescues of a traveler's pod at Phantom's stations", () => {
    const model = dockedIn(6);
    model.jobBoard();
    const offers = model.state.jobs.boards[6]![model.state.docked!]!;
    expect(offers).toHaveLength(3);
    expect(offers.every(({ type }) => type === "survey" || type === "rescue")).toBe(true);
    for (const offer of offers) {
      expect(offer.reward).toBe(offer.type === "survey" ? 20 : 50);
      if (offer.type === "rescue") {
        expect(offer.item).toBe("a traveler's pod");
      }
    }
  });
});
