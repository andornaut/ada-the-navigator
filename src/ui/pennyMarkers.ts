import { opaqueBoundsOfRgba } from "@andornaut/game-kit/runtime/opaqueBounds";
import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { EDGE_MARKER_GLYPHS } from "../data/edgeMarkers.ts";
import { LIGHT_FIELD } from "../game/lightField.ts";
import type { PennyMarker } from "../model/pennyMarkers.ts";
import type { Vec } from "../model/types.ts";
import { pixels, units, VIEW_PROPERTIES } from "./layout/css.ts";
import { MAP_COLORS, MAP_FACES, MAP_SYMBOL } from "./layout/mapScreen.ts";
import { PENNY_MARKER } from "./layout/pennyMarkers.ts";
import { layoutTargetMarkers, type TargetMarkerExtent } from "./layout/targetMarkers.ts";
import { SPACING } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { chipFace, chipGlyph } from "./mapScreen.ts";
const { question: BODY_QUESTION, size: SIZE } = PENNY_MARKER;
export const PENNY_MARKER_INSET = PENNY_MARKER.inset;
export const PENNY_MARKERS_STYLE = `
.ada-penny-markers{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1}
.ada-penny-marker{position:absolute;box-sizing:border-box;width:${units(SIZE)};
height:${units(SIZE)};border:${units(MAP_SYMBOL.edge)} solid ${MAP_COLORS.ink};
border-radius:50%;display:grid;place-items:center}
.ada-penny-glyph{width:${units(MAP_SYMBOL.glyph)};height:${units(MAP_SYMBOL.glyph)};
background:${MAP_COLORS.ink};mask:var(--glyph) center / contain no-repeat;
-webkit-mask:var(--glyph) center / contain no-repeat}
${(["enemy", "guard", "heavy"] as const)
  .map(
    (kind) => `
.ada-penny-marker[data-identified="true"][data-symbol="${kind}"]{
width:${units(EDGE_MARKER_GLYPHS[kind].disc)};height:${units(EDGE_MARKER_GLYPHS[kind].disc)};
border:0;background:var(--marker-threat)}
.ada-penny-marker[data-identified="true"][data-symbol="${kind}"][data-light="true"]{
box-shadow:0 0 0 ${units(LIGHT_FIELD.markerOutline)} ${MAP_COLORS.ink}}
.ada-penny-marker[data-identified="true"][data-symbol="${kind}"] .ada-penny-glyph{display:none}
`,
  )
  .join("")}
.ada-penny-marker[data-identified="true"][data-symbol="guard"] .ada-penny-glyph{
display:block;width:${units(EDGE_MARKER_GLYPHS.guard.bar.width)};height:${units(EDGE_MARKER_GLYPHS.guard.bar.height)};
mask:none;-webkit-mask:none;background:${MAP_COLORS.ink}}
.ada-penny-marker[data-identified="true"][data-symbol="hostileStation"] .ada-penny-glyph{
width:${units(EDGE_MARKER_GLYPHS.hostileStation.icon)};height:${units(EDGE_MARKER_GLYPHS.hostileStation.icon)}}
.ada-penny-marker[data-identified="false"] .ada-penny-glyph{
width:${units(BODY_QUESTION.width)};height:${units(BODY_QUESTION.height)};
background:${MAP_COLORS.ink};mask-image:url('/art/ui/fonts/font-body.png');
-webkit-mask-image:url('/art/ui/fonts/font-body.png');
mask-size:${units(BODY_QUESTION.atlasWidth)} ${units(BODY_QUESTION.atlasHeight)};
-webkit-mask-size:${units(BODY_QUESTION.atlasWidth)} ${units(BODY_QUESTION.atlasHeight)};
mask-position:${units(-BODY_QUESTION.x)} ${units(-BODY_QUESTION.y)};
-webkit-mask-position:${units(-BODY_QUESTION.x)} ${units(-BODY_QUESTION.y)}}
`;
const threatSymbol = (symbol: PennyMarker["symbol"]): symbol is "enemy" | "guard" | "heavy" =>
  symbol === "enemy" || symbol === "guard" || symbol === "heavy";
export function pennyGlyph(marker: PennyMarker): string | null {
  if (!marker.identified || threatSymbol(marker.symbol)) {
    return null;
  }
  if (marker.symbol === "hostileStation") {
    return "/art/ui/icons/map-hostile-station.svg";
  }
  if (marker.item === "stardust") {
    return "/art/ui/sprites/icon-stardust-20.png";
  }
  const key = chipGlyph({
    ...(marker.jobType ? { jobType: marker.jobType } : {}),
    symbol: marker.symbol,
  });
  return key ? `/art/ui/icons/${key}.svg` : null;
}
/** Opaque paint only; native placement also unions any protruding glyph alpha. */
export function pennyMarkerInkExtent(marker: PennyMarker, light: boolean) {
  if (marker.identified && threatSymbol(marker.symbol)) {
    const diameter =
      EDGE_MARKER_GLYPHS[marker.symbol].disc + (light ? 2 * LIGHT_FIELD.markerOutline : 0);
    return {
      height: Math.max(
        diameter,
        marker.symbol === "guard" ? EDGE_MARKER_GLYPHS.guard.bar.height : 0,
      ),
      width: Math.max(diameter, marker.symbol === "guard" ? EDGE_MARKER_GLYPHS.guard.bar.width : 0),
    };
  }
  return { height: SIZE, width: SIZE };
}
/** Asset alpha metadata only; the production presentation remains the existing native DOM. */
function maskInk(doc: Pick<Document, "createElement">, redraw: () => void) {
  const images = new Map<string, HTMLImageElement>();
  const bounds = new Map<string, Rect>();
  return {
    clear() {
      for (const image of images.values()) {
        image.onload = null;
      }
      images.clear();
      bounds.clear();
    },
    read(url: string, width: number, height: number): Rect | undefined {
      const key = `${url}:${width}:${height}`;
      const known = bounds.get(key);
      if (known) {
        return known;
      }
      let image = images.get(url);
      if (!image) {
        image = doc.createElement("img");
        image.onload = redraw;
        image.src = url;
        images.set(url, image);
      }
      if (!image.complete || !image.naturalWidth) {
        return undefined;
      }
      const canvas = doc.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(width));
      canvas.height = Math.max(1, Math.ceil(height));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        return undefined;
      }
      context.drawImage(image, 0, 0, width, height);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      const ink = opaqueBoundsOfRgba(canvas.width, canvas.height, data);
      const result = ink
        ? { height: ink.bottom - ink.top, width: ink.right - ink.left, x: ink.left, y: ink.top }
        : { height: 0, width: 0, x: 0, y: 0 };
      bounds.set(key, result);
      return result;
    },
  };
}
interface DirectionStyle {
  readonly blocked?: readonly Rect[];
  readonly color: string;
  readonly edge?: string | undefined;
  readonly light: boolean;
  readonly threat?: string;
}
/** Reuses the existing atlas question mark and approved category glyphs. */
export function createPennyMarkerLayer(
  doc: Pick<Document, "createElement" | "createElementNS">,
  parent: Pick<HTMLElement, "append">,
) {
  const layer = doc.createElement("div");
  layer.className = "ada-penny-markers";
  layer.setAttribute("aria-hidden", "true");
  parent.append(layer);
  const nodes = new Map<string, HTMLElement>();
  let latest:
    | {
        area: Rect;
        directionStyle: DirectionStyle | undefined;
        markers: readonly PennyMarker[];
        player: Vec;
      }
    | undefined;
  const assets = maskInk(doc, () => {
    if (latest) {
      view.place(latest.player, latest.area, latest.directionStyle, latest.markers);
    }
  });
  const view = {
    destroy() {
      latest = undefined;
      layer.remove();
      nodes.clear();
      assets.clear();
    },
    place(
      player: Vec,
      area: Rect,
      directionStyle: DirectionStyle | undefined,
      markers: readonly PennyMarker[],
    ) {
      latest = { area, directionStyle, markers, player };
      const style: DirectionStyle = directionStyle ?? {
        color: MAP_FACES.destination,
        light: false,
      };
      const shown = new Set<string>();
      for (const marker of markers) {
        let node = nodes.get(marker.id);
        if (!node) {
          node = doc.createElement("div");
          node.className = "ada-penny-marker";
          const glyph = doc.createElement("span");
          glyph.className = "ada-penny-glyph";
          node.append(glyph);
          layer.append(node);
          nodes.set(marker.id, node);
        }
        node.dataset.target = marker.id;
        node.dataset.identified = String(marker.identified);
        node.dataset.light = String(style.light);
        node.dataset.symbol = marker.symbol;
        node.style.setProperty("--marker-threat", style.threat ?? style.color);
        node.style.background = !marker.identified
          ? MAP_FACES.destination
          : marker.symbol === "hostileStation"
            ? (style.threat ?? style.color)
            : threatSymbol(marker.symbol)
              ? (style.threat ?? style.color)
              : marker.item === "stardust"
                ? MAP_FACES.beacon
                : chipFace({ job: Boolean(marker.jobType), symbol: marker.symbol });
        const glyph = pennyGlyph(marker);
        if (glyph) {
          node.style.setProperty("--glyph", `url('${glyph}')`);
        } else {
          node.style.removeProperty("--glyph");
        }
        shown.add(marker.id);
      }
      const unit = readViewUnit(layer);
      const dpr = globalThis.devicePixelRatio || 1;
      const scale = unit * dpr;
      const layerBox = layer.getBoundingClientRect();
      const areaLeft =
        parseFloat(getComputedStyle(layer).getPropertyValue(VIEW_PROPERTIES.areaLeft)) || 0;
      const extents = new Map<string, TargetMarkerExtent>();
      const paintSizes = new Map<
        string,
        {
          height: number;
          width: number;
        }
      >();
      for (const marker of markers) {
        const node = nodes.get(marker.id)!;
        const body = node.getBoundingClientRect();
        const paint = { height: body.height / unit, width: body.width / unit };
        paintSizes.set(marker.id, paint);
        const outline =
          marker.identified && threatSymbol(marker.symbol) && style.light
            ? LIGHT_FIELD.markerOutline
            : 0;
        let left = -paint.width / 2 - outline;
        let top = -paint.height / 2 - outline;
        let right = paint.width / 2 + outline;
        let bottom = paint.height / 2 + outline;
        const url = pennyGlyph(marker);
        const glyph = node.firstElementChild?.getBoundingClientRect();
        if (
          url &&
          glyph &&
          (glyph.left < body.left ||
            glyph.top < body.top ||
            glyph.right > body.right ||
            glyph.bottom > body.bottom)
        ) {
          const alpha = assets.read(url, glyph.width * dpr, glyph.height * dpr);
          if (!alpha || (alpha.width > 0 && alpha.height > 0)) {
            const ink = alpha ?? {
              height: glyph.height * dpr,
              width: glyph.width * dpr,
              x: 0,
              y: 0,
            };
            const x = (glyph.left - body.left) / unit - paint.width / 2 + ink.x / scale;
            const y = (glyph.top - body.top) / unit - paint.height / 2 + ink.y / scale;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x + ink.width / scale);
            bottom = Math.max(bottom, y + ink.height / scale);
          }
        }
        extents.set(marker.id, {
          height: bottom - top,
          offset: { x: (left + right) / 2, y: (top + bottom) / 2 },
          width: right - left,
        });
      }
      const placements = layoutTargetMarkers(
        {
          area,
          blocked: style.blocked ?? [],
          extent: (target) => extents.get(target.id)!,
          gap: SPACING.rowGap,
          player,
          raster: {
            origin: { x: (layerBox.left + areaLeft) * dpr, y: layerBox.top * dpr },
            pixelRatio: dpr,
            scale,
          },
        },
        markers,
      );
      for (const { anchor, at, crowded, target } of placements) {
        const node = nodes.get(target.id)!;
        node.dataset.anchorX = String(anchor.x);
        node.dataset.anchorY = String(anchor.y);
        node.dataset.crowded = String(crowded);
        const paint = paintSizes.get(target.id)!;
        node.style.left = pixels(areaLeft + (at.x - paint.width / 2) * unit);
        node.style.top = pixels((at.y - paint.height / 2) * unit);
      }
      for (const [id, node] of nodes) {
        if (!shown.has(id)) {
          node.remove();
          nodes.delete(id);
        }
      }
    },
  };
  return view;
}
