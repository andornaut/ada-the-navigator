import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { createEnemy } from "./ai/index.ts";
import { createUnpopulatedFlight } from "./flight/index.ts";
import { createFrigateEscorts, requiredFrigateEscortId } from "./frigateEscorts.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import { escortPackId } from "./geography.ts";
import { readRequiredPlan, requiredPlanActors } from "./requiredEncounterPlans.ts";
import {
  readRequiredRolePlan,
  requiredRolePlanConsistent,
  storeRequiredRolePlan,
  takeRequiredRolePlan,
} from "./requiredRolePlans.ts";
import type { RequiredRoleEncounterPlan, SpaceObject } from "./types.ts";
import { CURRENT_FLIGHT_TOPOLOGY, flightEncounterSeed } from "./world/index.ts";

function fixture(id: "whale" | "family" | "holodisk" | "hub") {
  const galaxy = id === "hub" ? 2 : 3;
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.selectedGalaxy = galaxy;
  model.state.unlocked = [1, galaxy];
  model.state.started = true;
  model.state.mode = "space";
  const progress = model.state.progress[galaxy];
  progress.geography = freshGalaxyGeography(173);
  const flight = createUnpopulatedFlight(CONTENT, galaxy, 173, model.state.economy, 197);
  flight.topology = CURRENT_FLIGHT_TOPOLOGY;
  model.state.flight = flight;
  flight.combat = { initialPackSizes: {}, routeEncounters: [] };
  const site: SpaceObject = { hp: 1, id, kind: "destination", radius: 30, x: 10000, y: 10000 };
  const archetype = id === "holodisk" ? HOLODISKS.guard.leader : "capital";
  const leaderId = `route:${id}`;
  const definition = enemyDefinition(galaxy, archetype, leaderId, 2);
  const point = { x: 10500, y: 10000 };
  const leader: SpaceObject = {
    ...point,
    enemy: createEnemy(
      definition,
      { archetype, id: leaderId, packId: null, phase: 0.2, weaponLevel: 2 },
      point,
    ),
    hp: definition.hp,
    id: leaderId,
    kind: "enemy",
    radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
    routeId: id,
  };
  leader.enemy!.age = 9.25;
  leader.enemy!.hardpoints[0]!.cooldown = 0.75;
  leader.enemy!.hardpoints[1]!.burst = 1;
  const actors: SpaceObject[] = [leader];
  if (id === "holodisk") {
    const pack = "route:holodisk:pack";
    for (let index = 0; index < HOLODISKS.guard.packSize; index++) {
      const actorId = `${pack}:${index}`;
      const def = enemyDefinition(3, HOLODISKS.guard.pack, actorId, 1);
      const at = { x: point.x + index * 90, y: point.y };
      actors.push({
        ...at,
        enemy: createEnemy(
          def,
          { archetype: HOLODISKS.guard.pack, id: actorId, packId: pack, phase: index },
          at,
        ),
        hp: def.hp,
        id: actorId,
        kind: "enemy",
        persistent: true,
        radius: def.sizeRatio * CONTENT.tuning.flight.shipRadius,
      });
    }
    actors.push(
      ...createFrigateEscorts(
        {
          encounterSeed: flightEncounterSeed(flight),
          galaxy: 3,
          id: (index) => requiredFrigateEscortId(leaderId, index),
          packId: escortPackId(leaderId),
          persistent: true,
          shipRadius: CONTENT.tuning.flight.shipRadius,
        },
        leader,
      ),
    );
  }
  const plan: RequiredRoleEncounterPlan =
    id === "hub"
      ? { actors: [leader], role: "cartwheel-capital", site }
      : { actors, role: id === "holodisk" ? "whirlpool-holodisk" : "whirlpool-capital", site };
  return { flight, model, plan, progress };
}

describe("G3 hidden authored encounter storage", () => {
  it.each(["whale", "family", "holodisk"] as const)(
    "preserves ordered full %s actor states and Continue without discovery or admission",
    (id) => {
      const { flight, model, plan, progress } = fixture(id);
      const before = structuredClone({
        known: progress.known,
        markers: flight.markerActors,
        notables: flight.world.notables,
      });
      const stored = storeRequiredRolePlan(progress, flight, plan);
      expect(stored).toEqual(plan);
      expect(stored).not.toBe(plan);
      expect(requiredPlanActors(stored).map((actor) => actor.id)).toEqual(
        plan.actors.map((actor) => actor.id),
      );
      const random = vi.spyOn(crypto, "getRandomValues");
      random.mockClear();
      try {
        expect(readRequiredRolePlan(flight, id)).toBe(stored);
        expect(readRequiredPlan(flight, id)).toBeNull();
        const resumed = relaunch(CONTENT, model.save());
        expect(resumed.state).toEqual(model.state);
        expect(readRequiredRolePlan(resumed.state.flight!, id)).toEqual(stored);
        expect(random).not.toHaveBeenCalled();
      } finally {
        random.mockRestore();
      }
      expect(flight.objects).toEqual([]);
      expect(flight.combat!.routeEncounters).toEqual([]);
      expect({
        known: progress.known,
        markers: flight.markerActors,
        notables: flight.world.notables,
      }).toEqual(before);
      expect(progress.requiredSites).toEqual({ [id]: { x: 10000, y: 10000 } });
    },
  );

  it("keeps first-store states and transfers exact objects only once without new encounter rolls", () => {
    const { flight, model, plan, progress } = fixture("holodisk");
    const stored = storeRequiredRolePlan(progress, flight, plan);
    const other = structuredClone(plan);
    other.actors[0]!.enemy!.age = 0;
    expect(storeRequiredRolePlan(progress, flight, other)).toBe(stored);
    const taken = takeRequiredRolePlan(progress, flight, "holodisk")!;
    expect(taken).toBe(stored);
    expect(takeRequiredRolePlan(progress, flight, "holodisk")).toBeNull();
    flight.objects.push(taken.site, ...taken.actors);
    flight.combat!.routeEncounters.push(taken.site.id);
    for (const actor of taken.actors) {
      const pack = actor.enemy!.packId;
      if (pack) {
        flight.combat!.initialPackSizes[pack] = (flight.combat!.initialPackSizes[pack] ?? 0) + 1;
      }
    }
    expect(restoreSave(model.save())).toEqual(model.state);
    expect(() => storeRequiredRolePlan(progress, flight, plan)).toThrow("already owned");
  });

  it("rejects role, identity, ownership and knowledge contradictions without fabricating history", () => {
    const { flight, model, plan, progress } = fixture("holodisk");
    storeRequiredRolePlan(progress, flight, plan);
    const saved = model.saveDocument();
    const edits = [
      (p: RequiredRoleEncounterPlan) => {
        p.role = "whirlpool-capital";
      },
      (p: RequiredRoleEncounterPlan) => {
        p.actors = p.actors.slice(0, -1);
      },
      (p: RequiredRoleEncounterPlan) => {
        p.actors[1]!.enemy!.packId = "hunt:whale";
      },
      (p: RequiredRoleEncounterPlan) => {
        p.actors[0]!.enemy!.disabled = true;
      },
      (p: RequiredRoleEncounterPlan) => {
        p.actors[0]!.enemy!.weaponLevel = 4 as never;
      },
      (p: RequiredRoleEncounterPlan) => {
        p.actors[1]!.id = p.actors[0]!.id;
      },
      (p: RequiredRoleEncounterPlan) => {
        p.site.x++;
      },
    ];
    for (const edit of edits) {
      const invalid = structuredClone(saved);
      edit(readRequiredRolePlan(invalid.flight!, "holodisk")!);
      expect(restoreSave(invalid)).toBeNull();
    }
    const removed = structuredClone(saved);
    removed.flight!.world.notables[plan.actors[0]!.id] = null;
    expect(restoreSave(removed)).toBeNull();
    expect(requiredRolePlanConsistent(1, plan)).toBe(false);
    flight.world.notables[plan.actors[0]!.id] = null;
    expect(() => takeRequiredRolePlan(progress, flight, "holodisk")).toThrow("already owned");
    expect(readRequiredRolePlan(flight, "holodisk")).not.toBeNull();
    const reset = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, removed);
    expect(reset.state.flight).toBeNull();
    expect(reset.state.mode).toBe("home");
  });

  it("retains canonical geography while a fresh flight starts without old hidden actors", () => {
    const { flight, plan, progress } = fixture("whale");
    storeRequiredRolePlan(progress, flight, plan);
    const fresh = createUnpopulatedFlight(CONTENT, 3, flight.seed, undefined, 198);
    expect(readRequiredRolePlan(fresh, "whale")).toBeNull();
    expect(progress.requiredSites!.whale).toEqual({ x: 10000, y: 10000 });
    expect(readRequiredRolePlan(flight, "whale")).toEqual(plan);
    expect(flightEncounterSeed(fresh)).not.toBe(flightEncounterSeed(flight));
  });
});

describe("G2 hidden hub capital storage", () => {
  it("preserves Continue and first-store state without activation, discovery or random draws", () => {
    const { flight, model, plan, progress } = fixture("hub");
    const before = structuredClone({
      combat: flight.combat,
      known: progress.known,
      markers: flight.markerActors,
      notables: flight.world.notables,
    });
    const stored = storeRequiredRolePlan(progress, flight, plan);
    const random = vi.spyOn(crypto, "getRandomValues");
    random.mockClear();
    try {
      const changed = structuredClone(plan);
      changed.actors[0]!.enemy!.age = 0;
      expect(storeRequiredRolePlan(progress, flight, changed)).toBe(stored);
      expect(readRequiredRolePlan(flight, "hub")).toBe(stored);
      expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
      expect(takeRequiredRolePlan(progress, flight, "hub")).toBe(stored);
      expect(takeRequiredRolePlan(progress, flight, "hub")).toBeNull();
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
    }).toEqual(before);
  });
  it("rejects non-hub routes, wrong galaxy, malformed full states and shared ownership", () => {
    const { flight, model, plan, progress } = fixture("hub");
    expect(requiredRolePlanConsistent(3, plan)).toBe(false);
    for (const id of ["miner", "visitors"]) {
      const other = structuredClone(plan);
      other.site.id = id;
      other.actors[0]!.id = `route:${id}`;
      other.actors[0]!.enemy!.id = `route:${id}`;
      other.actors[0]!.routeId = id;
      expect(requiredRolePlanConsistent(2, other)).toBe(false);
      expect(() => storeRequiredRolePlan(progress, flight, other)).toThrow(
        "Invalid required role plan",
      );
    }
    storeRequiredRolePlan(progress, flight, plan);
    const saved = model.saveDocument();
    for (const mutation of [
      (actor: SpaceObject) => {
        actor.enemy!.disabled = true;
      },
      (actor: SpaceObject) => {
        actor.enemy!.weaponLevel = 4 as never;
      },
      (actor: SpaceObject) => {
        actor.routeId = "miner";
      },
    ]) {
      const invalid = structuredClone(saved);
      mutation(readRequiredRolePlan(invalid.flight!, "hub")!.actors[0]!);
      expect(restoreSave(invalid)).toBeNull();
    }
    for (const id of ["miner", "visitors"]) {
      const invalid = structuredClone(saved);
      const pending = readRequiredRolePlan(invalid.flight!, "hub")!;
      delete invalid.flight!.requiredPlans!.hub;
      pending.site.id = id;
      pending.actors[0]!.id = `route:${id}`;
      pending.actors[0]!.enemy!.id = `route:${id}`;
      pending.actors[0]!.routeId = id;
      invalid.flight!.requiredPlans![id] = pending;
      invalid.progress[2].requiredSites![id] = { x: pending.site.x, y: pending.site.y };
      expect(restoreSave(invalid)).toBeNull();
    }
    const duplicate = structuredClone(saved);
    duplicate.flight!.objects.push(structuredClone(plan.actors[0]!));
    expect(restoreSave(duplicate)).toBeNull();
    flight.world.notables[plan.actors[0]!.id] = null;
    expect(restoreSave(model.save())).toBeNull();
    expect(() => takeRequiredRolePlan(progress, flight, "hub")).toThrow("already owned");
    expect(readRequiredRolePlan(flight, "hub")).not.toBeNull();
  });
});
