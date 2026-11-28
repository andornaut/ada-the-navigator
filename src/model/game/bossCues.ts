import {
  ANDROMEDA_REDACT,
  CARTWHEEL_CLAIM,
  CARTWHEEL_CLAIM_CUES,
  NEEDLE_CADENCE,
  SUNFLOWER_BOSS_CUES,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_BOSS_CUES,
  WHIRLPOOL_CAPITAL_BOSS,
} from "../../data/capitalBosses.ts";
import type { ConversationLine } from "../../data/conversations.ts";
import { ANDROMEDA_REDACT_CUES } from "../andromeda/redact.ts";
import { NEEDLE_CADENCE_CUES } from "../needle/runtime.ts";
import type { GalaxyProgress } from "../types.ts";

type ProgressKey = "capitalBoss" | "claim" | "redact" | "sounder";

function bossCues(
  progress: ProgressKey,
  lines: { readonly approach: ConversationLine; readonly resolved: ConversationLine },
  id: string,
) {
  return {
    active: { id: `${id}:approach`, line: lines.approach, needsVisibleBoss: true },
    progress,
    resolved: { id: `${id}:resolved`, line: lines.resolved, needsVisibleBoss: false },
  } as const;
}

const CUES = {
  1: bossCues("capitalBoss", SUNFLOWER_BOSS_CUES, SUNFLOWER_CAPITAL_BOSS.id),
  2: bossCues("claim", CARTWHEEL_CLAIM_CUES, CARTWHEEL_CLAIM.id),
  3: bossCues("sounder", WHIRLPOOL_BOSS_CUES, WHIRLPOOL_CAPITAL_BOSS.id),
  4: bossCues("capitalBoss", NEEDLE_CADENCE_CUES, NEEDLE_CADENCE.id),
  5: bossCues("redact", ANDROMEDA_REDACT_CUES, ANDROMEDA_REDACT.id),
};

export type BossCueGalaxy = keyof typeof CUES;

/** Read the authored cue for the encounter's phase. The caller admits visibility and queues it. */
export function projectBossCue(progress: GalaxyProgress, galaxy: BossCueGalaxy) {
  const cues = CUES[galaxy];
  const phase = progress[cues.progress]?.phase;
  return phase === "active" || phase === "resolved" ? cues[phase] : undefined;
}
