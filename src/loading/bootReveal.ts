import { LOADER_CONFIG } from "@andornaut/game-kit/load/loaderConfig";
import { createImageCache, revealWhenDecoded } from "@andornaut/game-kit/web/ui/dom/imageReady";

import { loadingProgress } from "./progress.ts";

interface BootPage {
  readonly document: Document;
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
  let progress = loadingProgress.begin();
  const abort = new AbortController();
  const manifestAbort = new AbortController();
  let decodeTimer: number | undefined;
  let fallback = false;
  let sceneReady: (() => void) | undefined;
  const scene = new Promise<void>((resolve) => {
    sceneReady = resolve;
  });
  let finishCards!: (urls: readonly string[]) => void;
  const cards = new Promise<readonly string[]>((resolve) => {
    let pending = true;
    const timer = page.window.setTimeout(() => {
      manifestAbort.abort();
      console.warn("UI art manifest timed out; using visible screen art.");
      finishCards([]);
    }, LOADER_CONFIG.timeout);
    finishCards = (urls) => {
      if (pending) {
        pending = false;
        page.window.clearTimeout(timer);
        resolve(urls);
      }
    };
  });
  void page.window
    .fetch("/art/ui/manifest.json", { signal: manifestAbort.signal })
    .then(async (response) => {
      if (!response.ok || manifestAbort.signal.aborted) {
        finishCards([]);
        return;
      }
      const manifest = (await response.json()) as UiManifest;
      if (manifestAbort.signal.aborted) {
        return;
      }
      const urls = (manifest.sprites ?? []).map(
        ({ png }) => new URL(`/art/ui/${png}`, page.document.baseURI).href,
      );
      cache.retain(urls);
      finishCards(urls);
    })
    .catch(() => finishCards([]));
  const urls = Promise.all([scene, cards]).then(([, cards]) => {
    if (abort.signal.aborted) {
      return [];
    }
    // imageReady deliberately has no deadline. The game uses the loader's existing per-file
    // timeout for both the manifest (including its body) and the subsequent decode phase.
    decodeTimer = page.window.setTimeout(() => {
      fallback = true;
      console.warn("UI art decoding timed out; revealing the fallback screen.");
      reveal.cancel();
    }, LOADER_CONFIG.timeout);
    return [...cards, ...screenImages(page, root)];
  });
  const reveal = revealWhenDecoded(cache, urls, root);
  let frame: number | undefined;
  void reveal.revealed.then((shown) => {
    page.window.clearTimeout(decodeTimer);
    progress.finish();
    if ((!shown && !fallback) || abort.signal.aborted) {
      return;
    }
    page.document.getElementById("boot-splash")?.remove();
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
      manifestAbort.abort();
      finishCards([]);
      page.window.clearTimeout(decodeTimer);
      sceneReady?.();
      reveal.cancel();
      if (frame !== undefined) {
        page.window.cancelAnimationFrame(frame);
        frame = undefined;
      }
    },
    // Retain the decoded card sheets for later openings.
    images: cache,
    ready() {
      if (sceneReady) {
        // Scene assets are ready; image decoding remains real work of unknown duration.
        progress = loadingProgress.begin();
        sceneReady();
        sceneReady = undefined;
      }
    },
  };
}
