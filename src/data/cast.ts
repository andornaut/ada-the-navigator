import type { Speaker } from "./conversations.ts";

// The cast's portraits (art/conversation.md "Cast portraits") and name tabs (art/controls.md
// "Conversation box"). Each key has a 32 sheet `{key}-portrait` and a 22 compact sheet
// `{key}-portrait-compact` in its galaxy's manifest, or the core one, with the one frame
// `neutral`. Named characters show their names on name tabs in place of the copy's role labels
// (gameplay/rules.md "Species and greeters").

export type CastKey =
  | "bramble"
  | "brine"
  | "clover"
  | "coral"
  | "family"
  | "garnet"
  | "grandma"
  | "jasper"
  | "marlo"
  | "mica"
  | "nectar"
  | "opal"
  | "patch"
  | "quartz"
  | "ripple"
  | "rivet"
  | "saffron"
  | "slate";

/** Where a key's sheets live: the core portraits or a galaxy's own. */
export type CastHome = "cartwheel" | "core" | "sunflower" | "whirlpool";

export interface CastMember {
  readonly home: CastHome;
  /** The name tab's label. */
  readonly name: string;
  /** The name tab's fill. */
  readonly tab: string;
}

export const CAST: Readonly<Record<CastKey, CastMember>> = {
  bramble: { home: "sunflower", name: "Bramble", tab: "#d6e88a" },
  brine: { home: "whirlpool", name: "Brine", tab: "#7fc0f0" },
  clover: { home: "sunflower", name: "Clover", tab: "#8fd16a" },
  coral: { home: "whirlpool", name: "Coral", tab: "#f7b0c4" },
  family: { home: "whirlpool", name: "Whale family", tab: "#eadcff" },
  garnet: { home: "cartwheel", name: "Garnet", tab: "#ec8f9e" },
  grandma: { home: "core", name: "Grandma", tab: "#f0b4d0" },
  jasper: { home: "cartwheel", name: "Jasper", tab: "#f0b080" },
  marlo: { home: "whirlpool", name: "Marlo", tab: "#a59ff0" },
  mica: { home: "cartwheel", name: "Mica", tab: "#ffd36b" },
  nectar: { home: "sunflower", name: "Nectar", tab: "#ffc2d6" },
  opal: { home: "cartwheel", name: "Opal", tab: "#f5a8d8" },
  patch: { home: "sunflower", name: "Patch", tab: "#d0c0a0" },
  quartz: { home: "cartwheel", name: "Quartz", tab: "#d8ccf4" },
  ripple: { home: "whirlpool", name: "Ripple", tab: "#a8f0c8" },
  rivet: { home: "sunflower", name: "Rivet", tab: "#ff9f6b" },
  saffron: { home: "sunflower", name: "Saffron", tab: "#ffcf8f" },
  slate: { home: "cartwheel", name: "Slate", tab: "#a8c8b8" },
};

/**
 * The conversation speakers who are cast: the community projects' thank-you speakers. The
 * Cartwheel station is the hub's voice, Quartz.
 */
export const SPEAKER_CAST: Readonly<Partial<Record<Speaker, CastKey>>> = {
  grower: "clover",
  miner: "mica",
  salvager: "patch",
  station: "quartz",
  whaleFamily: "family",
  workshop: "rivet",
};

/** The story page speakers, by the name their pages give, who are cast. */
export const STORY_CAST: Readonly<Record<string, CastKey>> = { Grandma: "grandma" };

/** Every cast sheet's one frame, which the manifests name `neutral`. */
export const CAST_FRAMES = { frames: 1, neutral: 0 } as const;

/** A key's storybook sheet, or its compact sheet for the conversation box. */
export function castSheet(key: CastKey, compact: boolean): string {
  const { home } = CAST[key];
  const folder = home === "core" ? "/art/portraits" : `/art/${home}/portraits`;
  return `${folder}/${key}${compact ? "-compact" : ""}.png`;
}
