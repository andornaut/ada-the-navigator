import { type VisibilitySource, watchVisibility } from "@andornaut/game-kit/web/pwa/dom/visibility";

export interface LoopControl {
  sleep(): void;
  wake(): void;
}

export function followPageVisibility(
  page: EventTarget,
  document: VisibilitySource,
  loop: LoopControl,
): () => void {
  const stop = watchVisibility(page, document, (visible) => {
    if (visible) {
      loop.wake();
    } else {
      loop.sleep();
    }
  });
  if (document.visibilityState === "hidden") {
    loop.sleep();
  }
  return stop;
}
