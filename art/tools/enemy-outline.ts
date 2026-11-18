import { check, type Fill, rasterize, solid, trace, traceFills, type V2 } from "./silhouette.ts";

export const enemyOutlineReceipts = new Map<
  string,
  { distance: number; iou: number; parts: number; tolerance: number }
>();

/** Trace enemy bodies with the same enclosed-aperture policy the native checker validates. */
export function traceEnemyFills(
  id: string,
  fills: readonly Fill[],
  frame: readonly [number, number],
  tolerances: readonly number[],
): { collision: V2[][]; tips: Fill[]; tolerance: number } {
  try {
    return traceFills(id, fills, frame, tolerances);
  } catch (original) {
    const mask = rasterize(
      fills.map(({ points }) => points),
      frame[0],
      frame[1],
    );
    const enclosed = solid(mask);
    const errors = [original];
    for (const tolerance of [...tolerances].toReversed()) {
      try {
        const { collision } = trace(enclosed, tolerance);
        const metrics = check(id, collision, mask);
        enemyOutlineReceipts.set(id, { ...metrics, parts: collision.length, tolerance });
        return { collision, tips: [], tolerance };
      } catch (error) {
        errors.push(error);
      }
    }
    throw new AggregateError(errors, `${id}: native enemy silhouette checks failed`, {
      cause: original,
    });
  }
}
