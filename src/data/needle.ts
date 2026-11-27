import CHANNELS from "../../public/art/needle/channels.json" with { type: "json" };
import EYE from "../../public/art/needle/eye.json" with { type: "json" };
import GATES from "../../public/art/needle/ring-gates.json" with { type: "json" };
/** Chapter rules and bounded placement tuning, in world units and seconds. */
export const NEEDLE = {
  activityGates: EYE.gates.length + 2,
  activityJitter: 200,
  activityOffset: { x: -2000, y: 1000 },
  activityPatrolGates: [1, 3, 6, 8],
  channels: CHANNELS,
  debrisRadius: 10,
  exitPackRadius: 110,
  eye: EYE,
  eyeGates: EYE.gates.length + 2,
  /** Keep the two courses separate and their entries away from the teaching station. */
  eyeOffset: { x: 2000, y: -2000 },
  fastFraction: 0.75,
  gate: GATES,
  insideDebrisEvery: 10,
  insideDebrisOffset: 5,
  longSpacing: 1.3,
  /** Practice keeps its original spacing and a runout after the fourth gate. */
  practiceEnd: 1260,
  practiceGates: 4,
  practiceOffset: { x: 500, y: 500 },
  practiceWidth: 210,
  speedFraction: 0.5,
} as const;
export const NEEDLE_PLACES = ["elderLoom", "needlePractice", "needleEye", "holodisk"] as const;
export function isNeedleCourseStart(id: string): boolean {
  return id === "needlePractice" || id === "needleEye";
}
