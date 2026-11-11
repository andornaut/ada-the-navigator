import type { SectorId } from "./types.ts";

/** A storybook page's location: Art's seven Earth backgrounds and the cockpit. */
export type Background =
  | "adaRoom"
  | "cockpit"
  | "frontDoor"
  | "gardenLot"
  | "grandmaGarden"
  | "park"
  | "schoolHallway"
  | "schoolyard";

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

/** One galaxy in galaxy selection, after Chibi's stage cards. */
export interface GalaxyCard {
  readonly flavor: string;
  /** The galaxy's main background hue, also the space background tint. */
  readonly hue: string;
  readonly name: string;
}

/** Galaxies one to four, in order. Galaxy four's story is in development. */
export const GALAXIES: readonly GalaxyCard[] = [
  {
    flavor: "Scattered outposts grow, build and salvage, each on their own.",
    hue: "#332712",
    name: "Sunflower",
  },
  {
    flavor: "A busy mining hub where every rock is worth something.",
    hue: "#39221e",
    name: "Cartwheel",
  },
  {
    flavor: "Swirling debris, and a song somewhere in the dark.",
    hue: "#132d33",
    name: "Whirlpool",
  },
  { flavor: "A shadowed rim where someone is watching.", hue: "#271423", name: "Black Eye" },
];
