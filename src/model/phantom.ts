import jumpData from "../../public/art/quantum-jump.json";
import { encounterTable, type EnemyArchetype } from "../data/enemyCatalog.ts";
import {
  PHANTOM_COPY,
  PHANTOM_DESTINATIONS,
  PHANTOM_FLAGSHIP,
  PHANTOM_TUNING as T,
} from "../data/phantom.ts";
import type { ChapterContext, ChapterResult } from "./chapterProtocol.ts";
import { dropRandom } from "./drops.ts";
import {
  activateRouteEncounter,
  ensureDestination,
  rollEncounter,
  salvage,
  salvageTarget,
  spawnChapterEnemy,
} from "./flight.ts";
import { type PhantomAlly, type PhantomAllySpec, rotatePhantomAllies } from "./phantomAllies.ts";
import type { DialogueState, FlightState, GalaxyProgress, SpaceObject, Vec } from "./types.ts";
export interface PhantomProgress {
  broken: string[];
  freed: string[];
  flagshipKnown: boolean;
  aftermathComplete?: true;
}
export type PhantomChatter = "battleAllies" | "battleAlone" | "flagshipAttack" | "flagshipDisabled";
export interface PhantomDeparture extends Vec {
  id: string;
  age: number;
}
export interface PhantomFlight {
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
): string[] {
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const id = `${pack}:${index}`;
    const angle = (index * Math.PI * 2) / count;
    const ring = count > 1 ? Math.max(110, 110 / (2 * Math.sin(Math.PI / count))) : 0;
    const point = { x: center.x + Math.cos(angle) * ring, y: center.y + Math.sin(angle) * ring };
    spawnChapterEnemy(context.content, archetype, id, point, context.flight, {
      ...(escortOf === undefined ? {} : { escortOf }),
      home,
      packId: pack,
      ...(routeId === undefined ? {} : { routeId }),
    });
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
function departAllies(state: PhantomFlight): void {
  const leaving = new Set(state.allies.map((ally) => ally.id));
  state.departures = [
    ...(state.departures ?? []).filter((ally) => !leaving.has(ally.id)),
    ...state.allies.map((ally) => ({ age: 0, id: ally.id, x: ally.x, y: ally.y })),
  ].slice(-T.allies * 4);
}
function nextWave(context: PhantomContext): void {
  const state = stateOf(context)!;
  departAllies(state);
  state.wave++;
  state.allyTurn = state.wave - 1;
  state.allies = rotatePhantomAllies(context.allies ?? [], state.allyTurn, context.flight.player);
  const table = encounterTable(6).filter((entry) => entry.archetype !== "capital");
  const next = dropRandom(context.flight.seed, `phantom:wave:${state.wave}`);
  state.enemyIds = [];
  for (let group = 0; group < T.encountersPerWave; group++) {
    const entry = rollEncounter(table, next(), next());
    const angle = next() * Math.PI * 2;
    const center = {
      x: state.waypoint.x + Math.cos(angle) * 700,
      y: state.waypoint.y + Math.sin(angle) * 700,
    };
    state.enemyIds.push(
      ...spawnGroup(
        context,
        entry.archetype,
        entry.count,
        `phantom:wave:${state.wave}:${group}`,
        center,
        state.waypoint,
      ),
    );
  }
  state.phase = "waves";
}
export function beforeStepPhantom(context: PhantomContext, seconds = 0): void {
  const state = stateOf(context);
  if (state?.departures) {
    for (const ally of state.departures) {
      ally.age += Math.max(0, seconds);
    }
    state.departures = state.departures.filter((ally) => ally.age * 1000 < jumpData.durationMs);
  }
  if (!state || context.progress.questComplete || !progressOf(context).flagshipKnown) {
    return;
  }
  if (
    state.phase === "approach" &&
    distance(context.flight.player, state.waypoint) <= T.battleReach
  ) {
    nextWave(context);
    state.chatter.push(state.allies.length ? "battleAllies" : "battleAlone");
  }
}
export function afterStepPhantom(context: PhantomContext): ChapterResult | undefined {
  const state = stateOf(context);
  if (!state || context.progress.questComplete) {
    return undefined;
  }
  const progress = progressOf(context);
  for (const [id, ids] of Object.entries(state.blockades)) {
    const settlement = retained(context, id);
    if (
      settlement &&
      !progress.broken.includes(id) &&
      finished(context, ids, settlement, T.blockadeReach)
    ) {
      progress.broken.push(id);
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
    if (state.wave < T.waves) {
      nextWave(context);
    } else {
      departAllies(state);
      state.phase = "flagship";
      state.allyTurn = T.waves;
      state.allies = rotatePhantomAllies(
        context.allies ?? [],
        state.allyTurn,
        context.flight.player,
      );
      spawnChapterEnemy(
        context.content,
        "capital",
        PHANTOM_FLAGSHIP,
        state.waypoint,
        context.flight,
        { home: state.waypoint },
      );
      state.enemyIds = [
        PHANTOM_FLAGSHIP,
        ...spawnGroup(
          context,
          "fighter",
          T.escorts,
          "phantom:flagship:escorts",
          { x: state.waypoint.x, y: state.waypoint.y + 200 },
          state.waypoint,
          undefined,
          PHANTOM_FLAGSHIP,
        ),
      ];
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
  return undefined;
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
function panel(key: string): DialogueState {
  const copy = PHANTOM_COPY[key]!;
  return {
    choices: [{ id: "continue", label: "Continue" }],
    context: `phantom.${key}`,
    text: copy.lines.map((line) => line.text).join("\n\n"),
    title: "The Garden Party",
  };
}
export function usePhantom(context: PhantomContext, id: string): ChapterResult | undefined {
  const progress = progressOf(context);
  if (PHANTOM_DESTINATIONS.some((settlement) => settlement === id)) {
    if (!progress.broken.includes(id)) {
      return {};
    }
    return { dialogue: panel(id) };
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
    (state.aftermathComplete === undefined ||
      (state.aftermathComplete === true &&
        state.flagshipKnown &&
        state.freed.length === PHANTOM_DESTINATIONS.length)) &&
    typeof state.flagshipKnown === "boolean" &&
    (!state.flagshipKnown || state.freed.length === PHANTOM_DESTINATIONS.length)
  );
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
            typeof ally.id === "string" &&
            ally.id.length > 0 &&
            ally.id.length <= 100 &&
            Number.isFinite(ally.age) &&
            ally.age >= 0 &&
            ally.age * 1000 < jumpData.durationMs,
        ))) &&
    ids(state.enemyIds) &&
    ids(state.resolvedIds) &&
    point(state.waypoint) &&
    Boolean(state.blockades) &&
    typeof state.blockades === "object" &&
    Object.entries(state.blockades).every(
      ([key, members]) => PHANTOM_DESTINATIONS.some((id) => id === key) && ids(members),
    ) &&
    typeof state.disabledCued === "boolean" &&
    Array.isArray(state.chatter) &&
    state.chatter.length <= 4 &&
    state.chatter.every((key) =>
      ["battleAllies", "battleAlone", "flagshipAttack", "flagshipDisabled"].includes(key),
    ) &&
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
