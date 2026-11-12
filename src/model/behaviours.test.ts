import { describe, expect, it } from "vitest";

import {
  DIFFICULTY_SCALE,
  encounterQuiet,
  type EnemyArchetype,
  enemyCatalog,
  enemyDefinition,
  escortTuning,
} from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import type { SectorId } from "../data/types.ts";
import {
  aimDrift,
  createEnemy,
  damageEnemy,
  type EnemyContext,
  enemyEffects,
  type EnemyState,
  hardpointOffset,
  stepEnemy,
} from "./enemy-ai.ts";
import { encounterSpacing, hostsEncounterCell } from "./flight.ts";

const dt = 1 / 60;
/** `vector` turned by `angle` radians, as a ship's aim drift turns its line of fire. */
const rotate = (vector: { x: number; y: number }, angle: number) => ({
  x: vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
  y: vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
});
const ada = { x: 0, y: 0 };
const spawn = (archetype: EnemyArchetype, position: { x: number; y: number }, engaged = true) => ({
  ...createEnemy(
    enemyCatalog[archetype],
    { archetype, id: archetype, packId: null, phase: 0.7 },
    position,
  ),
  engaged,
});
const context = (peers: readonly EnemyState[], player = ada): EnemyContext => ({
  adaWidth: PROTOTYPE.tuning.flight.shipRadius * 2,
  dt,
  initialPackSizes: {},
  lead: 1,
  peers,
  player,
  playerVelocity: { x: 0, y: 0 },
  projectileSpeed: PROTOTYPE.tuning.enemyProjectileSpeed,
  targetable: true,
  visibility: "visible",
});
const range = (state: EnemyState, player = ada) =>
  Math.hypot(state.position.x - player.x, state.position.y - player.y);

/** Steps ships together, integrating positions as the runtime does without obstacles. */
function run(
  ships: EnemyState[],
  frames: number,
  options: { context?: (peers: readonly EnemyState[]) => EnemyContext; each?: () => void } = {},
): { shots: number[] } {
  const shots = ships.map(() => 0);
  for (let frame = 0; frame < frames; frame++) {
    const peers = ships.map((ship) => ({ ...ship }));
    ships.forEach((ship, index) => {
      const result = stepEnemy(
        enemyCatalog[ship.archetype],
        (options.context ?? context)(peers),
        ship,
      );
      shots[index]! += result.fire.length;
      ships[index] = {
        ...result.state,
        position: {
          x: ship.position.x + result.velocity.x * dt,
          y: ship.position.y + result.velocity.y * dt,
        },
      };
    });
    options.each?.();
  }
  return { shots };
}

describe("hitAndRun", () => {
  it("pulls away after a burst of volleys, then comes back", () => {
    const behaviour = enemyCatalog.fighter.behaviour;
    expect(behaviour.kind).toBe("hitAndRun");
    if (behaviour.kind !== "hitAndRun") {
      return;
    }
    const ships = [spawn("fighter", { x: 300, y: 0 })];
    let fired = 0;
    let frames = 0;
    while (ships[0]!.tactic.phase === "attack" && frames < 600) {
      fired += run(ships, 1).shots[0]!;
      frames++;
    }
    expect(ships[0]!.tactic.phase).toBe("retreat");
    expect(fired).toBe(behaviour.burstVolleys);
    const start = range(ships[0]!);
    run(ships, Math.round(behaviour.retreatSeconds / dt) - 1);
    expect(ships[0]!.tactic.phase).toBe("retreat");
    const farthest = range(ships[0]!);
    expect(farthest).toBeGreaterThan(start + 60);
    run(ships, 2);
    expect(ships[0]!.tactic.phase).toBe("attack");
    let closest = farthest;
    for (let frame = 0; frame < 180; frame++) {
      run(ships, 1);
      closest = Math.min(closest, range(ships[0]!));
    }
    expect(closest).toBeLessThan(farthest - 100);
  });

  it("pulls away as soon as it is hit", () => {
    // Out of firing range, so only the hit can end the attack.
    const ships = [spawn("fighter", { x: 600, y: 0 })];
    run(ships, 10);
    expect(ships[0]!.tactic).toMatchObject({ phase: "attack", volleys: 0 });
    ships[0] = damageEnemy(enemyCatalog.fighter, { amount: 1, hardpointId: null }, ships[0]!);
    run(ships, 1);
    expect(ships[0]!.tactic.phase).toBe("retreat");
    const before = range(ships[0]!);
    run(ships, 60);
    expect(range(ships[0]!)).toBeGreaterThan(before);
  });
});

describe("strafe", () => {
  it("passes beside Ada on momentum and loops back for another pass", () => {
    const behaviour = enemyCatalog.interceptor.behaviour;
    expect(behaviour.kind).toBe("strafe");
    if (behaviour.kind !== "strafe") {
      return;
    }
    const ships = [spawn("interceptor", { x: 600, y: 0 })];
    const phases: string[] = [];
    let crossed = false;
    let closest = Infinity;
    let farthestAfterPass = 0;
    run(ships, 60 * 12, {
      each: () => {
        const ship = ships[0]!;
        if (phases.at(-1) !== ship.tactic.phase) {
          phases.push(ship.tactic.phase);
        }
        crossed ||= ship.position.x < 0;
        closest = Math.min(closest, range(ship));
        if (phases.includes("pass")) {
          farthestAfterPass = Math.max(farthestAfterPass, range(ship));
        }
      },
    });
    expect(phases.slice(0, 4)).toEqual(["attack", "pass", "attack", "pass"]);
    expect(closest).toBeGreaterThanOrEqual(behaviour.passDistance);
    expect(crossed).toBe(true);
    expect(farthestAfterPass).toBeGreaterThanOrEqual(behaviour.loopDistance);
  });
});

describe("swarm", () => {
  it("closes in erratically while peers separate", () => {
    const ships = [
      { x: 500, y: 0 },
      { x: 505, y: 4 },
      { x: 503, y: -5 },
      { x: 498, y: 6 },
    ].map((point, index) => ({
      ...spawn("swarm", point),
      id: `swarm:${index}`,
      phase: index,
    }));
    const spread = () =>
      Math.min(
        ...ships.flatMap((ship, index) =>
          ships
            .slice(index + 1)
            .map((other) =>
              Math.hypot(ship.position.x - other.position.x, ship.position.y - other.position.y),
            ),
        ),
      );
    expect(spread()).toBeLessThan(10);
    run(ships, 120);
    expect(spread()).toBeGreaterThan(25);
    for (const ship of ships) {
      expect(range(ship)).toBeLessThan(400);
    }
  });
});

describe("flee", () => {
  it("runs from Ada and holds fire once pack losses break morale", () => {
    const ships = [{ ...spawn("swarm", { x: 200, y: 0 }), packId: "pack" }];
    const lossContext = (peers: readonly EnemyState[]) => ({
      ...context(peers),
      initialPackSizes: { pack: 5 },
    });
    const { shots } = run(ships, 120, { context: lossContext });
    expect(ships[0]!.fleeing).toBe(true);
    expect(range(ships[0]!)).toBeGreaterThan(300);
    expect(shots[0]).toBe(0);
  });
});

describe("retaliate", () => {
  it("ignores Ada until hit, then attacks from its band", () => {
    const ships = [spawn("retaliator", { x: 200, y: 0 }, false)];
    const idle = run(ships, 180);
    expect(ships[0]!.engaged).toBe(false);
    expect(ships[0]!.velocity).toEqual({ x: 0, y: 0 });
    expect(idle.shots[0]).toBe(0);
    ships[0] = damageEnemy(enemyCatalog.retaliator, { amount: 1, hardpointId: null }, ships[0]!);
    const attack = run(ships, 180);
    expect(attack.shots[0]).toBeGreaterThan(0);
    const band = enemyCatalog.retaliator.standoff;
    expect(range(ships[0]!)).toBeGreaterThan(band.near - 50);
    expect(range(ships[0]!)).toBeLessThan(band.far + 50);
  });
});

describe("escort", () => {
  const hull = (enemyCatalog.capital.sizeRatio * PROTOTYPE.tuning.flight.shipRadius * 2) / 2;
  const station = hull + escortTuning.stationGap;
  function battle(): EnemyState[] {
    // The capital's engine is out, so only the escort moves.
    const capital = damageEnemy(
      enemyCatalog.capital,
      { amount: 99, hardpointId: "engine-left" },
      { ...spawn("capital", { x: 0, y: 0 }), id: "capital" },
    );
    const escort = {
      ...createEnemy(
        enemyCatalog.fighter,
        { archetype: "fighter", escortOf: "capital", id: "escort", packId: null, phase: 0 },
        { x: station, y: 0 },
      ),
      engaged: true,
    };
    return [capital, escort];
  }

  it("holds its station beside the capital while Ada stays clear of it", () => {
    const ships = battle();
    const far = { x: station + 590, y: 0 };
    expect(far.x).toBeGreaterThan(escortTuning.interceptRadius + hull);
    run(ships, 180, { context: (peers) => context(peers, far) });
    const escort = ships[1]!;
    expect(escort.engaged).toBe(true);
    expect(Math.hypot(escort.position.x - station, escort.position.y)).toBeLessThan(15);
  });

  it("intercepts Ada when she comes close to its capital, holding its band from her", () => {
    const ships = battle();
    const near = { x: 600, y: 0 };
    expect(near.x).toBeLessThanOrEqual(escortTuning.interceptRadius + hull);
    run(ships, 180, { context: (peers) => context(peers, near) });
    expect(ships[1]!.position.x).toBeGreaterThan(station + 120);
    expect(range(ships[1]!, near)).toBeGreaterThan(enemyCatalog.fighter.standoff.near - 60);
  });

  it("falls back to its own attack behaviour without a loaded capital", () => {
    const ships = [battle()[1]!];
    const before = range(ships[0]!, { x: 500, y: 0 });
    run(ships, 60, { context: (peers) => context(peers, { x: 500, y: 0 }) });
    expect(range(ships[0]!, { x: 500, y: 0 })).toBeLessThan(before - 50);
  });
});

describe("siege", () => {
  it("advances slowly on Ada while its turrets fire", () => {
    const behaviour = enemyCatalog.frigate.behaviour;
    expect(behaviour.kind).toBe("siege");
    if (behaviour.kind !== "siege") {
      return;
    }
    const maxSpeed = enemyCatalog.frigate.physics.maxSpeed;
    const ships = [spawn("frigate", { x: 450, y: 0 })];
    let fastest = 0;
    const { shots } = run(ships, 180, {
      each: () => {
        fastest = Math.max(fastest, Math.hypot(ships[0]!.velocity.x, ships[0]!.velocity.y));
      },
    });
    expect(fastest).toBeGreaterThan(0);
    expect(fastest).toBeLessThanOrEqual(maxSpeed * behaviour.speedFraction + 1e-9);
    expect(range(ships[0]!)).toBeLessThan(430);
    expect(shots[0]).toBeGreaterThan(0);
  });
});

describe("standoff", () => {
  const bands = {
    fighter: enemyCatalog.fighter.standoff,
    interceptor: enemyCatalog.interceptor.standoff,
    retaliator: enemyCatalog.retaliator.standoff,
    swarm: enemyCatalog.swarm.standoff,
  };
  /** An attacking ship at `point`; a retaliator attacks once hit. */
  const attacker = (
    archetype: keyof typeof bands,
    point: { x: number; y: number },
    phase = 0.7,
  ) => {
    const ship = { ...spawn(archetype, point), phase };
    return archetype === "retaliator"
      ? damageEnemy(enemyCatalog.retaliator, { amount: 1, hardpointId: null }, ship)
      : ship;
  };
  /** Ranges from Ada each frame after the first `settle` seconds. */
  const ranges = (ship: EnemyState, seconds: number, settle: number): number[] => {
    const ships = [ship];
    const seen: number[] = [];
    let frame = 0;
    run(ships, Math.round(seconds / dt), {
      each: () => {
        if (++frame > settle / dt) {
          seen.push(range(ships[0]!));
        }
      },
    });
    return seen;
  };

  it("gives Gameplay's bands to the small craft and none to heavies", () => {
    expect(bands).toEqual({
      fighter: { far: 350, near: 250 },
      interceptor: { far: 250, near: 150 },
      retaliator: { far: 350, near: 250 },
      swarm: { far: 300, near: 200 },
    });
    for (const heavy of ["frigate", "capital", "platform"] as const) {
      expect(enemyCatalog[heavy]).not.toHaveProperty("standoff");
    }
  });

  it.each(["swarm", "retaliator"] as const)(
    "holds %s inside its band once it has closed in, strafing rather than stopping",
    (archetype) => {
      const band = bands[archetype];
      for (const point of [
        { x: 500, y: 0 },
        { x: -300, y: 300 },
      ]) {
        const seen = ranges(attacker(archetype, point), 14, 6);
        expect(Math.min(...seen)).toBeGreaterThan(band.near - 50);
        expect(Math.max(...seen)).toBeLessThan(band.far + 50);
      }
      // Holding the band still moves it around Ada.
      const ships = [attacker(archetype, { x: 500, y: 0 })];
      run(ships, 60 * 6);
      expect(Math.hypot(ships[0]!.velocity.x, ships[0]!.velocity.y)).toBeGreaterThan(
        enemyCatalog[archetype].physics.maxSpeed * 0.5,
      );
    },
  );

  it.each(["swarm", "fighter"] as const)(
    "backs %s off when Ada is inside its band",
    (archetype) => {
      const band = bands[archetype];
      const ships = [attacker(archetype, { x: 60, y: 20 })];
      run(ships, 60 * 3);
      expect(range(ships[0]!)).toBeGreaterThan(band.near - 60);
    },
  );

  it.each(["swarm", "fighter", "retaliator", "interceptor"] as const)(
    "never presses %s in to ram a waiting Ada",
    (archetype) => {
      for (const [point, phase] of [
        [{ x: 500, y: 0 }, 0.7],
        [{ x: -300, y: 300 }, 4],
        [{ x: 0, y: -600 }, 2.5],
      ] as const) {
        expect(Math.min(...ranges(attacker(archetype, point, phase), 14, 0))).toBeGreaterThan(150);
      }
    },
  );

  it("keeps the interceptor's passes no closer than its floor from every side", () => {
    const behaviour = enemyCatalog.interceptor.behaviour;
    expect(behaviour).toMatchObject({ kind: "strafe", loopDistance: 420, passDistance: 150 });
    if (behaviour.kind !== "strafe") {
      return;
    }
    for (let index = 0; index < 8; index++) {
      const angle = (index * Math.PI) / 4;
      const point = { x: Math.cos(angle) * 600, y: Math.sin(angle) * 600 };
      const closest = Math.min(...ranges(attacker("interceptor", point, index), 20, 0));
      expect(closest).toBeGreaterThanOrEqual(behaviour.passDistance);
    }
  });
});

describe("galaxy difficulty", () => {
  it.each([
    [1, 1.2, 1.44],
    [3, 1.3, 1.63],
    [4, 1.4, 1.81],
    [5, 1.45, 1.88],
    [2, 1.5, 1.94],
    [6, 1.5, 2],
  ] as const)(
    "scales galaxy %i's perception by %f and fire rate by %f, its route position's",
    (sector, perception, fireRate) => {
      for (const archetype of Object.keys(enemyCatalog) as EnemyArchetype[]) {
        const base = enemyCatalog[archetype];
        const scaled = enemyDefinition(sector, archetype);
        expect(scaled.perception).toBeCloseTo(base.perception * perception, 9);
        expect(1 / scaled.fire.interval).toBeCloseTo((1 / base.fire.interval) * fireRate, 9);
        scaled.hardpoints.forEach((part, index) => {
          const original = base.hardpoints[index]!;
          if (part.kind === "weapon" && original.kind === "weapon") {
            expect(part.fire.interval).toBeCloseTo(original.fire.interval / fireRate, 9);
          }
        });
      }
    },
  );

  it("gives every route position Gameplay's hull and hardpoint HP and retreat time", () => {
    const archetypes = [
      "swarm",
      "fighter",
      "interceptor",
      "retaliator",
      "frigate",
      "capital",
      "platform",
    ] as const;
    // Galaxies in route order: Sunflower, Whirlpool, Needle, Andromeda, Cartwheel, Black Eye.
    const rows = ([1, 3, 4, 5, 2, 6] as const).map((sector) => [
      ...archetypes.map((archetype) => enemyDefinition(sector, archetype).hp),
      enemyDefinition(sector, "capital").hardpoints[0]!.hp,
      enemyDefinition(sector, "frigate").hardpoints.at(-1)!.hp,
    ]);
    expect(rows).toEqual([
      [2, 4, 3, 8, 20, 40, 10, 4, 4],
      [2, 5, 3, 9, 22, 44, 11, 4, 4],
      [3, 5, 4, 10, 30, 60, 15, 5, 5],
      [3, 6, 4, 11, 32, 64, 16, 5, 5],
      [3, 6, 5, 11, 44, 88, 22, 6, 6],
      [3, 6, 5, 12, 48, 96, 24, 6, 6],
    ]);
    const retreat = (sector: SectorId) => {
      const behaviour = enemyDefinition(sector, "fighter").behaviour;
      return behaviour.kind === "hitAndRun" ? behaviour.retreatSeconds : null;
    };
    // Sunflower's and Cartwheel's fighters hit and run; Black Eye reads Cartwheel's roster.
    expect([1, 2, 6].map((sector) => retreat(sector as SectorId))).toEqual([1.6, 1.1, 1]);
    expect(DIFFICULTY_SCALE).toBe(1);
    expect(enemyDefinition(2, "fighter").behaviour.kind).toBe("hitAndRun");
    expect(enemyDefinition(2, "interceptor").behaviour.kind).toBe("hitAndRun");
    expect(enemyDefinition(3, "fighter").behaviour.kind).toBe("chase");
    expect(enemyDefinition(3, "interceptor").behaviour.kind).toBe("chase");
    expect(enemyDefinition(1, "interceptor").behaviour.kind).toBe("strafe");
  });

  it("shortens quiet travel and time and raises encounter density 50% in galaxy one", () => {
    expect(encounterQuiet(1)).toEqual({ distance: 1200, seconds: 8 });
    expect(encounterQuiet(2).distance).toBeCloseTo(1800 / 1.75, 9);
    expect(encounterQuiet(3).seconds).toBeCloseTo(12 / 1.63, 9);
    expect(encounterSpacing(PROTOTYPE, 3)).toBeCloseTo(4 / Math.sqrt(1.63), 9);
    const spacing = encounterSpacing(PROTOTYPE, 1);
    const hosts = (value: number) =>
      Array.from({ length: 20000 }, (_, index) => index - 10000).filter((index) =>
        hostsEncounterCell(value, index),
      );
    const first = hosts(spacing);
    const shared = hosts(4);
    // Cells sit on a grid, so per-axis density squared is the areal density.
    expect((first.length / shared.length) ** 2).toBeCloseTo(1.5, 2);
    expect(shared.every((index) => index % 4 === 0)).toBe(true);
    const gaps = first.slice(1).map((index, at) => index - first[at]!);
    expect(Math.min(...gaps) * PROTOTYPE.tuning.chunkSize).toBeGreaterThanOrEqual(
      encounterQuiet(1).distance,
    );
  });
});

describe("engine thrust", () => {
  /** Cruises a ship toward a distant home and reports its settled speed. */
  function cruise(state: EnemyState): number {
    const ships = [{ ...state, engaged: false, home: { x: 100000, y: 0 }, returning: true }];
    run(ships, 60 * 20, { context: (peers) => ({ ...context(peers), visibility: "unknown" }) });
    return Math.hypot(ships[0]!.velocity.x, ships[0]!.velocity.y);
  }
  const capital = () => spawn("capital", { x: 0, y: 0 }, false);
  const disable = (ids: string[], state: EnemyState) =>
    ids.reduce(
      (next, id) => damageEnemy(enemyCatalog.capital, { amount: 99, hardpointId: id }, next),
      state,
    );

  it.each([
    [[], 1],
    [["engine-left"], 0.5],
    [["engine-left", "engine-right"], 0],
  ] as const)("scales capital top speed with working engines when %j are out", (ids, share) => {
    const state = disable([...ids], capital());
    const effects = enemyEffects(enemyCatalog.capital, state);
    expect(effects.thrust).toBe(share);
    expect(effects.movementStopped).toBe(share === 0);
    expect(effects.defeated).toBe(false);
    const full = enemyCatalog.capital.physics.maxSpeed;
    expect(cruise(state)).toBeCloseTo(full * share, 0);
  });

  it("slows a capital that loses an engine through its own physics", () => {
    const full = enemyCatalog.capital.physics.maxSpeed;
    const moving = { ...capital(), velocity: { x: full, y: 0 } };
    const damaged = disable(["engine-left"], moving);
    const ships = [{ ...damaged, home: { x: 100000, y: 0 }, returning: true }];
    run(ships, 1, { context: (peers) => ({ ...context(peers), visibility: "unknown" }) });
    const speed = Math.hypot(ships[0]!.velocity.x, ships[0]!.velocity.y);
    expect(speed).toBeLessThan(full);
    expect(speed).toBeGreaterThan(full * 0.9);
  });

  it("stops a one-engine frigate when its engine goes, while its guns fire", () => {
    const state = damageEnemy(
      enemyCatalog.frigate,
      { amount: 99, hardpointId: "engine" },
      { ...spawn("frigate", { x: 300, y: 0 }), velocity: { x: -20, y: 0 } },
    );
    const effects = enemyEffects(enemyCatalog.frigate, state);
    expect(effects).toMatchObject({ defeated: false, movementStopped: true, thrust: 0 });
    const result = stepEnemy(enemyCatalog.frigate, context([state]), state);
    expect(result.velocity).toEqual({ x: 0, y: 0 });
    expect(result.fire.length).toBeGreaterThan(0);
  });

  it("still needs every required part, command included, for defeat", () => {
    const parts = enemyCatalog.capital.hardpoints.map((part) => part.id);
    const allButCommand = disable(
      parts.filter((id) => id !== "command"),
      capital(),
    );
    expect(enemyEffects(enemyCatalog.capital, allButCommand).defeated).toBe(false);
    expect(enemyEffects(enemyCatalog.capital, disable(["command"], allButCommand)).defeated).toBe(
      true,
    );
  });
});

describe("independent weapon aim", () => {
  const between = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y));
  const target = { x: 0, y: 3000 };
  const unseen = (peers: readonly EnemyState[]) => ({
    ...context(peers),
    visibility: "unknown" as const,
  });

  it.each(["frigate", "capital"] as const)(
    "turns each %s turret toward its own target line with aimTurnSeconds, whatever the hull faces",
    (archetype) => {
      const definition = enemyCatalog[archetype];
      const base = spawn(archetype, { x: 0, y: 0 }, false);
      for (const facing of [
        { x: 0, y: -1 },
        { x: 1, y: 0 },
      ]) {
        const state = {
          ...base,
          facing,
          hardpoints: base.hardpoints.map((part) => ({ ...part, aim: { x: 1, y: 0 } })),
          lastSeen: target,
        };
        const next = stepEnemy(definition, unseen([state]), state).state;
        const decay = Math.exp(-dt / definition.physics.aimTurnSeconds);
        for (const part of definition.hardpoints.filter((entry) => entry.kind === "weapon")) {
          const offset = hardpointOffset(definition, 20, facing, part);
          const wanted = rotate(
            { x: target.x - offset.x, y: target.y - offset.y },
            aimDrift(state.id, state.age),
          );
          const aim = next.hardpoints.find((entry) => entry.id === part.id)!.aim!;
          expect(between(aim, wanted)).toBeCloseTo(between({ x: 1, y: 0 }, wanted) * decay, 9);
        }
      }
    },
  );

  it("turns the retaliator's gun independently of its hull", () => {
    const definition = enemyCatalog.retaliator;
    const base = {
      ...spawn("retaliator", { x: 0, y: 0 }, false),
      aim: { x: 1, y: 0 },
      lastSeen: target,
    };
    const aims = [
      { x: 0, y: -1 },
      { x: -1, y: 0 },
    ].map((facing) => stepEnemy(definition, unseen([base]), { ...base, facing }).state.aim!);
    expect(aims[0]).toEqual(aims[1]);
    const wanted = rotate(target, aimDrift(base.id, base.age));
    expect(between(aims[0]!, wanted)).toBeCloseTo(
      between({ x: 1, y: 0 }, wanted) * Math.exp(-dt / definition.physics.aimTurnSeconds),
      9,
    );
  });
});
