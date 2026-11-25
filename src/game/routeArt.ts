import { byGalaxy } from "../data/galaxies.ts";
import type { GalaxyCard } from "../data/storybook.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { GalaxyMapArt } from "../ui/galaxyMap.ts";
import type { StoryArt } from "../ui/storyArt.ts";

// The route map's art from Art's manifests (art/route-sky.md, art/galaxies.md "Markers"): the
// sky and ground with their figures, each galaxy's marker hue and the shared locked grey, each
// galaxy's preview cards, and Ada's ship frames by heading.

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
): { readonly hues: ReadonlyMap<GalaxyNumber, string>; readonly locked: string } | null {
  const data = value as { galaxies?: unknown; marker?: { locked?: unknown } } | null | undefined;
  const locked = data?.marker?.locked;
  const hues = byGalaxy((entry) => {
    const hue = (entry as { marker?: unknown } | null | undefined)?.marker;
    return typeof hue === "string" && HEX.test(hue) ? hue : undefined;
  }, data?.galaxies);
  return hues && typeof locked === "string" && HEX.test(locked) ? { hues, locked } : null;
}

/**
 * A galaxy's preview cards, open and locked (art/galaxies.md "Preview cards"), which Art draws
 * for every galaxy under its stable id.
 */
export function routePreviews(card: Pick<GalaxyCard, "id">): {
  readonly locked: string;
  readonly open: string;
} {
  const path = (suffix: string) => `/art/previews/card-${card.id}${suffix}.png`;
  return { locked: path("-locked"), open: path("") };
}

/** The sky, the ground with its figures and the locked grey; null while any is missing. */
export function readRouteArt(
  assets: readonly RouteAsset[],
  markers: ReturnType<typeof readRouteMarkers>,
  ship: GalaxyMapArt["ship"],
  home?: Pick<StoryArt, "backgrounds" | "composites">,
): GalaxyMapArt | null {
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
  return {
    figures,
    ground: ground.path,
    ...(home?.backgrounds.adaRoom
      ? { homeScene: { overlays: home.composites.adaRoom ?? [], url: home.backgrounds.adaRoom } }
      : {}),
    locked: markers.locked,
    ship,
    sky: sky.path,
  };
}

/** A galaxy's marker hue, or the locked grey until Art gives it one. */
export function markerHue(
  markers: ReturnType<typeof readRouteMarkers>,
  galaxy: GalaxyNumber,
): string {
  return markers?.hues.get(galaxy) ?? markers?.locked ?? "";
}
