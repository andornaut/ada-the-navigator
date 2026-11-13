import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { createModalLayer } from "@andornaut/game-kit/web/ui/dom/modalLayer";

import type { GalaxyNumber } from "../data/types.ts";
import type { LocalMap } from "../model/map.ts";
import type { QuestEntry } from "../model/questDetails.ts";
import { units } from "./layout/css.ts";
import { BUTTON_GAP, STACK_BUTTON_GAP } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createMapScreen, type MapField, type MapScreenLabels } from "./mapScreen.ts";
import { createButton, createCard, isTap, UI_SCOPE } from "./modal.ts";
import { type PauseAction, pauseActions, type PausePlace } from "./pause.ts";
import { createQuestsScreen, type QuestOrigin } from "./questsScreen.ts";
import { refuse } from "./refusal.ts";
import { renderShipSections, shipSections, type ShipView } from "./shipCard.ts";

export interface PauseLabels {
  readonly backToTitle: string;
  readonly close: string;
  readonly map: string;
  /** The full-screen map's own labels. */
  readonly mapScreen: MapScreenLabels;
  readonly resume: string;
  readonly settings: string;
  /** The Ship button and card title. */
  readonly ship: string;
  /** The Ship card's section headings. */
  readonly shipHeadings: {
    readonly ammo: string;
    readonly cargo: string;
    readonly equipment: string;
    readonly weapons: string;
  };
  /** Player copy for the Ship card's rows. */
  readonly shipRows: Readonly<Record<string, string>>;
  readonly title: string;
}

export interface PauseOptions {
  readonly labels: PauseLabels;
  readonly onBackToTitle: () => void;
  readonly onOpenChange: (open: boolean) => void;
  /** Return to Earth, from the Map. */
  readonly onGalaxies: () => void;
  readonly onSettings: () => void;
  readonly onTravel: (destination: string) => void;
  // Whether the player chose Reduced motion, which keeps the refusal cue still.
  readonly reducedMotion: () => boolean;
}

export interface PauseState {
  readonly galaxy?: GalaxyNumber;
  /** Live model-owned quests from every galaxy, with no UI or save-state duplication. */
  readonly questEntries?: readonly QuestEntry[];
  /** The current galaxy's map field: its name, background and fog. */
  readonly field: MapField | null;
  readonly inDanger: boolean;
  /** The held station job's objective for the Map, or null without one. */
  readonly job: string | null;
  /** The current galaxy's map, or null outside a flight. */
  readonly map: LocalMap | null;
  /** Where the card opens now: in flight, on Ada's room page, or nowhere. */
  readonly place: PausePlace | null;
  /** The Ship card's facts, or null outside a flight. */
  readonly ship: ShipView | null;
  /** A rescue's tow line is attached: Travel here refuses. */
  readonly towing: boolean;
  /** A delivery's or a supply run's item is aboard: Travel here refuses. */
  readonly carrying: boolean;
}

const NO_MAP: LocalMap = {
  explored: [],
  facing: { x: 0, y: -1 },
  landmarks: { charted: 0, total: 0 },
  mapped: 0,
  places: [],
  player: { x: 0, y: 0 },
  quests: [],
  searchArea: null,
};

// An action stack: full-width actions a gap apart, filling the card's inner width.
function stack(): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "ada-actions ada-stack";
  group.dataset.inkTop = "0";
  return group;
}

/** The Paused card's grid: six equal buttons, with primary Resume last at the bottom right. */
export const PAUSE_GRID_STYLE = `
${UI_SCOPE} .ada-actions.ada-pause-grid{
  grid-auto-flow:row;
  grid-template-columns:1fr 1fr;
  column-gap:${units(BUTTON_GAP)};
  row-gap:${units(STACK_BUTTON_GAP)};
  width:auto
}
`;

// Two columns of equal actions, BUTTON_GAP between columns and STACK_BUTTON_GAP between rows.
function grid(): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "ada-actions ada-pause-grid";
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

// The Paused card (art/layout.md), its Ship card and its full-screen map (art/map.md), as in
// Chibi: one shows at a time, the cards over the dimmed game and the map in the dim's place. The
// X, an outside tap, back and Escape resume from the Paused card; from the Ship card and the map
// they return to the Paused card.
export function createPauseCards(root: HTMLElement, options: PauseOptions) {
  const { labels } = options;
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
  const others = grid();
  actions.append(others);
  const buttons = new Map<PauseAction, HTMLButtonElement>();
  const text: Record<PauseAction, string> = {
    backToTitle: labels.backToTitle,
    map: labels.map,
    quests: labels.mapScreen.quests,
    resume: labels.resume,
    settings: labels.settings,
    ship: labels.ship,
  };
  // Every action is built once, in flight's order; each place shows its own. The rest fill the
  // grid in order, so the room's two share its first row and Resume ends the flight grid.
  for (const { id, role } of pauseActions("flight")) {
    const button = createButton(text[id], role);
    button.dataset.action = `pause-${id}`;
    buttons.set(id, button);
    others.append(button);
  }
  paused.body.append(actions);
  const ship = createCard({
    closeAction: "close-ship",
    closeLabel: labels.close,
    full: true,
    title: labels.ship,
  });
  ship.card.dataset.dialog = "ship";
  ship.frame.hidden = true;
  modal.append(paused.frame, ship.frame);
  root.append(modal);
  const mapScreen = createMapScreen(root, {
    labels: labels.mapScreen,
    onClose: () => closeMap(),
    // The galaxy map opens over the local map, which stays open beneath it.
    onGalaxies: () => options.onGalaxies(),
    onQuests: () => openQuests(),
    onTravel: (id) => {
      setOpen(false);
      options.onTravel(id);
    },
    reducedMotion: options.reducedMotion,
  });
  let questRoot: "map" | "flight" = "map";
  const quests = createQuestsScreen(root, {
    labels: labels.mapScreen,
    onClose: () => {
      if (questRoot === "flight") {
        setOpen(false);
      } else {
        mapScreen.focusQuests();
      }
    },
    onLocate: (id) => {
      questRoot = "map";
      if (!mapScreen.isOpen()) {
        show("map");
      }
      mapScreen.locate(id);
    },
  });
  let open = false;
  let mapOpener: "map" | "quests" = "map";
  let state: PauseState = {
    carrying: false,
    field: null,
    inDanger: false,
    job: null,
    map: null,
    place: null,
    ship: null,
    towing: false,
  };
  let layer: ReturnType<typeof createModalLayer> | undefined;
  let leaveLayer: (() => void) | undefined;
  const actionsHere = () => pauseActions(state.place ?? "flight");
  const mapOpen = () => open && mapScreen.isOpen();
  const shipOpen = () => open && !ship.frame.hidden;
  // The map shows in the cards' and the dim's place; the Ship card in the Paused card's.
  const show = (view: "map" | "paused" | "ship") => {
    leaveLayer?.();
    leaveLayer = undefined;
    layer?.dispose();
    layer = undefined;
    modal.hidden = view === "map";
    paused.frame.hidden = view !== "paused";
    ship.frame.hidden = view !== "ship";
    if (view === "map") {
      mapScreen.open();
      return;
    }
    mapScreen.close();
    if (view === "ship") {
      renderShip();
      layer = createModalLayer(modal);
      leaveLayer = layer.open({ close: closeShip, focus: ship.close }, ship.card);
      return;
    }
    paused.fit();
    // Focus starts on the primary Resume, else the first action shown.
    const focus =
      actions.querySelector<HTMLButtonElement>(".ada-primary:not([hidden])") ??
      actions.querySelector<HTMLButtonElement>("button:not([hidden])") ??
      paused.close;
    layer = createModalLayer(modal);
    leaveLayer = layer.open({ close: () => setOpen(false), focus }, paused.card);
  };
  // What the Ship card last showed, so its rows rebuild only on a change.
  let shipShown: string | undefined;
  const renderShip = () => {
    const sections = state.ship ? shipSections(labels.shipRows, state.ship) : null;
    const signature = JSON.stringify(sections);
    if (signature !== shipShown) {
      shipShown = signature;
      ship.body.replaceChildren(
        ...(sections ? [renderShipSections(labels.shipHeadings, sections)] : []),
      );
    }
    ship.fit();
  };
  const setOpen = (value: boolean) => {
    if (value === open) {
      return;
    }
    open = value;
    modal.hidden = !value;
    shown = undefined;
    shipShown = undefined;
    if (value) {
      render();
      show("paused");
    } else {
      leaveLayer?.();
      leaveLayer = undefined;
      layer?.dispose();
      layer = undefined;
      quests.close();
      mapScreen.close();
    }
    options.onOpenChange(value);
  };
  // What the card last showed. Rendering only on a change keeps each button's node across
  // frames, so a press is never lost to a rebuilt button.
  let shown: string | undefined;
  const render = () => {
    quests.setState(state.questEntries ?? [], state.map?.places ?? [], state.galaxy);
    mapScreen.setState({
      carrying: state.carrying,
      field: state.field,
      inDanger: state.inDanger,
      job: state.job,
      map: state.map ?? NO_MAP,
      towing: state.towing,
    });
    const signature = JSON.stringify([state.place]);
    if (signature === shown) {
      return;
    }
    shown = signature;
    const here = new Map(actionsHere().map((view) => [view.id, view]));
    for (const [id, button] of buttons) {
      button.hidden = !here.has(id);
      setAvailable(button, here.get(id)?.available ?? true);
    }
    if (open && !mapScreen.isOpen()) {
      paused.fit();
    }
  };
  const renderAll = () => {
    render();
    if (shipOpen()) {
      renderShip();
    }
  };
  function openQuests(opener: "map" | "quests" = "map"): void {
    mapOpener = opener;
    setOpen(true);
    show("map");
    questRoot = "map";
    quests.open();
  }
  function openQuest(id: string, origin: QuestOrigin = "flight"): void {
    questRoot = origin === "flight" ? "flight" : "map";
    setOpen(true);
    if (questRoot === "flight") {
      leaveLayer?.();
      leaveLayer = undefined;
      layer?.dispose();
      layer = undefined;
      modal.hidden = true;
      mapScreen.close();
    } else {
      show("map");
    }
    quests.open(id, origin);
  }
  const act = (id: PauseAction) => {
    const button = buttons.get(id)!;
    if (!actionsHere().find((view) => view.id === id)?.available) {
      refuse(button, options.reducedMotion());
      return;
    }
    if (id === "resume") {
      setOpen(false);
    } else if (id === "map") {
      mapOpener = "map";
      show("map");
    } else if (id === "quests") {
      openQuests("quests");
    } else if (id === "ship") {
      show("ship");
    } else if (id === "settings") {
      // Settings opens in the Paused card's place; closing it returns here (reopen).
      setOpen(false);
      options.onSettings();
    } else {
      setOpen(false);
      options.onBackToTitle();
    }
  };
  for (const [id, button] of buttons) {
    button.addEventListener("click", () => act(id));
  }
  paused.close.addEventListener("click", () => setOpen(false));
  ship.close.addEventListener("click", () => closeShip());
  // The Ship card's X, back and Escape return to the Paused card, on its Ship button.
  function closeShip(): void {
    if (shipOpen()) {
      show("paused");
      const shipButton = buttons.get("ship");
      if (shipButton) {
        focusTarget(shipButton);
      }
    }
  }
  // Back and Escape close the Quests modal first, then the map.
  function closeMap(): void {
    if (quests.isOpen()) {
      quests.back();
      return;
    }
    if (mapOpen()) {
      show("paused");
      const mapButton = buttons.get(mapOpener);
      if (mapButton && !mapButton.hidden) {
        focusTarget(mapButton);
      }
    }
  }
  // A full outside tap resumes from the Paused card and returns to it from Map and Ship.
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
      if (shipOpen()) {
        closeShip();
      } else {
        setOpen(false);
      }
    }
    outside = undefined;
  });
  return {
    close: () => {
      if (quests.isOpen()) {
        quests.back();
      } else {
        setOpen(false);
      }
    },
    closeMap,
    closeShip,
    dispose(): void {
      layer?.dispose();
      paused.dispose();
      ship.dispose();
      quests.dispose();
      mapScreen.dispose();
      modal.remove();
    },
    /** The local map's Galaxies takes focus again once the galaxy map over it closes. */
    focusGalaxies(): void {
      if (mapOpen()) {
        mapScreen.focusGalaxies();
      }
    },
    isOpen: () => open,
    mapOpen,
    open: () => setOpen(true),
    openQuest,
    openQuests,
    setState(next: PauseState): void {
      state = next;
      renderAll();
    },
    shipOpen,
  };
}
