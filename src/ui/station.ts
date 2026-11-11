import { refuse } from "./refusal.ts";

// PLACEHOLDER (Art): station card, shop and Stardust counter styling until Art supplies
// the shop's sprites. The card reuses the Settings modal's .ada-modal and .ada-card.
export const STATION_STYLE = `
.ada-controls .ada-stardust{
  position:absolute;
  right:max(8px,var(--inset-right));
  top:calc(max(8px,var(--inset-top)) + 56px);
  padding:2px 8px;
  background:#262b44;
  color:#ead4aa;
  border:2px solid #181425;
  font-size:14px;
  line-height:20px;
  pointer-events:none
}

.ada-controls .ada-station-card{
  display:grid;
  gap:8px;
  min-width:min(80%,420px)
}

.ada-controls .ada-station-card p{
  text-align:center;
  margin:0;
  line-height:20px
}

.ada-controls .ada-station-tabs{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:4px
}

.ada-controls .ada-station-tabs button[aria-selected=true]{
  background:#172335;
  color:#fff8e6
}

.ada-controls .ada-station-rows{
  display:grid;
  gap:4px
}

.ada-controls .ada-station-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  align-items:center;
  gap:8px;
  text-align:left
}

.ada-controls .ada-station-row small{
  display:block;
  font-size:13px;
  opacity:0.75
}

.ada-controls .ada-station-row[data-state=unaffordable]{
  background:#e4dccb;
  border-color:#8a8576;
  color:#5b5a55
}

.ada-controls .ada-station-row[data-state=unaffordable].ada-refused{
  background:#f0c8c0
}

.ada-controls .ada-station-row[data-state=inUse]{
  outline:3px solid #36764f;
  outline-offset:1px
}
`;

export interface StationLabels {
  readonly close: string;
  readonly confirmBuy: string;
  readonly confirmCancel: string;
  readonly shop: string;
  readonly shopShip: string;
  readonly shopWeapons: string;
  readonly station: string;
  readonly stationWelcome: string;
  readonly undock: string;
}

export type StationTab = "weapons" | "ship";

/**
 * How a row answers a tap: forSale opens the confirm, unaffordable refuses, selectable
 * applies an owned paint at once, and owned and inUse rows do nothing.
 */
export type StationRowState = "forSale" | "unaffordable" | "selectable" | "owned" | "inUse";

/** One shop row as shown; `key` names the item to the caller. */
export interface StationRow {
  readonly detail: string;
  readonly key: string;
  readonly name: string;
  readonly state: StationRowState;
  readonly status: string;
}

export type StationRequest =
  | {
      readonly about: string;
      readonly kind: "confirm";
      readonly left: string;
      readonly title: string;
    }
  | { readonly kind: "refused" };

export interface StationOptions {
  readonly balance: () => string;
  readonly buy: (key: string) => void;
  readonly labels: StationLabels;
  readonly reducedMotion: () => boolean;
  readonly request: (key: string) => StationRequest;
  readonly rows: (tab: StationTab) => readonly StationRow[];
  readonly select: (key: string) => void;
  readonly undock: () => void;
}

/**
 * One step back: the confirm returns to the shop, the shop returns to the station card,
 * and only the station card's exits undock.
 */
export function stationBack(
  view: "card" | "shop",
  confirming: boolean,
): "card" | "shop" | "undock" {
  if (confirming) {
    return "shop";
  }
  return view === "shop" ? "card" : "undock";
}

/** What a row tap does; an unaffordable row is tappable and refuses. */
export function rowAction(state: StationRowState): "request" | "select" | "none" {
  if (state === "selectable") {
    return "select";
  }
  return state === "owned" || state === "inUse" ? "none" : "request";
}

function button(label: string, action: () => void): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.addEventListener("click", action);
  return node;
}
function text(value: string): HTMLParagraphElement {
  const node = document.createElement("p");
  node.textContent = value;
  return node;
}

/**
 * The docked station card, its shop and the purchase confirm, following Archie's Pet
 * shop: tabs, Owned rows, a confirm naming the item and the balance left after, and
 * the shared refusal for an item Ada cannot afford. Back (the X, an outside tap or
 * Escape) cancels the confirm, leaves the shop, and on the station card undocks.
 */
export function createStationView(parent: HTMLElement, options: StationOptions) {
  const { labels } = options;
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.dataset.station = "";
  modal.hidden = true;
  const card = document.createElement("section");
  card.className = "ada-card ada-station-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  modal.append(card);
  parent.append(modal);
  let open = false;
  let view: "card" | "shop" = "card";
  let tab: StationTab = "weapons";
  let confirm: { about: string; key: string; left: string; title: string } | null = null;

  const back = (): void => {
    const step = stationBack(view, confirm !== null);
    if (step === "undock") {
      options.undock();
      return;
    }
    confirm = null;
    view = step;
    render();
  };
  const heading = (title: string): HTMLElement => {
    const header = document.createElement("header");
    const node = document.createElement("h2");
    node.textContent = title;
    node.dataset.fontRole = "font-title";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "ada-close";
    close.dataset.action = "station-back";
    close.setAttribute("aria-label", labels.close);
    close.addEventListener("click", back);
    header.append(document.createElement("span"), node, close);
    return header;
  };

  const render = (): void => {
    card.replaceChildren();
    if (confirm) {
      const pending = confirm;
      card.setAttribute("aria-label", pending.title);
      const buy = button(labels.confirmBuy, () => {
        confirm = null;
        options.buy(pending.key);
        render();
      });
      buy.dataset.action = "confirm-buy";
      const cancel = button(labels.confirmCancel, back);
      cancel.dataset.action = "confirm-cancel";
      card.append(heading(pending.title));
      if (pending.about) {
        card.append(text(pending.about));
      }
      card.append(text(pending.left), buy, cancel);
      buy.focus();
      return;
    }
    if (view === "card") {
      card.setAttribute("aria-label", labels.station);
      const undock = button(labels.undock, options.undock);
      undock.dataset.action = "undock";
      const shop = button(labels.shop, () => {
        view = "shop";
        render();
      });
      shop.dataset.action = "open-shop";
      card.append(
        heading(labels.station),
        text(options.balance()),
        text(labels.stationWelcome),
        undock,
        shop,
      );
      shop.focus();
      return;
    }
    card.setAttribute("aria-label", labels.shop);
    const tabs = document.createElement("div");
    tabs.className = "ada-station-tabs";
    tabs.setAttribute("role", "tablist");
    for (const [id, label] of [
      ["weapons", labels.shopWeapons],
      ["ship", labels.shopShip],
    ] as const) {
      const node = button(label, () => {
        tab = id;
        render();
      });
      node.setAttribute("role", "tab");
      node.setAttribute("aria-selected", String(tab === id));
      node.dataset.tab = id;
      tabs.append(node);
    }
    const list = document.createElement("div");
    list.className = "ada-station-rows";
    list.setAttribute("role", "tabpanel");
    for (const row of options.rows(tab)) {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "ada-station-row";
      node.dataset.item = row.key;
      node.dataset.state = row.state;
      const name = document.createElement("span");
      name.textContent = row.name;
      if (row.detail) {
        const detail = document.createElement("small");
        detail.textContent = row.detail;
        name.append(detail);
      }
      const status = document.createElement("span");
      status.textContent = row.status;
      node.append(name, status);
      // Unaffordable rows look disabled but stay enabled, focusable and tappable, so a tap
      // refuses; aria-disabled would announce them as unusable.
      node.addEventListener("click", () => {
        const action = rowAction(row.state);
        if (action === "select") {
          options.select(row.key);
          render();
          return;
        }
        if (action === "none") {
          return;
        }
        const request = options.request(row.key);
        if (request.kind === "refused") {
          refuse(node, options.reducedMotion());
          return;
        }
        confirm = { about: request.about, key: row.key, left: request.left, title: request.title };
        render();
      });
      list.append(node);
    }
    card.append(heading(labels.shop), text(options.balance()), tabs, list);
  };

  // A full outside tap goes back, as the Settings card's does; a drag out does not.
  let outsidePress: { readonly x: number; readonly y: number } | undefined;
  modal.addEventListener("pointerdown", (event) => {
    outsidePress = event.target === modal ? { x: event.clientX, y: event.clientY } : undefined;
  });
  modal.addEventListener("click", (event) => {
    if (
      outsidePress &&
      event.target === modal &&
      Math.hypot(event.clientX - outsidePress.x, event.clientY - outsidePress.y) <= 10
    ) {
      back();
    }
    outsidePress = undefined;
  });

  return {
    dispose: () => modal.remove(),
    isOpen: () => open,
    /**
     * Back-stack layers: the shop (with its confirm) steps back toward the station card,
     * and the card undocks. Register the card first so the shop is innermost.
     */
    layers: {
      card: { back, isOpen: () => open && view === "card" && confirm === null },
      shop: { back, isOpen: () => open && (view === "shop" || confirm !== null) },
    },
    /** Opens on the station card when docking and closes on undocking. */
    setOpen(value: boolean): void {
      if (value === open) {
        return;
      }
      open = value;
      modal.hidden = !open;
      view = "card";
      confirm = null;
      if (open) {
        render();
      }
    },
  };
}

/** PLACEHOLDER (Art): the HUD Stardust count, a plain text plate. */
export function createStardustCounter(parent: HTMLElement) {
  const node = document.createElement("div");
  node.className = "ada-stardust";
  node.setAttribute("role", "status");
  node.hidden = true;
  parent.append(node);
  return {
    dispose: () => node.remove(),
    set(value: string | null): void {
      node.hidden = value === null;
      if (value !== null && node.textContent !== value) {
        node.textContent = value;
      }
    },
  };
}
