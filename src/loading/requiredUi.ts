import { LOADER_CONFIG } from "@andornaut/game-kit/runtime/load/loaderConfig";
import {
  createLoadingAttempts,
  type RequiredLoading,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";

interface UiPage {
  readonly document: Pick<Document, "baseURI" | "createElement">;
  readonly window: Pick<Window, "clearTimeout" | "fetch" | "setTimeout">;
}

/** The UI manifest and its required bitmap sheets retain successful resources across Retry. */
export function requireBootUi(required: RequiredLoading, page: UiPage) {
  let disposed = false;
  let validatedManifest: unknown;
  const urls = new Set<string>();
  const images = new Set<HTMLImageElement>();
  const elements = new WeakSet<HTMLImageElement>();
  const releases: (() => void)[] = [];
  let finishManifest!: () => void;
  const manifestReady = new Promise<void>((resolve) => {
    finishManifest = resolve;
  });
  const requireImage = (url: string, element?: HTMLImageElement) => {
    if (element ? elements.has(element) : urls.has(url)) {
      return;
    }
    urls.add(url);
    if (element) {
      elements.add(element);
    }
    const attempts = createLoadingAttempts({
      async load(attempt) {
        const image = element ?? page.document.createElement("img");
        if (image.src !== url || attempt.id > 1) {
          image.src = url;
        }
        images.add(image);
        let timer: number | undefined;
        attempt.onCancel(() => {
          page.window.clearTimeout(timer);
          image.removeAttribute("src");
          images.delete(image);
        });
        const deadline = new Promise<never>((_, reject) => {
          timer = page.window.setTimeout(
            () => reject(new Error(`Required UI image timed out: ${url}`)),
            LOADER_CONFIG.timeout,
          );
        });
        try {
          await Promise.race([image.decode(), deadline]);
          if (attempt.isCurrent() && (!image.naturalWidth || !image.naturalHeight)) {
            throw new Error(`Required UI image has no pixels: ${url}`);
          }
        } finally {
          page.window.clearTimeout(timer);
        }
      },
      onState() {
        required.invalidate();
      },
    });
    const unobserve = required.observe({
      retry: () => attempts.retry(),
      status: () => {
        const { kind } = attempts.state;
        return kind === "ready" ? "ready" : kind === "failed" ? "failed" : "loading";
      },
    });
    releases.push(() => {
      unobserve();
      attempts.dispose();
    });
    void attempts.start();
  };
  const manifest = createLoadingAttempts({
    async load(attempt) {
      const abort = new AbortController();
      let timer: number | undefined;
      attempt.onCancel(() => {
        abort.abort();
        page.window.clearTimeout(timer);
      });
      const deadline = new Promise<never>((_, reject) => {
        timer = page.window.setTimeout(
          () => reject(new Error("Required UI manifest timed out")),
          LOADER_CONFIG.timeout,
        );
      });
      const load = async () => {
        const response = await page.window.fetch("/art/ui/manifest.json", {
          signal: abort.signal,
        });
        if (!response.ok) {
          throw new Error("Required UI manifest could not load");
        }
        const data: unknown = await response.json();
        if (!attempt.isCurrent()) {
          return;
        }
        if (
          !data ||
          typeof data !== "object" ||
          !("sprites" in data) ||
          !Array.isArray(data.sprites) ||
          data.sprites.length === 0 ||
          !("fonts" in data) ||
          !Array.isArray(data.fonts) ||
          data.fonts.length === 0
        ) {
          throw new Error("Required UI manifest has no bitmap sheets");
        }
        const paths = [...data.sprites, ...data.fonts].map((entry: unknown) => {
          if (
            !entry ||
            typeof entry !== "object" ||
            !("png" in entry) ||
            typeof entry.png !== "string" ||
            !entry.png
          ) {
            throw new Error("Required UI bitmap path is missing");
          }
          const url = new URL(`/art/ui/${entry.png}`, page.document.baseURI);
          if (!url.pathname.startsWith("/art/ui/")) {
            throw new Error("Required UI bitmap path is outside the UI package");
          }
          return url.href;
        });
        paths.forEach((url) => requireImage(url));
        validatedManifest = data;
      };
      try {
        await Promise.race([load(), deadline]);
      } finally {
        page.window.clearTimeout(timer);
      }
    },
    onReady: finishManifest,
    onState() {
      required.invalidate();
    },
  });
  const unobserve = required.observe({
    retry: () => manifest.retry(),
    status: () => {
      const { kind } = manifest.state;
      return kind === "ready" ? "ready" : kind === "failed" ? "failed" : "loading";
    },
  });
  void manifest.start();
  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      unobserve();
      manifest.dispose();
      releases.forEach((release) => release());
      images.forEach((image) => image.removeAttribute("src"));
      images.clear();
      finishManifest();
    },
    get manifest(): unknown {
      return validatedManifest;
    },
    manifestReady,
    requireImage,
    urls,
  };
}

export type RequiredUi = ReturnType<typeof requireBootUi>;
