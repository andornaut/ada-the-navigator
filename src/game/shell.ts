import { PROTOTYPE } from "../data/prototype.ts";
import type { SectorId } from "../data/types.ts";
import type { GameState } from "../model/types.ts";

export interface ShellActions {
  start: (sector: SectorId) => void;
  choose: (id: string) => void;
  home: () => void;
  teleport: (id: string) => void;
}

function button(label: string, action: () => void): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.addEventListener("click", action);
  return node;
}

export interface ShellView {
  objective: string;
  inDanger: boolean;
  destinations: { id: string; label: string }[];
}

export class StoryShell {
  private readonly savingStatus = document.createElement("div");
  private readonly status = document.createElement("div");
  private readonly panel = document.createElement("section");
  private readonly travel = document.createElement("nav");
  private readonly hud = document.createElement("div");
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
    this.travel.className = "travel-panel";
    this.travel.setAttribute("aria-label", PROTOTYPE.labels.destinations ?? "");
    this.hud.className = "flight-hud";
    document
      .getElementById("app")
      ?.append(this.status, this.savingStatus, this.hud, this.panel, this.travel);
  }

  render(state: GameState, view: ShellView): void {
    const { flight } = state;
    this.status.dataset.mode = state.mode;
    this.status.dataset.x = String(flight?.player.x ?? 0);
    this.status.dataset.y = String(flight?.player.y ?? 0);
    this.status.textContent = state.notice;
    this.hud.hidden = state.mode !== "space";
    if (flight) {
      const labels = PROTOTYPE.labels;
      const shield = `${labels.shield}: ${Math.ceil(flight.shield)}/${PROTOTYPE.tuning.shieldMax}`;
      const cargo = `${labels.cargo}: ${flight.cargo}`;
      const ammo = flight.weapon === "basic" ? "" : ` (${labels.ammo}: ${flight.ammo})`;
      const weaponNames = {
        basic: labels.weaponBasic,
        pierce: labels.weaponPierce,
        rapid: labels.weaponRapid,
        spread: labels.weaponSpread,
      };
      const weapon = `${labels.weapon}: ${weaponNames[flight.weapon]}${ammo}`;
      this.hud.textContent = `${shield} · ${cargo} · ${weapon}\n${labels.objective}: ${view.objective}`;
    }
    const nextSignature = JSON.stringify([
      state.mode,
      state.selectedSector,
      state.unlocked,
      state.dialogue,
      view.destinations,
      view.inDanger,
    ]);
    if (nextSignature === this.signature) {
      return;
    }
    this.signature = nextSignature;
    const active = document.activeElement as HTMLElement | null;
    const focusedAction = active?.dataset.action;
    const focusedChoice = active?.dataset.choice;
    this.panel.replaceChildren();
    this.travel.replaceChildren();
    this.panel.hidden = state.mode === "space" && !state.dialogue;
    this.travel.hidden = state.mode !== "space" || Boolean(state.dialogue);
    if (state.dialogue) {
      const heading = document.createElement("h2");
      heading.textContent = state.dialogue.title;
      const text = document.createElement("p");
      text.textContent = state.dialogue.text;
      this.panel.append(heading, text);
      for (const choice of state.dialogue.choices) {
        const node = button(choice.label, () => this.actions.choose(choice.id));
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
    if (!this.travel.hidden) {
      const home = button(PROTOTYPE.labels.toronto ?? "", this.actions.home);
      home.dataset.action = "return-home";
      home.disabled = view.inDanger;
      this.travel.append(home);
      const title = document.createElement("span");
      title.textContent = PROTOTYPE.labels.destinations ?? "";
      this.travel.append(title);
      for (const { id, label } of view.destinations) {
        const node = button(label, () => this.actions.teleport(id));
        node.disabled = view.inDanger;
        node.dataset.destination = id;
        this.travel.append(node);
      }
      if (view.inDanger) {
        const hint = document.createElement("p");
        hint.textContent = PROTOTYPE.labels.travelUnavailable ?? "";
        this.travel.append(hint);
      }
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
    this.travel.remove();
    this.hud.remove();
  }
}
