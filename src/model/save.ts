import { enemyCatalog } from "../data/enemy-catalog.ts";
import type { GameState } from "./types.ts";

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
  return record(value) && finite(value.x) && finite(value.y);
}
function strings(value: unknown): boolean {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
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
      (part) =>
        hardpoints.filter((entry) => record(entry) && entry.id === part.id).length === 1,
    ) &&
    hardpoints.every(
      (part) => record(part) && nonnegative(part.hp) && nonnegative(part.cooldown),
    )
  );
}
function combatState(routes: readonly string[], value: unknown): boolean {
  return (
    record(value) &&
    record(value.initialPackSizes) &&
    Object.values(value.initialPackSizes).every(
      (size) => Number.isInteger(size) && nonnegative(size),
    ) &&
    strings(value.routeEncounters) &&
    (value.routeEncounters as string[]).every((id) => routes.includes(id))
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
      if (!(f.freshChunk === null || typeof f.freshChunk === "string")) {
        return null;
      }
      if (
        !["basic", "rapid", "spread", "pierce"].includes(String(f.weapon)) ||
        !strings(f.chunks) ||
        !strings(f.exploredChunks)
      ) {
        return null;
      }
      if (
        !Array.isArray(f.objects) ||
        !f.objects.every(
          (o) =>
            record(o) &&
            vector(o) &&
            typeof o.id === "string" &&
            ["rock", "resource", "enemy", "hazard", "pickup", "destination", "debris"].includes(
              String(o.kind),
            ) &&
            (o.routeId === undefined ||
              (typeof o.routeId === "string" && routes.includes(o.routeId))) &&
            (o.velocity === undefined || vector(o.velocity)) &&
            (o.enemy === undefined ||
              (o.kind === "enemy" &&
                enemyState(o.enemy) &&
                record(o.enemy) &&
                o.enemy.id === o.id)) &&
            nonnegative(o.radius) &&
            finite(o.hp) &&
            (o.role === undefined || typeof o.role === "string") &&
            (o.cooldown === undefined || nonnegative(o.cooldown)) &&
            (o.behavior === undefined ||
              ["pursue", "shoot", "guard"].includes(String(o.behavior))) &&
            (o.weapon === undefined || ["rapid", "spread", "pierce"].includes(String(o.weapon))),
        )
      ) {
        return null;
      }
      if (
        !Array.isArray(f.shots) ||
        !f.shots.every(
          (s) =>
            record(s) &&
            vector(s) &&
            vector(s.velocity) &&
            typeof s.id === "string" &&
            typeof s.enemy === "boolean" &&
            typeof s.piercing === "boolean" &&
            (s.projectile === undefined || s.projectile === "bolt" || s.projectile === "missile") &&
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
