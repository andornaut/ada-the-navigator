import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GameModel, newGameState } from "../model/game.ts";
import { SAVE_VERSION } from "../model/save.ts";
import { createAdaSaves, SAVE_KEYS } from "./persistence.ts";

function fixture(raw: string | null, version = "0.0.1") {
  const values = new Map<string, string>([
    ["ada.preferences", "keep"],
    ["unrelated.save", "keep"],
    [SAVE_KEYS.backup, "older backup"],
  ]);
  if (raw !== null) {
    values.set(SAVE_KEYS.save, raw);
  }
  const port = {
    read: vi.fn(async (key: string) => values.get(key) ?? null),
    write: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
  return { port, store: createAdaSaves(port, version), values };
}
it.each([
  "{broken",
  "{}",
  JSON.stringify({ ...newGameState(), version: SAVE_VERSION - 1 }),
  JSON.stringify({ ...newGameState(), version: SAVE_VERSION + 1 }),
])("backs up and resets only pre-v1 invalid/incompatible data: %s", async (raw) => {
  const f = fixture(raw),
    loaded = await f.store.load();
  expect(loaded.status).toBe("loaded");
  expect(loaded.save).toEqual(newGameState());
  expect(f.port.write.mock.calls).toEqual([
    [SAVE_KEYS.backup, raw],
    [SAVE_KEYS.save, JSON.stringify(newGameState())],
  ]);
  expect(f.values.get(SAVE_KEYS.backup)).toBe(raw);
  expect(f.values.get("ada.preferences")).toBe("keep");
  expect(f.values.get("unrelated.save")).toBe("keep");
  expect(await f.store.load()).toEqual(loaded);
  expect(f.port.write).toHaveBeenCalledTimes(2);
  expect(await f.store.save(loaded.save)).toEqual({ status: "saved" });
});
it("retains actual required plans and complete flight clocks through valid Continue without repair", async () => {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  const document = model.saveDocument(),
    raw = JSON.stringify(document),
    f = fixture(raw);
  expect((await f.store.load()).save).toEqual(document);
  expect(f.values.get(SAVE_KEYS.save)).toBe(raw);
  expect(f.port.write).not.toHaveBeenCalled();
  expect(f.values.get(SAVE_KEYS.backup)).toBe("older backup");
  document.flight!.combat ??= { initialPackSizes: {}, routeEncounters: [] };
  document.flight!.combat.emptyRoutePlans = ["growers"];
  const invalid = fixture(JSON.stringify(document));
  expect((await invalid.store.load()).save).toEqual(newGameState());
  expect(invalid.values.get(SAVE_KEYS.backup)).toBe(JSON.stringify(document));
});
it("keeps first-visit storage absent and the v1 true-newer write fence intact", async () => {
  const first = fixture(null);
  expect((await first.store.load()).status).toBe("new");
  expect(first.port.write).not.toHaveBeenCalled();
  const f = fixture(JSON.stringify({ version: SAVE_VERSION + 1 }), "1.0.0");
  expect((await f.store.load()).status).toBe("newer");
  expect((await f.store.save(newGameState())).status).toBe("unavailable");
  expect(f.port.write).not.toHaveBeenCalled();
});
it.each(["read", "backup", "reset"] as const)(
  "preserves actual %s failure and permanently fences repair writes",
  async (kind) => {
    const f = fixture("{broken");
    if (kind === "read") {
      f.port.read.mockRejectedValueOnce(new Error("denied"));
    }
    if (kind === "backup") {
      f.port.write.mockRejectedValueOnce(new Error("backup denied"));
    }
    if (kind === "reset") {
      f.port.write
        .mockImplementationOnce(async (key, value) => {
          f.values.set(key, value);
        })
        .mockRejectedValueOnce(new Error("quota"));
    }
    expect((await f.store.load()).status).toBe("unavailable");
    const count = f.port.write.mock.calls.length;
    expect((await f.store.load()).status).toBe("unavailable");
    expect(f.port.write).toHaveBeenCalledTimes(count);
    expect((await f.store.save(newGameState())).status).toBe("unavailable");
    expect(f.values.get(SAVE_KEYS.save)).toBe("{broken");
  },
);
it.each(["read", "backup"] as const)(
  "honors a crash during %s before entering the next repair write",
  async (stage) => {
    const f = fixture("{broken");
    let finish!: () => void;
    let enter!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    if (stage === "read") {
      f.port.read.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = () => resolve("{broken");
            enter();
          }),
      );
    } else {
      f.port.write.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
            enter();
          }),
      );
    }
    const loading = f.store.load();
    await entered;
    f.store.blockWrites("");
    f.store.blockWrites("later");
    finish();
    expect((await loading).status).toBe("unavailable");
    expect(f.port.write).toHaveBeenCalledTimes(stage === "read" ? 0 : 1);
    expect(await f.store.save(newGameState())).toEqual({ reason: "", status: "unavailable" });
    expect(f.values.get(SAVE_KEYS.save)).toBe("{broken");
  },
);
it("retains an already-entered reset write result while keeping the crash write fence", async () => {
  const f = fixture("{broken");
  let finish!: () => void;
  let enter!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  f.port.write
    .mockImplementationOnce(async (key, value) => {
      f.values.set(key, value);
    })
    .mockImplementationOnce(
      (key, value) =>
        new Promise<void>((resolve) => {
          finish = () => {
            f.values.set(key, value);
            resolve();
          };
          enter();
        }),
    );
  const loading = f.store.load();
  await entered;
  f.store.blockWrites("game crashed");
  finish();
  expect((await loading).status).toBe("loaded");
  expect(f.values.get(SAVE_KEYS.save)).toBe(JSON.stringify(newGameState()));
  expect(await f.store.save(newGameState())).toEqual({
    reason: "game crashed",
    status: "unavailable",
  });
});
