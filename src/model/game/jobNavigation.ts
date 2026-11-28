import { ECONOMY } from "../../data/economy.ts";
import { JOB_TUNING } from "../../data/jobs.ts";
import { heldActivity } from "../activities.ts";
import type { IndicatorTarget } from "../indicators.ts";
import { nearestWorldSafePlace } from "../jobs.ts";
import { landmarkById, type LandmarkSite } from "../landmarks.ts";
import type { MapContext } from "../map.ts";
import { flightStationContext, worldStationById } from "../stations/index.ts";
import type { FlightState, GameState, HeldJob, JobTarget, Vec } from "../types.ts";
import { flightWorldContext, worldDistance } from "../world/index.ts";

// Read these at the point each projection needs them, including after the model replaces its state.
export interface JobNavigationContext {
  readonly held: () => HeldJob | undefined;
  readonly jobObjective: () => string | null;
  readonly scannableSites: (flight: FlightState) => readonly LandmarkSite[];
  readonly scannedSite: (id: string) => boolean;
  readonly state: () => Readonly<Pick<GameState, "tasks">>;
  readonly towPlaces: (flight: FlightState) => readonly JobTarget[];
}

/** What the scene draws for jobs: landmarks, a rescue's craft and a hunt's area and glint. */
export interface JobScenery {
  readonly landmarks: readonly (Vec & {
    readonly charted: boolean;
    readonly id: string;
    readonly kind: string;
  })[];
  /** A rescue's stranded or towed craft, with the pool item it is. */
  readonly craft: (Vec & { readonly item: string }) | null;
  readonly towing: boolean;
  /** A hunt's search area. */
  readonly area: (Vec & { readonly radius: number }) | null;
  /** A hunt's lost item while it glints, within glint range of Ada. */
  readonly glint: Vec | null;
}

/** A held hunt's lost item within Penny's hunt range, as its point id. */
export function lostItemNear(context: JobNavigationContext, f: FlightState): string | null {
  const held = context.held();
  return held?.type === "hunt" &&
    held.spot &&
    worldDistance(flightWorldContext(f), held.spot, f.player) <= JOB_TUNING.hunt.penny
    ? `job:${held.id}`
    : null;
}

/** Project the scene's landmarks and held-job geometry without changing job or scan state. */
export function projectJobScenery(
  context: JobNavigationContext,
  state: Readonly<Pick<GameState, "flight" | "mode">>,
): JobScenery {
  const f = state.flight;
  const held = context.held();
  if (!f || state.mode !== "space") {
    return { area: null, craft: null, glint: null, landmarks: [], towing: false };
  }
  const hunt = held?.type === "hunt" ? held : undefined;
  return {
    area: hunt ? { radius: JOB_TUNING.hunt.radius, x: hunt.target.x, y: hunt.target.y } : null,
    craft:
      held?.type === "rescue"
        ? { item: held.item, x: (f.tow ?? held.target).x, y: (f.tow ?? held.target).y }
        : null,
    glint:
      hunt?.spot &&
      worldDistance(flightWorldContext(f), hunt.spot, f.player) <= JOB_TUNING.hunt.glint
        ? { ...hunt.spot }
        : null,
    landmarks: context.scannableSites(f).map((site) => ({
      ...site,
      charted: context.scannedSite(site.id),
    })),
    towing: Boolean(f.tow),
  };
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
      worldStationById(flightStationContext(f), ECONOMY, f.galaxy, station) ??
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
    const site =
      worldStationById(flightStationContext(f), ECONOMY, f.galaxy, activity.target.id) ??
      activity.target;
    return mark(site, activity.target.id);
  }
  const at = place(activity.place);
  return at ? mark(at, activity.place) : null;
}
