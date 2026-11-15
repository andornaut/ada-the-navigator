import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { EDGE_MARKER_GLYPHS } from "../data/edgeMarkers.ts";
import { LIGHT_FIELD } from "../game/lightField.ts";
import type { PennyMarker } from "../model/pennyMarkers.ts";
import type { Vec } from "../model/types.ts";
import { fromAreaLeft, units } from "./layout/css.ts";
import { MAP_COLORS, MAP_FACES, MAP_SYMBOL } from "./layout/mapScreen.ts";
import { PENNY_MARKER } from "./layout/pennyMarkers.ts";
import { layoutTargetMarkers } from "./layout/targetMarkers.ts";
import { SPACING } from "./layout/tokens.ts";
import { chipFace, chipGlyph } from "./mapScreen.ts";

const { question: BODY_QUESTION, size: SIZE } = PENNY_MARKER;
export const PENNY_MARKER_INSET = PENNY_MARKER.inset;

export const PENNY_MARKERS_STYLE = `
.ada-penny-markers{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1}
.ada-penny-marker{position:absolute;box-sizing:border-box;width:${units(SIZE)};
height:${units(SIZE)};border:${units(MAP_SYMBOL.edge)} solid ${MAP_COLORS.ink};
border-radius:50%;display:grid;place-items:center;transform:translate(-50%,-50%)}
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
  return {
    destroy() {
      layer.remove();
      nodes.clear();
    },
    place(
      player: Vec,
      area: Rect,
      directionStyle: DirectionStyle | undefined,
      markers: readonly PennyMarker[],
    ) {
      const style: DirectionStyle = directionStyle ?? {
        color: MAP_FACES.destination,
        light: false,
      };
      const shown = new Set<string>();
      const placements = layoutTargetMarkers(
        {
          area,
          blocked: style.blocked ?? [],
          gap: SPACING.rowGap,
          inset: PENNY_MARKER_INSET,
          player,
          size: SIZE,
        },
        markers,
      );
      for (const { anchor, at, crowded, target: marker } of placements) {
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
        node.dataset.anchorX = String(anchor.x);
        node.dataset.anchorY = String(anchor.y);
        node.dataset.crowded = String(crowded);
        node.dataset.target = marker.id;
        node.dataset.identified = String(marker.identified);
        node.dataset.light = String(style.light);
        node.dataset.symbol = marker.symbol;
        node.style.setProperty("--marker-threat", style.threat ?? style.color);
        node.style.left = fromAreaLeft(at.x);
        node.style.top = units(at.y);
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
      for (const [id, node] of nodes) {
        if (!shown.has(id)) {
          node.remove();
          nodes.delete(id);
        }
      }
    },
  };
}
