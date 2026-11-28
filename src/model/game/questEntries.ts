import { ACTIVITIES, MINING_CONTRACT_DEPOSITS, SUPPLY_ITEMS } from "../../data/activities.ts";
import { DESTINATIONS } from "../../data/destinations.ts";
import { BUILT, GALAXY_NUMBERS } from "../../data/galaxies.ts";
import type { GalaxyNumber } from "../../data/types.ts";
import { landmarkById, landmarkLabel } from "../landmarks.ts";
import {
  type QuestDetailContext,
  questDetails,
  type QuestEntry,
  storyQuestId,
  taskQuestId,
} from "../questDetails.ts";
import { fill } from "../shop.ts";
import type { GameState } from "../types.ts";
import { galaxyRoute } from "./campaignState.ts";

export type QuestTextContext = Pick<
  QuestDetailContext,
  "galaxy" | "jobText" | "label" | "placeLabel"
>;
type QuestEntryLine = Omit<QuestEntry, "locations">;

interface QuestLineContext extends QuestDetailContext {
  readonly storyObjective: () => string;
  readonly taskObjective: () => string | null;
}

interface QuestEntryContext {
  readonly hubName: (galaxy: GalaxyNumber, id: string) => string | undefined;
  readonly label: QuestTextContext["label"];
  readonly placeLabel: (galaxy: GalaxyNumber, id: string) => string;
  readonly questLines: (galaxy: GalaxyNumber) => readonly QuestEntryLine[];
}

interface QuestLocationProgress {
  readonly charted: readonly string[];
  readonly known: readonly string[];
  readonly stations: readonly string[];
}

export function projectTaskObjective(
  context: QuestTextContext,
  state: Readonly<Pick<GameState, "flight" | "tasks">>,
): string | null {
  const { galaxy } = context;
  const task = state.tasks[galaxy];
  if (task?.kind === "job") {
    return context.jobText(task).title;
  }
  const activity = task;
  if (activity?.id === "supplyRun") {
    return fill(context.label("supplyObjective"), {
      destination: context.placeLabel(activity.target?.id ?? ""),
      item: SUPPLY_ITEMS[activity.place] ?? "",
    });
  }
  if (activity?.id === "miningContract") {
    return fill(context.label("contractObjective"), {
      have: activity.deposited ?? 0,
      need: MINING_CONTRACT_DEPOSITS,
    });
  }
  if (activity?.id === "guideCalf") {
    return context.label(
      state.flight?.galaxy === galaxy && state.flight.calf?.following ? "calfGuide" : "calfFind",
    );
  }
  if (activity?.id === "threadNeedle" || activity?.id === "courierRun") {
    return context.label(ACTIVITIES[galaxy]?.goal ?? "");
  }
  return null;
}

export function projectQuestLines(
  context: QuestLineContext,
  state: Readonly<Pick<GameState, "flight" | "progress" | "tasks">>,
): QuestEntryLine[] {
  const { galaxy } = context;
  const progress = state.progress[galaxy];
  const task = state.tasks[galaxy];
  const flight = state.flight?.galaxy === galaxy ? state.flight : undefined;
  const details = questDetails(context, {
    flight: flight ?? { cargo: 0 },
    progress,
    ...(task ? { task } : {}),
  });
  const entries: QuestEntryLine[] = [];
  if (BUILT.has(galaxy) && progress.introduced && !progress.resolved) {
    entries.push({
      galaxy,
      id: storyQuestId(galaxy, progress.stage),
      line: {
        ...details.storyDetails,
        kind: "story",
        target: null,
        text: context.storyObjective(),
      },
    });
  }
  const text = context.taskObjective();
  if (task && text) {
    entries.push({
      galaxy,
      id: taskQuestId(galaxy, task),
      ...(task.kind === "job" ? { jobType: task.type } : {}),
      line: { ...details.jobDetails, kind: "job", target: null, text },
    });
  }
  return entries;
}

/** All accepted tasks and introduced, unresolved story quests, derived without switching galaxies. */
export function projectQuestEntries(
  context: QuestEntryContext,
  progressByGalaxy: Readonly<Record<GalaxyNumber, QuestLocationProgress>>,
): readonly QuestEntry[] {
  return GALAXY_NUMBERS.flatMap((galaxy) => {
    const lines = context.questLines(galaxy);
    if (!lines.length) {
      return [];
    }
    const progress = progressByGalaxy[galaxy];
    const locations = [
      ...new Set([...progress.known, ...progress.stations, ...progress.charted]),
    ].map((id) => {
      const landmark = landmarkById(galaxy, id);
      const symbol = progress.stations.includes(id)
        ? ("station" as const)
        : (landmark?.kind ??
          DESTINATIONS[id]?.mapKind ??
          (galaxyRoute(galaxy).includes(id) ? ("destination" as const) : undefined));
      return {
        id,
        label: landmark
          ? landmarkLabel((key) => context.label(key), landmark)
          : (context.hubName(galaxy, id) ?? context.placeLabel(galaxy, id)),
        ...(symbol ? { symbol } : {}),
      };
    });
    return lines.map((entry) => ({ ...entry, locations }));
  });
}
