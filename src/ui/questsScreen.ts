import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { createModalLayer } from "@andornaut/game-kit/web/ui/dom/modalLayer";

import type { GalaxyNumber } from "../data/types.ts";
import type { MapPlace } from "../model/map.ts";
import type { QuestEntry } from "../model/questDetails.ts";
import { units } from "./layout/css.ts";
import { chipFace, chipGlyph, type MapScreenLabels } from "./mapScreen.ts";
import { createButton, createCard } from "./modal.ts";

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

export const QUESTS_SCREEN_STYLE = `
.ada-controls .ada-quests-screen{padding:${units(12)};
  z-index:20}
.ada-controls .ada-quests-screen .ada-card-frame{width:100%;
  height:100%;
  min-height:0}
.ada-controls .ada-quests-screen .ada-card{width:100%!important;
  height:100%;
  padding:0 ${units(8)}}
.ada-controls .ada-quests-screen .ada-card header{margin-top:${units(4)};
  padding:0}
.ada-controls .ada-quests-screen .ada-card-body{overflow:visible;
  align-items:stretch;
  gap:${units(8)};
  margin-top:${units(8)};
  padding-bottom:${units(8)};
  flex:1;
  min-height:0}
.ada-controls .ada-quest-content{position:relative;
  flex:1;
  min-height:0;
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  grid-template-rows:minmax(0,1fr) auto;
  gap:${units(8)} ${units(16)};
  padding:${units(4)} ${units(8)} ${units(8)};
  background:#302e42;
  border:1px solid #777186}
.ada-controls .ada-quest-content::before{content:"";
  position:absolute;
  left:50%;
  top:${units(6)};
  bottom:${units(6)};
  width:1px;
  background:#777186}
.ada-controls .ada-quest-content section{min-width:0}
.ada-controls .ada-quest-content h3,.ada-controls .ada-quest-content p{font:inherit;
  margin:0;
  overflow-wrap:anywhere}
.ada-controls .ada-quest-content h3{color:#b8b3c9;
  font-weight:bold;
  margin-bottom:${units(4)}}
.ada-controls .ada-quest-description{margin-top:${units(8)}!important;
  color:#c0bbd0}
.ada-controls .ada-quest-route{display:grid;
  grid-template-columns:minmax(0,1fr) ${units(46)} minmax(0,1fr);
  gap:${units(4)};
  align-items:center;
  margin-top:${units(8)};
  padding:${units(8)};
  background:#262b44;
  border:1px solid #55516b}
.ada-controls .ada-quest-endpoint{display:flex;
  align-items:center;
  gap:${units(4)};
  min-width:0;
  color:inherit;
  font:inherit;
  text-align:left;
  background:none;
  border:0;
  padding:0;
  cursor:pointer}
.ada-controls .ada-quest-endpoint:disabled{opacity:1;
  cursor:default}
.ada-controls .ada-quest-endpoint>span{min-width:0;
  overflow-wrap:anywhere}
.ada-controls .ada-quest-endpoint small{display:block;
  font:inherit;
  color:#b8b3c9}
.ada-controls .ada-quest-icon{display:block;
  flex-shrink:0;
  width:${units(24)};
  height:${units(24)};
  padding:${units(2)};
  border-radius:50%;
  object-fit:contain;
  image-rendering:pixelated}
.ada-controls .ada-quest-arrow{display:block;
  width:${units(18)};
  height:${units(12)};
  margin:auto}
.ada-controls .ada-quest-footer{display:flex;
  justify-content:flex-end;
  gap:${units(8)};
  flex:none}
.ada-controls .ada-quest-footer .ada-button:first-child:not(:last-child){margin-right:auto}
.ada-controls .ada-quest-list{flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
  gap:${units(8)};
  overflow:visible}
.ada-controls .ada-quest-list .ada-button{display:flex;
  align-items:center;
  gap:${units(8)};
  white-space:normal;
  text-align:left;
  flex:none}
.ada-controls .ada-quest-requirement{display:flex;align-items:center;gap:${units(6)}}
.ada-controls .ada-quest-requirement input{width:${units(16)};height:${units(16)};margin:0;opacity:1}
.ada-controls .ada-quest-list h3{font:inherit;margin:0;color:#b8b3c9}
.ada-controls .ada-quests-screen .ada-card header h2{color:#ead4aa}
.ada-controls .ada-quest-content p{color:#ead4aa}
.ada-controls .ada-quest-objective>p:first-of-type,.ada-controls .ada-quest-reward p{font-weight:bold}
.ada-controls .ada-quest-objective .ada-quest-description{color:#c0bbd0}
`;

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
            svg.setAttribute("viewBox", "0 0 18 12");
            svg.setAttribute("class", "ada-quest-arrow");
            svg.setAttribute("aria-hidden", "true");
            for (const d of ["M0 5H10V7H0Z", "M10 0L18 6L10 12Z"]) {
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
      const pages = Math.max(1, Math.ceil(ordered.length / 2));
      listPage = Math.min(listPage, pages - 1);
      const visible = ordered.slice(listPage * 2, listPage * 2 + 2);
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
