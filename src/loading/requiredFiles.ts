import {
  createLoadingAttempts,
  type LoadingAttempt,
  type RequiredLoading,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";

import { TOUCH_CHROME_SHEETS } from "../data/layout.ts";
import { SHIP_HEADINGS } from "../model/shipHeadingContract.ts";

const core = new Set([
  "art-manifest",
  "ship-materials",
  "ship-material-palettes",
  "quantum-jump",
  "title-screen",
  "ship-jets",
  "ship-retro-jets",
  "ui-manifest",
  "ship",
  ...Object.values(TOUCH_CHROME_SHEETS),
]);

/** Required loader keys name active core/player/UI resources; optional world art keeps automatic retries. */
export function requiredSceneFile(failure: { readonly key: string }): boolean {
  if (core.has(failure.key)) {
    return true;
  }
  const heading = /^ship-(\d+)$/u.exec(failure.key);
  return heading !== null && Number(heading[1]) < SHIP_HEADINGS;
}

/** The real loader keeps successful files and retries only required failures before scene construction. */
export async function requireSceneFiles(
  required: RequiredLoading,
  owner: LoadingAttempt,
  watch: {
    failures(): readonly { readonly key: string }[];
    retryFailures(select: (failure: { readonly key: string }) => boolean): Promise<void>;
  },
): Promise<void> {
  let resolve!: () => void, reject!: (error: unknown) => void;
  const ready = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const attempts = createLoadingAttempts({
    async load(attempt) {
      if (attempt.id > 1) {
        await watch.retryFailures(requiredSceneFile);
      }
      if (!attempt.isCurrent()) {
        return;
      }
      if (watch.failures().some(requiredSceneFile)) {
        throw new Error("Required scene files could not load");
      }
    },
    onReady: () => resolve(),
    onState: () => required.invalidate(),
  });
  const unobserve = required.observe({
    retry: () => attempts.retry(),
    status: () =>
      attempts.state.kind === "ready"
        ? "ready"
        : attempts.state.kind === "failed"
          ? "failed"
          : "loading",
  });
  const cancel = owner.onCancel(() => {
    unobserve();
    attempts.dispose();
    reject(new Error("Required scene files cancelled"));
  });
  try {
    await attempts.start();
    await ready;
  } finally {
    cancel();
    unobserve();
    attempts.dispose();
  }
}
