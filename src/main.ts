// The crash screen listens before any other module runs (src/crash/install.ts).
import "./crash/install.ts";
import "@andornaut/game-kit/runtime/web/view/frameTurnLandscapeGame.css";
import "./style.css";
import "@andornaut/game-kit/runtime/web/ui/dom/ui.css";
// The HTML interface's stylesheet (src/ui/stylesheet.ts, served by src/build/uiStylePlugin.ts).
import "virtual:ada-ui.css";

import { LOADER_CONFIG } from "@andornaut/game-kit/runtime/load/loaderConfig";
import type {
  LoadingAttempt,
  RequiredLoading,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { MAX_RENDER_SCALE } from "@andornaut/game-kit/runtime/view/renderScale";
import { trackInputModality } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { lockGameOrientation } from "@andornaut/game-kit/runtime/web/view/dom/watchFrameTurn";
import { followFrameTurn } from "@andornaut/game-kit/runtime/web/view/phaser/followFrameTurn";
import { Core, Game, Scale, Scenes, WEBGL } from "phaser";

import { SCREEN } from "./data/screen.ts";
import { saves } from "./game/persistence.ts";
import { GameScene } from "./game/scene.ts";
import { flushScene, refreshScene } from "./game/sceneUi.ts";
import { followPageVisibility } from "./lifecycle.ts";
import { prepareBootReveal, type RequiredBootResources } from "./loading/bootReveal.ts";
import { EntryReloadRequired } from "./loading/entryRecovery.ts";
import { requiredLoading, requiredReady } from "./loading/required.ts";
import { requireBootJets, validateBootCore } from "./loading/requiredCore.ts";
import { requireSceneFiles } from "./loading/requiredFiles.ts";
import { startupFence } from "./loading/startup.ts";
import { launchPhoneApp, requireNewerVersion, setupPhoneApp } from "./pwa/index.ts";
import { CRASH_SCREEN } from "./ui/crashScreen.ts";
import { bindAdaActionRoot } from "./ui/holdActionsAdapter.ts";
import { loadingFailureChrome } from "./ui/loadingFailure.ts";
import { rootPressGuard } from "./ui/pressScope.ts";
import { FRAME_TURN } from "./view/frameTurn.ts";

const mount = document.getElementById("game-canvas");
if (!mount) {
  throw new Error("Missing game canvas mount");
}
const parent: HTMLElement = mount;
const application = document.getElementById("app");
if (!application) {
  throw new Error("Missing application mount");
}
const ui: HTMLElement = application;
const appActions = bindAdaActionRoot(
  {
    allowNonPrimaryTouch: true,
    guard: rootPressGuard(ui),
    pointerRelease: { resolvePointer: () => undefined },
    requiredReady,
    subscribeRequired: (invalidate) => requiredLoading.subscribe(invalidate),
  },
  ui,
);

// Script focus as screens open shows the focus ring only after keyboard input (focusTarget).
trackInputModality(document);
lockGameOrientation("landscape", screen);
// At once: the browser's install prompt can come before the game has drawn anything.
setupPhoneApp();
// The crash fence is installed before asynchronous startup can enter storage.
let game: Game | undefined;
let crashed = startupFence.crashed;
CRASH_SCREEN.stopGameOnCrash(() => {
  saves.blockWrites("game crashed");
  crashed = true;
  startupFence.crashed = true;
  appActions.dispose();
  game?.pause();
});
if (crashed) {
  appActions.dispose();
  saves.blockWrites("game crashed");
}
let entry: Promise<void> | undefined;
let boot: ReturnType<typeof prepareBootReveal> | undefined;
let retirement: Promise<void> = Promise.resolve();
let saved: ReturnType<typeof saves.load> | undefined;
let launched: ReturnType<typeof launchPhoneApp> | undefined;
let cancelGame: (() => void) | undefined;
const browserEntropy = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;

/** Page resources retain successful imports, fonts and bitmaps across a failed game attempt. */
export async function prepareGame(
  required: RequiredLoading,
  attempt: LoadingAttempt,
  resources?: RequiredBootResources,
): Promise<void> {
  if (!attempt.isCurrent() || crashed) {
    return;
  }
  launched ??= launchPhoneApp(loadingFailureChrome);
  if ((await launched) !== "play" || !attempt.isCurrent() || crashed) {
    return;
  }
  boot ??= prepareBootReveal(
    { document, required, ui, ...(resources ? { resources } : {}), window },
    parent,
    () => {
      if (!game || crashed || !requiredReady()) {
        return;
      }
      const scene = game.scene.getScene("game") as GameScene;
      scene.enabled = undefined;
      refreshScene(scene);
      scene.controls.reset();
      // The first screen rendered while the play area was inert, so its default focus missed.
      scene.shell.focusUnfocusedDefault();
    },
  );
  saved ??= saves.load();
  const initial = await saved;
  if (!attempt.isCurrent() || crashed) {
    return;
  }
  // A newer-save update must remain available while required fonts or artwork are blocked.
  if (initial.status === "newer") {
    requireNewerVersion(() => {});
  }
}

/** Fallible construction and first-scene validation run inside the public loading attempt. */
export function startGame(attempt: LoadingAttempt): Promise<void> {
  entry ??= enterGame(attempt).catch((error) => {
    entry = undefined;
    throw error;
  });
  return entry;
}

export function commitGame(): void {
  if (game && !crashed && requiredReady()) {
    boot?.commit();
  }
}

export function disposeGame(): void {
  appActions.dispose();
  cancelGame?.();
  boot?.dispose();
  boot = undefined;
}

async function enterGame(attempt: LoadingAttempt): Promise<void> {
  await retirement;
  if (!attempt.isCurrent() || crashed) {
    return;
  }
  launched ??= launchPhoneApp(loadingFailureChrome);
  if ((await launched) !== "play" || !attempt.isCurrent() || crashed) {
    return;
  }
  // No save read is admitted before the existing launch/update fence.
  saved ??= saves.load();
  const initialSave = await saved;
  if (!attempt.isCurrent() || crashed) {
    return;
  }
  const scene = new GameScene(initialSave, browserEntropy);
  scene.bootUiManifest = boot?.uiManifest;
  let owned: Game | undefined;
  let constructScene: (() => void) | undefined;
  scene.entryCreate = (create) => {
    constructScene = create;
  };
  let destroyRequested: Game | undefined;
  let closed = false;
  let stopFrameTurn: (() => void) | undefined;
  let stopVisibility: (() => void) | undefined;
  let stopCreate: (() => void) | undefined;
  let createTimer: ReturnType<typeof setTimeout> | undefined;
  let resolveCreated!: () => void;
  let rejectCreated!: (error: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveCreated = resolve;
    rejectCreated = reject;
  });
  void ready.catch(() => undefined);
  const retire = (instance: Game) => {
    if (destroyRequested === instance) {
      return;
    }
    destroyRequested = instance;
    instance.pause();
    scene.controls?.setEnabled(false);
    scene.controls?.reset();
    if (requiredReady() && scene.entryCurrent()) {
      void flushScene(scene);
    }
    scene.entryCurrent = () => false;
    scene.disposeEntryResources?.();
    scene.loads?.dispose();
    if (game === instance) {
      game = undefined;
    }
    instance.destroy(true);
    // destroy is deferred to the next step, including while isPaused. Keep that step runnable.
    if (instance.isRunning) {
      instance.loop.wake();
    }
  };
  const cleanup = () => {
    if (closed) {
      return;
    }
    closed = true;
    clearTimeout(createTimer);
    stopCreate?.();
    stopVisibility?.();
    stopFrameTurn?.();
    scene.entryFailure = undefined;
    if (owned) {
      retire(owned);
    }
    rejectCreated(new Error("Game loading attempt cancelled"));
    entry = undefined;
  };
  cancelGame = cleanup;
  attempt.onCancel(cleanup);
  scene.entryCurrent = () => owned !== undefined && game === owned && !crashed;
  scene.entryFailure = (error) => {
    if (attempt.isCurrent()) {
      rejectCreated(error);
    }
  };
  scene.registerEntryCleanup = attempt.onCancel;
  const ownGame = (instance: Game) => {
    if (owned === instance) {
      return;
    }
    owned = instance;
    retirement = new Promise<void>((resolve) => {
      instance.events.once(Core.Events.DESTROY, () => {
        stopCreate?.();
        stopVisibility?.();
        stopFrameTurn?.();
        // Core DESTROY precedes renderer/canvas/loop teardown in the same stack.
        queueMicrotask(resolve);
      });
    });
    if (closed || !attempt.isCurrent()) {
      retire(instance);
      return;
    }
    game = instance;
  };
  const finishEntry = () => {
    scene.entryFailure = undefined;
  };
  const unavailableRetirement = (error: unknown) => {
    retirement = Promise.reject(error);
    void retirement.catch(() => undefined);
  };
  const created = () => {
    if (!attempt.isCurrent()) {
      return;
    }
    clearTimeout(createTimer);
    resolveCreated();
  };
  try {
    createTimer = setTimeout(
      () => rejectCreated(new Error("Required scene creation timed out")),
      LOADER_CONFIG.timeout * (LOADER_CONFIG.maxRetries + 1),
    );
    ownGame(
      new Game({
        backgroundColor: "#101010",
        callbacks: {
          postBoot(bootedGame) {
            ownGame(bootedGame);
            if (!attempt.isCurrent()) {
              return;
            }
            bootedGame.canvas.setAttribute("aria-hidden", "true");
            stopFrameTurn = followFrameTurn(
              {
                deviceResolution: { max: MAX_RENDER_SCALE },
                gameSize: bootedGame.scale.gameSize,
                parent,
                watch: FRAME_TURN,
              },
              bootedGame,
            );
            scene.events.once(Scenes.Events.CREATE, created);
            stopCreate = () => scene.events.off(Scenes.Events.CREATE, created);
          },
          preBoot: ownGame,
        },
        height: SCREEN.height,
        // The kit's loader timeout and retries; its loader watch gives each file the timeout
        // (src/game/scene.ts).
        loader: LOADER_CONFIG,
        parent,
        // A desynchronized WebGL context can present the cleared drawing buffer between frames.
        // Present completed frames through the compositor.
        render: {
          antialias: false,
          antialiasGL: false,
          desynchronized: false,
          powerPreference: "high-performance",
          roundPixels: true,
        },
        scale: { autoCenter: Scale.CENTER_HORIZONTALLY, mode: Scale.NONE },
        scene: [scene],
        // WebGL only: the build's Phaser has no Canvas renderer (src/build/phaserBuild.ts).
        type: WEBGL,
        width: SCREEN.width,
      }),
    );
    await ready;
    if (!attempt.isCurrent()) {
      return;
    }
    if (!scene.loads || !constructScene) {
      throw new Error("Required scene initialization was not prepared");
    }
    await requireSceneFiles(requiredLoading, attempt, scene.loads);
    if (!attempt.isCurrent()) {
      return;
    }
    const jets = requireBootJets(scene.cache.json);
    scene.shipJets = jets.normal;
    scene.shipRetroJets = jets.retro;
    validateBootCore(scene.cache.json, (id) => scene.textures.exists(id));
    constructScene();
    boot!.collect();
    stopVisibility = followPageVisibility(window, document, owned!.loop, scene.entryCurrent);
    finishEntry();
  } catch (error) {
    if (!owned || !owned.isRunning) {
      // Keep the constructor fence until an explicit Retry creates a fresh document.
      const terminal = new EntryReloadRequired("unavailable-retirement", error);
      unavailableRetirement(terminal);
      throw terminal;
    }
    throw error;
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(disposeGame);
}
