import { ACTIVITIES, MINING_CONTRACT_DEPOSITS, SUPPLY_ITEMS } from "../../data/activities.ts";
import { DESTINATIONS } from "../../data/destinations.ts";
import { BUILT, GALAXY_NUMBERS } from "../../data/galaxies.ts";
import { isNeedleCourseStart } from "../../data/needle.ts";
import type { GalaxyNumber } from "../../data/types.ts";
import { flightWorldContext } from "../flightTopology.ts";
import { flightLandmarkSites, landmarkById, landmarkLabel } from "../landmarks.ts";
import {
  type QuestDetailContext,
  questDetails,
  type QuestEntry,
  storyQuestId,
  taskQuestId,
} from "../questDetails.ts";
import {
  type ContextQuestDetails,
  type QuestObjectContext,
  questsForObject,
} from "../questObjectLinks.ts";
import { fill } from "../shop.ts";
import type { FlightState, GameState } from "../types.ts";
import { worldDistance } from "../worldContacts.ts";
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

export interface ContextQuestLookup {
  readonly inSpace: () => boolean;
  readonly hasSuspendedInteraction: () => boolean;
  readonly nearestPlace: () => string | undefined;
  readonly hasAvailableAction: (place: string | undefined) => boolean;
  readonly hintTarget: (place: string | undefined) => string | undefined;
  readonly inRange: (flight: FlightState, hint?: string) => ContextQuestDetails | null;
}

/** Existing Use actions take priority over looking up linked Quest Details. */
export function projectContextQuestDetails(
  context: ContextQuestLookup,
  state: Readonly<Pick<GameState, "flight" | "dialogue" | "docked">>,
): ContextQuestDetails | null {
  const flight = state.flight;
  if (
    !context.inSpace() ||
    !flight ||
    state.dialogue ||
    state.docked ||
    context.hasSuspendedInteraction()
  ) {
    return null;
  }
  const place = context.nearestPlace();
  if (context.hasAvailableAction(place)) {
    return null;
  }
  return projectQuestDetailsFallback(context, flight, place, context.hintTarget(place));
}

/** Recheck screen and place admission at the point where the fallback is used. */
export function projectQuestDetailsFallback(
  context: Pick<ContextQuestLookup, "inSpace" | "inRange">,
  flight: FlightState,
  place: string | undefined,
  hint: string | undefined,
): ContextQuestDetails | null {
  return !context.inSpace() || (place !== undefined && hint === undefined)
    ? null
    : context.inRange(flight, hint);
}

/** Resolve the explicit hint or the nearest eligible linked place without advancing its quest. */
export function projectInRangeQuestDetails(
  context: QuestObjectContext & {
    readonly protectedUsePlace: (id: string) => boolean;
    readonly range: number;
  },
  flight: FlightState,
  hintTarget?: string,
): ContextQuestDetails | null {
  if (hintTarget !== undefined) {
    const quests = questsForObject(context, hintTarget);
    return quests.length ? { quests, targetId: hintTarget } : null;
  }
  const world = flightWorldContext(flight);
  let closest: ContextQuestDetails | null = null;
  let reach = context.range;
  const consider = (id: string, gap: number) => {
    if (
      !(gap <= reach) ||
      (gap === reach && closest !== null) ||
      !context.knownIds.includes(id) ||
      (flight.galaxy === 4 && isNeedleCourseStart(id)) ||
      context.protectedUsePlace(id)
    ) {
      return;
    }
    const quests = questsForObject(context, id);
    if (quests.length) {
      closest = { quests, targetId: id };
      reach = gap;
    }
  };
  for (const object of flight.objects) {
    consider(object.id, Math.hypot(flight.player.x - object.x, flight.player.y - object.y));
  }
  for (const site of flightLandmarkSites(flight)) {
    consider(site.id, worldDistance(world, flight.player, site));
  }
  return closest;
}
