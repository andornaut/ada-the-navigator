import { ACTIVITIES } from "../data/activities.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { QuestDetails } from "./map.ts";
import type { OptionalTask } from "./types.ts";

/** Read-only presentation of the accepted task, including its fixed payout. */
export function taskQuestDetails(
  context: {
    readonly galaxy: GalaxyNumber;
    readonly label: (key: string) => string;
    /** The existing jobText substitution pipeline, with approved fuller copy when available. */
    readonly jobDescription: (task: Extract<OptionalTask, { kind: "job" }>) => string;
  },
  task: Readonly<OptionalTask>,
): QuestDetails {
  const activity = ACTIVITIES[context.galaxy];
  const description =
    task.kind === "job"
      ? context.jobDescription(task)
      : activity?.id === task.id
        ? context.label(activity.goal)
        : undefined;
  return {
    ...(description ? { description } : {}),
    reward: context.label("jobReward").replace("{amount}", String(task.reward)),
    source: task.kind === "job" ? task.station : task.place,
  };
}
