import type { EconomyCatalog } from "../data/economy.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { settlementById } from "./andromedaPlaces.ts";
import { stationById } from "./stations.ts";
import type { GameState, JobOffer, JobTarget, Vec } from "./types.ts";
import { canonicalCell } from "./worldGeometry.ts";

/** Classifies validated persistent references without changing legacy coordinates or identities. */
export function legacyCharts(
  { catalog, worldSide }: { readonly catalog: EconomyCatalog; readonly worldSide: number },
  state: Pick<GameState, "progress" | "jobs" | "tasks">,
): Partial<Record<GalaxyNumber, true>> {
  if (!Number.isSafeInteger(worldSide) || worldSide <= 0) {
    throw new RangeError("World side must be a positive safe integer");
  }
  const period = worldSide / catalog.station.cellSize;
  if (!Number.isSafeInteger(period) || period <= 0) {
    throw new RangeError("World side must contain a whole station grid");
  }
  const half = worldSide / 2;
  const outside = (point: Vec | null | undefined): boolean =>
    point !== null &&
    point !== undefined &&
    (point.x < -half || point.x >= half || point.y < -half || point.y >= half);
  const charts: Partial<Record<GalaxyNumber, true>> = {};
  for (const galaxy of GALAXY_NUMBERS) {
    const siteOutside = (id: string): boolean => {
      const site =
        stationById(catalog, galaxy, id) ?? (galaxy === 5 ? settlementById(catalog, id) : null);
      if (!site) {
        return false;
      }
      const [x, y] = id
        .slice(id.indexOf(":") + 1)
        .split(",")
        .map(Number);
      const cell = { x: x!, y: y! };
      const canonical = canonicalCell(period, cell);
      return outside(site) || canonical.x !== cell.x || canonical.y !== cell.y;
    };
    const targetOutside = (target: JobTarget): boolean => outside(target) || siteOutside(target.id);
    const jobOutside = (job: JobOffer): boolean =>
      siteOutside(job.station) || targetOutside(job.target) || outside(job.spot);
    const progress = state.progress[galaxy];
    const references = [
      ...progress.stations,
      ...Object.keys(progress.greetings),
      ...progress.known,
      ...(progress.andromeda?.station ? [progress.andromeda.station] : []),
      ...(progress.andromeda?.settlement ? [progress.andromeda.settlement] : []),
    ];
    const boards = Object.entries(state.jobs.boards[galaxy] ?? {});
    const task = state.tasks[galaxy];
    if (
      references.some(siteOutside) ||
      boards.some(([origin, offers]) => siteOutside(origin) || offers.some(jobOutside)) ||
      (task?.kind === "job" && jobOutside(task)) ||
      (task?.kind === "activity" &&
        ((task.target !== undefined && targetOutside(task.target)) ||
          (task.id === "courierRun" && (outside(task.start) || outside(task.courier?.position)))))
    ) {
      charts[galaxy] = true;
    }
  }
  return charts;
}
