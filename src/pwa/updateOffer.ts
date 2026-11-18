import type { UpdateOffer as StagedUpdate } from "@andornaut/game-kit/runtime/web/pwa/buildContract";

// The in-session update offer: the kit's launch hands over each staged version once
// (onUpdateReady), on whatever screen the player is, and the game draws its Update now card,
// which pauses play while it shows. Update now saves, then switches to the staged build with no
// download; a defer continues play on the active build, and the next launch applies the update
// silently. This bridge guards the visible controls, so Update now and each defer act once per
// showing.
export interface UpdateOffer {
  accept(): void;
  defer(): void;
  // The launch's staged version, shown at once.
  offer(update: StagedUpdate): void;
  subscribe(listener: (visible: boolean) => void): () => void;
}

export interface UpdateOfferContext {
  // The game's save, awaited before the switch.
  readonly save: () => void | PromiseLike<void>;
  // True while Update now switches builds, false if the switch fails and play continues.
  readonly switching: (active: boolean) => void;
}

export function createUpdateOffer(context: UpdateOfferContext): UpdateOffer {
  let visible = false;
  let current: StagedUpdate | undefined;
  let listener: ((visible: boolean) => void) | undefined;
  const setVisible = (next: boolean) => {
    if (next !== visible) {
      visible = next;
      listener?.(visible);
    }
  };
  return {
    accept() {
      const update = current;
      if (!visible || update === undefined) {
        return;
      }
      setVisible(false);
      current = undefined;
      context.switching(true);
      // The switch reloads the page once it succeeds; a staged build that has gone keeps play on
      // the active build.
      update.updateNow(context.save).catch((error: unknown) => {
        console.warn("Update now could not switch builds.", error);
        context.switching(false);
      });
    },
    defer() {
      const update = current;
      if (!visible || update === undefined) {
        return;
      }
      setVisible(false);
      current = undefined;
      update.dismiss();
    },
    offer(update) {
      current = update;
      setVisible(true);
    },
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
