import { MINING_CONTRACT_DEPOSITS, SUPPLY_ITEMS } from "../data/activities.ts";
import { carriedItemName, STORY_ITEM_NAMES } from "../data/itemNames.ts";
import type { JobType } from "../data/jobs.ts";
import { questReward } from "../data/questRewards.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { questItemDestination } from "./indicators.ts";
import { landmarkById } from "./landmarks.ts";
import type { MapSymbol, QuestDetails, QuestLine } from "./map.ts";
import { fill } from "./shop.ts";
import type { GalaxyProgress, HeldJob, OptionalTask, Vec } from "./types.ts";

export interface QuestObjective {
  readonly label: string;
  readonly checked: boolean;
  readonly count?: string;
  /** A canonical inventory category for an already named item. */
  readonly itemKind?: "carrying" | "holodisk" | "ore" | "towing";
  /** Only a discovered location identity, never a hidden destination. */
  readonly location?: string;
}

export interface QuestObjectiveFacts {
  readonly currentItemKind?: QuestObjective["itemKind"];
  readonly objectives?: readonly QuestObjective[];
}

/** A live quest view with a stable identity and only already known location labels. */
export interface QuestEntry {
  readonly id: string;
  readonly galaxy: GalaxyNumber;
  readonly jobType?: JobType;
  readonly line: Extract<QuestLine, { kind: "story" | "job" }> & QuestObjectiveFacts;
  readonly locations: readonly {
    readonly id: string;
    readonly label: string;
    readonly symbol?: MapSymbol;
  }[];
}

export interface QuestDetailContext {
  readonly galaxy: GalaxyNumber;
  readonly label: (key: string) => string;
  /**
   * Existing sentence-name resolver: for discovered locations, and for the places a delivery or
   * supply run description names whether or not they are mapped.
   */
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
  > & {
    readonly holodisk?: boolean;
    readonly known: readonly string[];
    readonly stations: readonly string[];
  };
  readonly flight: {
    readonly cargo: number;
    readonly calf?: { readonly following: boolean };
    readonly tow?: Vec;
  };
  readonly task?: Readonly<OptionalTask>;
}

/** Destination is distinct from the map's current-step target while cargo awaits collection. */
export type RoutedQuestDetails = QuestDetails & QuestObjectiveFacts;

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
  const count = (current: number, required: number) => text("questProgress", { current, required });
  const carrying = (item: string, carried: boolean) =>
    text(carried ? "questDeliver" : "questCollect", { item });
  const delivery = (item: string, carried: boolean): readonly QuestObjective[] => [
    { checked: carried, itemKind: "carrying", label: text("questCollect", { item }) },
    { checked: false, itemKind: "carrying", label: text("questDeliver", { item }) },
  ];
  const mining = (deposited: number, required: number): readonly QuestObjective[] => [
    {
      checked: deposited > 0 || flight.cargo > 0,
      itemKind: "ore",
      label: text("questCollect", { item: context.label("ore") }),
    },
    {
      checked: deposited >= required,
      count: count(deposited, required),
      itemKind: "ore",
      label: text("questDeliver", { item: context.label("ore") }),
    },
  ];
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
          objectives: [
            ...["food", "toolkit"].slice(0, progress.stage - 1).map((item): QuestObjective => ({
              checked: true,
              itemKind: "carrying",
              label: text("questDeliver", { item: STORY_ITEM_NAMES[item]! }),
            })),
            ...delivery(STORY_ITEM_NAMES[exchange.item]!, carried),
          ],
          progress: count(Number(carried), 1),
          requirements: [
            progress.stage < 2
              ? { checked: progress.questItem === "food", label: context.label("questFoodAboard") }
              : { checked: true, label: context.label("questFoodDelivered") },
            ...(progress.stage >= 2
              ? [{ checked: progress.stage >= 3, label: context.label("questToolkitDelivered") }]
              : []),
            ...(progress.stage >= 3
              ? [
                  {
                    checked: progress.questItem === "parts",
                    label: context.label("questSparePartsAboard"),
                  },
                ]
              : []),
          ],
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
          objectives: mining(progress.deposited, required),
          progress: count(progress.deposited, required),
          requirements: [
            {
              count: count(progress.deposited, required),
              label: context.label("questOreDeposited"),
            },
          ],
        };
      }
    }
  }
  if (!progress.resolved && progress.introduced && progress.questComplete && context.galaxy === 1) {
    storyDetails = {
      objectives: ["food", "toolkit", "parts"].map((item) => ({
        checked: true,
        itemKind: "carrying" as const,
        label: text("questDeliver", { item: STORY_ITEM_NAMES[item]! }),
      })),
    };
  }
  if (!progress.resolved && progress.introduced && progress.questComplete && !progress.holodisk) {
    storyDetails = { ...storyDetails, currentItemKind: "holodisk" };
  }
  let jobDetails: RoutedQuestDetails | undefined;
  if (task) {
    const reward = text("jobReward", { amount: questReward(task.reward) });
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
          // The sentence name, as in the title; only the endpoint lines withhold unmapped places.
          place: task.type === "delivery" ? context.placeLabel(task.target.id) : "",
        }) || context.jobText(task).detail;
      jobDetails = {
        description,
        ...(task.type === "rescue"
          ? {
              requirements: [
                { checked: flight.tow !== undefined, label: context.label("questTowLineAttached") },
              ],
            }
          : {}),
        reward,
      };
      if (task.type === "hunt") {
        jobDetails = {
          ...jobDetails,
          objectives: [
            { checked: task.entered === true, label: "Find the search area" },
            {
              checked: false,
              itemKind: "carrying",
              label: text("questCollect", { item: carriedItemName(task.item) }),
            },
          ],
        };
      } else if (task.type === "rescue") {
        jobDetails = {
          ...jobDetails,
          objectives: [
            { checked: flight.tow !== undefined, itemKind: "towing", label: "Attach the tow line" },
            { checked: false, itemKind: "towing", label: context.jobText(task).title },
          ],
        };
      } else if (task.type === "survey") {
        jobDetails = {
          ...jobDetails,
          objectives: [
            {
              checked: false,
              label: context.jobText(task).title,
              ...(known(task.target.id) ? { location: task.target.id } : {}),
            },
          ],
        };
      }
      if (task.type === "delivery") {
        jobDetails = {
          ...jobDetails,
          destination: visible(task.target.id),
          nextStep: carrying(carriedItemName(task.item), task.carrying === true),
          objectives: delivery(carriedItemName(task.item), task.carrying === true),
          progress: count(Number(task.carrying === true), 1),
          source: visible(task.station),
        };
      }
    } else if (task.id === "supplyRun") {
      const item = SUPPLY_ITEMS[task.place];
      if (item !== undefined) {
        jobDetails = {
          // Sentence names, as in the objective; only the endpoint lines withhold unmapped places.
          description: text("questSupplyDetail", {
            destination: context.placeLabel(task.target?.id ?? ""),
            item,
            source: context.placeLabel(task.place),
          }),
          destination: task.target ? visible(task.target.id) : null,
          nextStep: carrying(carriedItemName(item), task.carrying === true),
          objectives: delivery(carriedItemName(item), task.carrying === true),
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
        objectives: mining(task.deposited ?? 0, MINING_CONTRACT_DEPOSITS),
        progress: count(task.deposited ?? 0, MINING_CONTRACT_DEPOSITS),
        requirements: [
          {
            count: count(task.deposited ?? 0, MINING_CONTRACT_DEPOSITS),
            label: context.label("questOreDeposited"),
          },
        ],
        reward,
      };
    } else if (task.id === "guideCalf") {
      jobDetails = {
        description: text("questCalfDetail"),
        nextStep: context.label(flight.calf?.following ? "calfGuide" : "calfFind"),
        objectives: [
          { checked: flight.calf?.following === true, label: context.label("calfFind") },
          { checked: false, label: context.label("calfGuide") },
        ],
        reward,
      };
    }
  }
  return {
    ...(jobDetails ? { jobDetails } : {}),
    ...(storyDetails ? { storyDetails } : {}),
  };
}
