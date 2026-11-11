import { describe, expect, it } from "vitest";

import { enemyDefinition } from "../data/enemy-catalog.ts";
import { HUNTING_PACKS } from "../data/galaxy-features.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import {
  createFlight,
  ensureDestination,
  ensureHuntingPacks,
  ensureRouteEncounter,
} from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import type { FlightState, SpaceObject } from "./types.ts";

const hunters = (flight: FlightState, id: string): SpaceObject[] =>
  flight.objects.filter((object) => object.id.startsWith(`hunt:${id}:`));

function nearWhale(seed: number): { flight: FlightState; whale: SpaceObject } {
  const flight = createFlight(PROTOTYPE, 3, seed, { known: [] });
  flight.velocity = { x: 1, y: 0 };
  const whale = ensureDestination(PROTOTYPE, "whale", flight);
  return { flight, whale };
}

describe("hunting packs", () => {
  it("wait near each whale destination once Ada comes within range, chasing as one pack", () => {
    const { flight, whale } = nearWhale(31);
    flight.player = { x: whale.x + HUNTING_PACKS.placeRange + 50, y: whale.y };
    ensureHuntingPacks(PROTOTYPE, flight);
    expect(hunters(flight, "whale")).toEqual([]);
    flight.player = { x: whale.x + HUNTING_PACKS.placeRange - 50, y: whale.y };
    ensureHuntingPacks(PROTOTYPE, flight);
    const pack = hunters(flight, "whale");
    expect(pack.length).toBeGreaterThanOrEqual(HUNTING_PACKS.count[0]);
    expect(pack.length).toBeLessThanOrEqual(HUNTING_PACKS.count[1]);
    const centre = {
      x: pack.reduce((sum, member) => sum + member.x, 0) / pack.length,
      y: pack.reduce((sum, member) => sum + member.y, 0) / pack.length,
    };
    expect(Math.hypot(centre.x - whale.x, centre.y - whale.y)).toBeCloseTo(
      HUNTING_PACKS.distance,
      6,
    );
    for (const member of pack) {
      expect(member.enemy).toMatchObject({ archetype: "fighter", packId: "hunt:whale" });
      expect(member.persistent).toBe(true);
    }
    expect(enemyDefinition(3, "fighter").behaviour.kind).toBe("chase");
    expect(flight.combat?.initialPackSizes["hunt:whale"]).toBe(pack.length);
    // Placed once per flight: a defeated pack does not return.
    flight.objects = flight.objects.filter((object) => !pack.includes(object));
    ensureHuntingPacks(PROTOTYPE, flight);
    expect(hunters(flight, "whale")).toEqual([]);
  });

  it("stand clear of the destination's route guard", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { flight, whale } = nearWhale(seed);
      flight.player = { x: whale.x + 300, y: whale.y };
      const guard = ensureRouteEncounter(PROTOTYPE, "whale", flight)!;
      ensureHuntingPacks(PROTOTYPE, flight);
      expect(hunters(flight, "whale").length).toBeGreaterThan(0);
      for (const member of hunters(flight, "whale")) {
        expect(Math.hypot(member.x - guard.x, member.y - guard.y)).toBeGreaterThan(
          HUNTING_PACKS.guardGap - HUNTING_PACKS.spread - 1,
        );
      }
    }
  });

  it("are Whirlpool's only, and survive a save", () => {
    const cartwheel = createFlight(PROTOTYPE, 2, 9, { known: [] });
    ensureHuntingPacks(PROTOTYPE, cartwheel);
    expect(cartwheel.objects.some((object) => object.id.startsWith("hunt:"))).toBe(false);
    const model = new GameModel(PROTOTYPE);
    model.state.unlocked = [1, 2, 3];
    model.startSector(3);
    model.state.dialogue = null;
    const flight = model.state.flight!;
    flight.velocity = { x: 1, y: 0 };
    const family = ensureDestination(PROTOTYPE, "family", flight);
    flight.player = { x: family.x + 200, y: family.y };
    ensureHuntingPacks(PROTOTYPE, flight);
    expect(hunters(flight, "family").length).toBeGreaterThan(0);
    expect(flight.combat?.huntingPacks).toEqual(["family"]);
    expect(restoreSave(model.save())).toEqual(model.state);
  });
});
