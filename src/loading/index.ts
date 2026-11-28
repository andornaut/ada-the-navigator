/** Startup and progress shared by the page shell and the game. */
export { EntryReloadRequired } from "./entryRecovery.ts";
export {
  type RequiredBootResources,
  requiredLoading,
  type RequiredReady,
  requiredReady,
} from "./required.ts";
export { requireBootUi } from "./requiredUi.ts";
export { type MountStartupFailure, startLoading, startupFence } from "./startup.ts";

// Startup first imports progress after the required resource registry is initialized.
export {
  launchProgressReport,
  reportBoot,
  requiredUpdateActivity,
  subscribeLoadingProgress,
  updateProgressActivity,
  type WaitedLoad,
  waitedProgress,
} from "./progress.ts";
