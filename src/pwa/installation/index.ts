import type { LoadingAttemptState } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { LaunchFailure } from "@andornaut/game-kit/runtime/web/pwa/buildContract";

/** The first install's state for the page's one Loading failed presenter, and its Retry. */
export interface InstallationPresentation {
  readonly state: LoadingAttemptState;
  readonly retry: () => Promise<void>;
}

let current: InstallationPresentation | undefined;
let attempt = 0;
const listeners = new Set<(view: InstallationPresentation) => void>();
const notify = () => {
  if (current) {
    for (const listener of listeners) {
      listener(current);
    }
  }
};

/**
 * Relays a failed first install (the launch's onFailure) to the page's Loading failed presenter.
 * Retry resumes the install from the files already stored; the install reports again only if it
 * fails again. Background updates never come here: they report through UpdateState.
 */
export function presentInstallationFailure(failure: LaunchFailure): void {
  attempt += 1;
  const failed = attempt;
  current = {
    async retry() {
      if (attempt !== failed || current?.state.kind !== "failed") {
        return;
      }
      current = { retry: current.retry, state: { attempt: failed, kind: "loading" } };
      notify();
      failure.retry();
    },
    state: { attempt: failed, error: failure.reason, kind: "failed" },
  };
  notify();
}

export function observeInstallation(
  listener: (view: InstallationPresentation) => void,
): () => void {
  listeners.add(listener);
  if (current) {
    listener(current);
  }
  return () => listeners.delete(listener);
}
