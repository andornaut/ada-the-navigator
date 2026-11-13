import { afterEach, describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { BUILT, GALAXY_NUMBERS } from "../data/galaxies.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { relaunch } from "../testing/launch.ts";
import { GameModel } from "./game.ts";
import { ACTIVE_CHUNK_RADIUS } from "./geography.ts";
import { validPhantomFlight, validPhantomProgress } from "./phantom.ts";
import { restoreSave } from "./save.ts";
import type { FlightState, SpaceObject } from "./types.ts";

const productionRoster = [...BUILT];
afterEach(() => expect([...BUILT]).toEqual(productionRoster));

/** Test-only admission exercises the prepared adapter without publishing it in the roster. */
function withPhantom(check: (model: GameModel) => void): void {
  const built = BUILT as Set<GalaxyNumber>;
  const admitted = built.has(6);
  built.add(6);
  try {
    const model = new GameModel(CONTENT);
    model.state.started = true;
    model.state.prologueSeen = true;
    model.state.unlocked = [...GALAXY_NUMBERS];
    model.state.progress[6].opened = true;
    model.startGalaxy(6);
    expect(model.state.flight?.galaxy).toBe(6);
    check(model);
  } finally {
    if (!admitted) {
      built.delete(6);
    }
  }
}

function represented(flight: FlightState): SpaceObject[] {
  return [
    ...flight.objects,
    ...Object.values(flight.world.notables).filter(
      (object): object is SpaceObject => object !== null,
    ),
  ];
}

describe("Phantom GameModel initialization under test-only chapter admission", () => {
  it("accepts the immediate first save without advancing physics or relaxing the active window", () => {
    withPhantom((model) => {
      const flight = model.state.flight!;
      expect(flight.time).toBe(0);
      expect(flight.phantom?.phase).toBe("blockades");
      expect(validPhantomFlight(flight.phantom)).toBe(true);
      expect(validPhantomProgress(model.state.progress[6].phantom)).toBe(true);
      const before = JSON.stringify(flight);
      const firstSave = model.save();
      expect(
        restoreSave(firstSave),
        "startGalaxy must produce a valid first save before any step",
      ).not.toBeNull();
      expect((ACTIVE_CHUNK_RADIUS * 2 + 1) ** 2).toBe(49);
      expect(flight.chunks.length).toBeLessThanOrEqual(49);
      expect(new Set(flight.chunks).size).toBe(flight.chunks.length);
      expect(JSON.stringify(flight)).toBe(before);
      expect(flight.time).toBe(0);
    });
  });

  it("preserves every actual blockade member and retained notable across first-save Continue", () => {
    withPhantom((model) => {
      const flight = model.state.flight!;
      expect(Object.keys(flight.phantom!.blockades).sort()).toEqual(
        [...PHANTOM_DESTINATIONS].sort(),
      );
      const members = Object.values(flight.phantom!.blockades).flat();
      expect(members.length).toBeGreaterThan(PHANTOM_DESTINATIONS.length);
      expect(new Set(members).size).toBe(members.length);
      const objects = represented(flight);
      for (const [route, ids] of Object.entries(flight.phantom!.blockades)) {
        for (const id of ids) {
          const matches = objects.filter((object) => object.id === id);
          expect(matches, id).toHaveLength(1);
          expect(matches[0]!.routeId).toBe(route);
          expect(matches[0]!.hp).toBeGreaterThan(0);
        }
      }
      const retained = Object.values(flight.world.notables).filter((object) => object !== null);
      expect(
        retained.length,
        "offscreen persistent chapter entities must be archived, not discarded",
      ).toBeGreaterThan(0);
      const saved = model.save();
      expect(restoreSave(saved)).not.toBeNull();
      const loaded = relaunch(CONTENT, saved);
      expect(loaded.state.flight).toEqual(flight);
      expect(loaded.state.progress[6]).toEqual(model.state.progress[6]);
      expect(loaded.state.flight!.world.notables).toEqual(flight.world.notables);
      expect(loaded.state.flight!.combat).toEqual(flight.combat);
      expect(loaded.state.flight!.phantom!.blockades).toEqual(flight.phantom!.blockades);
      expect(
        represented(loaded.state.flight!)
          .map((object) => object.id)
          .sort(),
      ).toEqual(objects.map((object) => object.id).sort());
      expect(loaded.state.flight!.time).toBe(0);
    });
  });

  it("still rejects over-capacity and duplicate active chunk identities", () => {
    withPhantom((model) => {
      const saved = model.save();
      expect(restoreSave(saved)).not.toBeNull();
      const oversized = JSON.parse(saved);
      oversized.flight.chunks = Array.from({ length: 50 }, (_, index) => `${index},0`);
      expect(restoreSave(oversized)).toBeNull();
      const duplicate = JSON.parse(saved);
      duplicate.flight.chunks = [duplicate.flight.chunks[0], duplicate.flight.chunks[0]];
      expect(restoreSave(duplicate)).toBeNull();
    });
  });
});
