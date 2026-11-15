import type { LoadingAttemptState } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";
import type { AssetGroupsResult } from "@andornaut/game-kit/runtime/web/pwa/assetGroups";
import { isBuildId } from "@andornaut/game-kit/runtime/web/pwa/buildIdentity";
import {
  type AssetGroupsOptions,
  createAssetGroups,
} from "@andornaut/game-kit/runtime/web/pwa/dom/assetGroups";
import {
  type VisibilitySource,
  watchVisibility,
} from "@andornaut/game-kit/runtime/web/pwa/dom/visibility";

import type { GalaxyNumber } from "../data/types.ts";
import { galaxyDownloadGroups } from "./galaxyDownloads.ts";

interface GroupPage {
  readonly buildId: string | undefined;
  readonly container: AssetGroupsOptions["container"] & EventTarget;
  readonly eventTarget: EventTarget;
  readonly onState?: (state: LoadingAttemptState) => void;
  readonly progress: { begin(): ProgressHandle };
  readonly requestTimeoutMs: number;
  readonly visibilitySource: VisibilitySource;
}

/** One document owns the published group client and stages only durable unlocks through one route ahead. */
export function createGalaxyDownloads(page: GroupPage) {
  if (!isBuildId(page.buildId)) {
    throw new Error("Galaxy downloads require the captured release build ID");
  }
  let disposed = false,
    started = false,
    queued = false;
  let desired = galaxyDownloadGroups([]),
    signature = JSON.stringify(desired);
  let presentationAttempt = 0;
  let flight: Promise<void> | undefined;
  let operation: { key?: string; handle?: ProgressHandle } | undefined;
  const client = createAssetGroups({
    buildId: page.buildId,
    container: page.container,
    onDownloadProgress(snapshot) {
      const current = operation;
      if (disposed || !current) {
        return;
      }
      const key = JSON.stringify([snapshot.operationId, snapshot.version]);
      current.key ??= key;
      if (current.key !== key) {
        return;
      }
      current.handle ??= page.progress.begin();
      current.handle.progress(snapshot.value);
    },
    requestTimeoutMs: page.requestTimeoutMs,
  });
  const request = async (run: () => Promise<AssetGroupsResult>) => {
    const current: { key?: string; handle?: ProgressHandle } = {};
    operation = current;
    try {
      return await run();
    } finally {
      if (operation === current) {
        operation = undefined;
      }
      current.handle?.finish();
      delete current.handle;
    }
  };
  const drain = async () => {
    while (queued) {
      if (disposed) {
        return;
      }
      queued = false;
      const wanted = desired;
      // Keep one pinned request and progress owner active at a time.
      // eslint-disable-next-line no-await-in-loop
      const state = await request(() => client.readState());
      if (disposed) {
        return;
      }
      if (state.status !== "available") {
        // Before the first group transaction, missing registration belongs to installation.
        const awaitingInstallation =
          state.status === "unavailable" &&
          ["no-worker", "unsupported", "wrong-build"].includes(state.reason);
        if (presentationAttempt > 0 || !awaitingInstallation) {
          page.onState?.({ attempt: ++presentationAttempt, error: state, kind: "failed" });
        }
        continue;
      }
      if (!wanted.every((id) => state.readyGroups.includes(id))) {
        const attempt = ++presentationAttempt;
        page.onState?.({ attempt, kind: "loading" });
        // eslint-disable-next-line no-await-in-loop
        const result = await request(() => client.ensureGroups(wanted));
        if (disposed) {
          return;
        }
        page.onState?.(
          result.status === "available" && wanted.every((id) => result.readyGroups.includes(id))
            ? { attempt, kind: "ready" }
            : { attempt, error: result, kind: "failed" },
        );
      } else if (presentationAttempt > 0) {
        page.onState?.({ attempt: presentationAttempt, kind: "ready" });
      }
      // Durability/version validation belongs to the published client. A failed result is retried
      // only on another durable signature or explicit readiness/resume event, never on a timer.
    }
  };
  const resume = (): Promise<void> => {
    if (disposed || !started) {
      return Promise.resolve();
    }
    queued = true;
    flight ??= drain().finally(() => {
      flight = undefined;
      if (queued && !disposed) {
        void resume();
      }
    });
    return flight;
  };
  const visible = watchVisibility(page.eventTarget, page.visibilitySource, (shown) => {
    if (shown) {
      void resume();
    }
  });
  const ready = () => {
    void resume();
  };
  const hide = (event: Event) => {
    if (!(event as PageTransitionEvent).persisted) {
      dispose();
    }
  };
  page.container.addEventListener("controllerchange", ready);
  page.eventTarget.addEventListener("online", ready);
  page.eventTarget.addEventListener("pagehide", hide);
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    queued = false;
    visible();
    page.container.removeEventListener("controllerchange", ready);
    page.eventTarget.removeEventListener("online", ready);
    page.eventTarget.removeEventListener("pagehide", hide);
    client.dispose();
    page.onState?.({ attempt: presentationAttempt, kind: "disposed" });
    operation?.handle?.finish();
    if (operation) {
      delete operation.handle;
    }
    operation = undefined;
  };
  return {
    dispose,
    resume,
    setUnlocked(unlocked: readonly GalaxyNumber[]) {
      if (disposed) {
        return;
      }
      const next = galaxyDownloadGroups(unlocked),
        key = JSON.stringify(next);
      if (key === signature) {
        return;
      }
      desired = next;
      signature = key;
      void resume();
    },
    start() {
      if (!disposed) {
        started = true;
      }
      return resume();
    },
  };
}
