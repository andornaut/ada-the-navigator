import {
  type ControlAvailability,
  invokeControl,
} from "@andornaut/game-kit/runtime/ui/controlPresentation";

export interface AdaAction {
  readonly availability: () => ControlAvailability;
  readonly refuse?: (reason: string) => void;
  readonly run: () => void;
}

export interface AdaActionBinding {
  readonly click: AdaAction;
  readonly hold?: AdaAction;
}

/** Caller policy only. The input dispatcher owns gesture recognition and deduplication. */
export function activateAdaAction(binding: AdaActionBinding, trigger: "click" | "hold"): boolean {
  const action = trigger === "hold" ? (binding.hold ?? binding.click) : binding.click;
  const availability = action.availability();
  if (availability.kind === "unavailable") {
    action.refuse?.(availability.reason);
    return false;
  }
  return invokeControl(availability, action.run);
}
