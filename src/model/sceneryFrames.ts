import { rockFrame, sceneryShape } from "./asteroids.ts";
import { debrisFrameOf, debrisSilhouette } from "./debrisBody.ts";
import type { FlightState, SpaceObject } from "./types.ts";

type FrameContext = Pick<FlightState, "galaxy" | "seed" | "time">;
interface FrameEntry extends FrameContext {
  readonly reducedMotion: boolean;
  readonly id: string;
  readonly kind: SpaceObject["kind"];
  readonly asteroid: SpaceObject["asteroid"];
  readonly spinStart: SpaceObject["spinStart"];
  readonly velocity: boolean;
  readonly orbit: boolean;
  readonly frame: number;
}

/** One frame value per live object; every canonical frame input is checked on each read. */
export class SceneryFrames {
  private readonly entries = new WeakMap<SpaceObject, FrameEntry>();

  frame(context: FrameContext, reducedMotion: boolean, object: SpaceObject): number {
    const previous = this.entries.get(object);
    const velocity = Boolean(object.velocity);
    const orbit = Boolean(object.orbit);
    if (
      previous &&
      previous.galaxy === context.galaxy &&
      previous.seed === context.seed &&
      previous.time === context.time &&
      previous.reducedMotion === reducedMotion &&
      previous.id === object.id &&
      previous.kind === object.kind &&
      previous.asteroid === object.asteroid &&
      previous.spinStart === object.spinStart &&
      previous.velocity === velocity &&
      previous.orbit === orbit
    ) {
      return previous.frame;
    }
    let frame: number;
    if (debrisSilhouette(context.galaxy, object)) {
      frame = debrisFrameOf(context.galaxy, object, reducedMotion, context.time);
    } else {
      const shape = sceneryShape(object);
      frame = shape
        ? rockFrame(shape, context.seed, reducedMotion, object.id, context.time, object.spinStart)
        : 0;
    }
    this.entries.set(object, {
      asteroid: object.asteroid,
      frame,
      galaxy: context.galaxy,
      id: object.id,
      kind: object.kind,
      orbit,
      reducedMotion,
      seed: context.seed,
      spinStart: object.spinStart,
      time: context.time,
      velocity,
    });
    return frame;
  }
}
