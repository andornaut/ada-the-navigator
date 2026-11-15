import type { LoadingAttemptState } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { InstallationState } from "@andornaut/game-kit/runtime/web/pwa/dom/offlinePlay";

export interface BackgroundLoadingPresentation {
  readonly state: LoadingAttemptState;
  readonly retry: () => Promise<void>;
}

export interface InstallationPresentation extends BackgroundLoadingPresentation {
  readonly state: InstallationState;
}

let current: InstallationPresentation | undefined;
let galaxy: BackgroundLoadingPresentation | undefined;
const listeners = new Set<(view: BackgroundLoadingPresentation) => void>();
const selected = () =>
  current?.state.kind === "failed"
    ? current
    : galaxy?.state.kind === "failed" || galaxy?.state.kind === "loading"
      ? galaxy
      : (current ?? galaxy);
const notify = () => {
  const view = selected();
  if (view) {
    for (const listener of listeners) {
      listener(view);
    }
  }
};

/** Relays the canonical installation owner to the page's existing failure presenter. */
export function presentInstallation(view: InstallationPresentation): void {
  current = view;
  notify();
}

/** Optional galaxy failures share the presenter, never the required-entry registry. */
export function presentGalaxyDownload(view: BackgroundLoadingPresentation): void {
  galaxy = view;
  notify();
}

export function observeInstallation(
  listener: (view: BackgroundLoadingPresentation) => void,
): () => void {
  listeners.add(listener);
  const view = selected();
  if (view) {
    listener(view);
  }
  return () => listeners.delete(listener);
}
