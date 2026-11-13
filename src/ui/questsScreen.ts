import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { createModalLayer } from "@andornaut/game-kit/web/ui/dom/modalLayer";

import type { GalaxyNumber } from "../data/types.ts";
import type { MapPlace } from "../model/map.ts";
import type { QuestEntry } from "../model/questDetails.ts";
import { QUEST_LIST_PAGE_SIZE, QUEST_ROUTE_ARROW } from "./layout/questsScreen.ts";
import { chipFace, chipGlyph, type MapScreenLabels } from "./mapScreen.ts";
import { createButton, createCard, setFooterAction } from "./modal.ts";

export type QuestOrigin = "flight" | "list";

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
    full: true,
    title: labels.quests,
  });

  card.card.dataset.dialog = "quests";
  modal.append(card.frame);
  root.append(modal);
  let entries: readonly QuestEntry[] = [];
  let places: readonly MapPlace[] = [];
  let selected: string | null = null;
  let galaxy: GalaxyNumber | undefined;
  let origin: QuestOrigin = "list";
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
    modal.hidden = true;
  };
  const icon = (
    entry: QuestEntry,
    symbol = entry.locations.find((location) => location.symbol)?.symbol,
    job = Boolean(entry.jobType),
  ) => {
    if (!symbol && !entry.jobType) {
      return null;
    }
    const image = document.createElement("img");
    image.className = "ada-quest-icon";
    image.alt = "";
    const shape = {
      job,
      ...(job && entry.jobType ? { jobType: entry.jobType } : {}),
      symbol: symbol ?? ("station" as const),
    };
    image.style.background = chipFace(shape);
    const glyph = chipGlyph(shape);
    if (glyph) {
      image.src = `/art/ui/icons/${glyph}.svg`;
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
  card.close.addEventListener("click", back);
  function render(): void {
    release();
    const entry = entries.find((entry) => entry.id === selected);
    if (!entry) {
      selected = null;
    }
    const body = document.createElement("div");
    body.className = entry ? "ada-quest-content" : "ada-quest-list";
    const footer = document.createElement("footer");
    footer.className = "ada-quest-footer";
    const section = (name: string | undefined, text?: string) => {
      const section = document.createElement("section");
      if (name) {
        const heading = document.createElement("h3");
        heading.textContent = name;
        section.append(heading);
      }
      if (text) {
        const p = document.createElement("p");
        p.textContent = text;
        section.append(p);
      }
      body.append(section);
      return section;
    };
    if (entry) {
      const line = entry.line as QuestEntry["line"] & {
        readonly requirements?: readonly {
          readonly label: string;
          readonly checked?: boolean;
          readonly count?: string;
        }[];
      };
      const objective = section(labels.questObjective, line.text);
      objective.className = "ada-quest-objective";
      if (line.description && line.description !== line.text) {
        const description = document.createElement("p");
        description.className = "ada-quest-description";
        description.textContent = line.description;
        objective.append(description);
      }
      const next = section(labels.questNextAction, line.nextStep);
      const endpoints = questRoute(entry, entry.galaxy === galaxy ? places : []);
      if (line.source !== undefined || line.destination !== undefined || line.target !== null) {
        const route = document.createElement("div");
        route.className = "ada-quest-route";
        if (endpoints.length === 1) {
          route.style.gridTemplateColumns = "1fr";
        }
        for (const endpoint of endpoints) {
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
          button.disabled = endpoint.location === null || endpoint.place === null;
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
          if (endpoint.location && endpoint.place) {
            button.setAttribute(
              "aria-label",
              `${labels.questLocate ?? ""}: ${endpoint.location.label}`,
            );
            button.addEventListener("click", () => {
              hide();
              options.onLocate(endpoint.place!.id);
            });
          }
          route.append(button);
        }
        next.append(route);
      }
      const reward = section(
        line.outcome && !line.reward ? labels.questOutcome : labels.questReward,
        line.reward ?? line.outcome ?? labels.questStoryProgress,
      );
      reward.className = "ada-quest-reward";
      const progress = section(
        labels.questProgressLabel,
        line.requirements?.length ? undefined : line.progress,
      );
      for (const requirement of line.requirements ?? []) {
        const row = document.createElement("div");
        row.className = "ada-quest-requirement";
        if (requirement.checked !== undefined) {
          const check = document.createElement("input");
          check.type = "checkbox";
          check.checked = requirement.checked;
          check.disabled = true;
          check.setAttribute("aria-label", requirement.label);
          row.append(check);
        }
        const text = document.createElement("span");
        text.textContent = requirement.label;
        row.append(text);
        if (requirement.count) {
          const count = document.createElement("strong");
          count.textContent = requirement.count;
          row.append(count);
        }
        progress.append(row);
      }
      if (origin === "flight") {
        const others = createButton(labels.questOtherQuests ?? "", "secondary");
        others.dataset.action = "quest-other";
        others.addEventListener("click", () => {
          selected = null;
          render();
        });
        footer.append(others);
      }
    } else {
      const ordered = [
        ...entries.filter((entry) => entry.line.kind === "story"),
        ...entries.filter((entry) => entry.line.kind === "job"),
      ];
      const pages = Math.max(1, Math.ceil(ordered.length / QUEST_LIST_PAGE_SIZE));
      listPage = Math.min(listPage, pages - 1);
      const visible = ordered.slice(
        listPage * QUEST_LIST_PAGE_SIZE,
        (listPage + 1) * QUEST_LIST_PAGE_SIZE,
      );
      for (const kind of ["story", "job"] as const) {
        const group = visible.filter((entry) => entry.line.kind === kind);
        if (!group.length) {
          continue;
        }
        const heading = document.createElement("h3");
        heading.textContent =
          (kind === "story" ? labels.questsStoryHeading : labels.questsJobsHeading) ?? "";
        body.append(heading);
        for (const item of group) {
          const button = createButton(item.line.text, "secondary");
          button.dataset.questId = item.id;
          const image = icon(item);
          if (image) {
            button.prepend(image);
          }
          button.addEventListener("click", () => {
            selected = item.id;
            origin = "list";
            render();
          });
          body.append(button);
        }
      }
      if (pages > 1) {
        for (const direction of [-1, 1]) {
          const button = createButton(direction < 0 ? labels.previous : labels.next, "secondary");
          button.disabled = listPage + direction < 0 || listPage + direction >= pages;
          button.addEventListener("click", () => {
            listPage += direction;
            render();
          });
          footer.append(button);
        }
        const count = document.createElement("output");
        count.textContent = labels.page
          .replace("{page}", String(listPage + 1))
          .replace("{pages}", String(pages));
        footer.append(count);
      }
      if (!entries.length) {
        const text = document.createElement("p");
        text.textContent = labels.questsEmpty;
        body.append(text);
      }
    }
    const close = createButton(
      entry && origin === "list" ? (labels.questBack ?? labels.close) : labels.close,
      "primary",
    );
    close.dataset.action = entry && origin === "list" ? "quest-back" : "quest-close";
    close.addEventListener("click", back);
    footer.append(close);
    setFooterAction(entry && origin === "list" ? "back" : "close", footer);
    card.body.replaceChildren(body, footer);
    modal.hidden = false;
    layer = createModalLayer(modal);
    leave = layer.open({ close: back, focus: close }, card.frame);
  }
  return {
    back,
    close: hide,
    dispose(): void {
      hide();
      card.dispose();
      modal.remove();
    },
    focus(): void {
      focusTarget(card.body.querySelector<HTMLButtonElement>(".ada-primary") ?? card.close);
    },
    isOpen: () => !modal.hidden,
    open(id: string | null = null, from: QuestOrigin = "list"): void {
      selected = id;
      origin = from;
      render();
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
      if (signature !== revision && !modal.hidden) {
        render();
      }
      signature = revision;
    },
  };
}
