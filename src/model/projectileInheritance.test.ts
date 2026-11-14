import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { createEnemy } from "./enemyAi.ts";
import { createFlight, stepFlight } from "./flight.ts";
import { rotatePhantomAllies } from "./phantomAllies.ts";
import type { GalaxyProgress } from "./types.ts";
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

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function empty() {
  const flight = createFlight(CONTENT, 1, 1234, progress);
  flight.objects = [];
  flight.player = { x: 100, y: 100 };
  flight.facing = { x: 1, y: 0 };
  return flight;
}
describe("actual projectile launch integration", () => {
  it.each([
    ["forward", { x: 120, y: 0 }],
    ["backward", { x: -120, y: 0 }],
    ["strafe", { x: 0, y: 120 }],
    ["stationary", { x: 0, y: 0 }],
  ])("uses Ada's current %s flight velocity after movement", (_, velocity) => {
    const flight = empty();
    flight.velocity = velocity;
    stepFlight(CONTENT, 0.001, { ...idle, fire: true }, flight);
    const shot = flight.shots.find((shot) => !shot.enemy)!;
    expect(shot).toBeDefined();
    const speed = CONTENT.tuning.flight.projectileSpeed * WEAPON_CATALOG.laser[0].speedRatio;
    expect(shot.velocity.x).toBeCloseTo(flight.facing.x * speed + flight.velocity.x);
    expect(shot.velocity.y).toBeCloseTo(flight.facing.y * speed + flight.velocity.y);
    const snapshot = { life: shot.life, velocity: { ...shot.velocity }, x: shot.x, y: shot.y };
    flight.velocity = { x: -170, y: 83 };
    stepFlight(
      CONTENT,
      0.02,
      { ...idle, aim: { x: 0, y: -1 }, fire: false, move: { x: -1, y: 0.3 } },
      flight,
    );
    expect(shot.velocity).toEqual(snapshot.velocity);
    expect(shot.x - snapshot.x).toBeCloseTo(snapshot.velocity.x * 0.02);
    expect(shot.y - snapshot.y).toBeCloseTo(snapshot.velocity.y * 0.02);
    expect(shot.life).toBeCloseTo(snapshot.life - 0.02);
  });
  it("does not give allied fire Ada's velocity", () => {
    const flight = empty();
    flight.velocity = { x: 111, y: -73 };
    flight.phantom = {
      allies: rotatePhantomAllies(
        [{ behavior: "escort", galaxy: 1, id: "clover", radius: 20 }],
        0,
        { x: 150, y: 100 },
      ),
      allyTurn: 0,
      blockades: {},
      chatter: [],
      disabledCued: false,
      enemyIds: [],
      phase: "waves",
      resolvedIds: [],
      wave: 0,
      waypoint: { x: 0, y: 0 },
    };
    flight.objects.push({
      enemy: createEnemy(
        enemyDefinition(1, "retaliator"),
        { archetype: "retaliator", id: "enemy:target", packId: null, phase: 0 },
        { x: 300, y: 100 },
      ),
      hp: 20,
      id: "enemy:target",
      kind: "enemy",
      radius: 14,
      x: 300,
      y: 100,
    });
    stepFlight(CONTENT, 0.001, idle, flight);
    const shot = flight.shots.find((shot) => !shot.enemy)!;
    expect(shot).toBeDefined();
    expect(Math.hypot(shot.velocity.x, shot.velocity.y)).toBeCloseTo(
      CONTENT.tuning.flight.projectileSpeed * WEAPON_CATALOG.laser[1]!.speedRatio,
    );
  });
});
