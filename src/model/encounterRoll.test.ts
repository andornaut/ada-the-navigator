import { expect, it } from "vitest";

import type { EncounterEntry } from "../data/enemyCatalog.ts";
import { rollEncounter } from "./encounterRoll.ts";
import { rollEncounter as flightRollEncounter } from "./flight.ts";

it("preserves weighted boundaries, inclusive group bounds and escort payload through the public facade", () => {
  const table: readonly EncounterEntry[] = [
    { archetype: "swarm", groupSize: [2, 5], weight: 1 },
    {
      archetype: "capital",
      escorts: { archetype: "fighter", count: 4 },
      groupSize: [1, 1],
      weight: 3,
    },
  ];
  expect(flightRollEncounter).toBe(rollEncounter);
  expect(rollEncounter(table, 0, 0)).toEqual({ archetype: "swarm", count: 2 });
  expect(rollEncounter(table, 0.999, 0.249)).toEqual({ archetype: "swarm", count: 5 });
  expect(rollEncounter(table, 0.5, 0.25)).toEqual({
    archetype: "capital",
    count: 1,
    escorts: { archetype: "fighter", count: 4 },
  });
});
