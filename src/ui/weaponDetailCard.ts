import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import type { Weapon } from "../data/types.ts";
import { WEAPON_DETAIL_LABELS } from "../data/weaponDetails.ts";
import { ammoShopSheet, weaponGlyphPath } from "../data/weaponGlyphs.ts";
import { compactLevelName } from "./compactLevelName.ts";
import { detailCount, renderDetailQuantity } from "./detailQuantity.ts";
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
  const quantity = document.createElement("div");
  quantity.hidden = true;
  const actions = createActions([{ button: dismiss, role: "primary" }]);
  actions.className += " ada-detail-actions";
  card.body.append(description, quantity, actions);
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
      identity?: {
        readonly id: Weapon;
        readonly level?: number;
        readonly ammo?: number | null;
        readonly ammoLabel?: string;
      },
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
        card.title.className = "ada-detail-header";
        card.title.replaceChildren(icon, label);
      }
      card.frame.setAttribute("aria-label", compactLevelName(identity?.level, title));
      let ammoIcon: HTMLElement | undefined;
      let amount: string | undefined;
      if (identity?.ammo !== undefined) {
        ammoIcon = document.createElement("span");
        if (identity.id === "laser") {
          ammoIcon.className = "ada-detail-unlimited-icon";
          ammoIcon.style.setProperty("--glyph", `url('${weaponGlyphPath(identity.id)}')`);
        } else {
          ammoIcon.className = "ada-detail-ammo-icon";
          ammoIcon.style.backgroundImage = `url('/art/ui/sprites/${ammoShopSheet(identity.id)}.png')`;
        }
        amount =
          identity.ammo === null
            ? WEAPON_DETAIL_LABELS.detailUnlimited
            : detailCount(identity.ammo);
      }
      renderDetailQuantity(quantity, ammoIcon, amount, identity?.ammoLabel);
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
