import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";
import { REFUSAL_ATTRIBUTES } from "@andornaut/game-kit/runtime/web/ui/dom/refusalCue";

import type { MapSymbol } from "../data/destinations.ts";
import { TASK_COLORS, type TaskCategory } from "../data/taskCategories.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import type { MapPlace } from "../model/map.ts";
import type { QuestEntry, QuestObjective } from "../model/questDetails.ts";
import { assertAdaActionBindings, assertAdaActionMetadata } from "./actionBinding.ts";
import { createCompletionIndicator } from "./completionIndicator.ts";
import { readViewUnit } from "./layout/dom.ts";
import { COLOURS, QUEST_LIST_PAGE_SIZE, QUEST_ROUTE_ARROW, SCROLL } from "./layout/index.ts";
import { chipFace, chipGlyph, type MapScreenLabels } from "./map/index.ts";
import { createCard, setFooterAction, setScrollGroup } from "./modal.ts";
import { createStandardCloseAction } from "./modalClose.ts";
import { createModalLayer } from "./modalLayer.ts";
import { inCurrentView } from "./pressScope.ts";
import {
  type QuestFlightLogEntry,
  type QuestsBodyData,
  type QuestsBodySchema,
  questsBodyTree,
} from "./questsBodyTree.ts";
import {
  type QuestFooterAction,
  type QuestFooterData,
  type QuestsFooterSchema,
  questsTree,
} from "./questsTree.ts";
import { refuse } from "./refusal.ts";
import { spriteIconPath } from "./spriteIconPath.ts";
import { createStandardTextAction } from "./standardTextAction.ts";
import { CARGO_ICONS } from "./statusPill.ts";

export type QuestOrigin = "flight" | "list" | "ship";
const FLIGHT_LOG_LABEL = "Flight log";
const TRACK_QUEST_LABEL = "Track quest";

interface LocatedEndpoint {
  readonly kind: "source" | "target";
  readonly placeId: string;
}

/** Use the current visible map objective when the story has no authored route. */
export function questRoute(entry: QuestEntry, places: readonly MapPlace[]) {
  const { line } = entry;
  const mapObjective =
    line.kind === "story" && line.destination === undefined && line.target === null
      ? places.find(({ objective }) => objective)
      : undefined;
  return [
    ...(line.source === undefined ? [] : [{ id: line.source, kind: "source" as const }]),
    {
      id:
        line.destination === undefined
          ? (line.target ?? mapObjective?.id ?? null)
          : line.destination,
      kind: "target" as const,
    },
  ].map(({ id, kind }) => ({
    kind,
    location:
      mapObjective && kind === "target"
        ? { id: mapObjective.id, label: mapObjective.label, symbol: mapObjective.symbol }
        : (entry.locations.find((location) => location.id === id) ?? null),
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
    readonly reducedMotion: () => boolean;
    readonly tracking?: {
      readonly canTrack: (questId: string) => boolean;
      readonly current?: () => string | null;
      readonly track: (questId: string) => boolean;
    };
  },
) {
  const { labels, tracking } = options;
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
  const renderedBindings: { dispose(): void }[] = [];
  let bodyLayout: ReturnType<typeof mountLayout<QuestsBodySchema>> | undefined;
  let footerLayout: ReturnType<typeof mountLayout<QuestsFooterSchema>> | undefined;
  let entries: readonly QuestEntry[] = [];
  let flightLog: readonly QuestFlightLogEntry[] = [];
  let showingFlightLog = false;
  let contextEntries: readonly QuestEntry[] | null = null;
  let places: readonly MapPlace[] = [];
  let selected: string | null = null;
  let renderedTrackId: string | null = null;
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
    showingFlightLog = false;
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
  const trackableQuestId = (): string | null => {
    if (!tracking || selected === null || showingFlightLog) {
      return null;
    }
    const entry = (contextEntries ?? entries).find((quest) => quest.id === selected);
    return entry?.line.kind === "job" && entry.galaxy === galaxy && tracking.canTrack(entry.id)
      ? entry.id
      : null;
  };
  const back = () => {
    if (showingFlightLog) {
      showingFlightLog = false;
      render({ flightLog: true });
    } else if (selected !== null && origin === "list") {
      const focusQuestId = selected;
      selected = null;
      render({ questId: focusQuestId });
    } else {
      hide();
      options.onClose();
    }
  };
  function render(
    focus: { questId?: string; endpoint?: LocatedEndpoint; flightLog?: boolean } = {},
  ): void {
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
    const title = showingFlightLog ? FLIGHT_LOG_LABEL : labels.quests;
    card.title.textContent = title;
    card.frame.setAttribute("aria-label", title);
    const body = document.createElement("div");
    body.className = entry ? "ada-quest-content" : "ada-quest-list";
    if (showingFlightLog) {
      body.tabIndex = 0;
      body.setAttribute("role", "region");
      body.setAttribute("aria-label", FLIGHT_LOG_LABEL);
    }
    const footer = document.createElement("footer");
    footer.className = "ada-quest-footer";
    footer.classList.toggle("ada-flight-log-footer", showingFlightLog);
    const footerActions = new Map<QuestFooterAction, () => void>();
    let other: QuestFooterData["other"];
    let pager: QuestFooterData["pager"];
    let bodyData: QuestsBodyData;
    const offersFlightLog =
      !showingFlightLog &&
      !entry &&
      contextEntries === null &&
      origin !== "ship" &&
      flightLog.length > 0;
    if (showingFlightLog) {
      bodyData = { entries: flightLog, mode: "flightLog" };
    } else if (entry) {
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
        ...(line.source !== undefined ||
        line.destination !== undefined ||
        line.target !== null ||
        endpoints.some(({ place }) => place !== null)
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
      if (offersFlightLog) {
        footerActions.set("flightLog", () => {
          showingFlightLog = true;
          render();
        });
      }
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
            const targetPage = listPage + direction;
            if (targetPage < 0 || targetPage >= pages) {
              return;
            }
            listPage = targetPage;
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
          log: {
            create() {
              const list = document.createElement("ul");
              list.className = "ada-flight-log-entries";
              list.setAttribute("role", "list");
              return { dispose() {}, element: list, slots: { entries: list }, update() {} };
            },
            slots: ["entries"],
          },
          logEntry: {
            create(initial) {
              const row = document.createElement("li");
              row.dataset.flightLogId = initial.id;
              row.textContent = initial.text;
              return { dispose() {}, element: row, slots: {}, update() {} };
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
              const tracked = tracking?.current?.() === item.id;
              const label = tracked ? `${item.line.text} · Tracked` : item.line.text;
              const action = createStandardTextAction(root, label, {
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
              if (item.id === focus.questId) {
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
                    path.setAttribute("fill", COLOURS.supporting);
                    svg.append(path);
                  }
                  route.append(svg);
                }
                const placeId = endpoint.place?.id;
                const disabled =
                  origin === "ship" || endpoint.location === null || placeId === undefined;
                const direction =
                  (endpoint.kind === "source" ? labels.questFrom : labels.questTo) ?? "";
                const location = endpoint.location?.label ?? labels.questExplore ?? "";
                const name = `${direction} ${location}`.trim();
                // Ship shows route context without offering Map navigation.
                const pointerRefusal = disabled && origin !== "ship" && name !== "";
                let stopRefusal: (() => void) | undefined;
                const action = createStandardTextAction(root, name || labels.quests, {
                  availability: (element) =>
                    pointerRefusal
                      ? { kind: "unavailable", reason: location || name }
                      : { kind: disabled || element.disabled ? "disabled" : "available" },
                  current: (): boolean => !disposed && !modal.hidden && inCurrentView(root, button),
                  pointerRefusal,
                  ...(pointerRefusal
                    ? {
                        refuse: () => {
                          focusTarget(card.frame);
                          if (
                            !button.hasAttribute(REFUSAL_ATTRIBUTES.red) &&
                            !button.hasAttribute(REFUSAL_ATTRIBUTES.shake)
                          ) {
                            stopRefusal = refuse(button, options.reducedMotion());
                          }
                        },
                      }
                    : {}),
                  run: () => {
                    if (disabled || placeId === undefined) {
                      return;
                    }
                    suspended = { kind: endpoint.kind, placeId };
                    release();
                    modal.hidden = true;
                    options.onLocate(placeId);
                  },
                });
                const button = action.element;
                // Keep the route's compound content and layout on the Kit-owned button.
                button.className = "ada-quest-endpoint";
                button.replaceChildren();
                renderedBindings.push({
                  dispose() {
                    action.dispose();
                    stopRefusal?.();
                  },
                });
                if (endpoint.location?.symbol) {
                  const image = icon(entry, endpoint.location.symbol, endpoint.place?.taskCategory);
                  if (image) {
                    button.append(image);
                  }
                }
                const text = document.createElement("span");
                const small = document.createElement("small");
                small.textContent = direction;
                text.append(small, document.createTextNode(location));
                button.append(text);
                if (origin !== "ship" && endpoint.location && endpoint.place) {
                  button.setAttribute(
                    "aria-label",
                    `${labels.questLocate ?? ""}: ${endpoint.location.label}`,
                  );
                }
                if (
                  !disabled &&
                  focus.endpoint?.kind === endpoint.kind &&
                  focus.endpoint.placeId === placeId
                ) {
                  questFocus = button;
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
    const trackId = trackableQuestId();
    renderedTrackId = trackId;
    if (tracking && trackId !== null) {
      footerActions.set("track", () => {
        if (
          trackableQuestId() === trackId &&
          tracking.track(trackId) &&
          !modal.hidden &&
          selected === trackId
        ) {
          back();
        }
      });
    }
    const detailBack = showingFlightLog || (entry && origin === "list");
    const footerData: QuestFooterData = {
      dismiss: detailBack
        ? { actionId: "quest-back", intent: "back", label: labels.questBack ?? labels.close }
        : { actionId: "quest-close", ...rootDismissal },
      ...(offersFlightLog ? { flightLog: { label: FLIGHT_LOG_LABEL } } : {}),
      ...(other === undefined ? {} : { other }),
      ...(pager === undefined ? {} : { pager }),
      ...(trackId === null ? {} : { track: { label: TRACK_QUEST_LABEL } }),
    };
    footerActions.set("dismiss", back);
    const footerRun = (action: QuestFooterAction) => {
      const run = footerActions.get(action);
      if (!run) {
        throw new Error("Unregistered Quest footer action");
      }
      return run;
    };
    let close!: HTMLButtonElement;
    footerLayout = mountLayout<QuestsFooterSchema>(
      {
        components: {
          button: {
            create: (initial) => {
              const run = footerRun(initial.action);
              let props = initial;
              const paginates = initial.action === "previous" || initial.action === "next";
              let stopRefusal: (() => void) | undefined;
              const action = createStandardTextAction(root, initial.label, {
                availability: () => {
                  if (initial.action === "track" && trackableQuestId() !== trackId) {
                    return { kind: "disabled" };
                  }
                  return props.disabled
                    ? paginates
                      ? { kind: "unavailable", reason: "Action unavailable." }
                      : { kind: "disabled" }
                    : { kind: "available" };
                },
                current: () => !disposed && !modal.hidden && inCurrentView(root, action.element),
                pointerRefusal: paginates,
                ...(paginates
                  ? {
                      refuse: () => {
                        focusTarget(card.frame);
                        if (
                          !button.hasAttribute(REFUSAL_ATTRIBUTES.red) &&
                          !button.hasAttribute(REFUSAL_ATTRIBUTES.shake)
                        ) {
                          stopRefusal = refuse(button, options.reducedMotion());
                        }
                      },
                    }
                  : {}),
                run,
              });
              const button = action.element;
              if (initial.actionId !== undefined) {
                button.dataset.action = initial.actionId;
              }
              if (initial.action === "dismiss") {
                close = button;
              }
              if (initial.action === "flightLog" && focus.flightLog) {
                questFocus = button;
              }
              const update = (data: QuestsFooterSchema["button"]["props"]) => {
                if (data.label !== props.label) {
                  action.setLabel(data.label);
                }
                props = data;
                button.classList.toggle("ada-primary", data.role === "primary");
                setButtonRole(data.role, button);
                action.refresh();
              };
              update(initial);
              return {
                dispose() {
                  action.dispose();
                  stopRefusal?.();
                },
                element: button,
                slots: {},
                update,
              };
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
      showingFlightLog = false;
      suspended = undefined;
      selected = id;
      origin = from;
      render();
    },
    /** Entries come from the canonical model getter; no object association is inferred here. */
    openContext(
      context: { readonly targetId: string; readonly quests: readonly QuestEntry[] } | null,
      dismissal?: Pick<QuestFooterData["dismiss"], "intent" | "label">,
    ): boolean {
      if (!context?.quests.length) {
        return false;
      }
      rootDismissal = dismissal ?? { intent: "close", label: labels.close };
      suspended = undefined;
      contextEntries = [...context.quests];
      showingFlightLog = false;
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
        render({ endpoint });
      }
    },
    setState(
      next: readonly QuestEntry[],
      knownPlaces: readonly MapPlace[],
      currentGalaxy?: GalaxyNumber,
      nextFlightLog: readonly QuestFlightLogEntry[] = [],
    ): void {
      const revision = JSON.stringify([
        next,
        knownPlaces,
        currentGalaxy,
        nextFlightLog,
        tracking?.current?.(),
      ]);
      flightLog = nextFlightLog;
      if (!flightLog.length) {
        showingFlightLog = false;
      }
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
      if (!modal.hidden && (signature !== revision || renderedTrackId !== trackableQuestId())) {
        render();
      }
      signature = revision;
    },
  };
}
