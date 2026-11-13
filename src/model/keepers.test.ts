import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { KEEPERS, PHANTOM_KEEPER_GREETINGS, SETTLER_GREETING } from "../data/keepers.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { relaunch } from "../testing/launch.ts";
import { ensureStation } from "./flight.ts";
import { GameModel } from "./game.ts";
import { greetingLines, stationKeeper, stationRank, worldStationKeeper } from "./keepers.ts";
import { restoreSave } from "./save.ts";
import { HUB_STATION, namesStation, stationsNear } from "./stations.ts";
import type { DialogueState } from "./types.ts";

const COPY = readFileSync(new URL("../../gameplay/player-copy.md", import.meta.url), "utf8");

/** A galaxy's stations within reach of its origin, nearest first. */
function nearest(galaxy: GalaxyNumber, count: number) {
  return stationsNear(ECONOMY, galaxy, 40_000, { x: 0, y: 0 })
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))
    .slice(0, count);
}

/** A Sunflower flight beside its nearest station, discovered, nothing else in reach. */
function beside() {
  const model = new GameModel(CONTENT);
  model.state.prologueSeen = true;
  model.startGalaxy(1);
  const flight = model.state.flight!;
  const [station] = nearest(1, 1);
  flight.objects = [];
  ensureStation(CONTENT, station!.id, flight);
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
  while (model.stationGreeting!.index < model.stationGreeting!.count - 1) {
    model.advanceGreeting();
    lines.push(model.stationGreeting!.line);
  }
  return lines;
}

describe("station keepers", () => {
  it("gives the nearest three stations of a galaxy its three keepers, by rank", () => {
    for (const galaxy of [1, 3] as const) {
      const sites = nearest(galaxy, 4);
      expect(sites.map(({ id }) => stationRank(ECONOMY, galaxy, id))).toEqual([0, 1, 2, 3]);
      expect(sites.map(({ id }) => stationKeeper(ECONOMY, galaxy, id)?.key)).toEqual([
        ...KEEPERS[galaxy]!.keepers,
        KEEPERS[galaxy]!.keepers[0],
      ]);
    }
  });

  it("keeps Cartwheel's hub for Quartz, with its own lines, and gives its stations Slate and Garnet", () => {
    const hub = stationKeeper(ECONOMY, 2, HUB_STATION)!;
    expect(hub.key).toBe("quartz");
    expect(hub.greetings).toBe(KEEPERS[2]!.hub);
    expect(hub.greetings.first[0]).toBe("Welcome to the hub! Mind the dust. I'm the keeper here.");
    const names = nearest(2, 4).map(({ id }) => stationKeeper(ECONOMY, 2, id));
    expect(names.map((keeper) => keeper?.key)).toEqual(["slate", "garnet", "slate", "garnet"]);
    expect(names.every((keeper) => keeper?.greetings === KEEPERS[2]!.greetings)).toBe(true);
  });

  it("has no keeper in Phantom or at a place that is no station", () => {
    expect(KEEPERS[6]).toBeUndefined();
    expect(stationKeeper(ECONOMY, 6, "station:0,1")).toBeNull();
    expect(stationKeeper(ECONOMY, 1, "nowhere")).toBeNull();
    expect(stationKeeper(ECONOMY, 1, HUB_STATION)).toBeNull();
    expect(namesStation(ECONOMY, 2, HUB_STATION)).toBe(true);
    expect(namesStation(ECONOMY, 1, HUB_STATION)).toBe(false);
  });

  it("keeps every real Phantom station generic until the explicit post-aftermath fact", () => {
    for (const station of nearest(6, 3)) {
      expect(stationKeeper(ECONOMY, 6, station.id)).toBeNull();
      expect(worldStationKeeper({}, ECONOMY, 6, station.id)).toBeNull();
      expect(worldStationKeeper({ phantomComplete: false }, ECONOMY, 6, station.id)).toBeNull();
      expect(worldStationKeeper({ phantomComplete: true }, ECONOMY, 6, station.id)).toEqual({
        greetings: PHANTOM_KEEPER_GREETINGS,
        key: "general",
      });
    }
  });

  it("accepts only real Phantom stations and leaves other galaxies' keeper assignments unchanged", () => {
    const complete = { phantomComplete: true };
    for (const id of [HUB_STATION, "flagship", "settlement:0,0", "station:01,0", "not-a-station"]) {
      expect(worldStationKeeper(complete, ECONOMY, 6, id)).toBeNull();
    }
    for (const galaxy of [1, 2, 3, 4, 5] as const) {
      const station = nearest(galaxy, 1)[0]!;
      expect(worldStationKeeper(complete, ECONOMY, galaxy, station.id)).toEqual(
        stationKeeper(ECONOMY, galaxy, station.id),
      );
    }
  });

  it("uses the approved Admiral first greeting and later cycle without advancing visits itself", () => {
    const station = nearest(6, 1)[0]!;
    const context = Object.freeze({ phantomComplete: true });
    const keeper = worldStationKeeper(context, ECONOMY, 6, station.id)!;
    expect(greetingLines(keeper.greetings, 0)).toEqual([
      "Ah. The navigator. Welcome to the Blurbs' station.",
      "I am helping mend their docks. It is slower than conquering, and better.",
      "Trade, or take a job. The Blurbs insist I say please.",
    ]);
    expect([1, 2, 3, 4].map((visits) => greetingLines(keeper.greetings, visits))).toEqual([
      ["Welcome back, Navigator."],
      ["The docks are nearly mended. Mind the scaffolding."],
      ["Astra still flies with you, I see. Good."],
      ["Welcome back, Navigator."],
    ]);
    expect(context).toEqual({ phantomComplete: true });
    for (const line of [...keeper.greetings.first, ...keeper.greetings.later]) {
      expect(COPY.replace(/\s+/gu, " ")).toContain(line);
    }
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
  it("enforces actual docked services before any purchase or new job mutation", () => {
    const { model } = beside();
    expect(model.stationServices).toBeNull();
    model.interact();
    const services = model.stationServices!;
    expect(services.exchange).toBe(true);
    expect([services.equipment, services.weaponsAmmo, services.jobs].filter(Boolean)).toHaveLength(
      1,
    );
    const before = model.save();
    if (!services.equipment) {
      expect(model.shopRows("ship")).toEqual([]);
      expect(model.buy({ kind: "track", track: "shield" })).toEqual({
        kind: "refused",
        reason: "notForSale",
      });
    }
    if (!services.weaponsAmmo) {
      expect(model.shopRows("weapons")).toEqual([]);
      expect(model.buy({ kind: "ammo", weapon: "rapidMissile" })).toEqual({
        kind: "refused",
        reason: "notForSale",
      });
    }
    if (!services.jobs) {
      expect(model.jobBoard()).toEqual([]);
      expect(model.acceptJob("unoffered")).toBe("missing");
    }
    expect(model.save()).toEqual(before);
    model.undock();
    expect(model.stationServices).toBeNull();
  });

  it("greets the first docking with three lines a tap apart, the last staying", () => {
    const { model, station } = beside();
    const keeper = stationKeeper(ECONOMY, 1, station.id)!;
    const lines = dockAndRead(model);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Welcome to Sunflower .+ Station\. I'm Pollen Goldwing of /);
    expect(lines[1]).toMatch(/ keeps humming\.$/);
    expect(lines[2]).toMatch(/(equipment for your ship|weapons and ammo|work on the board)/);
    expect(model.stationGreeting).toEqual({
      count: 3,
      displayName: model.stationGreeting!.displayName,
      index: 2,
      keeper: keeper.key,
      line: lines[2],
    });
    model.advanceGreeting();
    expect(model.stationGreeting!.line).toBe(lines[2]);
    // The docking counts as greeted once its first line shows.
    expect(model.state.progress[1].greetings[station.id]).toBe(1);
    model.undock();
    expect(model.stationGreeting).toBeNull();
  });

  it("restores the actual keeper and greeting on a docked reload without counting another visit", () => {
    const { model, station } = beside();
    const keeper = stationKeeper(ECONOMY, 1, station.id)!;
    model.interact();
    const first = model.stationGreeting!.line;
    const displayName = model.stationGreeting!.displayName;
    model.advanceGreeting();
    const second = model.stationGreeting!.line;
    const visits = structuredClone(model.state.progress[1].greetings);
    const loaded = relaunch(CONTENT, model.save());
    expect(loaded.stationGreeting).toEqual({
      count: 3,
      displayName,
      index: 0,
      keeper: keeper.key,
      line: first,
    });
    expect(loaded.state.progress[1].greetings).toEqual(visits);
    loaded.advanceGreeting();
    expect(loaded.stationGreeting?.line).toBe(second);
    loaded.undock();
    loaded.interact();
    const returning = loaded.stationGreeting!.line;
    const later = relaunch(CONTENT, loaded.save());
    expect(later.stationGreeting).toEqual({
      count: 1,
      displayName,
      index: 0,
      keeper: keeper.key,
      line: returning,
    });
    expect(later.state.progress[1].greetings[station.id]).toBe(2);
  });

  it.each([1, 2, 3, 4, 5] as const)(
    "exposes galaxy %i's actual station keeper key to the view",
    (galaxy) => {
      const model = new GameModel(CONTENT);
      model.state.unlocked = [...new Set([1, galaxy] as const)];
      model.startGalaxy(galaxy);
      const flight = model.state.flight!;
      for (const station of nearest(galaxy, 3)) {
        model.undock();
        model.state.dialogue = null;
        flight.objects = [];
        ensureStation(CONTENT, station.id, flight);
        model.state.progress[galaxy].stations.push(station.id);
        flight.player = { x: station.x, y: station.y };
        flight.dangerFor = 0;
        const arrivalDue = galaxy === 5 && !model.state.progress[5].introduced;
        model.interact();
        if (arrivalDue) {
          expect(model.state.docked).toBeNull();
          const arrival = model.state.dialogue as DialogueState | null;
          expect(arrival?.context).toBe("andromeda:arrival");
          expect(arrival?.choices.map(({ id }) => id)).toEqual(["continue"]);
          model.choose("continue");
          expect(model.state.progress[5].introduced).toBe(true);
          model.interact();
        }
        expect(model.state.docked).toBe(station.id);
        expect(model.stationGreeting?.keeper).toBe(stationKeeper(ECONOMY, galaxy, station.id)!.key);
      }
    },
  );

  it("greets later dockings with one line each, the three in turn", () => {
    const { model, station } = beside();
    dockAndRead(model);
    const later: string[][] = [];
    for (let docking = 0; docking < 4; docking++) {
      model.undock();
      later.push(dockAndRead(model));
    }
    expect(later).toEqual([
      ["Welcome back to Sunflower Glimmer Station, Navigator."],
      ["Pollen Goldwing of Sunflower Glimmer Station here. You can trade ore and Stardust here."],
      ["Back at Sunflower Glimmer Station! What do you need today?"],
      ["Welcome back to Sunflower Glimmer Station, Navigator."],
    ]);
    expect(model.state.progress[1].greetings[station.id]).toBe(5);
  });

  it("saves the greetings per station across a relaunch, and Restart clears them", () => {
    const { model, station } = beside();
    dockAndRead(model);
    model.undock();
    const reloaded = relaunch(CONTENT, model.save());
    expect(reloaded.state.progress[1].greetings).toEqual({ [station.id]: 1 });
    reloaded.state.flight!.player = { x: station.x, y: station.y };
    reloaded.state.dialogue = null;
    expect(dockAndRead(reloaded)).toEqual([
      "Welcome back to Sunflower Glimmer Station, Navigator.",
    ]);
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
