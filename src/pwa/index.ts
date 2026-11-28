// The game as an installable app that plays offline: the launch that installs and updates the
// build, persistent storage, the install offer, the update offer and the back gesture.
// The boot shell prepares the launch before the game downloads; setupPhoneApp runs once
// from main.ts as the page loads; the Settings Install row reads the install functions below.
//
// The launch installs the complete build before first play under the one loading bar, then plays
// from the cache. A complete staged update activates silently at the next launch, before game
// construction or save access; during a session the staged version is offered through Update now
// on any screen. A newer save is the automatic exception (requireNewerVersion).
import type { LoadingFailurePresentation } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";
import { canExitApp } from "@andornaut/game-kit/runtime/web/pwa/appWindow";
import { backCloseWatcher } from "@andornaut/game-kit/runtime/web/pwa/backNavigation";
import type {
  LaunchResult,
  NetworkPlayNotice,
} from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import {
  type BackNavigationGuard,
  browserCloseWatcher,
  createBackNavigationGuard,
} from "@andornaut/game-kit/runtime/web/pwa/dom/backNavigation";
import {
  type InstallFlow,
  type InstallOutcome,
  pageRunsAsApp,
  watchInstall,
} from "@andornaut/game-kit/runtime/web/pwa/dom/installFlow";
import {
  createLaunch,
  type LaunchContext,
  prepareBrowserLaunch,
  type RequiredUpdateState,
} from "@andornaut/game-kit/runtime/web/pwa/dom/launch";
import {
  createScreenWakeLock,
  type ScreenWakeLock,
} from "@andornaut/game-kit/runtime/web/pwa/dom/wakeLock";
import type {
  InstallState,
  InstallStepsKind,
} from "@andornaut/game-kit/runtime/web/pwa/installState";
import { requestPersistentStorage } from "@andornaut/game-kit/runtime/web/pwa/storagePersistence";

import {
  launchProgressReport,
  reportBoot,
  requiredUpdateActivity,
  updateProgressActivity,
} from "../loading/index.ts";
import { dispatchPhoneBack } from "./back/index.ts";
import { CACHE_POLICY } from "./cache/index.ts";
import { presentInstallationFailure } from "./installation/index.ts";
import { createUpdateOffer } from "./updateOffer.ts";

export { PHONE_BACK_PRESSED } from "./back/index.ts";
export type { UpdateOffer } from "./updateOffer.ts";
export type { InstallOutcome } from "@andornaut/game-kit/runtime/web/pwa/dom/installFlow";
export {
  type InstallState,
  type InstallStepsKind,
  offersInstall,
} from "@andornaut/game-kit/runtime/web/pwa/installState";

// The router service worker, which the build writes (precachePlugin).
export const SERVICE_WORKER_URL = "/sw.js";
// The history state key of the extra entry that back pops instead of leaving the game.
const BACK_GUARD_KEY = "adaBackGuard";
let flow: InstallFlow | undefined;
let launch: ReturnType<typeof createLaunch> | undefined;
type PhoneLaunch =
  | { readonly kind: "supported"; readonly result: Promise<LaunchResult> }
  | {
      readonly kind: "unsupported";
      readonly result: Promise<"unsupported">;
      dispose(): void;
    };
let preparedLaunch: PhoneLaunch | undefined;
let screenWakeLock: ScreenWakeLock | undefined;
// The forced update's state once a newer save requires it, and who hears it.
let required: RequiredUpdateState | undefined;
let onRequired: ((state: RequiredUpdateState) => void) | undefined;
// Why this document plays from the network after a first install could not complete, and who
// hears it.
let networkPlay: NetworkPlayNotice | undefined;
let onNetworkPlay: ((notice: NetworkPlayNotice) => void) | undefined;
// The game's save, which Update now awaits before it switches builds (saveBeforeUpdate).
let saveGame: () => void | PromiseLike<void> = () => undefined;

// The in-session update offer, on any screen: Update now saves, then switches to the staged
// build; a defer keeps the active build until the next launch applies the update silently.
export const updateOffer = createUpdateOffer({
  save: () => saveGame(),
});

// The page's install flow, created on first use. setupPhoneApp uses it as the page loads, since
// the browser's install prompt can come before anything is drawn.
function installFlow(): InstallFlow {
  flow ??= watchInstall(window);
  return flow;
}

// The forced update's state: "updating" while the newer version downloads, which the loading
// bar shows travelling, and "unavailable" while it cannot (offline), which the start screen shows
// as one message. The kit retries on its own and reloads once the newer version is in.
function requiredUpdate(state: RequiredUpdateState): void {
  required = state;
  requiredUpdateActivity(state);
  onRequired?.(state);
}

function createPhoneLaunch(context: LaunchContext): ReturnType<typeof createLaunch> {
  const created = createLaunch(context, {
    onFailure: presentInstallationFailure,
    onNetworkPlay(notice) {
      networkPlay = notice;
      onNetworkPlay?.(notice);
    },
    onProgress: launchProgressReport,
    onRequireNewer: requiredUpdate,
    onUpdateProgress: updateProgressActivity,
    onUpdateReady: updateOffer.offer,
    onUpdateState: () => {},
    serviceWorkerUrl: SERVICE_WORKER_URL,
    // Ada makes its sounds at runtime and ships no sound files, so the build's sounds map is
    // empty; undefined is the kit's value for a game without sounds.
    soundFormat: undefined,
  });
  // The boot preload's settled share completes the launch's one progress value.
  reportBoot((value) => created.bootProgress(value, 1));
  return created;
}

let backGuard: BackNavigationGuard | undefined;
// The separate title Exit button reads its existing app-window eligibility at launch.
let exitOffered = false;

function guardBack(): void {
  if (backGuard) {
    return;
  }
  const createCloseWatcher = backCloseWatcher(navigator.userAgent, browserCloseWatcher());
  exitOffered = canExitApp(createCloseWatcher, window);
  backGuard = createBackNavigationGuard(
    {
      createCloseWatcher,
      history: window.history,
      onBack: () => dispatchPhoneBack(window),
      stateKey: BACK_GUARD_KEY,
      timer: window,
    },
    window,
  );
  // Start and its confirmation own Back just as play does. Kit disarms after a departure.
  backGuard.setEnabled(true);
}

export function canLeaveViaBack(): boolean {
  return backGuard?.canLeave() ?? false;
}

export function leaveViaBack(): Promise<boolean> {
  return backGuard?.leave() ?? Promise.resolve(false);
}

export function disposePlatformBack(): void {
  backGuard?.dispose();
  backGuard = undefined;
}

// Sets up the install offer, the back gesture and persistent storage.
export function setupPhoneApp(): void {
  installFlow();
  guardBack();
  // Asked once per launch of the installed app, never in a browser tab. Not waited for: the game
  // runs whatever the browser answers, or if it never does.
  void requestPersistentStorage(
    pageRunsAsApp(window),
    "storage" in navigator ? navigator.storage : undefined,
  );
  screenWakeLock = createScreenWakeLock(
    window,
    document,
    "wakeLock" in navigator ? navigator.wakeLock : undefined,
  );
}

// The screen stays on during play while the page is visible (the kit's wakeLock re-requests the
// lock each time it shows), and may sleep on the start screen and the Paused card.
export function keepScreenOn(on: boolean): void {
  if (on) {
    screenWakeLock?.start();
  } else {
    screenWakeLock?.stop();
  }
}

// Whether the start screen offers Exit (its Exit and Q), as read at load: only in
// an installed app window that can close it (the kit's canExitApp), never in a browser tab or in
// an app whose platform never closes or whose history holds more than the game's entry.
export function exitShown(): boolean {
  return exitOffered;
}

// Closes the installed app's window where Exit shows; elsewhere it does nothing and never
// navigates.
export function exitGame(): void {
  if (exitShown()) {
    window.close();
  }
}

// A save written by a newer version: the game must update before it plays, so the kit installs
// the newer version and reloads into it. The save stays untouched and Start stays closed.
// onState hears the forced update's state now, if known, and on each change. Outside the
// production build, with no launch, the state is "unavailable" at once.
export function requireNewerVersion(onState: (state: RequiredUpdateState) => void): void {
  const known = required;
  onRequired = onState;
  if (known !== undefined) {
    onState(known);
  }
  if (launch) {
    launch.requireNewer();
  } else {
    requiredUpdate("unavailable");
  }
}

interface LoadingFailureChrome {
  readonly presentation: (root: HTMLElement) => LoadingFailurePresentation<"content">;
  readonly styleFrame: (frame: HTMLDivElement) => void;
}

/** Resolve production capability and share one installation attempt across the boot and game. */
export function preparePhoneLaunch(
  chrome: LoadingFailureChrome,
  parent?: HTMLElement,
): PhoneLaunch {
  if (preparedLaunch !== undefined) {
    return preparedLaunch;
  }
  if (!import.meta.env.PROD) {
    // The development server has no worker and must never use a cached production build.
    return (preparedLaunch = { kind: "supported", result: Promise.resolve("play") });
  }
  const app = parent ?? document.getElementById("app");
  if (!app) {
    throw new Error("Missing application mount");
  }
  const frame = app.ownerDocument.createElement("div");
  chrome.styleFrame(frame);
  const prepared = prepareBrowserLaunch(
    {
      failure: { presentation: chrome.presentation(app) },
      onUnsupported: () => {
        app.querySelector("#boot-progress")?.remove();
        app.ownerDocument.body.append(frame);
      },
      parent: frame,
    },
    CACHE_POLICY,
  );
  if (prepared.kind === "unsupported") {
    return (preparedLaunch = {
      dispose() {
        prepared.failure.dispose();
        frame.remove();
      },
      kind: "unsupported",
      result: Promise.resolve("unsupported"),
    });
  }
  launch = createPhoneLaunch(prepared.context);
  return (preparedLaunch = { kind: "supported", result: launch.run() });
}

/** Fallback callers share the boot result and stop before touching the save unless it is play. */
export function launchPhoneApp(
  chrome: LoadingFailureChrome,
): Promise<LaunchResult | "unsupported"> {
  return preparePhoneLaunch(chrome).result;
}

/** Check for an update in the current document, using the launch lifecycle's normal guards. */
export function requestUpdateCheck(): void {
  launch?.requestUpdateCheck();
}

// A supported launcher can fall back to network play after an install attempt. onNotice hears
// that outcome now, if known, and when it happens.
export function networkPlayNotice(onNotice: (notice: NetworkPlayNotice) => void): void {
  onNetworkPlay = onNotice;
  if (networkPlay !== undefined) {
    onNotice(networkPlay);
  }
}

// The game's save, which Update now awaits before it switches builds.
export function saveBeforeUpdate(save: () => void | PromiseLike<void>): void {
  saveGame = save;
}

// "installed" while it runs as an installed app, otherwise "prompt" while the browser holds its
// install prompt or "steps" for the browser's own install steps; offersInstall is true for both.
export function installState(): InstallState {
  return installFlow().state();
}

// Calls listener on each change of the install state until the returned function is called.
export function onInstallStateChange(listener: (state: InstallState) => void): () => void {
  return installFlow().onChange(listener);
}

// Shows the browser's install prompt, or tells the caller ("steps") to show stepsKind's steps.
// Call it from the player's tap: the browser shows its prompt only during a gesture.
export function installApp(): Promise<InstallOutcome> {
  return installFlow().install();
}

// The browser's kind, whose install steps installApp's "steps" calls for.
export function stepsKind(): InstallStepsKind {
  return installFlow().stepsKind;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => launch?.dispose());
}
