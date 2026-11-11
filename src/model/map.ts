import type { EconomyCatalog } from "../data/economy.ts";
import type { LandmarkKind } from "../data/jobs.ts";
import type { SectorId } from "../data/types.ts";
import { stationById, stationsNear } from "./stations.ts";
import type { FlightState, Vec } from "./types.ts";
import { visitedChunks } from "./visited.ts";

// The pause menu's Map (gameplay/rules.md "Pause"): the current galaxy with Ada's position, the
// discovered destinations and stations, charted landmarks, the current objective's destination
// once mapped and the held station job's target (gameplay/quests.md), and how much of the galaxy
// is mapped. Undiscovered places never appear.

/**
 * The charted area: a circle of this many world units around the galaxy's origin, which holds its
 * destinations, the stations that count toward the percent and its landmarks. Stations beyond it
 * still show once discovered.
 */
export const CHARTING_RADIUS = 25000;

const ORIGIN: Vec = { x: 0, y: 0 };

/** A charted landmark, as the landmark model reports it. */
export interface MapLandmark {
  readonly id: string;
  readonly kind: LandmarkKind;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

/** The galaxy's landmarks: those Ada has charted, and how many the charted area holds. */
export interface LandmarkChart {
  readonly charted: readonly MapLandmark[];
  readonly total: number;
}

/** No landmarks yet: the slot the landmark model fills. */
export const NO_LANDMARKS: LandmarkChart = { charted: [], total: 0 };

export type MapPlaceKind = "destination" | "job" | "landmark" | "station";

/**
 * A place's map symbol (art/map.md "Symbols"): a station, galaxy one's three outposts by name,
 * any other story destination, the holodisk, each landmark kind, or a held job's own spot.
 */
export type MapSymbol =
  | "beacon"
  | "destination"
  | "growers"
  | "holodisk"
  | "job"
  | "nebula"
  | "salvagers"
  | "station"
  | "workshop"
  | "wreck";

const NAMED_OUTPOSTS: readonly MapSymbol[] = ["growers", "workshop", "salvagers", "holodisk"];

/** A story destination's symbol: its own for the named outposts and the holodisk. */
function destinationSymbol(id: string): MapSymbol {
  return NAMED_OUTPOSTS.find((symbol) => symbol === id) ?? "destination";
}

/**
 * A place the map shows. Destinations and stations offer Travel here; landmarks and a job's own
 * spot do not.
 */
export interface MapPlace {
  readonly id: string;
  /** Whether it is the held job's target. */
  readonly job: boolean;
  readonly kind: MapPlaceKind;
  readonly label: string;
  /** Whether it is the current objective's destination. */
  readonly objective: boolean;
  readonly symbol: MapSymbol;
  readonly travel: boolean;
  readonly x: number;
  readonly y: number;
}

export interface GalaxyMap {
  /**
   * Where Ada has explored this flight, for the fog: the centre of each chunk she has visited. An
   * empty record draws no fog.
   */
  readonly explored: readonly Vec[];
  /** Ada's facing, which her arrow points along. */
  readonly facing: Vec;
  /** The galaxy's landmarks for the header's pips: how many are charted, of how many. */
  readonly landmarks: { readonly charted: number; readonly total: number };
  /** Whole percent of the charted area's places discovered or charted, rounded down. */
  readonly mapped: number;
  readonly places: readonly MapPlace[];
  readonly player: Vec;
}

export interface MapContext {
  readonly catalog: EconomyCatalog;
  /** World units per chunk, whose visited centres are the explored record. */
  readonly chunkSize: number;
  /** The galaxy's story destinations, every one of which counts toward the percent. */
  readonly destinations: readonly string[];
  readonly flight: Pick<FlightState, "facing" | "objects" | "player" | "sector" | "visited">;
  /**
   * The held job's target, with the job's title: it marks the place there, or shows as its own
   * spot when no shown place is there. It never counts toward the percent.
   */
  readonly job: (Vec & { readonly id: string; readonly label: string }) | null;
  /** Each discovered destination's and station's label, by id. */
  readonly label: (id: string, kind: "destination" | "station") => string;
  readonly landmarks: LandmarkChart;
  /** The current objective's destination, shown once it is mapped. */
  readonly objective: string | null;
  readonly progress: { readonly known: readonly string[]; readonly stations: readonly string[] };
}

const within = (point: Vec) =>
  Math.hypot(point.x - ORIGIN.x, point.y - ORIGIN.y) <= CHARTING_RADIUS;

/** The galaxy's map from what Ada has discovered and charted, and nothing else. */
export function galaxyMap(context: MapContext): GalaxyMap {
  const { catalog, flight, landmarks, objective, progress } = context;
  const sector = flight.sector as SectorId;
  const destinations = progress.known.flatMap((id): MapPlace[] => {
    const object = flight.objects.find((entry) => entry.kind === "destination" && entry.id === id);
    return object
      ? [
          {
            id,
            job: false,
            kind: "destination",
            label: context.label(id, "destination"),
            objective: id === objective,
            symbol: destinationSymbol(id),
            travel: true,
            x: object.x,
            y: object.y,
          },
        ]
      : [];
  });
  const stations = progress.stations.flatMap((id): MapPlace[] => {
    const site = stationById(catalog, sector, id);
    return site
      ? [
          {
            id,
            job: false,
            kind: "station",
            label: context.label(id, "station"),
            objective: false,
            symbol: "station",
            travel: true,
            x: site.x,
            y: site.y,
          },
        ]
      : [];
  });
  const charted: MapPlace[] = landmarks.charted.map(({ id, kind, label, x, y }) => ({
    id,
    job: false,
    kind: "landmark",
    label,
    objective: false,
    symbol: kind,
    travel: false,
    x,
    y,
  }));
  const found =
    context.destinations.filter((id) => progress.known.includes(id)).length +
    stations.filter(within).length +
    charted.filter(within).length;
  const total =
    context.destinations.length +
    stationsNear(catalog, sector, CHARTING_RADIUS, ORIGIN).length +
    landmarks.total;
  const places = [...destinations, ...stations, ...charted];
  const { job } = context;
  const marked = places.map((entry) => (entry.id === job?.id ? { ...entry, job: true } : entry));
  const spot: MapPlace[] =
    job && !places.some((entry) => entry.id === job.id)
      ? [
          {
            id: job.id,
            job: true,
            kind: "job",
            label: job.label,
            objective: false,
            symbol: "job",
            travel: false,
            x: job.x,
            y: job.y,
          },
        ]
      : [];
  const { chunkSize } = context;
  return {
    explored: visitedChunks(flight.visited).map(({ x, y }) => ({
      x: (x + 0.5) * chunkSize,
      y: (y + 0.5) * chunkSize,
    })),
    facing: { x: flight.facing.x, y: flight.facing.y },
    landmarks: { charted: landmarks.charted.length, total: landmarks.total },
    mapped: total > 0 ? Math.floor((100 * Math.min(found, total)) / total) : 0,
    places: [...marked, ...spot],
    player: { x: flight.player.x, y: flight.player.y },
  };
}
