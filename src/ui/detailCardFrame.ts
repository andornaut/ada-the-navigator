import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { CARD_CONTENT } from "./layout/contentCard.ts";
import { BUTTON_GAP } from "./layout/tokens.ts";
import { createCard, setFooterAction } from "./modal.ts";
import { createProse } from "./prose.ts";

type DetailContentSchema = {
  field: { props: HTMLElement; slots: never };
};

/** The static layout owns the body structure. Each detail tree owns its footer's keyed actions. */
export function createDetailCardFrame(
  root: HTMLElement,
  close: HTMLButtonElement,
  dialog: "resource" | "weapon-detail",
  footerAction: "back" | "close",
) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = createCard({ close, size: "small", title: "" });
  card.card.dataset.dialog = dialog;
  const description = createProse();
  const quantity = document.createElement("div");
  quantity.hidden = true;
  const content = mountLayout<DetailContentSchema>(
    {
      components: {
        field: {
          create: (element) => ({ dispose() {}, element, slots: {}, update() {} }),
          slots: [],
        },
      },
      host: card.body,
    },
    {
      children: [
        { component: "field", key: "description", kind: "component", props: description },
        { component: "field", key: "quantity", kind: "component", props: quantity },
        { children: [], gap: BUTTON_GAP, key: "actions", kind: "row", padding: 0 },
      ],
      gap: CARD_CONTENT.gap,
      key: "detail-content",
      kind: "stack",
      padding: 0,
    },
  );
  card.body.classList.add("ada-detail-body");
  const actions = card.body.querySelector<HTMLElement>(".ui-layout-row")!;
  actions.classList.add("ada-actions", "ada-detail-actions");
  actions.dataset.inkTop = "0";
  setFooterAction(footerAction, actions);
  modal.append(card.frame);
  root.append(modal);
  return {
    actions,
    card,
    description,
    dispose() {
      content.dispose();
      card.dispose();
    },
    modal,
    quantity,
  };
}
