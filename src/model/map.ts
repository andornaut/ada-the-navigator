import { DESTINATION_MAP_KINDS } from "../data/destinations.ts";
import type { EconomyCatalog } from "../data/economy.ts";
import type { LandmarkKind } from "../data/jobs.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/story-ships.ts";
import type { SectorId } from "../data/types.ts";
import { stationById, stationsNear } from "./stations.ts";
import type { FlightState, Vec } from "./types.ts";
import { chunkCoordinates } from "./visited.ts";

// The pause menu's Map (gameplay/rules.md "Pause"): the current galaxy with Ada's position, the
// discovered destinations and stations, charted landmarks, the current objective's destination
// once mapped and the held station job's target (gameplay/quests.md), and how much of the galaxy
// is mapped, a known holodisk waypoint until its holodisk is recovered. Undiscovered places never
// appear.

/**
 * The charted area: a circle of this many world units around the galaxy's origin, which holds its
 * destinations, the stations that count toward the percent and its landmarks. Stations beyond it
 * still show once discovered.
 */
export const CHARTING_RADIUS = 25000;

const ORIGIN: Vec = { x: 0, y: 0 };

/** A chunk's id, "x,y" in chunk coordinates (flight chunks), from a world point in it. */
export function chunkId(chunkSize: number, point: Vec): string {
  return `${Math.floor(point.x / chunkSize)},${Math.floor(point.y / chunkSize)}`;
}

/** Whether a chunk's centre lies in the charting disc: the explored record keeps only these. */
export function chartedChunk(chunkSize: number, chunk: Vec): boolean {
  return within({ x: (chunk.x + 0.5) * chunkSize, y: (chunk.y + 0.5) * chunkSize });
}

const chunkCounts = new Map<number, number>();
/**
 * The charting disc's chunk count, the explored record's bound: 7500 ids at the 512 chunk size,
 * at most 7 characters each, so at most about 75 KB of save per galaxy.
 */
export function chartingChunks(chunkSize: number): number {
  const known = chunkCounts.get(chunkSize);
  if (known !== undefined) {
    return known;
  }
  const reach = Math.ceil(CHARTING_RADIUS / chunkSize);
  let count = 0;
  for (let x = -reach - 1; x <= reach; x++) {
    for (let y = -reach - 1; y <= reach; y++) {
      count += chartedChunk(chunkSize, { x, y }) ? 1 : 0;
    }
  }
  chunkCounts.set(chunkSize, count);
  return count;
}

/**
 * Adds the chunk holding point to a galaxy's explored record (SectorProgress.explored) when the
 * chunk lies in the charting disc and is new to it.
 */
export function recordExplored(chunkSize: number, explored: string[], point: Vec): void {
  const id = chunkId(chunkSize, point);
  const chunk = chunkCoordinates(id);
  if (chunk && chartedChunk(chunkSize, chunk) && !explored.includes(id)) {
    explored.push(id);
  }
}

// Each explored record's chunk centres, kept while the record only grows (recordExplored), so
// the Map, built every frame, decodes each id once.
const centres = new WeakMap<
  readonly string[],
  { chunkSize: number; list: readonly Vec[]; size: number }
>();
function exploredCentres(chunkSize: number, explored: readonly string[]): readonly Vec[] {
  const known = centres.get(explored);
  if (known && known.size === explored.length && known.chunkSize === chunkSize) {
    return known.list;
  }
  const list = explored.flatMap((id) => {
    const chunk = chunkCoordinates(id);
    return chunk ? [{ x: (chunk.x + 0.5) * chunkSize, y: (chunk.y + 0.5) * chunkSize }] : [];
  });
  centres.set(explored, { chunkSize, list, size: explored.length });
  return list;
}

/** A saved explored record: distinct chunk ids, each in the charting disc, so within its bound. */
export function validExplored(chunkSize: number, value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length > chartingChunks(chunkSize)) {
    return false;
  }
  return (
    new Set(value).size === value.length &&
    value.every((id) => {
      const chunk = typeof id === "string" ? chunkCoordinates(id) : null;
      return chunk !== null && chartedChunk(chunkSize, chunk);
    })
  );
}

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

export type MapPlaceKind = "destination" | "holodisk" | "job" | "landmark" | "station";

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

/** A story destination's symbol: the Map kind its data declares (data/destinations.ts). */
function destinationSymbol(id: string): MapSymbol {
  return DESTINATION_MAP_KINDS[id] ?? "destination";
}

/** The place panel's type line kinds (gameplay/player-copy.md "Map place panel"). */
export type MapPlaceType =
  "beacon" | "holodisk" | "nebula" | "outpost" | "station" | "story" | "wreck";

const PLACE_TYPES: Readonly<Record<MapSymbol, MapPlaceType | null>> = {
  beacon: "beacon",
  destination: "story",
  growers: "outpost",
  holodisk: "holodisk",
  job: null,
  nebula: "nebula",
  salvagers: "outpost",
  station: "station",
  workshop: "outpost",
  wreck: "wreck",
};

/** A place's type line kind; a held job's own spot has none. */
export function placeType(place: Pick<MapPlace, "symbol">): MapPlaceType | null {
  return PLACE_TYPES[place.symbol];
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
   * Where Ada has explored, for the fog: the centre of each chunk in the galaxy's explored record.
   * An empty record draws no fog.
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
  /** The galaxy's explored record across flights: chunk ids (SectorProgress.explored). */
  readonly explored: readonly string[];
  readonly flight: Pick<FlightState, "facing" | "objects" | "player" | "sector">;
  /** The known holodisk waypoint until its holodisk is recovered, or null. */
  readonly holodisk: Vec | null;
  /**
   * The held job's target, with the job's title: it marks the place there, or shows as its own
   * spot when no shown place is there. It never counts toward the percent.
   */
  readonly job: (Vec & { readonly id: string; readonly label: string }) | null;
  /** Each discovered destination's, station's and the holodisk waypoint's label, by id. */
  readonly label: (id: string, kind: "destination" | "holodisk" | "station") => string;
  readonly landmarks: LandmarkChart;
  /** The current objective's destination, shown once it is mapped. */
  readonly objective: string | null;
  readonly progress: { readonly known: readonly string[]; readonly stations: readonly string[] };
}

/**
 * Story characters waiting at a station, such as Cartwheel's miner and visitors, are not map
 * places: the station stands for them, including as the objective's place.
 */
function waitingAt(sector: SectorId, id: string): string | null {
  return sector === CARTWHEEL_STORY_SHIPS.sector &&
    Object.hasOwn(CARTWHEEL_STORY_SHIPS.destinations, id)
    ? CARTWHEEL_STORY_SHIPS.station
    : null;
}

const within = (point: Vec) =>
  Math.hypot(point.x - ORIGIN.x, point.y - ORIGIN.y) <= CHARTING_RADIUS;

/** The galaxy's map from what Ada has discovered and charted, and nothing else. */
export function galaxyMap(context: MapContext): GalaxyMap {
  const { catalog, flight, landmarks, objective, progress } = context;
  const sector = flight.sector as SectorId;
  const mapped = (id: string) => waitingAt(sector, id) === null;
  const objectivePlace = objective === null ? null : (waitingAt(sector, objective) ?? objective);
  const destinations = progress.known.filter(mapped).flatMap((id): MapPlace[] => {
    const object = flight.objects.find((entry) => entry.kind === "destination" && entry.id === id);
    return object
      ? [
          {
            id,
            job: false,
            kind: "destination",
            label: context.label(id, "destination"),
            objective: id === objectivePlace,
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
    context.destinations.filter((id) => mapped(id) && progress.known.includes(id)).length +
    stations.filter(within).length +
    charted.filter(within).length;
  const total =
    context.destinations.filter(mapped).length +
    stationsNear(catalog, sector, CHARTING_RADIUS, ORIGIN).length +
    landmarks.total;
  const waypoint: MapPlace[] = context.holodisk
    ? [
        {
          id: "holodisk",
          job: false,
          kind: "holodisk",
          label: context.label("holodisk", "holodisk"),
          objective: false,
          symbol: "holodisk",
          travel: false,
          x: context.holodisk.x,
          y: context.holodisk.y,
        },
      ]
    : [];
  const places = [...destinations, ...stations, ...charted, ...waypoint];
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
    explored: exploredCentres(chunkSize, context.explored),
    facing: { x: flight.facing.x, y: flight.facing.y },
    landmarks: { charted: landmarks.charted.length, total: landmarks.total },
    mapped: total > 0 ? Math.floor((100 * Math.min(found, total)) / total) : 0,
    places: [...marked, ...spot],
    player: { x: flight.player.x, y: flight.player.y },
  };
}
