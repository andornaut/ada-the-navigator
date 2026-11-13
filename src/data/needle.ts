import CHANNELS from "../../public/art/needle/channels.json" with { type: "json" };
import EYE from "../../public/art/needle/eye.json" with { type: "json" };
import GATES from "../../public/art/needle/gates.json" with { type: "json" };
/** Chapter rules and bounded placement tuning, in world units and seconds. */
export const NEEDLE = {
  activityGates: 8,
  activityJitter: 200,
  activityOffset: { x: -2000, y: 1000 },
  channels: CHANNELS,
  debrisRadius: 10,
  exitPackRadius: 110,
  eye: EYE,
  eyeGates: 8,
  /** Keep the two courses separate and their entries away from the teaching station. */
  eyeOffset: { x: 2000, y: -2000 },
  gate: GATES,
  insideDebrisEvery: 10,
  insideDebrisOffset: 5,
  /** Practice uses the entry and first three gates of the authored Eye path. */
  practiceEnd: 1000,
  practiceGates: 3,
  practiceOffset: { x: 500, y: 500 },
  practiceWidth: 210,
  speedFraction: 0.4,
} as const;
export const NEEDLE_PLACES = ["elderLoom", "needlePractice", "needleEye", "holodisk"] as const;
