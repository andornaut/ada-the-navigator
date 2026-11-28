import { encounterTable, FRIGATE_ESCORT_COUNT } from "../data/enemyCatalog.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP, PHANTOM_TUNING as T } from "../data/phantom.ts";
import { FRIGATE_ESCORT_ROLE, requiredFrigateEscortId } from "./frigateEscorts.ts";
import { escortPackId } from "./geography.ts";
import type { PhantomFlight } from "./phantomState.ts";
import { requiredPlanObjects } from "./requiredEncounterPlans.ts";
import type { FlightState, SpaceObject } from "./types.ts";

type Settlement = (typeof PHANTOM_DESTINATIONS)[number];
/** Only the next authored batch is stored; its full actors remain outside the active world. */
export type PendingPhantomEncounter =
  | {
      kind: "blockades";
      blockades: Readonly<Partial<Record<Settlement, readonly string[]>>>;
      actors: readonly SpaceObject[];
    }
  | { kind: "wave"; wave: number; enemyIds: readonly string[]; actors: readonly SpaceObject[] }
  | { kind: "flagship"; enemyIds: readonly string[]; actors: readonly SpaceObject[] };

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((id) => typeof id === "string") &&
  new Set(value).size === value.length;

function livePending(value: unknown): value is SpaceObject {
  if (!record(value) || !record(value.enemy)) {
    return false;
  }
  return (
    value.kind === "enemy" &&
    value.persistent === true &&
    typeof value.id === "string" &&
    value.enemy.id === value.id &&
    typeof value.hp === "number" &&
    value.hp > 0 &&
    typeof value.enemy.hp === "number" &&
    value.enemy.hp > 0 &&
    !value.enemy.disabled &&
    !value.enemy.salvaged
  );
}

/** Role validation supplements the save boundary's canonical full SpaceObject reader. */
export function validPendingPhantomEncounter(
  state: PhantomFlight,
  value: unknown,
): value is PendingPhantomEncounter {
  if (
    !record(state.blockades) ||
    !record(value) ||
    !Array.isArray(value.actors) ||
    !value.actors.length ||
    !value.actors.every(livePending) ||
    new Set(value.actors.map((actor) => actor.id)).size !== value.actors.length
  ) {
    return false;
  }
  const actors = new Map(value.actors.map((actor) => [actor.id, actor]));
  const primary: string[] = [];
  const group = (
    members: readonly string[],
    pack: string,
    archetype?: string,
    routeId?: string,
    escortOf: string | null = null,
  ): boolean => {
    const first = actors.get(members[0] ?? "");
    const kind = archetype ?? first?.enemy?.archetype;
    const entry = encounterTable(6).find(
      (entry) => entry.archetype === kind && entry.archetype !== "capital",
    );
    if (
      !members.length ||
      (!archetype && !entry) ||
      (entry && (members.length < entry.groupSize[0] || members.length > entry.groupSize[1]))
    ) {
      return false;
    }
    for (let index = 0; index < members.length; index++) {
      const id = members[index]!,
        actor = actors.get(id);
      if (
        id !== `${pack}:${index}` ||
        !actor?.enemy ||
        actor.enemy.archetype !== kind ||
        actor.enemy.packId !== pack ||
        actor.enemy.escortOf !== escortOf ||
        actor.routeId !== routeId
      ) {
        return false;
      }
      primary.push(id);
    }
    return true;
  };
  if (value.kind === "blockades") {
    if (
      Object.keys(value).length !== 3 ||
      state.wave !== 0 ||
      !["blockades", "approach"].includes(state.phase) ||
      Object.keys(state.blockades).length ||
      !record(value.blockades) ||
      !Object.keys(value.blockades).length ||
      Object.keys(value.blockades).some((id) => !PHANTOM_DESTINATIONS.some((known) => known === id))
    ) {
      return false;
    }
    for (const settlement of PHANTOM_DESTINATIONS) {
      const members = value.blockades[settlement];
      if (members === undefined) {
        continue;
      }
      if (!ids(members)) {
        return false;
      }
      let offset = 0;
      for (let index = 0; index < 3; index++) {
        const pack = `phantom:blockade:${settlement}:${index}`;
        const selected = members.filter((id) => id.startsWith(`${pack}:`));
        if (
          members.slice(offset, offset + selected.length).join() !== selected.join() ||
          (index === 0 && selected.length !== 1) ||
          !group(selected, pack, index === 0 ? "frigate" : "fighter", settlement)
        ) {
          return false;
        }
        offset += selected.length;
      }
      if (offset !== members.length) {
        return false;
      }
    }
  } else if (value.kind === "wave") {
    if (
      Object.keys(value).length !== 4 ||
      !Number.isInteger(value.wave) ||
      value.wave !== state.wave + 1 ||
      (value.wave as number) > T.waves ||
      (state.wave === 0
        ? !["blockades", "approach"].includes(state.phase)
        : state.phase !== "waves") ||
      !ids(value.enemyIds)
    ) {
      return false;
    }
    let offset = 0;
    for (let index = 0; index < T.encountersPerWave; index++) {
      const pack = `phantom:wave:${value.wave}:${index}`;
      const selected = value.enemyIds.filter((id) => id.startsWith(`${pack}:`));
      if (
        value.enemyIds.slice(offset, offset + selected.length).join() !== selected.join() ||
        !group(selected, pack)
      ) {
        return false;
      }
      offset += selected.length;
    }
    if (offset !== value.enemyIds.length) {
      return false;
    }
  } else if (value.kind === "flagship") {
    if (
      Object.keys(value).length !== 3 ||
      state.phase !== "waves" ||
      state.wave !== T.waves ||
      !ids(value.enemyIds) ||
      value.enemyIds.length !== T.escorts + 1 ||
      value.enemyIds[0] !== PHANTOM_FLAGSHIP
    ) {
      return false;
    }
    const leader = actors.get(PHANTOM_FLAGSHIP);
    if (
      value.actors.map(({ id }) => id).join() !== value.enemyIds.join() ||
      !leader?.enemy ||
      leader.enemy.archetype !== "capital" ||
      leader.enemy.packId !== null ||
      leader.enemy.escortOf !== null ||
      leader.routeId !== undefined
    ) {
      return false;
    }
    primary.push(PHANTOM_FLAGSHIP);
    // The authored flagship's eight fighters are independent of ambient fighter group sizes.
    for (let index = 0; index < T.escorts; index++) {
      const id = `phantom:flagship:escorts:${index}`,
        actor = actors.get(id);
      if (
        value.enemyIds[index + 1] !== id ||
        !actor?.enemy ||
        actor.enemy.archetype !== "fighter" ||
        actor.enemy.packId !== "phantom:flagship:escorts" ||
        actor.enemy.escortOf !== PHANTOM_FLAGSHIP ||
        actor.routeId !== undefined
      ) {
        return false;
      }
      primary.push(id);
    }
  } else {
    return false;
  }
  const owned = new Set(primary);
  if (owned.size !== primary.length) {
    return false;
  }
  for (const id of primary) {
    const leader = actors.get(id)!;
    if (leader.enemy!.archetype !== "frigate") {
      continue;
    }
    for (let index = 0; index < FRIGATE_ESCORT_COUNT; index++) {
      const followerId = requiredFrigateEscortId(id, index),
        follower = actors.get(followerId);
      if (!follower) {
        continue;
      }
      if (
        !follower.enemy ||
        follower.enemy.archetype !== "fighter" ||
        follower.enemy.escortOf !== id ||
        follower.enemy.packId !== escortPackId(leader.enemy!.packId ?? id) ||
        follower.routeId !== undefined ||
        follower.role !== FRIGATE_ESCORT_ROLE
      ) {
        return false;
      }
      owned.add(followerId);
    }
  }
  return owned.size === actors.size;
}

/** Authoritative actors, tombstones and current chapter IDs cannot also be pending. */
export function pendingPhantomEncounterUnshared(
  flight: FlightState,
  pending: PendingPhantomEncounter,
): boolean {
  if (
    flight.galaxy !== 6 ||
    !flight.phantom ||
    !validPendingPhantomEncounter(flight.phantom, pending)
  ) {
    return false;
  }
  const occupied = new Set([
    ...flight.objects.map(({ id }) => id),
    ...Object.keys(flight.world.notables),
    ...Object.keys(flight.markerActors?.knowledge ?? {}),
    ...Object.values(flight.requiredPlans ?? {})
      .flatMap(requiredPlanObjects)
      .map(({ id }) => id),
    ...flight.phantom.enemyIds,
    ...flight.phantom.resolvedIds,
    ...Object.values(flight.phantom.blockades).flat(),
  ]);
  return pending.actors.every(({ id }) => !occupied.has(id));
}
export function readPendingPhantomEncounter(flight: FlightState): PendingPhantomEncounter | null {
  return flight.phantom?.pendingEncounter ?? null;
}
export function storePendingPhantomEncounter(
  flight: FlightState,
  pending: PendingPhantomEncounter,
): PendingPhantomEncounter {
  const existing = readPendingPhantomEncounter(flight);
  if (existing) {
    return existing;
  }
  if (!pendingPhantomEncounterUnshared(flight, pending)) {
    throw new RangeError("Invalid or shared pending Phantom encounter");
  }
  const stored = structuredClone(pending);
  flight.phantom!.pendingEncounter = stored;
  return stored;
}
/** The caller validates authored eligibility and fit before this single ownership transfer. */
export function takePendingPhantomEncounter(flight: FlightState): PendingPhantomEncounter | null {
  const pending = readPendingPhantomEncounter(flight);
  if (!pending) {
    return null;
  }
  if (!pendingPhantomEncounterUnshared(flight, pending)) {
    throw new RangeError("Invalid or shared pending Phantom encounter");
  }
  delete flight.phantom!.pendingEncounter;
  return pending;
}
