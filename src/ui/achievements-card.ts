import { units } from "./layout/css.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createButton, createCard, isTap, TEXT_TOKENS, UI_SCOPE } from "./modal.ts";

// The Achievements card (gameplay/quests.md "Achievements"), in Chibi's shape: every entry in
// Gameplay's order, two columns of a badge beside the name, a locked counted entry's count at the
// name's right end and the condition below; Previous, the page count and Next page the list.
// CLEANUP (added 2026-11-11): Art has not designed this card. It uses the shared card tokens and
// placeholder badges; replace the entry styles and badges once Art's design lands.

export interface AchievementEntry {
  readonly condition: string;
  readonly name: string;
  readonly progress?: { readonly have: number; readonly need: number };
  readonly unlocked: boolean;
}

export interface AchievementsLabels {
  readonly close: string;
  readonly next: string;
  /** `{page}/{pages}`. */
  readonly page: string;
  readonly previous: string;
  /** `{have}/{need}`. */
  readonly progress: string;
  readonly title: string;
}

/** Entries on one page: two columns of three rows. */
export const ACHIEVEMENTS_PER_PAGE = 6;
const COLUMNS = 2;
const COLUMN_WIDTH = 240;
const BADGE = 16;

export function achievementPages(count: number): number {
  return Math.max(1, Math.ceil(count / ACHIEVEMENTS_PER_PAGE));
}

/** The entries page `page` shows, in order, filling down each column then across. */
export function achievementPage<T>(entries: readonly T[], page: number): T[] {
  const start = page * ACHIEVEMENTS_PER_PAGE;
  return entries.slice(start, start + ACHIEVEMENTS_PER_PAGE);
}

export function fillCount(template: string, have: number, need: number): string {
  return template.replace("{have}", String(have)).replace("{need}", String(need));
}

export function fillPage(template: string, page: number, pages: number): string {
  return template.replace("{page}", String(page)).replace("{pages}", String(pages));
}

const STYLE = `
${UI_SCOPE} .ada-achievement-list{
  display:grid;
  grid-template-columns:repeat(${COLUMNS},${units(COLUMN_WIDTH)});
  grid-template-rows:repeat(${ACHIEVEMENTS_PER_PAGE / COLUMNS},auto);
  grid-auto-flow:column;
  column-gap:${units(SPACING.columnGap)};
  row-gap:${units(SPACING.gap)}
}
${UI_SCOPE} .ada-achievement{
  display:grid;
  grid-template-columns:${units(BADGE)} 1fr auto;
  column-gap:${units(SPACING.markGap)};
  align-items:center;
  color:${TEXT_TOKENS.disabledLabel}
}
${UI_SCOPE} .ada-achievement-badge{
  width:${units(BADGE)};
  height:${units(BADGE)};
  background:${TEXT_TOKENS.disabledLabel}
}
${UI_SCOPE} .ada-achievement[data-unlocked="true"] .ada-achievement-badge{
  background:${TEXT_TOKENS.label}
}
${UI_SCOPE} .ada-achievement-name{
  font-size:${units(TYPE.label.size)};
  line-height:${units(TYPE.label.lineHeight)};
  font-weight:${TYPE.label.weight}
}
${UI_SCOPE} .ada-achievement[data-unlocked="true"] .ada-achievement-name{
  color:${TEXT_TOKENS.title}
}
${UI_SCOPE} .ada-achievement-condition{
  grid-column:2 / 4;
  font-size:${units(TYPE.body.size)};
  line-height:${units(TYPE.body.lineHeight)};
  min-height:${units(2 * TYPE.body.lineHeight)}
}
${UI_SCOPE} .ada-achievement[data-unlocked="true"] .ada-achievement-condition{
  color:${TEXT_TOKENS.supporting}
}
${UI_SCOPE} .ada-achievement-pager{
  display:grid;
  grid-template-columns:1fr auto 1fr;
  align-items:center;
  column-gap:${units(SPACING.gap)}
}
${UI_SCOPE} .ada-achievement-pager > p{
  margin:0;
  color:${TEXT_TOKENS.supporting}
}
`;

function entryNode(labels: AchievementsLabels, entry: AchievementEntry): HTMLElement {
  const node = document.createElement("li");
  node.className = "ada-achievement";
  node.dataset.unlocked = String(entry.unlocked);
  const badge = document.createElement("span");
  badge.className = "ada-achievement-badge";
  badge.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "ada-achievement-name";
  name.textContent = entry.name;
  const count = document.createElement("span");
  count.className = "ada-achievement-progress";
  count.textContent = entry.progress
    ? fillCount(labels.progress, entry.progress.have, entry.progress.need)
    : "";
  const condition = document.createElement("span");
  condition.className = "ada-achievement-condition";
  condition.textContent = entry.condition;
  node.append(badge, name, count, condition);
  return node;
}

/**
 * The card over a dimmed layer: the close X, an outside tap and back (through the caller's back
 * stack) close it. Opening shows page one.
 */
export function createAchievementsCard(
  root: HTMLElement,
  options: {
    readonly labels: AchievementsLabels;
    readonly onOpenChange: (open: boolean) => void;
  },
) {
  const { labels } = options;
  const style = document.createElement("style");
  style.textContent = STYLE;
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = createCard({
    closeAction: "close-achievements",
    closeLabel: labels.close,
    title: labels.title,
  });
  card.card.dataset.dialog = "achievements";
  const list = document.createElement("ul");
  list.className = "ada-achievement-list";
  list.dataset.inkTop = "0";
  list.style.margin = "0";
  list.style.padding = "0";
  list.style.listStyle = "none";
  const pager = document.createElement("div");
  pager.className = "ada-achievement-pager";
  pager.dataset.inkTop = "0";
  const previous = createButton(labels.previous);
  previous.dataset.action = "achievements-previous";
  const pageCount = document.createElement("p");
  const next = createButton(labels.next);
  next.dataset.action = "achievements-next";
  pager.append(previous, pageCount, next);
  card.body.append(list, pager);
  modal.append(card.frame);
  root.append(style, modal);
  let entries: readonly AchievementEntry[] = [];
  let page = 0;
  const render = () => {
    const pages = achievementPages(entries.length);
    page = Math.min(page, pages - 1);
    list.replaceChildren(
      ...achievementPage(entries, page).map((entry) => entryNode(labels, entry)),
    );
    pager.hidden = pages === 1;
    pageCount.textContent = fillPage(labels.page, page + 1, pages);
    // An end of the list shows the disabled face but stays focusable, as other cards' do.
    for (const [button, unavailable] of [
      [previous, page === 0],
      [next, page === pages - 1],
    ] as const) {
      button.classList.toggle("ada-unavailable", unavailable);
      if (unavailable) {
        button.setAttribute("aria-disabled", "true");
      } else {
        button.removeAttribute("aria-disabled");
      }
    }
    if (!modal.hidden) {
      card.fit();
    }
  };
  const setOpen = (open: boolean) => {
    if (open === !modal.hidden) {
      return;
    }
    modal.hidden = !open;
    if (open) {
      page = 0;
      render();
      card.close.focus();
    }
    options.onOpenChange(open);
  };
  previous.addEventListener("click", () => {
    page = Math.max(0, page - 1);
    render();
  });
  next.addEventListener("click", () => {
    page = Math.min(achievementPages(entries.length) - 1, page + 1);
    render();
  });
  card.close.addEventListener("click", () => setOpen(false));
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
      setOpen(false);
    }
    outside = undefined;
  });
  return {
    close: () => setOpen(false),
    dispose(): void {
      card.dispose();
      style.remove();
      modal.remove();
    },
    isOpen: () => !modal.hidden,
    open: () => setOpen(true),
    /** The entries to list; an open card redraws its page. */
    setEntries(next: readonly AchievementEntry[]): void {
      if (JSON.stringify(next) === JSON.stringify(entries)) {
        return;
      }
      entries = next;
      render();
    },
  };
}
