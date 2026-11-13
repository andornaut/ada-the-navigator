import { afterEach, beforeEach, expect, it, vi } from "vitest";

const boot = vi.hoisted(() => ({
  blockWrites: vi.fn(),
  crash: undefined as (() => void) | undefined,
  destroy: vi.fn(),
  game: vi.fn(),
  launch: vi.fn(),
  load: vi.fn(),
  pause: vi.fn(),
  reveal: vi.fn(() => ({ dispose: vi.fn(), ready: vi.fn() })),
  scene: vi.fn(),
}));
// Startup ordering does not depend on generating the complete UI stylesheet.
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
vi.mock("./game/scene.ts", () => ({
  GameScene: class {
    constructor(save: unknown) {
      boot.scene(save);
    }
  },
}));
vi.mock("phaser", () => ({
  Core: { Events: { DESTROY: "destroy" } },
  Game: class {
    constructor(config: unknown) {
      boot.game(config);
    }
    destroy = boot.destroy;
    pause = boot.pause;
  },
  Scale: { CENTER_HORIZONTALLY: 1, NONE: 0 },
  Scenes: { Events: { CREATE: "create" } },
  WEBGL: 2,
}));
vi.mock("./pwa/index.ts", () => ({
  gameShown: vi.fn(),
  launchPhoneApp: boot.launch,
  setupPhoneApp: vi.fn(),
}));
vi.mock("./loading/bootReveal.ts", () => ({ prepareBootReveal: boot.reveal }));
vi.mock("./loading/progress.ts", () => ({ mountLoading: vi.fn() }));
vi.mock("./lifecycle.ts", () => ({ followPageVisibility: vi.fn() }));
vi.mock("./view/frameTurn.ts", () => ({ FRAME_TURN: {} }));
vi.mock("@andornaut/game-kit/web/ui/dom/focusModality", () => ({ trackInputModality: vi.fn() }));
vi.mock("@andornaut/game-kit/web/view/dom/watchFrameTurn", () => ({
  lockGameOrientation: vi.fn(),
}));
vi.mock("@andornaut/game-kit/web/view/phaser/followFrameTurn", () => ({
  followFrameTurn: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  boot.crash = undefined;
  boot.launch.mockResolvedValue("continue");
  boot.load.mockResolvedValue({ save: { version: 12 }, status: "loaded" });
  vi.stubGlobal("document", { getElementById: () => ({ closest: () => null }) });
  vi.stubGlobal("screen", {});
  vi.stubGlobal("window", {});
});
afterEach(() => vi.unstubAllGlobals());

it("loads the canonical store before constructing the scene and preserves the complete result", async () => {
  let release!: (value: unknown) => void;
  const loading = new Promise<unknown>((resolve) => {
    release = resolve;
  });
  const enteredLoad = new Promise<void>((entered) => {
    boot.load.mockImplementation(() => {
      entered();
      return loading;
    });
  });
  const pending = import("./main.ts");
  const result = { save: { pendingInteraction: { galaxy: 1 }, version: 12 }, status: "loaded" };
  try {
    await Promise.race([enteredLoad, pending]);
    expect(boot.load).toHaveBeenCalledOnce();
    expect(boot.crash).toBeTypeOf("function");
    expect(boot.game).not.toHaveBeenCalled();
    expect(boot.scene).not.toHaveBeenCalled();
  } finally {
    release(result);
    await pending;
  }
  expect(boot.scene).toHaveBeenCalledWith(result);
  expect(boot.game).toHaveBeenCalledOnce();
});
it("does not read or construct the old game after a staged version switch", async () => {
  boot.launch.mockResolvedValue("reloading");
  await import("./main.ts");
  expect(boot.load).not.toHaveBeenCalled();
  expect(boot.game).not.toHaveBeenCalled();
});
it("permanently fences writes and prevents construction when a crash occurs during load", async () => {
  let release!: (value: unknown) => void;
  const loading = new Promise<unknown>((resolve) => {
    release = resolve;
  });
  const enteredLoad = new Promise<void>((entered) => {
    boot.load.mockImplementation(() => {
      entered();
      return loading;
    });
  });
  const pending = import("./main.ts");
  try {
    await Promise.race([enteredLoad, pending]);
    expect(boot.load).toHaveBeenCalledOnce();
    expect(boot.crash).toBeTypeOf("function");
    boot.crash!();
  } finally {
    release({ save: { version: 12 }, status: "loaded" });
    await pending;
  }
  expect(boot.blockWrites).toHaveBeenCalledWith("game crashed");
  expect(boot.game).not.toHaveBeenCalled();
});
it("keeps the same crash fence after boot and pauses the running game", async () => {
  await import("./main.ts");
  boot.crash!();
  expect(boot.blockWrites).toHaveBeenCalledWith("game crashed");
  expect(boot.pause).toHaveBeenCalledOnce();
});
