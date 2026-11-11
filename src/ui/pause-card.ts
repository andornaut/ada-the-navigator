import { readViewUnit } from "./layout/viewScale.ts";
import { createButton, createCard, isTap } from "./modal.ts";
import { type PauseAction, pauseActions, travelShowsEmpty } from "./pause.ts";
import { refuse } from "./refusal.ts";

export interface PauseLabels {
  readonly close: string;
  readonly destinations: string;
  readonly resume: string;
  readonly returnHome: string;
  readonly settings: string;
  readonly title: string;
  readonly travel: string;
  readonly travelEmpty: string;
  readonly travelUnavailable: string;
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
  readonly destinations: readonly { readonly id: string; readonly label: string }[];
  readonly inDanger: boolean;
}

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

// The Paused card and its Travel card, as in Chibi: one card shows at a time over the dimmed
// game. The X, an outside tap, back and Escape resume from the Paused card; from Travel they
// return to it.
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
  const buttons = new Map<PauseAction, HTMLButtonElement>();
  const text: Record<PauseAction, string> = {
    resume: labels.resume,
    returnHome: labels.returnHome,
    settings: labels.settings,
    travel: labels.travel,
  };
  for (const { id, role } of pauseActions(false)) {
    const button = createButton(text[id], role);
    button.dataset.action = `pause-${id}`;
    buttons.set(id, button);
    actions.append(button);
  }
  const note = document.createElement("p");
  note.className = "ada-card-note ada-prose";
  note.textContent = labels.travelUnavailable;
  note.hidden = true;
  paused.body.append(actions, note);
  const travel = createCard({
    closeAction: "close-travel",
    closeLabel: labels.close,
    title: labels.destinations,
  });
  travel.card.dataset.dialog = "travel";
  travel.frame.hidden = true;
  const places = stack();
  const empty = document.createElement("p");
  empty.className = "ada-card-note ada-prose";
  empty.dataset.inkTop = "0";
  empty.textContent = labels.travelEmpty;
  travel.body.append(places, empty);
  modal.append(paused.frame, travel.frame);
  root.append(modal);
  let open = false;
  let state: PauseState = { destinations: [], inDanger: false };
  const travelOpen = () => open && !travel.frame.hidden;
  const show = (card: "paused" | "travel") => {
    paused.frame.hidden = card !== "paused";
    travel.frame.hidden = card !== "travel";
    (card === "paused" ? paused : travel).fit();
    const first = (card === "paused" ? actions : places).querySelector("button");
    (first ?? (card === "paused" ? paused.close : travel.close)).focus();
  };
  const setOpen = (value: boolean) => {
    if (value === open) {
      return;
    }
    open = value;
    modal.hidden = !value;
    if (value) {
      show("paused");
    }
    options.onOpenChange(value);
  };
  const render = () => {
    const views = pauseActions(state.inDanger);
    for (const { available, id } of views) {
      setAvailable(buttons.get(id)!, available);
    }
    note.hidden = !state.inDanger;
    empty.hidden = !travelShowsEmpty(state.destinations);
    places.hidden = !empty.hidden;
    places.replaceChildren(
      ...state.destinations.map(({ id, label }) => {
        const button = createButton(label);
        button.dataset.destination = id;
        setAvailable(button, !state.inDanger);
        button.addEventListener("click", () => {
          if (state.inDanger) {
            refuse(button, options.reducedMotion());
            return;
          }
          setOpen(false);
          options.onTravel(id);
        });
        return button;
      }),
    );
    if (open) {
      (travel.frame.hidden ? paused : travel).fit();
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
    } else if (id === "travel") {
      show("travel");
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
  paused.close.addEventListener("click", () => setOpen(false));
  const closeTravel = () => {
    if (travelOpen()) {
      show("paused");
    }
  };
  travel.close.addEventListener("click", closeTravel);
  // A full outside tap resumes from the Paused card and returns to it from Travel.
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
      if (travelOpen()) {
        closeTravel();
      } else {
        setOpen(false);
      }
    }
    outside = undefined;
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      const frame = travel.frame.hidden ? paused.frame : travel.frame;
      const targets = [...frame.querySelectorAll<HTMLButtonElement>("button")];
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
    closeTravel,
    dispose(): void {
      paused.dispose();
      travel.dispose();
      modal.remove();
    },
    isOpen: () => open,
    open: () => setOpen(true),
    setState(next: PauseState): void {
      state = next;
      render();
    },
    travelOpen,
  };
}
