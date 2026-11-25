import { SHIP_HEADINGS, SHIP_HEADING_CONTRACT } from "./projection.ts";
import {
  DISPLAY,
  drawn,
  FRAME,
  type Paint,
  PAINT_SLOTS,
  type PaintSlot,
  type Pose,
} from "./ship-model.ts";
import { svgPaths } from "./ship-paths.ts";
import { WARP_FRAME, WARP_HEADING, WARP_POSES } from "./ship-poses.ts";

export const SHIP_MATERIAL_SLOTS = PAINT_SLOTS;
export type ShipMaterialSlot = PaintSlot;

export interface ShipMaterialDraw {
  readonly path: number;
  readonly slot: ShipMaterialSlot;
  readonly alpha: 1;
}

/** Exact opaque unions per material slot for every heading and warp pose. */
export function shipMaterialGeometry() {
  const paths: string[] = [];
  const pathIndices = new Map<string, number>();
  const roles = Object.fromEntries(PAINT_SLOTS.map((slot) => [slot, slot])) as Paint;
  const draws = (pivot: number, pose: Pose): ShipMaterialDraw[] =>
    svgPaths(drawn(pivot, roles, { ...pose, thrust: false })).map(({ color, path }) => {
      let index = pathIndices.get(path);
      if (index === undefined) {
        index = paths.length;
        pathIndices.set(path, index);
        paths.push(path);
      }
      return { path: index, slot: color as ShipMaterialSlot, alpha: 1 };
    });
  return {
    version: 2 as const,
    shipHeadings: SHIP_HEADING_CONTRACT,
    palettePath: "/art/ship-paint.json",
    slots: SHIP_MATERIAL_SLOTS,
    paths,
    ship: {
      frame: FRAME,
      displayScale: DISPLAY / FRAME,
      pivot: [0.5, 0.5] as const,
      headings: Array.from({ length: SHIP_HEADINGS }, (_, index) => ({
        index,
        draws: draws(FRAME / 2, { yaw: index }),
      })),
    },
    warp: {
      frame: WARP_FRAME,
      heading: WARP_HEADING,
      displayScale: DISPLAY / FRAME,
      pivot: [0.5, 0.5] as const,
      poses: WARP_POSES.map(({ id, ...pose }) => ({
        id,
        draws: draws(WARP_FRAME / 2, { ...pose, yaw: WARP_HEADING }),
      })),
    },
  };
}

export type ShipMaterialGeometry = ReturnType<typeof shipMaterialGeometry>;
