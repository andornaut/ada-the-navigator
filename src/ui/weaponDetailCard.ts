import type { ControlAvailability } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import type { Weapon } from "../data/types.ts";
import { WEAPON_DETAIL_LABELS } from "../data/weaponDetails.ts";
import { ammoGlyphPath, weaponGlyphPath } from "../data/weaponGlyphs.ts";
import { assertAdaActionBindings, assertAdaActionMetadata } from "./actionBinding.ts";
import { compactLevelName } from "./compactLevelName.ts";
import { detailCount, renderDetailQuantity } from "./detailQuantity.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createAdaLayoutPorts } from "./layoutTree.ts";
import { createActions, createCard, setFooterAction } from "./modal.ts";
import { createStandardCloseAction } from "./modalClose.ts";
import { createModalLayer } from "./modalLayer.ts";
import { inCurrentView } from "./pressScope.ts";
import {
  type WeaponDetailAction,
  type WeaponDetailData,
  type WeaponDetailSchema,
  weaponDetailTree,
} from "./weaponDetailTree.ts";

type WeaponDetailIdentity = {
  readonly id: Weapon;
  readonly level?: number;
  readonly ammo?: number | null;
  readonly ammoLabel?: string;
};

/** Weapon details use the shared card frame and modal pause lifecycle. */
export function createWeaponDetailCard(
  root: HTMLElement,
  options: { readonly closeLabel: string; readonly onOpenChange: (open: boolean) => void },
) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  let disposed = false;
  const headerBinding = createStandardCloseAction(root, "close-weapon-detail", options.closeLabel, {
    current: (button) =>
      !disposed &&
      !modal.hidden &&
      inCurrentView(root, button) &&
      availability().kind === "available",
    run: () => close(),
    slopPx: (button) => SCROLL.dragThreshold * readViewUnit(button),
    slopThreshold: SCROLL.dragThreshold,
  });
  const card = createCard({
    close: headerBinding.element,
    size: "small",
    title: "",
  });
  card.card.dataset.dialog = "weapon-detail";
  const description = document.createElement("p");
  description.className = "ada-prose";
  const quantity = document.createElement("div");
  quantity.hidden = true;
  const actions = createActions([]);
  actions.className += " ada-detail-actions";
  setFooterAction("close", actions);
  card.body.append(description, quantity, actions);
  modal.append(card.frame);
  root.append(modal);
  let visible = false;
  const layer = createModalLayer(modal);
  let leaveView: (() => void) | undefined;
  let currentIdentity: WeaponDetailIdentity | undefined;
  let returnFocus: HTMLElement | null = null;
  const close = () => {
    if (modal.hidden) {
      return;
    }
    visible = false;
    modal.hidden = true;
    leaveView?.();
    leaveView = undefined;
    options.onOpenChange(false);
    if (returnFocus && document.activeElement !== returnFocus) {
      focusTarget(returnFocus);
    }
    returnFocus = null;
  };
  const availability = (): ControlAvailability =>
    disposed || !visible || !inCurrentView(root, card.frame)
      ? { kind: "omitted" }
      : { kind: "available" };
  const ports = createAdaLayoutPorts<WeaponDetailAction>({
    actionRoot: root,
    actions: new Map([
      ["close-weapon-detail", close],
      ["dismiss-weapon-detail", close],
    ]),
    availability,
  });
  const renderContent = (data: WeaponDetailData) => {
    const { lines, title } = data;
    const identity = currentIdentity;
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
        ammoIcon.style.setProperty("--glyph", `url('${ammoGlyphPath(identity.id)}')`);
      }
      amount =
        identity.ammo === null ? WEAPON_DETAIL_LABELS.detailUnlimited : detailCount(identity.ammo);
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
  };
  const mounted = mountLayout<WeaponDetailSchema>(
    {
      components: {
        ...ports.components,
        weaponDetail: {
          create(data) {
            renderContent(data);
            return {
              dispose: card.dispose,
              element: card.frame,
              slots: { footer: actions },
              update: renderContent,
            };
          },
          slots: ["footer"],
        },
      },
      host: modal,
    },
    weaponDetailTree({ closeLabel: options.closeLabel, lines: [], title: "" }),
  );
  assertAdaActionMetadata(modal);
  const dismiss = actions.querySelector<HTMLButtonElement>(
    '[data-action="dismiss-weapon-detail"]',
  )!;
  return {
    close,
    dispose() {
      disposed = true;
      layer.dispose();
      leaveView = undefined;
      headerBinding.dispose();
      mounted.dispose();
      modal.remove();
      returnFocus = null;
    },
    isOpen: () => !modal.hidden,
    open(
      title: string,
      lines: readonly string[],
      origin: HTMLElement,
      identity?: WeaponDetailIdentity,
    ) {
      returnFocus = origin;
      currentIdentity = identity;
      visible = true;
      mounted.update(weaponDetailTree({ closeLabel: options.closeLabel, lines, title }));
      assertAdaActionMetadata(modal);
      assertAdaActionBindings(modal);
      modal.hidden = false;
      card.fit();
      leaveView ??= layer.open(
        {
          backdrop: modal,
          close,
          focus: dismiss,
          isolation: "dialog",
          restore: () => returnFocus,
        },
        card.frame,
      );
      if (document.activeElement !== dismiss) {
        focusTarget(dismiss);
      }
      options.onOpenChange(true);
    },
  };
}
