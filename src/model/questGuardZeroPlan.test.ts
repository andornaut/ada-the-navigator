import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { ENEMY_AVOIDANCE } from "../data/enemyNavigation.ts";
import { relaunch } from "../testing/launch.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { createEnemy } from "./enemyAi.ts";
import { ensureRouteEncounter, questFrigateHome, routeGuardPlanResult } from "./flight.ts";
import { GameModel } from "./game.ts";
import type { SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function fixture(inner = false) {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  model.state.dialogue = null;
  const flight = model.state.flight!;
  flight.objects = [];
  flight.world = { notables: {}, version: 1 };
  flight.combat = { initialPackSizes: {}, routeEncounters: [] };
  const progress = model.state.progress[1];
  Object.assign(progress, { introduced: false, known: [], questComplete: false, stage: 0 });
  const site: SpaceObject = {
    hp: 1,
    id: "growers",
    kind: "destination",
    radius: 30,
    x: inner ? 6000 : 10000,
    y: inner ? 0 : 10000,
  };
  flight.objects.push(site);
  flight.player = { x: site.x, y: site.y + 2000 };
  return { flight, model, progress, site };
}

it.each(["capacity", "geometry", "type"] as const)(
  "completes a zero plan on %s rejection and retains it through Continue without claiming a kill",
  (mode) => {
    const { flight, model, progress, site } = fixture(mode === "type");
    const home = questFrigateHome(CONTENT, flight, "route:growers", site.id)!;
    expect(home).not.toBeNull();
    if (mode === "capacity") {
      for (let index = 0; index < 4; index++) {
        const id = `occupied:${index}`,
          point = { x: site.x + 1000 + index * 40, y: site.y };
        const definition = enemyDefinition(1, "fighter", id);
        flight.objects.push({
          ...point,
          enemy: createEnemy(
            definition,
            { archetype: "fighter", id, packId: null, phase: 0 },
            point,
          ),
          hp: definition.hp,
          id,
          kind: "enemy",
          radius: CONTENT.tuning.flight.shipRadius,
        });
      }
    } else if (mode === "geometry") {
      const radius = Math.hypot(home.x - site.x, home.y - site.y);
      const shape = [...ASTEROID_SHAPES.values()].find((shape) => shape.size === "huge")!;
      for (let index = 0; index < ENEMY_AVOIDANCE.directions; index++) {
        const angle = (index * Math.PI * 2) / ENEMY_AVOIDANCE.directions;
        flight.objects.push({
          asteroid: shape.id,
          hp: CONTENT.tuning.flight.rockHp,
          id: `blocking-rock:${index}`,
          kind: "rock",
          radius: shape.radius,
          x: site.x + Math.cos(angle) * radius,
          y: site.y + Math.sin(angle) * radius,
        });
      }
    }
    model.step(0.001, idle);
    expect(routeGuardPlanResult(flight, site.id).status).toBe("empty");
    expect(flight.combat!.emptyRoutePlans).toEqual([site.id]);
    expect(flight.combat!.routeEncounters).toEqual([]);
    expect(progress.destroyedEnemies).toBe(0);
    expect(progress.known).not.toContain(site.id);
    expect(progress.introduced).toBe(false);
    flight.objects = [site];
    flight.world = { notables: {}, version: 1 };
    const resumed = relaunch(CONTENT, model.save());
    expect(resumed.state.flight).not.toBeNull();
    const restoredFlight = resumed.state.flight!;
    expect(restoredFlight.combat!.emptyRoutePlans).toEqual([site.id]);
    expect(ensureRouteEncounter(CONTENT, site.id, restoredFlight)).toBeNull();
    expect(restoredFlight.objects.some((actor) => actor.routeId === site.id)).toBe(false);
    restoredFlight.player = { x: site.x, y: site.y };
    resumed.step(0.001, idle);
    const restoredProgress = resumed.state.progress[1];
    expect(restoredProgress.introduced).toBe(true);
    expect(restoredProgress.stage).toBe(1);
    expect(restoredProgress.questItem).toBe("food");
    expect(restoredProgress.destroyedEnemies).toBe(0);
    expect(restoredFlight.combat!.routeEncounters).toEqual([]);
    expect(restoredFlight.combat!.emptyRoutePlans).toEqual([site.id]);
    resumed.state.dialogue = null;
    resumed.step(0.001, idle);
    expect(restoredFlight.objects.some((actor) => actor.routeId === site.id)).toBe(false);
    expect(restoredProgress.stage).toBe(1);
  },
);

it("admits one complete fitting formation, preserves its site-local home and restores exactly three hulls", () => {
  const { flight, model, progress, site } = fixture();
  const guard = ensureRouteEncounter(CONTENT, site.id, flight)!;
  expect(guard).not.toBeNull();
  expect(routeGuardPlanResult(flight, site.id).status).toBe("admitted");
  expect(flight.combat!.emptyRoutePlans).toBeUndefined();
  expect(flight.combat!.routeEncounters).toEqual([site.id]);
  const followers = flight.objects.filter((actor) => actor.enemy?.escortOf === guard.id);
  expect(followers).toHaveLength(2);
  const home = structuredClone(guard.enemy!.home);
  flight.player = { x: site.x, y: site.y };
  flight.summonedGuards = [guard.id, ...followers.map((actor) => actor.id)];
  model.step(0.001, idle);
  expect(flight.summonedGuards?.includes(guard.id) ?? false).toBe(false);
  expect(guard.enemy!.home).toEqual(home);
  expect(progress.introduced).toBe(false);
  expect(progress.destroyedEnemies).toBe(0);
  const restored = relaunch(CONTENT, model.save());
  expect(restored.state.flight).not.toBeNull();
  const actors = restored.state.flight!.objects;
  expect(
    actors.filter((actor) => actor.id === guard.id || actor.enemy?.escortOf === guard.id),
  ).toHaveLength(3);
  expect(actors.find((actor) => actor.id === guard.id)!.enemy!.home).toEqual(home);
});
