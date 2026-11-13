import { createImageCache, revealWhenDecoded } from "@andornaut/game-kit/web/ui/dom/imageReady";

import { loadingProgress } from "./progress.ts";

interface BootPage {
  readonly document: Document;
  readonly window: Pick<
    Window,
    "cancelAnimationFrame" | "fetch" | "getComputedStyle" | "requestAnimationFrame"
  >;
}

interface UiManifest {
  readonly sprites?: readonly { readonly png: string }[];
}

// Read the images the first screen actually uses, including CSS backgrounds and borders.
// The UI manifest supplies the card sheets whose hidden rules have not painted yet.
function screenImages(page: BootPage, root: HTMLElement): string[] {
  const urls = new Set<string>();
  for (const node of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    if (node.tagName === "IMG") {
      const image = node as HTMLImageElement;
      if (image.currentSrc || image.src) {
        urls.add(image.currentSrc || image.src);
      }
    }
    const style = page.window.getComputedStyle(node);
    for (const value of [style.backgroundImage, style.borderImageSource]) {
      for (const match of value.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        urls.add(new URL(match[1]!, page.document.baseURI).href);
      }
    }
  }
  return [...urls];
}

// The kit settles failed images as well as decoded ones, preserving the UI's flat fallback.
// A first visit may register offline play only after this reveal and a paint opportunity.
export function prepareBootReveal(page: BootPage, root: HTMLElement, onRevealed: () => void) {
  const cache = createImageCache(page.document);
  const progress = loadingProgress.begin();
  const abort = new AbortController();
  let sceneReady: (() => void) | undefined;
  const scene = new Promise<void>((resolve) => {
    sceneReady = resolve;
  });
  const cards = page.window
    .fetch("/art/ui/manifest.json", { signal: abort.signal })
    .then(async (response) => {
      if (!response.ok) {
        return [];
      }
      const manifest = (await response.json()) as UiManifest;
      const urls = (manifest.sprites ?? []).map(
        ({ png }) => new URL(`/art/ui/${png}`, page.document.baseURI).href,
      );
      if (!abort.signal.aborted) {
        cache.retain(urls);
      }
      return urls;
    })
    .catch(() => []);
  const urls = Promise.all([scene, cards]).then(([, cards]) =>
    abort.signal.aborted ? [] : [...cards, ...screenImages(page, root)],
  );
  const reveal = revealWhenDecoded(cache, urls, root);
  let frame: number | undefined;
  void reveal.revealed.then((shown) => {
    progress.finish();
    if (!shown || abort.signal.aborted) {
      return;
    }
    // A frame callback runs before paint. The next callback lets the revealed screen paint first.
    frame = page.window.requestAnimationFrame(() => {
      frame = page.window.requestAnimationFrame(() => {
        frame = undefined;
        if (!abort.signal.aborted) {
          onRevealed();
        }
      });
    });
  });
  return {
    dispose() {
      abort.abort();
      sceneReady?.();
      reveal.cancel();
      if (frame !== undefined) {
        page.window.cancelAnimationFrame(frame);
        frame = undefined;
      }
    },
    // Retain the decoded card sheets for later openings.
    images: cache,
    ready: () => sceneReady?.(),
  };
}
