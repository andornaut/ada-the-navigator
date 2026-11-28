import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import { createEnemy } from "./ai/index.ts";
import { createUnpopulatedFlight } from "./flight.ts";
import {
  materializeHostileStation,
  type PlannedHostileStation,
  type StationMaterializationContext,
} from "./hostileStations/placement.ts";
import { requiredWorldOccupantsPopulation } from "./requiredWorldReservations.ts";
import type { FlightState, SpaceObject } from "./types.ts";

const point = { x: 30000, y: 0 };
const plan: PlannedHostileStation = {
  defenders: [
    { id: "station-proof:swarm:0", point: { x: point.x - 400, y: 400 } },
    { id: "station-proof:swarm:1", point: { x: point.x + 400, y: 400 } },
  ],
  id: "station-proof",
  point,
};
function context(flight: FlightState): StationMaterializationContext {
  return {
    canPlace: () => true,
    content: CONTENT,
    create(kind, actor, packId) {
      const definition = enemyActorDefinition(flight.galaxy, kind, actor.id);
      const enemy = createEnemy(
        definition,
        { archetype: kind, id: actor.id, packId, phase: 0 },
        actor.point,
      );
      return {
        ...actor.point,
        enemy,
        hp: enemy.hp,
        id: actor.id,
        kind: "enemy",
        radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
      };
    },
    flight,
  };
}
function occupied(flight: FlightState, id: string): SpaceObject {
  return context(flight).create("fighter", { id, point }, "occupied");
}

it("requires exactly two station defenders independently of an ambient swarm's larger maximum", () => {
  const flight = createUnpopulatedFlight(CONTENT, 6, 173);
  const before = structuredClone(flight);
  expect(
    materializeHostileStation(context(flight), {
      ...plan,
      defenders: [
        ...plan.defenders,
        { id: "station-proof:swarm:2", point: { x: point.x, y: -400 } },
      ],
    }).status,
  ).toBe("rejected");
  expect(flight).toEqual(before);
  expect(materializeHostileStation(context(flight), plan).status).toBe("created");
  expect(flight.objects.filter((actor) => actor.enemy?.archetype === "swarm")).toHaveLength(2);
});

it("counts reserved required occupants once and rejects the entire station without consuming them", () => {
  const flight = createUnpopulatedFlight(CONTENT, 5, 173);
  for (let index = 0; index < 6; index++) {
    flight.objects.push(occupied(flight, `existing:${index}`));
  }
  const control = structuredClone(flight);
  expect(materializeHostileStation(context(control), plan).status).toBe("created");
  const reserved = occupied(flight, "required:reserved");
  const population = requiredWorldOccupantsPopulation(flight, [reserved, reserved]);
  expect(population).toHaveLength(7);
  const before = structuredClone(flight);
  expect(materializeHostileStation({ ...context(flight), population }, plan).status).toBe(
    "rejected",
  );
  expect(flight).toEqual(before);
  expect(population.filter(({ id }) => id === reserved.id)).toHaveLength(1);
});
