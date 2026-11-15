import { createRequiredLoading } from "@andornaut/game-kit/runtime/load/loadingAttempts";

export type RequiredReady = () => boolean;

/** The page's required resources, including imports, fonts and UI artwork. */
export const requiredLoading = createRequiredLoading();

/** Consumers share the registry's state without retaining another readiness flag. */
export const requiredReady: RequiredReady = () => requiredLoading.state.kind === "ready";
