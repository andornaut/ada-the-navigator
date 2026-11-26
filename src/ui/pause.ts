import type { PausePose } from "./layout/navigationButton.ts";

export { MENU_ART, PAUSE_ART, type PausePose } from "./layout/navigationButton.ts";

// Pause stays available during active flight, with fixed Settings and exit actions on the right.

export type PauseAction =
  "achievements" | "backToTitle" | "cheats" | "map" | "quests" | "resume" | "settings" | "ship";

/** Where the Paused card opens: only in flight. */
export type PausePlace = "flight";

export interface PauseActionView {
  // Whether the action acts; an unavailable one shows the disabled face and refuses.
  readonly available: boolean;
  readonly id: PauseAction;
  readonly role: "primary" | "secondary";
}

/**
 * The local map's Galaxies: unavailable while Ada is in danger, when it refuses with the shared
 * cue. Unlike Travel here, towing never refuses it.
 */
export function galaxiesAvailable(inDanger: boolean): boolean {
  return !inDanger;
}

export const PAUSE_RIGHT_ACTIONS: readonly PauseAction[] = [
  "achievements",
  "settings",
  "backToTitle",
  "resume",
];

// DOM and keyboard order run down the alphabetical left column, then down the fixed right column.
// Back to title stays available in danger; Map still opens, where Travel here and Galaxies are
// unavailable instead.
export function pauseActions(
  labels: Readonly<Record<PauseAction, string>>,
): readonly PauseActionView[] {
  const left = (["cheats", "map", "quests", "ship"] as const)
    .slice()
    .sort((a, b) => labels[a].localeCompare(labels[b]));
  return [...left, ...PAUSE_RIGHT_ACTIONS].map((id) => ({
    available: true,
    id,
    role: id === "resume" ? "primary" : "secondary",
  }));
}

// The Map card says no destinations are mapped yet until a place is discovered.
export function mapShowsEmpty(places: readonly unknown[]): boolean {
  return places.length === 0;
}

// Both pointer modes keep Pause visible during gameplay when no card covers it.
export function pauseButtonShown(_coarse: boolean, pausable: boolean, cardOpen: boolean): boolean {
  return pausable && !cardOpen;
}

// What Escape does once no card is left to close: pause where the card opens, Settings where its
// own button shows (the start screen), otherwise nothing.
export function escapeTarget(
  pausable: boolean,
  settingsButton: boolean,
): "none" | "pause" | "settings" {
  if (pausable) {
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

// The pose a ui-pause sheet frame shows: frame 0 rest, frame 1 the press swell, frames 2 and 3
// held.
export function pausePose(frame: number): PausePose {
  if (frame <= 0) {
    return "rest";
  }
  return frame === 1 ? "press" : "held";
}
