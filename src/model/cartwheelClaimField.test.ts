import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog, enemyDefinition } from "../data/enemyCatalog.ts";
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { CARTWHEEL_CLAIM_SEARCH_RADIUS, selectCartwheelClaimField } from "./cartwheelClaimField.ts";
import { GameModel } from "./game.ts";
import { ORE_FIELD_ROLE, worldOreFieldsNear } from "./oreFields.ts";
import { readRequiredRolePlan } from "./requiredRolePlans.ts";
import { flightStationContext, worldStationsNear } from "./stations.ts";
import { worldDistance } from "./worldContacts.ts";

function launchCartwheel() {
  const seeds = [173, 301];
  const model = new GameModel(CONTENT, () => seeds.shift()!, SAVE_RESTORE);
  model.state.unlocked = [1, 3, 4, 5, 2];
  model.state.prologueSeen = true;
  model.state.progress[2].opened = true;
  model.startGalaxy(2);
  const flight = model.state.flight!;
  const hub = readRequiredRolePlan(flight, "hub")!.site;
  const definition = enemyDefinition(2, "capital");
  const hullRadius = enemyCatalog.capital.sizeRatio * CONTENT.tuning.flight.shipRadius;
  const context = {
    ...flightStationContext(flight),
    arrivals: flight.arrivals ?? [],
    canPlace: () => true,
    combatClearance: definition.perception + definition.pursuit.homeRadius + hullRadius,
    flightStart: { ...flight.player },
    hub,
  };
  return { context, flight, model };
}

it("selects a seeded field that ordinary flight populates while leaving the required hub plan intact", () => {
  const { context, flight, model } = launchCartwheel();
  const before = model.save();
  const field = selectCartwheelClaimField(context)!;
  expect(field).not.toBeNull();
  expect(field.guard).toBeNull();
  expect(worldOreFieldsNear(context, 2, TARGET_MARKER_RANGE, context.hub)).toEqual([]);
  expect(worldOreFieldsNear(context, 2, CARTWHEEL_CLAIM_SEARCH_RADIUS, context.hub)).toContainEqual(
    field,
  );
  expect(selectCartwheelClaimField(context)).toEqual(field);
  expect(model.save()).toBe(before);

  const clearance = ORE_FIELDS.clearance + ORE_FIELDS.diameter / 2;
  expect(worldDistance(context, context.hub, field)).toBeGreaterThanOrEqual(clearance);
  expect(worldStationsNear(context, ECONOMY, 2, clearance, field)).toEqual([]);

  flight.player = { x: field.x, y: field.y };
  model.step(1 / 60, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
  expect(
    flight.objects.some(({ id, role }) => id.startsWith(`${field.id}:`) && role === ORE_FIELD_ROLE),
  ).toBe(true);
  expect(readRequiredRolePlan(flight, "hub")?.actors[0]?.id).toBe("route:hub");
  expect(model.state.progress[2].known).not.toContain("hub");
});

it("skips fields that fail formation fit or are too close to a jump arrival", () => {
  const { context } = launchCartwheel();
  const first = selectCartwheelClaimField(context)!;
  expect(first).not.toBeNull();
  const rejected = selectCartwheelClaimField({
    ...context,
    canPlace: ({ id }) => id !== first.id,
  });
  const arrival = selectCartwheelClaimField({
    ...context,
    arrivals: [first],
  });
  expect(rejected).not.toBeNull();
  expect(rejected?.id).not.toBe(first.id);
  expect(arrival).toEqual(rejected);
  expect(worldDistance(context, first, arrival!)).toBeGreaterThanOrEqual(
    ORE_FIELDS.clearance + ORE_FIELDS.diameter / 2,
  );
  expect(selectCartwheelClaimField({ ...context, canPlace: () => false })).toBeNull();
});

it("refuses selection when every field in the search range overlaps the required approach clearance", () => {
  const { context } = launchCartwheel();
  const canPlace = () => {
    throw new Error("The formation check must only receive clear candidates");
  };
  expect(
    selectCartwheelClaimField({
      ...context,
      canPlace,
      combatClearance: CARTWHEEL_CLAIM_SEARCH_RADIUS + 1,
    }),
  ).toBeNull();
});
