import {
  createModalLayer as createPublishedModalLayer,
  type ModalLayer,
} from "@andornaut/game-kit/runtime/web/ui/dom/modalLayer";

import { enterPressView } from "./pressScope.ts";

interface SharedLayer {
  readonly layer: ModalLayer;
  users: number;
}
const parents = new WeakMap<HTMLElement, SharedLayer>();

/** Shares published focus/inert ownership across modal siblings of one controls overlay. */
export function createModalLayer(root: HTMLElement): ModalLayer {
  const parent = root.parentElement ?? root;
  let shared = parents.get(parent);
  if (!shared) {
    shared = { layer: createPublishedModalLayer(parent), users: 0 };
    parents.set(parent, shared);
  }
  const owned = shared;
  owned.users++;
  const scopes = new Map<() => void, () => void>();
  let disposed = false;
  return {
    back: () => !disposed && owned.layer.back(),
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      owned.users--;
      for (const [release, leave] of scopes) {
        release();
        if (owned.users > 0) {
          leave();
        }
      }
      scopes.clear();
      if (owned.users === 0) {
        owned.layer.dispose();
        parents.delete(parent);
      }
    },
    open(options, dialog) {
      if (disposed) {
        return () => {};
      }
      const release = enterPressView(
        parent,
        dialog,
        options.live,
        options.close ? { backdrop: root, close: options.close } : undefined,
      );
      let leave: () => void;
      try {
        leave = owned.layer.open(options, dialog);
        scopes.set(release, leave);
      } catch (error) {
        release();
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
