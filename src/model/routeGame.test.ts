import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import {
  activateCartwheelHubFixture,
  completeCartwheelHubIntroductionFixture,
} from "../testing/cartwheelFixture.ts";
import { playOpening, relaunch, supportEntropy } from "../testing/launch.ts";
import { ensureDestination } from "./flight.ts";
import { galaxyRoute, GameModel } from "./game.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function approach(galaxy: GalaxyNumber) {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.unlocked = [1, 2, 3];
  model.startGalaxy(galaxy);
  playOpening(model);
  const flight = model.state.flight!;
  flight.objects = [];
  if (galaxy === 2) {
    activateCartwheelHubFixture(CONTENT, model);
  } else if (galaxy === 3) {
    flight.freshDistance = CONTENT.tuning.introFreshDistance;
    model.step(1 / 60, idle);
  }
  const target = ensureDestination(CONTENT, galaxyRoute(galaxy)[0]!, flight);
  flight.player = { x: target.x, y: target.y };
  model.step(1 / 60, idle);
  return { flight, model, target };
}

describe("required route approach encounters", () => {
  it.each([1, 2, 3] as const)(
    "gates galaxy %i before friendly interaction while preserving its exclusion zone",
    (galaxy) => {
      const { flight, model, target } = approach(galaxy);
      const guard = flight.objects.find((object) => object.routeId === target.id)!;
      expect(guard.enemy?.archetype).toBe(
        ({ 1: "frigate", 2: "capital", 3: "capital" } as const)[galaxy],
      );
      expect(Math.hypot(guard.x - target.x, guard.y - target.y)).toBeGreaterThan(
        CONTENT.tuning.exclusionRadius + guard.radius,
      );
      const shield = flight.shield;
      model.step(1, idle);
      model.interact();
      expect(model.state.dialogue).toBeNull();
      expect(model.state.progress[galaxy].introduced).toBe(false);
      expect(model.state.progress[galaxy].known).not.toContain(target.id);
      expect(flight.shield).toBeGreaterThanOrEqual(shield);
      const resumed = relaunch(CONTENT, model.save());
      expect(resumed.state).toEqual(model.state);
      const next = resumed.state.flight!;
      const restoredGuard = next.objects.find((object) => object.routeId === target.id)!;
      restoredGuard.enemy!.hp = 0;
      resumed.step(1 / 60, idle);
      if (galaxy === 1) {
        const beforeTalk = { introduced: false, questItem: null, stage: 0 };
        const time = next.time;
        resumed.step(1 / 60, idle);
        expect(next.time).toBeGreaterThan(time);
        expect(resumed.contextAction).toBe("talk");
        expect(resumed.state.dialogue).toBeNull();
        expect(resumed.state.progress[1]).toMatchObject(beforeTalk);
        const continued = relaunch(CONTENT, resumed.save());
        expect(continued.state.dialogue).toBeNull();
        expect(continued.state.progress[1]).toMatchObject(beforeTalk);
        expect(continued.contextAction).toBe("talk");
        continued.interact();
        expect(continued.state.dialogue?.context).toBe("grower");
        expect(continued.state.progress[1]).toMatchObject({
          introduced: true,
          questItem: "food",
          stage: 1,
        });
        const pending = relaunch(CONTENT, continued.save());
        const progress = structuredClone(pending.state.progress[1]);
        const dialogue = pending.state.dialogue;
        expect(dialogue?.context).toBe("grower");
        pending.closeInteraction();
        pending.interact();
        expect(pending.state.dialogue).toBe(dialogue);
        pending.choose("continue");
        expect(pending.state.dialogue).toBeNull();
        expect(pending.state.progress[1]).toEqual(progress);
        expect(pending.state.flight!.objects.some((object) => object.routeId === target.id)).toBe(
          false,
        );
        return;
      }
      expect(resumed.state.progress[galaxy].known).toContain(target.id);
      if (galaxy === 2) {
        expect(resumed.state.progress[2].introduced).toBe(false);
        expect(resumed.state.dialogue).toBeNull();
        completeCartwheelHubIntroductionFixture(resumed);
      } else {
        expect(resumed.state.dialogue).not.toBeNull();
        resumed.choose("continue");
      }
      expect(resumed.state.progress[galaxy].introduced).toBe(true);
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
    model.startGalaxy(1);
    model.state.economy.stardust = 50;
    expect(model.teleport(target.id)).toBe(true);
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
    expect([1, 2, 3].map((galaxy) => galaxyRoute(galaxy as GalaxyNumber))).toEqual([
      ["growers", "workshop", "salvagers"],
      ["hub", "miner", "visitors"],
      ["whale", "family"],
    ]);
  });

  it("places each galaxy's route's first destination once Ada has flown the intro distance", () => {
    for (const galaxy of [1, 2, 3] as const) {
      const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
      model.state.unlocked = [1, 2, 3];
      model.startGalaxy(galaxy);
      playOpening(model);
      const flight = model.state.flight!;
      expect(flight.objects.some(({ kind }) => kind === "destination")).toBe(false);
      flight.freshDistance = CONTENT.tuning.introFreshDistance;
      model.step(1 / 60, idle);
      const placed = flight.objects.filter(({ kind }) => kind === "destination");
      expect(placed.map(({ id }) => id)).toContain(galaxyRoute(galaxy)[0]);
    }
  });
});
