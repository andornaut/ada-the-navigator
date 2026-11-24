import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { TASK_COLORS, type TaskCategory } from "../data/taskCategories.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import type { MapPlace, MapSymbol } from "../model/map.ts";
import type { QuestEntry, QuestObjective } from "../model/questDetails.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { createCompletionIndicator } from "./completionIndicator.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { QUEST_LIST_PAGE_SIZE, QUEST_ROUTE_ARROW } from "./layout/questsScreen.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { chipFace, chipGlyph, type MapScreenLabels } from "./mapScreen.ts";
import { createCard, setFooterAction, setScrollGroup } from "./modal.ts";
import { createStandardCloseAction } from "./modalClose.ts";
import { createModalLayer } from "./modalLayer.ts";
import { inCurrentView } from "./pressScope.ts";
import { type QuestsBodyData, type QuestsBodySchema, questsBodyTree } from "./questsBodyTree.ts";
import {
  type QuestFooterAction,
  type QuestFooterData,
  type QuestsFooterSchema,
  questsTree,
} from "./questsTree.ts";
import { spriteIconPath } from "./spriteIconPath.ts";
import { createStandardTextAction } from "./standardTextAction.ts";
import { CARGO_ICONS } from "./statusPill.ts";

export type QuestOrigin = "flight" | "list" | "ship";

interface LocatedEndpoint {
  readonly kind: "source" | "target";
  readonly placeId: string;
}

/** Endpoint metadata is already filtered by the model; current map membership enables locating. */
export function questRoute(entry: QuestEntry, places: readonly MapPlace[]) {
  const { line } = entry;
  return [
    ...(line.source === undefined ? [] : [{ id: line.source, kind: "source" as const }]),
    {
      id: line.destination === undefined ? line.target : line.destination,
      kind: "target" as const,
    },
  ].map(({ id, kind }) => ({
    kind,
    location: entry.locations.find((location) => location.id === id) ?? null,
    place: places.find((place) => place.id === id) ?? null,
  }));
}

/** Only supplied, revealed steps are rendered; a legacy quest retains its current action. */
export function questChecklist(entry: QuestEntry): readonly QuestObjective[] {
  const current: QuestObjective = {
    checked: false,
    label: entry.line.nextStep ?? entry.line.text,
    ...(entry.line.currentItemKind ? { itemKind: entry.line.currentItemKind } : {}),
    ...(entry.line.progress ? { count: entry.line.progress } : {}),
  };
  if (entry.line.objectives?.length) {
    return entry.line.objectives.some((row) => !row.checked)
      ? entry.line.objectives
      : [...entry.line.objectives, current];
  }
  return [
    ...(entry.line.requirements ?? []).map((row) => ({ ...row, checked: row.checked === true })),
    current,
  ];
}

/** Existing inventory or known map identity, independent of completion state. */
export function questObjectiveIcon(entry: QuestEntry, objective: QuestObjective): string | null {
  if (objective.itemKind === "holodisk") {
    return spriteIconPath("icon-holodisk-20");
  }
  if (objective.itemKind) {
    return CARGO_ICONS[objective.itemKind];
  }
  const location = entry.locations.find(
    ({ id }) => id === (objective.location ?? entry.line.destination ?? entry.line.target),
  );
  if (location?.symbol) {
    const glyph = chipGlyph({ symbol: location.symbol });
    return glyph ? uiIconUrl(glyph) : null;
  }
  if (objective.location === undefined && entry.jobType) {
    return uiIconUrl(`map-job-${entry.jobType}`);
  }
  return null;
}

/** Presentation only: the canonical model has already selected these active quests. */
export function questContextIcon(
  context: { readonly quests: readonly QuestEntry[] } | null,
): string | null {
  if (!context?.quests.length) {
    return null;
  }
  const [entry] = context.quests;
  if (context.quests.length === 1 && entry) {
    if (entry.jobType) {
      return uiIconUrl(chipGlyph({ jobType: entry.jobType, symbol: "job" })!);
    }
    const step = questChecklist(entry).find((row) => !row.checked);
    if (step) {
      const path = questObjectiveIcon(entry, step);
      if (path) {
        return path;
      }
    }
  }
  return uiIconUrl(chipGlyph({ symbol: "destination" })!);
}

export function createQuestsScreen(
  root: HTMLElement,
  options: {
    readonly labels: MapScreenLabels;
    readonly onClose: () => void;
    readonly onLocate: (id: string) => void;
  },
) {
  const { labels } = options;
  const modal = document.createElement("div");
  modal.className = "ada-modal ada-quests-screen";
  modal.hidden = true;
  let disposed = false;
  const headerClose = createStandardCloseAction(root, "close-quests", labels.close, {
    current: (button) => !disposed && !modal.hidden && inCurrentView(root, button),
    run: () => back(),
    slopPx: (button) => SCROLL.dragThreshold * readViewUnit(button),
    slopThreshold: SCROLL.dragThreshold,
  });
  const card = createCard({
    close: headerClose.element,
    size: "large",
    title: labels.quests,
  });

  card.card.dataset.dialog = "quests";
  modal.append(card.frame);
  const renderedBindings: ReturnType<typeof bindAdaAction>[] = [];
  let bodyLayout: ReturnType<typeof mountLayout<QuestsBodySchema>> | undefined;
  let footerLayout: ReturnType<typeof mountLayout<QuestsFooterSchema>> | undefined;
  const register = (element: HTMLButtonElement, run: () => void) => {
    renderedBindings.push(
      bindAdaAction(
        {
          click: {
            availability: () => (element.disabled ? { kind: "omitted" } : { kind: "available" }),
            run,
          },
          current: () => !disposed && !modal.hidden && inCurrentView(root, element),
          slopPx: () => SCROLL.dragThreshold * readViewUnit(element),
        },
        element,
      ),
    );
  };
  let entries: readonly QuestEntry[] = [];
  let contextEntries: readonly QuestEntry[] | null = null;
  let places: readonly MapPlace[] = [];
  let selected: string | null = null;
  let galaxy: GalaxyNumber | undefined;
  let origin: QuestOrigin = "list";
  let rootDismissal: Pick<QuestFooterData["dismiss"], "intent" | "label"> = {
    intent: "close",
    label: labels.close,
  };
  let signature = "";
  let listPage = 0;
  let suspended: LocatedEndpoint | undefined;
  let layer: ReturnType<typeof createModalLayer> | undefined;
  let leave: (() => void) | undefined;
  const release = () => {
    leave?.();
    leave = undefined;
    layer?.dispose();
    layer = undefined;
  };
  const hide = () => {
    release();
    contextEntries = null;
    suspended = undefined;
    modal.hidden = true;
  };
  const icon = (entry: QuestEntry, symbol?: MapSymbol, category?: TaskCategory) => {
    const image = document.createElement("img");
    image.className = "ada-quest-icon";
    image.alt = "";
    const job = symbol === undefined && Boolean(entry.jobType);
    const taskCategory = symbol === undefined ? entry.line.kind : category;
    const shape = {
      job,
      ...(job && entry.jobType ? { jobType: entry.jobType } : {}),
      ...(taskCategory ? { taskCategory } : {}),
      symbol: symbol ?? (job ? "job" : "destination"),
    };
    image.style.background = chipFace(shape);
    const glyph = symbol === undefined ? null : chipGlyph(shape);
    const path =
      symbol === undefined
        ? questContextIcon({ quests: [entry] })
        : glyph
          ? uiIconUrl(glyph)
          : null;
    if (path) {
      image.src = path;
    }
    return image;
  };
  const back = () => {
    if (selected !== null && origin === "list") {
      const focusQuestId = selected;
      selected = null;
      render(focusQuestId);
    } else {
      hide();
      options.onClose();
    }
  };
  function render(focusQuestId?: string, focusEndpoint?: LocatedEndpoint): void {
    let questFocus: HTMLButtonElement | undefined;
    for (const binding of renderedBindings.splice(0)) {
      binding.dispose();
    }
    release();
    footerLayout?.dispose();
    bodyLayout?.dispose();
    const visibleEntries = contextEntries ?? entries;
    const entry = visibleEntries.find((entry) => entry.id === selected);
    if (!entry) {
      selected = null;
    }
    const body = document.createElement("div");
    body.className = entry ? "ada-quest-content" : "ada-quest-list";
    const footer = document.createElement("footer");
    footer.className = "ada-quest-footer";
    const footerActions = new Map<QuestFooterAction, () => void>();
    let other: QuestFooterData["other"];
    let pager: QuestFooterData["pager"];
    let bodyData: QuestsBodyData;
    if (entry) {
      const line = entry.line;
      const endpoints = questRoute(entry, entry.galaxy === galaxy ? places : []);
      bodyData = {
        mode: "detail",
        text: line.text,
        ...(line.description && line.description !== line.text
          ? { description: line.description }
          : {}),
        objectives: questChecklist(entry).map((step) => ({
          iconPath: questObjectiveIcon(entry, step),
          step,
        })),
        ...(line.source !== undefined || line.destination !== undefined || line.target !== null
          ? { route: endpoints.map((endpoint) => ({ endpoint, entry })) }
          : {}),
        reward: {
          name: line.outcome && !line.reward ? labels.questOutcome : labels.questReward,
          text: line.reward ?? line.outcome ?? labels.questStoryProgress,
        },
      };
      if (origin === "flight" && contextEntries === null) {
        other = { label: labels.questOtherQuests ?? "" };
        footerActions.set("other", () => {
          selected = null;
          render();
        });
      }
    } else {
      const ordered = [
        ...visibleEntries.filter((entry) => entry.line.kind === "story"),
        ...visibleEntries.filter((entry) => entry.line.kind === "job"),
      ];
      const pages = Math.max(1, Math.ceil(ordered.length / QUEST_LIST_PAGE_SIZE));
      listPage = Math.min(listPage, pages - 1);
      const visible = ordered.slice(
        listPage * QUEST_LIST_PAGE_SIZE,
        (listPage + 1) * QUEST_LIST_PAGE_SIZE,
      );
      const groups: Extract<QuestsBodyData, { mode: "list" }>["groups"][number][] = [];
      for (const kind of ["story", "job"] as const) {
        const group = visible.filter((entry) => entry.line.kind === kind);
        if (!group.length) {
          continue;
        }
        groups.push({
          entries: group,
          heading: (kind === "story" ? labels.questsStoryHeading : labels.questsJobsHeading) ?? "",
        });
      }
      if (pages > 1) {
        for (const direction of [-1, 1]) {
          footerActions.set(direction < 0 ? "previous" : "next", () => {
            listPage += direction;
            render();
          });
        }
        pager = {
          count: labels.page
            .replace("{page}", String(listPage + 1))
            .replace("{pages}", String(pages)),
          next: { disabled: listPage + 1 < 0 || listPage + 1 >= pages, label: labels.next },
          previous: { disabled: listPage - 1 < 0 || listPage - 1 >= pages, label: labels.previous },
        };
      }
      bodyData = {
        groups,
        mode: "list",
        ...(!visibleEntries.length ? { emptyText: labels.questsEmpty } : {}),
      };
    }
    bodyLayout = mountLayout<QuestsBodySchema>(
      {
        components: {
          body: {
            create() {
              return { dispose() {}, element: body, slots: { content: body }, update() {} };
            },
            slots: ["content"],
          },
          heading: {
            create(initial) {
              const heading = document.createElement("h3");
              heading.textContent = initial.text;
              if (initial.category) {
                heading.style.color = TASK_COLORS[initial.category];
              }
              return { dispose() {}, element: heading, slots: {}, update() {} };
            },
            slots: [],
          },
          objective: {
            create(initial) {
              const { iconPath, step } = initial;
              const row = document.createElement("div");
              row.className = "ada-quest-requirement";
              row.append(createCompletionIndicator(step.label, step.checked));
              if (iconPath) {
                const image = document.createElement("img");
                image.className = "ada-quest-icon";
                image.alt = "";
                image.src = iconPath;
                image.setAttribute("aria-hidden", "true");
                row.append(image);
              }
              const text = document.createElement("span");
              text.textContent = step.label;
              row.append(text);
              if (step.count) {
                const count = document.createElement("strong");
                count.textContent = step.count;
                row.append(count);
              }

              return { dispose() {}, element: row, slots: {}, update() {} };
            },
            slots: [],
          },
          paragraph: {
            create(initial) {
              const text = document.createElement("p");
              if (initial.className) {
                text.className = initial.className;
              }
              text.textContent = initial.text;
              return { dispose() {}, element: text, slots: {}, update() {} };
            },
            slots: [],
          },
          quest: {
            create(initial) {
              const item = initial.entry;
              const action = createStandardTextAction(root, item.line.text, {
                availability: (button) =>
                  button?.disabled ? { kind: "disabled" } : { kind: "available" },
                current: () => !disposed && !modal.hidden && inCurrentView(root, action.element),
                run: () => {
                  selected = item.id;
                  origin = "list";
                  render();
                },
              });
              const button = action.element;
              button.dataset.questId = item.id;
              setButtonRole("secondary", button);
              if (item.id === focusQuestId) {
                questFocus = button;
              }
              button.prepend(icon(item));
              return { dispose: action.dispose, element: button, slots: {}, update() {} };
            },
            slots: [],
          },
          route: {
            create(initial) {
              const route = document.createElement("div");
              route.className = "ada-quest-route";
              if (initial.endpoints.length === 1) {
                route.style.gridTemplateColumns = "1fr";
              }
              for (const { endpoint, entry } of initial.endpoints) {
                if (route.childElementCount) {
                  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                  svg.setAttribute("viewBox", QUEST_ROUTE_ARROW.viewBox);
                  svg.setAttribute("class", "ada-quest-arrow");
                  svg.setAttribute("aria-hidden", "true");
                  for (const d of [QUEST_ROUTE_ARROW.shaft, QUEST_ROUTE_ARROW.head]) {
                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("d", d);
                    path.setAttribute("fill", "#b8b3c9");
                    svg.append(path);
                  }
                  route.append(svg);
                }
                const button = document.createElement("button");
                button.type = "button";
                button.className = "ada-quest-endpoint";
                button.disabled =
                  origin === "ship" || endpoint.location === null || endpoint.place === null;
                if (endpoint.location?.symbol) {
                  const image = icon(entry, endpoint.location.symbol, endpoint.place?.taskCategory);
                  if (image) {
                    button.append(image);
                  }
                }
                const text = document.createElement("span");
                const small = document.createElement("small");
                small.textContent =
                  (endpoint.kind === "source" ? labels.questFrom : labels.questTo) ?? "";
                text.append(
                  small,
                  document.createTextNode(endpoint.location?.label ?? labels.questExplore ?? ""),
                );
                button.append(text);
                if (origin !== "ship" && endpoint.location && endpoint.place) {
                  button.setAttribute(
                    "aria-label",
                    `${labels.questLocate ?? ""}: ${endpoint.location.label}`,
                  );
                }
                const placeId = endpoint.place?.id;
                if (
                  !button.disabled &&
                  focusEndpoint?.kind === endpoint.kind &&
                  focusEndpoint.placeId === placeId
                ) {
                  questFocus = button;
                }
                register(button, () => {
                  if (placeId === undefined) {
                    return;
                  }
                  suspended = { kind: endpoint.kind, placeId };
                  release();
                  modal.hidden = true;
                  options.onLocate(placeId);
                });
                route.append(button);
              }

              return { dispose() {}, element: route, slots: {}, update() {} };
            },
            slots: [],
          },
          section: {
            create(initial) {
              const section = document.createElement("section");
              section.className = initial.className;
              if (initial.name) {
                const heading = document.createElement("h3");
                heading.textContent = initial.name;
                section.append(heading);
              }
              if (initial.text) {
                const p = document.createElement("p");
                p.textContent = initial.text;
                section.append(p);
              }
              return { dispose() {}, element: section, slots: { content: section }, update() {} };
            },
            slots: ["content"],
          },
        },
        host: card.body,
      },
      questsBodyTree(bodyData),
    );
    const footerData: QuestFooterData = {
      dismiss: {
        actionId: entry && origin === "list" ? "quest-back" : "quest-close",
        intent: entry && origin === "list" ? "back" : rootDismissal.intent,
        label:
          entry && origin === "list" ? (labels.questBack ?? labels.close) : rootDismissal.label,
      },
      ...(other === undefined ? {} : { other }),
      ...(pager === undefined ? {} : { pager }),
    };
    footerActions.set("dismiss", back);
    let close!: HTMLButtonElement;
    footerLayout = mountLayout<QuestsFooterSchema>(
      {
        components: {
          button: {
            create(initial) {
              const run = footerActions.get(initial.action);
              if (!run) {
                throw new Error("Unregistered Quest footer action");
              }
              let props = initial;
              const action = createStandardTextAction(root, initial.label, {
                availability: () => (props.disabled ? { kind: "disabled" } : { kind: "available" }),
                current: () => !disposed && !modal.hidden && inCurrentView(root, action.element),
                run,
              });
              const button = action.element;
              if (initial.action === "dismiss") {
                close = button;
              }
              const update = (data: QuestsFooterSchema["button"]["props"]) => {
                if (data.label !== props.label) {
                  action.setLabel(data.label);
                }
                props = data;
                button.classList.toggle("ada-primary", data.role === "primary");
                setButtonRole(data.role, button);
                if (data.actionId !== undefined) {
                  button.dataset.action = data.actionId;
                }
                action.refresh();
              };
              update(initial);
              return { dispose: action.dispose, element: button, slots: {}, update };
            },
            slots: [],
          },
          count: {
            create(initial) {
              const count = document.createElement("output");
              const update = (data: QuestsFooterSchema["count"]["props"]) => {
                count.textContent = data.text;
              };
              update(initial);
              return { dispose() {}, element: count, slots: {}, update };
            },
            slots: [],
          },
          footer: {
            create(initial) {
              const update = (data: QuestsFooterSchema["footer"]["props"]) => {
                setFooterAction(data.intent, footer);
              };
              update(initial);
              return { dispose() {}, element: footer, slots: { controls: footer }, update };
            },
            slots: ["controls"],
          },
        },
        host: card.body,
      },
      questsTree(footerData),
    );
    assertAdaActionMetadata(body);
    assertAdaActionMetadata(footer);
    card.body.replaceChildren(body, footer);
    assertAdaActionBindings(card.frame);
    // Keep the footer outside the scroll group when detail prose or a route wraps.
    setScrollGroup(card, body);
    modal.hidden = false;
    card.fit();
    layer = createModalLayer(modal);
    leave = layer.open({ close: back, focus: questFocus ?? close }, card.frame);
  }
  function dispose(): void {
    disposed = true;
    headerClose.dispose();
    for (const binding of renderedBindings) {
      binding.dispose();
    }
    renderedBindings.length = 0;
    hide();
    footerLayout?.dispose();
    bodyLayout?.dispose();
    card.dispose();
    modal.remove();
  }
  try {
    assertAdaActionMetadata(card.frame);
    root.append(modal);
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    back,
    close: hide,
    dispose,
    focus(): void {
      focusTarget(card.body.querySelector<HTMLButtonElement>(".ada-primary") ?? card.close);
    },
    isOpen: () => !modal.hidden,
    isSuspended: () => suspended !== undefined,
    open(
      id: string | null = null,
      from: QuestOrigin = "list",
      dismissal?: Pick<QuestFooterData["dismiss"], "intent" | "label">,
    ): void {
      rootDismissal = dismissal ?? { intent: "close", label: labels.close };
      contextEntries = null;
      suspended = undefined;
      selected = id;
      origin = from;
      render();
    },
    /** Entries come from the canonical model getter; no object association is inferred here. */
    openContext(
      context: { readonly targetId: string; readonly quests: readonly QuestEntry[] } | null,
    ): boolean {
      if (!context?.quests.length) {
        return false;
      }
      rootDismissal = { intent: "close", label: labels.close };
      suspended = undefined;
      contextEntries = [...context.quests];
      selected = contextEntries.length === 1 ? contextEntries[0]!.id : null;
      origin = contextEntries.length === 1 ? "flight" : "list";
      listPage = 0;
      render();
      return true;
    },
    resume(): void {
      if (!suspended || disposed) {
        return;
      }
      const endpoint = suspended;
      suspended = undefined;
      if (contextEntries?.length === 0) {
        hide();
        options.onClose();
      } else {
        render(undefined, endpoint);
      }
    },
    setState(
      next: readonly QuestEntry[],
      knownPlaces: readonly MapPlace[],
      currentGalaxy?: GalaxyNumber,
    ): void {
      const revision = JSON.stringify([next, knownPlaces, currentGalaxy]);
      galaxy = currentGalaxy;
      entries = next;
      places = knownPlaces;
      if (contextEntries) {
        const ids = new Set(contextEntries.map(({ id }) => id));
        contextEntries = next.filter(({ id }) => ids.has(id));
        if (contextEntries.length === 0 && !modal.hidden) {
          hide();
          signature = revision;
          options.onClose();
          return;
        }
      }
      if (signature !== revision && !modal.hidden) {
        render();
      }
      signature = revision;
    },
  };
}
