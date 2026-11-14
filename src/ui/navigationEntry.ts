/** Caller-owned game facts. A screen name alone never establishes pause permission. */
export interface NavigationActivity {
  readonly background: boolean;
  readonly dialogue: boolean;
  readonly docked: boolean;
  readonly flight: { readonly shield: number } | null;
  readonly jumping: boolean;
  readonly mapOpen: boolean;
  readonly mode: "home" | "space";
  readonly mandatoryStory: boolean;
}

export function navigationEntry(activity: NavigationActivity): "pause" | "menu" {
  return activity.mode === "space" &&
    activity.flight !== null &&
    activity.flight.shield > 0 &&
    !activity.background &&
    !activity.dialogue &&
    !activity.docked &&
    !activity.jumping &&
    !activity.mapOpen &&
    !activity.mandatoryStory
    ? "pause"
    : "menu";
}
