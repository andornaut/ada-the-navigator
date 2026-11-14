import type { Rect } from "@andornaut/game-kit/rect";

import { LIGHT_FIELD } from "../game/lightField.ts";
import { edgePoint, gameAreaPoint } from "../model/edgeMarkers.ts";
import type { PennyMarker } from "../model/pennyMarkers.ts";
import type { Vec } from "../model/types.ts";
import { fromAreaLeft, units } from "./layout/css.ts";
import { MAP_COLORS, MAP_FACES, MAP_GLYPHS, MAP_JOB_FACE, MAP_SYMBOL } from "./layout/mapScreen.ts";
import { PENNY_MARKER } from "./layout/pennyMarkers.ts";

const { arrow, question: BODY_QUESTION, size: SIZE } = PENNY_MARKER;
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
.ada-penny-marker[data-item] .ada-penny-glyph{mask:none;-webkit-mask:none;
background:var(--glyph) center / contain no-repeat}
.ada-penny-direction{position:absolute;left:50%;top:50%;width:0;height:0}
.ada-penny-direction svg{position:absolute;left:${units(arrow.offset)};top:0;
width:${units(arrow.width)};height:${units(arrow.height)};overflow:visible;
transform:translate(-50%,-50%);fill:none;stroke:var(--direction-color);stroke-width:${arrow.stroke}}
.ada-penny-direction .ada-penny-arrow-ink{stroke:${MAP_COLORS.ink};stroke-width:${LIGHT_FIELD.indicatorStroke}}
.ada-penny-marker[data-light="false"] .ada-penny-arrow-ink{display:none}
`;

export function pennyGlyph(marker: PennyMarker): string | null {
  if (!marker.identified) {
    return null;
  }
  if (marker.item) {
    return `/art/ui/sprites/icon-${marker.item}-20.png`;
  }
  const key = marker.jobType ? `map-job-${marker.jobType}` : MAP_GLYPHS[marker.symbol];
  return key ? `/art/ui/icons/${key}.svg` : null;
}

/** Reuses the existing atlas question mark and canonical map/item glyphs. */
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
      directionStyle: { readonly color: string; readonly light: boolean } | undefined,
      markers: readonly PennyMarker[],
    ) {
      const style = directionStyle ?? { color: MAP_FACES.destination, light: false };
      const shown = new Set<string>();
      for (const marker of markers) {
        let node = nodes.get(marker.id);
        if (!node) {
          node = doc.createElement("div");
          node.className = "ada-penny-marker";
          const glyph = doc.createElement("span");
          glyph.className = "ada-penny-glyph";
          const direction = doc.createElement("span");
          direction.className = "ada-penny-direction";
          const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("viewBox", "-6 -6 15 12");
          for (const ink of [true, false]) {
            const shape = doc.createElementNS("http://www.w3.org/2000/svg", "polygon");
            shape.setAttribute(
              "points",
              `${arrow.tip},0 ${arrow.base},${arrow.base} ${arrow.base},${-arrow.base}`,
            );
            if (ink) {
              shape.setAttribute("class", "ada-penny-arrow-ink");
            }
            svg.append(shape);
          }
          direction.append(svg);
          node.append(glyph, direction);
          layer.append(node);
          nodes.set(marker.id, node);
        }
        const target = gameAreaPoint(player, marker);
        const centre = gameAreaPoint(player, player);
        const at = edgePoint(area, PENNY_MARKER_INSET, centre, target);
        node.dataset.target = marker.id;
        node.dataset.identified = String(marker.identified);
        node.dataset.light = String(style.light);
        if (marker.identified && marker.item) {
          node.dataset.item = marker.item;
        } else {
          delete node.dataset.item;
        }
        node.style.setProperty("--direction-color", style.color);
        node.style.left = fromAreaLeft(at.x);
        node.style.top = units(at.y);
        node.style.background = !marker.identified
          ? MAP_FACES.destination
          : marker.jobType
            ? MAP_JOB_FACE
            : MAP_FACES[marker.symbol];
        const glyph = pennyGlyph(marker);
        if (glyph) {
          node.style.setProperty("--glyph", `url('${glyph}')`);
        } else {
          node.style.removeProperty("--glyph");
        }
        const direction = node.lastElementChild as HTMLElement;
        direction.style.transform = `rotate(${Math.atan2(target.y - centre.y, target.x - centre.x)}rad)`;
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
