import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { encounterTable, type EnemyArchetype, enemyDefinition } from "../data/enemyCatalog.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP, PHANTOM_TUNING as T } from "../data/phantom.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { createEnemy } from "./ai/index.ts";
import { createUnpopulatedFlight } from "./flight.ts";
import { createFrigateEscorts, requiredFrigateEscortId } from "./frigateEscorts.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import { escortPackId } from "./geography.ts";
import type { PhantomFlight } from "./phantom.ts";
import {
  type PendingPhantomEncounter,
  readPendingPhantomEncounter,
  storePendingPhantomEncounter,
  takePendingPhantomEncounter,
  validPendingPhantomEncounter,
} from "./phantomRequiredPlans.ts";
import type { SpaceObject } from "./types.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "./world/index.ts";

function actor(
  id: string,
  archetype: EnemyArchetype,
  packId: string | null,
  routeId?: string,
  escortOf?: string,
): SpaceObject {
  const point = { x: 20000, y: 20000 };
  const definition = enemyDefinition(6, archetype, id, 2);
  const enemy = createEnemy(
    definition,
    { archetype, id, packId, phase: 0.4, weaponLevel: 2, ...(escortOf ? { escortOf } : {}) },
    point,
  );
  enemy.age = 4.5;
  enemy.primaryCooldown = 0.5;
  if (enemy.hardpoints[0]) {
    enemy.hardpoints[0].cooldown = 0.75;
    enemy.hardpoints[0].burst = 1;
  }
  return {
    ...point,
    enemy,
    hp: definition.hp,
    id,
    kind: "enemy",
    persistent: true,
    radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
    ...(routeId ? { routeId } : {}),
  };
}
function fixture(kind: PendingPhantomEncounter["kind"]) {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.selectedGalaxy = 6;
  model.state.unlocked = [1, 6];
  model.state.started = true;
  model.state.mode = "space";
  const progress = model.state.progress[6];
  progress.geography = freshGalaxyGeography(173);
  const flight = createUnpopulatedFlight(CONTENT, 6, 173, model.state.economy, 197);
  flight.topology = CURRENT_FLIGHT_TOPOLOGY;
  model.state.flight = flight;
  const state: PhantomFlight = {
    allies: [],
    allyTurn: 0,
    blockades: {},
    chatter: [],
    disabledCued: false,
    enemyIds: [],
    phase: kind === "flagship" ? "waves" : "blockades",
    resolvedIds: [],
    wave: kind === "flagship" ? T.waves : 0,
    waypoint: { x: 20000, y: 20000 },
  };
  flight.phantom = state;
  progress.phantom = { broken: [], flagshipKnown: false, freed: [] };
  const actors: SpaceObject[] = [];
  const group = (
    pack: string,
    archetype: EnemyArchetype,
    count: number,
    routeId?: string,
    escortOf?: string,
  ) => {
    const ids: string[] = [];
    for (let index = 0; index < count; index++) {
      const primary = actor(`${pack}:${index}`, archetype, pack, routeId, escortOf);
      ids.push(primary.id);
      actors.push(primary);
      if (archetype === "frigate") {
        actors.push(
          ...createFrigateEscorts(
            {
              encounterSeed: 197,
              galaxy: 6,
              id: (index) => requiredFrigateEscortId(primary.id, index),
              packId: escortPackId(pack),
              persistent: true,
              shipRadius: CONTENT.tuning.flight.shipRadius,
            },
            primary,
          ),
        );
      }
    }
    return ids;
  };
  let pending: PendingPhantomEncounter;
  const fighters = encounterTable(6).find((entry) => entry.archetype === "fighter")!.groupSize[0];
  if (kind === "blockades") {
    const blockades: Record<string, string[]> = {};
    for (const id of PHANTOM_DESTINATIONS) {
      blockades[id] = [
        ...group(`phantom:blockade:${id}:0`, "frigate", 1, id),
        ...group(`phantom:blockade:${id}:1`, "fighter", fighters, id),
        ...group(`phantom:blockade:${id}:2`, "fighter", fighters, id),
      ];
    }
    pending = { actors, blockades, kind };
  } else if (kind === "wave") {
    pending = {
      actors,
      enemyIds: [
        ...group("phantom:wave:1:0", "frigate", 1),
        ...group("phantom:wave:1:1", "fighter", fighters),
      ],
      kind,
      wave: 1,
    };
  } else {
    actors.push(actor(PHANTOM_FLAGSHIP, "capital", null));
    pending = {
      actors,
      enemyIds: [
        PHANTOM_FLAGSHIP,
        ...group("phantom:flagship:escorts", "fighter", T.escorts, undefined, PHANTOM_FLAGSHIP),
      ],
      kind,
    };
  }
  return { flight, model, pending, progress, state };
}

describe("hidden next Phantom encounters", () => {
  it.each(["blockades", "wave", "flagship"] as const)(
    "roundtrips exact %s actors without activation, phase advancement or random draws",
    (kind) => {
      const { flight, model, pending, progress, state } = fixture(kind);
      const before = structuredClone({
        combat: flight.combat,
        known: progress.known,
        markers: flight.markerActors,
        notables: flight.world.notables,
        state,
      });
      const stored = storePendingPhantomEncounter(flight, pending);
      expect(stored).toEqual(pending);
      expect(stored).not.toBe(pending);
      const random = vi.spyOn(crypto, "getRandomValues");
      random.mockClear();
      try {
        expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
        const other = structuredClone(pending);
        other.actors[0]!.enemy!.age = 0;
        expect(storePendingPhantomEncounter(flight, other)).toBe(stored);
        expect(readPendingPhantomEncounter(flight)).toBe(stored);
        expect(takePendingPhantomEncounter(flight)).toBe(stored);
        expect(takePendingPhantomEncounter(flight)).toBeNull();
        expect(random).not.toHaveBeenCalled();
      } finally {
        random.mockRestore();
      }
      expect(flight.objects).toEqual([]);
      expect({
        combat: flight.combat,
        known: progress.known,
        markers: flight.markerActors,
        notables: flight.world.notables,
        state,
      }).toEqual(before);
      expect(createUnpopulatedFlight(CONTENT, 6, 173, undefined, 198).phantom).toBeUndefined();
    },
  );
  it("reserves only the next wave while preserving current wave history and casualties", () => {
    const { flight, model, pending, state } = fixture("wave");
    if (pending.kind !== "wave") {
      throw Error("wave fixture");
    }
    state.phase = "waves";
    state.wave = 1;
    state.allyTurn = 0;
    const prior = "phantom:wave:1:0:0";
    state.enemyIds = [prior];
    state.resolvedIds = [prior];
    flight.world.notables[prior] = null;
    pending.wave = 2;
    pending.enemyIds = pending.enemyIds.map((id) =>
      id.replace("phantom:wave:1:", "phantom:wave:2:"),
    );
    for (const actor of pending.actors) {
      actor.id = actor.id.replace("phantom:wave:1:", "phantom:wave:2:");
      actor.enemy!.id = actor.id;
      if (actor.enemy!.packId) {
        actor.enemy!.packId = actor.enemy!.packId.replace("phantom:wave:1:", "phantom:wave:2:");
      }
      if (actor.enemy!.escortOf) {
        actor.enemy!.escortOf = actor.enemy!.escortOf.replace("phantom:wave:1:", "phantom:wave:2:");
      }
    }
    storePendingPhantomEncounter(flight, pending);
    expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
    expect(takePendingPhantomEncounter(flight)).toEqual(pending);
    expect(state.phase).toBe("waves");
    expect(state.wave).toBe(1);
    expect(state.enemyIds).toEqual([prior]);
    expect(state.resolvedIds).toEqual([prior]);
    expect(flight.world.notables[prior]).toBeNull();
  });
  it("rejects skipped waves, reversed primary order, foreign supports and malformed full actors", () => {
    const { flight, model, pending, state } = fixture("wave");
    storePendingPhantomEncounter(flight, pending);
    const saved = model.saveDocument();
    for (const change of [
      (p: PendingPhantomEncounter) => {
        if (p.kind === "wave") {
          p.wave = 2;
        }
      },
      (p: PendingPhantomEncounter) => {
        if (p.kind === "wave") {
          p.enemyIds = [...p.enemyIds].reverse();
        }
      },
      (p: PendingPhantomEncounter) => {
        p.actors = [...p.actors, p.actors[0]!];
      },
      (p: PendingPhantomEncounter) => {
        p.actors[0]!.enemy!.disabled = true;
      },
      (p: PendingPhantomEncounter) => {
        p.actors[0]!.enemy!.weaponLevel = 4 as never;
      },
      (p: PendingPhantomEncounter) => {
        p.actors[1]!.enemy!.escortOf = "unknown";
      },
    ]) {
      const invalid = structuredClone(saved);
      change(invalid.flight!.phantom!.pendingEncounter!);
      expect(restoreSave(invalid)).toBeNull();
    }
    // Zero installed followers is valid; an unreferenced or malformed follower is not.
    const solo = structuredClone(pending);
    solo.actors = solo.actors.filter((actor) => actor.role !== "frigateEscort");
    expect(validPendingPhantomEncounter(state, solo)).toBe(true);
    state.phase = "salvaged";
    expect(validPendingPhantomEncounter(state, pending)).toBe(false);
  });
  it("rejects duplicate active, retained, tombstoned and marker ownership without consuming pending actors", () => {
    const { flight, model, pending } = fixture("wave");
    storePendingPhantomEncounter(flight, pending);
    const saved = model.saveDocument(),
      id = pending.actors[0]!.id;
    const loaded = structuredClone(saved);
    loaded.flight!.objects.push(structuredClone(pending.actors[0]!));
    expect(restoreSave(loaded)).toBeNull();
    for (const object of [structuredClone(pending.actors[0]!), null]) {
      const invalid = structuredClone(saved);
      invalid.flight!.world.notables[id] = object;
      expect(restoreSave(invalid)).toBeNull();
    }
    const marked = structuredClone(saved);
    marked.flight!.markerActors = { encounterSeed: 197, knowledge: { [id]: "sensed" } };
    expect(restoreSave(marked)).toBeNull();
    flight.world.notables[id] = null;
    expect(() => takePendingPhantomEncounter(flight)).toThrow("Invalid or shared");
    expect(readPendingPhantomEncounter(flight)).not.toBeNull();
  });
  it("requires exactly the unbroken blockade settlements and preserves optional legacy absence", () => {
    const { flight, model, pending, progress } = fixture("blockades");
    storePendingPhantomEncounter(flight, pending);
    const invalid = structuredClone(model.saveDocument());
    invalid.progress[6].phantom!.broken = [PHANTOM_DESTINATIONS[0]];
    expect(restoreSave(invalid)).toBeNull();
    const missing = structuredClone(model.saveDocument());
    const p = missing.flight!.phantom!.pendingEncounter!;
    if (p.kind === "blockades") {
      p.blockades = {};
    }
    expect(restoreSave(missing)).toBeNull();
    delete flight.phantom!.pendingEncounter;
    expect(restoreSave(model.save())).toEqual(model.state);
    expect(progress.phantom!.broken).toEqual([]);
  });
});
