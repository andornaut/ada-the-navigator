import type { LandmarkSite } from "./landmarks.ts";
import type { Vec } from "./types.ts";
import { type WorldContext, worldDistance } from "./world/index.ts";

/** One uncharted landmark within the current ship's shared station interaction range. */
export function landmarkScanTarget(
  context: WorldContext & {
    readonly charted: readonly string[];
    readonly player: Vec;
    readonly range: number;
  },
  sites: readonly LandmarkSite[],
): LandmarkSite | undefined {
  let nearest: LandmarkSite | undefined;
  let reach = context.range;
  for (const site of sites) {
    if (context.charted.includes(site.id)) {
      continue;
    }
    const distance = worldDistance(context, context.player, site);
    if (distance <= reach && (nearest === undefined || distance < reach || site.id < nearest.id)) {
      nearest = site;
      reach = distance;
    }
  }
  return nearest;
}
