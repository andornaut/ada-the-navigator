import { expect, it } from "vitest";

import { ECONOMY } from "../../data/economy.ts";
import { enemyCatalog } from "../../data/enemyCatalog.ts";
import { ENEMY_AVOIDANCE } from "../../data/enemyNavigation.ts";
import { SIMULATION_STEP_SECONDS } from "../../data/simulation.ts";
import { GALAXY_SIDE } from "../../data/world.ts";
import { partsReach, worldParts } from "../convex.ts";
import { createEnemy, type EnemyContext, stepEnemy } from "../enemyAi.ts";
import { enemyHull } from "../enemyBody.ts";
import { worldDistance } from "../worldContacts.ts";
import { wrapPoint } from "../worldGeometry.ts";

it.each([false, true])(
  "uses the validated site frame for production home navigation (returning=%s)",
  (returning) => {
    const definition = enemyCatalog.frigate;
    const center = { x: GALAXY_SIDE / 2 - 20, y: 0 };
    const hullReach = Math.max(
      ...Array.from({ length: 16 }, (_, index) =>
        partsReach(
          worldParts(
            enemyHull({
              archetype: "frigate",
              facing: { x: Math.cos((index * Math.PI) / 8), y: Math.sin((index * Math.PI) / 8) },
            })!,
          ),
        ),
      ),
    );
    const clearanceRadius = ECONOMY.station.safeRadius + hullReach;
    const home = { x: center.x + clearanceRadius + ENEMY_AVOIDANCE.clearance, y: 0 };
    let state = createEnemy(
      definition,
      { archetype: "frigate", id: "route:station", packId: null, phase: 0.4 },
      home,
    );
    state.returning = returning;
    const context: EnemyContext = {
      adaWidth: 20,
      dt: SIMULATION_STEP_SECONDS,
      inPlayView: true,
      initialPackSizes: {},
      lead: 1,
      peers: [],
      player: { x: 0, y: 0 },
      playerVelocity: { x: 0, y: 0 },
      routePosition: 1,
      stationGuardAnchor: { center, clearanceRadius },
      targetable: false,
      visibility: "unknown",
      worldSide: GALAXY_SIDE,
    };
    let closest = Infinity;
    for (let index = 0; index < 1200; index++) {
      const intent = stepEnemy(definition, context, state);
      if (index === 0) {
        expect(
          stepEnemy(definition, { ...context, player: { x: 10000, y: 10000 } }, state).velocity,
        ).toEqual(intent.velocity);
      }
      expect(intent.fire).toEqual([]);
      const position = wrapPoint(GALAXY_SIDE, {
        x: state.position.x + intent.velocity.x * context.dt,
        y: state.position.y + intent.velocity.y * context.dt,
      });
      state = { ...intent.state, position };
      expect(state.home).toEqual(home);
      closest = Math.min(closest, worldDistance(context, center, position) - hullReach);
    }
    expect(closest).toBeGreaterThanOrEqual(ECONOMY.station.safeRadius);
    expect(worldDistance(context, home, state.position)).toBeGreaterThan(1);
    expect(state.returning).toBe(returning);
  },
);

it.each(["combat", "summoned", "lastSeen"])(
  "preserves existing %s priority when a station frame is supplied",
  (mode) => {
    const definition = enemyCatalog.frigate;
    const state = createEnemy(
      definition,
      { archetype: "frigate", id: "route:priority", packId: null, phase: 0.4 },
      { x: 900, y: 0 },
    );
    state.engaged = true;
    state.lastSeen = { x: 600, y: 200 };
    state.lastSeenAge = 1;
    const context: EnemyContext = {
      adaWidth: 20,
      dt: SIMULATION_STEP_SECONDS,
      engagementAdmitted: true,
      inPlayView: true,
      initialPackSizes: {},
      lead: 1,
      peers: [],
      player: { x: 1000, y: 0 },
      playerVelocity: { x: 0, y: 0 },
      routePosition: 1,
      summoned: mode === "summoned",
      targetable: true,
      visibility: mode === "lastSeen" ? "occluded" : "visible",
    };
    expect(
      stepEnemy(
        definition,
        {
          ...context,
          stationGuardAnchor: {
            center: { x: 0, y: 0 },
            clearanceRadius: ECONOMY.station.safeRadius,
          },
        },
        state,
      ),
    ).toEqual(stepEnemy(definition, context, state));
  },
);
