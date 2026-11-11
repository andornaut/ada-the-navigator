import type { Weapon } from "../data/types.ts";
import { refuse } from "./refusal.ts";

export interface WeaponChoice {
  readonly id: Weapon;
  readonly selected: boolean;
  /** Locked choices stay visible, look locked and refuse a press. */
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

export type WeaponButtonState = "idle" | "locked" | "selected";

/** Art's HUD button states: the selected weapon keeps its look while the others lock. */
export function weaponButtonState(choice: WeaponChoice): WeaponButtonState {
  if (choice.selected) {
    return "selected";
  }
  return choice.locked ? "locked" : "idle";
}

/** The single-colour 24px HUD glyph, drawn as a mask over the button's text colour. */
export function weaponGlyphPath(weapon: Weapon): string {
  return `/art/ui/icons/weapon-${weapon}-24.svg`;
}

// The top-right HUD icon button states (art/controls.md "Top-right HUD icon buttons"). Each
// glyph is a mask over currentColor, so a state's colour, and the refusal cue's red text
// colour, tint it.
export const WEAPON_STYLE = `
.ada-controls .ada-weapon-selector{
  position:absolute;
  right:calc(max(8px,var(--inset-right)) + 56px);
  top:max(8px,var(--inset-top));
  display:flex;
  gap:4px
}

/* Without the settings button (in play) the weapon buttons keep the top-right corner. */
.ada-controls.ada-no-settings-button .ada-weapon-selector{
  right:max(8px,var(--inset-right))
}

.ada-controls .ada-weapon-selector .ada-weapon{
  position:relative;
  box-sizing:border-box;
  width:48px;
  height:48px;
  min-width:48px;
  min-height:48px;
  padding:0;
  display:grid;
  place-items:center;
  border:2px solid #181425;
  border-radius:8px;
  background:#262b44;
  color:#ead4aa;
  cursor:pointer;
  pointer-events:auto
}

.ada-controls .ada-weapon-selector .ada-weapon[data-state=selected]{
  background:#f0bd68;
  color:#181425
}

/* The selection ring: 2px cream, 2px outside the face, radius 12 at its outer edge. */
.ada-controls .ada-weapon-selector .ada-weapon[data-state=selected]::after{
  content:"";
  position:absolute;
  inset:-6px;
  border:2px solid #ead4aa;
  border-radius:12px;
  pointer-events:none
}

.ada-controls .ada-weapon-selector .ada-weapon[data-state=locked]{
  background:#1d2032;
  color:#6f7891;
  cursor:default
}

.ada-controls .ada-weapon-selector .ada-weapon-glyph{
  width:24px;
  height:24px;
  background:currentColor;
  -webkit-mask:var(--glyph) center / 24px 24px no-repeat;
  mask:var(--glyph) center / 24px 24px no-repeat;
  pointer-events:none
}

.ada-controls .ada-weapon-selector .ada-weapon:focus-visible{
  outline:3px solid #ead4aa;
  outline-offset:4px
}

.ada-controls .ada-weapon-selector .ada-weapon:disabled{
  opacity:0.5;
  cursor:default
}
`;

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
        button.className = "ada-weapon";
        button.dataset.weapon = choice.id;
        const glyph = document.createElement("span");
        glyph.className = "ada-weapon-glyph";
        glyph.style.setProperty("--glyph", `url('${weaponGlyphPath(choice.id)}')`);
        glyph.setAttribute("aria-hidden", "true");
        button.append(glyph);
        button.addEventListener("click", () => {
          if (enabled && !button.disabled) {
            if (button.dataset.state === "locked") {
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
      entry.dataset.state = weaponButtonState(choice);
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
