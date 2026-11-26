import { describe, expect, it } from "vitest";

import capital from "../../public/art/enemies/fleetCapital-prow.json" with { type: "json" };
import capitalBroad from "../../public/art/enemies/fleetCapitalBroad-prow.json" with { type: "json" };
import capitalCrossbow from "../../public/art/enemies/fleetCapitalCrossbow-prow.json" with { type: "json" };
import capitalForked from "../../public/art/enemies/fleetCapitalForked-prow.json" with { type: "json" };
import capitalManta from "../../public/art/enemies/fleetCapitalManta-prow.json" with { type: "json" };
import capitalOutrigger from "../../public/art/enemies/fleetCapitalOutrigger-prow.json" with { type: "json" };
import frigateFile from "../../public/art/enemies/fleetFrigate-prow.json" with { type: "json" };
import frigateTwin from "../../public/art/enemies/fleetFrigateTwin-prow.json" with { type: "json" };
import {
  ENEMY_AIM,
  ENEMY_SPEED_SHARE,
  type EnemyDefinition,
  enemyDefinition,
  FLAGSHIP_PART_HP,
  FRONT_LASER_COUNT,
  FRONT_LASER_MOUNTS,
  frontLaserHardpoints,
  type FrontLaserMounts,
  mountedEnemyDefinition,
  PHANTOM_FLAGSHIP_ID,
} from "../data/enemyCatalog.ts";
import { HULL_DESIGN_KEYS, hullDesignClass } from "../data/enemyIdentity.ts";
import { ENEMY_DISPLAY_SCALE } from "../data/enemyMuzzles.ts";
import { ENEMY_FORWARD_GUNS } from "../data/enemyNavigation.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { weaponAt, weaponSpeed } from "../data/weaponCatalog.ts";
import {
  createEnemy,
  damageEnemy,
  type EnemyContext,
  enemyEffects,
  type EnemyState,
  stepEnemy,
  withinNoseArc,
} from "./enemyAi.ts";
import { drawnIndex } from "./muzzles.ts";

/** Explicit test mounts on every frigate, capital and flagship design, not Art's positions. */
const TEST_PROW_PAIR = [
  { id: "test-prow-left", offset: { x: -0.05, y: -0.46 } },
  { id: "test-prow-right", offset: { x: 0.05, y: -0.46 } },
];
const TEST_MOUNTS: FrontLaserMounts = {
  archie: TEST_PROW_PAIR,
  capital: TEST_PROW_PAIR,
  ...Object.fromEntries(
    HULL_DESIGN_KEYS.map((key) => [
      key,
      hullDesignClass(key) === "capital"
        ? TEST_PROW_PAIR
        : [{ id: "test-prow", offset: { x: 0, y: -0.42 } }],
    ]),
  ),
  frigate: [{ id: "test-prow", offset: { x: 0, y: -0.42 } }],
};
const FRONT_IDS = new Set(["test-prow", "test-prow-left", "test-prow-right"]);

type Vector = { x: number; y: number };
const degreesBetween = (a: Vector, b: Vector) =>
  (Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)) * 180) / Math.PI;
const toward = (from: Vector, to: Vector) => {
  const size = Math.hypot(to.x - from.x, to.y - from.y);
  return { x: (to.x - from.x) / size, y: (to.y - from.y) / size };
};
const arcDegrees = (ENEMY_FORWARD_GUNS.arcRadians * 180) / Math.PI;
const driftDegrees = (ENEMY_AIM.driftRadians * 180) / Math.PI;

/** A Sunflower heavy on the test mounts. */
const frigate = (weaponLevel: 1 | 2 | 3 = 1) =>
  mountedEnemyDefinition(TEST_MOUNTS, 1, "frigate", "test-frigate", weaponLevel);
const frontParts = (definition: EnemyDefinition) =>
  definition.hardpoints.filter((part) => part.kind === "weapon" && part.fixed);

const ada = { x: 0, y: 0 };
/** An engaged heavy with every clock ready, `range` units from Ada along `-facing`. */
function engaged(definition: EnemyDefinition, facing: Vector, offset: Vector): EnemyState {
  const state = createEnemy(
    definition,
    { archetype: "frigate", id: "test-frigate", packId: null, phase: 0 },
    offset,
  );
  return {
    ...state,
    engaged: true,
    facing,
    firePhasesInitialized: true,
    heading: facing,
    velocity: {
      x: facing.x * definition.physics.maxSpeed * 0.5,
      y: facing.y * definition.physics.maxSpeed * 0.5,
    },
  };
}
const context = (state: EnemyState): EnemyContext => ({
  adaWidth: 20,
  dt: 1 / 60,
  inPlayView: true,
  initialPackSizes: {},
  lead: 1,
  peers: [state],
  player: ada,
  playerVelocity: { x: 0, y: 0 },
  routePosition: 1,
  targetable: true,
  visibility: "visible",
});
interface Step {
  before: EnemyState;
  intent: ReturnType<typeof stepEnemy>;
}
/** Steps a ship at 60 Hz for `seconds` against a still Ada, moving it by its velocity. */
function fly(definition: EnemyDefinition, seconds: number, state: EnemyState): Step[] {
  const steps: Step[] = [];
  let current = state;
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
    const intent = stepEnemy(definition, context(current), current);
    steps.push({ before: current, intent });
    const { velocity } = intent.state;
    current = {
      ...intent.state,
      position: {
        x: current.position.x + velocity.x / 60,
        y: current.position.y + velocity.y / 60,
      },
    };
  }
  return steps;
}
const frontShots = (steps: Step[]) =>
  steps.flatMap(({ before, intent }) =>
    intent.fire
      .filter((shot) => shot.hardpointId !== null && FRONT_IDS.has(shot.hardpointId))
      .map((shot) => ({ before, facing: intent.state.facing, shot })),
  );

describe("heavy front Lasers", () => {
  it("adds one to a frigate and two to a capital and the flagship, none to fixed heavies", () => {
    for (const galaxy of [1, 2, 3, 4, 5, 6] as const) {
      const share = (archetype: "capital" | "frigate") =>
        frontParts(mountedEnemyDefinition(TEST_MOUNTS, galaxy, archetype, "ship", 2));
      expect(share("frigate")).toHaveLength(FRONT_LASER_COUNT.frigate);
      expect(share("capital")).toHaveLength(FRONT_LASER_COUNT.capital);
    }
    expect(FRONT_LASER_COUNT).toEqual({ capital: 2, frigate: 1 });
    const flagship = mountedEnemyDefinition(TEST_MOUNTS, 6, "capital", PHANTOM_FLAGSHIP_ID);
    expect(frontParts(flagship).map((part) => [part.id, part.hp])).toEqual([
      ["test-prow-left", FLAGSHIP_PART_HP],
      ["test-prow-right", FLAGSHIP_PART_HP],
    ]);
    for (const galaxy of [2, 5, 6] as const) {
      expect(frontParts(mountedEnemyDefinition(TEST_MOUNTS, galaxy, "platform"))).toEqual([]);
      expect(
        frontParts(mountedEnemyDefinition(TEST_MOUNTS, galaxy, "hostileStation", "station", 3)),
      ).toEqual([]);
    }
    // They come in addition to the tier's mounts.
    const turrets = (definition: EnemyDefinition) =>
      definition.hardpoints.filter((part) => part.kind === "weapon" && !part.fixed).length;
    expect(turrets(frigate())).toBe(turrets(enemyDefinition(1, "frigate", "test-frigate")));
  });

  it("fires the shared Laser at the equipped level, heavy shot speed, the ship's Laser rate and part HP", () => {
    for (const galaxy of [1, 6] as const) {
      const share = galaxy === 1 ? 0.25 : 0.35;
      for (const [archetype, rate] of [
        ["frigate", 1],
        ["capital", 1.5],
      ] as const) {
        const definition = mountedEnemyDefinition(TEST_MOUNTS, galaxy, archetype, "ship", 3);
        const turret = definition.hardpoints.find((part) => part.kind === "weapon")!;
        for (const part of frontParts(definition)) {
          if (part.kind !== "weapon") {
            throw Error("expected a front Laser");
          }
          expect(part.hp).toBe(turret.hp);
          expect(part.hp).toBe([10, 10, 12, 12, 14, 14][ROUTE_POSITION[galaxy] - 1]);
          expect([part.fire.weapon, part.fire.level, part.fire.angles]).toEqual([
            "laser",
            3,
            weaponAt("laser", 3).anglesDegrees,
          ]);
          expect(part.fire.projectileSpeed).toBeCloseTo(
            ENEMY_SPEED_SHARE.heavy * weaponSpeed("laser", 1),
            9,
          );
          expect(part.fire.projectileSpeed).toBeCloseTo(400, 9);
          expect(part.fire.interval).toBeCloseTo(
            weaponAt("laser", 3).intervalSeconds / (share * rate),
            12,
          );
        }
      }
    }
  });

  it("ships Art's prow mounts on every frigate, capital and flagship design", () => {
    const files = {
      capital,
      capitalBroad,
      capitalCrossbow,
      capitalForked,
      capitalManta,
      capitalOutrigger,
      frigate: frigateFile,
      frigateTwin,
    };
    expect(Object.keys(FRONT_LASER_MOUNTS).sort()).toEqual(
      ["archie", ...Object.keys(files)].sort(),
    );
    for (const [key, file] of Object.entries(files)) {
      // Each offset is Art's frame px from the hull pivot over the hull width.
      const lasers = file.hardpoints.flatMap((part) =>
        "aim" in part && part.aim === "facing" && "offset" in part
          ? [
              {
                id: part.id,
                offset: {
                  x: part.offset[0]! / file.hull.width,
                  y: part.offset[1]! / file.hull.width,
                },
              },
            ]
          : [],
      );
      expect(FRONT_LASER_MOUNTS[key as keyof typeof files]).toEqual(lasers);
      expect(lasers.map(({ id }) => id)).toEqual(
        hullDesignClass(key) === "frigate" || key === "frigate"
          ? ["prow"]
          : ["prow-left", "prow-right"],
      );
    }
    expect(FRONT_LASER_MOUNTS.archie!.map(({ id }) => id)).toEqual(["prow-left", "prow-right"]);
    for (const [key, mounts] of Object.entries(FRONT_LASER_MOUNTS)) {
      const archetype = key === "archie" ? "capital" : (hullDesignClass(key) ?? key);
      expect(mounts).toHaveLength(FRONT_LASER_COUNT[archetype as "capital" | "frigate"]);
    }
    expect(() =>
      frontLaserHardpoints({ frigate: TEST_MOUNTS.capital! }, 1, 10, "frigate", "frigate"),
    ).toThrow(RangeError);
    // Every shipped heavy that moves carries them, the flagship's at 18 HP.
    for (const galaxy of [1, 2, 3, 4, 5, 6] as const) {
      expect(frontParts(enemyDefinition(galaxy, "frigate", "ship"))).toHaveLength(1);
      expect(frontParts(enemyDefinition(galaxy, "capital", "ship"))).toHaveLength(2);
    }
    expect(
      frontParts(enemyDefinition(6, "capital", PHANTOM_FLAGSHIP_ID)).map(({ hp, id }) => [id, hp]),
    ).toEqual([
      ["prow-left", 18],
      ["prow-right", 18],
    ]);
  });

  it("fires a shipped front Laser from Art's drawn shot origin along the facing", () => {
    const definition = enemyDefinition(1, "frigate", "test-frigate");
    for (const facing of [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
    ]) {
      const state = engaged(definition, facing, { x: -300 * facing.x, y: -300 * facing.y });
      const heading = drawnIndex(facing);
      const drawn = frigateFile.headings
        .find(({ index }) => index === heading)!
        .hardpoints.find(({ id }) => id === "prow")!;
      const half = frigateFile.frame / 2;
      const muzzle = (drawn as { muzzles: number[][] }).muzzles[0]!;
      // Frame px about the hull centre, at the display scale, through the inverse projection.
      const screen = {
        x: (muzzle[0]! - half) * ENEMY_DISPLAY_SCALE,
        y: (muzzle[1]! - half) * ENEMY_DISPLAY_SCALE,
      };
      const expected = {
        x: state.position.x + screen.y + screen.x / 2,
        y: state.position.y + screen.y - screen.x / 2,
      };
      const step = stepEnemy(definition, context(state), state);
      const shot = step.fire.find(({ hardpointId }) => hardpointId === "prow")!;
      expect(shot.origin.x).toBeCloseTo(expected.x, 9);
      expect(shot.origin.y).toBeCloseTo(expected.y, 9);
      expect(shot.aim.x).toBeCloseTo(step.state.facing.x, 12);
      expect(shot.aim.y).toBeCloseTo(step.state.facing.y, 12);
      expect(drawnIndex(step.state.facing)).toBe(heading);
    }
  });

  it("fires only along the facing while the aim point is inside the nose arc", () => {
    const definition = frigate();
    const reach = arcDegrees + driftDegrees + 1e-6;
    // Ada dead ahead: the front Laser fires along the facing.
    const ahead = engaged(definition, { x: 1, y: 0 }, { x: -300, y: 0 });
    const aheadShots = frontShots(fly(definition, 2, ahead));
    expect(aheadShots.length).toBeGreaterThan(0);
    for (const { facing, shot } of aheadShots) {
      expect(shot.aim.x).toBeCloseTo(facing.x, 9);
      expect(shot.aim.y).toBeCloseTo(facing.y, 9);
      expect(shot.speed).toBeCloseTo(400, 9);
      expect(degreesBetween(facing, toward(shot.origin, ada))).toBeLessThan(reach);
    }
    // Ada abeam: the turrets fire and the front Laser holds.
    const abeam = engaged(definition, { x: 1, y: 0 }, { x: 0, y: 300 });
    const step = stepEnemy(definition, context(abeam), abeam);
    expect(step.fire.length).toBeGreaterThan(0);
    expect(frontShots([{ before: abeam, intent: step }])).toEqual([]);
    expect(step.state.hardpoints.find((part) => part.id === "test-prow")!.aim).toEqual(
      step.state.facing,
    );
    // Ada astern: never.
    const astern = engaged(definition, { x: -1, y: 0 }, { x: -300, y: 0 });
    expect(frontShots(fly(definition, 0.5, astern))).toEqual([]);
  });

  it("shares the forward guns' nose arc test", () => {
    const facing = { x: 1, y: 0 };
    const at = (degrees: number) => ({
      x: Math.cos((degrees * Math.PI) / 180),
      y: Math.sin((degrees * Math.PI) / 180),
    });
    expect(withinNoseArc(ENEMY_FORWARD_GUNS.arcRadians, facing, at(19.9))).toBe(true);
    expect(withinNoseArc(ENEMY_FORWARD_GUNS.arcRadians, facing, at(-19.9))).toBe(true);
    expect(withinNoseArc(ENEMY_FORWARD_GUNS.arcRadians, facing, at(20.1))).toBe(false);
    expect(withinNoseArc(ENEMY_FORWARD_GUNS.arcRadians, facing, at(180))).toBe(false);
  });

  it("counts each front Laser toward disabling the heavy", () => {
    const definition = frigate();
    let state = engaged(definition, { x: 1, y: 0 }, { x: -300, y: 0 });
    const weapons = definition.hardpoints.filter((part) => part.kind === "weapon");
    for (const part of weapons.filter((part) => !FRONT_IDS.has(part.id))) {
      state = damageEnemy(definition, { amount: part.hp, hardpointId: part.id }, state);
    }
    // Every mount is down, but the front Laser still fights.
    expect(enemyEffects(definition, state).disabled).toBe(false);
    expect(frontShots(fly(definition, 2, state)).length).toBeGreaterThan(0);
    const prow = weapons.find((part) => part.id === "test-prow")!;
    state = damageEnemy(definition, { amount: prow.hp - 1, hardpointId: prow.id }, state);
    expect(state.disabled).toBe(false);
    state = damageEnemy(definition, { amount: 1, hardpointId: prow.id }, state);
    expect(state.disabled).toBe(true);
    expect(state.hp).toBe(definition.hp);
    expect(stepEnemy(definition, context(state), state).fire).toEqual([]);
  });

  it("keeps a heavy facing its travel instead of turning toward Ada", () => {
    const definition = frigate();
    // Ada abeam of a frigate cruising along +x: its hull follows its velocity, and its front
    // Laser fires only once that travel brings her into the nose arc.
    const start = engaged(definition, { x: 1, y: 0 }, { x: -200, y: -250 });
    const steps = fly(definition, 3, start);
    for (const { intent } of steps) {
      const { facing, velocity } = intent.state;
      if (Math.hypot(velocity.x, velocity.y) > 1) {
        expect(degreesBetween(facing, velocity)).toBeLessThan(5);
      }
    }
    for (const { facing, shot } of frontShots(steps)) {
      expect(degreesBetween(facing, toward(shot.origin, ada))).toBeLessThan(
        arcDegrees + driftDegrees + 1e-6,
      );
    }
  });

  it("steps front Laser fire deterministically across a JSON round trip", () => {
    const definition = frigate(2);
    const state = engaged(definition, { x: 1, y: 0 }, { x: -300, y: 40 });
    const first = fly(definition, 1, state);
    expect(fly(definition, 1, state)).toEqual(first);
    expect(frontShots(first).length).toBeGreaterThan(0);
    const middle = first[29]!.intent.state;
    const resumed = fly(definition, 0.5, JSON.parse(JSON.stringify(middle)) as EnemyState);
    expect(resumed).toEqual(fly(definition, 0.5, middle));
  });
});
