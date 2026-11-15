import { SHIP_HEADINGS } from "./projection.ts";
import type { Pose } from "./ship-model.ts";

export const WARP_HEADING = (SHIP_HEADINGS * 270) / 360;
export const WARP_FRAME = 256;
export const WARP_POSES: readonly (Omit<Pose, "yaw"> & { readonly id: string })[] = [
  { id: "bank-8", roll: 8 },
  { id: "bank-16", roll: 16, thrust: true },
  { id: "bank-24", roll: 24, thrust: true },
  { id: "bank-30", roll: 30, thrust: true },
  { id: "stretch-30", roll: 30, squash: 0.85, stretch: 3.2, thrust: true },
  { id: "settle-24", roll: 24, stretch: 1.8, thrust: true },
  { id: "settle-16", roll: 16, stretch: 1.3, thrust: true },
  { id: "settle-10", roll: 10, stretch: 1.1, thrust: true },
  { id: "settle-5", roll: 5 },
];
