import type { Point } from "../../data/enemyCatalog.ts";

/** A predicted drawn hull pose; the query never receives hidden player or combat state. */
export interface NavigationPose {
  readonly facing: Point;
  readonly position: Point;
  /** Seconds after the query's snapshot; a moving obstacle is tested where its velocity puts it. */
  readonly time: number;
}

/** World-space navigation clearance only. Physical collision always retains its own zero margin. */
export interface NavigationQuery {
  clear(pose: NavigationPose, clearance: number): boolean;
  /** Outward course when a loaded pose already lacks navigation clearance. */
  escape(pose: NavigationPose, clearance: number): Point | null;
}
