import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { GameModel } from "./game.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

describe("Shield depletion ore loss", () => {
  it.each([0, 1, 2, 3, 10, 11])(
    "clears %i carried ore once through saves and later flights",
    (ore) => {
      const active = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
      active.startGalaxy(1);
      active.state.flight!.cargo = ore;
      active.state.economy.cargo = 19;
      active.state.economy.stardust = 30;
      active.state.progress[1].deposited = 4;
      const model = relaunch(CONTENT, active.save());
      const flight = model.state.flight!;
      expect(flight.cargo).toBe(ore);
      expect(model.state.economy.cargo).toBe(19);
      flight.shield = CONTENT.tuning.hazardDamage;
      endArrivalGrace(flight);
      flight.objects = [{ ...flight.player, hp: 1, id: "depletion", kind: "hazard", radius: 1000 }];
      model.step(0.1, idle);
      expect(model.state.flight).toBeNull();
      expect(model.state.economy.cargo).toBeUndefined();
      const saved = model.save();
      const restored = restoreSave(saved)!;
      expect(restored.economy.cargo).toBeUndefined();
      expect(restored.economy.stardust).toBe(30);
      expect(restored.progress[1].deposited).toBe(4);
      model.step(1, idle);
      expect(model.state.economy.cargo).toBeUndefined();
      const loaded = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, saved);
      loaded.continueGame();
      const lossLine = CONTENT.labels.jumpHomeOreLost!;
      const expectedPage =
        ore > 0 ? `${CONTENT.labels.jumpHome}\n${lossLine}` : CONTENT.labels.jumpHome;
      expect(loaded.storyView?.page).toMatchObject({ id: "jumpHome", text: expectedPage });
      loaded.startGalaxy(1);
      expect(loaded.state.flight?.cargo).toBe(0);
      expect(loaded.state.economy.cargo).toBeUndefined();
      const resumed = relaunch(CONTENT, loaded.save());
      expect(resumed.state.flight?.cargo).toBe(0);
      resumed.returnHome();
      resumed.startGalaxy(1);
      expect(resumed.state.flight?.cargo).toBe(0);
    },
  );
});
