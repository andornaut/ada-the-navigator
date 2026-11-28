export { andromedaConversation } from "../data/andromeda.ts";
import {
  ANDROMEDA_CHAPTER,
  ANDROMEDA_CONVERSATIONS,
  ANDROMEDA_PLACES,
  andromedaConversation,
  type AndromedaConversationId,
  type AndromedaProgress,
} from "../data/andromeda.ts";
import type { Speaker } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import {
  admitCourierAmbush,
  advanceCourierAmbush,
  courierAmbushActor,
  type CourierAmbushAttempt,
  type CourierAmbushLeg,
  courierAmbushLeg,
  courierAmbushMarkers,
  type CourierAmbushPlan,
  courierAmbushRepresented,
  courierAmbushTerrainCovered,
  courierAmbushWarningActive,
  planCourierAmbush,
  setCourierSpawnReservation,
  stepCourierAmbush,
  validCourierAmbushAttempt,
} from "./andromedaCourierAmbush.ts";
import {
  nearestSettlement,
  settlementById,
  settlementsNear,
  worldNearestSettlerStation,
} from "./andromedaPlaces.ts";
import type {
  ChapterArrivalCue,
  ChapterContext,
  ChapterResult,
  ChapterRuntime,
} from "./chapterProtocol.ts";
import {
  ensureDestination,
  ensureDestinationAt,
  ensureStation,
  questGuardPlacementContext,
} from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { guideBeaconSlotAt, storyGuideBeaconSlot } from "./guideBeacons.ts";
import { flightStationContext, namesSavedStation, worldStationById } from "./stations.ts";
import type { DialogueState, FlightState, GalaxyProgress, UseAction, Vec } from "./types.ts";

export const ANDROMEDA_PARTS = "beaconParts";

type AndromedaChapterProgress = AndromedaProgress & { courierAmbush?: CourierAmbushAttempt };
type Progress = GalaxyProgress & { andromeda?: AndromedaChapterProgress };
const memory = (progress: GalaxyProgress) => (progress as Progress).andromeda;
const remember = (progress: GalaxyProgress) => ((progress as Progress).andromeda ??= {});
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** Only real seeded destination ids enter saved story targets. */
export function validAndromedaProgress(value: unknown): value is AndromedaChapterProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const state = value as Record<string, unknown>;
  return (
    Object.keys(state).every(
      (key) => key === "station" || key === "settlement" || key === "courierAmbush",
    ) &&
    (state.courierAmbush === undefined ||
      (validCourierAmbushAttempt(state.courierAmbush) &&
        state.courierAmbush.station === state.station &&
        state.courierAmbush.settlement === state.settlement)) &&
    (state.station === undefined ||
      (typeof state.station === "string" && namesSavedStation(ECONOMY, 5, state.station))) &&
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
  const beaconId = ANDROMEDA_PLACES.beacon;
  const existing = flight.objects.find(
    (object) => object.kind === "destination" && object.id === beaconId,
  );
  const retained = progress.requiredSites?.[beaconId];
  const slot =
    (retained && guideBeaconSlotAt(retained)) ??
    (existing && guideBeaconSlotAt(existing)) ??
    storyGuideBeaconSlot(content.tuning.chunkSize);
  const point = slot.point;
  if (retained?.x !== point.x || retained.y !== point.y) {
    (progress.requiredSites ??= {})[beaconId] = { ...point };
  }
  if (existing && (existing.x !== point.x || existing.y !== point.y)) {
    flight.objects.splice(flight.objects.indexOf(existing), 1);
  }
  ensureDestinationAt(content, beaconId, point, flight);
  if (!flight.world.notables[ANDROMEDA_PLACES.pip]) {
    ensureDestination(content, ANDROMEDA_PLACES.pip, flight);
  }
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
    choices: [{ id: "continue", label: context.content.labels.next ?? "" }],
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
    (progress.stage === 0 &&
      worldStationById(flightStationContext(flight), ECONOMY, 5, destination)) ||
    (progress.stage === 3 && destination === target?.station) ||
    (progress.stage === 4 && destination === target?.settlement) ||
    (progress.stage === 6 && destination === ANDROMEDA_PLACES.beacon) ||
    (destination === ANDROMEDA_PLACES.pip &&
      (relevant(progress, "confession") || relevant(progress, "holodisk")))
  ) {
    return "talk";
  }
  if (
    progress.stage === 5 &&
    destination === ANDROMEDA_PLACES.beacon &&
    progress.questItem === ANDROMEDA_PARTS
  ) {
    return "deliver";
  }
  if (destination === ANDROMEDA_PLACES.beacon && relevant(progress, "dent")) {
    return "use";
  }
  return undefined;
}

/** The Wick exchanges that belong to a real station visit. */
export function andromedaStationTopic(
  { flight, progress }: ChapterContext,
  destination: string,
): "arrival" | "ownsUp" | undefined {
  if (flight.galaxy !== 5) {
    return undefined;
  }
  if (
    relevant(progress, "arrival") &&
    worldStationById(flightStationContext(flight), ECONOMY, 5, destination)
  ) {
    return "arrival";
  }
  return progress.stage === 3 && destination === memory(progress)?.station ? "ownsUp" : undefined;
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
  const topic = andromedaStationTopic(context, destination);
  if (topic) {
    return { dialogue: dialogue(context, topic) };
  }
  const target = memory(progress);
  if (destination === ANDROMEDA_PLACES.beacon && relevant(progress, "dent")) {
    return { dialogue: dialogue(context, "dent") };
  }
  if (destination === ANDROMEDA_PLACES.pip && relevant(progress, "confession")) {
    return { dialogue: dialogue(context, "confession") };
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
      remember(progress).station = worldNearestSettlerStation(
        flightStationContext(flight),
        ECONOMY,
        flight.player,
      ).id;
      progress.stage = 3;
      break;
    case "ownsUp": {
      const stationContext = flightStationContext(flight);
      const station = worldStationById(stationContext, ECONOMY, 5, memory(progress)!.station!);
      if (!station) {
        break;
      }
      remember(progress).settlement = nearestSettlement(ECONOMY, station).id;
      progress.stage = 4;
      reserveAndromedaCourier(context);
      break;
    }
    case "parts":
      progress.questItem = ANDROMEDA_PARTS;
      progress.stage = 5;
      finishCourierAmbush(context);
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

const courierProgress = new WeakMap<FlightState, GalaxyProgress>();
const courierPlans = new WeakMap<
  FlightState,
  { readonly leg: CourierAmbushLeg; readonly plan: CourierAmbushPlan | null }
>();
const courierWarnings = new WeakSet<FlightState>();

/** Playback belongs to GameModel's flight conversation director. The save stores the phase. */
export function takeAndromedaCourierWarning(flight: FlightState) {
  return courierWarnings.delete(flight)
    ? {
        speaker: "astra" as const,
        text: "Fighters on both sides. Keep going toward the settlement.",
      }
    : undefined;
}

export function andromedaCourierAttempt(
  progress: GalaxyProgress,
): CourierAmbushAttempt | undefined {
  return memory(progress)?.courierAmbush;
}

function attemptFor(flight: FlightState): CourierAmbushAttempt | undefined {
  const progress = courierProgress.get(flight);
  return progress && andromedaCourierAttempt(progress);
}

export function andromedaCourierActor(flight: FlightState, id: string) {
  return courierAmbushActor(attemptFor(flight), id);
}

export function andromedaCourierMarkers(flight: FlightState) {
  return courierAmbushMarkers(attemptFor(flight));
}

function finishCourierAmbush({ flight, progress }: ChapterContext): void {
  const attempt = memory(progress)?.courierAmbush;
  if (attempt && "plan" in attempt && attempt.state.phase !== "ended") {
    remember(progress).courierAmbush = { ...attempt, state: { phase: "ended" } };
  }
  courierWarnings.delete(flight);
  setCourierSpawnReservation(flight, undefined);
}

function reserveAndromedaCourier(context: ChapterContext): void {
  const { content, flight, progress } = context;
  if (progress.stage !== 4) {
    return;
  }
  const attempt = andromedaCourierAttempt(progress);
  if (attempt) {
    if ("plan" in attempt && attempt.state.phase !== "ended") {
      setCourierSpawnReservation(flight, attempt.plan);
    }
    return;
  }
  const leg = courierAmbushLeg(flight, progress);
  if (!leg) {
    return;
  }
  // Test the ordinary allocation and existing objects before protecting future seeded space.
  const candidate = admitCourierAmbush(
    {
      ...questGuardPlacementContext(content, flight),
      checkPlayer: false,
      plannedClear: () => true,
      stage: progress.stage,
    },
    leg,
    undefined,
  );
  if (candidate && "packs" in candidate) {
    setCourierSpawnReservation(flight, candidate.attempt.plan);
  }
}

function mountAndromeda(context: ChapterContext): void {
  const { flight, progress } = context;
  courierProgress.set(flight, progress);
  // A real new flight clears open-space encounters. Continue retains their live or paged actors.
  if (flight.time === 0 && attemptFor(flight) && !courierAmbushRepresented(flight)) {
    finishCourierAmbush(context);
  }
  if (courierAmbushWarningActive(attemptFor(flight))) {
    courierWarnings.add(flight);
  }
  reserveAndromedaCourier(context);
  ensureAndromedaWorld(context);
}

function stepCourierAmbushLeg(context: ChapterContext, seconds: number, previous: Vec): void {
  const { content, flight, progress } = context;
  if (progress.stage !== 4) {
    return;
  }
  courierProgress.set(flight, progress);
  const clock = { ...flightWorldContext(flight), player: flight.player, previous, seconds };
  let attempt = andromedaCourierAttempt(progress);
  if (attempt?.state.phase === "ended" || attempt?.state.phase === "skipped") {
    return;
  }
  if (!attempt) {
    let geometry = courierPlans.get(flight);
    if (!geometry) {
      const leg = courierAmbushLeg(flight, progress);
      if (!leg) {
        return;
      }
      geometry = { leg, plan: planCourierAmbush(flightWorldContext(flight), leg) };
      courierPlans.set(flight, geometry);
    }
    const { leg, plan } = geometry;
    if (plan && stepCourierAmbush(clock, plan, { phase: "armed" }).phase === "armed") {
      return;
    }
    const allocation = admitCourierAmbush(
      {
        ...questGuardPlacementContext(content, flight),
        plannedClear: (plan) => courierAmbushTerrainCovered(context, plan),
        stage: progress.stage,
      },
      leg,
      undefined,
    );
    if (!allocation) {
      return;
    }
    attempt = allocation.attempt;
    if ("packs" in allocation) {
      const combat = (flight.combat ??= { initialPackSizes: {}, routeEncounters: [] });
      for (const pack of allocation.packs) {
        combat.initialPackSizes[pack] = 2;
      }
      flight.objects.push(...allocation.actors);
    }
  }
  const next = advanceCourierAmbush(clock, progress.stage, attempt);
  remember(progress).courierAmbush = next.attempt;
  if (next.attempt.state.phase === "skipped" || next.attempt.state.phase === "ended") {
    setCourierSpawnReservation(flight, undefined);
  }
  if (next.warning) {
    courierWarnings.add(flight);
  }
}

/** Arrival speaks in flight. Only Use can open and complete the corresponding exchange. */
export function stepAndromeda(
  context: ChapterContext,
  seconds = 0,
  previous = context.flight.player,
): ChapterArrivalCue | undefined {
  const { content, flight, progress } = context;
  if (flight.galaxy !== 5) {
    return undefined;
  }
  if (seconds > 0) {
    stepCourierAmbushLeg(context, seconds, previous);
  }
  const inRange = (point: Vec) => distance(point, flight.player) <= content.tuning.talkRange;
  const cue = (id: "arrival" | "dent", speaker: Speaker, place: Vec & { id: string }) => ({
    id: `chapter:andromeda:${id}:approach`,
    line: { speaker, text: ANDROMEDA_CONVERSATIONS[id].lines[0].text },
    place: place.id,
    relevant: () =>
      (id === "dent" ? progress.stage === 1 : relevant(progress, id)) && inRange(place),
  });
  if (relevant(progress, "arrival")) {
    const station = flight.objects.find(
      (place) => place.kind === "station" && progress.stations.includes(place.id) && inRange(place),
    );
    if (station) {
      return cue("arrival", "settler", station);
    }
  }
  if (progress.stage === 1) {
    const beacon = flight.objects.find((place) => place.id === ANDROMEDA_PLACES.beacon);
    if (beacon && inRange(beacon)) {
      return cue("dent", "ada", beacon);
    }
  }
  return undefined;
}

export const ANDROMEDA_RUNTIME: ChapterRuntime = {
  action: andromedaAction,
  afterStep: stepAndromeda,
  beforeStep: pageAndromedaWorld,
  choose: chooseAndromeda,
  galaxy: 5,
  init: mountAndromeda,
  objective: andromedaObjective,
  route: [ANDROMEDA_PLACES.beacon, ANDROMEDA_PLACES.pip],
  use: useAndromeda,
};
