import { ECONOMY } from "../data/economy.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import type { Screen } from "../model/game.ts";
import type { GameState } from "../model/types.ts";
import { refuse } from "../ui/refusal.ts";
import { createStartScreen } from "../ui/start-screen.ts";
import type { TitleScreenArt } from "../ui/title-screen.ts";

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
  private startScreen: ReturnType<typeof createStartScreen> | undefined;
  // Art's title art, once the scene has read it; the start screen draws without it until then.
  private titleArt: TitleScreenArt | null = null;

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
    const nextSignature = JSON.stringify([
      screen,
      state.started,
      state.dialogue,
      state.economy.paint,
      this.titleArt !== null,
    ]);
    if (nextSignature === this.signature) {
      return;
    }
    this.signature = nextSignature;
    const active = document.activeElement as HTMLElement | null;
    const focusedAction = active?.dataset.action;
    const focusedChoice = active?.dataset.choice;
    this.startScreen?.dispose();
    this.startScreen = undefined;
    this.panel.replaceChildren();
    // The panel holds space dialogue; the start screen and storybook pages draw their own.
    this.panel.hidden = !(screen === "space" && state.dialogue);
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
      // Start until the first flight begins, then Continue (primary, the default and first Tab
      // stop) and Restart (secondary, on its left).
      const actions = state.started
        ? ([
            {
              action: "continue",
              label: PROTOTYPE.labels.continue ?? "",
              role: "primary",
              run: this.actions.continueGame,
            },
            {
              action: "restart",
              label: PROTOTYPE.labels.restart ?? "",
              role: "secondary",
              run: this.actions.restart,
            },
          ] as const)
        : ([
            {
              action: "start",
              label: PROTOTYPE.labels.start ?? "",
              role: "primary",
              run: this.actions.start,
            },
          ] as const);
      const paint = state.economy.paint;
      this.startScreen = createStartScreen(this.host, this.titleArt, {
        actions,
        note: PROTOTYPE.labels.deferred ?? "",
        paint: paint === ECONOMY.defaultPaint ? null : paint,
        title: PROTOTYPE.labels.home ?? "",
      });
    }
    const shown = this.startScreen?.root ?? this.panel;
    const restore = [...shown.querySelectorAll<HTMLButtonElement>("button")].find((node) =>
      focusedChoice
        ? node.dataset.choice === focusedChoice
        : Boolean(focusedAction) && node.dataset.action === focusedAction,
    );
    if (restore) {
      restore.focus();
    } else if (screen === "start" || state.dialogue) {
      shown.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }

  /** Art's start screen art; the start screen redraws with it. */
  setTitleArt(art: TitleScreenArt | null): void {
    this.titleArt = art;
  }

  // The play area the start screen covers.
  private get host(): HTMLElement {
    return document.getElementById("app") ?? document.body;
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
    this.startScreen?.dispose();
    this.savingStatus.remove();
    this.status.remove();
    this.panel.remove();
  }
}
