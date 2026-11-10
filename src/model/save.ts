import { enemyCatalog } from "../data/enemy-catalog.ts";
import { WEAPON_CATALOG } from "../data/weapon-catalog.ts";
import { enemyEffects } from "./enemy-ai.ts";
import { ACTIVE_CHUNK_RADIUS, persistentObject } from "./geography.ts";
import type { FlightState, GameState, PersistentWorldState, SpaceObject } from "./types.ts";
import { chunkCoordinates, validVisitedPages } from "./visited.ts";
import { UPGRADE_WEAPONS } from "./weapons.ts";

/** Storage access can fail in private browsing or when quotas are exhausted. */
export function readSave(storage: Pick<Storage, "getItem">, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? "null") as unknown;
  } catch {
    return null;
  }
}
export function writeSave(storage: Pick<Storage, "setItem">, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function vector(value: unknown): boolean {
  return (
    record(value) &&
    finite(value.x) &&
    finite(value.y) &&
    Math.abs(value.x) <= Number.MAX_SAFE_INTEGER / 2 &&
    Math.abs(value.y) <= Number.MAX_SAFE_INTEGER / 2
  );
}
function strings(value: unknown): boolean {
  return Array.isArray(value) && Array.from(value).every((v) => typeof v === "string");
}
const destinationIds: Record<number, readonly string[]> = {
  1: ["growers", "workshop", "salvagers"],
  2: ["hub", "miner", "visitors"],
  3: ["whale", "family"],
};
function nonnegative(value: unknown): boolean {
  return finite(value) && value >= 0;
}
function enemyState(value: unknown): boolean {
  if (
    !record(value) ||
    typeof value.archetype !== "string" ||
    !Object.hasOwn(enemyCatalog, value.archetype) ||
    typeof value.id !== "string" ||
    !(value.packId === null || typeof value.packId === "string") ||
    !["engaged", "fleeing", "returning"].every((key) => typeof value[key] === "boolean") ||
    !["home", "position", "velocity"].every((key) => vector(value[key])) ||
    !(value.lastSeen === null || vector(value.lastSeen)) ||
    !["age", "hp", "lastSeenAge", "primaryCooldown", "pursuitSeconds"].every((key) =>
      nonnegative(value[key]),
    ) ||
    !finite(value.phase) ||
    !Array.isArray(value.hardpoints)
  ) {
    return false;
  }
  const definition = enemyCatalog[value.archetype as keyof typeof enemyCatalog];
  const hardpoints: unknown[] = value.hardpoints;
  return (
    hardpoints.length === definition.hardpoints.length &&
    definition.hardpoints.every(
      (part) => hardpoints.filter((entry) => record(entry) && entry.id === part.id).length === 1,
    ) &&
    hardpoints.every((part) => record(part) && nonnegative(part.hp) && nonnegative(part.cooldown))
  );
}
function combatState(
  routes: readonly string[],
  value: unknown,
): value is NonNullable<FlightState["combat"]> {
  return (
    record(value) &&
    record(value.initialPackSizes) &&
    Object.entries(value.initialPackSizes).every(
      ([id, size]) =>
        id.length > 0 &&
        !["__proto__", "prototype", "constructor"].includes(id) &&
        Number.isSafeInteger(size) &&
        nonnegative(size),
    ) &&
    (value.unloadedPackMembers === undefined ||
      (record(value.unloadedPackMembers) &&
        Object.entries(value.unloadedPackMembers).every(
          ([id, count]) =>
            id.length > 0 &&
            !["__proto__", "prototype", "constructor"].includes(id) &&
            Number.isSafeInteger(count) &&
            nonnegative(count),
        ))) &&
    strings(value.routeEncounters) &&
    (value.routeEncounters as string[]).every((id) => routes.includes(id))
  );
}
function spaceObject(routes: readonly string[], value: unknown): value is SpaceObject {
  return (
    record(value) &&
    vector(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    !["__proto__", "prototype", "constructor"].includes(value.id) &&
    ["rock", "resource", "enemy", "hazard", "pickup", "destination", "debris"].includes(
      String(value.kind),
    ) &&
    (value.routeId === undefined ||
      (typeof value.routeId === "string" && routes.includes(value.routeId))) &&
    (value.velocity === undefined || vector(value.velocity)) &&
    (value.enemy === undefined ||
      (value.kind === "enemy" &&
        enemyState(value.enemy) &&
        record(value.enemy) &&
        value.enemy.id === value.id)) &&
    nonnegative(value.radius) &&
    finite(value.hp) &&
    (value.role === undefined || typeof value.role === "string") &&
    (value.persistent === undefined || typeof value.persistent === "boolean") &&
    (value.cooldown === undefined || nonnegative(value.cooldown)) &&
    (value.behavior === undefined ||
      ["pursue", "shoot", "guard"].includes(String(value.behavior))) &&
    (value.weapon === undefined || UPGRADE_WEAPONS.some((weapon) => weapon === value.weapon))
  );
}
function persistentWorld(
  routes: readonly string[],
  active: readonly SpaceObject[],
  value: unknown,
): value is PersistentWorldState {
  if (
    !record(value) ||
    value.version !== 1 ||
    !record(value.notables) ||
    Object.keys(value).some((key) => !["version", "notables"].includes(key))
  ) {
    return false;
  }
  const ids = new Set(active.map((object) => object.id));
  if (ids.size !== active.length) {
    return false;
  }
  for (const [id, object] of Object.entries(value.notables)) {
    if (!id || ["__proto__", "prototype", "constructor"].includes(id) || ids.has(id)) {
      return false;
    }
    ids.add(id);
    if (object === null) {
      continue;
    }
    if (
      !spaceObject(routes, object) ||
      object.id !== id ||
      !persistentObject(object) ||
      object.hp <= 0 ||
      object.kind === "destination" ||
      object.id.startsWith("whale-debris:") ||
      (object.kind === "enemy" &&
        object.enemy &&
        enemyEffects(enemyCatalog[object.enemy.archetype], object.enemy).defeated)
    ) {
      return false;
    }
  }
  return true;
}
function unloadedPackState(
  active: readonly SpaceObject[],
  world: PersistentWorldState,
  combat: NonNullable<FlightState["combat"]>,
): boolean {
  const unloaded = combat.unloadedPackMembers;
  if (unloaded === undefined) {
    return true;
  }
  const represented = new Map<string, number>();
  for (const object of [...active, ...Object.values(world.notables)]) {
    if (
      !object ||
      object.kind !== "enemy" ||
      object.hp <= 0 ||
      !object.enemy?.packId ||
      enemyEffects(enemyCatalog[object.enemy.archetype], object.enemy).defeated
    ) {
      continue;
    }
    represented.set(object.enemy.packId, (represented.get(object.enemy.packId) ?? 0) + 1);
  }
  return Object.entries(unloaded).every(
    ([id, count]) =>
      count >= 0 &&
      represented.has(id) &&
      Object.hasOwn(combat.initialPackSizes, id) &&
      (represented.get(id) ?? 0) + count <= (combat.initialPackSizes[id] ?? 0),
  );
}

function weaponOwnership(value: unknown, selected: unknown): boolean {
  return (
    strings(value) &&
    Array.isArray(value) &&
    Array.from(value).every((weapon) => UPGRADE_WEAPONS.some((id) => id === weapon)) &&
    new Set(value).size === value.length &&
    (selected === "basic" || value.includes(selected))
  );
}

/** Accept only complete snapshots; a partial restore can invalidate quest state. */
export function restoreSave(saved: unknown): GameState | null {
  try {
    const value: unknown = typeof saved === "string" ? JSON.parse(saved) : saved;
    if (
      !record(value) ||
      value.version !== 1 ||
      !["home", "space"].includes(String(value.mode)) ||
      ![1, 2, 3].includes(value.selectedSector as number) ||
      !record(value.progress)
    ) {
      return null;
    }
    if (
      !Array.isArray(value.unlocked) ||
      !value.unlocked.includes(1) ||
      value.unlocked.some((v) => ![1, 2, 3].includes(v)) ||
      !value.unlocked.includes(value.selectedSector)
    ) {
      return null;
    }
    if (typeof value.notice !== "string") {
      return null;
    }
    for (const id of [1, 2, 3]) {
      const p = value.progress[id];
      if (
        !record(p) ||
        !Number.isInteger(p.stage) ||
        !nonnegative(p.stage) ||
        Number(p.stage) > (id === 1 ? 4 : 5) ||
        !strings(p.known) ||
        ![null, "food", "toolkit", "parts"].includes(p.questItem as string | null) ||
        (Array.isArray(p.known) && p.known.some((v) => !destinationIds[id]?.includes(v))) ||
        (p.resolved === true && p.questComplete !== true)
      ) {
        return null;
      }
      if (
        !["introduced", "questComplete", "resolved"].every((k) => typeof p[k] === "boolean") ||
        !["deposited", "discoveries", "disabledEnemies"].every((k) => nonnegative(p[k]))
      ) {
        return null;
      }
    }
    if (value.dialogue !== null) {
      const d = value.dialogue;
      if (
        !record(d) ||
        !["title", "text", "context"].every((k) => typeof d[k] === "string") ||
        !Array.isArray(d.choices) ||
        !d.choices.every(
          (c) => record(c) && typeof c.id === "string" && typeof c.label === "string",
        )
      ) {
        return null;
      }
    }
    if (value.flight !== null) {
      const f = value.flight;
      if (
        !record(f) ||
        f.sector !== value.selectedSector ||
        !["player", "velocity", "facing"].every((k) => vector(f[k])) ||
        ![
          "seed",
          "time",
          "shield",
          "sinceDamage",
          "dangerFor",
          "cargo",
          "ammo",
          "fireCooldown",
          "freshDistance",
          "nextId",
        ].every((k) => nonnegative(f[k]))
      ) {
        return null;
      }
      const routes = destinationIds[value.selectedSector as number] ?? [];
      if (f.combat !== undefined && !combatState(routes, f.combat)) {
        return null;
      }
      if (
        !Number.isSafeInteger(f.seed) ||
        !Number.isSafeInteger(f.nextId) ||
        !(
          f.freshChunk === null ||
          (typeof f.freshChunk === "string" && chunkCoordinates(f.freshChunk) !== null)
        )
      ) {
        return null;
      }
      if (
        !Object.hasOwn(WEAPON_CATALOG, String(f.weapon)) ||
        !strings(f.chunks) ||
        !Array.isArray(f.chunks) ||
        f.chunks.length > (ACTIVE_CHUNK_RADIUS * 2 + 1) ** 2 ||
        new Set(f.chunks).size !== f.chunks.length ||
        !f.chunks.every((key) => typeof key === "string" && chunkCoordinates(key) !== null) ||
        !validVisitedPages(f.visited) ||
        f.dormant !== undefined ||
        f.exploredChunks !== undefined
      ) {
        return null;
      }
      if (f.ownedWeapons !== undefined && !weaponOwnership(f.ownedWeapons, f.weapon)) {
        return null;
      }
      if (
        !Array.isArray(f.objects) ||
        !Array.from(f.objects).every((object) => spaceObject(routes, object))
      ) {
        return null;
      }
      if (!persistentWorld(routes, f.objects, f.world)) {
        return null;
      }
      if (f.combat !== undefined && !unloadedPackState(f.objects, f.world, f.combat)) {
        return null;
      }
      if (
        !Array.isArray(f.shots) ||
        !Array.from(f.shots).every(
          (s) =>
            record(s) &&
            vector(s) &&
            vector(s.velocity) &&
            typeof s.id === "string" &&
            typeof s.enemy === "boolean" &&
            typeof s.piercing === "boolean" &&
            (s.projectile === undefined ||
              ["bolt", "missile", "dot"].includes(String(s.projectile))) &&
            (s.enemy || (finite(s.damage) && s.damage > 0)) &&
            (s.fade === undefined ||
              (!s.enemy &&
                s.projectile === "dot" &&
                record(s.fade) &&
                finite(s.fade.initialLife) &&
                s.fade.initialLife > 0 &&
                finite(s.fade.projectedRange) &&
                s.fade.projectedRange > 0 &&
                finite(s.fade.fadeStartFraction) &&
                s.fade.fadeStartFraction >= 0 &&
                s.fade.fadeStartFraction < 1 &&
                finite(s.life) &&
                s.life <= s.fade.initialLife)) &&
            finite(s.life) &&
            strings(s.hitIds),
        )
      ) {
        return null;
      }
    }
    if (value.mode === "space" && value.flight === null) {
      return null;
    }
    return structuredClone(value) as unknown as GameState;
  } catch {
    return null;
  }
}
