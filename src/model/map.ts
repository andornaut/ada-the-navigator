import type { EconomyCatalog } from "../data/economy.ts";
import type { SectorId } from "../data/types.ts";
import { stationById, stationsNear } from "./stations.ts";
import type { FlightState, Vec } from "./types.ts";

// The pause menu's Map (gameplay/rules.md "Pause"): the current galaxy with Ada's position, the
// discovered destinations and stations, charted landmarks and the current objective's destination
// once mapped, and how much of the galaxy is mapped. Undiscovered places never appear.

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

export type MapPlaceKind = "destination" | "landmark" | "station";

/** A place the map shows. Destinations and stations offer Travel here; landmarks do not. */
export interface MapPlace {
  readonly id: string;
  readonly kind: MapPlaceKind;
  readonly label: string;
  /** Whether it is the current objective's destination. */
  readonly objective: boolean;
  readonly travel: boolean;
  readonly x: number;
  readonly y: number;
}

export interface GalaxyMap {
  /** Whole percent of the charted area's places discovered or charted, rounded down. */
  readonly mapped: number;
  readonly places: readonly MapPlace[];
  readonly player: Vec;
}

export interface MapContext {
  readonly catalog: EconomyCatalog;
  /** The galaxy's story destinations, every one of which counts toward the percent. */
  readonly destinations: readonly string[];
  readonly flight: Pick<FlightState, "objects" | "player" | "sector">;
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
            kind: "destination",
            label: context.label(id, "destination"),
            objective: id === objective,
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
            kind: "station",
            label: context.label(id, "station"),
            objective: false,
            travel: true,
            x: site.x,
            y: site.y,
          },
        ]
      : [];
  });
  const charted: MapPlace[] = landmarks.charted.map((landmark) => ({
    ...landmark,
    kind: "landmark",
    objective: false,
    travel: false,
  }));
  const found =
    context.destinations.filter((id) => progress.known.includes(id)).length +
    stations.filter(within).length +
    charted.filter(within).length;
  const total =
    context.destinations.length +
    stationsNear(catalog, sector, CHARTING_RADIUS, ORIGIN).length +
    landmarks.total;
  return {
    mapped: total > 0 ? Math.floor((100 * Math.min(found, total)) / total) : 0,
    places: [...destinations, ...stations, ...charted],
    player: { x: flight.player.x, y: flight.player.y },
  };
}
