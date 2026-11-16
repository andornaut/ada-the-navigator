import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import type { GalaxyNumber } from "../data/types.ts";
import type { MapPlace, MapSymbol } from "../model/map.ts";
import type { QuestEntry, QuestObjective } from "../model/questDetails.ts";
import { bindAdaAction } from "./actionBinding.ts";
import { createCompletionIndicator } from "./completionIndicator.ts";
import { gainNotice } from "./itemNotice.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { QUEST_LIST_PAGE_SIZE, QUEST_ROUTE_ARROW } from "./layout/questsScreen.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { chipFace, chipGlyph, type MapScreenLabels } from "./mapScreen.ts";
import { createButton, createCard, setFooterAction, setScrollGroup } from "./modal.ts";
import { createModalLayer } from "./modalLayer.ts";
import { inCurrentView } from "./pressScope.ts";
import { type QuestsBodyData, type QuestsBodySchema, questsBodyTree } from "./questsBodyTree.ts";
import {
  type QuestFooterAction,
  type QuestFooterData,
  type QuestsFooterSchema,
  questsTree,
} from "./questsTree.ts";
import { CARGO_ICONS } from "./statusPill.ts";

export type QuestOrigin = "flight" | "list" | "ship";

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
    const { icon } = gainNotice({}, { kind: "holodisk" });
    return "sprite" in icon ? `/art/ui/sprites/${icon.sprite}.png` : icon.mask;
  }
  if (objective.itemKind) {
    return CARGO_ICONS[objective.itemKind];
  }
  const location = entry.locations.find(
    ({ id }) => id === (objective.location ?? entry.line.destination ?? entry.line.target),
  );
  if (location?.symbol) {
    const glyph = chipGlyph({ symbol: location.symbol });
    return glyph ? `/art/ui/icons/${glyph}.svg` : null;
  }
  if (objective.location === undefined && entry.jobType) {
    return `/art/ui/icons/map-job-${entry.jobType}.svg`;
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
      return `/art/ui/icons/${chipGlyph({ jobType: entry.jobType, symbol: "job" })}.svg`;
    }
    const step = questChecklist(entry).find((row) => !row.checked);
    if (step) {
      const path = questObjectiveIcon(entry, step);
      if (path) {
        return path;
      }
    }
  }
  return `/art/ui/icons/${chipGlyph({ symbol: "destination" })}.svg`;
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
  const card = createCard({
    closeAction: "close-quests",
    closeLabel: labels.close,
    size: "large",
    title: labels.quests,
  });

  card.card.dataset.dialog = "quests";
  modal.append(card.frame);
  root.append(modal);
  let disposed = false;
  const bindings: ReturnType<typeof bindAdaAction>[] = [];
  const renderedBindings: ReturnType<typeof bindAdaAction>[] = [];
  let bodyLayout: ReturnType<typeof mountLayout<QuestsBodySchema>> | undefined;
  let footerLayout: ReturnType<typeof mountLayout<QuestsFooterSchema>> | undefined;
  const register = (element: HTMLButtonElement, run: () => void, rendered = true) => {
    (rendered ? renderedBindings : bindings).push(
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
    modal.hidden = true;
  };
  const icon = (entry: QuestEntry, symbol?: MapSymbol, job = Boolean(entry.jobType)) => {
    const image = document.createElement("img");
    image.className = "ada-quest-icon";
    image.alt = "";
    const shape = {
      job,
      ...(job && entry.jobType ? { jobType: entry.jobType } : {}),
      symbol: symbol ?? (job ? "job" : "destination"),
    };
    image.style.background = chipFace(shape);
    const glyph = symbol === undefined ? null : chipGlyph(shape);
    const path =
      symbol === undefined
        ? questContextIcon({ quests: [entry] })
        : glyph
          ? `/art/ui/icons/${glyph}.svg`
          : null;
    if (path) {
      image.src = path;
    }
    return image;
  };
  const back = () => {
    if (selected !== null && origin === "list") {
      selected = null;
      render();
    } else {
      hide();
      options.onClose();
    }
  };
  register(card.close, back, false);
  function render(): void {
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
              const button = createButton(item.line.text, "secondary");
              button.dataset.questId = item.id;
              const image = icon(item);
              if (image) {
                button.prepend(image);
              }
              register(button, () => {
                selected = item.id;
                origin = "list";
                render();
              });
              return { dispose() {}, element: button, slots: {}, update() {} };
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
                  const image = icon(entry, endpoint.location.symbol, false);
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
                  register(button, () => {
                    hide();
                    options.onLocate(endpoint.place!.id);
                  });
                }
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
              const button = createButton(initial.label, initial.role);
              if (initial.action === "dismiss") {
                close = button;
              }
              const update = (data: QuestsFooterSchema["button"]["props"]) => {
                button.textContent = data.label;
                button.disabled = data.disabled ?? false;
                if (data.actionId !== undefined) {
                  button.dataset.action = data.actionId;
                }
              };
              update(initial);
              const run = footerActions.get(initial.action);
              if (!run) {
                throw new Error("Unregistered Quest footer action");
              }
              register(button, run);
              return { dispose() {}, element: button, slots: {}, update };
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
    card.body.replaceChildren(body, footer);
    if (!entry) {
      setScrollGroup(card, body);
    } else {
      card.body.classList.remove("ada-has-scroll");
    }
    modal.hidden = false;
    card.fit();
    layer = createModalLayer(modal);
    leave = layer.open({ close: back, focus: close }, card.frame);
  }
  return {
    back,
    close: hide,
    dispose(): void {
      disposed = true;
      for (const binding of [...bindings, ...renderedBindings]) {
        binding.dispose();
      }
      bindings.length = 0;
      renderedBindings.length = 0;
      hide();
      footerLayout?.dispose();
      bodyLayout?.dispose();
      card.dispose();
      modal.remove();
    },
    focus(): void {
      focusTarget(card.body.querySelector<HTMLButtonElement>(".ada-primary") ?? card.close);
    },
    isOpen: () => !modal.hidden,
    open(
      id: string | null = null,
      from: QuestOrigin = "list",
      dismissal?: Pick<QuestFooterData["dismiss"], "intent" | "label">,
    ): void {
      rootDismissal = dismissal ?? { intent: "close", label: labels.close };
      contextEntries = null;
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
      contextEntries = [...context.quests];
      selected = contextEntries.length === 1 ? contextEntries[0]!.id : null;
      origin = contextEntries.length === 1 ? "flight" : "list";
      listPage = 0;
      render();
      return true;
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
