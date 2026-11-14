import type { Rect } from "@andornaut/game-kit/rect";

import { edgePoint, gameAreaPoint } from "../model/edgeMarkers.ts";
import type { PennyMarker } from "../model/pennyMarkers.ts";
import type { Vec } from "../model/types.ts";
import { fromAreaLeft, units } from "./layout/css.ts";
import { MAP_COLORS, MAP_FACES, MAP_SYMBOL } from "./layout/mapScreen.ts";
import { PENNY_MARKER } from "./layout/pennyMarkers.ts";

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
.ada-penny-marker[data-identified="false"] .ada-penny-glyph{
width:${units(BODY_QUESTION.width)};height:${units(BODY_QUESTION.height)};
background:${MAP_COLORS.ink};mask-image:url('/art/ui/fonts/font-body.png');
-webkit-mask-image:url('/art/ui/fonts/font-body.png');
mask-size:${units(BODY_QUESTION.atlasWidth)} ${units(BODY_QUESTION.atlasHeight)};
-webkit-mask-size:${units(BODY_QUESTION.atlasWidth)} ${units(BODY_QUESTION.atlasHeight)};
mask-position:${units(-BODY_QUESTION.x)} ${units(-BODY_QUESTION.y)};
-webkit-mask-position:${units(-BODY_QUESTION.x)} ${units(-BODY_QUESTION.y)}}
`;

export function pennyGlyph(marker: PennyMarker): string | null {
  if (!marker.identified) {
    return null;
  }
  const key = { discovery: "map-beacon", objective: "map-destination", station: "map-station" }[
    marker.category
  ];
  return `/art/ui/icons/${key}.svg`;
}

interface DirectionStyle {
  readonly color: string;
  readonly edge?: string | undefined;
  readonly light: boolean;
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
        const target = gameAreaPoint(player, marker);
        const centre = gameAreaPoint(player, player);
        const at = edgePoint(area, PENNY_MARKER_INSET, centre, target);
        node.dataset.target = marker.id;
        node.dataset.identified = String(marker.identified);
        node.dataset.light = String(style.light);
        node.style.left = fromAreaLeft(at.x);
        node.style.top = units(at.y);
        node.style.background = !marker.identified
          ? MAP_FACES.destination
          : {
              discovery: MAP_FACES.beacon,
              objective: MAP_COLORS.objective,
              station: MAP_FACES.station,
            }[marker.category];
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
