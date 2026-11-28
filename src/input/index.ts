/** Input state, physical bindings and pointer capability shared with views and Scene. */
export { coarsePointer, touchControlsActive, useDiscShown } from "./coarsePointer.ts";
export {
  acceptsDesktopKeyDown,
  DESKTOP_FLIGHT_BINDINGS,
  DesktopControlState,
  type DesktopFrame,
  flightBindings,
  isMenuExitKey,
} from "./desktop.ts";
export {
  type ControlSample,
  ControlState,
  MOVE_STICK_GEOMETRY,
  type StickSide,
  stickVector,
  type Vector,
} from "./state.ts";
