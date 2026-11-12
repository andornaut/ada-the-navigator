import type { UpdateFlow } from "@andornaut/game-kit/web/pwa/dom/updateReady";

// The update offer, as in Chibi: the kit's update flow owns waiting workers and the dismissal,
// which lasts until the next arrival at the start screen; this bridge guards the visible
// controls, so Update now and each defer act once per showing.
export interface UpdateOffer {
  accept(): void;
  defer(): void;
  setVisible(visible: boolean): void;
  subscribe(listener: (visible: boolean) => void): () => void;
}

export function createUpdateOffer(accept: () => void, dismiss: () => void): UpdateOffer {
  let visible = false;
  let listener: ((visible: boolean) => void) | undefined;
  const setVisible = (next: boolean) => {
    if (next !== visible) {
      visible = next;
      listener?.(visible);
    }
  };
  return {
    accept() {
      if (visible) {
        setVisible(false);
        accept();
      }
    },
    defer() {
      if (visible) {
        setVisible(false);
        dismiss();
      }
    },
    setVisible,
    subscribe(next) {
      listener = next;
      next(visible);
      return () => {
        if (listener === next) {
          listener = undefined;
        }
      };
    },
  };
}

// What can cover the start screen: Settings, with its install steps in its place, the cheats
// card that replaces it, or the Achievements card.
export type StartCover = "achievements" | "cheats" | "settings";

export interface StartScreen {
  cover(what: StartCover, covering: boolean): void;
  shown(shown: boolean): void;
}

// Offers belong only to the visible, uncovered start screen: flow.setOfferVisible hears each
// change of that eligibility. Each arrival at the start screen (first launch, Back to title) is
// flow.arriveHome, which clears a dismissal and checks for a new version; a card over the start
// screen closing is no arrival. Resuming the page on the start screen is the flow's own arrival,
// through its page visibility.
export function trackStartScreen(
  flow: Pick<UpdateFlow, "arriveHome" | "setOfferVisible">,
): StartScreen {
  let startShown = false;
  const covers = new Set<StartCover>();
  let last = false;
  const update = () => {
    const now = startShown && covers.size === 0;
    if (now !== last) {
      last = now;
      flow.setOfferVisible(now);
    }
  };
  return {
    cover(what, covering) {
      if (covering) {
        covers.add(what);
      } else {
        covers.delete(what);
      }
      update();
    },
    shown(shown) {
      const arrived = shown && !startShown;
      startShown = shown;
      update();
      if (arrived) {
        flow.arriveHome();
      }
    },
  };
}
