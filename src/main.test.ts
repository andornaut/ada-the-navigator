import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";

import { createLoadingAttempts } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const boot = vi.hoisted(() => ({
  blockWrites: vi.fn(),
  constructorThrows: false,
  crash: undefined as (() => void) | undefined,
  game: vi.fn(),
  instances: [] as {
    events: EventEmitter;
    destroy: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    loop: { wake: ReturnType<typeof vi.fn> };
    scene: { getScene: () => unknown };
  }[],
  launch: vi.fn(),
  load: vi.fn(),
  manifest: {} as unknown,
  recordUnlocked: vi.fn(),
  requireNewer: vi.fn(),
  reveal: { collect: vi.fn(), commit: vi.fn(), dispose: vi.fn() },
  scene: vi.fn(),
  ship: true,
  shown: vi.fn(),
  startup: { crashed: false },
  stopFrame: vi.fn(),
  stopVisibility: vi.fn(),
}));
vi.mock("virtual:ada-ui.css", () => ({}));
vi.mock("./crash/install.ts", () => ({}));
vi.mock("./crash/crashScreen.ts", () => ({
  CRASH_SCREEN: {
    stopGameOnCrash: (callback: () => void) => {
      boot.crash = callback;
    },
  },
}));
vi.mock("./game/persistence.ts", () => ({
  saves: { blockWrites: boot.blockWrites, load: boot.load },
}));
vi.mock("./game/sceneUi.ts", () => ({ flushScene: vi.fn(), refreshScene: vi.fn() }));
vi.mock("./game/scene.ts", () => ({
  GameScene: class {
    events = new EventEmitter();
    controls = { reset: vi.fn(), setEnabled: vi.fn() };
    loads = { dispose: vi.fn(), failures: () => [], retryFailures: vi.fn(async () => {}) };
    disposeEntryResources = vi.fn();
    cache = {
      json: {
        get: (key: string) => {
          if (key === "art-manifest") {
            return boot.manifest;
          }
          const files: Record<string, string> = {
            "quantum-jump": "quantum-jump.json",
            "ship-material-palettes": "ship-paint.json",
            "ship-materials": "ship-materials.json",
          };
          return JSON.parse(readFileSync(`public/art/${files[key]}`, "utf8"));
        },
      },
    };
    textures = { exists: () => boot.ship };
    constructor(save: unknown) {
      boot.scene(save);
    }
  },
}));
vi.mock("phaser", () => ({
  Core: { Events: { DESTROY: "destroy" } },
  Game: class {
    events = new EventEmitter();
    isRunning = true;
    canvas = { setAttribute: vi.fn() };
    scale = { gameSize: {} };
    loop = { wake: vi.fn() };
    pause = vi.fn();
    destroy = vi.fn();
    scene: { getScene: () => unknown };
    constructor(config: {
      scene: { events: EventEmitter }[];
      callbacks: { preBoot: (game: unknown) => void; postBoot: (game: unknown) => void };
    }) {
      boot.game(config);
      if (boot.constructorThrows) {
        throw new Error("constructor failed before handle");
      }
      this.scene = { getScene: () => config.scene[0] };
      boot.instances.push(this);
      config.callbacks.preBoot(this);
      config.callbacks.postBoot(this);
      queueMicrotask(() => {
        (config.scene[0] as unknown as { entryCreate: (create: () => void) => void }).entryCreate(
          () => {},
        );
        config.scene[0]!.events.emit("create");
      });
    }
  },
  Scale: { CENTER_HORIZONTALLY: 1, NONE: 0 },
  Scenes: { Events: { CREATE: "create" } },
  WEBGL: 2,
}));
vi.mock("./pwa/index.ts", () => ({
  gameShown: boot.shown,
  launchPhoneApp: boot.launch,
  recordGalaxyUnlocks: boot.recordUnlocked,
  requireNewerVersion: boot.requireNewer,
  setupPhoneApp: vi.fn(),
}));
vi.mock("./loading/startup.ts", () => ({ startupFence: boot.startup }));
vi.mock("./loading/bootReveal.ts", () => ({ prepareBootReveal: () => boot.reveal }));
vi.mock("./lifecycle.ts", () => ({ followPageVisibility: () => boot.stopVisibility }));
vi.mock("./view/frameTurn.ts", () => ({ FRAME_TURN: {} }));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  trackInputModality: vi.fn(),
}));
vi.mock("@andornaut/game-kit/runtime/web/view/dom/watchFrameTurn", () => ({
  lockGameOrientation: vi.fn(),
}));
vi.mock("@andornaut/game-kit/runtime/web/view/phaser/followFrameTurn", () => ({
  followFrameTurn: () => boot.stopFrame,
}));
async function settle() {
  for (let n = 0; n < 30; n++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  boot.instances.length = 0;
  boot.crash = undefined;
  boot.startup.crashed = false;
  boot.ship = true;
  boot.constructorThrows = false;
  boot.manifest = JSON.parse(readFileSync("public/art/manifest.json", "utf8"));
  boot.launch.mockResolvedValue("continue");
  boot.load.mockResolvedValue({ save: { version: 12 }, status: "loaded" });
  vi.stubGlobal("document", { getElementById: () => ({}) });
  vi.stubGlobal("screen", {});
  vi.stubGlobal("window", {});
});
afterEach(() => vi.unstubAllGlobals());
async function entry() {
  const module = await import("./main.ts");
  const { requiredLoading } = await import("./loading/required.ts");
  const attempt = createLoadingAttempts({
    load: async (attempt) => {
      await module.prepareGame(requiredLoading, attempt);
      await module.startGame(attempt);
    },
    onReady: module.commitGame,
    onState: vi.fn(),
  });
  return { attempt, module };
}
it("keeps launch before storage and passes the complete save result to the scene", async () => {
  let release!: (value: unknown) => void;
  const save = new Promise((resolve) => {
    release = resolve;
  });
  boot.load.mockReturnValue(save);
  const { attempt } = await entry();
  const pending = attempt.start();
  await settle();
  expect(boot.launch).toHaveBeenCalledOnce();
  expect(boot.load).toHaveBeenCalledOnce();
  expect(boot.game).not.toHaveBeenCalled();
  expect(boot.launch.mock.invocationCallOrder[0]).toBeLessThan(
    boot.load.mock.invocationCallOrder[0]!,
  );
  const result = {
    save: { pendingInteraction: { galaxy: 1 }, selectedGalaxy: 5, unlocked: [1, 3], version: 12 },
    status: "loaded",
  };
  release(result);
  await pending;
  expect(boot.scene).toHaveBeenCalledWith(result);
  expect(boot.recordUnlocked).toHaveBeenCalledExactlyOnceWith([1, 3]);
  expect(attempt.state.kind).toBe("ready");
  expect(boot.reveal.commit).toHaveBeenCalledOnce();
});
it("waits for actual deferred retirement before constructing a Retry, without latching save writes", async () => {
  boot.ship = false;
  const { attempt } = await entry();
  await attempt.start();
  expect(attempt.state.kind).toBe("failed");
  expect(boot.reveal.commit).not.toHaveBeenCalled();
  const failed = boot.instances[0]!;
  const scene = failed.scene.getScene() as {
    entryCurrent: () => boolean;
    controls: { reset: ReturnType<typeof vi.fn> };
    disposeEntryResources: ReturnType<typeof vi.fn>;
  };
  expect(scene.entryCurrent()).toBe(false);
  expect(scene.controls.reset).toHaveBeenCalled();
  expect(scene.disposeEntryResources).toHaveBeenCalledOnce();
  expect(failed.pause).toHaveBeenCalledOnce();
  expect(failed.destroy).toHaveBeenCalledWith(true);
  expect(failed.loop.wake).toHaveBeenCalledOnce();
  expect(boot.stopFrame).toHaveBeenCalledOnce();
  expect(boot.blockWrites).not.toHaveBeenCalled();
  boot.ship = true;
  const retry = attempt.retry();
  await settle();
  expect(boot.game).toHaveBeenCalledOnce();
  failed.events.emit("destroy");
  await retry;
  expect(boot.game).toHaveBeenCalledTimes(2);
  expect(boot.load).toHaveBeenCalledOnce();
  expect(boot.reveal.commit).toHaveBeenCalledOnce();
});
it("revokes a retained successful game's resources synchronously on page disposal", async () => {
  const { attempt, module } = await entry();
  await attempt.start();
  const instance = boot.instances[0]!;
  module.disposeGame();
  module.disposeGame();
  expect(instance.destroy).toHaveBeenCalledOnce();
  expect(boot.stopFrame).toHaveBeenCalledOnce();
  expect(boot.stopVisibility).toHaveBeenCalledOnce();
  expect(boot.blockWrites).not.toHaveBeenCalled();
});
it("does not overlap a constructor that failed before exposing a public retirement handle", async () => {
  boot.constructorThrows = true;
  const { attempt } = await entry();
  await attempt.start();
  expect(attempt.state.kind).toBe("failed");
  boot.constructorThrows = false;
  await attempt.retry();
  expect(attempt.state.kind).toBe("failed");
  expect(boot.game).toHaveBeenCalledOnce();
  expect(boot.blockWrites).not.toHaveBeenCalled();
});
it("never reads storage or constructs after the launch version switch", async () => {
  boot.launch.mockResolvedValue("reloading");
  const { attempt } = await entry();
  await attempt.start();
  expect(boot.load).not.toHaveBeenCalled();
  expect(boot.game).not.toHaveBeenCalled();
  expect(boot.reveal.commit).not.toHaveBeenCalled();
});
it("keeps the crash fence while a save read settles and never enters the game", async () => {
  let release!: (value: unknown) => void;
  boot.load.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const { attempt } = await entry();
  const pending = attempt.start();
  await settle();
  boot.crash!();
  release({ status: "loaded" });
  await pending;
  expect(boot.blockWrites).toHaveBeenCalledWith("game crashed");
  expect(boot.game).not.toHaveBeenCalled();
});
it("does not start launch or storage after an earlier module-download crash", async () => {
  boot.startup.crashed = true;
  const { attempt } = await entry();
  await attempt.start();
  expect(boot.blockWrites).toHaveBeenCalledWith("game crashed");
  expect(boot.launch).not.toHaveBeenCalled();
  expect(boot.load).not.toHaveBeenCalled();
});

it("starts a newer-save update while required artwork is blocked, without constructing or writing", async () => {
  boot.load.mockResolvedValue({ status: "newer" });
  const module = await import("./main.ts");
  const { requiredLoading } = await import("./loading/required.ts");
  const unobserve = requiredLoading.observe({ retry: () => {}, status: () => "failed" });
  const prepare = createLoadingAttempts({
    load: (attempt) => module.prepareGame(requiredLoading, attempt),
    onState: vi.fn(),
  });
  await prepare.start();
  expect(boot.requireNewer).toHaveBeenCalledOnce();
  expect(boot.recordUnlocked).not.toHaveBeenCalled();
  expect(boot.game).not.toHaveBeenCalled();
  expect(boot.blockWrites).not.toHaveBeenCalled();
  expect(requiredLoading.state.kind).toBe("failed");
  unobserve();
  module.disposeGame();
});

it("defers entry until an actual attempt and coalesces repeated cached-module callers", async () => {
  const module = await import("./main.ts");
  const { requiredLoading } = await import("./loading/required.ts");
  expect(boot.load).not.toHaveBeenCalled();
  expect(boot.game).not.toHaveBeenCalled();
  const attempts = createLoadingAttempts({
    async load(owner) {
      await module.prepareGame(requiredLoading, owner);
      const first = module.startGame(owner);
      expect(module.startGame(owner)).toBe(first);
      await first;
      expect((await import("./main.ts")).startGame(owner)).toBe(first);
    },
    onState: vi.fn(),
  });
  await attempts.start();
  expect(boot.load).toHaveBeenCalledOnce();
  expect(boot.game).toHaveBeenCalledOnce();
  module.disposeGame();
});

it("retains the crash write fence and pauses the actual owned instance after successful boot", async () => {
  const { attempt } = await entry();
  await attempt.start();
  boot.crash!();
  expect(boot.blockWrites).toHaveBeenCalledWith("game crashed");
  expect(boot.instances[0]!.pause).toHaveBeenCalledOnce();
  expect(boot.game).toHaveBeenCalledOnce();
});
