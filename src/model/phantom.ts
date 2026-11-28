import jumpData from "../../public/art/quantum-jump.json" with { type: "json" };
import type { CapitalBossHud } from "../data/capitalBosses.ts";
import { ARCHIE_NAMED } from "../data/conversations.ts";
import { encounterTable, type EnemyArchetype } from "../data/enemyCatalog.ts";
import {
  PHANTOM_COPY,
  PHANTOM_DESTINATIONS,
  PHANTOM_FINALE_CHATTER,
  PHANTOM_FLAGSHIP,
  PHANTOM_TUNING as T,
} from "../data/phantom.ts";
import { encounterBossHud } from "./capitalBossEncounter.ts";
import type { ChapterContext, ChapterResult } from "./chapterProtocol.ts";
import { dropRandom } from "./drops.ts";
import { exclusionZoneRadius } from "./exclusionZones.ts";
import {
  activateRouteEncounter,
  ensureDestination,
  questGuardPlacementContext,
  rollEncounter,
  salvage,
  salvageTarget,
  spawnChapterEnemy,
  syncFlightRegion,
} from "./flight.ts";
import { rayCircle } from "./flight/beamContact.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { type PhantomAlly, type PhantomAllySpec, rotatePhantomAllies } from "./phantomAllies.ts";
import { placePhantomEncounter } from "./phantomEncounterPlacement/index.ts";
import { phantomFutureFlagshipGeometry } from "./phantomRequiredOccupants.ts";
import {
  type PendingPhantomEncounter,
  readPendingPhantomEncounter,
  storePendingPhantomEncounter,
  takePendingPhantomEncounter,
  validPendingPhantomEncounter,
} from "./phantomRequiredPlans.ts";
import { phantomSettlementCopy } from "./phantomSettlementCopy.ts";
import { stationFormationClear } from "./stationPlacement.ts";
import type {
  DialogueState,
  FlightEvent,
  FlightState,
  GalaxyProgress,
  SpaceObject,
  Vec,
} from "./types.ts";
import { worldDelta, worldPoint } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

export interface PhantomProgress {
  broken: string[];
  freed: string[];
  flagshipKnown: boolean;
  aftermathComplete?: true;
  surrenderAftermathDue?: true;
}
const PHANTOM_CHATTER = [
  "battleAllies",
  "battleAlone",
  "flagshipAttack",
  "flagshipHardpoint",
  "flagshipDisabled",
  ...PHANTOM_FINALE_CHATTER,
] as const;
export type PhantomChatter = (typeof PHANTOM_CHATTER)[number];

/** Emitted by the hit owner only on the first hardpoint loss, unless that hit resolves the fight. */
export interface PhantomHardpointEvent {
  readonly id: string;
  readonly type: "enemyFirstHardpointLost";
}
export interface PhantomDeparture extends Vec {
  id: string;
  age: number;
  facing?: Vec;
}
type PhantomSettlement = (typeof PHANTOM_DESTINATIONS)[number];

export type PhantomBlockadePhase =
  | { readonly phase: "warning"; readonly until: number; readonly withdrawal: Vec }
  | { readonly phase: "fighters"; readonly withdrawal: Vec }
  | {
      readonly phase: "recovery";
      readonly until: number;
      readonly withdrawal: Vec;
      cuePending?: true;
    }
  | { readonly phase: "frigate" }
  | { readonly phase: "clear" };

const BLOCKADE_WARNING_RANGE = 1_000;
const BLOCKADE_WARNING_SECONDS = 2.5;
const BLOCKADE_RECOVERY_RANGE = 500;
const BLOCKADE_RECOVERY_SECONDS = 4;

export interface PhantomFlight {
  /** Absent on old flights, which keep their existing combat and progress. */
  blockadePhases?: Partial<Record<PhantomSettlement, PhantomBlockadePhase>>;
  pendingEncounter?: PendingPhantomEncounter;
  departures?: PhantomDeparture[];
  phase: "blockades" | "approach" | "waves" | "flagship" | "salvaged";
  wave: number;
  enemyIds: string[];
  resolvedIds: string[];
  allyTurn: number;
  blockades: Record<string, string[]>;
  waypoint: Vec;
  allies: PhantomAlly[];
  disabledCued: boolean;
  chatter: PhantomChatter[];
}
export interface PhantomContext extends ChapterContext {
  readonly allies?: readonly PhantomAllySpec[];
}
type ChapterFlight = FlightState & {
  phantom?: PhantomFlight;
};
type ChapterProgress = GalaxyProgress & {
  phantom?: PhantomProgress;
};
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const progressOf = (context: ChapterContext): PhantomProgress =>
  ((context.progress as ChapterProgress).phantom ??= {
    broken: [],
    flagshipKnown: false,
    freed: [],
  });
const stateOf = (context: ChapterContext) => (context.flight as ChapterFlight).phantom;

function hasActiveFlagship(context: ChapterContext): boolean {
  const state = stateOf(context);
  return (
    context.flight.galaxy === 6 &&
    !context.progress.questComplete &&
    state?.phase === "flagship" &&
    state.enemyIds.includes(PHANTOM_FLAGSHIP)
  );
}

/** Consume only the combat owner's persisted latch at the admitted finale. */
export function settlePhantomSurrender(context: ChapterContext): boolean {
  const state = stateOf(context);
  if (
    !state ||
    !hasActiveFlagship(context) ||
    state.wave !== T.waves ||
    retained(context, PHANTOM_FLAGSHIP)?.enemy?.surrendered !== true
  ) {
    return false;
  }
  departAllies(state);
  state.phase = "salvaged";
  state.allies = [];
  if (!context.progress.holodisk) {
    progressOf(context).surrenderAftermathDue = true;
    state.chatter = [...PHANTOM_FINALE_CHATTER];
  }
  return true;
}

/** Project the live flagship into the shared HUD without changing the chapter state. */
export function phantomBossHud(
  context: ChapterContext,
  canSalvage: (object: SpaceObject) => boolean,
): CapitalBossHud | null {
  const state = stateOf(context);
  const pendingSurrender =
    context.flight.galaxy === 6 &&
    context.progress.phantom?.surrenderAftermathDue === true &&
    state?.phase === "salvaged" &&
    state.wave === T.waves &&
    state.enemyIds.includes(PHANTOM_FLAGSHIP) &&
    retained(context, PHANTOM_FLAGSHIP)?.enemy?.surrendered === true;
  if (!hasActiveFlagship(context) && !pendingSurrender) {
    return null;
  }
  return encounterBossHud(
    {
      captain: ARCHIE_NAMED.name,
      id: PHANTOM_FLAGSHIP,
      ship: context.content.labels[PHANTOM_FLAGSHIP] ?? "",
    },
    context.flight,
    canSalvage,
  );
}
/** A far-side waypoint clears every settlement, including their whole placement spread. */
export function phantomFlagshipPoint(seed: number, settlements: readonly Vec[]): Vec {
  const center = settlements.reduce(
    (sum, point) => ({
      x: sum.x + point.x / settlements.length,
      y: sum.y + point.y / settlements.length,
    }),
    { x: 0, y: 0 },
  );
  const reach =
    Math.max(0, ...settlements.map((point) => distance(center, point))) + T.flagshipDistance;
  const angle = dropRandom(seed, PHANTOM_FLAGSHIP)() * Math.PI * 2;
  return { x: center.x + Math.cos(angle) * reach, y: center.y + Math.sin(angle) * reach };
}
function spawnGroup(
  context: ChapterContext,
  archetype: EnemyArchetype,
  count: number,
  pack: string,
  center: Vec,
  home: Vec,
  routeId?: string,
  escortOf?: string,
  actors?: SpaceObject[],
): string[] {
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const id = `${pack}:${index}`;
    const angle = (index * Math.PI * 2) / count;
    const ring = count > 1 ? Math.max(110, 110 / (2 * Math.sin(Math.PI / count))) : 0;
    const point = { x: center.x + Math.cos(angle) * ring, y: center.y + Math.sin(angle) * ring };
    const spawned = spawnChapterEnemy(context.content, archetype, id, point, context.flight, {
      ...(escortOf === undefined ? {} : { escortOf }),
      home,
      packId: pack,
      ...(routeId === undefined ? {} : { routeId }),
    });
    if (actors && spawned) {
      actors.push(
        spawned,
        ...stationPopulationObjects(context.flight).filter((actor) => actor.enemy?.escortOf === id),
      );
    }
    ids.push(id);
  }
  return ids;
}
/** Initializes only a new flight; saved flight battle state is not restarted on Continue. */
export function initPhantom(context: PhantomContext): void {
  if (context.flight.galaxy !== 6 || stateOf(context)) {
    return;
  }
  const progress = progressOf(context);
  const settlements = PHANTOM_DESTINATIONS.map((id) =>
    ensureDestination(context.content, id, context.flight),
  );
  const state: PhantomFlight = {
    allies: [],
    allyTurn: 0,
    blockadePhases: {},
    blockades: {},
    chatter: [],
    disabledCued: false,
    enemyIds: [],
    phase: context.progress.questComplete
      ? "salvaged"
      : progress.flagshipKnown
        ? "approach"
        : "blockades",
    resolvedIds: [],
    wave: 0,
    waypoint: phantomFlagshipPoint(context.flight.seed, settlements),
  };
  (context.flight as ChapterFlight).phantom = state;
  if (context.progress.questComplete) {
    const hulk = spawnChapterEnemy(
      context.content,
      "capital",
      PHANTOM_FLAGSHIP,
      state.waypoint,
      context.flight,
      { home: state.waypoint },
    );
    if (hulk?.enemy) {
      hulk.hp = hulk.enemy.hp = 1;
      hulk.enemy.hardpoints.forEach((part) => {
        part.hp = 0;
      });
      hulk.enemy.disabled = true;
      hulk.enemy.salvaged = true;
      hulk.enemy.engaged = false;
      hulk.enemy.velocity = { x: 0, y: 0 };
    }
    return;
  }
  const fighter = encounterTable(6).find((entry) => entry.archetype === "fighter")!;
  for (const settlement of settlements) {
    if (progress.broken.includes(settlement.id)) {
      continue;
    }
    const ids: string[] = [];
    const next = dropRandom(context.flight.seed, `phantom:blockade:${settlement.id}`);
    for (let group = 0; group < 3; group++) {
      const angle = (group * Math.PI * 2) / 3;
      const center = {
        x: settlement.x + Math.cos(angle) * 400,
        y: settlement.y + Math.sin(angle) * 400,
      };
      const count = group ? rollEncounter([fighter], next(), next()).count : 1;
      ids.push(
        ...spawnGroup(
          context,
          group ? "fighter" : "frigate",
          count,
          `phantom:blockade:${settlement.id}:${group}`,
          center,
          settlement,
          settlement.id,
        ),
      );
    }
    state.blockades[settlement.id] = ids;
  }
  prepareNextPhantomEncounter(context);
}
function retained(context: ChapterContext, id: string): SpaceObject | null | undefined {
  return (
    context.flight.objects.find((object) => object.id === id) ?? context.flight.world.notables[id]
  );
}
/** An unloaded enemy still blocks; absence alone is never a victory condition. */
function finished(
  context: ChapterContext,
  ids: readonly string[],
  arena: Vec,
  reach: number,
): boolean {
  const state = stateOf(context)!;
  for (const id of ids) {
    if (state.resolvedIds.includes(id)) {
      continue;
    }
    const object = retained(context, id);
    if (
      object === null ||
      (object &&
        (object.hp <= 0 ||
          object.enemy?.disabled ||
          (object.enemy?.fleeing && distance(object, arena) > reach)))
    ) {
      state.resolvedIds.push(id);
    }
  }
  return ids.every((id) => state.resolvedIds.includes(id));
}
const blockadeFrigate = (site: PhantomSettlement): string => `phantom:blockade:${site}:0:0`;

function blockadeSite(id: string): id is PhantomSettlement {
  return PHANTOM_DESTINATIONS.some((known) => known === id);
}

/** Only existing chapter members are gated, including the frigate's actual attached escorts. */
export function phantomBlockadeAdmits(flight: FlightState, actor: SpaceObject): boolean {
  const state = flight.galaxy === 6 ? flight.phantom : undefined;
  if (!state?.blockadePhases) {
    return true;
  }
  for (const site of PHANTOM_DESTINATIONS) {
    const ids = state.blockades[site];
    const leader = blockadeFrigate(site);
    const primary = ids?.includes(actor.id);
    const escort = actor.enemy?.escortOf === leader && ids?.includes(leader);
    if (!primary && !escort) {
      continue;
    }
    const phase = state.blockadePhases[site]?.phase;
    if (actor.id === leader || escort) {
      return phase === "frigate" || phase === "clear";
    }
    return !state.resolvedIds.includes(actor.id) && (phase === "fighters" || phase === "frigate");
  }
  return true;
}

export function phantomBlockadeSignal(context: PhantomContext, id: string) {
  const phase = blockadeSite(id) ? stateOf(context)?.blockadePhases?.[id] : undefined;
  const site = retained(context, id);
  if (!phase || !site) {
    return null;
  }
  if (phase.phase === "warning") {
    return { phase: "warning" as const, site: { x: site.x, y: site.y } };
  }
  if (phase.phase === "recovery") {
    return {
      cuePending: phase.cuePending === true,
      phase: "recovery" as const,
      site: { x: site.x, y: site.y },
      withdrawal: phase.withdrawal,
    };
  }
  return null;
}

/** The display owner acknowledges only after the recovery cue actually shows. */
export function acknowledgePhantomBlockadeRecovery(context: PhantomContext, id: string): void {
  const phase = blockadeSite(id) ? stateOf(context)?.blockadePhases?.[id] : undefined;
  if (phase?.phase === "recovery") {
    delete phase.cuePending;
  }
}

/** The first inbound intersection, using the same wrapped image for the whole step. */
function crossedRecoveryLine(
  flight: FlightState,
  site: Vec,
  previous: Vec,
  seconds: number,
  until: number,
): boolean {
  const world = flightWorldContext(flight);
  const centre = worldPoint(world, previous, site);
  const travel = worldDelta(world, previous, flight.player);
  const range = Math.hypot(travel.x, travel.y);
  if (
    range === 0 ||
    distance(previous, centre) <= BLOCKADE_RECOVERY_RANGE ||
    Math.hypot(previous.x + travel.x - centre.x, previous.y + travel.y - centre.y) >
      BLOCKADE_RECOVERY_RANGE
  ) {
    return false;
  }
  const entry = rayCircle(
    previous,
    { x: travel.x / range, y: travel.y / range },
    range,
    centre,
    BLOCKADE_RECOVERY_RANGE,
  );
  return entry !== null && flight.time - seconds * (1 - entry / range) + 1e-9 >= until;
}

function stepBlockade(
  context: PhantomContext,
  seconds: number,
  previous: Vec,
  site: SpaceObject,
  id: PhantomSettlement,
  ids: readonly string[],
): void {
  const flight = context.flight;
  const phases = stateOf(context)?.blockadePhases;
  if (!phases) {
    return;
  }
  const phase = phases[id];
  if (!phase) {
    const world = flightWorldContext(flight);
    const approach = worldDelta(world, site, previous);
    const before = Math.hypot(approach.x, approach.y);
    const now = worldDelta(world, site, flight.player);
    const gap = Math.hypot(now.x, now.y);
    if (gap <= BLOCKADE_WARNING_RANGE && gap < before) {
      const withdrawal = {
        x: site.x + (approach.x / before) * BLOCKADE_WARNING_RANGE,
        y: site.y + (approach.y / before) * BLOCKADE_WARNING_RANGE,
      };
      phases[id] = {
        phase: "warning",
        until: flight.time + BLOCKADE_WARNING_SECONDS,
        withdrawal:
          world.worldSide === undefined ? withdrawal : wrapPoint(world.worldSide, withdrawal),
      };
    }
    return;
  }
  if (phase.phase === "warning" && flight.time + 1e-9 >= phase.until) {
    phases[id] = { phase: "fighters", withdrawal: phase.withdrawal };
  } else if (
    phase.phase === "fighters" &&
    finished(
      context,
      ids.filter((actor) => actor !== blockadeFrigate(id)),
      site,
      T.blockadeReach,
    )
  ) {
    phases[id] = {
      cuePending: true,
      phase: "recovery",
      until: flight.time + BLOCKADE_RECOVERY_SECONDS,
      withdrawal: phase.withdrawal,
    };
  } else if (
    phase.phase === "recovery" &&
    crossedRecoveryLine(flight, site, previous, seconds, phase.until)
  ) {
    phases[id] = { phase: "frigate" };
  }
}

function departAllies(state: PhantomFlight): void {
  const leaving = new Set(state.allies.map((ally) => ally.id));
  state.departures = [
    ...(state.departures ?? []).filter((ally) => !leaving.has(ally.id)),
    ...state.allies.map((ally) => ({
      age: 0,
      facing: { ...ally.facing },
      id: ally.id,
      x: ally.x,
      y: ally.y,
    })),
  ].slice(-T.allies * 4);
}
/** Only the next phase is constructed; the original per-wave stream and draw order are unchanged. */
export function prepareNextPhantomEncounter(context: PhantomContext): void {
  const state = stateOf(context);
  if (
    !state ||
    context.progress.questComplete ||
    state.phase === "flagship" ||
    state.phase === "salvaged" ||
    readPendingPhantomEncounter(context.flight)
  ) {
    return;
  }
  const projection = structuredClone(context.flight);
  projection.objects = [];
  projection.world = { notables: {}, version: 1 };
  delete projection.combat;
  delete projection.phantom!.pendingEncounter;
  const projected = { ...context, flight: projection };
  const actors: SpaceObject[] = [];
  const groups: SpaceObject[][] = [];
  const enemyIds: string[] = [];
  let pending: PendingPhantomEncounter;
  if (state.wave < T.waves) {
    const wave = state.wave + 1;
    const table = encounterTable(6).filter((entry) => entry.archetype !== "capital");
    const next = dropRandom(context.flight.seed, `phantom:wave:${wave}`);
    for (let group = 0; group < T.encountersPerWave; group++) {
      const entry = rollEncounter(table, next(), next());
      const angle = next() * Math.PI * 2;
      const center = {
        x: state.waypoint.x + Math.cos(angle) * 700,
        y: state.waypoint.y + Math.sin(angle) * 700,
      };
      const first = actors.length;
      enemyIds.push(
        ...spawnGroup(
          projected,
          entry.archetype,
          entry.count,
          `phantom:wave:${wave}:${group}`,
          center,
          state.waypoint,
          undefined,
          undefined,
          actors,
        ),
      );
      groups.push(actors.slice(first));
    }
    pending = { actors, enemyIds, kind: "wave", wave };
  } else if (state.phase === "waves") {
    const leader = spawnChapterEnemy(
      context.content,
      "capital",
      PHANTOM_FLAGSHIP,
      state.waypoint,
      projection,
      { home: state.waypoint },
    );
    if (!leader) {
      throw new Error("Required flagship construction failed");
    }
    actors.push(leader);
    groups.push([leader]);
    enemyIds.push(
      PHANTOM_FLAGSHIP,
      ...spawnGroup(
        projected,
        "fighter",
        T.escorts,
        "phantom:flagship:escorts",
        { x: state.waypoint.x, y: state.waypoint.y + 200 },
        state.waypoint,
        undefined,
        PHANTOM_FLAGSHIP,
        actors,
      ),
    );
    groups.push(actors.slice(1));
    pending = { actors, enemyIds, kind: "flagship" };
  } else {
    return;
  }
  const represented = stationPopulationObjects(context.flight);
  const fixed =
    pending.kind === "flagship"
      ? []
      : phantomFutureFlagshipGeometry(context.content, context.flight);
  const placementFlight = (objects: readonly SpaceObject[]): FlightState => ({
    ...context.flight,
    objects: [...objects, ...fixed],
    world: { notables: {}, version: 1 },
  });
  const placement = (objects: readonly SpaceObject[], checkPlayer: boolean) => ({
    ...questGuardPlacementContext(context.content, placementFlight(objects)),
    checkPlayer,
    fixedIds: new Set([PHANTOM_FLAGSHIP]),
    waypoint: state.waypoint,
  });
  const placed =
    placePhantomEncounter(placement(represented, false), groups) ??
    placePhantomEncounter(
      placement(
        represented.filter((actor) => exclusionZoneRadius(context.content, actor) !== null),
        false,
      ),
      groups,
    );
  if (placed) {
    storePendingPhantomEncounter(context.flight, { ...pending, actors: placed });
  }
}

/** Fit is proved before removing hidden ownership or changing any chapter phase metadata. */
function activateNextPhantomEncounter(context: PhantomContext): boolean {
  prepareNextPhantomEncounter(context);
  const pending = readPendingPhantomEncounter(context.flight);
  if (
    !pending ||
    pending.kind === "blockades" ||
    !stationFormationClear(
      questGuardPlacementContext(context.content, context.flight),
      pending.actors,
    )
  ) {
    return false;
  }
  const batch = pending;
  if (takePendingPhantomEncounter(context.flight) !== batch) {
    throw new Error("Pending Phantom ownership changed during synchronous activation");
  }
  const state = stateOf(context)!;
  departAllies(state);
  context.flight.objects.push(...batch.actors);
  const combat = (context.flight.combat ??= { initialPackSizes: {}, routeEncounters: [] });
  for (const actor of batch.actors) {
    const pack = actor.enemy?.packId;
    if (pack) {
      combat.initialPackSizes[pack] = (combat.initialPackSizes[pack] ?? 0) + 1;
    }
  }
  if (batch.kind === "wave") {
    state.wave = batch.wave;
    state.allyTurn = state.wave - 1;
    state.phase = "waves";
  } else {
    state.allyTurn = T.waves;
    state.phase = "flagship";
  }
  state.enemyIds = [...batch.enemyIds];
  state.allies = rotatePhantomAllies(context.allies ?? [], state.allyTurn, context.flight);
  syncFlightRegion(context.content, context.flight);
  prepareNextPhantomEncounter(context);
  return true;
}
export function beforeStepPhantom(context: PhantomContext, seconds = 0): void {
  const state = stateOf(context);
  if (state?.departures) {
    for (const ally of state.departures) {
      ally.age += Math.max(0, seconds);
    }
    state.departures = state.departures.filter((ally) => ally.age * 1000 < jumpData.durationMs);
  }
  prepareNextPhantomEncounter(context);
  if (!state || context.progress.questComplete || !progressOf(context).flagshipKnown) {
    return;
  }
  if (
    state.phase === "approach" &&
    distance(context.flight.player, state.waypoint) <= T.battleReach
  ) {
    if (activateNextPhantomEncounter(context)) {
      state.chatter.push(state.allies.length ? "battleAllies" : "battleAlone");
    }
  }
}
export function afterStepPhantom(
  context: PhantomContext,
  seconds?: number,
  previous?: Vec,
  events: readonly (FlightEvent | PhantomHardpointEvent)[] = [],
): void {
  const state = stateOf(context);
  if (!state || context.progress.questComplete) {
    return;
  }
  // A separate final hit in this update still leaves the first loss ahead of surrender.
  if (
    hasActiveFlagship(context) &&
    events.some(
      (event) => event.type === "enemyFirstHardpointLost" && event.id === PHANTOM_FLAGSHIP,
    ) &&
    !state.chatter.includes("flagshipHardpoint")
  ) {
    state.chatter.push("flagshipHardpoint");
  }
  const progress = progressOf(context);
  for (const [id, ids] of Object.entries(state.blockades)) {
    const settlement = retained(context, id);
    if (settlement && !progress.broken.includes(id)) {
      if (
        blockadeSite(id) &&
        previous &&
        seconds !== undefined &&
        Number.isFinite(seconds) &&
        seconds > 0
      ) {
        stepBlockade(context, seconds, previous, settlement, id, ids);
      }
      if (finished(context, ids, settlement, T.blockadeReach)) {
        progress.broken.push(id);
        if (blockadeSite(id) && state.blockadePhases) {
          state.blockadePhases[id] = { phase: "clear" };
        }
      }
    }
    if (progress.broken.includes(id)) {
      // Unindex dormant guards before clearing their route membership. Survivors keep their AI and identity.
      activateRouteEncounter(context.content, id, context.flight);
      for (const object of context.flight.objects) {
        if (ids.includes(object.id) && object.routeId === id) {
          delete object.routeId;
        }
      }
    }
  }
  if (state.phase === "waves" && finished(context, state.enemyIds, state.waypoint, T.battleReach)) {
    const flagship = state.wave === T.waves;
    if (activateNextPhantomEncounter(context) && flagship) {
      state.chatter.push("flagshipAttack");
    }
  }

  if (
    state.phase === "flagship" &&
    !state.disabledCued &&
    retained(context, PHANTOM_FLAGSHIP)?.enemy?.disabled
  ) {
    state.disabledCued = true;
    state.chatter.push("flagshipDisabled");
  }
}
export function phantomObjective(context: ChapterContext): string | null {
  if (context.progress.questComplete) {
    return null;
  }
  const progress = progressOf(context);
  const ids = PHANTOM_DESTINATIONS.filter((id) => !progress.broken.includes(id));
  const objects = ids
    .map(
      (id) =>
        context.flight.objects.find((object) => object.id === id) ??
        context.flight.world.notables[id],
    )
    .filter((object): object is SpaceObject => Boolean(object));
  const nearest = objects.sort(
    (a, b) => distance(a, context.flight.player) - distance(b, context.flight.player),
  )[0];
  return (
    nearest?.id ??
    PHANTOM_DESTINATIONS.find((id) => !progress.freed.includes(id)) ??
    (progress.flagshipKnown ? PHANTOM_FLAGSHIP : null)
  );
}
export function phantomWaypoint(context: ChapterContext): Vec | null {
  return progressOf(context).flagshipKnown ? (stateOf(context)?.waypoint ?? null) : null;
}
/** The chapter's approved objective text follows its actual blockade and battle state. */
export function phantomObjectiveIndex(context: ChapterContext): number {
  if (context.progress.questComplete || context.progress.holodisk) {
    return 6;
  }
  const progress = progressOf(context);
  if (
    !progress.broken.length &&
    !PHANTOM_DESTINATIONS.some((id) => context.progress.known.includes(id))
  ) {
    return 0;
  }
  if (progress.broken.length < PHANTOM_DESTINATIONS.length) {
    return 1;
  }
  if (progress.freed.length < PHANTOM_DESTINATIONS.length) {
    return 2;
  }
  const state = stateOf(context);
  if (!state || state.phase === "approach" || state.phase === "blockades") {
    return 3;
  }
  if (state.phase === "salvaged") {
    return 6;
  }
  return retained(context, PHANTOM_FLAGSHIP)?.enemy?.disabled ? 5 : 4;
}
function panel(key: string, copyKey = key): DialogueState {
  const copy = PHANTOM_COPY[copyKey]!;
  return {
    choices: [{ id: "continue", label: "Continue" }],
    context: `phantom.${key}`,
    text: copy.lines.map((line) => line.text).join("\n\n"),
    title: "The Garden Party",
  };
}
function settlementTalkCopy(context: ChapterContext, id: string): string | null {
  const progress = context.progress.phantom;
  return progress?.broken.includes(id) ? phantomSettlementCopy(progress.freed, id) : null;
}

/** The settlement offers Talk only when its existing blockade outcome admits an exchange. */
export function phantomAction(context: ChapterContext, id: string): "talk" | undefined {
  return settlementTalkCopy(context, id) === null ? undefined : "talk";
}

export function usePhantom(context: PhantomContext, id: string): ChapterResult | undefined {
  if (blockadeSite(id)) {
    const copy = settlementTalkCopy(context, id);
    return copy ? { dialogue: panel(id, copy) } : {};
  }
  const target = salvageTarget(context.content, context.flight);
  if (id === PHANTOM_FLAGSHIP && target?.id === PHANTOM_FLAGSHIP && !context.progress.holodisk) {
    return { dialogue: panel("flagshipSalvage") };
  }
  return undefined;
}
/** Only the offered Continue commits the settlement or holodisk outcome. */
export function choosePhantom(
  context: PhantomContext,
  dialogue: DialogueState,
  choice: string,
): ChapterResult | undefined {
  if (!dialogue.context.startsWith("phantom.")) {
    return undefined;
  }
  if (
    choice !== "continue" ||
    !dialogue.choices.some((offered) => offered.id === choice && !offered.refused)
  ) {
    return {};
  }
  const key = dialogue.context.slice("phantom.".length);
  const progress = progressOf(context);
  if (PHANTOM_DESTINATIONS.some((id) => id === key) && progress.broken.includes(key)) {
    if (!progress.freed.includes(key)) {
      progress.freed.push(key);
      const state = stateOf(context)!;
      if (
        progress.freed.length === PHANTOM_DESTINATIONS.length &&
        !progress.flagshipKnown &&
        state.phase === "blockades"
      ) {
        progress.flagshipKnown = true;
        state.phase = "approach";
      }
    }
    return {};
  }
  if (
    key === "flagshipSalvage" &&
    !context.progress.holodisk &&
    salvageTarget(context.content, context.flight)?.id === PHANTOM_FLAGSHIP &&
    salvage(context.content, context.flight)
  ) {
    const state = stateOf(context)!;
    departAllies(state);
    state.phase = "salvaged";
    state.allies = [];
    return { complete: true, holodisk: {} };
  }
  return {};
}
export function validPhantomProgress(value: unknown): value is PhantomProgress {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as PhantomProgress;
  const ids = (list: unknown): list is string[] =>
    Array.isArray(list) &&
    new Set(list).size === list.length &&
    list.every((id) => PHANTOM_DESTINATIONS.some((known) => known === id));
  return (
    ids(state.broken) &&
    ids(state.freed) &&
    state.freed.every((id) => state.broken.includes(id)) &&
    (state.surrenderAftermathDue === undefined ||
      (state.surrenderAftermathDue === true &&
        state.aftermathComplete === undefined &&
        state.flagshipKnown)) &&
    (state.aftermathComplete === undefined ||
      (state.aftermathComplete === true &&
        state.flagshipKnown &&
        state.freed.length === PHANTOM_DESTINATIONS.length)) &&
    typeof state.flagshipKnown === "boolean" &&
    (!state.flagshipKnown || state.freed.length === PHANTOM_DESTINATIONS.length)
  );
}
function validBlockadePhases(state: PhantomFlight): boolean {
  const phases = state.blockadePhases;
  if (phases === undefined) {
    return true;
  }
  if (!phases || typeof phases !== "object" || Array.isArray(phases)) {
    return false;
  }
  return Object.entries(phases).every(([id, phase]) => {
    if (
      !blockadeSite(id) ||
      !Object.hasOwn(state.blockades, id) ||
      !phase ||
      typeof phase !== "object"
    ) {
      return false;
    }
    const members = state.blockades[id]!;
    const fightersResolved = () =>
      members.every((actor) => actor === blockadeFrigate(id) || state.resolvedIds.includes(actor));
    const keys = Object.keys(phase).length;
    switch (phase.phase) {
      case "clear":
        return keys === 1 && members.every((actor) => state.resolvedIds.includes(actor));
      case "frigate":
        return keys === 1 && fightersResolved();
      case "warning":
      case "fighters":
      case "recovery": {
        const point = phase.withdrawal;
        if (
          !point ||
          typeof point !== "object" ||
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y)
        ) {
          return false;
        }
        if (phase.phase === "fighters") {
          return keys === 2;
        }
        if (!Number.isFinite(phase.until) || phase.until < 0) {
          return false;
        }
        return phase.phase === "warning"
          ? keys === 3
          : (keys === 3 || (keys === 4 && phase.cuePending === true)) && fightersResolved();
      }
      default:
        return false;
    }
  });
}

/** Chapter-local state is finite and references only its authored encounters. */
export function validPhantomFlight(value: unknown): value is PhantomFlight {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as PhantomFlight;
  const point = (p: unknown): p is Vec =>
    Boolean(p) &&
    typeof p === "object" &&
    Number.isFinite((p as Vec).x) &&
    Number.isFinite((p as Vec).y);
  const id = (value: unknown) =>
    typeof value === "string" &&
    (value === PHANTOM_FLAGSHIP ||
      /^phantom:(blockade:phantomSettlement[123]:[012]|wave:[123]:[01]|flagship:escorts):\d+$/.test(
        value,
      ));
  const ids = (value: unknown): value is string[] =>
    Array.isArray(value) &&
    value.length <= 200 &&
    value.every(id) &&
    new Set(value).size === value.length;
  return (
    ["blockades", "approach", "waves", "flagship", "salvaged"].includes(state.phase) &&
    Number.isInteger(state.wave) &&
    state.wave >= 0 &&
    state.wave <= T.waves &&
    Number.isInteger(state.allyTurn) &&
    state.allyTurn >= 0 &&
    state.allyTurn <= T.waves &&
    (state.departures === undefined ||
      (Array.isArray(state.departures) &&
        state.departures.length <= T.allies * 4 &&
        new Set(state.departures.map((ally) => ally.id)).size === state.departures.length &&
        state.departures.every(
          (ally) =>
            point(ally) &&
            (ally.facing === undefined || point(ally.facing)) &&
            typeof ally.id === "string" &&
            ally.id.length > 0 &&
            ally.id.length <= 100 &&
            Number.isFinite(ally.age) &&
            ally.age >= 0 &&
            ally.age * 1000 < jumpData.durationMs,
        ))) &&
    (state.pendingEncounter === undefined ||
      validPendingPhantomEncounter(state, state.pendingEncounter)) &&
    ids(state.enemyIds) &&
    ids(state.resolvedIds) &&
    point(state.waypoint) &&
    Boolean(state.blockades) &&
    typeof state.blockades === "object" &&
    Object.entries(state.blockades).every(
      ([key, members]) => PHANTOM_DESTINATIONS.some((id) => id === key) && ids(members),
    ) &&
    validBlockadePhases(state) &&
    typeof state.disabledCued === "boolean" &&
    Array.isArray(state.chatter) &&
    state.chatter.length <= 4 &&
    state.chatter.every((key) => PHANTOM_CHATTER.includes(key)) &&
    Array.isArray(state.allies) &&
    state.allies.length <= T.allies &&
    new Set(state.allies.map((ally) => ally.id)).size === state.allies.length &&
    state.allies.every(
      (ally) =>
        point(ally) &&
        point(ally.velocity) &&
        point(ally.facing) &&
        typeof ally.id === "string" &&
        ally.id.length > 0 &&
        ally.id.length <= 100 &&
        Number.isInteger(ally.galaxy) &&
        ally.galaxy >= 1 &&
        ally.galaxy <= 5 &&
        ["escort", "chase", "whale"].includes(ally.behavior) &&
        Number.isFinite(ally.radius) &&
        ally.radius > 0 &&
        Number.isFinite(ally.fireIn) &&
        ally.fireIn >= 0 &&
        Number.isFinite(ally.jumpAge) &&
        ally.jumpAge >= 0 &&
        (ally.song === undefined || typeof ally.song === "boolean"),
    )
  );
}
