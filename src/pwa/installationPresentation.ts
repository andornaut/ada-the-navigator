import type { InstallationState } from "@andornaut/game-kit/runtime/web/pwa/dom/offlinePlay";

export interface InstallationPresentation {
  readonly state: InstallationState;
  readonly retry: () => Promise<void>;
}

let current: InstallationPresentation | undefined;
const listeners = new Set<(view: InstallationPresentation) => void>();

/** Relays the canonical installation owner to the page's existing failure presenter. */
export function presentInstallation(view: InstallationPresentation): void {
  current = view;
  for (const listener of listeners) {
    listener(view);
  }
}

export function observeInstallation(
  listener: (view: InstallationPresentation) => void,
): () => void {
  listeners.add(listener);
  if (current !== undefined) {
    listener(current);
  }
  return () => listeners.delete(listener);
}
