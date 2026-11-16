// The page's crash screen (the kit's web/crash/dom/crashScreen), in the game's words and the
// interface's colours, with the message, stack and build label under ?dev=1. It writes nothing to
// the save, whose in-memory state may be corrupt, and a crash stops the game's own saving
// (src/main.ts), so the next launch resumes from the last save. src/crash/install.ts imports this
// module before any other.
import "@andornaut/game-kit/runtime/web/crash/dom/crash.css";

import {
  type CrashColours,
  type CrashScreen,
  installCrashScreen,
} from "@andornaut/game-kit/runtime/web/crash/dom/crashScreen";
import type { HoldActionBinding } from "@andornaut/game-kit/runtime/web/input/dom/holdActions";

import { BUILD_LABEL } from "../buildLabel.ts";
import { CRASH_COPY } from "../data/crashCopy.ts";
import { createAdaFactoryHoldBinding } from "../ui/actionBinding.ts";
import { bindAdaRecoveryActionRoot } from "../ui/holdActionsAdapter.ts";
import { SCROLL } from "../ui/layout/contentCard.ts";
import { readViewUnit } from "../ui/layout/viewScale.ts";
import { rootPressGuard } from "../ui/pressScope.ts";

// Recovery uses the primary control face, lip and cream text without game resources.
export const CRASH_COLOURS: CrashColours = {
  background: "#292734",
  buttonFace: "#bfa06f",
  buttonLip: "#8a7148",
  ink: "#181425",
  text: "#ead4aa",
};

let recovery:
  | {
      readonly bind: HoldActionBinding;
      readonly host: HTMLElement;
      readonly root: ReturnType<typeof bindAdaRecoveryActionRoot>;
    }
  | undefined;
const metadata = new Set<() => void>();
const disposeRecovery = () => {
  recovery?.root.invalidate();
  for (const stop of [...metadata]) {
    stop();
  }
  recovery?.root.dispose();
  recovery = undefined;
  window.removeEventListener("pagehide", onPageHide);
};
const onPageHide = (event: PageTransitionEvent) => {
  if (!event.persisted) {
    disposeRecovery();
  }
};
const bindHoldAction: HoldActionBinding = (action) => {
  const body = action.element.ownerDocument.body;
  let host = action.element;
  while (host.parentElement && host.parentElement !== body) {
    host = host.parentElement;
  }
  if (host === body || host.parentElement !== body || host.getAttribute("role") !== "alertdialog") {
    throw new Error("Crash actions require their mounted recovery dialog");
  }
  if (recovery && recovery.host !== host) {
    throw new Error("Crash actions must share one recovery root");
  }
  if (!recovery) {
    recovery = {
      bind: createAdaFactoryHoldBinding(
        {
          current: () => host.isConnected,
          slopPx: () => SCROLL.dragThreshold * readViewUnit(host),
        },
        host,
      ),
      host,
      root: bindAdaRecoveryActionRoot({ guard: rootPressGuard(host) }, host),
    };
    window.addEventListener("pagehide", onPageHide);
  }
  const unbind = recovery.bind(action);
  const stop = () => {
    metadata.delete(stop);
    unbind();
  };
  metadata.add(stop);
  if (metadata.size === host.querySelectorAll("button").length) {
    recovery.root.assertBindings();
  }
  return stop;
};
if (import.meta.hot) {
  import.meta.hot.dispose(disposeRecovery);
}

const pageCrash = installCrashScreen(window, {
  bindHoldAction,
  buildLabel: BUILD_LABEL,
  colours: CRASH_COLOURS,
  dev: new URLSearchParams(window.location.search).get("dev") === "1",
  words: CRASH_COPY,
});

// Save fencing runs before the earlier loading teardown; the Kit owns crash admission/rendering.
const crashStops = new Set<() => void>();
pageCrash.stopGameOnCrash(() => {
  const errors: unknown[] = [];
  for (const stop of [...crashStops].reverse()) {
    try {
      stop();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, "Crash cleanup failed");
  }
});
export const CRASH_SCREEN: CrashScreen = {
  stopGameOnCrash(stop) {
    crashStops.add(stop);
  },
};
