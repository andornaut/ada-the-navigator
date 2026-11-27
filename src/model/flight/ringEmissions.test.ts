import { expect, it } from "vitest";

import { CONTENT } from "../../data/content.ts";
import { activeRingEmissions, createUnpopulatedFlight } from "../flight.ts";
import { recordRingEmission, stepRingEmissions } from "./ringEmissions.ts";

it("keeps delayed rings in registration order and ages them only for their flight", () => {
  const flight = createUnpopulatedFlight(CONTENT, 1, 1);
  const centre = { x: 1, y: 2 };
  const origins = [{ x: 3, y: 2 }];
  recordRingEmission(1 / 16, centre, origins, 2, flight);
  recordRingEmission(0, { x: 8, y: 2 }, [{ x: 9, y: 2 }], 1, flight);
  centre.x = 4;

  const [delayed, immediate] = activeRingEmissions(flight);
  expect(delayed).toEqual({ age: -1 / 16, at: { x: 1, y: 2 }, origins, spawnRadius: 2 });
  expect(delayed?.origins).toBe(origins);
  expect(immediate?.age).toBe(-0);
  const restored = structuredClone(flight);
  stepRingEmissions(1 / 4, restored);
  expect(activeRingEmissions(restored)).toEqual([]);

  stepRingEmissions(1 / 32, flight);
  expect(activeRingEmissions(flight).map(({ age }) => age)).toEqual([-1 / 32, 1 / 32]);
  stepRingEmissions(5 / 32, flight);
  expect(activeRingEmissions(flight)).toEqual([delayed]);
  expect(delayed?.age).toBe(1 / 8);
  stepRingEmissions(1 / 16, flight);
  expect(activeRingEmissions(flight)).toEqual([]);
});
