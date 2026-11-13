import { saveStore } from "@andornaut/game-kit/save/saveStore";
import type { SaveStorage } from "@andornaut/game-kit/save/storage";
import { localSaveStorage } from "@andornaut/game-kit/web/save/dom/localSaveStorage";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { ensureDestination } from "../model/flight.ts";
import { GameModel } from "../model/game.ts";
import { SAVE_VERSION } from "../model/save.ts";
import { stationsNear } from "../model/stations.ts";
import { collectWeapon } from "../model/weapons.ts";
import { relaunch } from "../testing/launch.ts";
import { SAVE_FORMAT, SAVE_KEYS, saves } from "./persistence.ts";

function storage(raw?: string) {
  const values = new Map<string, string>(raw === undefined ? [] : [[SAVE_KEYS.save, raw]]);
  const port = {
    read: vi.fn(async (key: string) => values.get(key) ?? null),
    write: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  } satisfies SaveStorage;
  return { port, store: saveStore(port, SAVE_KEYS, SAVE_FORMAT), values };
}
function pendingOffer(): GameModel {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  Object.assign(model.state.progress[1], {
    holodisk: true,
    introduced: true,
    known: ["growers"],
    questComplete: true,
    resolved: true,
    stage: 4,
  });
  const flight = model.state.flight!;
  const place = ensureDestination(CONTENT, "growers", flight);
  flight.player = { x: place.x, y: place.y };
  model.state.progress[1].stations = [
    stationsNear(ECONOMY, 1, 40000, place).find(
      (site) => Math.hypot(site.x - place.x, site.y - place.y) >= 3000,
    )!.id,
  ];
  model.interact();
  expect(model.state.dialogue?.choices.map(({ id }) => id)).toEqual(["take", "skip"]);
  return model;
}
afterEach(() => vi.unstubAllGlobals());

describe("canonical Ada save storage", () => {
  it("keeps the existing key, schema and exact effective flight snapshot at the start screen", async () => {
    const boundary = storage();
    expect((await boundary.store.load()).status).toBe("new");
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    const before = model.save();
    const waiting = new GameModel(CONTENT, before);
    expect(waiting.state.mode).toBe("home");
    expect(waiting.saveDocument().mode).toBe("space");
    expect(await boundary.store.save(waiting.saveDocument())).toEqual({ status: "saved" });
    expect(boundary.values.get("ada-the-navigator.save")).toBe(before);
    const loaded = await boundary.store.load();
    expect(loaded.status).toBe("loaded");
    expect(loaded.save.version).toBe(12);
    expect(relaunch(CONTENT, loaded.save).state).toEqual(model.state);
  });

  it("keeps a closed meaningful choice without accepting it or losing its effective held flight", async () => {
    const model = pendingOffer();
    const question = structuredClone(model.state.dialogue);
    model.closeInteraction();
    const waiting = new GameModel(CONTENT, model.save());
    const boundary = storage();
    expect(await boundary.store.save(waiting.saveDocument())).toEqual({ status: "saved" });
    const loaded = await boundary.store.load();
    expect(loaded.status).toBe("loaded");
    expect(loaded.save.pendingInteraction?.dialogue).toEqual(question);
    const resumed = relaunch(CONTENT, loaded.save);
    expect(resumed.state.tasks[1]).toBeUndefined();
    resumed.interact();
    expect(resumed.state.dialogue).toEqual(question);
    expect(resumed.state.tasks[1]).toBeUndefined();
    resumed.choose("take");
    expect(resumed.state.tasks[1]).toMatchObject({ kind: "activity", place: "growers" });
    await boundary.store.save(resumed.saveDocument());
    expect((await boundary.store.load()).save.pendingInteraction).toBeUndefined();
  });

  it("retains the post-depletion continuation and the flight loadout pulled into the snapshot", async () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    collectWeapon("multiLaser", model.state.flight!);
    model.state.flight!.ammo.multiLaser = 7;
    const flight = model.state.flight!;
    flight.objects = [];
    flight.shield = 1;
    flight.shots.push({
      ...flight.player,
      damage: 1,
      enemy: true,
      hitIds: [],
      id: `hit:${flight.nextId++}`,
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    });
    model.step(0.01, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    expect(model.state.mode).toBe("home");
    const before = model.saveDocument();
    expect(before.depletionContinuation).toBe(true);
    expect(before.economy.ammo.multiLaser).toBe(7);
    const boundary = storage();
    await boundary.store.save(before);
    const loaded = await boundary.store.load();
    expect(loaded.status).toBe("loaded");
    expect(loaded.save.depletionContinuation).toBe(true);
    const resumed = new GameModel(CONTENT, loaded.save);
    resumed.continueGame();
    expect(resumed.storyView?.page.id).toBe("jumpHome");
    resumed.storyNext();
    expect(resumed.storyView?.page).toMatchObject({ id: "sleep", sleep: true });
    resumed.storyNext();
    expect(resumed.storyView?.page.id).toBe("sleep");
    resumed.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.seconds);
    expect(resumed.storyView?.page.id).toBe("morning");
    resumed.storySkip();
    expect(resumed.storyView?.page).toMatchObject({
      id: "opening",
      text: CONTENT.chapters[1]!.opening,
    });
    expect(resumed.storyView?.choices.length).toBeGreaterThan(0);
    expect(resumed.state.progress[1].opened).toBe(false);
    const unanswered = resumed.storyView?.page;
    resumed.storySkip();
    expect(resumed.storyView?.page).toEqual(unanswered);
    resumed.storyChoose(0);
    resumed.storySkip();
    expect(resumed.screen).toBe("selector");
    expect(resumed.state.economy.ammo.multiLaser).toBe(7);
    expect(resumed.state.unlocked).toEqual(before.unlocked);
  });

  it.each([SAVE_VERSION + 1, SAVE_VERSION + 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "preserves a finite future version %s without backup, decode or later writes",
    async (version) => {
      const raw = JSON.stringify({ version });
      const boundary = storage(raw);
      const loaded = await boundary.store.load();
      expect(loaded.status).toBe("newer");
      expect(await boundary.store.save(new GameModel(CONTENT).saveDocument())).toMatchObject({
        status: "unavailable",
      });
      expect(boundary.port.write).not.toHaveBeenCalled();
      expect(boundary.values.get(SAVE_KEYS.save)).toBe(raw);
    },
  );

  it.each([
    "{broken",
    JSON.stringify({ progress: {}, version: SAVE_VERSION }),
    JSON.stringify({ version: SAVE_VERSION - 1 }),
  ])("backs up incompatible or corrupt data before replacing it: %s", async (raw) => {
    const boundary = storage(raw);
    const loaded = await boundary.store.load();
    expect(loaded.status).toBe("corrupt");
    expect(boundary.values.get(SAVE_KEYS.backup)).toBe(raw);
    expect(boundary.values.get(SAVE_KEYS.save)).toBe(raw);
    expect(await boundary.store.save(loaded.save)).toEqual({ status: "saved" });
    expect(boundary.port.write.mock.calls.map(([key]) => key)).toEqual([
      SAVE_KEYS.backup,
      SAVE_KEYS.save,
    ]);
  });

  it("reports quota failures and retries with the latest complete game snapshot", async () => {
    const boundary = storage();
    const model = new GameModel(CONTENT);
    await boundary.store.save(model.saveDocument());
    const saved = boundary.values.get(SAVE_KEYS.save);
    model.startGalaxy(1);
    boundary.port.write.mockRejectedValueOnce(new Error("quota"));
    expect(await boundary.store.save(model.saveDocument())).toMatchObject({
      status: "unavailable",
    });
    expect(boundary.values.get(SAVE_KEYS.save)).toBe(saved);
    expect(await boundary.store.save(model.saveDocument())).toEqual({ status: "saved" });
    expect(relaunch(CONTENT, (await boundary.store.load()).save).state).toEqual(model.state);
  });

  it.each(["read", "backup"] as const)("keeps writes fenced after a failed %s", async (failed) => {
    const boundary = storage("{broken");
    if (failed === "read") {
      boundary.port.read.mockRejectedValueOnce(new Error("denied"));
    } else {
      boundary.port.write.mockRejectedValueOnce(new Error("quota"));
    }
    expect((await boundary.store.load()).status).toBe("unavailable");
    const calls = boundary.port.write.mock.calls.length;
    expect(await boundary.store.save(new GameModel(CONTENT).saveDocument())).toMatchObject({
      status: "unavailable",
    });
    expect(boundary.port.write).toHaveBeenCalledTimes(calls);
    expect(boundary.values.get(SAVE_KEYS.save)).toBe("{broken");
  });

  it("fences a crash while an invalid save read is pending, before any backup write", async () => {
    const boundary = storage();
    let release!: (raw: string) => void;
    boundary.port.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const loading = boundary.store.load();
    boundary.store.blockWrites("game crashed");
    release("{broken");
    await loading;
    expect(boundary.port.write).not.toHaveBeenCalled();
    expect(await boundary.store.save(new GameModel(CONTENT).saveDocument())).toEqual({
      reason: "game crashed",
      status: "unavailable",
    });
  });

  it("keeps even an empty first fence reason after another fence and later load", async () => {
    const boundary = storage();
    boundary.store.blockWrites("");
    boundary.store.blockWrites("later");
    await boundary.store.load();
    expect(await boundary.store.save(new GameModel(CONTENT).saveDocument())).toEqual({
      reason: "",
      status: "unavailable",
    });
    expect(boundary.port.write).not.toHaveBeenCalled();
  });

  it("uses the browser port lazily when storage access is denied", async () => {
    vi.stubGlobal("localStorage", undefined);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("denied");
      },
    });
    const store = saveStore(localSaveStorage(), SAVE_KEYS, SAVE_FORMAT);
    expect((await store.load()).status).toBe("unavailable");
    expect((await store.save(new GameModel(CONTENT).saveDocument())).status).toBe("unavailable");
  });

  it("the page-session store preserves its last browser save after the crash fence", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const model = new GameModel(CONTENT);
    expect(await saves.save(model.saveDocument())).toEqual({ status: "saved" });
    const before = [...values];
    saves.blockWrites("game crashed");
    model.startGalaxy(1);
    expect((await saves.save(model.saveDocument())).status).toBe("unavailable");
    expect([...values]).toEqual(before);
  });
});
