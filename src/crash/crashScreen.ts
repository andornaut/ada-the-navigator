// The page's crash screen (the kit's web/crash/dom/crashScreen), in the game's words and the
// interface's colours, with the message, stack and build label under ?dev=1. It writes nothing to
// the save, whose in-memory state may be corrupt, and a crash stops the game's own saving
// (src/main.ts), so the next launch resumes from the last save. src/crash/install.ts imports this
// module before any other.
import "@andornaut/game-kit/runtime/web/crash/dom/crash.css";
import "./reload.css";

import { BUTTON_GAP } from "@andornaut/game-kit/runtime/ui/spacing";
import {
  type CrashColours,
  type CrashScreen,
  installCrashScreen,
} from "@andornaut/game-kit/runtime/web/crash/dom/crashScreen";
import type { HoldActionBinding } from "@andornaut/game-kit/runtime/web/input/dom/holdActions";
import {
  listenPagePresses,
  type PagePress,
} from "@andornaut/game-kit/runtime/web/input/dom/pagePresses";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { BUILD_LABEL } from "../buildLabel.ts";
import { CRASH_COPY } from "../data/crashCopy.ts";
import { TEXT_BUTTON } from "../data/layout.ts";
import { SCREEN } from "../data/screen.ts";
import { createAdaFactoryHoldBinding } from "../ui/actionBinding.ts";
import { bindAdaRecoveryActionRoot } from "../ui/holdActionsAdapter.ts";
import { COLOURS } from "../ui/layout/colours.ts";
import { CARD_WIDTH_CAPS, SCROLL } from "../ui/layout/contentCard.ts";
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
      readonly host: HTMLElement;
      live: boolean;
      readonly root: ReturnType<typeof bindAdaRecoveryActionRoot>;
    }
  | undefined;
const metadata = new Set<() => void>();
const disposeRecovery = () => {
  const retiring = recovery;
  if (retiring) {
    retiring.live = false;
  }
  retiring?.root.invalidate();
  for (const stop of [...metadata]) {
    stop();
  }
  retiring?.root.dispose();
  recovery = undefined;
  window.removeEventListener("pagehide", onPageHide);
};
const onPageHide = (event: PageTransitionEvent) => {
  if (!event.persisted) {
    disposeRecovery();
  }
};
// Fit the landscape game to either viewport orientation before the play area exists.
const recoveryLength = (value: number) => {
  const wide = `calc(max(100vw, 100vh) * ${value} / ${SCREEN.width})`;
  const narrow = `calc(min(100vw, 100vh) * ${value} / ${SCREEN.height})`;
  return `min(${wide}, ${narrow})`;
};

// Touch can activate the native button without exposing :active before release.
function bindReloadPress(element: HTMLElement): () => void {
  const page = element.ownerDocument;
  let pointer: number | undefined;
  const clear = ({ pointerId }: PagePress) => {
    if (pointerId === pointer) {
      pointer = undefined;
      element.removeAttribute("data-ada-reload-pressed");
    }
  };
  const stop = listenPagePresses(
    (event) => pointer === undefined && event.pointerType === "touch" && event.target === element,
    {
      cancel: clear,
      down: (press) => {
        pointer = press.pointerId;
        element.setAttribute("data-ada-reload-pressed", "");
      },
      move: (press, event) => {
        if (!element.contains(page.elementFromPoint(event.clientX, event.clientY))) {
          clear(press);
        }
      },
      up: clear,
    },
    page,
  );
  return () => {
    stop();
    element.removeAttribute("data-ada-reload-pressed");
  };
}

function placeCrashActions(host: HTMLElement): void {
  const panel = host.querySelector<HTMLElement>(".crash-panel");
  if (!panel) {
    return;
  }
  const { style } = panel;
  style.setProperty("--ada-crash-panel-width", `${CARD_WIDTH_CAPS.medium}px`);
  style.setProperty("--ada-crash-action-height", `${TEXT_BUTTON.height}px`);
  style.setProperty("--ada-crash-action-inset", recoveryLength(TEXT_BUTTON.inset));
  style.setProperty("--ada-crash-action-label", `${TEXT_BUTTON.label.size}px`);
  style.setProperty("--ada-crash-action-line", `${TEXT_BUTTON.label.lineHeight}px`);
  style.setProperty("--ada-crash-action-gap", `${BUTTON_GAP}px`);
  style.setProperty("--ada-crash-secondary-face", COLOURS.secondaryFace);
  style.setProperty("--ada-crash-secondary-lip", COLOURS.secondaryLip);
  const details = panel.querySelector(".crash-details");
  const actions = details?.querySelector(".crash-actions");
  const reload = panel.querySelector<HTMLButtonElement>(
    ':scope > .crash-button[data-ui-button-role="primary"]',
  );
  if (details && actions && reload) {
    const focused = reload === host.ownerDocument.activeElement;
    // Keep Kit's native controls and put the details status before the shared action row.
    details.after(actions);
    actions.append(reload);
    if (focused && reload !== host.ownerDocument.activeElement) {
      focusTarget(reload);
    }
  }
}

const bindHoldAction: HoldActionBinding = (action) => {
  const { element } = action;
  const isReload = element.matches('.crash-button[data-ui-button-role="primary"]');
  const details = element.closest<HTMLDetailsElement>(".crash-details");
  const body = element.ownerDocument.body;
  let ancestor = element;
  while (ancestor.parentElement && ancestor.parentElement !== body) {
    ancestor = ancestor.parentElement;
  }
  const host = ancestor;
  if (host === body || host.parentElement !== body || host.getAttribute("role") !== "alertdialog") {
    throw new Error("Crash actions require their mounted recovery dialog");
  }
  if (recovery && recovery.host !== host) {
    throw new Error("Crash actions must share one recovery root");
  }
  if (!recovery) {
    recovery = {
      host,
      live: true,
      root: bindAdaRecoveryActionRoot({ guard: rootPressGuard(host) }, host),
    };
    window.addEventListener("pagehide", onPageHide);
  }
  const completed = recovery;
  const bind = createAdaFactoryHoldBinding(
    {
      current: () => host.isConnected && (details?.open ?? true),
      slopPx: () => SCROLL.dragThreshold * readViewUnit(host),
    },
    host,
  );
  const unbind = bind(action);
  const stopPress = isReload ? bindReloadPress(element) : undefined;
  const stop = () => {
    metadata.delete(stop);
    stopPress?.();
    unbind();
  };
  if (recovery !== completed || !completed.live) {
    stop();
    return () => {};
  }
  metadata.add(stop);
  if (
    metadata.size === host.querySelectorAll("button").length &&
    recovery === completed &&
    completed.live
  ) {
    completed.root.assertBindings();
    placeCrashActions(host);
  }
  return stop;
};
if (import.meta.hot) {
  import.meta.hot.dispose(disposeRecovery);
}

const pageCrash = installCrashScreen(
  {
    bindHoldAction,
    buildLabel: BUILD_LABEL,
    colours: CRASH_COLOURS,
    dev: new URLSearchParams(window.location.search).get("dev") === "1",
    words: CRASH_COPY,
  },
  window,
);

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
