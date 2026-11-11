import { units } from "./layout/css.ts";
import { GALAXY_CARD } from "./layout/galaxySelectCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createButton, createCard, isTap, TEXT_TOKENS } from "./modal.ts";
import { refuse } from "./refusal.ts";

export interface GalaxySelectLabels {
  readonly close: string;
  readonly home: string;
  readonly jump: string;
  readonly locked: string;
  readonly next: string;
  /** "Galaxy {number}". */
  readonly number: string;
  readonly previous: string;
}

export interface GalaxyPage {
  readonly flavor: string;
  readonly hue: string;
  readonly name: string;
  readonly number: number;
  readonly unlocked: boolean;
  readonly first: boolean;
  readonly last: boolean;
}

export interface GalaxySelectOptions {
  /** Every galaxy's flavor line, so the card keeps the tallest page's height. */
  readonly flavors: readonly string[];
  readonly labels: GalaxySelectLabels;
  readonly onHome: () => void;
  readonly onJump: () => void;
  readonly onPage: (delta: number) => void;
  readonly reducedMotion: () => boolean;
}

const STYLE = `
.ada-controls .ada-galaxy{
  align-self:stretch;
  display:flex;
  flex-direction:column;
  align-items:center;
  text-align:center;
  gap:${units(GALAXY_CARD.rowGap)}
}

/* PLACEHOLDER (Art): the screenshot is the galaxy's hue until Art's captures land. */
.ada-controls .ada-galaxy-shot{
  width:${units(GALAXY_CARD.screenshot.width)};
  height:${units(GALAXY_CARD.screenshot.height)};
  image-rendering:pixelated
}
.ada-controls .ada-galaxy[data-locked] .ada-galaxy-shot{
  filter:grayscale(1)
}

.ada-controls .ada-galaxy .ada-galaxy-name{
  font-weight:bold;
  color:${TEXT_TOKENS.title}
}
.ada-controls .ada-galaxy[data-locked] p{
  color:${TEXT_TOKENS.disabledLabel}
}

/* Every page's flavor line shares one cell, so paging never resizes the card. */
.ada-controls .ada-galaxy-flavors{
  align-self:stretch;
  display:grid
}
.ada-controls .ada-galaxy-flavors > p{
  grid-area:1 / 1;
  visibility:hidden
}
.ada-controls .ada-galaxy-flavors > p[data-current]{
  visibility:visible
}
`;

/**
 * Galaxy selection over the cockpit, one galaxy per page as in Chibi's stage cards: the header
 * "Galaxy {number}", the screenshot, name and flavor line, then Previous, Home, Jump and Next.
 * A locked galaxy shows its number, a greyscale screenshot and "..." with Jump unavailable. The
 * close X, an outside tap, back and Escape (through the back stack) go Home.
 */
export function createGalaxySelect(root: HTMLElement, options: GalaxySelectOptions) {
  const { labels } = options;
  const style = document.createElement("style");
  style.textContent = STYLE;
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = createCard({ closeAction: "close-galaxies", closeLabel: labels.close, title: "" });
  card.card.dataset.dialog = "galaxies";
  const galaxy = document.createElement("div");
  galaxy.className = "ada-galaxy";
  galaxy.dataset.inkTop = "0";
  const shot = document.createElement("div");
  shot.className = "ada-galaxy-shot";
  const name = document.createElement("p");
  name.className = "ada-galaxy-name";
  const flavors = document.createElement("div");
  flavors.className = "ada-galaxy-flavors ada-prose";
  const lines = [...options.flavors, labels.locked].map((text) => {
    const line = document.createElement("p");
    line.textContent = text;
    return line;
  });
  flavors.append(...lines);
  galaxy.append(shot, name, flavors);
  const actions = document.createElement("div");
  actions.className = "ada-actions";
  actions.dataset.inkTop = "0";
  const previous = createButton(labels.previous);
  previous.dataset.action = "galaxy-previous";
  const home = createButton(labels.home);
  home.dataset.action = "galaxy-home";
  const jump = createButton(labels.jump, "primary");
  jump.dataset.action = "galaxy-jump";
  const next = createButton(labels.next);
  next.dataset.action = "galaxy-next";
  actions.append(previous, home, jump, next);
  card.body.append(galaxy, actions);
  modal.append(card.frame);
  root.append(style, modal);
  let page: GalaxyPage | null = null;
  let shown = "";
  previous.addEventListener("click", () => options.onPage(-1));
  next.addEventListener("click", () => options.onPage(1));
  home.addEventListener("click", () => options.onHome());
  card.close.addEventListener("click", () => options.onHome());
  jump.addEventListener("click", () => {
    if (page?.unlocked) {
      options.onJump();
    } else {
      refuse(jump, options.reducedMotion());
    }
  });
  let outside: { readonly x: number; readonly y: number } | undefined;
  modal.addEventListener("pointerdown", (event) => {
    outside = event.target === modal ? { x: event.clientX, y: event.clientY } : undefined;
  });
  modal.addEventListener("click", (event) => {
    if (
      outside &&
      event.target === modal &&
      isTap(readViewUnit(modal), outside, { x: event.clientX, y: event.clientY })
    ) {
      options.onHome();
    }
    outside = undefined;
  });
  return {
    dispose(): void {
      card.dispose();
      style.remove();
      modal.remove();
    },
    isOpen: () => page !== null,
    show(view: GalaxyPage | null): void {
      const signature = JSON.stringify(view);
      if (signature === shown) {
        return;
      }
      const opening = page === null;
      shown = signature;
      page = view;
      modal.hidden = page === null;
      if (!page) {
        return;
      }
      const title = labels.number.replace("{number}", String(page.number));
      card.title.textContent = title;
      card.frame.setAttribute("aria-label", title);
      if (page.unlocked) {
        delete galaxy.dataset.locked;
      } else {
        galaxy.dataset.locked = "true";
      }
      shot.style.background = page.hue;
      name.textContent = page.unlocked ? page.name : labels.locked;
      const text = page.unlocked ? page.flavor : labels.locked;
      for (const line of lines) {
        line.toggleAttribute("data-current", line.textContent === text);
        line.setAttribute("aria-hidden", String(line.textContent !== text));
      }
      previous.disabled = page.first;
      next.disabled = page.last;
      jump.classList.toggle("ada-unavailable", !page.unlocked);
      if (page.unlocked) {
        jump.removeAttribute("aria-disabled");
      } else {
        jump.setAttribute("aria-disabled", "true");
      }
      card.fit();
      if (opening) {
        jump.focus();
      }
    },
  };
}
