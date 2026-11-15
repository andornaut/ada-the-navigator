import type { GalaxyNumber } from "../data/types.ts";
import type { QuestEntry } from "./questDetails.ts";
import type { OptionalTask } from "./types.ts";

export interface QuestObjectContext {
  readonly galaxy: GalaxyNumber;
  readonly quests: readonly QuestEntry[];
  readonly knownIds: readonly string[];
  readonly storyTargets: readonly string[];
  readonly task?: Readonly<OptionalTask>;
}

export interface ContextQuestDetails {
  readonly targetId: string;
  readonly quests: readonly QuestEntry[];
}

/** Actual quest endpoints and current targets, restricted to already identified objects. */
export function questsForObject(context: QuestObjectContext, id: string): readonly QuestEntry[] {
  if (!context.knownIds.includes(id)) {
    return [];
  }
  const task = context.task;
  const taskTargets = task
    ? task.kind === "job"
      ? [task.station, task.target.id]
      : [task.place, task.target?.id]
    : [];
  return context.quests.filter((entry) => {
    if (entry.galaxy !== context.galaxy) {
      return false;
    }
    const { line } = entry;
    return (
      line.source === id ||
      line.destination === id ||
      line.objectives?.some((objective) => objective.location === id) ||
      (line.kind === "story" && context.storyTargets.includes(id)) ||
      (line.kind === "job" && taskTargets.includes(id))
    );
  });
}
