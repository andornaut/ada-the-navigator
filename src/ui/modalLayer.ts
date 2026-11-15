import {
  createModalLayer as createPublishedModalLayer,
  type ModalLayer,
} from "@andornaut/game-kit/web/ui/dom/modalLayer";

import { enterPressView } from "./pressScope.ts";

/** Adds UI press-scope reporting without replacing the published layer's behavior. */
export function createModalLayer(root: HTMLElement): ModalLayer {
  const layer = createPublishedModalLayer(root);
  const scopes = new Set<() => void>();
  let disposed = false;
  return {
    back: () => layer.back(),
    dispose() {
      if (!disposed) {
        disposed = true;
        for (const release of scopes) {
          release();
        }
        scopes.clear();
        layer.dispose();
      }
    },
    open(options, dialog) {
      if (disposed) {
        return layer.open(options, dialog);
      }
      const release = enterPressView(root, dialog, options.live);
      scopes.add(release);
      let leave: () => void;
      try {
        leave = layer.open(options, dialog);
      } catch (error) {
        release();
        scopes.delete(release);
        throw error;
      }
      return () => {
        if (scopes.delete(release)) {
          release();
          leave();
        }
      };
    },
  };
}
