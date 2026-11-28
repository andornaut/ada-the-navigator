import type { ConversationLine } from "../../data/conversations.ts";
import { holodiskInsertion } from "../../data/premiseCopy.ts";
import type { GalaxyNumber, GameContent } from "../../data/types.ts";
import { pickupTouched } from "../flight/index.ts";
import type { FlightState, GalaxyProgress, SpaceObject, Vec } from "../types.ts";
import { flightEncounterSeed } from "../world/index.ts";

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

/** Keep the passive pickup lines tied to their original flight across Continue. */
export function whirlpoolDiskPickupId(flight: Pick<FlightState, "seed" | "encounterSeed">): string {
  return `chapter:3:holodisk:pickup:${flightEncounterSeed(flight)}`;
}

/** The restoration line precedes the memory for the number of disks Ada now holds. */
export function whirlpoolDiskPickupCues(
  holodisk: GameContent["premise"]["holodisk"],
  held: number,
  pickup: string,
): readonly { readonly id: string; readonly line: ConversationLine }[] {
  const { inserted, memories } = holodisk;
  const cues: { id: string; line: ConversationLine }[] = [];
  const restored = holodiskInsertion(held, inserted).at(-1);
  if (restored?.speaker === "Astra") {
    cues.push({ id: `${pickup}:restored`, line: { speaker: "astra", text: restored.text } });
  }
  const memory = memories[held - 1];
  if (memory) {
    cues.push({ id: `${pickup}:memory`, line: { speaker: "astra", text: memory } });
  }
  return cues;
}
