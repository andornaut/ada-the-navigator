import type { RequiredUpdateState } from "@andornaut/game-kit/runtime/web/pwa/updateReady";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import type { Screen } from "../model/game.ts";
import type { GameState } from "../model/types.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "../ui/actionBinding.ts";
import { SCROLL } from "../ui/layout/contentCard.ts";
import { readViewUnit } from "../ui/layout/viewScale.ts";
import { refuse } from "../ui/refusal.ts";
import { createStartScreen } from "../ui/startScreen.ts";
import type { TitleScreenArt } from "../ui/titleScreen.ts";

export interface ShellActions {
  choose: (id: string) => void;
  continueGame: () => void;
  dismissNotice: () => void;
  reducedMotion: () => boolean;
  restart: () => void;
  start: () => void;
}

function button(label: string): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  return node;
}

export class StoryShell {
  private readonly savingStatus = document.createElement("div");
  private readonly status = document.createElement("div");
  private readonly panel = document.createElement("section");
  private signature = "";
  private disposed = false;
  private readonly choiceDisposals: (() => void)[] = [];
  private readonly noticeAction: ReturnType<typeof bindAdaAction>;
  // A newer save's forced update, while it runs: Start stays closed.
  private requiredUpdate: RequiredUpdateState | undefined;
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
    this.noticeAction = bindAdaAction(
      {
        click: {
          availability: () =>
            this.status.textContent ? { kind: "available" } : { kind: "omitted" },
          run: () => this.actions.dismissNotice(),
        },
        current: () => !this.disposed && this.status.isConnected,
        slopPx: () => SCROLL.dragThreshold * readViewUnit(this.status),
      },
      this.status,
    );
    this.panel.className = "story-panel";
    document.getElementById("app")?.append(this.status, this.savingStatus, this.panel);
    for (const element of [this.status, this.panel]) {
      assertAdaActionMetadata(element);
      if (element.isConnected) {
        assertAdaActionBindings(element);
      }
    }
  }

  render(state: GameState, screen: Screen, canContinue = state.started): void {
    const { flight } = state;
    this.status.dataset.mode = state.mode;
    this.status.dataset.x = String(flight?.player.x ?? 0);
    this.status.dataset.y = String(flight?.player.y ?? 0);
    const noticeChanged = this.status.textContent !== state.notice;
    this.status.textContent = state.notice;
    if (noticeChanged) {
      assertAdaActionMetadata(this.status);
      if (this.status.isConnected) {
        assertAdaActionBindings(this.status);
      }
    }
    const nextSignature = JSON.stringify([
      screen,
      canContinue,
      state.dialogue,
      state.economy.paint,
      this.titleArt !== null,
      this.requiredUpdate ?? null,
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
    this.clearChoices();
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
        const node = button(choice.label);
        let stopRefusal: (() => void) | undefined;
        const action = bindAdaAction(
          {
            click: {
              availability: () => (node.disabled ? { kind: "omitted" } : { kind: "available" }),
              run: () => {
                if (choice.refused) {
                  stopRefusal = refuse(node, this.actions.reducedMotion());
                } else {
                  this.actions.choose(choice.id);
                }
              },
            },
            current: () => !this.disposed && !this.panel.hidden && node.isConnected,
            slopPx: () => SCROLL.dragThreshold * readViewUnit(node),
          },
          node,
        );
        this.choiceDisposals.push(() => {
          action.dispose();
          stopRefusal?.();
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
      // Continue resumes a held story or flight; Restart stays secondary on its left.
      const actions = this.requiredUpdate
        ? []
        : canContinue
          ? ([
              {
                action: "restart",
                label: CONTENT.labels.restart ?? "",
                role: "secondary",
                run: this.actions.restart,
              },
              {
                action: "continue",
                label: CONTENT.labels.continue ?? "",
                role: "primary",
                run: this.actions.continueGame,
              },
            ] as const)
          : ([
              {
                action: "start",
                label: CONTENT.labels.start ?? "",
                role: "primary",
                run: this.actions.start,
              },
            ] as const);
      const paint = state.economy.paint;
      this.startScreen = createStartScreen(this.host, this.titleArt, {
        actions,
        // Offline, the forced update says so where Start would be; downloading, the loading bar
        // travels instead.
        note: this.requiredUpdate === "unavailable" ? (CONTENT.labels.updateRequired ?? "") : null,
        paint: paint === ECONOMY.defaultPaint ? null : paint,
        title: CONTENT.labels.home ?? "",
      });
    }
    assertAdaActionMetadata(this.panel);
    if (this.panel.isConnected) {
      assertAdaActionBindings(this.panel);
    }
    const shown = this.startScreen?.root ?? this.panel;
    const restore = [...shown.querySelectorAll<HTMLButtonElement>("button")].find((node) =>
      focusedChoice
        ? node.dataset.choice === focusedChoice
        : Boolean(focusedAction) && node.dataset.action === focusedAction,
    );
    // An open modal, such as the update offer shown as the launch's start screen first draws,
    // keeps focus, so a key press never acts on the screen behind it.
    if (active?.closest(".ada-modal:not([hidden])")) {
      return;
    }
    if (restore) {
      focusTarget(restore);
    } else if (screen === "start" || state.dialogue) {
      // Focus starts on the primary action, else the first.
      const first =
        shown.querySelector<HTMLButtonElement>("button.ada-primary:not([hidden])") ??
        shown.querySelector<HTMLButtonElement>("button");
      if (first) {
        focusTarget(first);
      }
    }
  }

  /**
   * A newer save's forced update (requireNewerVersion): the start screen offers no action, and
   * while the update cannot download it shows the update-required message.
   */
  setRequiredUpdate(state: RequiredUpdateState): void {
    this.requiredUpdate = state;
    this.signature = "";
  }

  /** Focuses the start screen's default button, its first, as a card over it closes. */
  focusDefault(): void {
    const first = this.startScreen?.root.querySelector<HTMLButtonElement>("button");
    if (first) {
      focusTarget(first);
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

  /** Marks the status line while every enemy in view draws Art's frames, not its placeholder. */
  setEnemyArt(ready: boolean): void {
    const value = ready ? "art" : "placeholder";
    if (this.status.dataset.enemies !== value) {
      this.status.dataset.enemies = value;
    }
  }

  setSavingAvailable(available: boolean): void {
    const text = available ? "" : (CONTENT.labels.savingUnavailable ?? "");
    if (this.savingStatus.textContent !== text) {
      this.savingStatus.textContent = text;
    }
  }

  private clearChoices(): void {
    for (const dispose of this.choiceDisposals.splice(0)) {
      dispose();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.clearChoices();
    this.noticeAction.dispose();
    this.startScreen?.dispose();
    this.savingStatus.remove();
    this.status.remove();
    this.panel.remove();
  }
}
