import type { Rect } from "@andornaut/game-kit/rect";

import { PENNY_FIND_RANGE } from "../data/achievements.ts";
import { CONVERSATION_TUNING } from "../data/conversations.ts";
import type { JobType } from "../data/jobs.ts";
import { gameAreaPoint } from "./edgeMarkers.ts";
import type { IndicatorTarget } from "./indicators.ts";
import type { MapSymbol } from "./map.ts";
import type { Vec } from "./types.ts";
import { nearestImage } from "./worldGeometry.ts";

export interface PennyPoint extends Vec {
  readonly id: string;
  readonly known: boolean;
  readonly identifiable?: boolean;
  readonly symbol: MapSymbol;
  readonly jobType?: JobType;
  readonly item?: "stardust";
}
export interface PennyMarker extends PennyPoint {
  readonly identified: boolean;
}

/** Only an acknowledged, displayed notice admits a target; UI reads cannot admit one. */
export class PennyMarkers {
  private flight: object | null = null;
  private readonly points = new Map<string, boolean>();
  private readonly admitted = new Set<string>();

  ids(flight: object): readonly string[] {
    if (flight !== this.flight) {
      this.flight = flight;
      this.points.clear();
      this.admitted.clear();
    }
    return [...this.points.keys()];
  }

  displayed(flight: object, id: string): void {
    this.ids(flight);
    if (!this.admitted.has(id)) {
      this.admitted.add(id);
      this.points.set(id, false);
    }
  }

  targets(
    flight: object,
    area: Rect,
    indicated: ReadonlySet<string>,
    worldSide: number | undefined,
    player: Vec,
    points: readonly PennyPoint[],
  ): PennyMarker[] {
    this.ids(flight);
    const markers: PennyMarker[] = [];
    for (const [id, wasIdentified] of this.points) {
      const source = points.find((point) => point.id === id);
      if (!source) {
        this.points.delete(id);
        continue;
      }
      const point =
        worldSide === undefined ? source : nearestImage(worldSide, player, source).point;
      const reach = Math.hypot(point.x - player.x, point.y - player.y);
      if (
        reach > CONVERSATION_TUNING.pennyRange ||
        (reach <= PENNY_FIND_RANGE && !wasIdentified && !source.known)
      ) {
        this.points.delete(id);
        continue;
      }
      const at = gameAreaPoint(player, point);
      const visible =
        at.x >= area.x &&
        at.x <= area.x + area.width &&
        at.y >= area.y &&
        at.y <= area.y + area.height;
      const identified =
        wasIdentified || source.known || (visible && source.identifiable !== false);
      this.points.set(id, identified);
      if ((!visible || source.identifiable === false) && !indicated.has(id)) {
        markers.push({ ...source, ...point, identified });
      }
    }
    return markers;
  }
}

/** Penny replaces only the same station arrow or hunt-area arrow, never an objective. */
export function pennyIndicatorTargets(
  penny: ReadonlySet<string>,
  targets: readonly IndicatorTarget[],
): IndicatorTarget[] {
  return targets.filter(
    (target) => !penny.has(target.id) || (target.kind !== "station" && target.kind !== "job"),
  );
}
