import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import {
  enemyCatalog,
  enemyDefinition,
  heavyLoadout,
  PHASER_AIM_SECONDS,
} from "../data/enemyCatalog.ts";
import { BUILT, GALAXY_NUMBERS, ROUTE_POSITION } from "../data/galaxies.ts";
import { NEEDLE } from "../data/needle.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { BEAM } from "../data/weaponCatalog.ts";
import { fromScreen } from "./convex.ts";
import { createEnemy } from "./enemyAi.ts";
import {
  activeEnemyBeams,
  createFlight,
  routeBlocked,
  spawnChapterEnemy,
  stepFlight,
  syncFlightRegion,
} from "./flight.ts";
import { GameModel } from "./game.ts";
import { MINE_REACH, mineParts } from "./mineShape.ts";
import { activeNeedleCourses, inNeedleChannel, needleCourses, needleDebris } from "./needle.ts";
import { newProgress } from "./progress.ts";
import { restoreSave } from "./save.ts";
import { direction } from "./shipPhysics.ts";
import type { FlightInput, SpaceObject, Vec } from "./types.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function courseFlight(anchor: Vec = { x: 0, y: 0 }, seed = 417) {
  const flight = createFlight(CONTENT, 4, seed, newProgress());
  flight.needle = { anchor: { ...anchor }, chatter: [], exitPackPlaced: true };
  flight.objects = [];
  const course = needleCourses(flight)!.practice;
  const gate = course.gates[0]!;
  flight.facing = { ...gate.tangent };
  return { course, flight, gate };
}

const offset = (point: Vec, direction: Vec, distance: number): Vec => ({
  x: point.x + direction.x * distance,
  y: point.y + direction.y * distance,
});

describe("mounted Needle flight physics", () => {
  it("recoils Ada's actual hull out of a gate rim without shield damage", () => {
    const { flight, gate } = courseFlight();
    const lateral = { x: -gate.tangent.y, y: gate.tangent.x };
    flight.player = offset(
      gate.point,
      lateral,
      (NEEDLE.gate.rim.inner + NEEDLE.gate.rim.outer) / 2,
    );
    const before = { ...flight.player };
    const shield = flight.shield;
    stepFlight(CONTENT, 0.001, idle, flight);
    expect(Math.hypot(flight.player.x - before.x, flight.player.y - before.y)).toBeGreaterThan(0);
    expect(flight.shield).toBe(shield);
  });

  it("allows the real ship through the center opening without treating the hoop as a solid obstacle", () => {
    const { flight, gate } = courseFlight();
    flight.player = offset(gate.point, gate.tangent, -0.01);
    flight.velocity = { x: gate.tangent.x * 20, y: gate.tangent.y * 20 };
    const shield = flight.shield;
    stepFlight(CONTENT, 0.01, { ...idle, move: gate.tangent, throttle: 0.1 }, flight);
    const along =
      (flight.player.x - gate.point.x) * gate.tangent.x +
      (flight.player.y - gate.point.y) * gate.tangent.y;
    expect(along).toBeGreaterThan(0);
    expect(flight.shield).toBe(shield);
  });

  it("excludes hostile bolts from the protected channel while retaining Ada's own bolt", () => {
    const { flight, gate } = courseFlight();
    flight.player = { ...gate.point };
    flight.shots = [true, false].map((enemy) => ({
      ...gate.point,
      damage: 1,
      enemy,
      hitIds: [],
      id: enemy ? "hostile-channel-bolt" : "friendly-channel-bolt",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    }));
    const shield = flight.shield;
    stepFlight(CONTENT, 0.001, idle, flight);
    expect(flight.shield).toBe(shield);
    expect(flight.shots.some(({ id }) => id === "hostile-channel-bolt")).toBe(false);
    expect(flight.shots.some(({ id }) => id === "friendly-channel-bolt")).toBe(true);
  });

  it("keeps each freshly admitted enemy's complete radius outside every active channel", () => {
    let enemies = 0;
    // Encounter cells must be eligible beyond the launch-calm exclusion.
    const anchor = { x: CONTENT.tuning.flight.arrivalCalm * 2, y: 0 };
    for (const seed of [1, 2, 3, 4, 42, 417]) {
      const { flight, gate } = courseFlight(anchor, seed);
      flight.player = { ...gate.point };
      expect(Math.hypot(gate.point.x, gate.point.y)).toBeGreaterThan(
        CONTENT.tuning.flight.arrivalCalm,
      );
      stepFlight(CONTENT, 0.001, idle, flight);
      expect(flight.freshDistance).toBe(0);
      const admitted = flight.objects.filter(({ kind }) => kind === "enemy");
      expect(admitted.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const object of admitted) {
        enemies++;
        expect(
          activeNeedleCourses(flight).some((course) =>
            inNeedleChannel({ radius: object.radius }, course, object),
          ),
          `${seed}:${object.id}`,
        ).toBe(false);
      }
    }
    expect(enemies).toBeGreaterThan(0);
  });

  it("blocks a retained enemy's attempted movement into the channel without deleting it", () => {
    const { course, flight, gate } = courseFlight();
    const lateral = { x: -gate.tangent.y, y: gate.tangent.x };
    const radius = enemyCatalog.swarm.sizeRatio * CONTENT.tuning.flight.shipRadius;
    const point = offset(gate.point, lateral, course.width / 2 + radius + 0.1);
    const enemy = createEnemy(
      enemyDefinition(4, "swarm"),
      { archetype: "swarm", id: "channel-outsider", packId: null, phase: 0 },
      point,
    );
    enemy.velocity = { x: -lateral.x * 200, y: -lateral.y * 200 };
    const object: SpaceObject = {
      ...point,
      enemy,
      hp: enemy.hp,
      id: enemy.id,
      kind: "enemy",
      radius,
    };
    flight.player = { ...gate.point };
    flight.objects = [object];
    expect(inNeedleChannel({ radius }, course, object)).toBe(false);
    stepFlight(CONTENT, 0.05, idle, flight);
    expect(flight.objects).toContain(object);
    expect(inNeedleChannel({ radius }, course, object)).toBe(false);
  });

  it("moves canonical seeded debris and records an actual bolt clear only once", () => {
    const { course, flight } = courseFlight();
    const descriptor = needleDebris(course, flight.seed)[0]!;
    flight.player = { x: descriptor.x + 500, y: descriptor.y };
    stepFlight(CONTENT, 0.01, idle, flight);
    const object = flight.objects.find(({ id }) => id === descriptor.id)!;
    expect(object).toBeDefined();
    expect(object).toMatchObject({
      hp: CONTENT.tuning.flight.rockHp,
      kind: "debris",
      persistent: true,
      radius: descriptor.radius,
      velocity: descriptor.velocity,
    });
    expect(Math.hypot(object.x - descriptor.x, object.y - descriptor.y)).toBeGreaterThan(0);
    flight.shots = [
      {
        damage: object.hp,
        enemy: false,
        hitIds: [],
        id: "clear-canonical-chip",
        life: 1,
        piercing: false,
        velocity: { x: 0, y: 0 },
        x: object.x,
        y: object.y,
      },
    ];
    const events = stepFlight(CONTENT, 0.001, idle, flight);
    expect(events).toContainEqual({ id: descriptor.id, type: "debrisCleared" });
    expect(flight.objects.some(({ id }) => id === descriptor.id)).toBe(false);
    expect(flight.world.notables[descriptor.id]).toBeNull();
    const next = stepFlight(CONTENT, 0.001, idle, flight);
    expect(flight.objects.some(({ id }) => id === descriptor.id)).toBe(false);
    expect(next).not.toContainEqual({ id: descriptor.id, type: "debrisCleared" });
  });

  it("rejects a hostile bolt whose center stays outside but whose radius grazes the channel", () => {
    const { course, flight, gate } = courseFlight();
    const tangent = direction({
      x: course.path[1]!.x - course.path[0]!.x,
      y: course.path[1]!.y - course.path[0]!.y,
    });
    const middle = {
      x: (course.path[0]!.x + course.path[1]!.x) / 2,
      y: (course.path[0]!.y + course.path[1]!.y) / 2,
    };
    const point = offset(middle, { x: -tangent.y, y: tangent.x }, course.width / 2 + 1);
    expect(inNeedleChannel({}, course, point)).toBe(false);
    expect(inNeedleChannel({ radius: 3 }, course, point)).toBe(true);
    flight.player = { ...gate.point };
    flight.shots = [
      {
        ...point,
        damage: 1,
        enemy: true,
        hitIds: [],
        id: "grazing-hostile-bolt",
        life: 1,
        piercing: false,
        velocity: { x: tangent.x * 100, y: tangent.y * 100 },
      },
    ];
    stepFlight(CONTENT, 0.01, idle, flight);
    expect(flight.shots.some(({ id }) => id === "grazing-hostile-bolt")).toBe(false);
  });

  it("removes an unarmed mine whose actual spike enters a non-axis-aligned channel boundary", () => {
    const { course, flight, gate } = courseFlight();
    const start = course.path[0]!;
    const along = direction({ x: course.path[1]!.x - start.x, y: course.path[1]!.y - start.y });
    const vertices = mineParts(0).flat().map(fromScreen);
    const tip = vertices
      .filter(({ x, y }) => x * along.x + y * along.y < 0)
      .sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y))[0]!;
    const outward = direction(tip);
    const gap = (MINE_REACH + Math.hypot(tip.x, tip.y)) / 2;
    const point = offset(start, outward, course.width / 2 + gap);
    expect(inNeedleChannel({ radius: MINE_REACH }, course, point)).toBe(false);
    expect(
      vertices.some((vertex) =>
        inNeedleChannel({}, course, {
          x: point.x + vertex.x,
          y: point.y + vertex.y,
        }),
      ),
    ).toBe(true);
    flight.player = { ...gate.point };
    flight.mines = [{ ...point, age: 0, damage: 3, id: "spike-graze", ownerId: "layer" }];
    const shield = flight.shield;
    stepFlight(CONTENT, 0.001, { ...idle, reducedMotion: true }, flight);
    expect(flight.mines.some(({ id }) => id === "spike-graze")).toBe(false);
    expect(flight.shield).toBe(shield);
  });

  it("clears a previously armed channel mine before it can activate on Ada", () => {
    const { flight, gate } = courseFlight();
    flight.player = { ...gate.point };
    flight.mines = [
      { ...gate.point, age: 1, damage: 3, id: "armed-channel-mine", ownerId: "layer" },
    ];
    const shield = flight.shield;
    stepFlight(CONTENT, 0.001, idle, flight);
    expect(flight.mines.some(({ id }) => id === "armed-channel-mine")).toBe(false);
    expect(flight.shield).toBe(shield);
  });

  it.each([false, true])(
    "relocates an existing channel guard without a combat outcome (paged: %s)",
    (paged) => {
      const { course, flight, gate } = courseFlight();
      const object = spawnChapterEnemy(
        CONTENT,
        "frigate",
        "retained-channel-guard",
        gate.point,
        flight,
        {
          home: gate.point,
          packId: "retained-channel-pack",
          routeId: "elderLoom",
        },
      )!;
      const hp = object.hp;
      const hull = object.enemy!.hp;
      if (paged) {
        flight.player = { x: gate.point.x + 100000, y: gate.point.y };
        syncFlightRegion(CONTENT, flight);
        expect(flight.world.notables[object.id]).toBe(object);
      }
      flight.player = { ...gate.point };
      const player = { ...flight.player };
      expect(routeBlocked("elderLoom", flight)).toBe(true);
      const events = stepFlight(CONTENT, 0.001, idle, flight);
      const retained =
        flight.objects.find(({ id }) => id === object.id) ?? flight.world.notables[object.id];
      expect(retained).toBe(object);
      expect(retained).toMatchObject({ hp, id: "retained-channel-guard", routeId: "elderLoom" });
      expect(object.enemy).toMatchObject({ hp: hull, packId: "retained-channel-pack" });
      expect(flight.combat!.initialPackSizes["retained-channel-pack"]).toBe(1);
      expect(inNeedleChannel({ radius: object.radius }, course, object)).toBe(false);
      expect(flight.player).toEqual(player);
      expect(flight.world.notables[object.id]).not.toBeNull();
      expect(routeBlocked("elderLoom", flight)).toBe(true);
      expect(
        events.filter(({ type }) => ["enemyDestroyed", "enemyDisabled", "stardust"].includes(type)),
      ).toEqual([]);
    },
  );

  it("prepares a legal new Needle flight before its first save without advancing physics", () => {
    const built = BUILT as Set<GalaxyNumber>;
    const present = built.has(4);
    built.add(4);
    try {
      const model = new GameModel(CONTENT);
      Object.assign(model.state, {
        prologueSeen: true,
        started: true,
        unlocked: [...GALAXY_NUMBERS],
      });
      for (const progress of Object.values(model.state.progress)) {
        progress.opened = true;
      }
      model.startGalaxy(4);
      const flight = model.state.flight!;
      expect(flight.time).toBe(0);
      expect(flight.player).toEqual({ x: 0, y: 0 });
      expect(restoreSave(model.save())).not.toBeNull();
      const enemies = [
        ...flight.objects,
        ...Object.values(flight.world.notables).filter(
          (object): object is SpaceObject => object !== null,
        ),
      ].filter(({ kind }) => kind === "enemy");
      expect(enemies.length).toBeGreaterThan(0);
      for (const object of enemies) {
        expect(
          activeNeedleCourses(flight).some((course) =>
            inNeedleChannel({ radius: object.radius }, course, object),
          ),
        ).toBe(false);
      }
      expect(model.state.progress[4].needle).toMatchObject({ eyeLit: 0, practiceLit: 0 });
    } finally {
      if (!present) {
        built.delete(4);
      }
    }
  });

  it("clips an actual Phaser tell and fired beam at the course boundary", () => {
    // Phantom supplies a legal beam producer; course metadata isolates the generic boundary,
    // rather than claiming a legal Needle loadout or a production chapter/save state.
    const flight = createFlight(CONTENT, 6, 173, newProgress());
    flight.objects = [];
    flight.player = { x: 0, y: 0 };
    let id = "";
    let mount = "";
    for (let index = 0; index < 100 && !mount; index++) {
      const candidate = `beam-target:${index}`;
      const selected = [...heavyLoadout("capital", ROUTE_POSITION[6], candidate)!].find(
        ([, weapon]) => weapon === "phaser",
      );
      if (selected) {
        id = candidate;
        mount = selected[0];
      }
    }
    expect(mount).not.toBe("");
    const point = { x: 220, y: 0 };
    const definition = enemyDefinition(6, "capital", id);
    const enemy = createEnemy(
      definition,
      { archetype: "capital", id, packId: null, phase: 0 },
      point,
    );
    enemy.hardpoints.forEach((part) => {
      part.cooldown = part.id === mount ? 0 : 999;
    });
    flight.objects = [
      {
        ...point,
        enemy,
        hp: enemy.hp,
        id,
        kind: "enemy",
        radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
      },
    ];
    stepFlight(CONTENT, 1 / 60, idle, flight);
    const beam = activeEnemyBeams(flight)[0]!;
    expect(beam).toBeDefined();
    expect(beam.fired).toBe(false);
    const origin = needleCourses(courseFlight().flight)!.practice.gates[0]!.point;
    flight.needle = { anchor: { x: -origin.x, y: -origin.y }, chatter: [], exitPackPlaced: true };
    const shield = flight.shield;
    stepFlight(CONTENT, 0.001, idle, flight);
    expect(beam.fired).toBe(false);
    expect(beam.stopped).toBe(true);
    expect(Math.hypot(beam.end.x - beam.muzzle.x, beam.end.y - beam.muzzle.y)).toBeLessThan(
      beam.range,
    );
    expect(
      activeNeedleCourses(flight).some((course) =>
        inNeedleChannel({ radius: BEAM.halfWidth + 0.001 }, course, beam.end),
      ),
    ).toBe(true);
    stepFlight(CONTENT, PHASER_AIM_SECONDS, idle, flight);
    expect(beam.fired).toBe(true);
    expect(beam.stopped).toBe(true);
    expect(flight.shield).toBe(shield);
  });
});
