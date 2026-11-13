import type { Speaker } from "./conversations.ts";

// The cast's portraits (art/conversation.md "Cast portraits", the station keepers in art/station.md
// "Keepers") and name tabs (art/controls.md "Conversation box"). Each key has a 32 sheet
// `{key}-portrait` and a 22 compact sheet `{key}-portrait-compact` in its galaxy's manifest, or
// the core one, with the one frame `neutral`. Named characters show their names on name tabs in
// place of the copy's role labels (gameplay/rules.md "Species and greeters").

export type CastKey =
  | "blurb-settler"
  | "dollop"
  | "loom"
  | "pip"
  | "reed"
  | "settler"
  | "bramble"
  | "brine"
  | "clover"
  | "cog"
  | "coral"
  | "dial"
  | "family"
  | "garnet"
  | "grandma"
  | "jasper"
  | "lumen"
  | "marlo"
  | "marsh"
  | "mica"
  | "nectar"
  | "opal"
  | "patch"
  | "quartz"
  | "ripple"
  | "rivet"
  | "saffron"
  | "sedge"
  | "slate"
  | "willow";

/** Where a key's sheets live: the core portraits or a galaxy's own. */
export type CastHome =
  "andromeda" | "cartwheel" | "core" | "needle" | "phantom" | "sunflower" | "whirlpool";

export interface CastMember {
  readonly home: CastHome;
  readonly frames?: number;
  readonly neutral?: number;
  /** The name tab's label. */
  readonly name: string;
  /** The name tab's fill. */
  readonly tab: string;
}

const COMMUNITY_CAST = {
  bramble: { home: "sunflower", name: "Bramble", tab: "#d6e88a" },
  brine: { home: "whirlpool", name: "Brine", tab: "#7fc0f0" },
  clover: { home: "sunflower", name: "Clover", tab: "#8fd16a" },
  cog: { home: "andromeda", name: "Cog", tab: "#a8f0c0" },
  coral: { home: "whirlpool", name: "Coral", tab: "#f7b0c4" },
  dial: { home: "andromeda", name: "Dial", tab: "#d0d8ff" },
  family: { home: "whirlpool", name: "Whale family", tab: "#eadcff" },
  garnet: { home: "cartwheel", name: "Garnet", tab: "#ec8f9e" },
  grandma: { home: "core", name: "Grandma", tab: "#f0b4d0" },
  jasper: { home: "cartwheel", name: "Jasper", tab: "#f0b080" },
  lumen: { home: "andromeda", name: "Lumen", tab: "#fde58a" },
  marlo: { home: "whirlpool", name: "Marlo", tab: "#a59ff0" },
  marsh: { home: "needle", name: "Marsh", tab: "#e0c79a" },
  mica: { home: "cartwheel", name: "Mica", tab: "#ffd36b" },
  nectar: { home: "sunflower", name: "Nectar", tab: "#ffc2d6" },
  opal: { home: "cartwheel", name: "Opal", tab: "#f5a8d8" },
  patch: { home: "sunflower", name: "Patch", tab: "#d0c0a0" },
  quartz: { home: "cartwheel", name: "Quartz", tab: "#d8ccf4" },
  ripple: { home: "whirlpool", name: "Ripple", tab: "#a8f0c8" },
  rivet: { home: "sunflower", name: "Rivet", tab: "#ff9f6b" },
  saffron: { home: "sunflower", name: "Saffron", tab: "#ffcf8f" },
  sedge: { home: "needle", name: "Sedge", tab: "#9fcf9f" },
  slate: { home: "cartwheel", name: "Slate", tab: "#a8c8b8" },
  willow: { home: "needle", name: "Willow", tab: "#d0a8e8" },
} as const;

/** Published chapter portraits, with their own sheet dimensions and neutral indices. */
export const CHAPTER_CAST = {
  "blurb-settler": { home: "phantom", name: "Blurbs", tab: "#b0c4ff" },
  dollop: { home: "phantom", name: "Dollop", tab: "#f2a6e6" },
  loom: { frames: 2, home: "needle", name: "Elder Loom", neutral: 1, tab: "#e9e3da" },
  pip: { frames: 3, home: "andromeda", name: "Pip", neutral: 1, tab: "#9fb0ff" },
  reed: { home: "needle", name: "Reed", tab: "#e3c6e8" },
  settler: { frames: 3, home: "andromeda", name: "Wick", neutral: 1, tab: "#e0b48e" },
} as const;

export const CAST: Readonly<Record<CastKey, CastMember>> = { ...COMMUNITY_CAST, ...CHAPTER_CAST };

/**
 * The conversation speakers who are cast: the community projects' thank-you speakers. The
 * Cartwheel station is the hub's voice, Quartz.
 */
export const SPEAKER_CAST: Readonly<Partial<Record<Speaker, CastKey>>> = {
  avi: "reed",
  blurbs: "blurb-settler",
  dollop: "dollop",
  elderLoom: "loom",
  grower: "clover",
  miner: "mica",
  pip: "pip",
  salvager: "patch",
  settler: "settler",
  station: "quartz",
  whaleFamily: "family",
  workshop: "rivet",
};

/** The story page speakers, by the name their pages give, who are cast. */
export const STORY_CAST: Readonly<Record<string, CastKey>> = {
  "Elder Loom": "loom",
  Grandma: "grandma",
  Pip: "pip",
  Wick: "settler",
};

/** Every cast sheet's one frame, which the manifests name `neutral`. */
export const CAST_FRAMES = { frames: 1, neutral: 0 } as const;

/** A cast sheet's declared geometry; existing single-frame portraits keep their shared default. */
export function castFrames(key: CastKey): { frames: number; neutral: number } {
  const member = CAST[key];
  return {
    frames: member.frames ?? CAST_FRAMES.frames,
    neutral: member.neutral ?? CAST_FRAMES.neutral,
  };
}

/** A key's storybook sheet, or its compact sheet for the conversation box. */
export function castSheet(key: CastKey, compact: boolean): string {
  const { home } = CAST[key];
  const folder = home === "core" ? "/art/portraits" : `/art/${home}/portraits`;
  return `${folder}/${key}${compact ? "-compact" : ""}.png`;
}
