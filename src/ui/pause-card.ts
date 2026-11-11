import type { GalaxyMap, MapPlace } from "../model/map.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createMapChart, MAP_STYLE } from "./map-chart.ts";
import { createButton, createCard, isTap } from "./modal.ts";
import { mapShowsEmpty, type PauseAction, pauseActions } from "./pause.ts";
import { refuse } from "./refusal.ts";

export interface PauseLabels {
  readonly close: string;
  readonly map: string;
  /** "{percent}% mapped". */
  readonly mapPercent: string;
  readonly resume: string;
  readonly returnHome: string;
  readonly settings: string;
  readonly title: string;
  readonly travelEmpty: string;
  readonly travelHere: string;
  readonly travelUnavailable: string;
  /** Travel's note while a tow line is attached. */
  readonly towTravel: string;
}

export interface PauseOptions {
  readonly labels: PauseLabels;
  readonly onOpenChange: (open: boolean) => void;
  readonly onReturnHome: () => void;
  readonly onSettings: () => void;
  readonly onTravel: (destination: string) => void;
  // Whether the player chose Reduced motion, which keeps the refusal cue still.
  readonly reducedMotion: () => boolean;
}

export interface PauseState {
  readonly inDanger: boolean;
  /** The current galaxy's map, or null outside a flight. */
  readonly map: GalaxyMap | null;
  /** A rescue's tow line is attached: Travel here refuses. */
  readonly towing: boolean;
}

const NO_MAP: GalaxyMap = { mapped: 0, places: [], player: { x: 0, y: 0 } };

// An action stack: full-width actions a gap apart, filling the card's inner width.
function stack(): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "ada-actions ada-stack";
  group.dataset.inkTop = "0";
  return group;
}

// An unavailable action shows the disabled face and refuses: it stays focusable and pressable so
// the press can be refused with the shared cue.
function setAvailable(button: HTMLButtonElement, available: boolean): void {
  button.classList.toggle("ada-unavailable", !available);
  if (available) {
    button.removeAttribute("aria-disabled");
  } else {
    button.setAttribute("aria-disabled", "true");
  }
}

// A note line in a card's body.
function note(text: string): HTMLParagraphElement {
  const line = document.createElement("p");
  line.className = "ada-card-note ada-prose";
  line.textContent = text;
  return line;
}

// The Paused card and its Map card, as in Chibi: one card shows at a time over the dimmed game.
// The X, an outside tap, back and Escape resume from the Paused card; from Map they return to it.
export function createPauseCards(root: HTMLElement, options: PauseOptions) {
  const { labels } = options;
  const style = document.createElement("style");
  style.textContent = MAP_STYLE;
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const paused = createCard({
    closeAction: "close-pause",
    closeLabel: labels.close,
    title: labels.title,
  });
  paused.card.dataset.dialog = "pause";
  const actions = stack();
  const buttons = new Map<PauseAction, HTMLButtonElement>();
  const text: Record<PauseAction, string> = {
    map: labels.map,
    resume: labels.resume,
    returnHome: labels.returnHome,
    settings: labels.settings,
  };
  for (const { id, role } of pauseActions(false)) {
    const button = createButton(text[id], role);
    button.dataset.action = `pause-${id}`;
    buttons.set(id, button);
    actions.append(button);
  }
  const danger = note(labels.travelUnavailable);
  danger.hidden = true;
  paused.body.append(actions, danger);
  // The Map card: the percent mapped, the chart, then the chosen place and Travel here.
  const mapCard = createCard({
    closeAction: "close-map",
    closeLabel: labels.close,
    title: labels.map,
  });
  mapCard.card.dataset.dialog = "map";
  mapCard.frame.hidden = true;
  const percent = note("");
  percent.classList.add("ada-map-percent");
  percent.dataset.inkTop = "0";
  let selected: MapPlace | null = null;
  const chart = createMapChart((place) => {
    selected = place;
    shown = undefined;
    render();
  });
  const empty = note(labels.travelEmpty);
  const name = document.createElement("p");
  name.className = "ada-map-name";
  const travel = createButton(labels.travelHere, "primary");
  travel.dataset.action = "map-travel";
  const travelGroup = stack();
  travelGroup.append(travel);
  const mapDanger = note(labels.travelUnavailable);
  const towNote = note(labels.towTravel);
  mapCard.body.append(percent, chart.element, empty, name, travelGroup, mapDanger, towNote);
  modal.append(paused.frame, mapCard.frame);
  root.append(modal, style);
  let open = false;
  let state: PauseState = { inDanger: false, map: null, towing: false };
  // Travel here refuses in danger and while towing.
  const travelRefused = () => state.inDanger || state.towing;
  const mapOpen = () => open && !mapCard.frame.hidden;
  const show = (card: "map" | "paused") => {
    paused.frame.hidden = card !== "paused";
    mapCard.frame.hidden = card !== "map";
    (card === "paused" ? paused : mapCard).fit();
    const first =
      card === "paused" ? actions.querySelector("button") : (chart.buttons()[0] ?? null);
    (first ?? (card === "paused" ? paused.close : mapCard.close)).focus();
  };
  const setOpen = (value: boolean) => {
    if (value === open) {
      return;
    }
    open = value;
    modal.hidden = !value;
    selected = null;
    shown = undefined;
    if (value) {
      render();
      show("paused");
    }
    options.onOpenChange(value);
  };
  // What the cards last showed, and the chart's map. Rendering only on a change keeps each
  // button's node across frames, so a press is never lost to a rebuilt button.
  let shown: string | undefined;
  let shownMap: string | undefined;
  const render = () => {
    const map = state.map ?? NO_MAP;
    const place = selected && map.places.find(({ id }) => id === selected!.id);
    selected = place ?? null;
    const signature = JSON.stringify([map, selected?.id ?? null, state.inDanger, state.towing]);
    if (signature === shown) {
      return;
    }
    shown = signature;
    for (const { available, id } of pauseActions(state.inDanger)) {
      setAvailable(buttons.get(id)!, available);
    }
    danger.hidden = !state.inDanger;
    percent.textContent = labels.mapPercent.replace("{percent}", String(map.mapped));
    const mapSignature = JSON.stringify(map);
    if (mapSignature !== shownMap) {
      shownMap = mapSignature;
      chart.render(map, selected?.id ?? null);
    } else {
      for (const button of chart.buttons()) {
        button.setAttribute("aria-pressed", String(button.dataset.place === selected?.id));
      }
    }
    empty.hidden = !mapShowsEmpty(map.places);
    name.hidden = selected === null;
    name.textContent = selected?.label ?? "";
    travelGroup.hidden = !selected?.travel;
    setAvailable(travel, !travelRefused());
    mapDanger.hidden = !state.inDanger || travelGroup.hidden;
    towNote.hidden = !state.towing || state.inDanger || travelGroup.hidden;
    if (open) {
      (mapCard.frame.hidden ? paused : mapCard).fit();
    }
  };
  const act = (id: PauseAction) => {
    const button = buttons.get(id)!;
    if (!pauseActions(state.inDanger).find((view) => view.id === id)?.available) {
      refuse(button, options.reducedMotion());
      return;
    }
    if (id === "resume") {
      setOpen(false);
    } else if (id === "map") {
      show("map");
    } else if (id === "settings") {
      // Settings opens in the Paused card's place; closing it returns here (reopen).
      setOpen(false);
      options.onSettings();
    } else {
      setOpen(false);
      options.onReturnHome();
    }
  };
  for (const [id, button] of buttons) {
    button.addEventListener("click", () => act(id));
  }
  travel.addEventListener("click", () => {
    if (!selected?.travel) {
      return;
    }
    if (travelRefused()) {
      refuse(travel, options.reducedMotion());
      return;
    }
    const { id } = selected;
    setOpen(false);
    options.onTravel(id);
  });
  paused.close.addEventListener("click", () => setOpen(false));
  const closeMap = () => {
    if (mapOpen()) {
      selected = null;
      render();
      show("paused");
    }
  };
  mapCard.close.addEventListener("click", closeMap);
  // A full outside tap resumes from the Paused card and returns to it from Map.
  let outside: { readonly x: number; readonly y: number } | undefined;
  modal.addEventListener("pointerdown", (event) => {
    outside = event.target === modal ? { x: event.clientX, y: event.clientY } : undefined;
  });
  modal.addEventListener("click", (event) => {
    if (
      outside &&
      event.target === modal &&
      isTap(readViewUnit(modal), outside, { x: event.clientX, y: event.clientY })
    ) {
      if (mapOpen()) {
        closeMap();
      } else {
        setOpen(false);
      }
    }
    outside = undefined;
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      const frame = mapCard.frame.hidden ? paused.frame : mapCard.frame;
      const targets = [...frame.querySelectorAll<HTMLButtonElement>("button")].filter(
        (button) => !button.closest("[hidden]"),
      );
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  return {
    close: () => setOpen(false),
    closeMap,
    dispose(): void {
      paused.dispose();
      mapCard.dispose();
      modal.remove();
      style.remove();
    },
    isOpen: () => open,
    mapOpen,
    open: () => setOpen(true),
    setState(next: PauseState): void {
      state = next;
      render();
    },
  };
}
