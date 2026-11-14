import { AUTHORED_JET_LENGTH, jetShapePolygons, layerAlpha } from "../../src/game/jetGeometry.ts";
import { JET_LENGTH, JET_LEVELS, jetLayers } from "./ship-jet-layers.ts";
import { forwardJetMouths, type Pose } from "./ship-model.ts";

// Existing authored thrust cues retain their 16-unit outer length, independently of aperture size.
export { AUTHORED_JET_LENGTH };
export const AUTHORED_JET_CURVE = {
  base: AUTHORED_JET_LENGTH,
  scale: 0,
  exponent: JET_LENGTH.exponent,
};

/** Compatibility thrust SVGs use canonical Engine 1 layers and the runtime's pure geometry. */
export function forwardJetSvg(pivot: number, pose: Pose): string[] {
  const layers = jetLayers(JET_LEVELS[0]!);
  const point = ([x, y]: readonly [number, number]) => ({ x, y });
  return forwardJetMouths(pivot, pose).flatMap((mouth) => {
    const geometry = {
      anchor: point(mouth.anchor),
      axis: point(mouth.axis),
      half: point(mouth.half),
      outerCorner: point(mouth.outerCorner),
      coreOutboard: mouth.coreOutboard,
    };
    return jetShapePolygons(geometry, layers, AUTHORED_JET_LENGTH, 1).map(
      ({ layerIndex, points }) => {
        const layer = layers[layerIndex]!;
        const color = layer.color ?? layer.colors![1];
        const coordinates = points
          .map(({ x, y }) => `${Number(x.toFixed(4))},${Number(y.toFixed(4))}`)
          .join(" ");
        return `<polygon points="${coordinates}" fill="${color}" fill-opacity="${layerAlpha(layer, 1)}"/>`;
      },
    );
  });
}
