import { rockFrame, sceneryShape } from "./asteroids.ts";
import { debrisFrameOf, debrisSilhouette } from "./debrisBody.ts";
import type { FlightState, SpaceObject } from "./types.ts";

type FrameContext = Pick<FlightState, "galaxy" | "seed" | "time">;
interface FrameEntry {
  readonly id: string;
  readonly reducedMotion: boolean;
  readonly seed: number;
  readonly shape: NonNullable<ReturnType<typeof sceneryShape>>;
  readonly spinStart: SpaceObject["spinStart"];
  readonly time: number;
  readonly frame: number;
}

/** Rock frames follow their complete input tuple and canonical shape identity; debris stays live. */
export class SceneryFrames {
  private readonly entries = new WeakMap<SpaceObject, FrameEntry>();

  frame(context: FrameContext, reducedMotion: boolean, object: SpaceObject): number {
    // The live debris registry is consulted on every read, including metadata replacement.
    if (debrisSilhouette(context.galaxy, object)) {
      return debrisFrameOf(context.galaxy, object, reducedMotion, context.time);
    }
    const shape = sceneryShape(object);
    if (!shape) {
      return 0;
    }
    const previous = this.entries.get(object);
    if (
      previous &&
      previous.id === object.id &&
      previous.reducedMotion === reducedMotion &&
      previous.seed === context.seed &&
      previous.shape === shape &&
      previous.spinStart === object.spinStart &&
      previous.time === context.time
    ) {
      return previous.frame;
    }
    const frame = rockFrame(
      shape,
      context.seed,
      reducedMotion,
      object.id,
      context.time,
      object.spinStart,
    );
    this.entries.set(object, {
      frame,
      id: object.id,
      reducedMotion,
      seed: context.seed,
      shape,
      spinStart: object.spinStart,
      time: context.time,
    });
    return frame;
  }
}
