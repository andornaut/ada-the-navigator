import type { NetworkPlayNotice } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import type { RequiredUpdateState } from "@andornaut/game-kit/runtime/web/pwa/dom/launch";
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
import { readViewUnit } from "../ui/layout/dom.ts";
import { SCROLL } from "../ui/layout/index.ts";
import { createStartScreen } from "../ui/startScreen.ts";
import type { TitleScreenArt } from "../ui/titleScreen.ts";

export interface ShellActions {
  continueGame: () => void;
  dismissNotice: () => void;
  restart: () => void;
  start: () => void;
}

export class StoryShell {
  private readonly savingStatus = document.createElement("div");
  private readonly status = document.createElement("div");
  private signature = "";
  private disposed = false;
  private readonly noticeAction: ReturnType<typeof bindAdaAction>;
  // A newer save's forced update, while it runs: Start stays closed.
  private requiredUpdate: RequiredUpdateState | undefined;
  // The network-play notice while it shows, which takes the save status slot, and saving.
  private networkPlay: NetworkPlayNotice["reason"] | undefined;
  private savingAvailable = true;
  private startScreen: ReturnType<typeof createStartScreen> | undefined;
  // Art's title art, once the scene has read it; the start screen draws without it until then.
  private titleArt: TitleScreenArt | null = null;
  // Whether the shown screen takes a default focus: the start screen.
  private focusesDefault = false;

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
    document.getElementById("app")?.append(this.status, this.savingStatus);
    assertAdaActionMetadata(this.status);
    if (this.status.isConnected) {
      assertAdaActionBindings(this.status);
    }
  }

  render(state: GameState, screen: Screen, canContinue = state.started, noticeOpacity = 1): void {
    const { flight } = state;
    this.status.dataset.mode = state.mode;
    this.status.dataset.x = String(flight?.player.x ?? 0);
    this.status.dataset.y = String(flight?.player.y ?? 0);
    const noticeChanged = this.status.textContent !== state.notice;
    const opacity = noticeOpacity === 1 ? "" : String(noticeOpacity);
    if (this.status.style.opacity !== opacity) {
      this.status.style.opacity = opacity;
    }
    if (noticeChanged) {
      this.status.textContent = state.notice;
      assertAdaActionMetadata(this.status);
      if (this.status.isConnected) {
        assertAdaActionBindings(this.status);
      }
    }
    const nextSignature = JSON.stringify([
      screen,
      canContinue,
      state.economy.paint,
      this.titleArt !== null,
      this.requiredUpdate ?? null,
    ]);
    if (nextSignature === this.signature) {
      return;
    }
    this.signature = nextSignature;
    this.focusesDefault = screen === "start";
    const active = document.activeElement as HTMLElement | null;
    const focusedAction = active?.dataset.action;
    this.startScreen?.dispose();
    this.startScreen = undefined;
    if (screen === "start") {
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
    const restore = [
      ...(this.startScreen?.root.querySelectorAll<HTMLButtonElement>("button") ?? []),
    ].find((node) => Boolean(focusedAction) && node.dataset.action === focusedAction);
    // An open modal, such as the update offer shown as the launch's start screen first draws,
    // keeps focus, so a key press never acts on the screen behind it.
    if (active?.closest(".ada-modal:not([hidden])")) {
      return;
    }
    if (restore) {
      focusTarget(restore);
    } else if (this.focusesDefault) {
      this.focusShownDefault();
    }
  }

  /**
   * Gives the shown start screen its default focus where focus has fallen to the page.
   * A focus call while the play area is inert, as it is until the boot reveal shows the first
   * screen, does not land, and nothing else moves focus there afterwards.
   */
  focusUnfocusedDefault(): void {
    const active = document.activeElement;
    if (this.focusesDefault && (active === null || active === document.body)) {
      this.focusShownDefault();
    }
  }

  // Focus starts on the primary action, else the first.
  private focusShownDefault(): void {
    const shown = this.startScreen?.root;
    const first =
      shown?.querySelector<HTMLButtonElement>("button.ada-primary:not([hidden])") ??
      shown?.querySelector<HTMLButtonElement>("button");
    if (first) {
      focusTarget(first);
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

  /** Counts on the status line the motif triangles the backdrop filled in its last frame. */
  setBackdropPlates(count: number): void {
    const value = String(count);
    if (this.status.dataset.plates !== value) {
      this.status.dataset.plates = value;
    }
  }

  /** Marks the status line while every enemy in view draws Art's frames, not its placeholder. */
  setEnemyArt(ready: boolean): void {
    const value = ready ? "art" : "placeholder";
    if (this.status.dataset.enemies !== value) {
      this.status.dataset.enemies = value;
    }
  }

  setSavingAvailable(available: boolean): void {
    this.savingAvailable = available;
    this.renderSavingStatus();
  }

  /**
   * The network-play notice (rules.md game notices): while shown, the save status slot says the
   * game plays online, with no control; undefined returns the slot to the save status.
   */
  setNetworkPlay(reason: NetworkPlayNotice["reason"] | undefined): void {
    this.networkPlay = reason;
    this.renderSavingStatus();
  }

  private renderSavingStatus(): void {
    const text =
      this.networkPlay === "quota"
        ? (CONTENT.labels.networkPlayQuota ?? "")
        : this.networkPlay === "unsupported"
          ? (CONTENT.labels.networkPlayUnsupported ?? "")
          : this.savingAvailable
            ? ""
            : (CONTENT.labels.savingUnavailable ?? "");
    if (this.savingStatus.textContent !== text) {
      this.savingStatus.textContent = text;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.noticeAction.dispose();
    this.startScreen?.dispose();
    this.savingStatus.remove();
    this.status.remove();
  }
}
