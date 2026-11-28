import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { encounterTable, enemyDefinition, PHANTOM_FLAGSHIP_ID } from "../data/enemyCatalog.ts";
import { FLAGSHIP_SURRENDER_HP } from "../data/enemyIdentity.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FINALE_CHATTER, PHANTOM_TUNING } from "../data/phantom.ts";
import * as enemyAi from "./enemyAi.ts";
import { createEnemy, damageEnemy } from "./enemyAi.ts";
import {
  activateRouteEncounter,
  createFlight,
  questGuardPlacementContext,
  routeBlocked,
  spawnChapterEnemy,
  stepFlight,
  syncFlightRegion,
} from "./flight.ts";
import { hit } from "./flight/hitResolution.ts";
import {
  afterStepPhantom,
  beforeStepPhantom,
  choosePhantom,
  initPhantom,
  phantomBossHud,
  type PhantomContext,
  type PhantomFlight,
  phantomObjective,
  phantomObjectiveIndex,
  type PhantomProgress,
  settlePhantomSurrender,
  usePhantom,
  validPhantomFlight,
  validPhantomProgress,
} from "./phantom.ts";
import {
  activePhantomSong,
  phantomAllyRoster,
  phantomEscortSlot,
  phantomSongSpeed,
  phantomWhaleKind,
  phantomWhaleOffsets,
  phantomWhaleReach,
  rotatePhantomAllies,
  stepPhantomAllies,
} from "./phantomAllies.ts";
import { readPendingPhantomEncounter } from "./phantomRequiredPlans.ts";
import { stationFormationClear } from "./stationPlacement.ts";
import type { FlightEvent, FlightState, GalaxyProgress } from "./types.ts";
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
/** The chapter fixture clears Ada from the fixed spawn slot before requesting final admission. */
function clearFinalePlayer(context: PhantomContext): void {
  const pending = readPendingPhantomEncounter(context.flight);
  if (pending?.kind !== "flagship") {
    return;
  }
  const center = state(context).waypoint;
  for (const direction of [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]) {
    const player = {
      x: center.x + direction.x * CONTENT.tuning.chunkSize,
      y: center.y + direction.y * CONTENT.tuning.chunkSize,
    };
    const flight = { ...context.flight, player };
    if (stationFormationClear(questGuardPlacementContext(CONTENT, flight), pending.actors)) {
      context.flight.player = player;
      return;
    }
  }
  throw new Error("No clear player approach beside the fixed flagship slot");
}

function disable(context: PhantomContext, ids: readonly string[]) {
  for (const id of ids) {
    const target = object(context, id);
    if (target?.enemy) {
      target.enemy.disabled = true;
    }
  }
  if (state(context).phase === "waves" && state(context).wave === PHANTOM_TUNING.waves) {
    clearFinalePlayer(context);
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
  it.each([false, true])(
    "opens Talk immediately after the last guard flees, dormant=%s",
    (dormant) => {
      const context = fixture();
      const id = PHANTOM_DESTINATIONS[0];
      activateRouteEncounter(CONTENT, id, context.flight);
      const ids = state(context).blockades[id]!;
      disable(context, ids.slice(1));
      const settlement = object(context, id)!;
      const guard = object(context, ids[0]!)!;
      guard.enemy!.fleeing = true;
      guard.x = settlement.x + 601;
      guard.y = settlement.y;
      guard.enemy!.position = { x: guard.x, y: guard.y };
      if (dormant) {
        context.flight.player = {
          x: settlement.x + CONTENT.tuning.chunkSize * 20,
          y: settlement.y,
        };
        syncFlightRegion(CONTENT, context.flight);
        expect(context.flight.world.notables[guard.id]).toBe(guard);
      }
      context.flight.player = { x: settlement.x, y: settlement.y };
      expect(routeBlocked(id, context.flight)).toBe(true);
      const before = structuredClone(guard.enemy);
      const sizes = { ...context.flight.combat!.initialPackSizes };
      afterStepPhantom(context);
      expect(progress(context).broken).toContain(id);
      expect(routeBlocked(id, context.flight)).toBe(false);
      expect(context.flight.objects.find((object) => object.id === guard.id)).toBe(guard);
      expect(guard.persistent).toBe(true);
      expect(guard.routeId).toBeUndefined();
      expect(guard.enemy).toEqual(before);
      expect(context.flight.combat!.initialPackSizes).toEqual(sizes);
      const panel = usePhantom(context, id)!.dialogue!;
      expect(panel.context).toBe(`phantom.${id}`);
      choosePhantom(context, panel, "continue");
      expect(progress(context).freed).toContain(id);
    },
  );
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
  it("keeps flagship geometry and uses regular zero-hull damage outside the finale", () => {
    const definition = enemyDefinition(6, "capital", PHANTOM_FLAGSHIP_ID);
    expect(definition.hp).toBe(320);
    expect(definition.hardpoints).toHaveLength(13);
    expect(definition.hardpoints.every((part) => part.hp === 18)).toBe(true);
    expect(definition.behaviour).toEqual({ kind: "siege", speedFraction: 0.25 });
    expect(definition.pursuit.homeRadius).toBe(1000);
    const enemy = createEnemy(
      definition,
      { archetype: "capital", id: PHANTOM_FLAGSHIP_ID, packId: null, phase: 0 },
      { x: 0, y: 0 },
    );
    for (const hardpointId of [null, definition.hardpoints[0]!.id]) {
      const damaged = damageEnemy(definition, { amount: 10000, hardpointId }, enemy);
      expect(damaged).toMatchObject({ disabled: false, hp: 0 });
      expect(damaged.hardpoints).toEqual(enemy.hardpoints);
    }
    const ordinary = enemyDefinition(6, "capital", "ordinary");
    expect(ordinary.hp).toBe(180);
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
  it("requires freed settlements and three complete waves before consuming hull surrender once", () => {
    const context = fixture();
    const canSalvage = () => false;
    expect(usePhantom(context, PHANTOM_DESTINATIONS[0])).toEqual({});
    expect(settlePhantomSurrender(context)).toBe(false);
    freeSettlements(context);
    expect(progress(context).flagshipKnown).toBe(true);
    expect(phantomObjective(context)).toBe(PHANTOM_FLAGSHIP_ID);
    context.flight.player = { ...state(context).waypoint };
    beforeStepPhantom(context);
    expect(phantomBossHud(context, canSalvage)).toBeNull();
    expect(state(context).chatter).toEqual(["battleAlone"]);
    for (let wave = 1; wave <= 3; wave++) {
      expect(state(context).wave).toBe(wave);
      expect(
        state(context).enemyIds.every((id) => object(context, id)?.enemy?.archetype !== "capital"),
      ).toBe(true);
      expect(
        new Set(state(context).enemyIds.map((id) => object(context, id)?.enemy?.packId)).size,
      ).toBe(2);
      expect(settlePhantomSurrender(context)).toBe(false);
      for (const id of state(context).enemyIds) {
        const target = object(context, id)!;
        hit(CONTENT, target.hp, null, target, context.flight, []);
      }
      if (wave === PHANTOM_TUNING.waves) {
        clearFinalePlayer(context);
      }
      afterStepPhantom(context);
    }
    expect(state(context).phase).toBe("flagship");
    expect(state(context).enemyIds).toHaveLength(9);
    const flagship = object(context, PHANTOM_FLAGSHIP_ID)!;
    expect(usePhantom(context, PHANTOM_FLAGSHIP_ID)).toBeUndefined();
    context.flight.player = { x: flagship.x, y: flagship.y };
    syncFlightRegion(CONTENT, context.flight);
    expect(phantomBossHud(context, canSalvage)).toBeNull();

    const mounts = structuredClone(flagship.enemy!.hardpoints);
    const events: FlightEvent[] = [];
    const beforeSurrender = FLAGSHIP_SURRENDER_HP + 1;
    hit(CONTENT, flagship.hp - beforeSurrender, mounts[0]!.id, flagship, context.flight, events);
    expect(flagship.enemy!.hardpoints).toEqual(mounts);
    expect(events).toEqual([]);
    expect(phantomBossHud(context, canSalvage)).toEqual({
      captain: "Admiral Archie",
      disabled: false,
      hull: beforeSurrender,
      id: PHANTOM_FLAGSHIP_ID,
      maxHull: 320,
      ship: "Archie's flagship",
    });
    flagship.enemy!.returning = true;
    expect(phantomBossHud(context, canSalvage)).toBeNull();
    flagship.enemy!.returning = false;
    afterStepPhantom(context);
    expect(state(context).chatter).toEqual(["battleAlone", "flagshipAttack"]);
    expect(settlePhantomSurrender(context)).toBe(false);

    hit(CONTENT, 10000, null, flagship, context.flight, events);
    hit(CONTENT, 10000, mounts[0]!.id, flagship, context.flight, events);
    expect(events).toEqual([{ id: PHANTOM_FLAGSHIP_ID, type: "enemySurrendered" }]);
    expect(flagship.enemy).toMatchObject({
      disabled: true,
      hp: FLAGSHIP_SURRENDER_HP,
      surrendered: true,
    });
    expect(settlePhantomSurrender(context)).toBe(true);
    expect(progress(context).surrenderAftermathDue).toBe(true);
    expect(state(context).chatter).toEqual(PHANTOM_FINALE_CHATTER);
    expect(state(context).allies).toEqual([]);
    expect(state(context).phase).toBe("salvaged");
    expect(phantomBossHud(context, canSalvage)).toMatchObject({
      hull: FLAGSHIP_SURRENDER_HP,
      surrendered: true,
    });
    expect(usePhantom(context, PHANTOM_FLAGSHIP_ID)).toBeUndefined();
    expect(settlePhantomSurrender(context)).toBe(false);
    expect(validPhantomFlight(JSON.parse(JSON.stringify(state(context))))).toBe(true);
  });
  it.each([false, true])(
    "keeps repeated settlement talks from restarting the fleet or salvage, restored=%s",
    (restored) => {
      let context = fixture();
      freeSettlements(context);
      const revisit = () => {
        if (restored) {
          context = {
            content: CONTENT,
            flight: JSON.parse(JSON.stringify(context.flight)) as FlightState,
            progress: JSON.parse(JSON.stringify(context.progress)) as GalaxyProgress,
          };
          expect(validPhantomProgress(progress(context))).toBe(true);
          expect(validPhantomFlight(state(context))).toBe(true);
          initPhantom(context);
        }
        const before = structuredClone({ flight: context.flight, progress: context.progress });
        for (const id of PHANTOM_DESTINATIONS) {
          const panel = usePhantom(context, id)!.dialogue!;
          expect(choosePhantom(context, panel, "continue")).toEqual({});
        }
        expect({ flight: context.flight, progress: context.progress }).toEqual(before);
        expect(validPhantomFlight(state(context))).toBe(true);
      };
      revisit();
      context.flight.player = { ...state(context).waypoint };
      beforeStepPhantom(context);
      for (let wave = 1; wave <= PHANTOM_TUNING.waves; wave++) {
        revisit();
        beforeStepPhantom(context);
        expect(state(context).phase).toBe("waves");
        expect(state(context).wave).toBe(wave);
        disable(context, state(context).enemyIds);
        afterStepPhantom(context);
      }
      revisit();
      beforeStepPhantom(context);
      expect(state(context).phase).toBe("flagship");
      expect(state(context).wave).toBe(PHANTOM_TUNING.waves);
      object(context, PHANTOM_FLAGSHIP_ID)!.enemy!.disabled = true;
      const flagship = object(context, PHANTOM_FLAGSHIP_ID)!;
      context.flight.player = { x: flagship.x, y: flagship.y };
      syncFlightRegion(CONTENT, context.flight);
      afterStepPhantom(context);
      const panel = usePhantom(context, PHANTOM_FLAGSHIP_ID)!.dialogue!;
      expect(choosePhantom(context, panel, "continue")).toEqual({ complete: true, holodisk: {} });
      context.progress.questComplete = true;
      context.progress.holodisk = true;
      revisit();
      beforeStepPhantom(context);
      expect(state(context).phase).toBe("salvaged");
      const afterSalvage = structuredClone(context.flight);
      expect(choosePhantom(context, panel, "continue")).toEqual({});
      expect(context.flight).toEqual(afterSalvage);
      expect(validPhantomFlight(state(context))).toBe(true);
    },
  );
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
  it("arrives in the resting role slots on the first wave and after rotation", () => {
    const context = fixture();
    const roster = phantomAllyRoster(
      [1, 2, 3, 4, 5].map((galaxy) => ({
        activityCompleted: true,
        galaxy: galaxy as 1 | 2 | 3 | 4 | 5,
        projects: [{ ally: "escort", project: "friend" }],
      })),
      21,
    );
    const withAllies = { ...context, allies: roster };
    freeSettlements(withAllies);
    context.flight.player = { ...state(context).waypoint };
    context.flight.facing = { x: 1, y: 0 };
    beforeStepPhantom(withAllies);
    expect(state(context).wave).toBe(1);

    function checkEntry() {
      const allies = state(context).allies;
      const escorts = allies.filter(({ behavior }) => behavior !== "whale");
      const { facing, player } = context.flight;
      const positions = allies.map(({ x, y }) => ({ x, y }));
      expect(new Set(positions.map((point) => JSON.stringify(point))).size).toBe(allies.length);
      for (const [index, { radius, x, y }] of escorts.entries()) {
        expect({ x, y }).toEqual(phantomEscortSlot(player, facing, radius, escorts, index));
      }
      const marlo = allies.find(({ id }) => id === "marlo")!;
      expect({ x: marlo.x, y: marlo.y }).toEqual({
        x: player.x - PHANTOM_TUNING.whaleFollow,
        y: player.y,
      });
      expect(
        allies.every(({ jumpAge, velocity }) => jumpAge === 0 && !velocity.x && !velocity.y),
      ).toBe(true);
      // Hold a separate target-free flight to compare the existing idle step against the entry.
      expect(
        stepPhantomAllies(CONTENT.tuning.physics, 0.1, { ...context.flight, objects: [] }, allies),
      ).toEqual([]);
      expect(allies.map(({ x, y }) => ({ x, y }))).toEqual(positions);
      return allies.map(({ id }) => id);
    }

    const first = checkEntry();
    disable(context, state(context).enemyIds);
    afterStepPhantom(withAllies);
    expect(state(context).wave).toBe(2);
    expect(checkEntry()).not.toEqual(first);
  });
  it("retains only bounded departure effects through the published jump duration, including after completion", () => {
    const context = fixture();
    const roster = phantomAllyRoster([{ activityCompleted: true, galaxy: 1, projects: [] }], 21);
    const withAllies = { ...context, allies: roster };
    freeSettlements(withAllies);
    context.flight.player = { ...state(context).waypoint };
    beforeStepPhantom(withAllies);
    expect(state(context).allies).toHaveLength(1);
    const ally = state(context).allies[0]!;
    ally.facing = { x: 0.6, y: -0.8 };
    const departure = { age: 0, id: "clover", x: ally.x, y: ally.y };
    disable(context, state(context).enemyIds);
    afterStepPhantom(withAllies);
    expect(state(context).departures).toEqual([{ ...departure, facing: { x: 0.6, y: -0.8 } }]);
    expect(state(context).departures?.[0]?.facing).not.toBe(ally.facing);
    expect(validPhantomFlight(state(context))).toBe(true);
    expect(validPhantomFlight({ ...state(context), departures: [departure] })).toBe(true);
    expect(
      validPhantomFlight({
        ...state(context),
        departures: [{ ...departure, facing: { x: Infinity, y: -0.8 } }],
      }),
    ).toBe(false);
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
      const active = rotatePhantomAllies(roster, turn, {
        facing: { x: 0, y: -1 },
        player: { x: 0, y: 0 },
      });
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
    const allies = rotatePhantomAllies(roster, 0, {
      facing: { x: 0, y: -1 },
      player: { x: 0, y: 0 },
    });
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
  it("flies the whales side by side with their drawn whales 16 world units apart", () => {
    expect(phantomWhaleKind({ id: "marlo" })).toBe("whale");
    expect(phantomWhaleKind({ id: "project:3:nurseryBeacon" })).toBe("adult");
    const pair = phantomWhaleOffsets([{ id: "marlo" }, { id: "project:3:nurseryBeacon" }]);
    const apart = pair[1]! - pair[0]!;
    expect(apart).toBeCloseTo(phantomWhaleReach("whale") + 16 + phantomWhaleReach("adult"), 9);
    expect(apart).toBeGreaterThan(120);
    expect(apart).toBeLessThan(122);
    // The pair is centred on Ada's track; a lone whale flies on it.
    expect(pair[0]! + pair[1]!).toBeCloseTo(0, 9);
    expect(phantomWhaleOffsets([{ id: "marlo" }])).toEqual([0]);
  });

  it("keeps the whales nonfiring and takes song range from the current roster", () => {
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
    const allies = rotatePhantomAllies(roster, 0, context.flight);
    expect(stepPhantomAllies(CONTENT.tuning.physics, 0.1, context.flight, allies)).toEqual([]);
    const marlo = allies.find((ally) => ally.id === "marlo")!;
    const nursery = allies.find(({ id }) => id === "project:3:nurseryBeacon")!;
    const at = (distance: number) => ({ x: marlo.x + distance, y: marlo.y });
    expect(phantomSongSpeed(activePhantomSong([marlo]), at(300))).toBe(0.75);
    expect(phantomSongSpeed(activePhantomSong([marlo]), at(301))).toBe(1);
    expect(phantomSongSpeed(activePhantomSong(allies), at(450))).toBe(0.75);
    expect(phantomSongSpeed(activePhantomSong(allies), at(451))).toBe(1);
    expect(phantomSongSpeed(activePhantomSong([nursery]), nursery)).toBe(1);
    expect(
      phantomSongSpeed(activePhantomSong([{ ...nursery, id: "another-whale" }, marlo]), at(301)),
    ).toBe(1);
    expect(phantomSongSpeed(activePhantomSong([]), marlo)).toBe(1);
    expect(allies.filter((ally) => ally.song)).toHaveLength(1);

    const others = Array.from({ length: 7 }, (_, index) => ({
      ...nursery,
      behavior: "escort" as const,
      id: `test-escort:${index}`,
    }));
    const rotating = [marlo, ...others.slice(0, 6), nursery, others[6]!];
    const first = rotatePhantomAllies(rotating, 0, context.flight);
    const next = rotatePhantomAllies(rotating, 1, context.flight);
    const after = state(context);
    after.allies = next;
    after.departures = [{ age: 0, id: nursery.id, x: nursery.x, y: nursery.y }];
    const reach = (group: typeof allies) => {
      const singer = group.find(({ id }) => id === "marlo")!;
      return phantomSongSpeed(activePhantomSong(group), { x: singer.x + 301, y: singer.y });
    };
    expect(reach(first)).toBe(0.75);
    expect(next.map(({ id }) => id)).not.toContain(nursery.id);
    expect(reach(after.allies)).toBe(1);
  });

  it.each([false, true])("routes the active nursery=%s to the real flight speed cap", (active) => {
    const context = fixture();
    const { flight } = context;
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
    const allies = rotatePhantomAllies(roster, 0, flight);
    const marlo = allies.find(({ id }) => id === "marlo")!;
    const nursery = allies.find(({ id }) => id === "project:3:nurseryBeacon")!;
    const current = state(context);
    current.allies = active ? allies : [marlo];
    if (!active) {
      current.departures = [{ age: 0, id: nursery.id, x: nursery.x, y: nursery.y }];
    }
    const boundaries = [
      { distance: 300, x: marlo.x + 300, y: marlo.y },
      { distance: 301, x: marlo.x - 301, y: marlo.y },
      { distance: 450, x: marlo.x, y: marlo.y + 450 },
      { distance: 451, x: marlo.x, y: marlo.y - 451 },
    ];
    const enemies = boundaries.map(({ distance, x, y }) =>
      spawnChapterEnemy(CONTENT, "swarm", `song-boundary:${distance}`, { x, y }, flight)!,
    );
    const step = vi.spyOn(enemyAi, "stepEnemy");
    try {
      stepFlight(CONTENT, 0.001, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false }, flight);
      const speeds = enemies.map(({ id }) => {
        const call = step.mock.calls.find(([, , actor]) => actor.id === id);
        expect(call, id).toBeDefined();
        return call![0].physics.maxSpeed;
      });
      const normal = speeds[3]!;
      expect(normal).toBeGreaterThan(0);
      expect(speeds).toEqual(
        active
          ? [normal * 0.75, normal * 0.75, normal * 0.75, normal]
          : [normal * 0.75, normal, normal, normal],
      );
    } finally {
      step.mockRestore();
    }
  });
});
