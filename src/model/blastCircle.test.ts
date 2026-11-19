import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { weaponAt } from "../data/weaponCatalog.ts";
import { fromScreen, type Parts, screenOutlineContact } from "./convex.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyHull, enemyPartOutline } from "./enemyBody.ts";
import { createFlight, stepFlight } from "./flight.ts";
import { shipTouchesScreenCircle } from "./shipBody.ts";
import type { FlightState, GalaxyProgress, Shot, SpaceObject, Vec } from "./types.ts";

// gameplay/rules.md "Missiles": a blast is a circle on screen of radius 30 (Rapid) or 60 (Heavy)
// that deals full damage to every target whose drawn shape it overlaps.
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
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
const BLAST_AT: Vec = { x: 600, y: 0 };
const RAPID = weaponAt("rapidMissile", 1).blastRadius!;
const HEAVY = weaponAt("heavyMissile", 1).blastRadius!;
const SCREEN_DIRECTIONS: readonly [string, Vec][] = [
  ["right", { x: 1, y: 0 }],
  ["down", { x: 0, y: 1 }],
  ["up-left", { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }],
];

function flightWith(objects: SpaceObject[]): FlightState {
  const flight = createFlight(CONTENT, 1, 173, progress);
  flight.objects = objects;
  flight.player = { x: 0, y: 0 };
  return flight;
}
/** A held enemy of `archetype` whose position is `screen` px from BLAST_AT on screen. */
function enemyAt(archetype: "frigate" | "interceptor", screen: Vec, id = "target"): SpaceObject {
  const definition = enemyDefinition(1, archetype, id);
  const offset = fromScreen(screen);
  const at = { x: BLAST_AT.x + offset.x, y: BLAST_AT.y + offset.y };
  const enemy = createEnemy(definition, { archetype, id, packId: null, phase: 0 }, at);
  enemy.primaryCooldown = 999;
  for (const part of enemy.hardpoints) {
    part.cooldown = 999;
  }
  return {
    ...at,
    enemy,
    hp: definition.hp,
    id,
    kind: "enemy",
    radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
  };
}
/** A missile of `blast` that explodes where it is on the next step, struck by nothing. */
function missile(blast: number, enemy: boolean, at: Vec = BLAST_AT): Shot {
  return {
    ...at,
    blast,
    damage: 2,
    enemy,
    hitIds: [],
    id: "missile",
    life: 0.001,
    piercing: false,
    projectile: "missile",
    velocity: { x: 0, y: -1 },
  };
}
const live = (flight: FlightState, id = "target") =>
  flight.objects.find((object) => object.id === id)!;
/** The least screen px from the blast point to an enemy's drawn hull and hardpoints. */
function drawnGap(object: SpaceObject): number {
  const enemy = object.enemy!;
  const outlines = [
    enemyHull(enemy),
    ...enemy.hardpoints.map((part) => enemyPartOutline(ROUTE_POSITION[1], enemy, part.id)),
  ].filter((outline): outline is Parts => Boolean(outline));
  let low = 0;
  let high = 400;
  while (high - low > 1e-3) {
    const middle = (low + high) / 2;
    if (outlines.some((outline) => screenOutlineContact(outline, object, BLAST_AT, middle))) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return high;
}
/** The enemy placed along a screen direction so its drawn shape is `gap` px from the blast. */
function enemyWithGap(
  archetype: "frigate" | "interceptor",
  direction: Vec,
  gap: number,
  id = "target",
) {
  let low = 0;
  let high = 400;
  while (high - low > 1e-4) {
    const middle = (low + high) / 2;
    const probe = enemyAt(archetype, { x: direction.x * middle, y: direction.y * middle });
    if (drawnGap(probe) < gap) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return enemyAt(archetype, { x: direction.x * high, y: direction.y * high }, id);
}

describe("missile blasts as screen circles", () => {
  it("fully damages an enemy whose drawn shape the circle reaches, the same in every direction", () => {
    for (const radius of [RAPID, HEAVY]) {
      for (const [name, direction] of SCREEN_DIRECTIONS) {
        for (const [gap, struck] of [
          [radius - 0.5, true],
          [radius + 0.5, false],
        ] as const) {
          const target = enemyWithGap("interceptor", direction, gap);
          const flight = flightWith([target]);
          const hp = target.hp;
          flight.shots.push(missile(radius, false));
          stepFlight(CONTENT, 1 / 120, idle, flight);
          expect(flight.shots, `${radius} ${name}`).toEqual([]);
          expect(live(flight).hp, `${radius} ${name} gap ${gap}`).toBe(struck ? hp - 2 : hp);
        }
      }
    }
  });

  it("routes a covered turret's share to the turret it covers deepest, else the hull", () => {
    // Above a frigate by 1.25 Heavy radii, the circle reaches a turret's drawn base.
    const target = enemyAt("frigate", { x: 0, y: 1.25 * HEAVY });
    const hull = target.hp;
    const parts = target.enemy!.hardpoints.map(({ hp }) => hp);
    const flight = flightWith([target]);
    flight.shots.push(missile(HEAVY, false));
    stepFlight(CONTENT, 1 / 120, idle, flight);
    const after = live(flight);
    expect(after.hp).toBe(hull);
    const lost = after.enemy!.hardpoints.map(({ hp }, index) => parts[index]! - hp);
    expect(lost.filter((amount) => amount > 0)).toHaveLength(1);
  });

  it("pops armed mines whose centre the circle covers on screen, and no others", () => {
    const at = (screen: Vec) => {
      const offset = fromScreen(screen);
      return { x: BLAST_AT.x + offset.x, y: BLAST_AT.y + offset.y };
    };
    const flight = flightWith([]);
    flight.mines = [
      { ...at({ x: 0, y: 0.9 * RAPID }), age: 1, damage: 1, id: "inside", ownerId: "x" },
      { ...at({ x: 0, y: 1.1 * RAPID }), age: 1, damage: 1, id: "outside", ownerId: "x" },
    ];
    flight.shots.push(missile(RAPID, false));
    stepFlight(CONTENT, 1 / 120, idle, flight);
    expect(flight.mines.find(({ id }) => id === "inside")?.end?.kind).toBe("pop");
    expect(flight.mines.find(({ id }) => id === "outside")?.end).toBeUndefined();
  });

  it("damages Ada when an enemy blast's circle reaches her drawn ship on screen", () => {
    // Ada at the origin facing right; the blast is straight below her on screen.
    const edge = (radius: number) => {
      let low = 0;
      let high = 400;
      while (high - low > 1e-4) {
        const middle = (low + high) / 2;
        if (
          shipTouchesScreenCircle(
            { x: 1, y: 0 },
            { x: 0, y: 0 },
            fromScreen({ x: 0, y: middle }),
            radius,
          )
        ) {
          low = middle;
        } else {
          high = middle;
        }
      }
      return low;
    };
    for (const [offset, hurt] of [
      [-0.5, true],
      [0.5, false],
    ] as const) {
      const flight = flightWith([]);
      flight.facing = { x: 1, y: 0 };
      const shield = flight.shield;
      flight.shots.push(missile(HEAVY, true, fromScreen({ x: 0, y: edge(HEAVY) + offset })));
      stepFlight(CONTENT, 1 / 120, idle, flight);
      expect(flight.shield, String(offset)).toBe(hurt ? shield - 2 : shield);
    }
  });

  it("damages the enemy a missile strikes once, and the others its circle covers", () => {
    const struck = enemyAt("interceptor", { x: 0, y: 0 }, "struck");
    const beside = enemyWithGap("interceptor", { x: 1, y: 0 }, RAPID / 3, "beside");
    const flight = flightWith([struck, beside]);
    const hp = struck.hp;
    // The missile starts inside the struck interceptor's hull, so it strikes it at once; the
    // blast at its contact still covers the neighbour well inside the radius.
    flight.shots.push({ ...missile(RAPID, false), life: 1 });
    stepFlight(CONTENT, 1 / 120, idle, flight);
    expect(live(flight, "struck").hp).toBe(hp - 2);
    expect(live(flight, "beside").hp).toBe(hp - 2);
  });
});
