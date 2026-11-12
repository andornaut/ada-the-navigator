import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { playOpening } from "../testing/launch.ts";
import { ensureStation } from "./flight.ts";
import { GameModel } from "./game.ts";
import { type BoardContext, type JobBook, rerollBoards, stationBoard } from "./jobs.ts";
import { stationsNear } from "./stations.ts";
import type { JobOffer } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const sites = stationsNear(ECONOMY, 1, 40000, { x: 0, y: 0 }).sort(
  (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y),
);

/** Sunflower's flight docked at its station nearest the origin, its two nearest discovered. */
function docked(): GameModel {
  const model = new GameModel(PROTOTYPE);
  Object.assign(model.state, { prologueSeen: true, started: true });
  model.startSector(1);
  playOpening(model);
  model.state.dialogue = null;
  const flight = model.state.flight!;
  flight.objects = flight.objects.filter((object) => !object.enemy);
  for (const site of sites.slice(0, 2)) {
    ensureStation(PROTOTYPE, site.id, flight);
  }
  model.state.progress[1].stations = sites.slice(0, 2).map(({ id }) => id);
  flight.player = { x: sites[0]!.x + 100, y: sites[0]!.y };
  flight.dangerFor = 0;
  model.interact();
  expect(model.state.docked).toBe(sites[0]!.id);
  return model;
}

describe("job board review decisions", () => {
  it("refuses Travel here while a delivery's item is aboard", () => {
    const model = docked();
    const delivery = model.jobBoard().find((row) => row.type === "delivery");
    if (!delivery) {
      return;
    }
    expect(model.acceptJob(delivery.id)).toBe("accepted");
    model.undock();
    // Accepting loads the item.
    expect(model.carrying).toBe(true);
    const before = { ...model.state.flight!.player };
    model.teleport(sites[1]!.id);
    expect(model.state.flight!.player).toEqual(before);
    expect(model.state.notice).toBe("Unavailable while carrying a delivery.");
  });

  it("re-rolls untaken offers at each new flight, keeping the held job", () => {
    const model = docked();
    const first = model.jobBoard().filter((row) => row.kind === "job");
    expect(first).toHaveLength(3);
    expect(model.acceptJob(first[0]!.id)).toBe("accepted");
    model.undock();
    model.state.flight!.dangerFor = 0;
    model.returnHome();
    model.startSector(1);
    const board = model.state.jobs.boards[1]![sites[0]!.id]!;
    // Only the held job is left until the board next shows, then it refills with new offers.
    expect(board.map(({ id }) => id)).toEqual([first[0]!.id]);
    const book: JobBook = model.state;
    rerollBoards(1, book);
    expect(book.jobs.boards[1]![sites[0]!.id]!.map(({ id }) => id)).toEqual([first[0]!.id]);
  });

  it("replaces an offer whose target an earlier offer in the galaxy already uses", () => {
    const [a, b] = sites;
    const survey = (id: string, station: string): JobOffer => ({
      id,
      item: "nebula",
      reward: 10,
      station,
      target: { id: "landmark:1:0", x: 0, y: 0 },
      type: "survey",
    });
    const book: JobBook = {
      jobs: {
        boards: { 1: { [a!.id]: [survey("job:1", a!.id)], [b!.id]: [survey("job:2", b!.id)] } },
        made: 3,
      },
      tasks: {},
    };
    const context: BoardContext = {
      hostiles: [],
      outposts: [],
      progress: { charted: [], stations: [] },
      sector: 1,
    };
    // The board read later in station order loses its duplicate.
    const [first, second] = [a!, b!].sort((x, y) => (x.id < y.id ? -1 : 1));
    expect(stationBoard(context, book, first!).map(({ id }) => id)).toContain(
      first!.id === a!.id ? "job:1" : "job:2",
    );
    const later = stationBoard(context, book, second!);
    expect(later.some(({ target }) => target.id === "landmark:1:0")).toBe(false);
  });

  it("ends a tow at any known station, not only the issuing one", () => {
    const model = docked();
    const rescue = model.jobBoard().find((row) => row.type === "rescue");
    if (!rescue) {
      return;
    }
    expect(model.acceptJob(rescue.id)).toBe("accepted");
    model.undock();
    const flight = model.state.flight!;
    const other = sites[1]!;
    flight.tow = { x: other.x + 100, y: other.y };
    flight.player = { x: other.x + 150, y: other.y };
    flight.velocity = { x: 0, y: 0 };
    flight.dangerFor = 0;
    model.step(0.05, idle);
    expect(model.state.tasks[1]).toBeUndefined();
  });

  it("drops 4 Stardust from a turret platform at position 1", () => {
    expect(ECONOMY.enemyStardust.platform).toBe(4);
  });
});
