import {
  type ControlAvailability,
  invokeControl,
} from "@andornaut/game-kit/ui/controlPresentation";

export interface AdaAction {
  readonly availability: () => ControlAvailability;
  readonly run: () => void;
}

export interface AdaActionBinding {
  readonly click: AdaAction;
  readonly hold?: AdaAction;
}

/** Caller policy only. The input dispatcher owns gesture recognition and deduplication. */
export function activateAdaAction(binding: AdaActionBinding, trigger: "click" | "hold"): boolean {
  const action = trigger === "hold" ? (binding.hold ?? binding.click) : binding.click;
  return invokeControl(action.availability(), action.run);
}
