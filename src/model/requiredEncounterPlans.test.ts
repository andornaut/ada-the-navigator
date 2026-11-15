import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { relaunch } from "../testing/launch.ts";
import { createEnemy } from "./enemyAi.ts";
import { createUnpopulatedFlight } from "./flight.ts";
import { flightEncounterSeed } from "./flightTopology.ts";
import { createFrigateEscorts, requiredFrigateEscortId } from "./frigateEscorts.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import { escortPackId } from "./geography.ts";
import {
  readRequiredPlan,
  rememberRequiredSite,
  storeRequiredPlan,
  takeRequiredPlan,
} from "./requiredEncounterPlans.ts";
import { restoreSave } from "./save.ts";
import type { RequiredEncounterPlan, SpaceObject } from "./types.ts";

function fixture(supportCount = 0) {
  const model = new GameModel(CONTENT);
  const progress = model.state.progress[1];
  progress.geography = freshGalaxyGeography(173);
  const flight = createUnpopulatedFlight(CONTENT, 1, 173, model.state.economy, 197);
  model.state.flight = flight;
  model.state.mode = "space";
  model.state.started = true;
  flight.combat = { initialPackSizes: {}, routeEncounters: [] };
  const site: SpaceObject = {
    hp: 1,
    id: "growers",
    kind: "destination",
    radius: 30,
    x: 10000,
    y: 10000,
  };
  const point = { x: 10500, y: 10000 };
  const definition = enemyDefinition(1, "frigate", "route:growers", 2);
  const leader: SpaceObject = {
    ...point,
    enemy: createEnemy(
      definition,
      { archetype: "frigate", id: "route:growers", packId: null, phase: 0.25, weaponLevel: 2 },
      point,
    ),
    hp: definition.hp,
    id: "route:growers",
    kind: "enemy",
    persistent: true,
    radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
    routeId: site.id,
  };
  leader.enemy!.hardpoints[0]!.cooldown = 1.25;
  const support = createFrigateEscorts(
    {
      encounterSeed: flightEncounterSeed(flight),
      galaxy: 1,
      id: (index) => requiredFrigateEscortId(leader.id, index),
      packId: escortPackId(leader.id),
      persistent: true,
      shipRadius: CONTENT.tuning.flight.shipRadius,
    },
    leader,
  ).slice(0, supportCount);
  const plan: RequiredEncounterPlan = { leader, site, support };
  return { flight, model, plan, progress };
}

describe("hidden required encounter storage", () => {
  it.each([0, 1, 2])(
    "retains the required leader and %i full support states through Continue without revealing them",
    (count) => {
      const { flight, model, plan, progress } = fixture(count);
      const knowledge = {
        known: [...progress.known],
        markerActors: structuredClone(flight.markerActors),
        markerKnowledge: structuredClone(progress.markerKnowledge),
      };
      const stored = storeRequiredPlan(progress, flight, plan);
      expect(stored).toEqual(plan);
      expect(stored).not.toBe(plan);
      expect(progress.requiredSites).toEqual({ growers: { x: 10000, y: 10000 } });
      expect(flight.objects).toEqual([]);
      expect(flight.world.notables).toEqual({});
      expect({
        known: progress.known,
        markerActors: flight.markerActors,
        markerKnowledge: progress.markerKnowledge,
      }).toEqual(knowledge);
      const resumed = relaunch(CONTENT, model.save());
      expect(resumed.state).toEqual(model.state);
      expect(readRequiredPlan(resumed.state.flight!, "growers")).toEqual(plan);
      expect(resumed.state.flight!.objects).toEqual([]);
      expect(resumed.state.flight!.world.notables).toEqual({});
    },
  );

  it("keeps the first canonical point and full plan without rerolling or duplicating materialized actors", () => {
    const { flight, model, plan, progress } = fixture(2);
    const stored = storeRequiredPlan(progress, flight, plan);
    const changed = structuredClone(plan);
    changed.leader.enemy!.hardpoints[0]!.cooldown = 0;
    expect(storeRequiredPlan(progress, flight, changed)).toBe(stored);
    expect(rememberRequiredSite(progress, "growers", { x: 20000, y: 20000 })).toEqual({
      x: 10000,
      y: 10000,
    });
    const transferred = takeRequiredPlan(flight, "growers")!;
    expect(transferred).toBe(stored);
    expect(takeRequiredPlan(flight, "growers")).toBeNull();
    flight.objects.push(transferred.site, transferred.leader, ...transferred.support);
    flight.combat!.initialPackSizes[escortPackId(transferred.leader.id)] =
      transferred.support.length;
    flight.combat!.routeEncounters.push(transferred.site.id);
    expect(readRequiredPlan(flight, "growers")).toBeNull();
    expect(restoreSave(model.save())).toEqual(model.state);
    expect(() => storeRequiredPlan(progress, flight, plan)).toThrow("already owned");
  });

  it("keeps canonical geography on fresh entry while dropping the old hidden encounter states", () => {
    const { flight, model, plan, progress } = fixture(1);
    storeRequiredPlan(progress, flight, plan);
    const seed = flightEncounterSeed(flight);
    flight.dangerFor = 0;
    model.returnHome();
    expect(model.state.mode).toBe("home");
    model.startGalaxy(1);
    expect(model.state.progress[1].requiredSites).toMatchObject({
      growers: { x: 10000, y: 10000 },
    });
    const freshPlan = readRequiredPlan(model.state.flight!, "growers")!;
    expect(freshPlan).not.toBeNull();
    expect(freshPlan).not.toBe(readRequiredPlan(flight, "growers"));
    expect(freshPlan.site).toMatchObject({ id: "growers", x: 10000, y: 10000 });
    expect(freshPlan.leader.enemy!.hardpoints[0]!.cooldown).toBe(0);
    expect(readRequiredPlan(flight, "growers")!.leader.enemy!.hardpoints[0]!.cooldown).toBe(1.25);
    expect(flightEncounterSeed(model.state.flight!)).not.toBe(seed);
    expect(progress.known).toEqual([]);
  });

  it("rejects disabled pending leaders while retaining disabled materialized hulls", () => {
    const { flight, model, plan, progress } = fixture();
    storeRequiredPlan(progress, flight, plan);
    const invalid = model.saveDocument();
    invalid.flight!.requiredPlans!.growers!.leader.enemy!.disabled = true;
    expect(restoreSave(invalid)).toBeNull();

    const materialized = takeRequiredPlan(flight, "growers")!;
    materialized.leader.enemy!.disabled = true;
    flight.objects.push(materialized.site, materialized.leader);
    flight.combat!.routeEncounters.push(materialized.site.id);
    expect(restoreSave(model.save())).toEqual(model.state);

    const pending = fixture();
    pending.plan.leader.enemy!.disabled = true;
    expect(() => storeRequiredPlan(pending.progress, pending.flight, pending.plan)).toThrow(
      "Invalid required encounter plan",
    );
  });

  it("rejects malformed roles, level or coordinate changes and all duplicate or removed ownership", () => {
    const { flight, model, plan, progress } = fixture(1);
    storeRequiredPlan(progress, flight, plan);
    const original = model.saveDocument();
    const edits = [
      (save: typeof original) => {
        save.flight!.requiredPlans!.growers!.support[0]!.enemy!.packId = "wrong-pack";
      },
      (save: typeof original) => {
        save.flight!.requiredPlans!.growers!.support[0]!.role = "discovery";
      },
      (save: typeof original) => {
        save.flight!.combat!.routeEncounters.push("growers");
      },
      (save: typeof original) => {
        save.flight!.requiredPlans!.growers!.support.push(...plan.support, ...plan.support);
      },
      (save: typeof original) => {
        save.flight!.requiredPlans!.growers!.leader.routeId = "workshop";
      },
      (save: typeof original) => {
        save.flight!.requiredPlans!.growers!.leader.enemy!.weaponLevel = 4 as never;
      },
      (save: typeof original) => {
        save.flight!.requiredPlans!.growers!.site.x++;
      },
      (save: typeof original) => {
        save.flight!.objects.push(structuredClone(plan.leader));
      },
      (save: typeof original) => {
        save.flight!.world.notables[plan.leader.id] = null;
      },
      (save: typeof original) => {
        save.flight!.markerActors = {
          encounterSeed: flightEncounterSeed(flight),
          knowledge: { [plan.leader.id]: "identified" },
        };
      },
    ];
    expect(restoreSave(original)).toEqual(original);
    for (const edit of edits) {
      const invalid = structuredClone(original);
      edit(invalid);
      expect(restoreSave(invalid)).toBeNull();
    }
    const absent = structuredClone(original);
    delete absent.flight!.requiredPlans;
    delete absent.progress[1].requiredSites;
    expect(restoreSave(absent)).not.toBeNull();
  });
});
