import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { CONTENT } from "../../data/content.ts";
import { EQUIPMENT_DESCRIPTIONS } from "../../data/equipmentDetails.ts";
import { RESOURCE_DESCRIPTIONS } from "../../data/resourceDescriptions.ts";
import type { GalaxyNumber } from "../../data/types.ts";
import { weaponDetailLines } from "../../data/weaponDetails.ts";
import type { LocalMap, MapPlace } from "../../model/map.ts";
import type { QuestEntry } from "../../model/questDetails.ts";
import type { ContextQuestDetails } from "../../model/questObjectLinks.ts";
import { assertAdaActionBindings, assertAdaActionMetadata } from "../actionBinding.ts";
import { compactLevelName } from "../compactLevelName.ts";
import { readViewUnit } from "../layout/dom.ts";
import { SCROLL } from "../layout/index.ts";
import { createMapScreen, type MapField, type MapScreenLabels } from "../map/index.ts";
import { createCard } from "../modal.ts";
import { createStandardCloseAction } from "../modalClose.ts";
import { createModalLayer } from "../modalLayer.ts";
import { retainModalUnderlay } from "../modalUnderlay.ts";
import { type PauseAction, pauseActions, type PausePlace } from "../pause.ts";
import type { QuestFlightLogEntry } from "../questsBodyTree.ts";
import { createQuestsScreen, type QuestOrigin } from "../questsScreen.ts";
import { refuse } from "../refusal.ts";
import { createResourceCard } from "../resource/index.ts";
import { shieldDetails } from "../shieldDetails.ts";
import {
  createShipPaintCard,
  disposeShipSections,
  renderShipSections,
  shipIconNode,
  type ShipPaintOptions,
  type ShipRow,
  shipSections,
  type ShipView,
} from "../ship/index.ts";
import { createStandardTextAction } from "../standardTextAction.ts";
import { createWeaponDetailCard } from "../weaponDetail/index.ts";
import { type PauseLayoutSchema, pauseTree, type PauseTreeAction } from "./pauseTree.ts";

export interface PauseLabels {
  readonly achievements: string;
  readonly backToTitle: string;
  readonly cheats: string;
  readonly close: string;
  readonly map: string;
  /** The full-screen map's own labels. */
  readonly mapScreen: MapScreenLabels;
  readonly resume: string;
  readonly settings: string;
  /** The Ship button and card title. */
  readonly ship: string;
  /** The Ship card's section headings. */
  readonly shipHeadings: {
    readonly ammo: string;
    readonly cargo: string;
    readonly equipment: string;
    readonly weapons: string;
  };
  /** Player copy for the Ship card's rows. */
  readonly shipRows: Readonly<Record<string, string>>;
  readonly title: string;
}

export interface PauseOptions {
  readonly paint?: ShipPaintOptions;
  readonly shipFrame?: (heading: number) => string | undefined;
  readonly labels: PauseLabels;
  readonly onAchievements: () => void;
  readonly onBackToTitle: () => void;
  readonly onCheats: () => void;
  readonly onOpenChange: (open: boolean) => void;
  /** Return to Earth, from the Map. */
  readonly onGalaxies: () => void;
  readonly onSettings: () => void;
  readonly onTravel: (destination: string) => void;
  readonly questTracking?: Parameters<typeof createQuestsScreen>[1]["tracking"];
  // Whether the player chose Reduced motion, which keeps the refusal cue still.
  readonly reducedMotion: () => boolean;
}

export interface PauseState {
  readonly navigation?: "pause" | "menu";
  readonly menuContext?: "start" | "nonplay";
  /** Canonical model permission; omitted permission keeps Map hidden. */
  readonly canMap?: boolean;
  readonly galaxy?: GalaxyNumber;
  /** Live model-owned quests from every galaxy, with no UI or save-state duplication. */
  readonly questEntries?: readonly QuestEntry[];
  readonly flightLog?: readonly QuestFlightLogEntry[];
  /** The current galaxy's map field: its name, background and fog. */
  readonly field: MapField | null;
  readonly inDanger: boolean;
  /** The held station job's objective for the Map, or null without one. */
  readonly job: string | null;
  /** The current galaxy's map, or null outside a flight. */
  readonly map: LocalMap | null;
  /** Where the card opens now: in flight, or nowhere. */
  readonly place: PausePlace | null;
  /** The Ship card's facts, or null outside a flight. */
  readonly ship: ShipView | null;
  readonly stardust: number | null;
  /** A rescue's tow line is attached: Travel here refuses. */
  readonly towing: boolean;
  /** A delivery's or a supply run's item is aboard: Travel here refuses. */
  readonly carrying: boolean;
}

const NO_MAP: LocalMap = {
  explored: [],
  facing: { x: 0, y: -1 },
  mapped: 0,
  places: [],
  player: { x: 0, y: 0 },
  quests: [],
  searchArea: null,
};

// An action stack: full-width actions a gap apart, filling the card's inner width.
function stack(): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "ada-actions ada-stack";
  group.dataset.inkTop = "0";
  return group;
}

// The Paused card (art/layout.md), its Ship card and its full-screen map (art/map.md), as in
// Chibi: one shows at a time, the cards over the dimmed game and the map in the dim's place. The
// X, an outside tap, back and Escape resume from the Paused card; from the Ship card and the map
// they return to the Paused card.
export function createPauseCards(root: HTMLElement, options: PauseOptions) {
  const { labels } = options;
  let disposed = false;
  const actionBindings: { dispose(): void }[] = [];
  const closeControl = (action: string, label: string, run: () => void) => {
    const close = createStandardCloseAction(root, action, label, {
      current: () => !disposed,
      run,
      slopPx: (button) => SCROLL.dragThreshold * readViewUnit(button),
      slopThreshold: SCROLL.dragThreshold,
    });
    actionBindings.push(close);
    return close.element;
  };
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const text: Record<PauseAction, string> = {
    achievements: labels.achievements,
    backToTitle: labels.backToTitle,
    cheats: labels.cheats,
    map: labels.map,
    quests: labels.mapScreen.quests,
    resume: labels.resume,
    settings: labels.settings,
    ship: labels.ship,
  };
  const ordered = pauseActions(text);
  const initialActions: readonly PauseTreeAction[] = ordered.map((action) => ({
    ...action,
    hidden: false,
    label: text[action.id],
  }));
  const initialTree = pauseTree({
    actions: initialActions,
    closeLabel: labels.close,
    title: labels.title,
  });
  const paused = createCard({
    close: closeControl(initialTree.props.closeAction, initialTree.props.closeLabel, resume),
    size: initialTree.props.size,
    title: initialTree.props.title,
  });
  paused.card.dataset.dialog = "pause";
  const actions = stack();
  const buttons = new Map<PauseAction, HTMLButtonElement>();
  paused.body.append(actions);
  // Every action is built once in flight reading order; each place shows its own actions.
  const pauseLayout = mountLayout<PauseLayoutSchema>(
    {
      components: {
        pause: {
          create() {
            return { dispose() {}, element: paused.frame, slots: { actions }, update() {} };
          },
          slots: ["actions"],
        },
        pauseButton: {
          create(initial) {
            let available = initial.available;
            const standard = createStandardTextAction(root, initial.label, {
              availability: (element) =>
                element?.disabled
                  ? { kind: "disabled" }
                  : element?.hidden
                    ? { kind: "omitted" }
                    : available
                      ? { kind: "available" }
                      : { kind: "unavailable", reason: "Action unavailable." },
              current: () => !disposed,
              refuse: () => refuse(button, options.reducedMotion()),
              run: () => act(initial.id),
              separateFace: true,
            });
            const button = standard.element;
            button.dataset.action = `pause-${initial.id}`;
            button.classList.toggle("ada-primary", initial.role === "primary");
            setButtonRole(initial.role, button);
            if (initial.id === "map" || initial.id === "resume") {
              button.querySelector(".ui-control-label")!.classList.add("ada-pause-cap-label");
            }
            buttons.set(initial.id, button);
            const update = (data: PauseTreeAction) => {
              available = data.available;
              button.hidden = data.hidden;
              standard.refresh();
            };
            update(initial);
            return { dispose: standard.dispose, element: button, slots: {}, update };
          },
          slots: [],
        },
      },
      host: modal,
    },
    initialTree,
  );
  const backLabel = labels.mapScreen.questBack ?? CONTENT.labels.questBack!;
  const ship = createCard({
    close: closeControl("close-ship", labels.close, closeShip),
    size: "large",
    title: labels.ship,
  });
  ship.card.dataset.dialog = "ship";
  ship.frame.hidden = true;
  const shipBackAction = createStandardTextAction(root, backLabel, {
    availability: () => ({ kind: "available" }),
    current: () => !disposed,
    run: closeShip,
    separateFace: true,
  });
  actionBindings.push(shipBackAction);
  const shipBack = shipBackAction.element;
  shipBack.classList.add("ada-primary");
  setButtonRole("primary", shipBack);
  shipBack.dataset.action = "back-ship";
  const shipFooter = document.createElement("footer");
  shipFooter.className = "ada-ship-back";
  shipFooter.append(shipBack);
  ship.card.append(shipFooter);
  modal.append(paused.frame, ship.frame);
  try {
    assertAdaActionMetadata(paused.frame);
    assertAdaActionMetadata(ship.frame);
    root.append(modal);
  } catch (error) {
    disposed = true;
    for (const binding of actionBindings) {
      binding.dispose();
    }
    pauseLayout.dispose();
    paused.dispose();
    ship.dispose();
    modal.remove();
    throw error;
  }
  const mapScreen = createMapScreen(root, {
    closeLabel: backLabel,
    labels: labels.mapScreen,
    onClose: () => closeMap(),
    // The galaxy map opens over the local map, which stays open beneath it.
    onGalaxies: () => options.onGalaxies(),
    onPlaceQuest: openPlaceQuest,
    onQuests: () => openQuests(),
    onTravel: (id) => {
      setOpen(false);
      options.onTravel(id);
    },
    reducedMotion: options.reducedMotion,
    shipFrame: (heading) => options.shipFrame?.(heading),
  });
  let questRoot: "map" | "flight" | "pause" | "ship" = "map";
  let returnToPlace: (() => void) | undefined;
  let shipDetailOrigin: HTMLElement | undefined;
  const questParentDismissal = {
    intent: "back" as const,
    label: backLabel,
  };
  const quests = createQuestsScreen(root, {
    labels: labels.mapScreen,
    onClose: () => {
      if (questRoot === "ship") {
        restoreShip();
      } else if (questRoot === "flight") {
        setOpen(false);
      } else if (questRoot === "map") {
        const restore = returnToPlace;
        returnToPlace = undefined;
        if (restore) {
          restore();
        } else {
          mapScreen.focusQuests();
        }
      } else {
        show("paused");
        const button = buttons.get("quests");
        if (button) {
          focusTarget(button);
        }
      }
    },
    onLocate: (id) => {
      if (!mapScreen.isOpen()) {
        show("map");
      }
      mapScreen.locate(id);
    },
    reducedMotion: options.reducedMotion,
    ...(options.questTracking ? { tracking: options.questTracking } : {}),
  });
  let open = false;
  let mapOpener: "map" | "quests" = "map";
  let state: PauseState = {
    carrying: false,
    field: null,
    inDanger: false,
    job: null,
    map: null,
    place: null,
    ship: null,
    stardust: null,
    towing: false,
  };
  let layer: ReturnType<typeof createModalLayer> | undefined;
  let leaveLayer: (() => void) | undefined;
  let releaseUnderlay: (() => void) | undefined;
  // Map is hidden, not disabled, while the model does not permit it.
  const actionsHere = () =>
    ordered.filter((action) => action.id !== "map" || state.canMap === true);
  const mapOpen = () => open && mapScreen.isOpen();
  const shipOpen = () => open && !ship.frame.hidden;
  // The map shows in the cards' and the dim's place; the Ship card in the Paused card's.
  const show = (view: "map" | "paused" | "ship", retainPause = false) => {
    releaseUnderlay?.();
    releaseUnderlay = undefined;
    leaveLayer?.();
    leaveLayer = undefined;
    layer?.dispose();
    layer = undefined;
    modal.hidden = view === "map";
    paused.frame.hidden = view !== "paused";
    ship.frame.hidden = view !== "ship";
    for (const frame of [paused.frame, ship.frame]) {
      if (frame.hidden) {
        frame.setAttribute("inert", "");
      } else {
        frame.removeAttribute("inert");
      }
    }
    if (view === "map") {
      mapScreen.open();
      return;
    }
    mapScreen.close();
    if (view === "ship") {
      renderShip();
      assertAdaActionBindings(ship.frame);
      layer = createModalLayer(modal);
      leaveLayer = layer.open({ close: closeShip, focus: shipBack }, ship.frame);
      return;
    }
    assertAdaActionBindings(paused.frame);
    paused.fit();
    if (retainPause) {
      hidePause(true);
      return;
    }
    // Focus starts on the primary Resume, else the first action shown.
    const focus =
      actions.querySelector<HTMLButtonElement>(".ada-primary:not([hidden])") ??
      actions.querySelector<HTMLButtonElement>("button:not([hidden])") ??
      paused.close;
    layer = createModalLayer(modal);
    leaveLayer = layer.open({ close: resume, focus }, paused.frame);
  };
  const restoreShip = () => {
    if (open && shipOpen()) {
      show("ship");
      if (shipDetailOrigin?.isConnected) {
        focusTarget(shipDetailOrigin);
      }
    }
  };
  const detailOptions = {
    backLabel,
    closeLabel: labels.close,
    onOpenChange: (visible: boolean) => {
      if (!visible) {
        restoreShip();
      }
    },
  };
  const shipResource = createResourceCard(root, detailOptions);
  const shipWeapon = createWeaponDetailCard(root, detailOptions);
  const openShipItem = (row: ShipRow, origin: HTMLButtonElement) => {
    const view = state.ship;
    if (!view || !shipOpen()) {
      return;
    }
    shipDetailOrigin = origin;
    hidePause(true);
    if (row.item.kind === "weapon") {
      const id = row.item.id;
      const weapon = view.weapons.find((weapon) => weapon.id === id);
      if (!weapon) {
        restoreShip();
        return;
      }
      shipWeapon.open(row.label, weaponDetailLines(weapon.id, weapon.level), origin, {
        ammo: weapon.ammo,
        ammoLabel: labels.shipHeadings.ammo,
        id: weapon.id,
        level: weapon.level,
      });
    } else if (
      row.item.kind === "cargo" &&
      row.questId &&
      state.questEntries?.some(({ id }) => id === row.questId)
    ) {
      questRoot = "ship";
      quests.open(row.questId, "ship", questParentDismissal);
    } else {
      let title = compactLevelName(row.tier, row.label);
      let text = row.level ?? "";
      let quantity = row.count;
      if (row.item.kind === "resource") {
        text = RESOURCE_DESCRIPTIONS[row.item.id];
      } else if (row.item.kind === "cargo") {
        if (row.item.id === "holodisks") {
          text = labels.shipRows.holodiskAbout ?? "";
        } else {
          title = row.count ?? row.label;
          quantity = undefined;
        }
      } else if (row.item.kind === "equipment" && row.item.id !== "paint") {
        text = EQUIPMENT_DESCRIPTIONS[row.item.id];
        if (row.item.id === "shield" && view.shieldHealth) {
          const shield = shieldDetails(row.label, { ...view.shieldHealth, level: view.shield });
          text = `${text} ${shield.text}`;
          quantity = shield.quantity;
        }
      }
      shipResource.open(title, text, origin, {
        icon: shipIconNode(row.icon),
        ...(quantity ? { quantity } : {}),
      });
    }
  };
  // What the Ship card last showed, so its rows rebuild only on a change.
  let shipShown: string | undefined;
  let shipRows: HTMLElement | undefined;
  const renderShip = () => {
    const sections = state.ship ? shipSections(labels.shipRows, state.ship) : null;
    const signature = JSON.stringify(sections);
    if (signature !== shipShown) {
      shipShown = signature;
      if (shipRows) {
        disposeShipSections(shipRows);
      }
      shipRows = sections
        ? renderShipSections(labels.shipHeadings, sections, openShipRow)
        : undefined;
      ship.body.replaceChildren(...(shipRows ? [shipRows] : []));
      if (shipRows) {
        assertAdaActionBindings(shipRows);
      }
    }
    ship.fit();
  };
  const shipPaint = options.paint
    ? createShipPaintCard(root, {
        ...options.paint,
        backLabel,
        closeLabel: labels.close,
        onClose: () => {
          if (shipOpen()) {
            show("ship");
            const opener = shipRows?.querySelector<HTMLButtonElement>(
              '[data-item="equipment:paint"]',
            );
            if (opener) {
              focusTarget(opener);
            }
          }
        },
      })
    : undefined;
  const openShipRow = (row: ShipRow, origin: HTMLButtonElement) => {
    if (shipPaint && row.item.kind === "equipment" && row.item.id === "paint" && shipOpen()) {
      hidePause(true);
      shipPaint.open();
    } else {
      openShipItem(row, origin);
    }
  };
  const setOpen = (value: boolean) => {
    if (value === open) {
      return;
    }
    open = value;
    if (!value) {
      releaseUnderlay?.();
      releaseUnderlay = undefined;
      paused.frame.removeAttribute("inert");
      ship.frame.removeAttribute("inert");
    }
    modal.hidden = !value;
    shown = undefined;
    shipShown = undefined;
    if (value) {
      render();
      show("paused");
    } else {
      leaveLayer?.();
      leaveLayer = undefined;
      layer?.dispose();
      layer = undefined;
      quests.close();
      returnToPlace = undefined;
      shipResource.close();
      shipWeapon.close();
      shipPaint?.close();
      mapScreen.close();
    }
    options.onOpenChange(value);
  };
  function resume(): void {
    setOpen(false);
  }
  // What the card last showed. Rendering only on a change keeps each button's node across
  // frames, so a press is never lost to a rebuilt button.
  let shown: string | undefined;
  const render = () => {
    quests.setState(
      state.questEntries ?? [],
      state.map?.places ?? [],
      state.galaxy,
      state.flightLog,
    );
    mapScreen.setState({
      carrying: state.carrying,
      field: state.field,
      inDanger: state.inDanger,
      job: state.job,
      map: state.map ?? NO_MAP,
      stardust: state.stardust,
      towing: state.towing,
    });
    const signature = JSON.stringify([state.place, state.canMap]);
    if (signature === shown) {
      return;
    }
    shown = signature;
    const here = new Map(actionsHere().map((view) => [view.id, view]));
    pauseLayout.update(
      pauseTree({
        actions: initialActions.map((action) => ({
          ...action,
          available: here.get(action.id)?.available ?? true,
          hidden: !here.has(action.id),
        })),
        closeLabel: labels.close,
        title: labels.title,
      }),
    );
    if (open && !mapScreen.isOpen()) {
      paused.fit();
    }
  };
  const renderAll = () => {
    render();
    if (shipOpen()) {
      renderShip();
    }
  };
  function hidePause(retain = false): void {
    if (retain && !modal.hidden) {
      releaseUnderlay?.();
      releaseUnderlay = retainModalUnderlay(modal);
    }
    leaveLayer?.();
    leaveLayer = undefined;
    layer?.dispose();
    layer = undefined;
    modal.hidden = true;
    mapScreen.close();
  }
  function openPlaceQuest(place: MapPlace): void {
    if (quests.isSuspended()) {
      closeMap();
      return;
    }
    const linked = (state.questEntries ?? []).filter(({ id }) =>
      place.questLinks?.some((quest) => quest.id === id),
    );
    if (linked.length) {
      questRoot = "map";
      returnToPlace = mapScreen.questReturn();
      quests.openContext({ quests: linked, targetId: place.id }, questParentDismissal);
    }
  }
  function openQuests(opener: "map" | "quests" = "map"): void {
    if (opener === "map" && quests.isSuspended()) {
      closeMap();
      return;
    }
    mapOpener = opener;
    questRoot = opener === "quests" ? "pause" : "map";
    setOpen(true);
    if (questRoot === "map") {
      if (!mapScreen.isOpen()) {
        show("map");
      }
    } else {
      hidePause(true);
    }
    quests.open(null, "list", questParentDismissal);
  }
  function openQuest(id: string, origin: QuestOrigin): void {
    questRoot = origin === "flight" ? "flight" : "map";
    setOpen(true);
    if (questRoot === "flight") {
      hidePause();
    } else if (!mapScreen.isOpen()) {
      show("map");
    }
    quests.open(id, origin, questRoot === "flight" ? undefined : questParentDismissal);
  }
  const act = (id: PauseAction) => {
    const button = buttons.get(id)!;
    if (!actionsHere().find((view) => view.id === id)?.available) {
      refuse(button, options.reducedMotion());
      return;
    }
    if (id === "resume") {
      resume();
    } else if (id === "map") {
      mapOpener = "map";
      show("map");
    } else if (id === "quests") {
      openQuests("quests");
    } else if (id === "ship") {
      show("ship");
    } else if (id === "achievements") {
      hidePause(true);
      options.onAchievements();
    } else if (id === "cheats") {
      hidePause(true);
      options.onCheats();
    } else if (id === "settings") {
      // Settings opens in the Paused card's place; closing it returns here (reopen).
      hidePause(true);
      options.onSettings();
    } else {
      setOpen(false);
      options.onBackToTitle();
    }
  };
  // The Ship card's X, back and Escape return to the Paused card, on its Ship button.
  function closeShip(): void {
    if (shipPaint?.isOpen()) {
      shipPaint.close();
      return;
    }
    if (shipResource.isOpen()) {
      shipResource.close();
      return;
    }
    if (shipWeapon.isOpen()) {
      shipWeapon.close();
      return;
    }
    if (questRoot === "ship" && quests.isOpen()) {
      quests.back();
      return;
    }
    if (shipOpen()) {
      show("paused");
      const shipButton = buttons.get("ship");
      if (shipButton) {
        focusTarget(shipButton);
      }
    }
  }
  // Back and Escape close the Quests modal first, then the map.
  function closeMap(): void {
    if (quests.isOpen()) {
      quests.back();
      return;
    }
    if (mapOpen()) {
      if (quests.isSuspended()) {
        if (questRoot === "pause") {
          show("paused", true);
        } else if (questRoot !== "map") {
          mapScreen.close();
        }
        quests.resume();
        return;
      }
      show("paused");
      const mapButton = buttons.get(mapOpener);
      if (mapButton && !mapButton.hidden) {
        focusTarget(mapButton);
      }
    }
  }
  return {
    close: () => {
      if (quests.isOpen()) {
        quests.back();
      } else {
        resume();
      }
    },
    closeMap,
    closeShip,
    dispose(): void {
      releaseUnderlay?.();
      releaseUnderlay = undefined;
      disposed = true;
      for (const binding of actionBindings) {
        binding.dispose();
      }
      if (shipRows) {
        disposeShipSections(shipRows);
      }
      layer?.dispose();
      pauseLayout.dispose();
      paused.dispose();
      shipResource.dispose();
      shipWeapon.dispose();
      shipPaint?.dispose();
      ship.dispose();
      quests.dispose();
      mapScreen.dispose();
      modal.remove();
    },
    /** The local map's Galaxies takes focus again once the galaxy map over it closes. */
    focusGalaxies(): void {
      if (mapOpen()) {
        mapScreen.focusGalaxies();
      }
    },
    isOpen: () => open,
    mapOpen,
    open: () => setOpen(true),
    openContextQuests(context: ContextQuestDetails): boolean {
      if (!context.quests.length) {
        return false;
      }
      questRoot = "flight";
      setOpen(true);
      hidePause();
      return quests.openContext(context);
    },
    openQuest,
    openQuests,
    restorePaused: (opener: PauseAction) => {
      if (open) {
        show("paused");
      } else {
        setOpen(true);
      }
      const target = buttons.get(opener);
      if (target && !target.hidden) {
        focusTarget(target);
      }
    },
    setState(next: PauseState): void {
      state = next;
      renderAll();
    },
    shipOpen,
  };
}
