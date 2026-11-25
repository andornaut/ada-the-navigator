import { AUTHORED_JET_LENGTH } from "../../src/game/jetGeometry.ts";
import { JET_LENGTH } from "./ship-jet-layers.ts";

export { AUTHORED_JET_LENGTH };
/** The fixed outer length of the authored static warp and map thrust cues. */
export const AUTHORED_JET_CURVE = {
  base: AUTHORED_JET_LENGTH,
  scale: 0,
  exponent: JET_LENGTH.exponent,
};
