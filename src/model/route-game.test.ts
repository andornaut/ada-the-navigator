import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import type { SectorId } from "../data/types.ts";
import { ensureDestination } from "./flight.ts";
import { galaxyRoute, GameModel } from "./game.ts";
import { playOpening } from "./test-launch.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function approach(sector: SectorId) {
  const model = new GameModel(PROTOTYPE);
  model.state.unlocked = [1, 2, 3];
  model.startSector(sector);
  playOpening(model);
  const flight = model.state.flight!;
  flight.objects = [];
  const target = ensureDestination(PROTOTYPE, galaxyRoute(sector)[0]!, flight);
  model.step(1 / 60, idle);
  flight.player = { x: target.x, y: target.y };
  return { flight, model, target };
}

describe("required route approach encounters", () => {
  it.each([1, 2, 3] as const)(
    "gates sector %i before friendly interaction while preserving its safe zone",
    (sector) => {
      const { flight, model, target } = approach(sector);
      const guard = flight.objects.find((object) => object.routeId === target.id)!;
      expect(guard.enemy?.archetype).toBe(
        ({ 1: "frigate", 2: "capital", 3: "capital" } as const)[sector],
      );
      expect(Math.hypot(guard.x - target.x, guard.y - target.y)).toBeGreaterThan(
        PROTOTYPE.tuning.safeRadius + guard.radius,
      );
      const shield = flight.shield;
      model.step(1, idle);
      model.interact();
      expect(model.state.dialogue).toBeNull();
      expect(model.state.progress[sector].introduced).toBe(false);
      expect(model.state.progress[sector].known).not.toContain(target.id);
      expect(flight.shield).toBeGreaterThanOrEqual(shield);
      const resumed = new GameModel(PROTOTYPE, model.save());
      expect(resumed.state).toEqual(model.state);
      const next = resumed.state.flight!;
      const restoredGuard = next.objects.find((object) => object.routeId === target.id)!;
      for (const part of restoredGuard.enemy!.hardpoints) {
        part.hp = 0;
      }
      resumed.step(1 / 60, idle);
      expect(resumed.state.progress[sector].introduced).toBe(true);
      expect(resumed.state.progress[sector].known).toContain(target.id);
      expect(resumed.state.dialogue).not.toBeNull();
      resumed.choose("continue");
      resumed.step(1 / 60, idle);
      expect(next.objects.some((object) => object.routeId === target.id)).toBe(false);
    },
  );

  it("keeps a known destination usable after regeneration without a new route guard", () => {
    const { model, target } = approach(1);
    model.state.progress[1].known.push(target.id);
    model.state.progress[1].introduced = true;
    model.state.progress[1].stage = 1;
    model.state.flight!.dangerFor = 0;
    model.returnHome();
    model.startSector(1);
    model.teleport(target.id);
    model.step(1 / 60, idle);
    const flight = model.state.flight!;
    const friendly = flight.objects.find((object) => object.id === target.id)!;
    expect(flight.player).toEqual({ x: friendly.x, y: friendly.y });
    expect(flight.objects.some((object) => object.routeId === target.id)).toBe(false);
    expect(model.contextLabel).toBeTruthy();
  });
});

describe("galaxy route", () => {
  it("lists each galaxy's destinations once, in the order its route first visits them", () => {
    expect([1, 2, 3].map((sector) => galaxyRoute(sector as SectorId))).toEqual([
      ["growers", "workshop", "salvagers"],
      ["hub", "miner", "visitors"],
      ["whale", "family"],
    ]);
  });

  it("places each galaxy's route's first destination once Ada has flown the intro distance", () => {
    for (const sector of [1, 2, 3] as const) {
      const model = new GameModel(PROTOTYPE);
      model.state.unlocked = [1, 2, 3];
      model.startSector(sector);
      playOpening(model);
      const flight = model.state.flight!;
      expect(flight.objects.some(({ kind }) => kind === "destination")).toBe(false);
      flight.freshDistance = PROTOTYPE.tuning.introFreshDistance;
      model.step(1 / 60, idle);
      const placed = flight.objects.filter(({ kind }) => kind === "destination");
      expect(placed.map(({ id }) => id)).toContain(galaxyRoute(sector)[0]);
    }
  });
});
