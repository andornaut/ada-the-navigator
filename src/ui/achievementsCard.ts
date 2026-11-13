import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import { SCREEN } from "../data/screen.ts";
import { listCardHeader } from "./layout/cardFrame.ts";
import { TEXT_BUTTON } from "./layout/controls.ts";
import { units } from "./layout/css.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import { createButton, createCard, isTap, TEXT_TOKENS, UI_SCOPE } from "./modal.ts";

// The Achievements card (gameplay/quests.md "Achievements"), in Chibi's shape and spacing: every
// entry in Gameplay's order, two columns of a badge beside the name, a locked counted entry's
// count at the name's right end and the condition below; Previous, the page count and Next page
// the list.
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

/**
 * The entry list's geometry, as Chibi's Achievements card spaces it: two columns up to 312 wide,
 * icon included, a panel padding apart; each entry a 16 badge a gap from its text, centred on
 * its name's line, the name and a counted entry's count a gap apart, and the condition below
 * in at most two body lines, so every entry is three body lines tall; entries a gap apart. The
 * list starts Chibi's list header below the card's top (listCardHeader), the pager a gap below
 * it.
 */
export const ACHIEVEMENTS_CARD = {
  badge: 16,
  badgeGap: SPACING.gap,
  columnGap: SPACING.panelPadding,
  columnWidth: 312,
  columns: 2,
  conditionLines: 2,
  rowGap: SPACING.gap,
} as const;

const { badge, badgeGap, columnGap, columnWidth, columns, conditionLines, rowGap } =
  ACHIEVEMENTS_CARD;
/** One entry's height: its name's line and its condition's lines, each a body line. */
const ENTRY_HEIGHT = (1 + conditionLines) * TYPE.body.lineHeight;
/** The list's top below the card's top. */
export const ACHIEVEMENTS_LIST_TOP = listCardHeader(TYPE.label).bodyTop;

/**
 * How many rows fit a card in `available` logical px of height, the page safe rect's, as in
 * Chibi: as many entries and row gaps as fit between the list's top and the pager, a gap and a
 * text button above the card's bottom padding.
 */
export function achievementRows(available: number): number {
  const room =
    available - ACHIEVEMENTS_LIST_TOP - SPACING.gap - TEXT_BUTTON.height - SPACING.panelPadding;
  return Math.max(1, Math.floor((room + rowGap) / (ENTRY_HEIGHT + rowGap)));
}

/** Entries on one page in the 720x360 view: two columns of three rows. */
export const ACHIEVEMENTS_PER_PAGE =
  columns * achievementRows(SCREEN.height - 2 * SPACING.pageInset);

/**
 * Each column's width for a card in `available` logical px, the page safe rect's width: 312,
 * narrowed where two such columns and the card's padding do not fit, so the card fits instead of
 * scaling and its labels keep their size.
 */
export function achievementColumnWidth(available: number): number {
  const room = available - 2 * SPACING.panelPadding - (columns - 1) * columnGap;
  return Math.min(columnWidth, room / columns);
}

export function achievementPages(count: number, perPage = ACHIEVEMENTS_PER_PAGE): number {
  return Math.max(1, Math.ceil(count / perPage));
}

/** The entries page `page` shows, in order, filling down each column then across. */
export function achievementPage<T>(
  entries: readonly T[],
  page: number,
  perPage = ACHIEVEMENTS_PER_PAGE,
): T[] {
  const start = page * perPage;
  return entries.slice(start, start + perPage);
}

export function fillCount(template: string, have: number, need: number): string {
  return template.replace("{have}", String(have)).replace("{need}", String(need));
}

export function fillPage(template: string, page: number, pages: number): string {
  return template.replace("{page}", String(page)).replace("{pages}", String(pages));
}

export const ACHIEVEMENTS_STYLE = `
${UI_SCOPE} .ada-achievement-list{
  display:grid;
  grid-template-columns:repeat(${columns},var(--ada-achievement-column,${units(columnWidth)}));
  grid-template-rows:repeat(var(--ada-achievement-rows,1),${units(ENTRY_HEIGHT)});
  grid-auto-flow:column;
  column-gap:${units(columnGap)};
  row-gap:${units(rowGap)}
}
${UI_SCOPE} .ada-achievement{
  display:grid;
  grid-template-columns:${units(badge)} 1fr auto;
  grid-template-rows:${units(TYPE.label.lineHeight)} auto;
  column-gap:${units(badgeGap)};
  align-items:center;
  align-content:start;
  color:${TEXT_TOKENS.disabledLabel}
}
${UI_SCOPE} .ada-achievement-badge{
  width:${units(badge)};
  height:${units(badge)};
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
  align-self:start;
  font-size:${units(TYPE.body.size)};
  line-height:${units(TYPE.body.lineHeight)}
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
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = createCard({
    closeAction: "close-achievements",
    closeLabel: labels.close,
    list: true,
    size: "large",
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
  root.append(modal);
  let entries: readonly AchievementEntry[] = [];
  let page = 0;
  let perPage = ACHIEVEMENTS_PER_PAGE;
  // The page safe rect, measured as the card measures it: the columns narrow to its width and
  // the rows fit its height, every page keeping the first page's rows.
  const measure = () => {
    const unit = readViewUnit(modal);
    const styles = getComputedStyle(modal);
    const across = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const down = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const width = (modal.clientWidth - across) / unit;
    list.style.setProperty("--ada-achievement-column", units(achievementColumnWidth(width)));
    perPage = columns * achievementRows((modal.clientHeight - down) / unit);
  };
  const render = () => {
    if (!modal.hidden) {
      measure();
    }
    const pages = achievementPages(entries.length, perPage);
    page = Math.min(page, pages - 1);
    list.style.setProperty(
      "--ada-achievement-rows",
      String(Math.ceil(Math.min(perPage, entries.length) / columns)),
    );
    list.replaceChildren(
      ...achievementPage(entries, page, perPage).map((entry) => entryNode(labels, entry)),
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
  window.addEventListener(VIEW_SCALE_EVENT, render);
  const setOpen = (open: boolean) => {
    if (open === !modal.hidden) {
      return;
    }
    modal.hidden = !open;
    if (open) {
      page = 0;
      render();
      focusTarget(card.close);
    }
    options.onOpenChange(open);
  };
  previous.addEventListener("click", () => {
    page = Math.max(0, page - 1);
    render();
  });
  next.addEventListener("click", () => {
    page = Math.min(achievementPages(entries.length, perPage) - 1, page + 1);
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
      window.removeEventListener(VIEW_SCALE_EVENT, render);
      card.dispose();
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
