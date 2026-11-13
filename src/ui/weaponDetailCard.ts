import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import type { Weapon } from "../data/types.ts";
import { weaponGlyphPath } from "../data/weaponGlyphs.ts";
import { compactLevelName } from "./compactLevelName.ts";
import { units } from "./layout/css.ts";
import { SPACING } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createActions, createButton, createCard, isTap } from "./modal.ts";

/** Weapon details use the shared card frame and modal pause lifecycle. */
export function createWeaponDetailCard(
  root: HTMLElement,
  options: { readonly closeLabel: string; readonly onOpenChange: (open: boolean) => void },
) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = createCard({
    closeAction: "close-weapon-detail",
    closeLabel: options.closeLabel,
    title: "",
  });
  card.card.dataset.dialog = "weapon-detail";
  const description = document.createElement("p");
  description.className = "ada-prose";
  const dismiss = createButton(options.closeLabel, "primary");
  dismiss.dataset.action = "dismiss-weapon-detail";
  card.body.append(description, createActions([{ button: dismiss, role: "primary" }]));
  modal.append(card.frame);
  root.append(modal);
  let returnFocus: HTMLElement | null = null;
  const close = () => {
    if (modal.hidden) {
      return;
    }
    modal.hidden = true;
    options.onOpenChange(false);
    if (returnFocus) {
      focusTarget(returnFocus);
    }
    returnFocus = null;
  };
  card.close.addEventListener("click", close);
  dismiss.addEventListener("click", close);
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      focusTarget(document.activeElement === card.close ? dismiss : card.close);
    }
  });
  let outside: { x: number; y: number } | undefined;
  modal.addEventListener("pointerdown", (event) => {
    outside = event.target === modal ? { x: event.clientX, y: event.clientY } : undefined;
  });
  modal.addEventListener("click", (event) => {
    if (
      event.target === modal &&
      outside &&
      isTap(readViewUnit(modal), outside, { x: event.clientX, y: event.clientY })
    ) {
      close();
    }
    outside = undefined;
  });
  return {
    close,
    dispose() {
      card.dispose();
      modal.remove();
      returnFocus = null;
    },
    isOpen: () => !modal.hidden,
    open(
      title: string,
      lines: readonly string[],
      origin: HTMLElement,
      identity?: { readonly id: Weapon; readonly level?: number },
    ) {
      returnFocus = origin;
      card.title.textContent = compactLevelName(identity?.level, title);
      if (identity) {
        const label = document.createElement("span");
        label.textContent = compactLevelName(identity.level, title);
        const icon = document.createElement("span");
        icon.className = "ada-weapon";
        icon.dataset.weapon = identity.id;
        icon.dataset.state = "idle";
        if (identity.level !== undefined) {
          icon.dataset.level = String(identity.level);
        }
        icon.setAttribute("aria-hidden", "true");
        icon.style.pointerEvents = "none";
        const disc = document.createElement("span");
        disc.className = "ada-disc";
        disc.style.setProperty("--glyph", `url('${weaponGlyphPath(identity.id)}')`);
        const pips = document.createElement("span");
        pips.className = "ada-pips";
        if (identity.level !== undefined && identity.level > 1) {
          pips.append(
            ...Array.from({ length: identity.level }, () => document.createElement("span")),
          );
        }
        icon.append(disc, pips);
        card.title.style.display = "flex";
        card.title.style.alignItems = "center";
        card.title.style.justifyContent = "center";
        card.title.style.gap = units(SPACING.gap);
        card.title.replaceChildren(icon, label);
      }
      description.replaceChildren(
        ...lines.map((line) => {
          const paragraph = document.createElement("span");
          paragraph.style.display = "block";
          paragraph.textContent = line;
          return paragraph;
        }),
      );
      modal.hidden = false;
      options.onOpenChange(true);
      card.fit();
      focusTarget(dismiss);
    },
  };
}
