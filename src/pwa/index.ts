// The game as an installable app that plays offline: the launch that installs and updates the
// build, persistent storage, the install offer, the update offer and the back gesture.
// launchPhoneApp runs once from the boot shell before the game downloads; setupPhoneApp runs once
// from main.ts as the page loads; the Settings Install row reads the install functions below.
//
// The launch installs the complete build before first play under the one loading bar, then plays
// from the cache. A complete staged update activates silently at the next launch, before game
// construction or save access; during a session the staged version is offered through Update now
// on any screen. A newer save is the automatic exception (requireNewerVersion).
import {
  appCannotClose,
  canExitApp,
  runsInAppWindow,
} from "@andornaut/game-kit/runtime/web/pwa/appWindow";
import {
  backCloseWatcher,
  backGuardState,
  isBackGuardState,
} from "@andornaut/game-kit/runtime/web/pwa/backNavigation";
import type {
  LaunchResult,
  NetworkPlayNotice,
} from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import {
  browserCloseWatcher,
  type CloseWatcherFactory,
  guardBackNavigation,
  type HistoryLike,
} from "@andornaut/game-kit/runtime/web/pwa/dom/backNavigation";
import {
  type InstallFlow,
  type InstallOutcome,
  pageRunsAsApp,
  watchInstall,
} from "@andornaut/game-kit/runtime/web/pwa/dom/installFlow";
import {
  browserLaunchContext,
  createLaunch,
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
  updateActivationActivity,
  updateStateActivity,
} from "../loading/progress.ts";
import { CACHE_POLICY } from "./cachePolicy.ts";
import { dispatchPhoneBack } from "./events.ts";
import { presentInstallationFailure } from "./installationPresentation.ts";
import { createUpdateOffer } from "./updateOffer.ts";

export { PHONE_BACK_PRESSED } from "./events.ts";
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
let launched: Promise<LaunchResult> | undefined;
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
  switching: updateActivationActivity,
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

// The production build only, where the browser has service workers and Cache Storage: the dev
// server has no sw.js, and a worker would serve stale modules over hot reloads.
function createPhoneLaunch(): ReturnType<typeof createLaunch> | undefined {
  const context = import.meta.env.PROD ? browserLaunchContext(CACHE_POLICY) : undefined;
  if (context === undefined) {
    return undefined;
  }
  const created = createLaunch(context, {
    onFailure: presentInstallationFailure,
    onNetworkPlay(notice) {
      networkPlay = notice;
      onNetworkPlay?.(notice);
    },
    onProgress: launchProgressReport,
    onRequireNewer: requiredUpdate,
    onUpdateReady: updateOffer.offer,
    onUpdateState: updateStateActivity,
    serviceWorkerUrl: SERVICE_WORKER_URL,
    // Ada makes its sounds at runtime and ships no sound files, so the build's sounds map is
    // empty; undefined is the kit's value for a game without sounds.
    soundFormat: undefined,
  });
  // The boot preload's settled share completes the launch's one progress value.
  reportBoot((value) => created.bootProgress(value, 1));
  return created;
}

// Whether back stays on the game. The start screen with nothing open releases it; flight or an
// open card arms it again (setBackArmed).
let backArmed = true;
let backGuardInUse = () => false;
// Whether Exit shows: an installed app window that can close (canExitApp), read once at load.
let exitOffered = false;

// The page's history as the back guard sees it: while released the guard adds no entry.
const guardHistory: HistoryLike = {
  get length() {
    return history.length;
  },
  pushState(data, unused) {
    if (backArmed) {
      history.pushState(data, unused);
    }
  },
  get state() {
    return history.state as unknown;
  },
};

// Back while released is the browser's: the guard entry it popped is not replaced, so one more
// step leaves the game for the page before it. An installed app with no page before it closes,
// as Chibi's Exit does, where the platform lets it.
function releasedBack(): void {
  if (backGuardInUse()) {
    history.back();
  } else if (runsInAppWindow(window)) {
    exitGame();
  } else {
    history.back();
  }
}

// Keeps back on the game, as in Chibi: each back dispatches PHONE_BACK_PRESSED on window.
// Before the player's first input, while released, and where the browser cannot hand back to the
// game, back is the browser's own. Read before the guard pushes any entry: an installed app that
// cannot close its window keeps its own back, as in Archie, so back never leaves it on a blank
// page. A browser tab keeps the guard but never offers Exit.
function guardBack(): void {
  const createCloseWatcher: CloseWatcherFactory | undefined = backCloseWatcher(
    navigator.userAgent,
    browserCloseWatcher(),
  );
  exitOffered = canExitApp(createCloseWatcher, window);
  if (appCannotClose(createCloseWatcher, window)) {
    return;
  }
  backGuardInUse = () => createCloseWatcher === undefined || history.length > 1;
  guardBackNavigation(
    {
      createCloseWatcher,
      history: guardHistory,
      onBack: () => {
        if (backArmed) {
          dispatchPhoneBack(window);
        } else {
          releasedBack();
        }
      },
      stateKey: BACK_GUARD_KEY,
      timer: window,
    },
    window,
  );
}

// Arms or releases the back guard: released only on the start screen with nothing open. Arming
// during the player's input adds the guard entry at once, as the guard does on input.
export function setBackArmed(armed: boolean): void {
  if (armed === backArmed) {
    return;
  }
  backArmed = armed;
  const activation = (navigator as { userActivation?: { isActive: boolean } }).userActivation;
  if (
    armed &&
    backGuardInUse() &&
    (activation?.isActive ?? false) &&
    !isBackGuardState(BACK_GUARD_KEY, history.state)
  ) {
    history.pushState(backGuardState(BACK_GUARD_KEY), "");
  }
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

// Whether the start screen offers Exit (its Exit, Q and released back), as read at load: only in
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

// Installs or activates the build before the game downloads: call it first from the boot shell,
// then again before constructing the game or touching its save; every call shares one run.
// "reloading" means the page is reloading into another build, so the game must not start. A
// failed first install stays pending until Loading failed's Retry resumes it.
export function launchPhoneApp(): Promise<LaunchResult> {
  if (launched === undefined) {
    launch = createPhoneLaunch();
    launched = launch?.run() ?? Promise.resolve("play");
  }
  return launched;
}

/** Check for an update in the current document, using the launch lifecycle's normal guards. */
export function requestUpdateCheck(): void {
  launch?.requestUpdateCheck();
}

// A first install that failed for lack of service workers or storage: the game plays from the
// network this time, and the next launch tries the install again. onNotice hears it now, if
// known, and when it happens.
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
