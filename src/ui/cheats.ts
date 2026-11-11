import { type CheatAction, createCheatSession } from "./cheat-actions.ts";
import { createButton, createCard } from "./modal.ts";

export interface CheatLabels {
  readonly close: string;
  readonly emptyRunActions: string;
  readonly open: string;
  readonly runGroup: string;
  readonly runPersistence: string;
  readonly saveGroup: string;
  readonly savePersistence: string;
  readonly title: string;
}

interface CheatOptions {
  readonly actions: readonly CheatAction[];
  readonly beforeOpen: () => void;
  readonly canExecute: () => boolean;
  readonly labels: CheatLabels;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: () => void;
  readonly run: () => object | null;
  readonly restoreFocus: () => void;
}

/** Browser-tab-only modal; the session also guards dispatch and deferred commits. */
export function createCheats(
  parent: HTMLElement,
  launcherParent: HTMLElement,
  options: CheatOptions,
) {
  const session = createCheatSession({
    ...options,
    canExecute: () => open && options.canExecute(),
    host: window,
  });
  const launcher = createButton(options.labels.open);
  launcher.dataset.action = "cheats";
  launcher.setAttribute("aria-haspopup", "dialog");
  launcher.setAttribute("aria-expanded", "false");
  launcherParent.append(launcher);
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const { card, close, frame } = createCard({
    closeAction: "close-cheats",
    closeLabel: options.labels.close,
    title: options.labels.title,
  });
  const buttons: HTMLButtonElement[] = [];
  for (const scope of ["save", "run"] as const) {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = scope === "save" ? options.labels.saveGroup : options.labels.runGroup;
    const persistence = document.createElement("p");
    persistence.textContent =
      scope === "save" ? options.labels.savePersistence : options.labels.runPersistence;
    section.setAttribute("aria-label", heading.textContent);
    section.append(heading, persistence);
    const actions = options.actions.filter((action) => action.scope === scope);
    if (scope === "run" && actions.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = options.labels.emptyRunActions;
      section.append(empty);
    }
    for (const action of actions) {
      const button = createButton(action.label);
      button.dataset.cheat = action.id;
      const description = document.createElement("p");
      description.textContent = action.description;
      description.id = `cheat-description-${action.id}`;
      button.setAttribute("aria-describedby", description.id);
      button.addEventListener("click", () => {
        if (!open || !session.available() || button.disabled) {
          return;
        }
        button.disabled = true;
        void session
          .execute(action.id)
          .catch((error: unknown) => window.reportError(error))
          .finally(refresh);
      });
      section.append(button, description);
      buttons.push(button);
    }
    card.append(section);
  }
  modal.append(frame);
  parent.append(modal);
  let open = false;
  let disposed = false;
  let previousFocus: HTMLElement | null = null;
  const setOpen = (value: boolean): void => {
    if (disposed || (value && !session.eligible()) || value === open) {
      return;
    }
    if (value) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      options.beforeOpen();
    }
    open = value;
    modal.hidden = !value;
    launcher.setAttribute("aria-expanded", String(value));
    options.onOpenChange(value);
    if (value) {
      close.focus();
    } else if (previousFocus?.isConnected && previousFocus.getClientRects().length > 0) {
      previousFocus.focus();
    } else {
      options.restoreFocus();
    }
  };
  let currentRun = options.run();
  function refresh(): void {
    const nextRun = options.run();
    if (currentRun !== null && currentRun !== nextRun) {
      setOpen(false);
    }
    currentRun = nextRun;
    const eligible = session.eligible();
    launcher.hidden = !eligible;
    if (!eligible) {
      setOpen(false);
    }
    for (const button of buttons) {
      button.disabled = session.busy() || !session.available();
    }
  }
  launcher.addEventListener("click", () => {
    setOpen(true);
    refresh();
  });
  close.addEventListener("click", () => setOpen(false));
  modal.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    if (event.target === modal) {
      event.preventDefault();
      close.focus();
    }
  });
  const retainFocus = (event: FocusEvent): void => {
    if (open && event.target instanceof Node && !card.contains(event.target)) {
      close.focus();
    }
  };
  document.addEventListener("focusin", retainFocus);
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
    if (event.key === "Tab") {
      const targets = [...frame.querySelectorAll<HTMLButtonElement>("button")].filter(
        (button) => !button.disabled,
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
  const media = window.matchMedia(
    "(display-mode: fullscreen), (display-mode: standalone), (display-mode: minimal-ui)",
  );
  media.addEventListener("change", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", refresh);
  refresh();
  return {
    close: () => setOpen(false),
    dispose(): void {
      if (disposed) {
        return;
      }
      setOpen(false);
      disposed = true;
      session.dispose();
      media.removeEventListener("change", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
      document.removeEventListener("focusin", retainFocus);
      modal.remove();
      launcher.remove();
    },
    isOpen: () => open,
    refresh,
  };
}
