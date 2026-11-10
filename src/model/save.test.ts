import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { GameModel } from "./game.ts";
import { readSave, restoreSave, writeSave } from "./save.ts";

describe("save boundary", () => {
  it("roundtrips real initial and launched states without sharing mutable references", () => {
    const model = new GameModel(PROTOTYPE);
    expect(restoreSave(model.save())).toEqual(model.state);
    model.startSector(1);
    model.choose("0");
    const restored = restoreSave(model.save());
    expect(restored).toEqual(model.state);
    expect(restored?.flight).not.toBe(model.state.flight);
  });
  it("rejects truncated, corrupt and unsupported data without throwing", () => {
    const model = new GameModel(PROTOTYPE);
    model.startSector(1);
    model.choose("0");
    for (const change of [
      { version: 2 },
      { flight: {} },
      { progress: {} },
      { unlocked: [4] },
      { selectedSector: "1" },
    ]) {
      expect(restoreSave({ ...model.state, ...change })).toBeNull();
    }
    expect(restoreSave("{broken")).toBeNull();
    expect(new GameModel(PROTOTYPE, "{broken").state.mode).toBe("home");
  });
  it("tolerates blocked storage reads and writes", () => {
    const storage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
    };
    expect(readSave(storage, "save")).toBeNull();
    expect(writeSave(storage, "save", "{} ")).toBe(false);
  });
});
