import { afterEach, describe, expect, it, vi } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { GameModel } from "../model/game.ts";
import { readSave, writeSave } from "./persistence.ts";

afterEach(() => vi.unstubAllGlobals());

describe("browser save boundary", () => {
  it("reports failed writes and recovers with the latest playable model state", () => {
    let blocked = false;
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem(key: string, value: string) {
        if (blocked) {
          throw new Error("quota");
        }
        values.set(key, value);
      },
    });
    const model = new GameModel(PROTOTYPE);
    expect(writeSave(model.save())).toBe(true);
    blocked = true;
    model.startSector(1);
    model.choose("0");
    expect(writeSave(model.save())).toBe(false);
    expect(new GameModel(PROTOTYPE, readSave()).state.mode).toBe("home");
    const before = { ...model.state.flight!.player };
    model.step(0.05, { aim: { x: 0, y: 0 }, move: { x: 1, y: 0 }, use: false });
    expect(model.state.flight!.player).not.toEqual(before);
    expect(writeSave(model.save())).toBe(false);
    blocked = false;
    expect(writeSave(model.save())).toBe(true);
    expect(new GameModel(PROTOTYPE, readSave()).state).toEqual(model.state);
  });

  it("reports denied access to the storage object without throwing", () => {
    vi.stubGlobal("localStorage", undefined);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("denied");
      },
    });
    expect(writeSave("{}")).toBe(false);
    expect(readSave()).toBeUndefined();
  });
});
