import type { Background, SectorId } from "./types.ts";

export type { Background } from "./types.ts";

/** Each chapter's Earth scenes and their locations. */
export const CHAPTER_BACKGROUNDS: Readonly<
  Record<
    SectorId,
    { readonly closing: Background; readonly opening: Background; readonly resolution: Background }
  >
> = {
  1: { closing: "gardenLot", opening: "grandmaGarden", resolution: "gardenLot" },
  2: { closing: "schoolyard", opening: "schoolHallway", resolution: "schoolyard" },
  3: { closing: "park", opening: "frontDoor", resolution: "park" },
};

/** Each location's background in Art's root manifest, by asset id (art/storybook.md). */
export const BACKGROUND_ART: Readonly<Record<Background, string>> = {
  adaRoom: "story-ada-room",
  adaRoomUnpolished: "story-ada-room-unpolished",
  cockpit: "cockpit",
  cockpitSeated: "cockpit-seated",
  frontDoor: "story-front-door",
  gardenLot: "story-community-garden",
  grandmaGarden: "story-grandma-garden",
  park: "story-park",
  schoolHallway: "story-school-hallway",
  schoolyard: "story-schoolyard",
};

/** Galaxy selection's backdrop: Ada and Penny in their seats. */
export const SELECTOR_BACKDROP: Background = "cockpitSeated";

/** Astra's speaker name; her lens animates on cockpit pages she speaks. */
export const ASTRA = "Astra";

/** One galaxy in galaxy selection, after Chibi's stage cards. */
export interface GalaxyCard {
  readonly flavor: string;
  /** Art's galaxy id (public/art/galaxies.json), which also names its selector previews. */
  readonly id: string;
  readonly name: string;
}

/**
 * A galaxy's selector preview (tools/galaxy-previews.mjs): in its own field colours, or the locked greyscale.
 * CLEANUP (added 2026-11-11): recapture with `make previews` once Sunflower's light field lands
 * and once the hub and the whale (Cartwheel's and Whirlpool's first destinations) draw as art.
 */
export function galaxyPreview(galaxy: Pick<GalaxyCard, "id">, locked: boolean): string {
  return `/previews/galaxy-${galaxy.id}${locked ? "-locked" : ""}.png`;
}

/** Galaxies one to four, in order. Galaxy four's story is in development. */
export const GALAXIES: readonly GalaxyCard[] = [
  {
    flavor: "Scattered outposts grow, build and salvage, each on their own.",
    id: "sunflower",
    name: "Sunflower",
  },
  {
    flavor: "A busy mining hub where every rock is worth something.",
    id: "cartwheel",
    name: "Cartwheel",
  },
  {
    flavor: "Swirling debris, and a song somewhere in the dark.",
    id: "whirlpool",
    name: "Whirlpool",
  },
  { flavor: "A shadowed rim where someone is watching.", id: "black-eye", name: "Black Eye" },
];
