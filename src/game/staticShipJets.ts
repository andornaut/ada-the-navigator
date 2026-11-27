import { AUTHORED_JET_LENGTH } from "../art/index.ts";
import { type EngineJets, type JetLayer, type ShipJets, travelJets } from "./shipJets.ts";

/** Static travel cues keep their authored model length and the selected main material object. */
export function staticShipJets(
  main: EngineJets | undefined,
  fieldLevels: readonly (readonly JetLayer[])[] | undefined,
  level: number,
): ShipJets | undefined {
  const selected = travelJets(main, undefined, fieldLevels, level, "forward");
  return (
    selected && {
      ...selected,
      length: { ...selected.length, base: AUTHORED_JET_LENGTH, scale: 0 },
    }
  );
}
