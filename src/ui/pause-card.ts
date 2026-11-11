import type { GalaxyMap } from "../model/map.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createMapScreen, MAP_SCREEN_STYLE, type MapField } from "./map-screen.ts";
import { createButton, createCard, isTap } from "./modal.ts";
import { type PauseAction, pauseActions } from "./pause.ts";
import { refuse } from "./refusal.ts";

export interface PauseLabels {
  readonly achievements: string;
  readonly close: string;
  /** "Job: {objective}". */
  readonly jobObjective: string;
  readonly map: string;
  /** "{percent}% mapped". */
  readonly mapPercent: string;
  /** The map tools' accessible labels. */
  readonly mapRecentre: string;
  readonly mapZoomIn: string;
  readonly mapZoomOut: string;
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
  readonly onAchievements: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onReturnHome: () => void;
  readonly onSettings: () => void;
  readonly onTravel: (destination: string) => void;
  // Whether the player chose Reduced motion, which keeps the refusal cue still.
  readonly reducedMotion: () => boolean;
}

export interface PauseState {
  /** The current galaxy's map field: its name, background and fog. */
  readonly field: MapField | null;
  readonly inDanger: boolean;
  /** The held station job's objective, or null without one. */
  readonly job: string | null;
  /** The current galaxy's map, or null outside a flight. */
  readonly map: GalaxyMap | null;
  /** The current story objective, or empty. */
  readonly objective: string;
  /** A rescue's tow line is attached: Travel here refuses. */
  readonly towing: boolean;
}

const NO_MAP: GalaxyMap = {
  explored: [],
  facing: { x: 0, y: -1 },
  landmarks: { charted: 0, total: 0 },
  mapped: 0,
  places: [],
  player: { x: 0, y: 0 },
};

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

// The Paused card and its full-screen map (art/map.md), as in Chibi: one shows at a time, the
// card over the dimmed game and the map in the dim's place. The X, an outside tap, back and Escape
// resume from the Paused card; from the map, its close tool, back and Escape return to the card.
export function createPauseCards(root: HTMLElement, options: PauseOptions) {
  const { labels } = options;
  const style = document.createElement("style");
  style.textContent = MAP_SCREEN_STYLE;
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
    achievements: labels.achievements,
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
  // Above the buttons: the story objective, then the held job's.
  const objective = note("");
  objective.classList.add("ada-pause-objective");
  objective.dataset.inkTop = "0";
  const job = note("");
  job.classList.add("ada-pause-job");
  job.dataset.inkTop = "0";
  paused.body.append(objective, job, actions, danger);
  modal.append(paused.frame);
  root.append(modal, style);
  const mapScreen = createMapScreen(root, {
    labels: {
      close: labels.close,
      map: labels.map,
      mapPercent: labels.mapPercent,
      recentre: labels.mapRecentre,
      towTravel: labels.towTravel,
      travelEmpty: labels.travelEmpty,
      travelHere: labels.travelHere,
      travelUnavailable: labels.travelUnavailable,
      zoomIn: labels.mapZoomIn,
      zoomOut: labels.mapZoomOut,
    },
    onClose: () => closeMap(),
    onTravel: (id) => {
      setOpen(false);
      options.onTravel(id);
    },
    reducedMotion: options.reducedMotion,
  });
  let open = false;
  let state: PauseState = {
    field: null,
    inDanger: false,
    job: null,
    map: null,
    objective: "",
    towing: false,
  };
  const mapOpen = () => open && mapScreen.isOpen();
  // The map shows in the card's and the dim's place.
  const show = (view: "map" | "paused") => {
    modal.hidden = view !== "paused";
    if (view === "map") {
      mapScreen.open();
      return;
    }
    mapScreen.close();
    paused.fit();
    (actions.querySelector("button") ?? paused.close).focus();
  };
  const setOpen = (value: boolean) => {
    if (value === open) {
      return;
    }
    open = value;
    modal.hidden = !value;
    shown = undefined;
    if (value) {
      render();
      show("paused");
    } else {
      mapScreen.close();
    }
    options.onOpenChange(value);
  };
  // What the card last showed. Rendering only on a change keeps each button's node across
  // frames, so a press is never lost to a rebuilt button.
  let shown: string | undefined;
  const render = () => {
    mapScreen.setState({
      field: state.field,
      inDanger: state.inDanger,
      map: state.map ?? NO_MAP,
      towing: state.towing,
    });
    const signature = JSON.stringify([state.inDanger, state.objective, state.job]);
    if (signature === shown) {
      return;
    }
    shown = signature;
    objective.textContent = state.objective;
    objective.hidden = state.objective === "";
    job.textContent =
      state.job === null ? "" : labels.jobObjective.replace("{objective}", state.job);
    job.hidden = state.job === null;
    for (const { available, id } of pauseActions(state.inDanger)) {
      setAvailable(buttons.get(id)!, available);
    }
    danger.hidden = !state.inDanger;
    if (open && !mapScreen.isOpen()) {
      paused.fit();
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
    } else if (id === "achievements") {
      // Achievements opens in the Paused card's place too, and closing it returns here.
      setOpen(false);
      options.onAchievements();
    } else {
      setOpen(false);
      options.onReturnHome();
    }
  };
  for (const [id, button] of buttons) {
    button.addEventListener("click", () => act(id));
  }
  paused.close.addEventListener("click", () => setOpen(false));
  function closeMap(): void {
    if (mapOpen()) {
      show("paused");
      buttons.get("map")?.focus();
    }
  }
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
      setOpen(false);
    }
    outside = undefined;
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      const targets = [...paused.frame.querySelectorAll<HTMLButtonElement>("button")].filter(
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
      mapScreen.dispose();
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
