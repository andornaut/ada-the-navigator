// The game as an installable app that plays offline: the service worker, persistent storage, the
// install offer, the update offer and the back gesture. setupPhoneApp runs once from main.ts as
// the page loads; the Settings Install row reads the install functions below, and the start
// screen the update offer and the back guard's arming.
//
// The game starts at once from the version on disk. A newer version downloads in the background
// and activates only through the start screen's update offer, never on its own; a save written
// by a newer version requires it (requireNewerVersion).
import { appCannotClose } from "@andornaut/game-kit/web/pwa/appWindow";
import {
  backCloseWatcher,
  backGuardState,
  isBackGuardState,
} from "@andornaut/game-kit/web/pwa/backNavigation";
import {
  browserCloseWatcher,
  type CloseWatcherFactory,
  guardBackNavigation,
  type HistoryLike,
} from "@andornaut/game-kit/web/pwa/dom/backNavigation";
import { browserExitPage, exitApp } from "@andornaut/game-kit/web/pwa/dom/exitApp";
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
import {
  createScreenWakeLock,
  type ScreenWakeLock,
} from "@andornaut/game-kit/web/pwa/dom/wakeLock";
import type { InstallState, InstallStepsKind } from "@andornaut/game-kit/web/pwa/installState";
import { serviceWorkerUrl } from "@andornaut/game-kit/web/pwa/serviceWorkerUrl";
import { requestPersistentStorage } from "@andornaut/game-kit/web/pwa/storagePersistence";
import type { RequiredUpdateState } from "@andornaut/game-kit/web/pwa/updateReady";

import { offlineActivity, requiredUpdateActivity } from "../loading/progress.ts";
import { dispatchPhoneEvent, PHONE_EVENTS } from "./events.ts";
import {
  createUpdateOffer,
  type StartCover,
  type StartScreen,
  trackStartScreen,
} from "./updateOffer.ts";

export { PHONE_EVENTS } from "./events.ts";
export type { InstallOutcome } from "@andornaut/game-kit/web/pwa/dom/installFlow";
export {
  type InstallState,
  type InstallStepsKind,
  offersInstall,
} from "@andornaut/game-kit/web/pwa/installState";

const SERVICE_WORKER_URL = "/sw.js";
// The history state key of the extra entry that back pops instead of leaving the game.
const BACK_GUARD_KEY = "adaBackGuard";
let flow: InstallFlow | undefined;
let offlinePlay: OfflinePlay | undefined;
let startScreen: StartScreen | undefined;
let screenWakeLock: ScreenWakeLock | undefined;
// The forced update's state once a newer save requires it, and who hears it.
let required: RequiredUpdateState | undefined;
let onRequired: ((state: RequiredUpdateState) => void) | undefined;

// The start screen's update offer: Update now switches to the waiting version and reloads; a
// defer keeps the current one until the next arrival at the start screen.
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

// The forced update's state: "updating" while the newer version downloads, which the loading
// bar shows travelling, and "unavailable" while it cannot (offline), which the start screen shows
// as one message. The kit retries on its own and reloads once the newer version is in.
function requiredUpdate(state: RequiredUpdateState): void {
  required = state;
  requiredUpdateActivity(state);
  onRequired?.(state);
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
      onOfflineActivity: offlineActivity,
      onRequireNewer: requiredUpdate,
      onUpdateShown: updateOffer.setVisible,
      serviceWorkerUrl: serviceWorkerUrl(SERVICE_WORKER_URL, undefined),
    },
    page,
  );
  offlinePlay = play;
  startScreen = trackStartScreen(play.flow);
}

// Whether back stays on the game. The start screen with nothing open releases it; flight or an
// open card arms it again (setBackArmed).
let backArmed = true;
let backGuardInUse = () => false;
// Whether the game offers to leave, read once at load (exitShown).
let leaveOffered = false;

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
  } else if (pageRunsAsApp(window)) {
    exitGame();
  } else {
    history.back();
  }
}

// Keeps back on the game, as in Chibi: each back dispatches PHONE_EVENTS.backPressed on window.
// Before the player's first input, while released, and where the browser cannot hand back to the
// game, back is the browser's own. Read before the guard pushes any entry: an installed app that
// cannot close its window (exitShown false) keeps its own back, as in Archie, so back never leaves
// it on a blank page.
function guardBack(): void {
  const createCloseWatcher: CloseWatcherFactory | undefined = backCloseWatcher(
    navigator.userAgent,
    browserCloseWatcher(),
  );
  leaveOffered = !appCannotClose(createCloseWatcher, window);
  if (!leaveOffered) {
    return;
  }
  backGuardInUse = () => createCloseWatcher === undefined || history.length > 1;
  guardBackNavigation(
    {
      onBack: () => {
        if (backArmed) {
          dispatchPhoneEvent(window, PHONE_EVENTS.backPressed);
        } else {
          releasedBack();
        }
      },
      stateKey: BACK_GUARD_KEY,
    },
    window,
    window,
    createCloseWatcher,
    guardHistory,
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

// Sets up offline play, the install offer, the back gesture and persistent storage.
export function setupPhoneApp(): void {
  installFlow();
  setupOfflinePlay();
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

// Whether the game offers to leave (the start screen's Exit, Q and released back), as read at
// load: in a browser tab, which goes to the site's home page, and in an installed app that can
// close its window, which closes; never in another installed app (the kit's appCannotClose: an
// app whose platform never closes, or whose history holds more than the game's entry).
export function exitShown(): boolean {
  return leaveOffered;
}

// Leaves the game: an installed app's window closes, a browser tab goes to the site's home page.
export function exitGame(): void {
  exitApp(browserExitPage());
}

// A save written by a newer version: the game must update before it plays, so the kit installs
// the newer version and reloads into it. The save stays untouched and Start stays closed.
// onState hears the forced update's state now, if known, and on each change. Outside the
// production build, with no service worker, the state is "unavailable" at once.
export function requireNewerVersion(onState: (state: RequiredUpdateState) => void): void {
  const known = required;
  onRequired = onState;
  if (known !== undefined) {
    onState(known);
  }
  if (offlinePlay) {
    offlinePlay.flow.requireNewer();
  } else {
    requiredUpdate("unavailable");
  }
}

// The game's first screen has drawn with its art loaded: a first visit registers the service
// worker now.
export function gameShown(): void {
  offlinePlay?.registrationReady();
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

// Whether the start screen shows; the update offer appears only there, and each time it starts
// showing is an arrival that offers a waiting version again.
export function startScreenShown(shown: boolean): void {
  startScreen?.shown(shown);
}

// Settings or the cheats card covering the start screen suppress the offer without deferring it.
export function coverStartScreen(what: StartCover, covering: boolean): void {
  startScreen?.cover(what, covering);
}
