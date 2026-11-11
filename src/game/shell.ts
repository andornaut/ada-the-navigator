import { PROTOTYPE } from "../data/prototype.ts";
import type { SectorId } from "../data/types.ts";
import type { GameState } from "../model/types.ts";
import { refuse } from "../ui/refusal.ts";

export interface ShellActions {
  start: (sector: SectorId) => void;
  choose: (id: string) => void;
  reducedMotion: () => boolean;
}

function button(label: string, action: () => void): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.addEventListener("click", action);
  return node;
}

export class StoryShell {
  private readonly savingStatus = document.createElement("div");
  private readonly status = document.createElement("div");
  private readonly panel = document.createElement("section");
  private signature = "";

  private readonly actions: ShellActions;

  constructor(actions: ShellActions) {
    this.actions = actions;
    this.savingStatus.id = "save-status";
    this.savingStatus.setAttribute("role", "status");
    this.savingStatus.setAttribute("aria-live", "polite");
    this.savingStatus.setAttribute("aria-atomic", "true");
    this.status.id = "game-status";
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    this.panel.className = "story-panel";
    document.getElementById("app")?.append(this.status, this.savingStatus, this.panel);
  }

  render(state: GameState): void {
    const { flight } = state;
    this.status.dataset.mode = state.mode;
    this.status.dataset.x = String(flight?.player.x ?? 0);
    this.status.dataset.y = String(flight?.player.y ?? 0);
    this.status.textContent = state.notice;
    const nextSignature = JSON.stringify([
      state.mode,
      state.selectedSector,
      state.unlocked,
      state.dialogue,
    ]);
    if (nextSignature === this.signature) {
      return;
    }
    this.signature = nextSignature;
    const active = document.activeElement as HTMLElement | null;
    const focusedAction = active?.dataset.action;
    const focusedChoice = active?.dataset.choice;
    this.panel.replaceChildren();
    this.panel.hidden = state.mode === "space" && !state.dialogue;
    // Prologue and boarding panels are text-only; the context hook awaits Art's Astra and cockpit.
    this.panel.dataset.context = state.dialogue?.context.split(":")[0] ?? "";
    if (state.dialogue) {
      const heading = document.createElement("h2");
      heading.textContent = state.dialogue.title;
      const text = document.createElement("p");
      text.textContent = state.dialogue.text;
      this.panel.append(heading, text);
      for (const choice of state.dialogue.choices) {
        // A refused choice looks disabled but stays enabled, focusable and tappable, so a tap
        // plays the shared refusal; aria-disabled would announce it as unusable.
        const node = button(choice.label, () => {
          if (choice.refused) {
            refuse(node, this.actions.reducedMotion());
          } else {
            this.actions.choose(choice.id);
          }
        });
        if (choice.refused) {
          node.dataset.refused = "true";
        }
        node.dataset.choice = choice.id;
        node.dataset.action = "dialogue-choice";
        this.panel.append(node);
      }
      this.panel.setAttribute("aria-label", state.dialogue.title);
    } else if (state.mode === "home") {
      const heading = document.createElement("h1");
      heading.textContent = PROTOTYPE.labels.home ?? "";
      const portrait = document.createElement("div");
      portrait.className = "home-portraits";
      portrait.setAttribute("aria-hidden", "true");
      const dog = document.createElement("span");
      dog.className = "dog-portrait";
      portrait.append(dog);
      this.panel.append(heading, portrait);
      for (const sector of state.unlocked) {
        const node = button(PROTOTYPE.chapters[sector].name, () => this.actions.start(sector));
        node.dataset.action = "start-sector";
        node.dataset.sector = String(sector);
        this.panel.append(node);
      }
      const deferred = document.createElement("p");
      deferred.textContent = PROTOTYPE.labels.deferred ?? "";
      this.panel.append(deferred);
    }
    const restore = [...this.panel.querySelectorAll<HTMLButtonElement>("button")].find((node) =>
      focusedChoice
        ? node.dataset.choice === focusedChoice
        : Boolean(focusedAction) && node.dataset.action === focusedAction,
    );
    if (restore) {
      restore.focus();
    } else if (state.dialogue) {
      this.panel.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }

  setSavingAvailable(available: boolean): void {
    const text = available ? "" : (PROTOTYPE.labels.savingUnavailable ?? "");
    if (this.savingStatus.textContent !== text) {
      this.savingStatus.textContent = text;
    }
  }

  dispose(): void {
    this.savingStatus.remove();
    this.status.remove();
    this.panel.remove();
  }
}
