// Pause, as in Chibi (art/controls.md "Pause"): a touch pause button in the view's top-left
// corner (PAUSE_BUTTON, src/ui/layout/playView.ts), and a Paused card with Resume, Travel,
// Settings and Return home stacked full width.

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
  // The frame's index in the sheet, which picks its pose.
  readonly index: number;
}

// ui-pause's frames by tag: rest, the press frames played once, and held. The sheet gives tags and
// timing only; the button draws each frame's pose from its vector art.
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
      .map(({ duration }, offset) => ({ duration, index: found.from + offset }));
  };
  return { held: tag("held"), press: tag("press"), rest: tag("rest") };
}

// The pause button's vector art per pose (art/controls.md "Pause"): rest, the press swell, and
// held, which also shows the press's second frame.
export const PAUSE_ART = {
  held: "/art/ui/icons/pause-held.svg",
  press: "/art/ui/icons/pause-press.svg",
  rest: "/art/ui/icons/pause.svg",
} as const;

export type PausePose = keyof typeof PAUSE_ART;

// The pose a ui-pause sheet frame shows: frame 0 rest, frame 1 the press swell, frames 2 and 3
// held.
export function pausePose(frame: number): PausePose {
  if (frame <= 0) {
    return "rest";
  }
  return frame === 1 ? "press" : "held";
}
