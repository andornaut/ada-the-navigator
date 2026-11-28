import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { createEnemy } from "./ai/index.ts";
import { createFlight } from "./flight/index.ts";
import { routeGuardEvidence } from "./routeGuardEvidence.ts";
import type { SpaceObject } from "./types.ts";

function fixture() {
  const flight = createFlight(CONTENT, 1, 173, { known: [] });
  flight.objects = [];
  flight.world = { notables: {}, version: 1 };
  flight.combat = { initialPackSizes: {}, routeEncounters: ["growers"] };
  const definition = enemyDefinition(1, "frigate", "route:growers");
  const guard: SpaceObject = {
    enemy: createEnemy(
      definition,
      { archetype: "frigate", id: "route:growers", packId: null, phase: 0 },
      { x: 6000, y: 0 },
    ),
    hp: definition.hp,
    id: "route:growers",
    kind: "enemy",
    radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
    routeId: "growers",
    x: 6000,
    y: 0,
  };
  return { flight, guard };
}

it("preserves live guard authority through unloading and loaded identity precedence without mutating state", () => {
  const { flight, guard } = fixture();
  flight.world.notables[guard.id] = guard;
  expect(routeGuardEvidence(flight, "growers")).toEqual({ guard, status: "admitted" });
  flight.objects.push(guard);
  flight.world.notables[guard.id] = null;
  const before = structuredClone(flight);
  expect(routeGuardEvidence(flight, "growers")).toEqual({ guard, status: "admitted" });
  expect(flight).toEqual(before);
});

it("keeps admission-recorded absence unknown rather than interpreting it as victory or retry permission", () => {
  const { flight } = fixture();
  const before = structuredClone(flight);
  expect(routeGuardEvidence(flight, "growers")).toEqual({
    admissionRecorded: true,
    status: "unknown",
  });
  expect(flight).toEqual(before);
});

it("keeps absent legacy history unknown and never infers association from a different actor's tombstone", () => {
  const { flight } = fixture();
  delete flight.combat;
  flight.world.notables["route:workshop"] = null;
  const before = structuredClone(flight);
  expect(routeGuardEvidence(flight, "growers")).toEqual({
    admissionRecorded: false,
    status: "unknown",
  });
  expect(flight).toEqual(before);
});

it("resolves only exact casualty or observed nonblocking guard evidence without replaying outcomes", () => {
  for (const disposition of ["dead", "disabled", "salvaged"] as const) {
    const { flight, guard } = fixture();
    if (disposition === "dead") {
      guard.hp = 0;
      guard.enemy!.hp = 0;
    } else if (disposition === "disabled") {
      guard.enemy!.disabled = true;
    } else {
      guard.enemy!.salvaged = true;
    }
    flight.objects.push(guard);
    const before = structuredClone(flight);
    expect(routeGuardEvidence(flight, "growers")).toEqual({ status: "resolved" });
    expect(flight).toEqual(before);
  }
  const { flight, guard } = fixture();
  flight.world.notables[guard.id] = null;
  expect(routeGuardEvidence(flight, "growers")).toEqual({ status: "resolved" });
});
