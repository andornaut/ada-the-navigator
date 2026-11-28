import type { ConversationLine } from "../data/conversations.ts";
import { LANDMARK_SCAN_COPY } from "../data/landmarkScanCopy.ts";
import type { ScanOutcome } from "./scanOutcomes.ts";
import { fill } from "./shop.ts";

/** Speech uses committed outcome snapshots, never the current target or quest selection. */
export function scanOutcomeLines(outcome: ScanOutcome): readonly ConversationLine[] {
  const recoveredWreck = outcome.source === "scan" && outcome.wreckRecovered === true;
  const intro =
    outcome.source === "remembered"
      ? LANDMARK_SCAN_COPY.outcomeRemembered
      : recoveredWreck
        ? LANDMARK_SCAN_COPY.outcomeRecoveredWreck
        : LANDMARK_SCAN_COPY.outcomeScan;
  const lead =
    outcome.leadStation !== undefined
      ? fill(LANDMARK_SCAN_COPY.outcomeLead, { station: outcome.leadStation })
      : outcome.actionLead?.kind === "patrol"
        ? LANDMARK_SCAN_COPY.outcomePatrol
        : undefined;
  return [
    fill(intro, { target: outcome.target.name }),
    ...(recoveredWreck || lead === undefined ? [] : [lead]),
    ...outcome.completions.map((completion) =>
      completion.kind === "task"
        ? fill(LANDMARK_SCAN_COPY.outcomeTask, { task: completion.task.text })
        : fill(LANDMARK_SCAN_COPY.outcomeQuest, { quest: completion.quest.name }),
    ),
  ].map((text) => ({ speaker: "astra", text }));
}
