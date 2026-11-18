// Pause stays available during active flight. Its grid actions sort by label, then Back to title,
// then the primary Resume last.

export type PauseAction = "backToTitle" | "map" | "quests" | "resume" | "settings" | "ship";

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

// The Paused card's actions that span the grid's full width, one per row, in this order at the
// bottom: Back to title directly above the primary Resume.
export const PAUSE_FULL_WIDTH: readonly PauseAction[] = ["backToTitle", "resume"];

// The Paused card's actions in reading order: Map, Quests, Settings and Ship in the two-column
// grid sorted by their labels, then Back to title and the primary Resume, each full width. Back to
// title stays available in danger; Map still opens, where Travel here and Galaxies are
// unavailable instead.
export function pauseActions(
  labels: Readonly<Record<PauseAction, string>>,
): readonly PauseActionView[] {
  const grid = (["map", "quests", "settings", "ship"] as const)
    .map((id) => ({ available: true, id, role: "secondary" as const }))
    .sort((a, b) => labels[a.id].localeCompare(labels[b.id]));
  return [
    ...grid,
    { available: true, id: "backToTitle", role: "secondary" },
    { available: true, id: "resume", role: "primary" },
  ];
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

// The pause button's vector art per pose (art/controls.md "Pause"): rest, the press swell, and
// held, which also shows the press's second frame.
export const PAUSE_ART = {
  held: "/art/ui/icons/pause-held.svg",
  press: "/art/ui/icons/pause-press.svg",
  rest: "/art/ui/icons/pause.svg",
} as const;

export type PausePose = keyof typeof PAUSE_ART;

// The Menu button's vector art per pose (art/controls.md "Menu button"): the pause button's frame
// and poses with three bars.
export const MENU_ART: Readonly<Record<PausePose, string>> = {
  held: "/art/ui/icons/menu-held.svg",
  press: "/art/ui/icons/menu-press.svg",
  rest: "/art/ui/icons/menu.svg",
};

// The pose a ui-pause sheet frame shows: frame 0 rest, frame 1 the press swell, frames 2 and 3
// held.
export function pausePose(frame: number): PausePose {
  if (frame <= 0) {
    return "rest";
  }
  return frame === 1 ? "press" : "held";
}
