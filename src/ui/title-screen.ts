import { type JetTriangle, jetTriangles, type ShipJets } from "../game/ship-jets.ts";
import type { Vec } from "../model/types.ts";
import { START_SCREEN } from "./layout/startScreen.ts";

// Art's start screen art (art/title-screen.md), from the core manifest and title-screen.json, which
// it links as titleScreen: the field, the wordmark, each paint's ship-26 and the speed jets
// behind it, held still.

/** A manifest entry the title screen reads. */
export interface TitleAsset {
  readonly directionIndex?: number;
  readonly displayHeight?: number;
  readonly displayWidth?: number;
  readonly id: string;
  /** A painted ship frame's scheme; Classic frames have none. */
  readonly paint?: string;
  readonly path: string;
  readonly pivot?: Vec;
}

export interface TitleScreenArt {
  /** The space background beyond the field. */
  readonly background: string;
  /** The field image, its top-left in play-view px and its logical size. */
  readonly field: {
    readonly at: Vec;
    readonly height: number;
    readonly url: string;
    readonly width: number;
  };
  /** The jets behind the ship, in logical px from the ship's pivot, with the pivot's place in the frame. */
  readonly jets: readonly JetTriangle[];
  readonly pivot: Vec;
  /** Each paint's ship frame, by scheme; Classic's under null. */
  readonly ships: ReadonlyMap<string | null, string>;
  readonly wordmark: { readonly height: number; readonly url: string; readonly width: number };
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;

/**
 * The title screen's art, or null if any part is missing: title-screen.json's field, ship frame
 * and wordmark in the manifest, and a Classic frame at that heading. Jets draw only with valid
 * ship-jets data for the heading; the ship is held still, as `animated` false asks.
 */
export function readTitleScreen(
  assets: readonly TitleAsset[],
  jets: ShipJets | undefined,
  data: unknown,
): TitleScreenArt | null {
  const root = fields(data);
  const field = fields(root?.field);
  const ship = fields(root?.ship);
  const wordmark = fields(root?.wordmark);
  const at = field?.at;
  const byId = (id: unknown) =>
    typeof id === "string" ? assets.find((asset) => asset.id === id) : undefined;
  const fieldAsset = byId(field?.id);
  const wordmarkAsset = byId(wordmark?.id);
  const frame = ship?.frame;
  if (
    root?.version !== 1 ||
    typeof root.background !== "string" ||
    !Array.isArray(at) ||
    at.length !== 2 ||
    !at.every(finite) ||
    !Number.isInteger(frame) ||
    !finite(ship?.jetSpeed) ||
    !fieldAsset ||
    !positive(fieldAsset.displayWidth) ||
    !positive(fieldAsset.displayHeight) ||
    !wordmarkAsset ||
    !positive(wordmarkAsset.displayWidth) ||
    !positive(wordmarkAsset.displayHeight)
  ) {
    return null;
  }
  const frames = assets.filter(
    (asset) =>
      asset.directionIndex === frame &&
      asset.id.startsWith("ship-") &&
      !asset.id.startsWith("ship-thrust"),
  );
  const classic = frames.find((asset) => asset.paint === undefined);
  if (!classic) {
    return null;
  }
  const pivot = classic.pivot ?? { x: 0.5, y: 0.5 };
  const size = START_SCREEN.ship.size;
  const triangles =
    jets && jets.headings[frame as number]
      ? jetTriangles(
          jets,
          { displayHeight: size, displayWidth: size, pivot },
          frame as number,
          ship.jetSpeed,
        )
      : [];
  return {
    background: root.background,
    field: {
      at: { x: at[0] as number, y: at[1] as number },
      height: fieldAsset.displayHeight,
      url: fieldAsset.path,
      width: fieldAsset.displayWidth,
    },
    jets: triangles,
    pivot,
    ships: new Map(frames.map((asset) => [asset.paint ?? null, asset.path])),
    wordmark: {
      height: wordmarkAsset.displayHeight,
      url: wordmarkAsset.path,
      width: wordmarkAsset.displayWidth,
    },
  };
}

/** The ship frame for a paint scheme: its painted frame, else Classic's (null for Classic). */
export function titleShip(art: TitleScreenArt, paint: string | null): string {
  return (paint !== null && art.ships.get(paint)) || art.ships.get(null)!;
}

/** The jets as SVG polygons in the ship frame's box, pivot-relative points moved onto the frame. */
export function jetPolygons(
  art: TitleScreenArt,
): { readonly fill: string; readonly opacity: number; readonly points: string }[] {
  const size = START_SCREEN.ship.size;
  const origin = { x: art.pivot.x * size, y: art.pivot.y * size };
  return art.jets.map(({ alpha, color, points }) => ({
    fill: `#${color.toString(16).padStart(6, "0")}`,
    opacity: alpha,
    points: points.map(({ x, y }) => `${origin.x + x},${origin.y + y}`).join(" "),
  }));
}
