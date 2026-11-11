import type { Weapon } from "../data/types.ts";
import { weaponGlyphPath } from "../data/weapon-glyphs.ts";
import { FOCUS_RING } from "./layout/controls.ts";
import { fromHudEdge, units } from "./layout/css.ts";
import { HUD_BUTTON } from "./layout/playView.ts";
import { refuse } from "./refusal.ts";

export interface WeaponChoice {
  readonly id: Weapon;
  readonly selected: boolean;
}

export interface WeaponLabels {
  readonly group: string;
  readonly names: Readonly<Record<Weapon, string>>;
}

interface WeaponSelectorOptions {
  readonly labels: WeaponLabels;
  /** Returns whether the switch was refused, so the pressed icon plays the refusal cue. */
  readonly onSelect: (weapon: Weapon) => boolean;
  readonly reducedMotion: () => boolean;
}

export type WeaponButtonState = "idle" | "selected";

/** Art's HUD button states: the selected weapon, and every other owned weapon idle. */
export function weaponButtonState(choice: WeaponChoice): WeaponButtonState {
  return choice.selected ? "selected" : "idle";
}

// Each state's disc face, its ink edge (an annulus when selected) and glyph colour
// (art/controls.md "Top-right HUD icon buttons").
export const HUD_DISC_STATES = {
  idle: { edge: HUD_BUTTON.edge, face: "#262b44", glyph: "#b8b3c9" },
  selected: { edge: HUD_BUTTON.annulus, face: "#bfa06f", glyph: "#181425" },
} as const satisfies Record<WeaponButtonState, unknown>;

const INK = "#181425";

// A disc's ink edge, and with focus the shared focus ring outside it, round with the disc.
const discShadow = (focused: boolean) =>
  focused
    ? `inset 0 0 0 var(--disc-edge) ${INK},0 0 0 ${units(FOCUS_RING.fringe)} ${INK},0 0 0 ${units(
        FOCUS_RING.outset,
      )} ${INK}`
    : `inset 0 0 0 var(--disc-edge) ${INK}`;

// One HUD disc button's chrome: a target that is its press area, a smooth disc centred in it, and
// a glyph centred on the disc, drawn in CSS at logical units so it stays sharp at any scale. The
// start screen's Settings shares it.
export function hudDiscStyle(button: string, disc: string): string {
  return `
${button}{
  box-sizing:border-box;
  width:${units(HUD_BUTTON.target)};
  height:${units(HUD_BUTTON.target)};
  min-width:0;
  min-height:0;
  margin:0;
  padding:0;
  display:grid;
  place-items:center;
  border:0;
  border-radius:0;
  background:transparent;
  color:${HUD_DISC_STATES.idle.glyph};
  cursor:pointer;
  pointer-events:auto;
  touch-action:manipulation;
  --disc-edge:${units(HUD_DISC_STATES.idle.edge)}
}
${button} ${disc}{
  box-sizing:border-box;
  width:${units(HUD_BUTTON.disc)};
  height:${units(HUD_BUTTON.disc)};
  display:grid;
  place-items:center;
  border-radius:50%;
  background:${HUD_DISC_STATES.idle.face};
  box-shadow:${discShadow(false)};
  pointer-events:none
}
${button}:focus-visible{
  outline:none;
  box-shadow:none
}
${button}:focus-visible ${disc}{
  outline:${units(FOCUS_RING.band)} solid #ead4aa;
  outline-offset:${units(FOCUS_RING.fringe)};
  box-shadow:${discShadow(true)}
}
${button} ${disc}::before{
  content:"";
  width:${units(HUD_BUTTON.glyph)};
  height:${units(HUD_BUTTON.glyph)};
  background:currentColor;
  -webkit-mask:var(--glyph) center / 100% 100% no-repeat;
  mask:var(--glyph) center / 100% 100% no-repeat
}
`;
}

// The top-right weapon buttons (art/controls.md "Top-right HUD icon buttons"), Chibi's skill
// buttons: HUD_BUTTON targets packed against the HUD rect's top-right corner, a gap apart. Each
// glyph is a mask over currentColor, so a state's colour, and the refusal cue's red text colour,
// tint it; selection, lock and refusal never resize the disc or glyph.
export const WEAPON_STYLE = `
.ada-controls .ada-weapon-selector{
  position:absolute;
  right:${fromHudEdge("right")};
  top:${fromHudEdge("top")};
  display:flex;
  gap:${units(HUD_BUTTON.gap)}
}
${hudDiscStyle(".ada-controls .ada-weapon", ".ada-disc")}
.ada-controls .ada-weapon[data-state=selected]{
  color:${HUD_DISC_STATES.selected.glyph};
  --disc-edge:${units(HUD_DISC_STATES.selected.edge)}
}
.ada-controls .ada-weapon[data-state=selected] .ada-disc{
  background:${HUD_DISC_STATES.selected.face}
}
.ada-controls .ada-weapon:disabled{
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
        const disc = document.createElement("span");
        disc.className = "ada-disc";
        disc.style.setProperty("--glyph", `url('${weaponGlyphPath(choice.id)}')`);
        disc.setAttribute("aria-hidden", "true");
        button.append(disc);
        button.addEventListener("click", () => {
          // A switch during the wait after the last one is refused with the shared cue.
          if (enabled && !button.disabled && options.onSelect(choice.id)) {
            refuse(button, options.reducedMotion());
          }
        });
        root.append(button);
        entry = button;
        buttons.set(choice.id, entry);
      }
      const name = options.labels.names[choice.id];
      entry.setAttribute("aria-label", name);
      entry.setAttribute("aria-pressed", String(choice.selected));
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
