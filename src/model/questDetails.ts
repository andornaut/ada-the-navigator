import { MINING_CONTRACT_DEPOSITS, SUPPLY_ITEMS } from "../data/activities.ts";
import { carriedItemName, STORY_ITEM_NAMES } from "../data/itemNames.ts";
import type { JobType } from "../data/jobs.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { questItemDestination } from "./indicators.ts";
import { landmarkById } from "./landmarks.ts";
import type { MapSymbol, QuestDetails, QuestLine } from "./map.ts";
import { fill } from "./shop.ts";
import type { GalaxyProgress, HeldJob, OptionalTask } from "./types.ts";

/** A live quest view with a stable identity and only already known location labels. */
export interface QuestEntry {
  readonly id: string;
  readonly galaxy: GalaxyNumber;
  readonly jobType?: JobType;
  readonly line: Extract<QuestLine, { kind: "story" | "job" }>;
  readonly locations: readonly {
    readonly id: string;
    readonly label: string;
    readonly symbol?: MapSymbol;
  }[];
}

export interface QuestDetailContext {
  readonly galaxy: GalaxyNumber;
  readonly label: (key: string) => string;
  /** Existing sentence-name resolver; called only for discovered locations. */
  readonly placeLabel: (id: string) => string;
  readonly jobText: (job: Readonly<HeldJob>) => { readonly detail: string; readonly title: string };
  readonly miningMilestones: readonly number[];
}

export interface QuestDetailSnapshot {
  readonly progress: Readonly<
    Pick<
      GalaxyProgress,
      "stage" | "introduced" | "resolved" | "questComplete" | "questItem" | "deposited"
    >
  > & { readonly known: readonly string[]; readonly stations: readonly string[] };
  readonly flight: { readonly cargo: number; readonly calf?: { readonly following: boolean } };
  readonly task?: Readonly<OptionalTask>;
}

/** Destination is distinct from the map's current-step target while cargo awaits collection. */
export type RoutedQuestDetails = QuestDetails;

/** Presentation only: no economy, task, progress or fog mutation. */
export function questDetails(
  context: QuestDetailContext,
  snapshot: QuestDetailSnapshot,
): {
  readonly storyDetails?: RoutedQuestDetails;
  readonly jobDetails?: RoutedQuestDetails;
} {
  const { flight, progress, task } = snapshot;
  const text = (key: string, tokens: Readonly<Record<string, string | number>> = {}) =>
    fill(context.label(key), tokens);
  const known = (id: string) => progress.known.includes(id) || progress.stations.includes(id);
  const visible = (id: string): string | null => (known(id) ? id : null);
  const place = (id: string) =>
    known(id) ? context.placeLabel(id) : context.label("questExplore");
  const count = (current: number, required: number) => text("questProgress", { current, required });
  const carrying = (item: string, carried: boolean) =>
    text(carried ? "questDeliver" : "questCollect", { item });
  let storyDetails: RoutedQuestDetails | undefined;
  if (!progress.resolved && !progress.questComplete && progress.introduced) {
    if (context.galaxy === 1) {
      // These are the three exchanges performed by interact, including replacement cargo.
      const exchange = [
        { item: "food", key: "questFoodDetail", source: "growers" },
        { item: "toolkit", key: "questToolkitDetail", source: "workshop" },
        { item: "parts", key: "questSparePartsDetail", source: "salvagers" },
      ][progress.stage - 1];
      if (exchange) {
        const carried = progress.questItem === exchange.item;
        const destination = questItemDestination({ questItem: exchange.item });
        storyDetails = {
          description: text(exchange.key),
          destination: destination === null ? null : visible(destination),
          nextStep: carrying(STORY_ITEM_NAMES[exchange.item]!, carried),
          progress: count(Number(carried), 1),
          source: visible(exchange.source),
        };
      }
    } else if (context.galaxy === 2) {
      const index = ({ 1: 0, 2: 1, 4: 2 } as Readonly<Record<number, number>>)[progress.stage];
      const required = index === undefined ? undefined : context.miningMilestones[index];
      if (required !== undefined) {
        storyDetails = {
          nextStep: carrying(
            flight.cargo > 0 ? `${flight.cargo} ${context.label("ore")}` : context.label("ore"),
            flight.cargo > 0,
          ),
          progress: count(progress.deposited, required),
        };
      }
    }
  }
  let jobDetails: RoutedQuestDetails | undefined;
  if (task) {
    const reward = text("jobReward", { amount: task.reward });
    if (task.kind === "job") {
      const key = {
        delivery: "questDeliveryDetail",
        hunt: "questHuntDetail",
        rescue: "questRescueDetail",
        survey: "questSurveyDetail",
      }[task.type];
      const landmark =
        task.type === "survey" ? landmarkById(context.galaxy, task.target.id) : undefined;
      const description =
        text(key, {
          craft: task.item.replace(/^(?:a|an)\s+/iu, ""),
          item: task.item,
          landmark: landmark ? context.label(landmark.name) : context.label("questExplore"),
          place: place(task.target.id),
        }) || context.jobText(task).detail;
      jobDetails = { description, reward };
      if (task.type === "delivery") {
        jobDetails = {
          ...jobDetails,
          destination: visible(task.target.id),
          nextStep: carrying(carriedItemName(task.item), task.carrying === true),
          progress: count(Number(task.carrying === true), 1),
          source: visible(task.station),
        };
      }
    } else if (task.id === "supplyRun") {
      const item = SUPPLY_ITEMS[task.place];
      if (item !== undefined) {
        jobDetails = {
          description: text("questSupplyDetail", {
            destination: task.target ? place(task.target.id) : context.label("questExplore"),
            item,
            source: place(task.place),
          }),
          destination: task.target ? visible(task.target.id) : null,
          nextStep: carrying(carriedItemName(item), task.carrying === true),
          progress: count(Number(task.carrying === true), 1),
          reward,
          source: visible(task.place),
        };
      }
    } else if (task.id === "miningContract") {
      jobDetails = {
        description: text("questMiningDetail", { required: MINING_CONTRACT_DEPOSITS }),
        nextStep: carrying(
          flight.cargo > 0 ? `${flight.cargo} ${context.label("ore")}` : context.label("ore"),
          flight.cargo > 0,
        ),
        progress: count(task.deposited ?? 0, MINING_CONTRACT_DEPOSITS),
        reward,
      };
    } else if (task.id === "guideCalf") {
      jobDetails = {
        description: text("questCalfDetail"),
        nextStep: context.label(flight.calf?.following ? "calfGuide" : "calfFind"),
        reward,
      };
    }
  }
  return {
    ...(jobDetails ? { jobDetails } : {}),
    ...(storyDetails ? { storyDetails } : {}),
  };
}
