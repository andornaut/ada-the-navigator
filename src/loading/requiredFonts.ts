import { LOADER_CONFIG } from "@andornaut/game-kit/runtime/load/loaderConfig";
import {
  createLoadingAttempts,
  type RequiredLoading,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";

interface FontPage {
  readonly document: Pick<Document, "fonts" | "styleSheets">;
  readonly stylesheets?: readonly HTMLLinkElement[];
  readonly timer: Pick<Window, "clearTimeout" | "setTimeout">;
}

const familyName = (family: string) => family.replaceAll(/["']/gu, "").trim();

/** Required stylesheet faces use independent retry resources without duplicate font sources. */
export function requireBootFonts(required: RequiredLoading, page: FontPage): () => void {
  const releases: (() => void)[] = [];
  const starts: (() => void)[] = [];
  let disposed = false;
  for (const weight of [400, 700]) {
    const validationWeights = new Set([weight]);
    const attempts = createLoadingAttempts({
      async load(attempt) {
        const sourceRule = (wanted: number) => {
          let source: CSSFontFaceRule | undefined;
          for (const sheet of page.document.styleSheets) {
            for (const rule of sheet.cssRules) {
              if (
                rule instanceof CSSFontFaceRule &&
                familyName(rule.style.getPropertyValue("font-family")) === "Liberation Sans" &&
                rule.style.getPropertyValue("font-weight") === String(wanted)
              ) {
                source = rule;
              }
            }
          }
          return source;
        };
        const currentFace = (wanted: number) =>
          [...page.document.fonts].find(
            (face) =>
              familyName(face.family) === "Liberation Sans" && face.weight === String(wanted),
          );
        if ([...validationWeights].some((wanted) => currentFace(wanted)?.status === "error")) {
          // Editing one rule can replace the stylesheet's other connected faces too. This
          // resource must validate both current objects before its retry can grant entry.
          validationWeights.add(400);
          validationWeights.add(700);
        }
        for (const wanted of validationWeights) {
          const source = sourceRule(wanted);
          const face = currentFace(wanted);
          if (!source || !face) {
            throw new Error(`Missing required Liberation Sans ${wanted} source`);
          }
          if (face.status === "error") {
            const sheet = source.parentStyleSheet!;
            const index = [...sheet.cssRules].indexOf(source);
            sheet.insertRule(source.cssText, index);
            sheet.deleteRule(index + 1);
          }
        }
        let timer: number | undefined;
        attempt.onCancel(() => page.timer.clearTimeout(timer));
        const deadline = new Promise<never>((_, reject) => {
          timer = page.timer.setTimeout(() => {
            reject(new Error(`Required Liberation Sans ${weight} timed out`));
          }, LOADER_CONFIG.timeout);
        });
        const load = async () => {
          await Promise.all(
            [...validationWeights].map(async (wanted) => {
              const face = currentFace(wanted)!;
              await face.load();
              if (!attempt.isCurrent()) {
                return;
              }
              const font = `${wanted} 16px "Liberation Sans"`;
              const loaded = await page.document.fonts.load(font);
              if (!attempt.isCurrent()) {
                return;
              }
              const current = currentFace(wanted);
              if (
                !current ||
                current.status !== "loaded" ||
                !loaded.includes(current) ||
                !page.document.fonts.check(font)
              ) {
                throw new Error(`Required Liberation Sans ${wanted} is not usable`);
              }
            }),
          );
        };
        try {
          await Promise.race([load(), deadline]);
        } finally {
          page.timer.clearTimeout(timer);
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
    starts.push(() => void attempts.start());
  }
  const startFonts = () => {
    if (!disposed) {
      starts.forEach((start) => start());
    }
  };
  // A failed CSS response can expose an empty stylesheet object.
  const pendingStylesheets = new Set(
    page.stylesheets?.filter((link) => !link.sheet?.cssRules.length),
  );
  for (const stylesheet of pendingStylesheets) {
    const source = createLoadingAttempts({
      async load(attempt) {
        if (attempt.id === 1) {
          throw new Error("Required font stylesheet could not load");
        }
        await new Promise<void>((resolve, reject) => {
          const replacement = stylesheet.cloneNode() as HTMLLinkElement;
          const clear = () => {
            page.timer.clearTimeout(timer);
            replacement.onload = null;
            replacement.onerror = null;
          };
          attempt.onCancel(() => {
            clear();
            replacement.remove();
          });
          replacement.onload = () => {
            if (attempt.isCurrent()) {
              clear();
              stylesheet.remove();
              resolve();
            }
          };
          replacement.onerror = () => reject(new Error("Required font stylesheet could not load"));
          const timer = page.timer.setTimeout(
            () => reject(new Error("Required font stylesheet timed out")),
            LOADER_CONFIG.timeout,
          );
          stylesheet.before(replacement);
        });
      },
      onReady() {
        pendingStylesheets.delete(stylesheet);
        if (pendingStylesheets.size === 0) {
          startFonts();
        }
      },
      onState() {
        required.invalidate();
      },
    });
    const unobserve = required.observe({
      retry: () => source.retry(),
      status: () => {
        const { kind } = source.state;
        return kind === "ready" ? "ready" : kind === "failed" ? "failed" : "loading";
      },
    });
    releases.push(() => {
      unobserve();
      source.dispose();
    });
    void source.start();
  }
  if (pendingStylesheets.size === 0) {
    startFonts();
  }
  return () => {
    if (!disposed) {
      disposed = true;
      releases.forEach((release) => release());
    }
  };
}
