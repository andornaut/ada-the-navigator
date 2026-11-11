// The update offer, as in Chibi: the kit's update flow owns waiting workers and visit dismissal;
// this bridge guards the visible controls, so Update now and each defer act once per showing.
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

// What can cover the start screen: Settings, with its install steps in its place, or the cheats
// card that replaces it.
export type StartCover = "cheats" | "settings";

export interface StartScreen {
  cover(what: StartCover, covering: boolean): void;
  shown(shown: boolean): void;
}

// Offers belong only to the visible, uncovered start screen: onOfferVisible hears each change.
export function trackStartScreen(onOfferVisible: (visible: boolean) => void): StartScreen {
  let startShown = false;
  const covers = new Set<StartCover>();
  let last = false;
  const update = () => {
    const now = startShown && covers.size === 0;
    if (now !== last) {
      last = now;
      onOfferVisible(now);
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
      startShown = shown;
      update();
    },
  };
}
