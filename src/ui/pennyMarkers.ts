import { opaqueBoundsOfRgba } from "@andornaut/game-kit/runtime/opaqueBounds";
import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { EDGE_MARKER_GLYPHS } from "../data/edgeMarkers.ts";
import { TASK_COLORS } from "../data/taskCategories.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import { LIGHT_FIELD } from "../game/lightField.ts";
import type { PennyMarker } from "../model/pennyMarkers.ts";
import type { Vec } from "../model/types.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { pixels, units, VIEW_PROPERTIES } from "./layout/css.ts";
import { frameDeviceOrigin, frameRect, turnOf } from "./layout/frameBox.ts";
import { MAP_COLORS, MAP_FACES, MAP_SYMBOL } from "./layout/mapScreen.ts";
import { PENNY_MARKER } from "./layout/pennyMarkers.ts";
import {
  layoutTargetMarkers,
  type PresentedTargetMarker,
  type TargetMarkerExtent,
} from "./layout/targetMarkers.ts";
import { SPACING } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { chipGlyph } from "./mapScreen.ts";
const { question: BODY_QUESTION, size: SIZE } = PENNY_MARKER;
/** The enemy markers, each a filled threat disc; a hostile station draws the heavy disc. */
const THREAT_SYMBOLS = ["enemy", "guard", "heavy", "hostileStation"] as const;
type ThreatSymbol = (typeof THREAT_SYMBOLS)[number];
export const PENNY_MARKERS_STYLE = `
.ada-penny-markers{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1}
.ada-penny-marker{position:absolute;box-sizing:border-box;width:${units(SIZE)};
height:${units(SIZE)};border:${units(MAP_SYMBOL.edge)} solid ${MAP_COLORS.ink};
border-radius:50%;display:grid;place-items:center;color:${MAP_COLORS.ink};
background:var(--marker-face)}
button.ada-penny-marker{appearance:none;padding:0;pointer-events:auto;cursor:pointer}
button.ada-penny-marker:focus-visible{
outline:none;background:color-mix(in srgb,var(--marker-face) 65%,${MAP_COLORS.hull})}
.ada-penny-glyph{width:${units(MAP_SYMBOL.glyph)};height:${units(MAP_SYMBOL.glyph)};
background:currentColor;mask:var(--glyph) center / contain no-repeat;
-webkit-mask:var(--glyph) center / contain no-repeat}
${THREAT_SYMBOLS.map(
  (kind) => `
.ada-penny-marker[data-identified="true"][data-symbol="${kind}"]{
width:${units(EDGE_MARKER_GLYPHS[kind].disc)};height:${units(EDGE_MARKER_GLYPHS[kind].disc)};
border:0}
.ada-penny-marker[data-identified="true"][data-symbol="${kind}"][data-light="true"]{
box-shadow:0 0 0 ${units(LIGHT_FIELD.markerOutline)} ${MAP_COLORS.ink}}
.ada-penny-marker[data-identified="true"][data-symbol="${kind}"] .ada-penny-glyph{display:none}
`,
).join("")}
.ada-penny-marker[data-identified="true"][data-symbol="guard"] .ada-penny-glyph{
display:block;width:${units(EDGE_MARKER_GLYPHS.guard.bar.width)};height:${units(EDGE_MARKER_GLYPHS.guard.bar.height)};
mask:none;-webkit-mask:none}
.ada-penny-marker[data-identified="false"] .ada-penny-glyph{
width:${units(BODY_QUESTION.width)};height:${units(BODY_QUESTION.height)};
mask-image:url('/art/ui/fonts/font-body.png');
-webkit-mask-image:url('/art/ui/fonts/font-body.png');
mask-size:${units(BODY_QUESTION.atlasWidth)} ${units(BODY_QUESTION.atlasHeight)};
-webkit-mask-size:${units(BODY_QUESTION.atlasWidth)} ${units(BODY_QUESTION.atlasHeight)};
mask-position:${units(-BODY_QUESTION.x)} ${units(-BODY_QUESTION.y)};
-webkit-mask-position:${units(-BODY_QUESTION.x)} ${units(-BODY_QUESTION.y)}}
@media (forced-colors:active){
  button.ada-penny-marker{
    forced-color-adjust:none;background:ButtonFace;color:ButtonText;border-color:ButtonText}
  button.ada-penny-marker:focus-visible{
    background:Highlight;color:HighlightText}
}

`;
const threatSymbol = (symbol: PennyMarker["symbol"]): symbol is ThreatSymbol =>
  (THREAT_SYMBOLS as readonly string[]).includes(symbol);
const markerNames: Readonly<Record<PennyMarker["symbol"], string>> = {
  beacon: "Beacon",
  destination: "Destination",
  enemy: "Enemy",
  growers: "Outpost",
  guard: "Guard",
  heavy: "Heavy ship",
  holodisk: "Holodisk",
  hostileStation: "Hostile station",
  job: "Job objective",
  nebula: "Nebula",
  salvagers: "Outpost",
  station: "Station",
  workshop: "Outpost",
  wreck: "Wreck",
};

export function markerName(marker: Pick<PennyMarker, "identified" | "symbol">): string {
  return marker.identified ? markerNames[marker.symbol] : "Unknown signal";
}

export function pennyGlyph(marker: PennyMarker): string | null {
  if (!marker.identified || threatSymbol(marker.symbol)) {
    return null;
  }
  if (marker.item === "stardust") {
    return uiIconUrl("icon-stardust-20");
  }
  const key = chipGlyph({
    ...(marker.jobType ? { jobType: marker.jobType } : {}),
    symbol: marker.symbol,
  });
  return key ? uiIconUrl(key) : null;
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
type PresentedPennyMarker = PennyMarker & Pick<PresentedTargetMarker, "onScreen" | "trackedLabel">;

interface DirectionStyle {
  readonly blocked?: readonly Rect[];
  readonly color: string;
  /** Whether the field draws foreground edges, so each enemy marker draws over its outline. */
  readonly light: boolean;
  readonly markerShown?: (marker: PennyMarker) => void;
  readonly reducedMotion?: boolean;
  readonly threat?: string;
}
interface MarkerActions {
  readonly available: () => boolean;
  readonly open: (marker: PennyMarker, origin: HTMLElement) => void;
}

/** Reuses the existing atlas question mark and approved category glyphs. */
export function createPennyMarkerLayer(
  doc: Pick<Document, "createElement" | "createElementNS">,
  parent: Pick<HTMLElement, "append">,
  actions?: MarkerActions,
) {
  const layer = doc.createElement("div");
  layer.className = "ada-penny-markers";
  if (!actions) {
    layer.setAttribute("aria-hidden", "true");
  }
  parent.append(layer);
  type Entry = { element: HTMLElement; marker: PennyMarker; dispose?: () => void };
  const nodes = new Map<string, Entry>();
  let previousObjective: { id: string; label: string } | undefined;
  let pulse: Animation | undefined;
  let latest:
    | {
        area: Rect;
        directionStyle: DirectionStyle | undefined;
        markers: readonly PresentedPennyMarker[];
        player: Vec;
      }
    | undefined;
  const assets = maskInk(doc, () => {
    if (latest) {
      view.place(latest.player, latest.area, latest.directionStyle, latest.markers, false);
    }
  });
  function createActionEntry({ available, open }: MarkerActions, marker: PennyMarker): Entry {
    const node = doc.createElement("button");
    const binding = bindAdaAction(
      {
        click: {
          availability: () => ({ kind: "available" }),
          run: () => open(item.marker, node),
        },
        current: () => available(),
        slopPx: () => SCROLL.dragThreshold * readViewUnit(node),
      },
      node,
    );
    node.setAttribute("type", "button");
    const item: Entry = { dispose: binding.dispose, element: node, marker };
    return item;
  }
  const view = {
    destroy() {
      latest = undefined;
      pulse?.cancel();
      for (const entry of nodes.values()) {
        entry.dispose?.();
      }
      layer.remove();
      nodes.clear();
      assets.clear();
    },
    place(
      player: Vec,
      area: Rect,
      directionStyle: DirectionStyle | undefined,
      markers: readonly PresentedPennyMarker[],
      acknowledge = true,
    ) {
      latest = { area, directionStyle, markers, player };
      const style: DirectionStyle = directionStyle ?? {
        color: MAP_FACES.destination,
        light: false,
      };
      const shown = new Set<string>();
      let tracked: { id: string; label: string; node: HTMLElement } | undefined;
      for (const marker of markers) {
        let entry = nodes.get(marker.id);
        if (!entry) {
          const item: Entry = actions
            ? createActionEntry(actions, marker)
            : { element: doc.createElement("div"), marker };
          const node = item.element;
          try {
            node.className = "ada-penny-marker";
            const glyph = doc.createElement("span");
            glyph.className = "ada-penny-glyph";
            node.append(glyph);
            if (actions) {
              assertAdaActionMetadata(node);
            }
            layer.append(node);
            if (actions) {
              assertAdaActionBindings(node);
            }
          } catch (error) {
            item.dispose?.();
            node.remove();
            throw error;
          }
          entry = item;
          nodes.set(marker.id, entry);
        }
        if (actions) {
          const label =
            marker.identified && marker.trackedLabel ? "Tracked quest marker" : markerName(marker);
          if (entry.element.getAttribute("aria-label") !== label) {
            entry.element.setAttribute("aria-label", label);
          }
        }
        entry.marker = marker;
        const node = entry.element;
        node.dataset.identified = String(marker.identified);
        node.dataset.light = String(style.light);
        if (marker.identified) {
          node.dataset.target = marker.id;
          node.dataset.symbol = marker.symbol;
        } else {
          delete node.dataset.target;
          delete node.dataset.symbol;
        }
        const tint = marker.taskCategory && TASK_COLORS[marker.taskCategory];
        // An identified enemy or hostile station is threat red even as a task target.
        const threat = style.threat ?? style.color;
        node.style.setProperty(
          "--marker-face",
          marker.identified && threatSymbol(marker.symbol) ? threat : (tint ?? TASK_COLORS.generic),
        );
        const glyph = pennyGlyph(marker);
        if (glyph) {
          node.style.setProperty("--glyph", `url('${glyph}')`);
        } else {
          node.style.removeProperty("--glyph");
        }
        const label = marker.identified ? marker.trackedLabel : undefined;
        if (label) {
          node.dataset.tracked = "true";
          tracked = { id: marker.id, label, node };
        } else {
          delete node.dataset.tracked;
        }
        shown.add(marker.id);
      }
      if (style.reducedMotion || !tracked) {
        pulse?.cancel();
        pulse = undefined;
      }
      if (tracked) {
        const { id, label, node } = tracked;
        if (previousObjective?.id !== id || previousObjective.label !== label) {
          pulse?.cancel();
          pulse = style.reducedMotion
            ? undefined
            : node.animate?.(
                [{ opacity: 0.55 }, { opacity: 1 }, { opacity: 0.72 }, { opacity: 1 }],
                { duration: 360 },
              );
          previousObjective = { id, label };
        }
      } else if (shown.size > 0) {
        previousObjective = undefined;
      }
      const unit = readViewUnit(layer);
      const dpr = globalThis.devicePixelRatio || 1;
      const scale = unit * dpr;
      const layerStyle = getComputedStyle(layer);
      const areaLeft = parseFloat(layerStyle.getPropertyValue(VIEW_PROPERTIES.areaLeft)) || 0;
      const areaTop = parseFloat(layerStyle.getPropertyValue(VIEW_PROPERTIES.areaTop)) || 0;
      const turn = turnOf(layer);
      const grid = frameDeviceOrigin(turn, layer.getBoundingClientRect(), dpr);
      const extents = new Map<string, TargetMarkerExtent>();
      const paintSizes = new Map<
        string,
        {
          height: number;
          width: number;
        }
      >();
      for (const marker of markers) {
        const { element: node } = nodes.get(marker.id)!;
        const page = node.getBoundingClientRect();
        const body = frameRect(turn, page, page);
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
        const glyphPage = node.firstElementChild?.getBoundingClientRect();
        const glyph = glyphPage && frameRect(turn, page, glyphPage);
        if (
          url &&
          glyph &&
          (glyph.x < 0 ||
            glyph.y < 0 ||
            glyph.x + glyph.width > body.width ||
            glyph.y + glyph.height > body.height)
        ) {
          const alpha = assets.read(url, glyph.width * dpr, glyph.height * dpr);
          if (!alpha || (alpha.width > 0 && alpha.height > 0)) {
            const ink = alpha ?? {
              height: glyph.height * dpr,
              width: glyph.width * dpr,
              x: 0,
              y: 0,
            };
            const x = glyph.x / unit - paint.width / 2 + ink.x / scale;
            const y = glyph.y / unit - paint.height / 2 + ink.y / scale;
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
            origin: { x: grid.x + areaLeft * dpr, y: grid.y + areaTop * dpr },
            scale,
          },
        },
        markers,
      );
      for (const { anchor, at, crowded, target } of placements) {
        const { element: node } = nodes.get(target.id)!;
        node.dataset.anchorX = String(anchor.x);
        node.dataset.anchorY = String(anchor.y);
        node.dataset.crowded = String(crowded);
        const paint = paintSizes.get(target.id)!;
        node.style.left = pixels(areaLeft + (at.x - paint.width / 2) * unit);
        node.style.top = pixels(areaTop + (at.y - paint.height / 2) * unit);
        if (acknowledge) {
          style.markerShown?.(target);
        }
      }
      for (const [id, { dispose, element }] of nodes) {
        if (!shown.has(id)) {
          dispose?.();
          element.remove();
          nodes.delete(id);
        }
      }
    },
  };
  return view;
}
