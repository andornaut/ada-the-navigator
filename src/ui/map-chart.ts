import type { GalaxyMap, MapPlace } from "../model/map.ts";
import { font, units } from "./layout/css.ts";
import { type ChartPoint, chartPoints, MAP_CARD, pickedPlace } from "./layout/mapCard.ts";
import { TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { TEXT_TOKENS } from "./modal.ts";

// The Map card's chart (MAP_CARD, layout/mapCard.ts): Ada's marker and one button per discovered
// or charted place, at their projected positions. Choosing a place selects it.
// CLEANUP (added 2026-11-11): provisional marker faces from the card's text colours until Art
// designs the map card.
const FACE = {
  ada: "#4f9fe0",
  objective: TEXT_TOKENS.title,
  place: TEXT_TOKENS.label,
  ring: TEXT_TOKENS.title,
} as const;

export const MAP_STYLE = `
.ada-controls .ada-card .ada-map-percent{
  font:${font(TYPE.label)};
  color:${TEXT_TOKENS.supporting}
}

.ada-controls .ada-card .ada-map-chart{
  position:relative;
  flex:none;
  align-self:center;
  width:${units(MAP_CARD.chart.width)};
  height:${units(MAP_CARD.chart.height)};
  background:#181425;
  overflow:hidden
}

.ada-controls .ada-card .ada-map-chart .ada-map-ada,
.ada-controls .ada-card .ada-map-chart .ada-map-place{
  position:absolute;
  transform:translate(-50%, -50%)
}

.ada-controls .ada-card .ada-map-chart .ada-map-ada{
  width:${units(MAP_CARD.marker.ada)};
  height:${units(MAP_CARD.marker.ada)};
  border-radius:50%;
  background:${FACE.ada};
  pointer-events:none
}

/* A place's face is the small disc inside its minimum target. Pointer presses go to the chart,
   which picks the nearest face (pickedPlace); keyboard focus and activation stay on the button. */
.ada-controls .ada-card .ada-map-chart .ada-map-place{
  pointer-events:none;
  width:${units(MAP_CARD.marker.target)};
  height:${units(MAP_CARD.marker.target)};
  padding:0;
  border:0;
  background:none;
  min-width:0;
  min-height:0
}
.ada-controls .ada-card .ada-map-chart .ada-map-place::before{
  content:"";
  position:absolute;
  left:50%;
  top:50%;
  width:${units(MAP_CARD.marker.place)};
  height:${units(MAP_CARD.marker.place)};
  transform:translate(-50%, -50%);
  border-radius:50%;
  background:${FACE.place}
}
.ada-controls .ada-card .ada-map-chart .ada-map-place[data-kind="station"]::before{
  border-radius:0
}
.ada-controls .ada-card .ada-map-chart .ada-map-place[data-objective]::before{
  background:${FACE.objective}
}
.ada-controls .ada-card .ada-map-chart .ada-map-place[aria-pressed="true"]::before,
.ada-controls .ada-card .ada-map-chart .ada-map-place:focus-visible::before{
  outline:${units(MAP_CARD.marker.ring)} solid ${FACE.ring};
  outline-offset:${units(MAP_CARD.marker.ring)}
}

.ada-controls .ada-card .ada-map-name{
  font:${font(TYPE.label)};
  color:${TEXT_TOKENS.title}
}
`;

// A marker's position on the chart, as left and top in logical units.
function place(element: HTMLElement, point: { readonly x: number; readonly y: number }): void {
  element.style.left = units(point.x);
  element.style.top = units(point.y);
}

export function createMapChart(onSelect: (place: MapPlace) => void) {
  const chart = document.createElement("div");
  chart.className = "ada-map-chart";
  const ada = document.createElement("span");
  ada.className = "ada-map-ada";
  ada.setAttribute("aria-hidden", "true");
  let buttons: HTMLButtonElement[] = [];
  let places: readonly MapPlace[] = [];
  let markers: ChartPoint[] = [];
  chart.addEventListener("click", (event) => {
    // A keyboard press activates its own button; only pointer presses land on the chart.
    if (event.target !== chart) {
      return;
    }
    const box = chart.getBoundingClientRect();
    const unit = readViewUnit(chart);
    const index = pickedPlace(markers, {
      x: (event.clientX - box.left) / unit,
      y: (event.clientY - box.top) / unit,
    });
    if (index !== null) {
      onSelect(places[index]!);
    }
  });
  return {
    /** The places' buttons, in the map's order. */
    buttons: () => buttons,
    element: chart,
    render(map: GalaxyMap, selected: string | null): void {
      const points = chartPoints([map.player, ...map.places]);
      place(ada, points[0]!);
      places = map.places;
      markers = points.slice(1);
      buttons = map.places.map((entry, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ada-map-place";
        button.dataset.place = entry.id;
        button.dataset.kind = entry.kind;
        button.toggleAttribute("data-objective", entry.objective);
        button.setAttribute("aria-label", entry.label);
        button.setAttribute("aria-pressed", String(entry.id === selected));
        place(button, points[index + 1]!);
        button.addEventListener("click", () => onSelect(entry));
        return button;
      });
      chart.replaceChildren(ada, ...buttons);
    },
  };
}
