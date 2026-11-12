import { bySector } from "../data/galaxies.ts";
import { type GalaxyCard, galaxyPreview } from "../data/storybook.ts";
import type { SectorId } from "../data/types.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";
import type { RouteMapArt } from "../ui/route-map.ts";

// The route map's art from Art's manifests (art/route-sky.md, art/galaxies.md "Markers"): the
// sky and ground with their figures, each galaxy's marker hue and the shared locked grey, each
// galaxy's previews, and Ada's ship frames by heading.

export interface RouteAsset {
  readonly at?: { readonly x: number; readonly y: number };
  readonly displayHeight?: number;
  readonly displayWidth?: number;
  readonly id: string;
  readonly overlays?: readonly string[];
  readonly path: string;
}

const HEX = /^#[0-9a-f]{6}$/iu;

/** Each galaxy's marker hue and the locked grey from galaxies.json; null if any is invalid. */
export function readRouteMarkers(
  value: unknown,
): { readonly hues: ReadonlyMap<SectorId, string>; readonly locked: string } | null {
  const data = value as { galaxies?: unknown; marker?: { locked?: unknown } } | null | undefined;
  const locked = data?.marker?.locked;
  const hues = bySector((entry) => {
    const hue = (entry as { marker?: unknown } | null | undefined)?.marker;
    return typeof hue === "string" && HEX.test(hue) ? hue : undefined;
  }, data?.galaxies);
  return hues && typeof locked === "string" && HEX.test(locked) ? { hues, locked } : null;
}

/**
 * A galaxy's previews, open and locked: Art's placeholder previews where the manifest lists
 * them (`galaxy-preview-{id}`), else the selector captures; empty where neither exists.
 */
export function routePreviews(
  assets: readonly RouteAsset[],
  card: Pick<GalaxyCard, "id" | "preview">,
): { readonly locked: string; readonly open: string } {
  const art = (suffix: string) =>
    assets.find(({ id }) => id === `galaxy-preview-${card.id}${suffix}`)?.path;
  return {
    locked: art("-locked") ?? galaxyPreview(card, true),
    open: art("") ?? galaxyPreview(card, false),
  };
}

/**
 * Ada's 32 heading frames on the route map: the paint's idle frame where it has one, else
 * Classic's (`ship-{k}`); on thrust, Classic's thrust frame (`ship-thrust-{k}`), else the idle one.
 */
export function routeShipFrames(
  assets: readonly RouteAsset[],
  paint: string | null,
  thrust: boolean,
): string[] {
  const path = (id: string) => assets.find((asset) => asset.id === id)?.path;
  return Array.from({ length: SHIP_HEADINGS }, (_, heading) => {
    const painted = paint === null ? undefined : path(`ship-${paint}-${heading}`);
    const idle = painted ?? path(`ship-${heading}`);
    return (thrust ? path(`ship-thrust-${heading}`) : undefined) ?? idle ?? "";
  });
}

/** The sky, the ground with its figures and the locked grey; null while any is missing. */
export function readRouteArt(
  assets: readonly RouteAsset[],
  markers: ReturnType<typeof readRouteMarkers>,
  ship: RouteMapArt["ship"],
): RouteMapArt | null {
  const sky = assets.find(({ id }) => id === "route-sky");
  const ground = assets.find(({ id }) => id === "route-ground");
  if (!sky || !ground || !markers) {
    return null;
  }
  const figures = (ground.overlays ?? []).flatMap((id) => {
    const figure = assets.find((asset) => asset.id === id);
    return figure?.at && figure.displayWidth && figure.displayHeight
      ? [
          {
            height: figure.displayHeight,
            url: figure.path,
            width: figure.displayWidth,
            x: figure.at.x,
            y: figure.at.y,
          },
        ]
      : [];
  });
  return { figures, ground: ground.path, locked: markers.locked, ship, sky: sky.path };
}

/** A galaxy's marker hue, or the locked grey until Art gives it one. */
export function markerHue(markers: ReturnType<typeof readRouteMarkers>, galaxy: SectorId): string {
  return markers?.hues.get(galaxy) ?? markers?.locked ?? "";
}
