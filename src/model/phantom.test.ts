import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { encounterTable, enemyDefinition, PHANTOM_FLAGSHIP_ID } from "../data/enemyCatalog.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_TUNING } from "../data/phantom.ts";
import { createEnemy, damageEnemy } from "./enemyAi.ts";
import { createFlight } from "./flight.ts";
import {
  afterStepPhantom,
  beforeStepPhantom,
  choosePhantom,
  initPhantom,
  type PhantomContext,
  type PhantomFlight,
  phantomObjective,
  phantomObjectiveIndex,
  type PhantomProgress,
  usePhantom,
  validPhantomFlight,
  validPhantomProgress,
} from "./phantom.ts";
import {
  phantomAllyRoster,
  phantomEscortSlot,
  phantomSongSpeed,
  rotatePhantomAllies,
  stepPhantomAllies,
} from "./phantomAllies.ts";
import type { FlightState, GalaxyProgress } from "./types.ts";
function fixture(): PhantomContext {
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
  flight.objects = [];
  const context = { content: CONTENT, flight, progress };
  initPhantom(context);
  return context;
}
const state = (context: PhantomContext) =>
  (
    context.flight as FlightState & {
      phantom: PhantomFlight;
    }
  ).phantom;
const progress = (context: PhantomContext) =>
  (
    context.progress as GalaxyProgress & {
      phantom: PhantomProgress;
    }
  ).phantom;
const object = (context: PhantomContext, id: string) =>
  context.flight.objects.find((object) => object.id === id) ?? context.flight.world.notables[id];
function disable(context: PhantomContext, ids: readonly string[]) {
  for (const id of ids) {
    const target = object(context, id);
    if (target?.enemy) {
      target.enemy.disabled = true;
    }
  }
}
function freeSettlements(context: PhantomContext) {
  for (const id of PHANTOM_DESTINATIONS) {
    disable(context, state(context).blockades[id]!);
    afterStepPhantom(context);
    const panel = usePhantom(context, id)!.dialogue!;
    choosePhantom(context, panel, "continue");
  }
}
describe("Phantom chapter", () => {
  it("advances only the approved objective entries as actual chapter facts change", () => {
    const context = fixture();
    expect(phantomObjectiveIndex(context)).toBe(0);
    context.progress.known.push(PHANTOM_DESTINATIONS[0]);
    expect(phantomObjectiveIndex(context)).toBe(1);
    for (const ids of Object.values(state(context).blockades)) {
      disable(context, ids);
    }
    afterStepPhantom(context);
    expect(phantomObjectiveIndex(context)).toBe(2);
    for (const id of PHANTOM_DESTINATIONS) {
      choosePhantom(context, usePhantom(context, id)!.dialogue!, "continue");
    }
    expect(phantomObjectiveIndex(context)).toBe(3);
    context.flight.player = { ...state(context).waypoint };
    beforeStepPhantom(context);
    expect(phantomObjectiveIndex(context)).toBe(4);
    for (let wave = 0; wave < 3; wave++) {
      disable(context, state(context).enemyIds);
      afterStepPhantom(context);
    }
    object(context, PHANTOM_FLAGSHIP_ID)!.enemy!.disabled = true;
    expect(phantomObjectiveIndex(context)).toBe(5);
    context.progress.holodisk = true;
    expect(phantomObjectiveIndex(context)).toBe(6);
  });
  it("uses the explicit sixth roster and applies the shared bonus exactly once", () => {
    const table = encounterTable(6);
    expect(table.find((entry) => entry.archetype === "swarm")?.groupSize).toEqual([9, 11]);
    expect(table.find((entry) => entry.archetype === "fighter")?.groupSize).toEqual([6, 8]);
    expect(table.find((entry) => entry.archetype === "capital")?.escorts?.count).toBe(6);
    expect(enemyDefinition(6, "fighter").behaviour.kind).toBe("chase");
  });
  it("keeps the flagship alive on lethal hull and final weapon hits without altering normal capitals", () => {
    const definition = enemyDefinition(6, "capital", PHANTOM_FLAGSHIP_ID);
    expect(definition.hp).toBe(160);
    expect(definition.hardpoints).toHaveLength(11);
    expect(definition.hardpoints.every((part) => part.hp === 8)).toBe(true);
    expect(definition.behaviour).toEqual({ kind: "siege", speedFraction: 0.25 });
    expect(definition.pursuit.homeRadius).toBe(800);
    let enemy = createEnemy(
      definition,
      { archetype: "capital", id: PHANTOM_FLAGSHIP_ID, packId: null, phase: 0 },
      { x: 0, y: 0 },
    );
    enemy = damageEnemy(definition, { amount: 10000, hardpointId: null }, enemy);
    expect(enemy.hp).toBe(1);
    expect(enemy.disabled).toBe(false);
    for (const part of definition.hardpoints.filter((part) => part.kind === "weapon")) {
      enemy = damageEnemy(definition, { amount: 10000, hardpointId: part.id }, enemy);
    }
    expect(enemy.hp).toBe(1);
    expect(enemy.disabled).toBe(true);
    const ordinary = enemyDefinition(6, "capital", "ordinary");
    expect(ordinary.hp).toBe(96);
    expect(ordinary.hullFloor).toBeUndefined();
    expect(enemyDefinition(6, "capital", PHANTOM_FLAGSHIP_ID)).toBe(definition);
  });
  it("places three exact blockades inside their arenas and a distant flagship waypoint", () => {
    const context = fixture();
    for (const id of PHANTOM_DESTINATIONS) {
      const settlement = object(context, id)!;
      const guards = state(context).blockades[id]!.map((id) => object(context, id)!);
      expect(guards.filter((guard) => guard.enemy?.archetype === "frigate")).toHaveLength(1);
      expect(
        new Set(
          guards
            .filter((guard) => guard.enemy?.archetype === "fighter")
            .map((guard) => guard.enemy?.packId),
        ).size,
      ).toBe(2);
      expect(
        guards.every((guard) => Math.hypot(guard.x - settlement.x, guard.y - settlement.y) <= 600),
      ).toBe(true);
      expect(
        Math.hypot(
          state(context).waypoint.x - settlement.x,
          state(context).waypoint.y - settlement.y,
        ),
      ).toBeGreaterThanOrEqual(6000 - 1e-6);
    }
    expect(object(context, PHANTOM_FLAGSHIP_ID)).toBeUndefined();
  });
  it("does not treat paging out or a temporary in-arena retreat as victory", () => {
    const context = fixture();
    const id = PHANTOM_DESTINATIONS[0];
    const guards = state(context).blockades[id]!;
    disable(context, guards.slice(1));
    const last = object(context, guards[0]!)!;
    last.enemy!.fleeing = true;
    afterStepPhantom(context);
    expect(progress(context).broken).not.toContain(id);
    context.flight.world.notables[last.id] = last;
    context.flight.objects = context.flight.objects.filter((object) => object.id !== last.id);
    afterStepPhantom(context);
    expect(progress(context).broken).not.toContain(id);
    last.x = object(context, id)!.x + 601;
    last.y = object(context, id)!.y;
    afterStepPhantom(context);
    expect(progress(context).broken).toContain(id);
  });
  it("requires freed settlements, three complete waves, then disabling and actual salvage", () => {
    const context = fixture();
    expect(usePhantom(context, PHANTOM_DESTINATIONS[0])).toEqual({});
    freeSettlements(context);
    expect(progress(context).flagshipKnown).toBe(true);
    expect(phantomObjective(context)).toBe(PHANTOM_FLAGSHIP_ID);
    context.flight.player = { ...state(context).waypoint };
    beforeStepPhantom(context);
    expect(state(context).chatter).toEqual(["battleAlone"]);
    for (let wave = 1; wave <= 3; wave++) {
      expect(state(context).wave).toBe(wave);
      expect(
        state(context).enemyIds.every((id) => object(context, id)?.enemy?.archetype !== "capital"),
      ).toBe(true);
      expect(
        new Set(state(context).enemyIds.map((id) => object(context, id)?.enemy?.packId)).size,
      ).toBe(2);
      disable(context, state(context).enemyIds);
      afterStepPhantom(context);
    }
    expect(state(context).phase).toBe("flagship");
    expect(state(context).enemyIds).toHaveLength(9);
    const flagship = object(context, PHANTOM_FLAGSHIP_ID)!;
    expect(usePhantom(context, PHANTOM_FLAGSHIP_ID)).toBeUndefined();
    flagship.enemy!.disabled = true;
    afterStepPhantom(context);
    const panel = usePhantom(context, PHANTOM_FLAGSHIP_ID)!.dialogue!;
    expect(choosePhantom(context, panel, "invalid")).toEqual({});
    expect(flagship.enemy!.salvaged).toBe(false);
    expect(choosePhantom(context, panel, "continue")).toEqual({ complete: true, holodisk: {} });
    expect(flagship.enemy!.salvaged).toBe(true);
    expect(state(context).allies).toEqual([]);
    expect(state(context).phase).toBe("salvaged");
  });
  it("restarts the fleet after an emergency launch while preserving freed blockades", () => {
    const context = fixture();
    freeSettlements(context);
    context.flight.player = { ...state(context).waypoint };
    beforeStepPhantom(context);
    disable(context, state(context).enemyIds);
    afterStepPhantom(context);
    expect(state(context).wave).toBe(2);
    const next = { ...context, flight: createFlight(CONTENT, 6, 417, context.progress) };
    initPhantom(next);
    expect(state(next).phase).toBe("approach");
    expect(state(next).wave).toBe(0);
    expect(state(next).blockades).toEqual({});
    next.flight.player = { ...state(next).waypoint };
    beforeStepPhantom(next);
    expect(state(next).wave).toBe(1);
  });
  it("validates bounded chapter state and rejects invented progress or corrupted coordinates", () => {
    const context = fixture();
    expect(validPhantomProgress(progress(context))).toBe(true);
    expect(validPhantomFlight(state(context))).toBe(true);
    expect(
      validPhantomProgress({ broken: [], flagshipKnown: true, freed: [PHANTOM_DESTINATIONS[0]] }),
    ).toBe(false);
    expect(validPhantomFlight({ ...state(context), waypoint: { x: Infinity, y: 0 } })).toBe(false);
    expect(validPhantomFlight({ ...state(context), enemyIds: ["ambient:arbitrary"] })).toBe(false);
  });
});
describe("Phantom allies", () => {
  it("retains only bounded departure effects through the published jump duration, including after completion", () => {
    const context = fixture();
    const roster = phantomAllyRoster([{ activityCompleted: true, galaxy: 1, projects: [] }], 21);
    const withAllies = { ...context, allies: roster };
    freeSettlements(withAllies);
    context.flight.player = { ...state(context).waypoint };
    beforeStepPhantom(withAllies);
    expect(state(context).allies).toHaveLength(1);
    const departure = { x: state(context).allies[0]!.x, y: state(context).allies[0]!.y };
    disable(context, state(context).enemyIds);
    afterStepPhantom(withAllies);
    expect(state(context).departures).toEqual([{ age: 0, id: "clover", ...departure }]);
    expect(validPhantomFlight(state(context))).toBe(true);
    context.progress.questComplete = true;
    beforeStepPhantom(withAllies, 0.5);
    expect(state(context).departures).toHaveLength(1);
    beforeStepPhantom(withAllies, 0.5);
    expect(state(context).departures).toEqual([]);
    expect(state(context).allies).toHaveLength(1);
  });
  it("uses only explicit completed activities and funded projects, and rotates every eligible ally", () => {
    const roster = phantomAllyRoster(
      [1, 3, 4, 5, 2].map((galaxy) => ({
        activityCompleted: true,
        galaxy: galaxy as 1 | 2 | 3 | 4 | 5,
        projects: [
          { ally: "escort", project: "first" },
          { ally: "chase", project: "second" },
        ],
      })),
      21,
    );
    expect(roster).toHaveLength(15);
    const seen = new Set<string>();
    for (let turn = 0; turn < 4; turn++) {
      const active = rotatePhantomAllies(roster, turn, { x: 0, y: 0 });
      expect(active).toHaveLength(8);
      active.forEach((ally) => seen.add(ally.id));
    }
    expect(seen.size).toBe(roster.length);
    expect(phantomAllyRoster([{ activityCompleted: false, galaxy: 1, projects: [] }], 21)).toEqual(
      [],
    );
  });
  it("keeps drawn escort footprints apart and turns all slots with Ada", () => {
    const roster = Array.from({ length: 8 }, (_, i) => ({
      behavior: "escort" as const,
      galaxy: 1 as const,
      id: `escort:${i}`,
      radius: 21,
    }));
    const allies = rotatePhantomAllies(roster, 0, { x: 0, y: 0 });
    const slots = allies.map((_, index) =>
      phantomEscortSlot({ x: 0, y: 0 }, { x: 0, y: -1 }, 21, allies, index),
    );
    expect(slots[0]!.y).toBeGreaterThan(0);
    for (let i = 0; i < slots.length; i++) {
      expect(Math.hypot(slots[i]!.x, slots[i]!.y)).toBeGreaterThanOrEqual(
        21 + 21 + PHANTOM_TUNING.formationGap,
      );
      const neighbor = slots[(i + 1) % slots.length]!;
      expect(Math.hypot(slots[i]!.x - neighbor.x, slots[i]!.y - neighbor.y)).toBeGreaterThanOrEqual(
        58 - 1e-6,
      );
    }
    const turned = phantomEscortSlot({ x: 0, y: 0 }, { x: 1, y: 0 }, 21, allies, 0);
    expect(turned.x).toBeLessThan(0);
  });
  it("keeps whales nonfiring and Marlo's song exactly 300 at 0.75", () => {
    const context = fixture();
    const roster = phantomAllyRoster(
      [
        {
          activityCompleted: true,
          galaxy: 3,
          projects: [{ ally: "current", project: "nurseryBeacon" }],
        },
      ],
      21,
    );
    const allies = rotatePhantomAllies(roster, 0, context.flight.player);
    expect(stepPhantomAllies(CONTENT.tuning.physics, 0.1, context.flight, allies)).toEqual([]);
    const marlo = allies.find((ally) => ally.id === "marlo")!;
    expect(phantomSongSpeed(allies, { x: marlo.x + 300, y: marlo.y })).toBe(0.75);
    expect(phantomSongSpeed(allies, { x: marlo.x + 301, y: marlo.y })).toBe(1);
    expect(allies.filter((ally) => ally.song)).toHaveLength(1);
  });
});
