import { CAST, CAST_FRAMES, SPEAKER_CAST } from "../data/cast.ts";
import type { Mood } from "../data/conversations.ts";
import type { ConversationLineView } from "./conversation.ts";

export const COMPACT_PORTRAITS = {
  ada: { frames: 2, moods: { happy: 0, neutral: 1 }, url: "/art/portraits/ada-compact.png" },
  astra: { frames: 5, speaking: [1, 2, 3, 4], url: "/art/portraits/astra-compact.png" },
  general: {
    frames: 10,
    speaking: { named: [6, 7, 8, 9], unknown: [1, 2, 3, 4] },
    url: "/art/portraits/gadget-compact.png",
  },
  penny: {
    frames: 3,
    moods: { happy: 0, neutral: 1, upset: 2 },
    url: "/art/portraits/penny-compact.png",
  },
} as const;

/** The tab fill of a story speaker with no tab of their own, the unnamed General's. */
export const AWAITING_TAB = "#b8b3c9";

/** Each speaking frame's time. */
export const SPEAKING_FRAME_MS = 120;

/**
 * The sheet frame the box shows for line: Ada's or Penny's mood (neutral where the sheet has no
 * such mood), or Astra's or the General's speaking loop timed from the line's start, held on its
 * first frame under reduced motion.
 */
export function portraitFrame(
  reducedMotion: boolean,
  line: Pick<ConversationLineView, "elapsed" | "mood" | "named" | "speaker">,
): number {
  const loop = (frames: readonly number[]): number =>
    frames[
      reducedMotion
        ? 0
        : Math.floor((line.elapsed * 1000) / SPEAKING_FRAME_MS + 1e-9) % frames.length
    ]!;
  if (line.speaker === "ada" || line.speaker === "penny") {
    const moods: Readonly<Partial<Record<Mood, number>>> = COMPACT_PORTRAITS[line.speaker].moods;
    return moods[line.mood] ?? moods.neutral!;
  }
  if (SPEAKER_CAST[line.speaker]) {
    return CAST_FRAMES.neutral;
  }
  if (line.speaker === "astra") {
    return loop(COMPACT_PORTRAITS.astra.speaking);
  }
  return loop(COMPACT_PORTRAITS.general.speaking[line.named ? "named" : "unknown"]);
}

// Each speaker's name tab fill (art/controls.md "Conversation box").
export const TAB_COLOURS = {
  ada: "#70ace8",
  astra: "#8fe0f2",
  general: "#b8b3c9",
  generalNamed: "#d68b72",
  penny: "#feae34",
  ...Object.fromEntries(
    Object.entries(SPEAKER_CAST).map(([speaker, key]) => [speaker, CAST[key].tab]),
  ),
} as Readonly<Record<string, string>>;

/** Semantic family addresses keep their dialogue text while profiles supply the name tabs. */
export const FAMILY_PORTRAITS = {
  dad: { address: "Dad", frames: 2, name: "Bin", neutral: 1, url: "/art/portraits/mr-b.png" },
  mom: { address: "Mom", frames: 2, name: "Trista", neutral: 1, url: "/art/portraits/trista.png" },
} as const;

export function familyPortrait(name: string | undefined): keyof typeof FAMILY_PORTRAITS | null {
  return (
    (Object.keys(FAMILY_PORTRAITS) as (keyof typeof FAMILY_PORTRAITS)[]).find(
      (key) =>
        name === key ||
        name === FAMILY_PORTRAITS[key].address ||
        name === FAMILY_PORTRAITS[key].name,
    ) ?? null
  );
}

export function storySpeakerName(name: string): string {
  const family = familyPortrait(name);
  return family ? FAMILY_PORTRAITS[family].name : name;
}
