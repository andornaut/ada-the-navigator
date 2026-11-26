import type { GalaxyNumber, GameContent } from "../../data/types.ts";
import { pickupTouched } from "../flight.ts";
import type { FlightState, GalaxyProgress, SpaceObject, Vec } from "../types.ts";

type HolodiskProgress = Readonly<Pick<GalaxyProgress, "holodisk" | "requiredSites" | "sounder">>;

interface WhirlpoolHolodiskContext {
  readonly flight: Readonly<Pick<FlightState, "galaxy">> | null;
  readonly progress: Readonly<Record<GalaxyNumber, HolodiskProgress>>;
  readonly selectedGalaxy: GalaxyNumber;
}

export function holodiskWaypoint(context: WhirlpoolHolodiskContext): boolean {
  const phase = context.progress[context.selectedGalaxy].sounder?.phase;
  return (
    context.flight?.galaxy === 3 &&
    phase !== undefined &&
    phase !== "hidden" &&
    !context.progress[context.selectedGalaxy].holodisk
  );
}

export function whirlpoolDiskWaypoint(
  context: WhirlpoolHolodiskContext,
  flight: Pick<FlightState, "galaxy" | "objects">,
): Vec | null {
  if (flight.galaxy !== 3 || !holodiskWaypoint(context)) {
    return null;
  }
  return (
    floatingHolodisk(context, flight) ??
    context.progress[context.selectedGalaxy].requiredSites?.holodisk ??
    null
  );
}

/** The family can mark the site while the physical pickup remains held by Sounder. */
export function floatingHolodisk(
  context: WhirlpoolHolodiskContext,
  f: Pick<FlightState, "objects">,
): SpaceObject | undefined {
  return holodiskWaypoint(context) &&
    context.progress[context.selectedGalaxy].sounder?.phase === "resolved"
    ? f.objects.find((o) => o.kind === "destination" && o.id === "holodisk")
    : undefined;
}
/** Ada is within pickup reach of the holodisk, a pickup-sized object. */
export function holodiskTouched(
  context: WhirlpoolHolodiskContext,
  content: GameContent,
  f: FlightState,
): boolean {
  const disk = floatingHolodisk(context, f);
  return disk !== undefined && pickupTouched(content, f, disk, content.tuning.flight.pickupRadius);
}
