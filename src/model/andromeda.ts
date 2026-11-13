export { andromedaConversation } from "../data/andromeda.ts";
import {
  ANDROMEDA_CHAPTER,
  ANDROMEDA_CONVERSATIONS,
  ANDROMEDA_PLACES,
  andromedaConversation,
  type AndromedaConversationId,
  type AndromedaProgress,
} from "../data/andromeda.ts";
import { ECONOMY } from "../data/economy.ts";
import {
  nearestSettlement,
  nearestSettlerStation,
  settlementById,
  settlementsNear,
} from "./andromedaPlaces.ts";
import type { ChapterContext, ChapterResult, ChapterRuntime } from "./chapterProtocol.ts";
import { ensureDestination, ensureDestinationAt, ensureStation } from "./flight.ts";
import { stationById } from "./stations.ts";
import type { DialogueState, GalaxyProgress, UseAction, Vec } from "./types.ts";

export const ANDROMEDA_PARTS = "beaconParts";

type Progress = GalaxyProgress & { andromeda?: AndromedaProgress };
const memory = (progress: GalaxyProgress) => (progress as Progress).andromeda;
const remember = (progress: GalaxyProgress) => ((progress as Progress).andromeda ??= {});
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** Only real seeded destination ids enter saved story targets. */
export function validAndromedaProgress(value: unknown): value is AndromedaProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const state = value as Record<string, unknown>;
  return (
    Object.keys(state).every((key) => key === "station" || key === "settlement") &&
    (state.station === undefined ||
      (typeof state.station === "string" && stationById(ECONOMY, 5, state.station) !== null)) &&
    (state.settlement === undefined ||
      (typeof state.settlement === "string" && settlementById(ECONOMY, state.settlement) !== null))
  );
}

/** One index per approved objective, with the handover distinct from the return to Earth. */
export function andromedaObjectiveIndex(progress: GalaxyProgress): number {
  return progress.questComplete
    ? progress.holodisk
      ? ANDROMEDA_CHAPTER.objectives.length - 1
      : 6
    : Math.min(6, progress.stage);
}

/** Story targets stay bound to the station and settlement accepted with Pip. */
export function andromedaObjective(context: ChapterContext): string | null {
  const { progress } = context;
  const target = memory(progress);
  if (progress.holodisk) {
    return null;
  }
  if (progress.questComplete) {
    return ANDROMEDA_PLACES.pip;
  }
  switch (progress.stage) {
    case 1:
      return ANDROMEDA_PLACES.beacon;
    case 2:
      return ANDROMEDA_PLACES.pip;
    case 3:
      return target?.station ?? null;
    case 4:
      return target?.settlement ?? null;
    case 5:
      return ANDROMEDA_PLACES.beacon;
    case 6:
      return ANDROMEDA_PLACES.pip;
    default:
      return null;
  }
}

/** Prepare fixed story roles and real seeded outposts without duplicating any station. */
export function ensureAndromedaWorld(context: ChapterContext): void {
  const { content, flight, progress } = context;
  if (flight.galaxy !== 5) {
    return;
  }
  ensureDestination(content, ANDROMEDA_PLACES.beacon, flight);
  ensureDestination(content, ANDROMEDA_PLACES.pip, flight);
  const target = memory(progress);
  if (target?.station) {
    ensureStation(content, target.station, flight);
  }
  const nearby = settlementsNear(ECONOMY, content.tuning.chunkSize * 2, flight.player);
  const accepted = target?.settlement && settlementById(ECONOMY, target.settlement);
  if (accepted && !nearby.some((site) => site.id === accepted.id)) {
    nearby.push(accepted);
  }
  for (const site of nearby) {
    const place = ensureDestinationAt(content, site.id, site, flight);
    place.role = ANDROMEDA_PLACES.settlement;
  }
}

function dialogue(context: ChapterContext, id: AndromedaConversationId): DialogueState {
  const entry = andromedaConversation(context.progress, id);
  return {
    choices: [{ id: "continue", label: context.content.labels.continue ?? "" }],
    context: `andromeda:${id}`,
    text: entry.lines
      .map((line) => (line.speaker ? `${line.speaker}: ${line.text}` : line.text))
      .join("\n\n"),
    title: entry.party,
  };
}

function relevant(progress: GalaxyProgress, id: AndromedaConversationId): boolean {
  switch (id) {
    case "arrival":
      return progress.stage === 0 && !progress.introduced;
    case "dent":
      return progress.stage === 1 || progress.stage === 2;
    case "confession":
      return progress.stage === 1 || progress.stage === 2;
    case "ownsUp":
      return progress.stage === 3;
    case "parts":
      return progress.stage === 4 && Boolean(memory(progress)?.settlement);
    case "repaired":
      return (
        progress.stage === 6 || (progress.stage === 5 && progress.questItem === ANDROMEDA_PARTS)
      );
    case "holodisk":
      return progress.stage === 6 && progress.questComplete && !progress.holodisk;
  }
  return false;
}

/** The interaction label describes the same due action as Use, without mutating progress. */
export function andromedaAction(
  context: ChapterContext,
  destination: string,
): UseAction | undefined {
  const { flight, progress } = context;
  if (flight.galaxy !== 5) {
    return undefined;
  }
  const target = memory(progress);
  if (
    (progress.stage === 0 && stationById(ECONOMY, 5, destination)) ||
    (progress.stage === 3 && destination === target?.station) ||
    (destination === ANDROMEDA_PLACES.pip &&
      (relevant(progress, "confession") || relevant(progress, "holodisk")))
  ) {
    return "talk";
  }
  if (
    (progress.stage === 4 && destination === target?.settlement) ||
    (progress.stage === 5 &&
      destination === ANDROMEDA_PLACES.beacon &&
      progress.questItem === ANDROMEDA_PARTS)
  ) {
    return "deliver";
  }
  if (destination === ANDROMEDA_PLACES.beacon && relevant(progress, "dent")) {
    return "use";
  }
  return undefined;
}

/** Talk never charges for the chapter or introduces an optional-task prerequisite. */
export function useAndromeda(
  context: ChapterContext,
  destination: string,
): ChapterResult | undefined {
  const { flight, progress } = context;
  if (flight.galaxy !== 5) {
    return undefined;
  }
  const target = memory(progress);
  if (progress.stage === 0 && stationById(ECONOMY, 5, destination)) {
    return { dialogue: dialogue(context, "arrival") };
  }
  if (destination === ANDROMEDA_PLACES.beacon && relevant(progress, "dent")) {
    return { dialogue: dialogue(context, "dent") };
  }
  if (destination === ANDROMEDA_PLACES.pip && relevant(progress, "confession")) {
    return { dialogue: dialogue(context, "confession") };
  }
  if (progress.stage === 3 && destination === target?.station) {
    return { dialogue: dialogue(context, "ownsUp") };
  }
  if (progress.stage === 4 && destination === target?.settlement) {
    return { dialogue: dialogue(context, "parts") };
  }
  if (destination === ANDROMEDA_PLACES.beacon && relevant(progress, "repaired")) {
    return { dialogue: dialogue(context, "repaired") };
  }
  if (destination === ANDROMEDA_PLACES.pip && relevant(progress, "holodisk")) {
    return { dialogue: dialogue(context, "holodisk") };
  }
  return undefined;
}

function finish(context: ChapterContext, id: AndromedaConversationId): ChapterResult {
  const { flight, progress } = context;
  switch (id) {
    case "arrival":
      progress.introduced = true;
      progress.stage = 1;
      break;
    case "dent":
      progress.stage = 2;
      break;
    case "confession":
      remember(progress).station = nearestSettlerStation(ECONOMY, flight.player).id;
      progress.stage = 3;
      break;
    case "ownsUp": {
      const station = stationById(ECONOMY, 5, memory(progress)!.station!)!;
      remember(progress).settlement = nearestSettlement(ECONOMY, station).id;
      progress.stage = 4;
      break;
    }
    case "parts":
      progress.questItem = ANDROMEDA_PARTS;
      progress.stage = 5;
      break;
    case "repaired":
      if (progress.stage === 5) {
        progress.questItem = null;
        progress.stage = 6;
        return { complete: true };
      }
      break;
    case "holodisk":
      return { holodisk: { giver: "Pip" } };
  }
  return {};
}

function finishAndPrepare(context: ChapterContext, id: AndromedaConversationId): ChapterResult {
  const result = finish(context, id);
  ensureAndromedaWorld(context);
  return result;
}

const mounted = new WeakMap<ChapterContext["flight"], string>();

/** Page nearby settlements when Ada enters another world chunk or accepts a new target. */
export function pageAndromedaWorld(context: ChapterContext): void {
  if (context.flight.galaxy !== 5) {
    return;
  }
  const { chunkSize } = context.content.tuning;
  const { player } = context.flight;
  const target = memory(context.progress);
  const key =
    `${Math.floor(player.x / chunkSize)},${Math.floor(player.y / chunkSize)}:` +
    `${target?.station ?? ""}:${target?.settlement ?? ""}`;
  if (mounted.get(context.flight) === key) {
    return;
  }
  ensureAndromedaWorld(context);
  mounted.set(context.flight, key);
}

/** Only the central model's validated offered choice advances a story panel. */
export function chooseAndromeda(
  context: ChapterContext,
  panel: DialogueState,
  choice: string,
): ChapterResult | undefined {
  if (context.flight.galaxy !== 5) {
    return undefined;
  }
  const parsed = /^andromeda:([A-Za-z]+)$/u.exec(panel.context);
  if (choice !== "continue" || !parsed || !Object.hasOwn(ANDROMEDA_CONVERSATIONS, parsed[1]!)) {
    return undefined;
  }
  const id = parsed[1] as AndromedaConversationId;
  return relevant(context.progress, id) ? finishAndPrepare(context, id) : undefined;
}

/** First contact uses an actual station; inspecting the dent is useful but never an extra gate. */
export function stepAndromeda(context: ChapterContext): ChapterResult | undefined {
  const { content, flight, progress } = context;
  if (flight.galaxy !== 5) {
    return undefined;
  }
  if (!progress.introduced && progress.stage === 0) {
    const station = flight.objects.find(
      (place) =>
        place.kind === "station" &&
        progress.stations.includes(place.id) &&
        distance(place, flight.player) <= content.tuning.talkRange,
    );
    if (station) {
      return { dialogue: dialogue(context, "arrival") };
    }
  }
  if (progress.stage === 1) {
    const beacon = flight.objects.find((place) => place.id === ANDROMEDA_PLACES.beacon);
    if (beacon && distance(beacon, flight.player) <= content.tuning.talkRange) {
      return { dialogue: dialogue(context, "dent") };
    }
  }
  return undefined;
}

export const ANDROMEDA_RUNTIME: ChapterRuntime = {
  afterStep: stepAndromeda,
  beforeStep: pageAndromedaWorld,
  choose: chooseAndromeda,
  galaxy: 5,
  init: ensureAndromedaWorld,
  objective: andromedaObjective,
  route: [ANDROMEDA_PLACES.beacon, ANDROMEDA_PLACES.pip],
  use: useAndromeda,
};
