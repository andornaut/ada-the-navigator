// Pause, as in Chibi (art/controls.md "Pause"): a touch pause button in the view's top-left
// corner, and a Paused card with Resume, Travel, Settings and Return home stacked full width.

export type PauseAction = "resume" | "returnHome" | "settings" | "travel";

export interface PauseActionView {
  // Whether the action acts; an unavailable one shows the disabled face and refuses.
  readonly available: boolean;
  readonly id: PauseAction;
  readonly role: "primary" | "secondary";
}

// The Paused card's actions, top to bottom. In danger, Travel and Return home are unavailable.
export function pauseActions(inDanger: boolean): readonly PauseActionView[] {
  return [
    { available: true, id: "resume", role: "primary" },
    { available: !inDanger, id: "travel", role: "secondary" },
    { available: true, id: "settings", role: "secondary" },
    { available: !inDanger, id: "returnHome", role: "secondary" },
  ];
}

// The Travel card lists the discovered destinations, or says none are mapped yet.
export function travelShowsEmpty(destinations: readonly unknown[]): boolean {
  return destinations.length === 0;
}

// The pause button: a 35px frame whose disc edge sits 8px in from the view's top and left (the
// disc is drawn 1px inside its frame), in a 52.5px press area centred on the frame.
export const PAUSE_BUTTON = { edge: 8, frame: 35, press: 52.5 } as const;

export function pauseButtonPlacement(): { readonly frame: number; readonly press: number } {
  const frame = PAUSE_BUTTON.edge - 1;
  return { frame, press: frame - (PAUSE_BUTTON.press - PAUSE_BUTTON.frame) / 2 };
}

// The pause button is a touch control shown only in flight; on a fine pointer Escape pauses.
export function pauseButtonShown(coarse: boolean, inFlight: boolean, cardOpen: boolean): boolean {
  return coarse && inFlight && !cardOpen;
}

// What Escape does once no card is left to close: pause in flight, Settings where its own button
// shows (the start screen), otherwise nothing.
export function escapeTarget(
  inFlight: boolean,
  settingsButton: boolean,
): "none" | "pause" | "settings" {
  if (inFlight) {
    return "pause";
  }
  return settingsButton ? "settings" : "none";
}

interface PauseSheet {
  readonly frames: Readonly<
    Record<string, { readonly duration: number; readonly frame: { readonly x: number } }>
  >;
  readonly meta: {
    readonly frameTags: readonly {
      readonly from: number;
      readonly name: string;
      readonly to: number;
    }[];
  };
}

export interface PauseFrame {
  readonly duration: number;
  readonly x: number;
}

// ui-pause's frames by tag: rest, the press frames played once, and held.
export function pauseFrames(
  sheet: PauseSheet,
): Readonly<Record<"held" | "press" | "rest", readonly PauseFrame[]>> {
  const frames = Object.values(sheet.frames);
  const tag = (name: string): PauseFrame[] => {
    const found = sheet.meta.frameTags.find((entry) => entry.name === name);
    if (!found) {
      return [];
    }
    return frames
      .slice(found.from, found.to + 1)
      .map(({ duration, frame }) => ({ duration, x: frame.x }));
  };
  return { held: tag("held"), press: tag("press"), rest: tag("rest") };
}
