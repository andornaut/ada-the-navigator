import { LANDMARK_NAME_FORMAT, LANDMARK_TUNING } from "../data/jobs.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { type LandmarkSite, retainedLandmarkSites } from "./retainedLandmarks.ts";
import type { GalaxyProgress, Vec } from "./types.ts";
export type { LandmarkSite } from "./retainedLandmarks.ts";

export function landmarkSites(galaxy: GalaxyNumber): readonly LandmarkSite[] {
  return retainedLandmarkSites(galaxy);
}

/** Existing label keys stay unchanged; new sites add their approved identity words. */
export function landmarkLabel(label: (key: string) => string, site: LandmarkSite): string {
  const base = label(site.name);
  return site.nameWords === undefined
    ? base
    : LANDMARK_NAME_FORMAT.replace("{baseName}", base).replace("{landmarkWords}", site.nameWords);
}

/** A landmark by id in its galaxy, or undefined. */
export function landmarkById(galaxy: GalaxyNumber, id: string): LandmarkSite | undefined {
  return landmarkSites(galaxy).find((site) => site.id === id);
}

/** The galaxy's landmarks with whether each is charted: the pause map's landmark slot. */
export function galaxyLandmarks(
  galaxy: GalaxyNumber,
  progress: Pick<GalaxyProgress, "charted">,
): readonly (LandmarkSite & { readonly charted: boolean })[] {
  return landmarkSites(galaxy).map((site) => ({
    ...site,
    charted: progress.charted.includes(site.id),
  }));
}

/** Uncharted landmarks within range of a point. */
export function unchartedNear(
  galaxy: GalaxyNumber,
  progress: Pick<GalaxyProgress, "charted">,
  range: number,
  point: Vec,
): LandmarkSite[] {
  return landmarkSites(galaxy).filter(
    (site) =>
      !progress.charted.includes(site.id) &&
      Math.hypot(site.x - point.x, site.y - point.y) <= range,
  );
}

/** Charts every uncharted landmark within charting range of Ada; returns the newly charted. */
export function chartLandmarks(
  galaxy: GalaxyNumber,
  progress: Pick<GalaxyProgress, "charted">,
  player: Vec,
): string[] {
  const charted = unchartedNear(galaxy, progress, LANDMARK_TUNING.chart, player).map(
    (site) => site.id,
  );
  progress.charted.push(...charted);
  return charted;
}

/** Whether a saved id names one of the galaxy's landmarks. */
export function isLandmark(galaxy: GalaxyNumber, id: string): boolean {
  return landmarkSites(galaxy).some((site) => site.id === id);
}
