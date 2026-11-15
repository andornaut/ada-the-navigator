import {
  AUTHORED_JET_LENGTH,
  jetShapePolygons,
  jetShapeLayerAlpha,
  jetShapeLayerColor,
} from "../../src/game/jetGeometry.ts";
import { JET_LENGTH, JET_LEVELS } from "./ship-jet-layers.ts";
import { forwardJetMouths, type Pose } from "./ship-model.ts";
import { normalJetLayers } from "./ship-normal-materials.ts";

export { AUTHORED_JET_LENGTH };
export const AUTHORED_JET_CURVE = {
  base: AUTHORED_JET_LENGTH,
  scale: 0,
  exponent: JET_LENGTH.exponent,
};

/** Normal fallback exports use the same pure geometry and opaque material policy as runtime. */
export function forwardJetSvg(pivot: number, pose: Pose): string[] {
  const layers = normalJetLayers(JET_LEVELS[0]!);
  const point = ([x, y]: readonly [number, number]) => ({ x, y });
  return forwardJetMouths(pivot, pose).flatMap((mouth) => {
    const geometry = {
      anchor: point(mouth.anchor),
      axis: point(mouth.axis),
      half: point(mouth.half),
      normalAperture: mouth.normalAperture,
    };
    return jetShapePolygons(geometry, layers, AUTHORED_JET_LENGTH, 1).map(
      ({ layerIndex, points }) => {
        const layer = layers[layerIndex]!;
        const color = jetShapeLayerColor(
          geometry,
          layer,
          layerIndex,
          layer.color ?? layer.colors![1],
        );
        const alpha = jetShapeLayerAlpha(geometry, layer, layerIndex, 1);
        const coordinates = points
          .map(({ x, y }) => `${Number(x.toFixed(4))},${Number(y.toFixed(4))}`)
          .join(" ");
        return `<polygon points="${coordinates}" fill="${color}" fill-opacity="${alpha}"/>`;
      },
    );
  });
}
