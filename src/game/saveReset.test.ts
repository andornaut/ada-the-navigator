import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GameModel, newGameState } from "../model/game.ts";
import {
  createAdaSaves,
  restoreSave,
  SAVE_KEYS,
  SAVE_RESTORE,
  SAVE_VERSION,
} from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";

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
it("backs up an in-progress campaign on the previous 240,000-unit chart", async () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  const old = model.saveDocument();
  old.flight!.topology = { kind: "torus", side: 200_000, version: 1 };
  const raw = JSON.stringify(old);
  const f = fixture(raw);

  expect(restoreSave(raw)).toBeNull();
  expect((await f.store.load()).save).toEqual(newGameState());
  expect(f.port.write.mock.calls).toEqual([
    [SAVE_KEYS.backup, raw],
    [SAVE_KEYS.save, JSON.stringify(newGameState())],
  ]);
});

it("retains actual required plans and complete flight clocks through valid Continue without repair", async () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
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
it("rotates the campaign generation once when replacing an older save format", async () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  const played = model.saveDocument();
  const stamp = { generation: "previous-generation", revision: "previous-revision" };
  const f = fixture(JSON.stringify({ ...played, adaSaveStamp: stamp }));
  const campaign = { lock: async <T>(operation: () => T | Promise<T>) => operation() };
  const stale = createAdaSaves(f.port, undefined, campaign);
  const original = (await stale.load()).save;
  const old = JSON.stringify({ ...played, adaSaveStamp: stamp, version: SAVE_VERSION - 1 });
  f.values.set(SAVE_KEYS.save, old);

  const current = createAdaSaves(f.port, undefined, campaign);
  expect(await current.load()).toMatchObject({ save: newGameState(), status: "loaded" });
  const replaced = f.values.get(SAVE_KEYS.save)!;
  const nextStamp = JSON.parse(replaced).adaSaveStamp;
  expect(nextStamp.generation).toEqual(expect.any(String));
  expect(nextStamp.generation).not.toBe(stamp.generation);
  expect(nextStamp.revision).not.toBe(stamp.revision);
  expect(f.values.get(SAVE_KEYS.backup)).toBe(old);
  expect(await stale.save(original)).toMatchObject({ status: "unavailable" });
  expect(f.values.get(SAVE_KEYS.save)).toBe(replaced);
  expect(f.port.write).toHaveBeenCalledTimes(2);

  expect(await current.load()).toMatchObject({ save: newGameState(), status: "loaded" });
  expect(f.port.write).toHaveBeenCalledTimes(2);
  expect(await current.save(played)).toEqual({ status: "saved" });
  expect(JSON.parse(f.values.get(SAVE_KEYS.save)!).adaSaveStamp.generation).toBe(
    nextStamp.generation,
  );
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

it("authorizes a real campaign read without repair and replaces only the exact authorized bytes", async () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  const raw = model.save();
  const f = fixture(raw);
  const entered = vi.fn();
  const store = createAdaSaves(f.port, undefined, {
    async lock(operation) {
      entered();
      return operation();
    },
  });
  const authorization = (await store.readCampaign())!;
  expect(authorization.raw).toBe(raw);
  const next = { ...newGameState(), prologueSeen: true, started: true };
  expect(
    await store.commitCampaign(authorization, { ...next, unlocked: [] }, () => true),
  ).toBeNull();
  expect(entered).toHaveBeenCalledTimes(1);

  f.values.set(SAVE_KEYS.save, `${raw} `);
  expect(await store.commitCampaign(authorization, next, () => true)).toBeNull();
  expect(f.port.write).not.toHaveBeenCalled();
  f.values.set(SAVE_KEYS.save, raw);
  f.port.write.mockRejectedValueOnce(new Error("quota"));
  expect(await store.commitCampaign(authorization, next, () => true)).toBeNull();
  expect(f.values.get(SAVE_KEYS.save)).toBe(raw);

  const panel = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
  expect(await store.commitCampaign(authorization, next, panel)).toBeNull();
  expect(f.values.get(SAVE_KEYS.save)).toBe(raw);
  const adopt = await store.commitCampaign(authorization, next, () => true);
  expect(adopt).not.toBeNull();
  const { adaSaveStamp, ...saved } = JSON.parse(f.values.get(SAVE_KEYS.save)!);
  expect(saved).toEqual(next);
  expect(adaSaveStamp.generation).toEqual(expect.any(String));
  expect(adaSaveStamp.revision).toEqual(expect.any(String));
  expect(restoreSave(f.values.get(SAVE_KEYS.save)!)).toMatchObject(next);
  expect(f.values.get(SAVE_KEYS.backup)).toBe("older backup");
  expect(f.values.get("ada.preferences")).toBe("keep");
  expect(await store.commitCampaign(authorization, next, () => true)).toBeNull();
});

it("does not make a missing, corrupt, fresh, or write-fenced save eligible for campaign rewind", async () => {
  const f = fixture(null);
  const store = createAdaSaves(f.port, undefined, { lock: async (operation) => operation() });
  expect(await store.readCampaign()).toBeNull();
  f.values.set(SAVE_KEYS.save, "{broken");
  expect(await store.readCampaign()).toBeNull();
  f.values.set(SAVE_KEYS.save, JSON.stringify(newGameState()));
  expect(await store.readCampaign()).toBeNull();
  f.values.set(SAVE_KEYS.save, JSON.stringify({ ...newGameState(), started: true }));
  expect(await store.readCampaign()).not.toBeNull();
  store.blockWrites("crash");
  expect(await store.readCampaign()).toBeNull();
  expect(f.port.write).not.toHaveBeenCalled();
});

it("honors the existing write fence while an ordinary save is waiting for the shared lock", async () => {
  const f = fixture("previous");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const store = createAdaSaves(f.port, undefined, {
    async lock(operation) {
      await held;
      return operation();
    },
  });
  const waiting = store.save(newGameState());
  store.blockWrites("game crashed");
  release();
  expect(await waiting).toEqual({ reason: "game crashed", status: "unavailable" });
  expect(f.values.get(SAVE_KEYS.save)).toBe("previous");
  expect(f.port.write).not.toHaveBeenCalled();
});

it("refuses a changed revision when participating saves return to the exact authorized game data", async () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  const original = model.saveDocument();
  const f = fixture(JSON.stringify(original));
  const campaign = { lock: async <T>(operation: () => T | Promise<T>) => operation() };
  const confirming = createAdaSaves(f.port, undefined, campaign);
  const other = createAdaSaves(f.port, undefined, campaign);
  const loaded = await confirming.load();
  expect(loaded.save).toEqual(original);
  expect((await other.load()).save).toEqual(original);
  expect(f.port.write).not.toHaveBeenCalled();
  const authorization = (await confirming.readCampaign())!;
  expect(await confirming.save(original)).toEqual({ status: "saved" });
  expect(f.values.get(SAVE_KEYS.save)).toBe(authorization.raw);
  expect(f.port.write).not.toHaveBeenCalled();

  const changed = { ...original, economy: { ...original.economy, stardust: 219 } };
  expect(await other.save(changed)).toEqual({ status: "saved" });
  expect(await confirming.save(original)).toEqual({ status: "saved" });
  const latest = f.values.get(SAVE_KEYS.save)!;
  const { adaSaveStamp, ...save } = JSON.parse(latest);
  expect(save).toEqual(JSON.parse(authorization.raw));
  expect(adaSaveStamp.generation).toBeNull();
  const next = { ...newGameState(), prologueSeen: true, started: true };
  expect(await confirming.commitCampaign(authorization, next, () => true)).toBeNull();
  expect(f.values.get(SAVE_KEYS.save)).toBe(latest);
  expect(f.port.write).toHaveBeenCalledTimes(2);

  expect(await other.save(original)).toEqual({ status: "saved" });
  expect(f.values.get(SAVE_KEYS.save)).toBe(latest);
  expect(f.port.write).toHaveBeenCalledTimes(2);
});

it("fences only pre-rewind models and binds the new generation on real handoff or reload", async () => {
  const initial = { ...newGameState(), started: true };
  const f = fixture(JSON.stringify(initial));
  const campaign = { lock: async <T>(operation: () => T | Promise<T>) => operation() };
  const confirming = createAdaSaves(f.port, undefined, campaign);
  const stale = createAdaSaves(f.port, undefined, campaign);
  const original = (await stale.load()).save;
  await confirming.load();

  const source = (await confirming.readCampaign())!;
  const next = { ...initial, prologueSeen: true };
  const adopt = await confirming.commitCampaign(source, next, () => true);
  expect(adopt).not.toBeNull();
  const committed = f.values.get(SAVE_KEYS.save)!;
  const fenced = { reason: expect.stringContaining("another tab"), status: "unavailable" };
  expect(await confirming.save(original)).toEqual(fenced);
  expect(await stale.readCampaign()).toBeNull();
  expect((await stale.load({ bindModel: false })).save).toEqual(next);
  expect(await stale.save(original)).toEqual(fenced);
  expect(f.values.get(SAVE_KEYS.save)).toBe(committed);
  expect(f.port.write).toHaveBeenCalledExactlyOnceWith(SAVE_KEYS.save, committed);

  adopt!();
  expect(await confirming.save(next)).toEqual({ status: "saved" });
  expect(f.values.get(SAVE_KEYS.save)).toBe(committed);
  expect((await stale.load()).save).toEqual(next);
  const played = { ...next, economy: { ...next.economy, stardust: 27 } };
  expect(await stale.save(played)).toEqual({ status: "saved" });
  const final = JSON.parse(f.values.get(SAVE_KEYS.save)!);
  expect(final.adaSaveStamp.generation).toBe(JSON.parse(committed).adaSaveStamp.generation);
  expect(final.adaSaveStamp.revision).not.toBe(JSON.parse(committed).adaSaveStamp.revision);
});

it.each(["0.0.1", "1.0.0"])(
  "fences a malformed stamp without repairing game data on %s",
  async (version) => {
    const raw = JSON.stringify({
      ...newGameState(),
      adaSaveStamp: { generation: null, revision: 42 },
    });
    const f = fixture(raw, version);
    expect(await f.store.load()).toMatchObject({
      reason: "The Ada save revision is invalid",
      status: "unavailable",
    });
    expect(await f.store.save(newGameState())).toMatchObject({ status: "unavailable" });
    expect(f.values.get(SAVE_KEYS.save)).toBe(raw);
    expect(f.values.get(SAVE_KEYS.backup)).toBe("older backup");
    expect(f.port.write).not.toHaveBeenCalled();
  },
);

it("leaves unknown stamps on future saves to the v1 newer-version fence", async () => {
  const raw = JSON.stringify({ adaSaveStamp: { future: true }, version: SAVE_VERSION + 1 });
  const f = fixture(raw, "1.0.0");
  expect((await f.store.load()).status).toBe("newer");
  expect((await f.store.save(newGameState())).status).toBe("unavailable");
  expect(f.values.get(SAVE_KEYS.save)).toBe(raw);
  expect(f.port.write).not.toHaveBeenCalled();
});
