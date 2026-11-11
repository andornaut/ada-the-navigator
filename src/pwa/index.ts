// The game as an installable app that plays offline: the service worker, persistent storage, the
// install offer and the update offer. setupPhoneApp runs once from main.ts as the page loads; the
// Settings Install row reads the install functions below, and the start screen the update offer.
//
// Waiting updates activate only through the start screen's update offer, never automatically
// before input or during play.
import {
  type InstallFlow,
  type InstallOutcome,
  pageRunsAsApp,
  watchInstall,
} from "@andornaut/game-kit/web/pwa/dom/installFlow";
import {
  browserOfflinePage,
  type OfflinePlay,
  startOfflinePlay,
} from "@andornaut/game-kit/web/pwa/dom/offlinePlay";
import type { InstallState, MenuInstallBrowser } from "@andornaut/game-kit/web/pwa/installState";
import { serviceWorkerUrl } from "@andornaut/game-kit/web/pwa/serviceWorkerUrl";
import { requestPersistentStorage } from "@andornaut/game-kit/web/pwa/storagePersistence";

import {
  createUpdateOffer,
  type StartCover,
  type StartScreen,
  trackStartScreen,
} from "./updateOffer.ts";

export type { InstallOutcome } from "@andornaut/game-kit/web/pwa/dom/installFlow";
export {
  type InstallState,
  type MenuInstallBrowser,
  offersInstall,
} from "@andornaut/game-kit/web/pwa/installState";

const SERVICE_WORKER_URL = "/sw.js";
// A startup check holds the kit's boot signal for at most this long; activation remains manual.
const BOOT_WAIT_MS = 4000;

let flow: InstallFlow | undefined;
let offlinePlay: OfflinePlay | undefined;
let startScreen: StartScreen | undefined;

// The start screen's update offer: Update now switches to the waiting version and reloads; a
// defer keeps the current one until the next start-screen visit.
export const updateOffer = createUpdateOffer(
  () => offlinePlay?.flow.accept(),
  () => offlinePlay?.flow.dismissOffer(),
);

// The page's install flow, created on first use. setupPhoneApp uses it as the page loads, since
// the browser's install prompt can come before anything is drawn.
function installFlow(): InstallFlow {
  flow ??= watchInstall(window);
  return flow;
}

// The production build only: the dev server has no sw.js, and a worker would serve stale modules
// over hot reloads. A page a version controls registers now, so its update check runs while the
// game loads; a first visit registers once the game shows (gameShown), so the precache does not
// compete with the game's own downloads.
function setupOfflinePlay(): void {
  const page = import.meta.env.PROD ? browserOfflinePage() : undefined;
  if (page === undefined) {
    return;
  }
  const play = startOfflinePlay(
    {
      activationPolicy: "manual",
      bootWaitMs: BOOT_WAIT_MS,
      onUpdateShown: updateOffer.setVisible,
      serviceWorkerUrl: serviceWorkerUrl(SERVICE_WORKER_URL, undefined),
    },
    page,
  );
  offlinePlay = play;
  startScreen = trackStartScreen(play.flow.setOfferVisible);
}

// Sets up offline play, the install offer and persistent storage.
export function setupPhoneApp(): void {
  installFlow();
  setupOfflinePlay();
  // Asked once per launch of the installed app, never in a browser tab. Not waited for: the game
  // runs whatever the browser answers, or if it never does.
  void requestPersistentStorage(
    pageRunsAsApp(window),
    "storage" in navigator ? navigator.storage : undefined,
  );
}

// The game's first screen has drawn with its art loaded: a first visit registers the service
// worker now.
export function gameShown(): void {
  offlinePlay?.registrationReady();
}

// "prompt" or "menuSteps" while the game can be installed (offersInstall), "installed" while it
// runs as an installed app, otherwise "unsupported".
export function installState(): InstallState {
  return installFlow().state();
}

// Calls listener on each change of the install state until the returned function is called.
export function onInstallStateChange(listener: (state: InstallState) => void): () => void {
  return installFlow().onChange(listener);
}

// Shows the browser's install prompt, or tells the caller to show menuBrowser's steps. Call it
// from the player's tap: the browser shows its prompt only during a gesture.
export function installApp(): Promise<InstallOutcome> {
  return installFlow().install();
}

// The browser that installs only from its own menu, whose steps installApp's "menuSteps" calls for.
export function menuBrowser(): MenuInstallBrowser | undefined {
  return installFlow().menuBrowser;
}

// A new start-screen visit, as the start screen appears: a deferred offer may show again.
export function beginStartUpdateVisit(): void {
  offlinePlay?.flow.beginOfferVisit();
}

// Whether the start screen shows; the update offer appears only there.
export function startScreenShown(shown: boolean): void {
  startScreen?.shown(shown);
}

// Settings or the cheats card covering the start screen suppress the offer without deferring it.
export function coverStartScreen(what: StartCover, covering: boolean): void {
  startScreen?.cover(what, covering);
}
