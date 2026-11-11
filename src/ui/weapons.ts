import type { Weapon } from "../data/types.ts";
import { refuse } from "./refusal.ts";

export interface WeaponChoice {
  readonly id: Weapon;
  readonly selected: boolean;
  /** Locked choices stay visible, look disabled and refuse a press. */
  readonly locked: boolean;
}

export interface WeaponLabels {
  readonly group: string;
  readonly names: Readonly<Record<Weapon, string>>;
}

interface WeaponSelectorOptions {
  readonly labels: WeaponLabels;
  readonly onSelect: (weapon: Weapon) => void;
  readonly reducedMotion: () => boolean;
}

export function createWeaponSelector(parent: HTMLElement, options: WeaponSelectorOptions) {
  const root = document.createElement("div");
  root.className = "ada-weapon-selector";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", options.labels.group);
  root.hidden = true;
  parent.append(root);
  const buttons = new Map<Weapon, HTMLButtonElement>();
  let choices: readonly WeaponChoice[] = [];
  let enabled = false;

  const render = (): void => {
    root.hidden = !enabled || choices.length === 0;
    const ids = new Set(choices.map((choice) => choice.id));
    for (const [id, entry] of buttons) {
      if (!ids.has(id)) {
        entry.remove();
        buttons.delete(id);
      }
    }
    for (const choice of choices) {
      let entry = buttons.get(choice.id);
      if (!entry) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.weapon = choice.id;
        const glyph = document.createElement("img");
        glyph.src = `/art/ui/icons/weapon-${choice.id}.svg`;
        glyph.alt = "";
        glyph.width = 20;
        glyph.height = 20;
        glyph.draggable = false;
        glyph.setAttribute("aria-hidden", "true");
        button.append(glyph);
        button.addEventListener("click", () => {
          if (enabled && !button.disabled) {
            if (button.getAttribute("aria-disabled") === "true") {
              refuse(button, options.reducedMotion());
            }
            // The model refuses a locked change and shows why.
            options.onSelect(choice.id);
          }
        });
        root.append(button);
        entry = button;
        buttons.set(choice.id, entry);
      }
      const name = options.labels.names[choice.id];
      entry.setAttribute("aria-label", name);
      entry.setAttribute("aria-pressed", String(choice.selected));
      entry.setAttribute("aria-disabled", String(choice.locked));
      // PLACEHOLDER (Art): the selected icon's power-up treatment; see ada-weapon-selected.
      entry.classList.toggle("ada-weapon-selected", choice.selected);
      entry.title = name;
      entry.disabled = !enabled;
    }
  };
  return {
    dispose: () => root.remove(),
    setEnabled(value: boolean): void {
      enabled = value;
      render();
    },
    setWeapons(value: readonly WeaponChoice[]): void {
      choices = value;
      render();
    },
  };
}
