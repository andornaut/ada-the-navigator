import type { TaskCategory } from "../data/taskCategories.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { QuestEntry } from "./questDetails.ts";
import type { OptionalTask } from "./types.ts";

export type QuestObjectLink = Pick<QuestEntry, "galaxy" | "line">;

export interface QuestObjectContext<Entry extends QuestObjectLink = QuestEntry> {
  readonly galaxy: GalaxyNumber;
  readonly quests: readonly Entry[];
  readonly knownIds: readonly string[];
  readonly storyTargets: readonly string[];
  readonly task?: Readonly<OptionalTask>;
}

export interface ContextQuestDetails {
  readonly targetId: string;
  readonly quests: readonly QuestEntry[];
}

/** Actual quest endpoints and current targets, restricted to already identified objects. */
export function questsForObject<Entry extends QuestObjectLink>(
  context: QuestObjectContext<Entry>,
  id: string,
): readonly Entry[] {
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

/** Classify an admitted target without granting knowledge or adding a physical target. */
export function taskMarkerCategory(
  links: readonly QuestObjectLink[],
  story: boolean,
  job: boolean,
  project = false,
): TaskCategory {
  if (story || links.some(({ line }) => line.kind === "story")) {
    return "story";
  }
  if (job || links.some(({ line }) => line.kind === "job")) {
    return "job";
  }
  return project ? "project" : "generic";
}
