import {
  type VisibilitySource,
  watchVisibility,
} from "@andornaut/game-kit/runtime/web/pwa/dom/visibility";

export interface LoopControl {
  sleep(): void;
  wake(): void;
}

export function followPageVisibility(
  page: EventTarget,
  document: VisibilitySource,
  loop: LoopControl,
  active: () => boolean = () => true,
): () => void {
  const stop = watchVisibility(page, document, (visible) => {
    if (!active()) {
      return;
    }
    if (visible) {
      loop.wake();
    } else {
      loop.sleep();
    }
  });
  if (active() && document.visibilityState === "hidden") {
    loop.sleep();
  }
  return stop;
}
