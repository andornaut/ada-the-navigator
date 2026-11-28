import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { createFlight } from "./flight/index.ts";
import { GameModel } from "./game.ts";
import { worldSyncFlightRegion } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import {
  acknowledgePhantomBlockadeRecovery,
  afterStepPhantom,
  initPhantom,
  phantomBlockadeAdmits,
  phantomBlockadeSignal,
  validPhantomFlight,
} from "./phantom/index.ts";
import type { GalaxyProgress } from "./types.ts";
import { flightWorldContext } from "./world/index.ts";

const settlement = PHANTOM_DESTINATIONS[0];

function blockade() {
  const progress: GalaxyProgress = {
    charted: [],
    deposited: 0,
    destroyedEnemies: 0,
    discoveries: 0,
    donated: {},
    explored: [],
    greetings: {},
    holodisk: false,
    introduced: false,
    known: [],
    opened: false,
    questComplete: false,
    questItem: null,
    resolved: false,
    revealed: [],
    stage: 0,
    stations: [],
  };
  const flight = createFlight(CONTENT, 6, 417, progress);
  const context = { content: CONTENT, flight, progress };
  initPhantom(context);
  const state = flight.phantom!;
  const objects = stationPopulationObjects(flight);
  const site = objects.find(({ id }) => id === settlement)!;
  const actors = state.blockades[settlement]!.map((id) =>
    objects.find((object) => object.id === id)!,
  );
  const leader = actors.find((actor) => actor.enemy?.archetype === "frigate")!;
  const escorts = objects.filter((actor) => actor.enemy?.escortOf === leader.id);
  const fighters = actors.filter((actor) => actor !== leader);
  const at = (offset: number) => ({ x: site.x + offset, y: site.y });
  const step = (time: number, from: number, to: number, seconds = 0.1) => {
    flight.player = at(to);
    flight.time = time;
    afterStepPhantom(context, seconds, at(from));
  };
  const phase = () => state.blockadePhases?.[settlement];
  const disableFighters = () => {
    for (const fighter of fighters.slice(1)) {
      fighter.enemy!.disabled = true;
    }
    const fleeing = fighters[0]!;
    Object.assign(fleeing, at(601));
    fleeing.enemy!.fleeing = true;
  };
  return {
    actors,
    at,
    context,
    disableFighters,
    escorts,
    fighters,
    flight,
    leader,
    phase,
    progress,
    state,
    step,
  };
}

it("warns on approach, releases the same fighter groups after 2.5 seconds and keeps the reserve out", () => {
  const f = blockade();
  expect(f.fighters.length).toBeGreaterThan(1);
  expect(f.escorts.length).toBeGreaterThan(0);
  expect(
    [...f.actors, ...f.escorts].every((actor) => !phantomBlockadeAdmits(f.flight, actor)),
  ).toBe(true);
  f.step(1, 1_010, 1_005);
  f.step(2, 900, 950);
  expect(f.phase()).toBeUndefined();
  f.step(3, 1_010, 990);
  expect(f.phase()).toEqual({ phase: "warning", until: 5.5, withdrawal: f.at(1_000) });
  expect(phantomBlockadeSignal(f.context, settlement)).toEqual({ phase: "warning", site: f.at(0) });
  f.step(5.49, 990, 980);
  expect(f.fighters.every((actor) => !phantomBlockadeAdmits(f.flight, actor))).toBe(true);
  f.step(5.5, 980, 970);
  expect(f.fighters.every((actor) => phantomBlockadeAdmits(f.flight, actor))).toBe(true);
  expect([f.leader, ...f.escorts].every((actor) => !phantomBlockadeAdmits(f.flight, actor))).toBe(
    true,
  );
  expect(validPhantomFlight(f.state)).toBe(true);
});

it("preserves a recovery opening through restore and releases the reserve only on a fresh inbound crossing", () => {
  const f = blockade();
  f.step(1, 1_010, 990);
  f.step(3.5, 990, 950);
  f.disableFighters();
  f.step(4, 400, 390);
  expect(f.phase()).toEqual({
    cuePending: true,
    phase: "recovery",
    until: 8,
    withdrawal: f.at(1_000),
  });
  expect(f.state.resolvedIds).toContain(f.fighters[0]!.id);
  expect(f.progress.phantom!.broken).not.toContain(settlement);
  expect(validPhantomFlight(JSON.parse(JSON.stringify(f.state)))).toBe(true);
  f.state.blockadePhases = structuredClone(f.state.blockadePhases!);
  expect(phantomBlockadeSignal(f.context, settlement)).toEqual({
    cuePending: true,
    phase: "recovery",
    site: f.at(0),
    withdrawal: f.at(1_000),
  });
  acknowledgePhantomBlockadeRecovery(f.context, settlement);
  expect(phantomBlockadeSignal(f.context, settlement)?.phase).toBe("recovery");
  expect(f.phase()).toEqual({ phase: "recovery", until: 8, withdrawal: f.at(1_000) });

  f.step(8.1, 510, 490, 0.4); // Inbound before the break ended.
  f.step(20, 490, 480); // Already inside.
  f.step(21, 490, 510); // Outbound.
  f.step(30, 510, 510); // Waiting outside remains safe.
  expect(f.phase()?.phase).toBe("recovery");
  expect([f.leader, ...f.escorts].every((actor) => !phantomBlockadeAdmits(f.flight, actor))).toBe(
    true,
  );
  f.step(31, 510, 490);
  expect(f.phase()).toEqual({ phase: "frigate" });
  expect([f.leader, ...f.escorts].every((actor) => phantomBlockadeAdmits(f.flight, actor))).toBe(
    true,
  );
  expect(f.fighters.every((actor) => !phantomBlockadeAdmits(f.flight, actor))).toBe(true);
  expect(f.progress.phantom!.broken).not.toContain(settlement);
  f.leader.enemy!.disabled = true;
  f.step(32, 490, 490);
  expect(f.progress.phantom!.broken).toContain(settlement);
  expect(f.progress.phantom!.freed).not.toContain(settlement);
  expect(f.state.phase).toBe("blockades");
});

it("leaves legacy saves eligible and rejects malformed or foreign phase state", () => {
  const f = blockade();
  delete f.state.blockadePhases;
  expect(validPhantomFlight(f.state)).toBe(true);
  expect(f.actors.every((actor) => phantomBlockadeAdmits(f.flight, actor))).toBe(true);
  expect(
    validPhantomFlight({ ...f.state, blockadePhases: { foreign: { phase: "frigate" } } }),
  ).toBe(false);
  expect(
    validPhantomFlight({
      ...f.state,
      blockadePhases: {
        [settlement]: { phase: "recovery", until: Infinity, withdrawal: f.at(1_000) },
      },
    }),
  ).toBe(false);
});

it("continues the saved warning without rebuilding or releasing the blockade actors", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  const progress = model.state.progress[6];
  progress.opened = true;
  model.startGalaxy(6);
  const flight = model.state.flight!;
  const site = stationPopulationObjects(flight).find(({ id }) => id === settlement)!;
  flight.player = { x: site.x + 990, y: site.y };
  worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
  flight.time = 1;
  afterStepPhantom({ content: CONTENT, flight, progress }, 0.1, { x: site.x + 1_010, y: site.y });
  const before = flight.phantom!.blockadePhases![settlement];
  expect(before?.phase).toBe("warning");
  const saved = model.save();
  expect(restoreSave(saved)?.flight?.phantom?.blockadePhases?.[settlement]).toEqual(before);
  const resumed = relaunch(CONTENT, saved).state.flight!;
  expect(resumed.phantom).toEqual(flight.phantom);
  const members = flight.phantom!.blockades[settlement]!;
  const actors = (current: typeof flight) =>
    stationPopulationObjects(current).filter((actor) => members.includes(actor.id));
  expect(actors(resumed)).toEqual(actors(flight));
  expect(actors(resumed).every((actor) => !phantomBlockadeAdmits(resumed, actor))).toBe(true);
});
