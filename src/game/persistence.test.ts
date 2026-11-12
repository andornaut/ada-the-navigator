import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GameModel } from "../model/game.ts";
import { playOpening, relaunch } from "../testing/launch.ts";
import { readSave, stopSaving, writeSave } from "./persistence.ts";

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
    const model = new GameModel(CONTENT);
    expect(writeSave(model.save())).toBe(true);
    blocked = true;
    model.startGalaxy(1);
    playOpening(model);
    expect(writeSave(model.save())).toBe(false);
    expect(relaunch(CONTENT, readSave()).state.mode).toBe("home");
    const before = { ...model.state.flight!.player };
    model.step(0.05, { aim: { x: 0, y: 0 }, move: { x: 1, y: 0 }, use: false });
    expect(model.state.flight!.player).not.toEqual(before);
    expect(writeSave(model.save())).toBe(false);
    blocked = false;
    expect(writeSave(model.save())).toBe(true);
    expect(relaunch(CONTENT, readSave()).state).toEqual(model.state);
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

  // Last: stopping lasts for the rest of the page's life.
  it("keeps the last save once a crash stops saving", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const model = new GameModel(CONTENT);
    expect(writeSave(model.save())).toBe(true);
    const saved = [...values.values()];
    stopSaving();
    model.startGalaxy(1);
    expect(writeSave(model.save())).toBe(true);
    expect([...values.values()]).toEqual(saved);
  });
});
