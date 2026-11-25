import { expect, it } from "vitest";

import { ECONOMY } from "../../data/economy.ts";
import { enemyCatalog } from "../../data/enemyCatalog.ts";
import { ENEMY_AVOIDANCE } from "../../data/enemyNavigation.ts";
import { SHARED_SHIP_PHYSICS } from "../../data/shipPhysics.ts";
import { SIMULATION_STEP_SECONDS } from "../../data/simulation.ts";
import { GALAXY_SIDE } from "../../data/world.ts";
import { partsReach, worldParts } from "../convex.ts";
import { createEnemy } from "../enemyAi.ts";
import { enemyHull } from "../enemyBody.ts";
import { stepShipMotion, turnToward } from "../shipPhysics.ts";
import { worldDelta, worldDistance } from "../worldContacts.ts";
import { wrapPoint } from "../worldGeometry.ts";
import { stationGuardPatrol } from "./stationGuardPatrol.ts";

it.each([undefined, GALAXY_SIDE])(
  "patrols outside station protection using actual hull physics (side=%s)",
  (worldSide) => {
    const context = worldSide === undefined ? {} : { worldSide };
    const definition = enemyCatalog.frigate;
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
    const center = { x: worldSide === undefined ? 0 : worldSide / 2 - 20, y: 0 };
    const anchor = { center, clearanceRadius: ECONOMY.station.exclusionRadius + hullReach };
    const radius = anchor.clearanceRadius + ENEMY_AVOIDANCE.clearance;
    for (const side of [-1, 1] as const) {
      const home = { x: center.x + radius, y: center.y };
      const state = createEnemy(
        definition,
        { archetype: "frigate", id: "station-patrol", packId: null, phase: 0.4 },
        home,
      );
      state.facing = { x: -1, y: 0 };
      const physics = {
        ...definition.physics,
        turnSeconds: Math.max(definition.physics.turnSeconds, definition.navigation!.turnSeconds),
      };
      const speed =
        definition.physics.maxSpeed *
        (definition.behaviour.kind === "siege" ? definition.behaviour.speedFraction : 1) *
        definition.navigation!.patrolShare;
      let closest = Infinity;
      for (let step = 0; step < 3600; step++) {
        const course = stationGuardPatrol(context, anchor, home, side, state.position);
        const motion = stepShipMotion(
          physics,
          SIMULATION_STEP_SECONDS,
          { maxSpeed: physics.maxSpeed, restHeading: state.facing },
          { direction: course, speed },
          { heading: state.heading, velocity: state.velocity },
        );
        const next = {
          x: state.position.x + motion.velocity.x * SIMULATION_STEP_SECONDS,
          y: state.position.y + motion.velocity.y * SIMULATION_STEP_SECONDS,
        };
        state.position = worldSide === undefined ? next : wrapPoint(worldSide, next);
        state.heading = motion.heading;
        state.velocity = motion.velocity;
        state.facing = turnToward(
          SIMULATION_STEP_SECONDS,
          SHARED_SHIP_PHYSICS.hullTurnSeconds,
          motion.velocity,
          state.facing,
        );
        closest = Math.min(closest, worldDistance(context, center, state.position) - hullReach);
      }
      expect(closest).toBeGreaterThanOrEqual(ECONOMY.station.exclusionRadius);
      expect(worldDelta(context, center, state.position).y * side).toBeGreaterThan(0);
      expect(worldDistance(context, center, state.position)).toBeLessThan(
        radius + ENEMY_AVOIDANCE.clearance,
      );
    }
  },
);
