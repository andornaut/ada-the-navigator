import { PROTOTYPE } from "../data/prototype.ts";
import type { Screen } from "../model/game.ts";
import type { GameState } from "../model/types.ts";
import { refuse } from "../ui/refusal.ts";
import { createStartCard } from "../ui/start-card.ts";

export interface ShellActions {
  choose: (id: string) => void;
  continueGame: () => void;
  dismissNotice: () => void;
  reducedMotion: () => boolean;
  restart: () => void;
  start: () => void;
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
  private startCard: ReturnType<typeof createStartCard> | undefined;

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
    // The notice's box is its press area: a tap dismisses it, otherwise it clears on its own.
    this.status.addEventListener("click", () => this.actions.dismissNotice());
    this.panel.className = "story-panel";
    document.getElementById("app")?.append(this.status, this.savingStatus, this.panel);
  }

  render(state: GameState, screen: Screen): void {
    const { flight } = state;
    this.status.dataset.mode = state.mode;
    this.status.dataset.x = String(flight?.player.x ?? 0);
    this.status.dataset.y = String(flight?.player.y ?? 0);
    this.status.textContent = state.notice;
    const nextSignature = JSON.stringify([screen, state.started, state.dialogue]);
    if (nextSignature === this.signature) {
      return;
    }
    this.signature = nextSignature;
    const active = document.activeElement as HTMLElement | null;
    const focusedAction = active?.dataset.action;
    const focusedChoice = active?.dataset.choice;
    this.startCard?.dispose();
    this.startCard = undefined;
    this.panel.replaceChildren();
    // The panel holds space dialogue and the start screen; storybook pages draw their own.
    this.panel.hidden = !(screen === "start" || (screen === "space" && state.dialogue));
    this.panel.dataset.context = state.dialogue?.context.split(":")[0] ?? "";
    if (screen === "space" && state.dialogue) {
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
    } else if (screen === "start") {
      // The start screen's card: Start until the first flight begins, then Continue and
      // Restart, as the shared card's action stack. Achievements sits left of Settings instead.
      const actions = state.started
        ? [
            {
              action: "continue",
              label: PROTOTYPE.labels.continue,
              run: this.actions.continueGame,
            },
            { action: "restart", label: PROTOTYPE.labels.restart, run: this.actions.restart },
          ]
        : [{ action: "start", label: PROTOTYPE.labels.start, run: this.actions.start }];
      this.startCard = createStartCard(this.panel, {
        actions: actions.map(({ label, run }) => ({ label: label ?? "", run })),
        note: PROTOTYPE.labels.deferred ?? "",
        title: PROTOTYPE.labels.home ?? "",
      });
      this.startCard.buttons.forEach((node, index) => {
        node.dataset.action = actions[index]?.action ?? "";
      });
    }
    const restore = [...this.panel.querySelectorAll<HTMLButtonElement>("button")].find((node) =>
      focusedChoice
        ? node.dataset.choice === focusedChoice
        : Boolean(focusedAction) && node.dataset.action === focusedAction,
    );
    if (restore) {
      restore.focus();
    } else if (screen === "start" || state.dialogue) {
      this.panel.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }

  /** Marks the status line once Art's rock sprites replace the footprint placeholders. */
  setAsteroidArt(ready: boolean): void {
    this.status.dataset.asteroids = ready ? "art" : "placeholder";
  }

  setSavingAvailable(available: boolean): void {
    const text = available ? "" : (PROTOTYPE.labels.savingUnavailable ?? "");
    if (this.savingStatus.textContent !== text) {
      this.savingStatus.textContent = text;
    }
  }

  dispose(): void {
    this.startCard?.dispose();
    this.savingStatus.remove();
    this.status.remove();
    this.panel.remove();
  }
}
