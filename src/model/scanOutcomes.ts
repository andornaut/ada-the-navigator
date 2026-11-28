import type { MapSymbol } from "../data/destinations.ts";
import type { JobType } from "../data/jobs.ts";
import type { GalaxyNumber } from "../data/types.ts";

export interface ScanActionLead {
  readonly kind: "patrol";
  readonly targetId: string;
}

export interface ScanQuestIdentity {
  readonly id: string;
  readonly name: string;
  readonly icon: { readonly symbol: "job"; readonly jobType: JobType };
}
export type ScanCompletion =
  | { readonly kind: "quest"; readonly quest: ScanQuestIdentity }
  | {
      readonly kind: "task";
      readonly quest: ScanQuestIdentity;
      readonly task: { readonly id: string; readonly text: string };
    };
export interface ScanOutcome {
  readonly galaxy: GalaxyNumber;
  readonly targetId: string;
  readonly source: "scan" | "remembered";
  readonly target: { readonly id: string; readonly name: string; readonly symbol: MapSymbol };
  readonly completions: readonly ScanCompletion[];
  readonly leadStation?: string;
  readonly actionLead?: ScanActionLead;
  readonly wreckRecovered?: true;
}

/** Outcome facts are detached from mutable quest state before the once-only presentation drain. */
export function immutableScanOutcome(value: ScanOutcome): ScanOutcome {
  const completions = value.completions.map((completion) => {
    const quest = Object.freeze({
      ...completion.quest,
      icon: Object.freeze({ ...completion.quest.icon }),
    });
    return completion.kind === "quest"
      ? Object.freeze({ kind: "quest" as const, quest })
      : Object.freeze({
          kind: "task" as const,
          quest,
          task: Object.freeze({ ...completion.task }),
        });
  });
  return Object.freeze({
    ...value,
    ...(value.actionLead ? { actionLead: Object.freeze({ ...value.actionLead }) } : {}),
    completions: Object.freeze(completions),
    target: Object.freeze({ ...value.target }),
  });
}
