import type { RequiredLoading } from "@andornaut/game-kit/load/loadingAttempts";
import {
  createImageCache,
  PENDING_ATTRIBUTE,
  revealWhenDecoded,
} from "@andornaut/game-kit/web/ui/dom/imageReady";

import { requireBootFonts } from "./requiredFonts.ts";
import { requireBootUi } from "./requiredUi.ts";

interface BootPage {
  readonly document: Document;
  readonly required: RequiredLoading;
  readonly ui: HTMLElement;
  readonly window: Pick<
    Window,
    | "cancelAnimationFrame"
    | "clearTimeout"
    | "fetch"
    | "getComputedStyle"
    | "requestAnimationFrame"
    | "setTimeout"
  >;
}

/** Discover only the first screen's active UI images; hidden/optional world art keeps its fallback. */
function screenImages(
  page: BootPage,
  root: HTMLElement,
): { readonly url: string; readonly image?: HTMLImageElement }[] {
  const urls: { url: string; image?: HTMLImageElement }[] = [];
  const css = new Set<string>();
  for (const node of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    if (node.closest("[hidden], #boot-splash, .ada-loading, #boot-progress")) {
      continue;
    }
    const style = page.window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") {
      continue;
    }
    if (node.tagName === "IMG") {
      const image = node as HTMLImageElement;
      if (image.currentSrc || image.src) {
        urls.push({ image, url: image.currentSrc || image.src });
      }
    }
    for (const value of [style.backgroundImage, style.borderImageSource]) {
      for (const match of value.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        css.add(new URL(match[1]!, page.document.baseURI).href);
      }
    }
  }
  return [...urls, ...[...css].map((url) => ({ url }))];
}

/** Page-owned required resources survive a failed game attempt and its Retry. */
export function prepareBootReveal(page: BootPage, root: HTMLElement, onRevealed: () => void) {
  page.ui.inert = true;
  const cache = createImageCache(page.document);
  const stopFonts = requireBootFonts(page.required, {
    document: page.document,
    timer: page.window,
  });
  const ui = requireBootUi(page.required, page);
  let release!: (urls: readonly string[]) => void;
  const pending = new Promise<readonly string[]>((resolve) => {
    release = resolve;
  });
  const reveal = revealWhenDecoded(cache, pending, root);
  let disposed = false;
  let frame: number | undefined;
  void reveal.revealed.then((shown) => {
    if (!shown || disposed) {
      return;
    }
    page.ui.inert = false;
    page.document.getElementById("boot-splash")?.remove();
    frame = page.window.requestAnimationFrame(() => {
      frame = page.window.requestAnimationFrame(() => {
        frame = undefined;
        if (!disposed) {
          onRevealed();
        }
      });
    });
  });
  return {
    collect() {
      // Inspect the active screen without its temporary boot visibility rule in the same task.
      root.removeAttribute(PENDING_ATTRIBUTE);
      try {
        screenImages(page, page.ui).forEach(({ image, url }) => ui.requireImage(url, image));
      } finally {
        root.setAttribute(PENDING_ATTRIBUTE, "");
      }
    },
    commit() {
      if (!disposed && page.required.state.kind === "ready") {
        release([]);
      }
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      reveal.cancel();
      release([]);
      if (frame !== undefined) {
        page.window.cancelAnimationFrame(frame);
      }
      stopFonts();
      ui.dispose();
    },
    images: cache,
  };
}
