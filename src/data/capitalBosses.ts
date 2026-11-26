import { CAPITAL_CAPTAINS } from "./capitalCaptains.ts";
import type { ConversationLine } from "./conversations.ts";

/** Shared model-to-view contract for the current authored capital encounter. */
export interface CapitalBossHud {
  readonly id: string;
  readonly ship: string;
  readonly captain: string;
  readonly hull: number;
  readonly maxHull: number;
  readonly disabled: boolean;
}

export const SUNFLOWER_CAPITAL_BOSS = {
  cacheId: "boss:sunflower:repair-cache",
  captain: CAPITAL_CAPTAINS.captainTally.name,
  chartLabel: { cache: "Safer route and supply cache", route: "Safer route" },
  id: "boss:sunflower:hammer",
  routeId: "boss:sunflower:detour",
  ship: "Hammer",
} as const;

export const SUNFLOWER_BOSS_CUES = {
  approach: {
    speaker: "captainTally",
    text: "Food, parts, repairs. I counted three outposts. I didn't count on them working together.",
  },
  hardpoint: {
    speaker: "astra",
    text: "That's one hardpoint down. The others are still live.",
  },
  resolved: {
    speaker: "astra",
    text: "The patrol's clear. I marked a supply cache and a safer route between the outposts.",
  },
} as const satisfies Record<string, ConversationLine>;

export const WHIRLPOOL_CAPITAL_BOSS = {
  captain: CAPITAL_CAPTAINS.captainSounder.name,
  id: "route:holodisk:sounder",
  ship: "Manta Dreadnought",
  swarmPack: "route:holodisk:sounder:pack",
} as const;

export const WHIRLPOOL_BOSS_CUES = {
  approach: {
    speaker: "captainSounder",
    text: "I followed their calls. Stay out of this current.",
  },
  hardpoint: {
    speaker: "astra",
    text: "One hardpoint down. Ride the current around the escorts.",
  },
  resolved: {
    speaker: "astra",
    text: "Sounder's out of the way. The disk is where the family said it would be.",
  },
} as const satisfies Record<string, ConversationLine>;
