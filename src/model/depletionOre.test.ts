import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { relaunch } from "../testing/launch.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

describe("Shield depletion ore retention", () => {
  it.each([0, 1, 2, 3, 10, 11])(
    "applies the single half-loss to %i ore through saves and later flights",
    (ore) => {
      const model = new GameModel(CONTENT);
      model.startGalaxy(1);
      const flight = model.state.flight!;
      flight.cargo = ore;
      flight.shield = CONTENT.tuning.hazardDamage;
      flight.objects = [{ ...flight.player, hp: 1, id: "depletion", kind: "hazard", radius: 1000 }];
      model.step(0.1, idle);
      const kept = Math.ceil(ore / 2);
      expect(model.state.flight).toBeNull();
      expect(model.state.economy.cargo ?? 0).toBe(kept);
      const saved = model.save();
      expect(restoreSave(saved)?.economy.cargo ?? 0).toBe(kept);
      model.step(1, idle);
      expect(model.state.economy.cargo ?? 0).toBe(kept);
      const loaded = new GameModel(CONTENT, saved);
      loaded.startGalaxy(1);
      expect(loaded.state.flight?.cargo).toBe(kept);
      expect(loaded.state.economy.cargo).toBeUndefined();
      const resumed = relaunch(CONTENT, loaded.save());
      expect(resumed.state.flight?.cargo).toBe(kept);
      resumed.returnHome();
      resumed.startGalaxy(1);
      expect(resumed.state.flight?.cargo).toBe(kept);
    },
  );
});
