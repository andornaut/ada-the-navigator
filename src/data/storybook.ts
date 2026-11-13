import { GALAXY_ID } from "./galaxies.ts";
import type { ArtBackground, Background, GalaxyNumber } from "./types.ts";

export type { ArtBackground, Background } from "./types.ts";

/** Each chapter's Earth scenes and their locations. */
export const CHAPTER_BACKGROUNDS: Readonly<
  Partial<
    Record<
      GalaxyNumber,
      {
        readonly closing: Background;
        readonly opening: Background;
        readonly resolution: Background;
      }
    >
  >
> = {
  1: { closing: "gardenLot", opening: "grandmaGarden", resolution: "gardenLot" },
  2: { closing: "schoolyard", opening: "schoolHallway", resolution: "schoolyard" },
  3: { closing: "park", opening: "frontDoor", resolution: "park" },
  4: { closing: "concertHall", opening: "adaRoomRecorder", resolution: "adaRoomRecorder" },
  5: {
    closing: "grandmaGardenReplanted",
    opening: "grandmaGardenSpilled",
    resolution: "grandmaGardenSpilled",
  },
  6: { closing: "adaRoomNight", opening: "adaRoom", resolution: "gardenLot" },
};

/**
 * Each location's background in Art's root manifest, by asset id (art/storybook.md). Ada's room
 * through the overnight recharge is night, asleep (a composite: the night with the sleeping
 * figures over it) and morning (a composite: Ada's waking sprite over it); the concert hall is a
 * composite with Ada's playing sprite.
 */
export const BACKGROUND_ART: Readonly<Record<ArtBackground, string>> = {
  aboard: "aboard",
  aboardEmergency: "aboard-emergency",
  adaRoom: "story-ada-room",
  adaRoomMorning: "story-ada-room-morning",
  adaRoomMorningCats: "story-ada-room-morning-cats",
  adaRoomNight: "story-ada-room-night",
  adaRoomRecorder: "story-ada-room-recorder",
  adaRoomRecorderDad: "story-ada-room-recorder-dad",
  adaRoomSleep: "story-ada-room-sleep",
  adaRoomUnpolished: "story-ada-room-unpolished",
  adaRoomUnpolishedCats: "story-ada-room-unpolished-cats",
  concertHall: "story-concert-hall",
  frontDoor: "story-front-door",
  frontDoorMom: "story-front-door-mom",
  gardenLot: "story-community-garden",
  grandmaGarden: "story-grandma-garden",
  grandmaGardenReplanted: "story-grandma-garden-replanted",
  grandmaGardenSpilled: "story-grandma-garden-spilled",
  kitchen: "story-kitchen",
  park: "story-park",
  schoolHallway: "story-school-hallway",
  schoolyard: "story-schoolyard",
};

/**
 * The overnight recharge's sleep scene (gameplay/rules.md): 2 to 3 seconds that a tap skips
 * after a moment. It lasts as long as Art's overnight sequence (story-overnight.json), or its
 * reduced-motion one; `seconds` holds while that art is missing.
 */
export const OVERNIGHT_SLEEP = { seconds: 2.5, skipAfterSeconds: 0.5 } as const;

/** Astra's speaker name. */
export const ASTRA = "Astra";

/** One galaxy in galaxy selection, after Chibi's stage cards. */
export interface GalaxyCard {
  /** Gameplay's flavor line (player-copy.md). */
  readonly flavor: string;
  /** The galaxy's numeric id. */
  readonly galaxy: GalaxyNumber;
  /** The galaxy's stable id (galaxies.ts GALAXY_ID), which also names its selector previews. */
  readonly id: string;
  readonly name: string;
  /** Whether Art has drawn its selector previews. */
  readonly preview: boolean;
}

/**
 * A galaxy's selector preview (tools/galaxy-previews.mjs): in its own field colours, or the locked greyscale.
 * CLEANUP (added 2026-11-11): recapture with `make previews` once Sunflower's light field lands
 * and once the hub and the whale (Cartwheel's and Whirlpool's first destinations) draw as art.
 */
export function galaxyPreview(galaxy: Pick<GalaxyCard, "id" | "preview">, locked: boolean): string {
  return galaxy.preview ? `/previews/galaxy-${galaxy.id}${locked ? "-locked" : ""}.png` : "";
}

/**
 * The six galaxies in route order (galaxies.ts). Needle, Andromeda and Phantom are placeholders
 * under Art's ids, so their art replaces them in place.
 */
export const GALAXIES: readonly GalaxyCard[] = [
  {
    flavor: "Scattered outposts grow, build and salvage, each on their own.",
    galaxy: 1,
    id: GALAXY_ID[1],
    name: "Sunflower",
    preview: true,
  },
  {
    flavor: "Swirling debris, and a song somewhere in the dark.",
    galaxy: 3,
    id: GALAXY_ID[3],
    name: "Whirlpool",
    preview: true,
  },
  {
    flavor: "A thin silver line of stars, where nothing can be rushed.",
    galaxy: 4,
    id: GALAXY_ID[4],
    name: "Needle",
    preview: false,
  },
  {
    flavor: "A great bright spiral, close enough to feel like a neighbor.",
    galaxy: 5,
    id: GALAXY_ID[5],
    name: "Andromeda",
    preview: false,
  },
  {
    flavor: "A busy mining hub where every rock is worth something.",
    galaxy: 2,
    id: GALAXY_ID[2],
    name: "Cartwheel",
    preview: true,
  },
  {
    flavor: "A shadowed rim where someone is watching.",
    galaxy: 6,
    id: GALAXY_ID[6],
    name: "Phantom",
    preview: true,
  },
];

/** A galaxy's selector card. */
export function galaxyCard(galaxy: GalaxyNumber): GalaxyCard {
  return GALAXIES.find((card) => card.galaxy === galaxy)!;
}
