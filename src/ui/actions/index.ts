/** Action ownership and native dispatch shared by startup and gameplay. */
export {
  ADA_ACTION_HOLD_MS,
  type AdaActionOptions,
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
  createAdaFactoryHoldBinding,
  resolveAdaForegroundAction,
  resolveAdaHoldAction,
} from "./actionBinding.ts";
export {
  adaActionOwnedBy,
  adaActionRootAllows,
  registerAdaAncestorActionScope,
} from "./actionRegistry.ts";
export {
  bindAdaActionRoot,
  bindAdaRecoveryActionRoot,
  foregroundPressGuard,
} from "./holdActionsAdapter.ts";
export {
  currentView,
  enterPressView,
  inCurrentView,
  invalidatePressScope,
  rootPressGuard,
  subscribePressScope,
} from "./pressScope.ts";
