import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { KEEPERS, SETTLER_GREETING } from "../data/keepers.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import type { SectorId } from "../data/types.ts";
import { relaunch } from "../testing/launch.ts";
import { ensureStation } from "./flight.ts";
import { GameModel } from "./game.ts";
import { greetingLines, stationKeeper, stationRank } from "./keepers.ts";
import { restoreSave } from "./save.ts";
import { HUB_STATION, namesStation, stationsNear } from "./stations.ts";

const COPY = readFileSync(new URL("../../gameplay/player-copy.md", import.meta.url), "utf8");

/** A galaxy's stations within reach of its origin, nearest first. */
function nearest(sector: SectorId, count: number) {
  return stationsNear(ECONOMY, sector, 40_000, { x: 0, y: 0 })
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))
    .slice(0, count);
}

/** A Sunflower flight beside its nearest station, discovered, nothing else in reach. */
function beside() {
  const model = new GameModel(PROTOTYPE);
  model.state.prologueSeen = true;
  model.startSector(1);
  const flight = model.state.flight!;
  const [station] = nearest(1, 1);
  flight.objects = [];
  ensureStation(PROTOTYPE, station!.id, flight);
  model.state.progress[1].stations.push(station!.id);
  flight.player = { x: station!.x, y: station!.y };
  flight.dangerFor = 0;
  model.state.dialogue = null;
  return { model, station: station! };
}

/** Docks at the station beside Ada and returns the lines the welcome shows, tapping through. */
function dockAndRead(model: GameModel): string[] {
  model.interact();
  expect(model.state.docked).not.toBeNull();
  const lines = [model.stationGreeting!.line];
  while (model.stationGreeting!.more) {
    model.advanceGreeting();
    lines.push(model.stationGreeting!.line);
  }
  return lines;
}

describe("station keepers", () => {
  it("gives the nearest three stations of a galaxy its three keepers, by rank", () => {
    for (const sector of [1, 3] as const) {
      const sites = nearest(sector, 4);
      expect(sites.map(({ id }) => stationRank(ECONOMY, sector, id))).toEqual([0, 1, 2, 3]);
      expect(sites.map(({ id }) => stationKeeper(ECONOMY, sector, id)?.name)).toEqual([
        ...KEEPERS[sector]!.names,
        KEEPERS[sector]!.names[0],
      ]);
    }
  });

  it("keeps Cartwheel's hub for Quartz, with its own lines, and gives its stations Slate and Garnet", () => {
    const hub = stationKeeper(ECONOMY, 2, HUB_STATION)!;
    expect(hub.name).toBe("Quartz");
    expect(hub.greetings).toBe(KEEPERS[2]!.hub);
    expect(hub.greetings.first[0]).toBe("Welcome to the hub! Mind the dust. I'm the keeper here.");
    const names = nearest(2, 4).map(({ id }) => stationKeeper(ECONOMY, 2, id));
    expect(names.map((keeper) => keeper?.name)).toEqual(["Slate", "Garnet", "Slate", "Garnet"]);
    expect(names.every((keeper) => keeper?.greetings === KEEPERS[2]!.greetings)).toBe(true);
  });

  it("has no keeper in Black Eye or at a place that is no station", () => {
    expect(KEEPERS[6]).toBeUndefined();
    expect(stationKeeper(ECONOMY, 6, "station:0,1")).toBeNull();
    expect(stationKeeper(ECONOMY, 1, "nowhere")).toBeNull();
    expect(stationKeeper(ECONOMY, 1, HUB_STATION)).toBeNull();
    expect(namesStation(ECONOMY, 2, HUB_STATION)).toBe(true);
    expect(namesStation(ECONOMY, 1, HUB_STATION)).toBe(false);
  });

  it("shows the full greeting once, then one later line per docking in turn", () => {
    const greetings = KEEPERS[1]!.greetings;
    expect(greetingLines(greetings, 0)).toEqual(greetings.first);
    expect([1, 2, 3, 4].map((docked) => greetingLines(greetings, docked))).toEqual([
      [greetings.later[0]],
      [greetings.later[1]],
      [greetings.later[2]],
      [greetings.later[0]],
    ]);
  });

  it("carries the player copy's greeter lines", () => {
    for (const keepers of Object.values(KEEPERS)) {
      for (const line of [
        ...keepers.greetings.first,
        ...keepers.greetings.later,
        ...(keepers.hub ? [...keepers.hub.first, ...keepers.hub.later] : []),
      ]) {
        expect(COPY.replace(/\s+/gu, " ")).toContain(line);
      }
    }
    for (const line of SETTLER_GREETING) {
      expect(COPY.replace(/\s+/gu, " ")).toContain(line);
    }
  });
});

describe("a keeper's greeting at the station card", () => {
  it("greets the first docking with three lines a tap apart, the last staying", () => {
    const { model, station } = beside();
    const keeper = stationKeeper(ECONOMY, 1, station.id)!;
    expect(dockAndRead(model)).toEqual(keeper.greetings.first);
    expect(model.stationGreeting).toEqual({
      keeper: keeper.name,
      line: keeper.greetings.first[2],
      more: false,
    });
    model.advanceGreeting();
    expect(model.stationGreeting!.line).toBe(keeper.greetings.first[2]);
    // The docking counts as greeted once its first line shows.
    expect(model.state.progress[1].greetings[station.id]).toBe(1);
    model.undock();
    expect(model.stationGreeting).toBeNull();
  });

  it("greets later dockings with one line each, the three in turn", () => {
    const { model, station } = beside();
    const keeper = stationKeeper(ECONOMY, 1, station.id)!;
    dockAndRead(model);
    const later: string[][] = [];
    for (let docking = 0; docking < 4; docking++) {
      model.undock();
      later.push(dockAndRead(model));
    }
    expect(later).toEqual([
      [keeper.greetings.later[0]],
      [keeper.greetings.later[1]],
      [keeper.greetings.later[2]],
      [keeper.greetings.later[0]],
    ]);
    expect(model.state.progress[1].greetings[station.id]).toBe(5);
  });

  it("saves the greetings per station across a relaunch, and Restart clears them", () => {
    const { model, station } = beside();
    const keeper = stationKeeper(ECONOMY, 1, station.id)!;
    dockAndRead(model);
    model.undock();
    const reloaded = relaunch(PROTOTYPE, model.save());
    expect(reloaded.state.progress[1].greetings).toEqual({ [station.id]: 1 });
    reloaded.state.flight!.player = { x: station.x, y: station.y };
    reloaded.state.dialogue = null;
    expect(dockAndRead(reloaded)).toEqual([keeper.greetings.later[0]]);
    reloaded.undock();
    reloaded.backToTitle();
    reloaded.restart();
    expect(reloaded.state.progress[1].greetings).toEqual({});
  });

  it("rejects a save whose greetings name no station or count none", () => {
    const { model, station } = beside();
    dockAndRead(model);
    const saved = JSON.parse(model.save()) as { progress: Record<string, { greetings: unknown }> };
    expect(restoreSave(JSON.stringify(saved))).not.toBeNull();
    saved.progress["1"]!.greetings = { nowhere: 1 };
    expect(restoreSave(JSON.stringify(saved))).toBeNull();
    saved.progress["1"]!.greetings = { [station.id]: 0 };
    expect(restoreSave(JSON.stringify(saved))).toBeNull();
    // Saves reset before version 1: one from before greetings has no migration.
    delete saved.progress["1"]!.greetings;
    expect(restoreSave(JSON.stringify(saved))).toBeNull();
  });
});
