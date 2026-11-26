import packageInfo from "../../package.json" with { type: "json" };
import { galaxyRoute } from "../model/game.ts";
import { stationPopulationObjects } from "../model/hostileStations.ts";
import { routeGuardEvidence } from "../model/routeGuardEvidence.ts";
import type { GameState } from "../model/types.ts";
import { restoreSave } from "./codec.ts";

export type AdaSaveInspection =
  | { status: "new" }
  | { status: "valid"; save: GameState }
  | { status: "issue"; problem: "invalid-save" };

/** Save repair is limited to application releases before version 1. */
export function preV1SaveResetAllowed(applicationVersion = packageInfo.version): boolean {
  return /^0\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    applicationVersion,
  );
}

/** Missing history cannot clear a known opener before its first authored introduction. */
function ambiguousRequiredOpener(save: GameState): boolean {
  const flight = save.flight;
  if (!flight || ![1, 2, 3].includes(flight.galaxy)) {
    return false;
  }
  const progress = save.progress[flight.galaxy];
  if (progress.introduced || progress.stage > 0 || progress.questComplete) {
    return false;
  }
  const opener = galaxyRoute(flight.galaxy)[0];
  if (
    !opener ||
    !progress.known.includes(opener) ||
    flight.requiredPlans?.[opener] ||
    !stationPopulationObjects(flight).some(
      (object) => object.id === opener && object.kind === "destination",
    )
  ) {
    return false;
  }
  const evidence = routeGuardEvidence(flight, opener);
  return evidence.status === "unknown";
}

/** Inspect raw Ada data before a storage adapter applies its newer-save fence. */
export function inspectAdaSave(raw: string | null): AdaSaveInspection {
  if (raw === null) {
    return { status: "new" };
  }
  const save = restoreSave(raw);
  return save && !ambiguousRequiredOpener(save)
    ? { save, status: "valid" }
    : { problem: "invalid-save", status: "issue" };
}
