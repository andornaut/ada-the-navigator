import type { Weapon } from "../data/types.ts";

export interface WeaponChoice {
  readonly ammo: null;
  readonly id: Weapon;
  readonly selected: boolean;
}

export interface WeaponLabels {
  readonly group: string;
  readonly names: Readonly<Record<Weapon, string>>;
}

interface WeaponSelectorOptions {
  readonly labels: WeaponLabels;
  readonly onSelect: (weapon: Weapon) => void;
}

// The same monochrome bolt and upgrade marks used by the space renderer.
const GLYPHS: Readonly<Record<Weapon, string>> = {
  basic: "M5 12H19",
  pierce: "M4 12H20M12 6L20 12L12 18",
  rapid: "M6 6H18M6 12H18M6 18H18",
  spread: "M6 12L18 5M6 12H18M6 12L18 19",
};

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
        const glyph = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        glyph.setAttribute("viewBox", "0 0 24 24");
        glyph.setAttribute("aria-hidden", "true");
        glyph.setAttribute("focusable", "false");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", GLYPHS[choice.id]);
        glyph.append(path);
        button.append(glyph);
        button.addEventListener("click", () => {
          if (enabled && !button.disabled) {
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
