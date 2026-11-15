import type { ConversationLine } from "../data/conversations.ts";
import { LANDMARK_SCAN_COPY } from "../data/landmarkScanCopy.ts";
import type { ScanOutcome } from "./scanOutcomes.ts";
import { fill } from "./shop.ts";

/** Speech uses committed outcome snapshots, never the current target or quest selection. */
export function scanOutcomeLines(outcome: ScanOutcome): readonly ConversationLine[] {
  const intro =
    outcome.source === "scan"
      ? LANDMARK_SCAN_COPY.outcomeScan
      : LANDMARK_SCAN_COPY.outcomeRemembered;
  return [
    fill(intro, { target: outcome.target.name }),
    ...outcome.completions.map((completion) =>
      completion.kind === "task"
        ? fill(LANDMARK_SCAN_COPY.outcomeTask, { task: completion.task.text })
        : fill(LANDMARK_SCAN_COPY.outcomeQuest, { quest: completion.quest.name }),
    ),
  ].map((text) => ({ speaker: "astra", text }));
}
