import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { EdgeMarkerKind } from "../data/edgeMarkers.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import { gameAreaPoint } from "./edgeMarkers.ts";
import type { MapSymbol } from "./map.ts";
import { recordTargetKnowledge } from "./targetKnowledgeStore.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";
import { worldPoint } from "./worldContacts.ts";

export type TargetKnowledge = "sensed" | "identified";
/** Galaxy-scoped knowledge; positions and existence are reconstructed from world authority. */
export type TargetKnowledgeRecord = Record<string, TargetKnowledge>;
export type TargetSymbol = EdgeMarkerKind | MapSymbol;
export type TargetContributor = "ordinary" | "sensed" | "quest" | "encounter";
export type TargetContribution = {
  readonly disclosed?: boolean;
  readonly id: string;
} & (
  | { readonly source: Exclude<TargetContributor, "encounter"> }
  | { readonly distant: boolean; readonly source: "encounter" }
);
export type TargetResolution =
  | { readonly state: "removed" | "unresolved" }
  | {
      readonly identified: boolean;
      readonly point: Vec;
      readonly state: "present";
      readonly symbol: TargetSymbol;
    };
export type TargetObjectResolution =
  | { readonly state: "removed" | "unresolved" }
  | { readonly object: SpaceObject; readonly state: "present" };

/** Missing runtime or retained state is never a destruction event. */
export function resolveTargetObject(
  flight: Pick<FlightState, "objects" | "world">,
  id: string,
): TargetObjectResolution {
  const loaded = flight.objects.find((object) => object.id === id);
  if (loaded) {
    return loaded.hp > 0 ? { object: loaded, state: "present" } : { state: "removed" };
  }
  if (!Object.hasOwn(flight.world.notables, id)) {
    return { state: "unresolved" };
  }
  const retained = flight.world.notables[id];
  return retained && retained.hp > 0
    ? { object: retained, state: "present" }
    : { state: "removed" };
}

export interface TargetMarker extends Vec {
  readonly id: string;
  readonly identified: boolean;
  readonly symbol: TargetSymbol;
}
interface TargetRegistryView {
  readonly area: Rect;
  readonly player: Vec;
  readonly resolve: (id: string) => TargetResolution;
  readonly worldSide?: number;
}
export interface TargetKnowledgeStore {
  readonly scope: object;
  get(id: string): TargetKnowledge | undefined;
  ids(): readonly string[];
  remove(id: string): void;
  set(id: string, knowledge: TargetKnowledge): void;
}
export interface TargetRegistryContext extends TargetRegistryView {
  readonly knowledge: TargetKnowledgeRecord;
}
export interface TargetRegistryStoreContext extends TargetRegistryView {
  readonly store: TargetKnowledgeStore;
}
export type TargetKnowledgeContext =
  Pick<TargetRegistryContext, "knowledge"> | Pick<TargetRegistryStoreContext, "store">;
export interface TargetRegistryEntry {
  readonly contributors: Set<TargetContributor>;
  readonly id: string;
  marker: TargetMarker | null;
}

/** One identity survives range, narration and materialization changes in the same galaxy. */
export class TargetMarkerRegistry {
  private scope: object | null = null;
  private readonly targets = new Map<string, TargetRegistryEntry>();

  entries(): readonly TargetRegistryEntry[] {
    return [...this.targets.values()];
  }

  /** Explicit destruction/removal uses the same ledger and does not depend on a UI read. */
  forget(context: TargetKnowledgeContext, id: string): void {
    this.bind(context).remove(id);
    this.targets.delete(id);
  }

  private bind(context: TargetKnowledgeContext): TargetKnowledgeStore {
    const store = "store" in context ? context.store : recordTargetKnowledge(context.knowledge);
    if (store.scope !== this.scope) {
      this.targets.clear();
      this.scope = store.scope;
    }
    return store;
  }

  evaluate(
    context: TargetRegistryContext | TargetRegistryStoreContext,
    contributions: readonly TargetContribution[],
  ): TargetMarker[] {
    const store = this.bind(context);
    const grouped = new Map<string, TargetContribution[]>();
    for (const contribution of contributions) {
      const group = grouped.get(contribution.id) ?? [];
      group.push(contribution);
      grouped.set(contribution.id, group);
    }
    const ids = new Set([...store.ids(), ...this.targets.keys(), ...grouped.keys()]);
    const markers: TargetMarker[] = [];
    for (const id of ids) {
      const resolution = context.resolve(id);
      if (resolution.state === "removed") {
        store.remove(id);
        this.targets.delete(id);
        continue;
      }
      const group = grouped.get(id) ?? [];
      const sensed = group.some(({ source }) => source === "sensed");
      const disclosed = group.some(
        ({ disclosed, source }) => disclosed && (source === "quest" || source === "encounter"),
      );
      const seen = resolution.state === "present" && resolution.identified;
      const known = store.get(id);
      if (!known && !sensed && !disclosed && !seen) {
        continue;
      }
      const knowledge = known === "identified" || disclosed || seen ? "identified" : "sensed";
      if (knowledge !== known) {
        store.set(id, knowledge);
      }
      let entry = this.targets.get(id);
      if (!entry) {
        entry = { contributors: new Set(), id, marker: null };
        this.targets.set(id, entry);
      }
      entry.contributors.clear();
      for (const { source } of group) {
        entry.contributors.add(source);
      }
      entry.marker = null;
      // Unresolved means hidden, not removed. Unloaded targets resolve from authoritative world facts.
      if (resolution.state !== "present") {
        continue;
      }
      const point = worldPoint(context, context.player, resolution.point);
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        continue;
      }
      const far = group.some(
        (contribution) => contribution.source === "encounter" && contribution.distant,
      );
      if (
        !far &&
        Math.hypot(point.x - context.player.x, point.y - context.player.y) > TARGET_MARKER_RANGE
      ) {
        continue;
      }
      const at = gameAreaPoint(context.player, point);
      const { area } = context;
      if (
        at.x >= area.x &&
        at.x <= area.x + area.width &&
        at.y >= area.y &&
        at.y <= area.y + area.height
      ) {
        continue;
      }
      entry.marker = {
        id,
        identified: store.get(id) === "identified",
        symbol: resolution.symbol,
        x: point.x,
        y: point.y,
      };
      markers.push(entry.marker);
    }
    return markers;
  }
}
