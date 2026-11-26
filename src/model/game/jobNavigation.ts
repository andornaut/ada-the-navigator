import { ECONOMY } from "../../data/economy.ts";
import { JOB_TUNING } from "../../data/jobs.ts";
import { heldActivity } from "../activities.ts";
import { flightWorldContext } from "../flightTopology.ts";
import type { IndicatorTarget } from "../indicators.ts";
import { nearestWorldSafePlace } from "../jobs.ts";
import { landmarkById } from "../landmarks.ts";
import type { MapContext } from "../map.ts";
import { stationById } from "../stations.ts";
import type { FlightState, GameState, HeldJob, JobTarget, Vec } from "../types.ts";
import { worldDistance } from "../worldContacts.ts";

// Read these at the point each projection needs them, including after the model replaces its state.
export interface JobNavigationContext {
  readonly held: () => HeldJob | undefined;
  readonly jobObjective: () => string | null;
  readonly state: () => Readonly<Pick<GameState, "tasks">>;
  readonly towPlaces: (flight: FlightState) => readonly JobTarget[];
}

/**
 * Where the held job sends Ada now: a survey's landmark; a delivery's destination, or the
 * issuing station to replace a lost item; a stranded craft, then the nearest safe place while
 * towing; a hunt's area centre while Ada is outside it.
 */
export function jobIndicator(
  context: JobNavigationContext,
  f: FlightState,
): IndicatorTarget | null {
  const held = context.held();
  const target = jobTarget(context, f);
  // A hunt's indicator hides while Ada is inside its search area.
  return held?.type === "hunt" &&
    worldDistance(flightWorldContext(f), held.target, f.player) <= JOB_TUNING.hunt.radius
    ? null
    : target;
}
/** The held job's target on the Map, named by the job's title. */
export function jobMapTarget(context: JobNavigationContext, f: FlightState): MapContext["job"] {
  const target = jobTarget(context, f);
  const title = context.jobObjective();
  const held = context.held();
  // A hunt's target is its search area's centre, which the Map rings.
  return target && title !== null
    ? {
        area: held?.type === "hunt" ? JOB_TUNING.hunt.radius : null,
        id: target.id,
        label: title,
        type: held?.type ?? null,
        x: target.x,
        y: target.y,
      }
    : null;
}
/** Where the held job sends Ada now, for the indicator and the Map. */
function jobTarget(context: JobNavigationContext, f: FlightState): IndicatorTarget | null {
  const held = context.held();
  if (!held) {
    return activityTarget(context, f);
  }
  const mark = ({ id, x, y }: JobTarget): IndicatorTarget => ({
    id: id || `job:${held.id}`,
    kind: "job",
    x,
    y,
  });
  if (held.type === "survey") {
    const site = landmarkById(f.galaxy, held.target.id);
    return site ? mark(site) : null;
  }
  if (held.type === "delivery") {
    const station = held.carrying ? held.target.id : held.station;
    const place =
      stationById(ECONOMY, f.galaxy, station) ??
      f.objects.find((object) => object.kind === "destination" && object.id === station) ??
      held.target;
    return mark({ id: station, x: place.x, y: place.y });
  }
  if (held.type === "rescue") {
    const place = f.tow
      ? nearestWorldSafePlace(flightWorldContext(f), context.towPlaces(f), f.tow)
      : held.target;
    return place ? mark(place) : null;
  }
  return mark(held.target);
}
/**
 * Where the activity sends Ada now: a supply run's destination, or its issuing outpost to
 * replace a lost item; the hub for a mining contract; the calf until it follows, then the family.
 */
function activityTarget(context: JobNavigationContext, f: FlightState): IndicatorTarget | null {
  const activity = heldActivity(f.galaxy, context.state());
  if (!activity) {
    return null;
  }
  const mark = ({ x, y }: Vec, id: string): IndicatorTarget => ({ id, kind: "job", x, y });
  const place = (id: string) =>
    f.objects.find((object) => object.kind === "destination" && object.id === id);
  if (activity.id === "guideCalf") {
    const calf = f.calf;
    const family = place("family");
    return calf && !calf.following
      ? mark(calf, "activity:calf")
      : family
        ? mark(family, "family")
        : null;
  }
  // A supply run's item goes to its station; a lost one is replaced at the issuing outpost.
  if (activity.id === "supplyRun" && activity.carrying && activity.target) {
    const site = stationById(ECONOMY, f.galaxy, activity.target.id) ?? activity.target;
    return mark(site, activity.target.id);
  }
  const at = place(activity.place);
  return at ? mark(at, activity.place) : null;
}
