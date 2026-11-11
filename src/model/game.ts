import {
  CONVERSATION_TUNING,
  CONVERSATIONS,
  GENERAL_NAMED,
  type Mood,
  SPEAKERS,
} from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { PROJECT_THANKS, PROJECTS } from "../data/projects.ts";
import { SCREEN } from "../data/screen.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import type { PrototypeContent, SectorId, Weapon } from "../data/types.ts";
import { capitalInSight, ConversationDirector, pennyPoints, speakerName } from "./conversations.ts";
import { carriesStardust } from "./drops.ts";
import {
  activateRouteEncounter,
  createFlight,
  ensureDestination,
  ensureRouteEncounter,
  ensureStation,
  placeDestinationAhead,
  routeBlocked,
  settleRouteEncounters,
  stepFlight,
  syncFlightRegion,
  teleport as teleportFlight,
  undockFlight,
} from "./flight.ts";
import {
  INDICATOR_SOURCES,
  type IndicatorTarget,
  indicatorTargets,
  objectiveDestination,
  questItemDestination,
} from "./indicators.ts";
import { type GalaxyMap, galaxyMap, NO_LANDMARKS } from "./map.ts";
import {
  donate,
  type DonationResult,
  projectAllies,
  projectsOffered,
  type ProjectView,
  projectViews,
  worldChanges,
} from "./projects.ts";
import { restoreSave } from "./save.ts";
import {
  buy,
  fill,
  type PurchaseRequest,
  type PurchaseResult,
  requestPurchase,
  selectPaint,
  type ShopItem,
  type ShopRow,
  shopRows,
  type ShopTab,
} from "./shop.ts";
import {
  advance,
  boardingScene,
  canGoBack,
  currentPage,
  goBack,
  jumpHomeScene,
  openingScene,
  prologueScene,
  resolutionScene,
  roomScene,
  type Scene,
  shownChoices,
  skip,
  type StoryChoice,
  type StoryLabels,
  type StoryPage,
  type StoryPosition,
  storyStart,
} from "./storybook.ts";
import type { FlightEvent, FlightInput, GameState, SectorProgress } from "./types.ts";
import { newEconomy, shipTuning } from "./upgrades.ts";
import {
  ownedForSave,
  ownedWeapons,
  selectFlightWeapon,
  type WeaponChoice,
  weaponsLocked,
} from "./weapons.ts";

export function newProgress(): SectorProgress {
  return {
    deposited: 0,
    disabledEnemies: 0,
    discoveries: 0,
    donated: {},
    holodisk: false,
    introduced: false,
    known: [],
    opened: false,
    questComplete: false,
    questItem: null,
    resolved: false,
    stage: 0,
    stations: [],
  };
}
const progress = newProgress;
/** A first launch: galaxy one unlocked and nothing begun. */
export function newGameState(): GameState {
  return {
    announceGalaxy: false,
    dialogue: null,
    docked: null,
    economy: newEconomy(ECONOMY),
    flight: null,
    mode: "home",
    notice: "",
    progress: { 1: progress(), 2: progress(), 3: progress() },
    prologueSeen: false,
    seenConversations: [],
    selectedSector: 1,
    started: false,
    unlocked: [1],
    version: 1,
  };
}
/** Galaxies one to four in galaxy selection; galaxy four's story is in development. */
export const GALAXY_COUNT = 4;
/** What the home half shows: the start screen, a storybook page or galaxy selection. */
export type Screen = "selector" | "space" | "start" | "story";
export interface StoryView {
  readonly page: StoryPage;
  readonly canGoBack: boolean;
  /** The choices shown: a choice page's, or the optional questions not yet asked. */
  readonly choices: readonly StoryChoice[];
}
const required: Record<SectorId, readonly string[]> = {
  1: ["growers", "workshop", "salvagers", "workshop"],
  2: ["hub", "hub", "miner", "visitors", "hub"],
  3: ["whale", "whale", "whale", "family", "whale"],
};

/** A galaxy's story destinations in the order its route first visits them; the first opens it. */
export function galaxyRoute(sector: SectorId): readonly string[] {
  return [...new Set(required[sector])];
}
const first = (sector: SectorId): string => galaxyRoute(sector)[0]!;
const dialogueKeys: Record<string, string> = { growers: "grower", salvagers: "salvager" };

/** The conversation line the box shows, with its speaker's name tab and portrait side. */
export interface ConversationView {
  /** Seconds the line has shown, which times a speaking loop. */
  readonly elapsed: number;
  /** Changes with each line, so the box can restart its entrance. */
  readonly key: string;
  /** Ada's or Penny's portrait mood; neutral when the line names none. */
  readonly mood: Mood;
  readonly name: string;
  /** Whether the General's tab reads his name, which switches his portrait's frame set. */
  readonly named: boolean;
  readonly side: "left" | "right";
  readonly speaker: keyof typeof SPEAKERS;
  readonly text: string;
  readonly desktop?: string;
}

export class GameModel {
  state: GameState;
  /** The last flight step's events, for view effects; empty when no step ran. */
  flightEvents: readonly FlightEvent[] = [];
  private readonly content: PrototypeContent;
  private readonly talk: ConversationDirector;
  private noticeShownFor = 0;
  private previousSeed = 0;
  // The home half's place is not saved: a launch at home shows the start screen, and Continue
  // rebuilds any waiting scene from story progress.
  private startShown: boolean;
  private story: StoryPosition | null = null;
  private selection: number | null = null;
  constructor(content: PrototypeContent, saved?: unknown) {
    this.content = content;
    this.state = restoreSave(saved) ?? newGameState();
    this.startShown = this.state.mode === "home";
    this.talk = new ConversationDirector(
      [...CONVERSATIONS, ...PROJECT_THANKS],
      this.state.seenConversations,
    );
    if (this.state.mode === "space" && this.state.flight) {
      this.beginConversations();
    }
  }
  /**
   * A notice shows at once in the conversation box's slot, ahead of every line but a warning's
   * (BOX_PRIORITIES); lower lines wait under it and resume after. A warning interrupts a notice,
   * which resumes after it. A game notice clears after a line's time shown in flight.
   */
  private notify(text: string): void {
    this.state.notice = text;
    this.noticeShownFor = 0;
  }
  /** A tap on a game notice dismisses it at once; lines waiting under it resume. */
  dismissNotice(): void {
    this.state.notice = "";
  }
  private get noticeShowing(): boolean {
    return this.state.notice !== "";
  }
  /** A warning shows in the box, over any notice. */
  get warningShowing(): boolean {
    return this.state.mode === "space" && this.talk.warningShowing;
  }
  /** The line the conversation box shows now, if any: a warning's, or another with no notice. */
  get conversation(): ConversationView | null {
    const showing = this.talk.showing;
    if (
      !showing ||
      this.state.mode !== "space" ||
      (this.noticeShowing && !this.talk.warningShowing)
    ) {
      return null;
    }
    const { desktop, mood = "neutral", speaker, text } = showing.line;
    const name = speakerName(this.state.progress, speaker);
    return {
      ...(desktop === undefined ? {} : { desktop }),
      elapsed: showing.elapsed,
      key: `${showing.instance}:${showing.lineIndex}`,
      mood,
      name,
      named: speaker === "general" && name === GENERAL_NAMED.name,
      side: SPEAKERS[speaker].side,
      speaker,
      text,
    };
  }
  /** A tap on the conversation box: the next line, or the box closes after the last. */
  advanceConversation(): void {
    this.talk.advance();
  }
  private beginConversations(): void {
    this.talk.beginFlight(this.state.selectedSector, {
      stardust: this.state.economy.stardust > 0,
    });
  }
  /** Which half and screen shows now. */
  get screen(): Screen {
    if (this.state.mode === "space") {
      return "space";
    }
    if (this.startShown) {
      return "start";
    }
    return this.selection === null ? "story" : "selector";
  }
  /** The storybook page on show, with whether Previous can act. */
  get storyView(): StoryView | null {
    return this.story && this.screen === "story"
      ? {
          canGoBack: canGoBack(this.story),
          choices: shownChoices(this.story),
          page: currentPage(this.story),
        }
      : null;
  }
  /** The galaxy on show in galaxy selection, 1 to 4. */
  get selectedGalaxy(): number | null {
    return this.screen === "selector" ? this.selection : null;
  }
  isUnlocked(galaxy: number): boolean {
    return this.state.unlocked.some((id) => id === galaxy);
  }
  private get current(): SectorProgress {
    return this.state.progress[this.state.selectedSector];
  }
  private get chapter() {
    return this.content.chapters[this.state.selectedSector];
  }
  private label(id: string): string {
    return this.content.labels[id] ?? "";
  }
  get inDanger(): boolean {
    return (this.state.flight?.dangerFor ?? 0) > 0;
  }
  get objective(): string {
    const p = this.current;
    const stages: Record<SectorId, readonly number[]> = {
      1: [0, 1, 2, 3, 4],
      2: [0, 1, 2, 3, 4, 5],
      3: [0, 1, 2, 3, 4, 5],
    };
    // After the space quest, recovering the holodisk comes before the return home.
    const last = this.chapter.objectives.length - 1;
    const index = p.questComplete
      ? last - (p.holodisk ? 0 : 1)
      : (stages[this.state.selectedSector][p.stage] ?? 0);
    return this.chapter.objectives[index] ?? "";
  }
  private nearest(): string | undefined {
    const f = this.state.flight;
    if (!f || this.state.mode !== "space" || this.state.dialogue) {
      return undefined;
    }
    return f.objects
      .filter(
        (o) =>
          o.kind === "destination" &&
          this.current.known.includes(o.id) &&
          !routeBlocked(o.id, f) &&
          Math.hypot(o.x - f.player.x, o.y - f.player.y) <= this.content.tuning.safeRadius,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - f.player.x, a.y - f.player.y) -
          Math.hypot(b.x - f.player.x, b.y - f.player.y),
      )[0]?.id;
  }
  get contextLabel(): string | undefined {
    const id = this.nearest();
    if (!id) {
      return undefined;
    }
    if (id === "hub" && (this.state.flight?.cargo ?? 0) > 0) {
      return this.label("deposit");
    }
    if ((id === "workshop" || id === "salvagers") && this.current.questItem) {
      return this.label("deliver");
    }
    return this.label("talk");
  }
  weapons(): WeaponChoice[] {
    return this.state.mode === "space" && this.state.flight ? ownedWeapons(this.state.flight) : [];
  }
  /** A change refused by the weapon lock shows the weaponLocked notice. */
  selectWeapon(weapon: Weapon): boolean {
    const flight = this.state.flight;
    if (this.state.mode !== "space" || this.state.dialogue || this.state.docked || !flight) {
      return false;
    }
    if (
      weapon !== flight.weapon &&
      weaponsLocked(flight) &&
      ownedWeapons(flight).some((choice) => choice.id === weapon)
    ) {
      this.notify(this.label("weaponLocked"));
      return false;
    }
    const selected = selectFlightWeapon(weapon, flight);
    this.pullLoadout();
    return selected;
  }
  destinations(): { id: string; label: string }[] {
    return [
      ...this.current.known.map((id) => ({
        id,
        label: this.chapter.dialogue[dialogueKeys[id] ?? id]?.speaker ?? this.chapter.name,
      })),
      ...this.current.stations.map((id) => ({ id, label: this.label("station") })),
    ];
  }
  /** Ada's shield capacity with bought upgrades. */
  get shieldMax(): number {
    const levels = this.state.flight?.levels ?? this.state.economy.levels;
    return shipTuning(ECONOMY, this.content, levels).shieldMax;
  }
  /** Whether the shield is regenerating: the recharge delay has passed and it is below capacity. */
  get shieldRecharging(): boolean {
    const flight = this.state.flight;
    if (!flight) {
      return false;
    }
    const ship = shipTuning(ECONOMY, this.content, flight.levels);
    return (
      flight.shield > 0 &&
      flight.shield < ship.shieldMax &&
      flight.sinceDamage >= ship.shieldRechargeDelay
    );
  }
  /** During a flight its loadout is authoritative; the economy mirrors it. */
  private pullLoadout(): void {
    const flight = this.state.flight;
    if (!flight) {
      return;
    }
    const economy = this.state.economy;
    const owned = ownedForSave(flight);
    economy.ownedWeapons = owned;
    // A granted weapon in use saves as the last real selection that is still owned.
    if (flight.weapon === "basic" || owned.includes(flight.weapon)) {
      economy.weapon = flight.weapon;
    } else if (economy.weapon !== "basic" && !owned.includes(economy.weapon)) {
      economy.weapon = "basic";
    }
    economy.levels = structuredClone(flight.levels);
  }
  /** Purchases change the economy, which then refreshes the flight's loadout. */
  private pushLoadout(): void {
    const flight = this.state.flight;
    if (!flight) {
      return;
    }
    const economy = this.state.economy;
    const before = shipTuning(ECONOMY, this.content, flight.levels).shieldMax;
    // A bought weapon stops being granted; other granted weapons stay for the flight.
    const granted = (flight.grantedWeapons ?? []).filter(
      (weapon) => !economy.ownedWeapons.includes(weapon),
    );
    flight.ownedWeapons = [...economy.ownedWeapons, ...granted];
    if (granted.length) {
      flight.grantedWeapons = granted;
    } else {
      delete flight.grantedWeapons;
    }
    flight.levels = structuredClone(economy.levels);
    // A bought shield level adds its capacity to the current charge.
    const after = shipTuning(ECONOMY, this.content, flight.levels).shieldMax;
    flight.shield = Math.min(after, flight.shield + Math.max(0, after - before));
  }
  shopRows(tab: ShopTab): ShopRow[] {
    this.pullLoadout();
    return shopRows(ECONOMY, this.state.economy, tab);
  }
  requestPurchase(item: ShopItem): PurchaseRequest {
    this.pullLoadout();
    return requestPurchase(ECONOMY, this.state.economy, item);
  }
  /** Purchases happen only while docked. */
  buy(item: ShopItem): PurchaseResult {
    if (!this.state.docked) {
      return { kind: "refused", reason: "notForSale" };
    }
    this.pullLoadout();
    const result = buy(ECONOMY, item, this.state.economy);
    this.pushLoadout();
    return result;
  }
  /**
   * The docked galaxy's community projects with their progress, or null where none are offered:
   * outside a station, or before the galaxy's chapter is complete (projects.ts).
   */
  get projects(): ProjectView[] | null {
    const sector = this.state.flight?.sector;
    if (!this.state.docked || !sector || !projectsOffered(this.state.progress[sector])) {
      return null;
    }
    return projectViews(PROJECTS[sector], this.state.progress[sector]);
  }
  /**
   * One Donate press toward a docked galaxy's project. Funding the last part closes the station
   * card and queues the speaker's thank-you line in the conversation box.
   */
  donate(id: string): DonationResult {
    const sector = this.state.flight?.sector;
    if (!this.state.docked || !sector) {
      return { kind: "refused" };
    }
    const economy = this.state.economy;
    const result = donate(PROJECTS[sector], this.state.progress[sector], economy.stardust, id);
    if (result.kind === "paid") {
      economy.stardust -= result.amount;
      if (result.funded) {
        this.undock();
        this.talk.thank(id);
      }
    }
    return result;
  }
  /** Each galaxy's allies for the Black Eye finale, one per funded project. */
  allies(sector: SectorId): ReturnType<typeof projectAllies> {
    return projectAllies(PROJECTS[sector], this.state.progress[sector]);
  }
  /** Each galaxy's world changes at their sites, one per funded project (projects.ts). */
  worldChanges(sector: SectorId): ReturnType<typeof worldChanges> {
    return worldChanges(PROJECTS[sector], this.state.progress[sector]);
  }
  selectPaint(scheme: string): boolean {
    return selectPaint(ECONOMY, scheme, this.state.economy);
  }
  undock(): void {
    const id = this.state.docked;
    if (id && this.state.flight) {
      undockFlight(this.content, id, this.state.flight);
    }
    this.state.docked = null;
  }
  private panel(context: string, text: string, title = this.chapter.name): void {
    this.state.dialogue = {
      choices: [{ id: "continue", label: this.label("continue") }],
      context,
      text,
      title,
    };
  }
  private exchange(key: string): void {
    const entry = this.chapter.dialogue[key];
    if (!entry) {
      return;
    }
    this.panel(key, entry.text, entry.speaker);
    if (entry.optional && this.label("askMore")) {
      this.state.dialogue?.choices.unshift({ id: "optional", label: this.label("askMore") });
    }
  }
  private launch(): void {
    this.current.questItem = null;
    const randomSeed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    const seed = randomSeed === this.previousSeed ? (randomSeed + 1) >>> 0 : randomSeed;
    this.previousSeed = seed;
    this.state.flight = createFlight(
      this.content,
      this.state.selectedSector,
      seed,
      this.current,
      this.state.economy,
    );
    this.state.mode = "space";
    this.state.dialogue = null;
    this.state.docked = null;
    for (const id of this.current.known) {
      ensureDestination(this.content, id, this.state.flight);
    }
    this.ensureWhaleDebris();
    this.beginConversations();
  }
  /** Jumps to an unlocked galaxy's flight. */
  startSector(id: SectorId): void {
    if (!this.state.unlocked.includes(id) || this.state.mode === "space") {
      return;
    }
    this.state.selectedSector = id;
    this.state.started = true;
    this.startShown = false;
    this.story = null;
    this.selection = null;
    this.launch();
  }
  private home(forced: boolean): void {
    if (!forced && this.inDanger) {
      this.notify(this.label("travelUnavailable"));
      return;
    }
    this.current.questItem = null;
    this.pullLoadout();
    this.previousSeed = this.state.flight?.seed ?? this.previousSeed;
    this.talk.endFlight();
    this.state.mode = "home";
    this.state.flight = null;
    this.state.dialogue = null;
    this.state.docked = null;
    this.beginVisit();
  }
  returnHome(): void {
    this.home(false);
  }
  teleport(id: string): void {
    const f = this.state.flight;
    const station = this.current.stations.includes(id);
    if (
      !f ||
      this.state.mode !== "space" ||
      this.state.dialogue ||
      this.state.docked ||
      !(this.current.known.includes(id) || station)
    ) {
      return;
    }
    if (this.inDanger) {
      this.notify(this.label("travelUnavailable"));
      return;
    }
    if (station) {
      ensureStation(this.content, id, f);
    } else {
      ensureDestination(this.content, id, f);
    }
    teleportFlight(this.content, id, f);
  }
  /**
   * Shield depletion quantum jumps Ada home and costs only the flight: its layout, open-space
   * enemies, pickups and carried cargo. Weapons, levels, Stardust, purchases, accepted quests
   * and story progress stay. She lands at night and sleeps while Astra recharges overnight.
   */
  private jumpHome(): void {
    if (!this.state.flight) {
      return;
    }
    this.home(true);
    this.notify(this.label("jumpHome"));
    this.showScene(jumpHomeScene(this.state.notice, this.label("morningRecharge")));
  }
  private complete(): void {
    this.current.questComplete = true;
    if (this.current.holodisk) {
      this.notify(this.label("chapterComplete"));
    }
  }
  /** Unlocks the next galaxy once its holodisk, space quest and home resolution are done. */
  private unlockNext(galaxy: SectorId = this.state.selectedSector): void {
    const p = this.state.progress[galaxy];
    const next = galaxy + 1;
    if (
      p.holodisk &&
      p.questComplete &&
      p.resolved &&
      next <= 3 &&
      !this.state.unlocked.includes(next as SectorId)
    ) {
      this.state.unlocked.push(next as SectorId);
      // Galaxy four's story is in development, so only a galaxy with a story is announced.
      this.state.announceGalaxy = Object.hasOwn(this.content.chapters, next);
    }
  }
  /**
   * Ada inserts a recovered holodisk into Astra's drive at once; `giver` names the outpost
   * that hands it over first.
   */
  private recoverHolodisk(giver?: string): void {
    const p = this.current;
    p.holodisk = true;
    const f = this.state.flight;
    if (f) {
      f.objects = f.objects.filter(
        (object) => !(object.kind === "destination" && object.id === "holodisk"),
      );
    }
    this.unlockNext();
    if (p.questComplete) {
      this.notify(this.label("chapterComplete"));
    }
    if (giver) {
      this.panel("holodiskHandover", this.content.premise.holodisk.handover, giver);
    } else {
      this.insertion(0);
    }
  }
  /** The insertion panels, then Astra's memory line for the current galaxy. */
  private insertion(index: number): void {
    const { inserted, memories } = this.content.premise.holodisk;
    // Astra, who speaks the last insertion line, continues with the memory.
    const memory = { speaker: inserted.at(-1)?.speaker, text: memories[this.state.selectedSector] };
    const lines = [...inserted, memory];
    const line = lines[index];
    if (line) {
      this.panel(`holodisk:${index}`, line.text, line.speaker);
    } else {
      this.state.dialogue = null;
    }
  }
  /** The hub's holodisk confirm; while Ada is short of Stardust, Buy refuses. */
  private offerHolodisk(): void {
    const price = HOLODISKS.hubPrice;
    const left = this.state.economy.stardust - price;
    this.state.dialogue = {
      choices: [
        { id: "buy", label: this.label("confirmBuy"), ...(left < 0 ? { refused: true } : {}) },
        { id: "cancel", label: this.label("confirmCancel") },
      ],
      context: "holodiskOffer",
      text: [
        fill(this.label("stardustAmount"), { amount: price }),
        left < 0 ? "" : fill(this.label("confirmLeft"), { amount: left }),
      ]
        .filter(Boolean)
        .join("\n"),
      title: fill(this.label("confirmTitle"), { name: this.content.premise.holodisk.name }),
    };
  }
  /** Buys the hub's holodisk; a balance short of the price refuses and keeps the confirm. */
  buyHolodisk(): boolean {
    const economy = this.state.economy;
    if (
      this.state.dialogue?.context !== "holodiskOffer" ||
      this.current.holodisk ||
      economy.stardust < HOLODISKS.hubPrice
    ) {
      return false;
    }
    economy.stardust -= HOLODISKS.hubPrice;
    this.recoverHolodisk();
    return true;
  }
  step(dt: number, input: FlightInput): void {
    this.flightEvents = [];
    const f = this.state.flight;
    if (
      !f ||
      this.state.mode !== "space" ||
      this.state.dialogue ||
      this.state.docked ||
      !Number.isFinite(dt) ||
      dt <= 0
    ) {
      return;
    }
    this.ensureRequiredApproaches();
    const previousFreshDistance = f.freshDistance;
    const events = stepFlight(this.content, dt, input, f);
    this.flightEvents = events;
    this.pullLoadout();
    const mapped: string[] = [];
    let newStation = false;
    for (const event of events) {
      if (event.type === "depleted") {
        this.jumpHome();
        return;
      }
      if (event.type === "stardust") {
        this.state.economy.stardust += event.amount;
      }
      if (event.type === "stationDiscovered" && !this.current.stations.includes(event.id)) {
        this.current.stations.push(event.id);
        newStation = true;
      }
      if (event.type === "docked") {
        this.state.docked = event.id;
      }
      if (event.type === "enemyDisabled") {
        this.current.disabledEnemies++;
      }
      // Touching the guarded holodisk recovers it, like a pickup; it never becomes a travel
      // destination.
      if (event.type === "discovered" && event.id === "holodisk") {
        if (this.holodiskWaypoint && this.holodiskTouched(f)) {
          this.recoverHolodisk();
        }
        continue;
      }
      if (event.type === "discovered" && !this.current.known.includes(event.id)) {
        this.current.known.push(event.id);
        this.current.discoveries++;
        mapped.push(event.id);
      }
      if (
        event.type === "debrisCleared" &&
        f.sector === 3 &&
        this.current.stage <= 1 &&
        !f.objects.some((o) => o.id.startsWith("whale-debris:") && o.hp > 0)
      ) {
        this.current.stage = 2;
      }
    }
    const near = (range: number) => (object: { x: number; y: number }) =>
      Math.hypot(object.x - f.player.x, object.y - f.player.y) <= range;
    const held = this.noticeShowing;
    // A game notice's time runs only while it shows, not under a warning.
    if (this.state.notice && !this.talk.warningShowing) {
      this.noticeShownFor += dt;
      if (this.noticeShownFor >= CONVERSATION_TUNING.lineSeconds - 1e-9) {
        this.state.notice = "";
      }
    }
    this.talk.step(dt, held, {
      aimed: Math.hypot(input.aim.x, input.aim.y) > 0,
      capitalInSight: capitalInSight(SCREEN, f),
      collectedStardust: events.some((event) => event.type === "stardust"),
      docked: events.some((event) => event.type === "docked"),
      inDanger: this.inDanger,
      moved: Math.hypot(input.move.x, input.move.y) > 0,
      newStation,
      newlyMapped: mapped,
      pennyPoints: pennyPoints(this.current, this.holodiskWaypoint, f),
      shieldFraction: this.shieldMax > 0 ? f.shield / this.shieldMax : 1,
      stardustInSight: f.objects.some(
        (object) => carriesStardust(object) && near(CONVERSATION_TUNING.stardustSightRange)(object),
      ),
    });
    if (!this.current.introduced && f.freshDistance >= this.content.tuning.introFreshDistance) {
      ensureDestination(this.content, first(f.sector), f);
      if (
        f.freshDistance > previousFreshDistance &&
        !this.current.known.includes(first(f.sector))
      ) {
        this.placePending(first(f.sector));
      }
    }
    if (
      this.current.introduced &&
      !this.current.questComplete &&
      f.freshDistance >=
        this.content.tuning.introFreshDistance +
          this.current.stage * this.content.tuning.encounterFreshDistance
    ) {
      const id = required[f.sector][this.current.stage];
      if (id) {
        ensureDestination(this.content, id, f);
        if (f.freshDistance > previousFreshDistance && !this.current.known.includes(id)) {
          this.placePending(id);
        }
      }
    }
    if (this.holodiskWaypoint) {
      ensureDestination(this.content, "holodisk", f);
    }
    this.ensureRequiredApproaches();
    this.ensureWhaleDebris();
    const intro = first(f.sector);
    if (
      !this.current.introduced &&
      this.current.known.includes(intro) &&
      this.nearest() === intro
    ) {
      this.current.introduced = true;
      this.current.stage = Math.max(1, this.current.stage);
      if (f.sector === 1) {
        this.current.questItem = "food";
      }
      this.ensureWhaleDebris();
      if (f.sector === 3 && this.current.stage === 2) {
        this.current.stage = 3;
        this.exchange("freed");
      } else {
        this.exchange(f.sector === 1 ? "grower" : intro);
      }
    } else if (input.use) {
      this.interact();
    }
  }
  /** The places the direction indicators mark (indicators.ts). */
  get indicatorTargets(): IndicatorTarget[] {
    const f = this.state.flight;
    if (!f || this.state.mode !== "space") {
      return [];
    }
    const p = this.current;
    return indicatorTargets(INDICATOR_SOURCES, {
      flight: f,
      holodiskWaypoint: this.holodiskWaypoint,
      objective: this.objectiveId(f.sector),
      progress: p,
      questItem: questItemDestination(p),
      sector: f.sector,
    });
  }
  /**
   * The pause menu's Map of the current galaxy (map.ts), or null outside a flight. Landmarks join
   * through NO_LANDMARKS's slot once the landmark model charts them.
   */
  get map(): GalaxyMap | null {
    const f = this.state.flight;
    if (!f || this.state.mode !== "space") {
      return null;
    }
    const labels = new Map(this.destinations().map(({ id, label }) => [id, label]));
    return galaxyMap({
      catalog: ECONOMY,
      destinations: galaxyRoute(f.sector),
      flight: f,
      label: (id) => labels.get(id) ?? id,
      landmarks: NO_LANDMARKS,
      objective: this.objectiveId(f.sector),
      progress: this.current,
    });
  }
  /** The current objective's destination in a galaxy, if it has one (indicators.ts). */
  private objectiveId(sector: SectorId): string | null {
    const p = this.current;
    return objectiveDestination(sector, p, p.deposited >= this.content.tuning.miningMilestones[1]);
  }
  /** After the reunion, the whale's family gives Ada a waypoint to galaxy three's holodisk. */
  private get holodiskWaypoint(): boolean {
    return this.state.flight?.sector === 3 && this.current.questComplete && !this.current.holodisk;
  }
  /** Ada is within pickup reach of the holodisk, a pickup-sized object; the tractor never pulls it. */
  private holodiskTouched(f: NonNullable<GameState["flight"]>): boolean {
    const disk = f.objects.find((o) => o.kind === "destination" && o.id === "holodisk");
    const { pickupRadius, pickupReach } = this.content.tuning.flight;
    return (
      disk !== undefined &&
      Math.hypot(disk.x - f.player.x, disk.y - f.player.y) <= pickupRadius + pickupReach
    );
  }
  private ensureRequiredApproaches(): void {
    const f = this.state.flight;
    if (!f || (this.current.questComplete && !this.holodiskWaypoint)) {
      return;
    }
    for (const object of [...f.objects]) {
      if (object.kind === "destination" && !this.current.known.includes(object.id)) {
        ensureRouteEncounter(this.content, object.id, f);
      }
    }
  }
  private placePending(id: string): void {
    const f = this.state.flight;
    if (!f) {
      return;
    }
    activateRouteEncounter(this.content, id, f);
    const old = f.objects.find((o) => o.id === id);
    const before = old ? { x: old.x, y: old.y } : null;
    const debris = id === "whale" ? f.objects.filter((o) => o.id.startsWith("whale-debris:")) : [];
    const destination = placeDestinationAhead(this.content, id, f);
    if (before) {
      for (const guard of f.objects.filter((object) => object.routeId === id)) {
        const dx = destination.x - before.x;
        const dy = destination.y - before.y;
        guard.x += dx;
        guard.y += dy;
        if (guard.enemy) {
          guard.enemy.position.x += dx;
          guard.enemy.position.y += dy;
          guard.enemy.home.x += dx;
          guard.enemy.home.y += dy;
        }
      }
      for (const object of debris) {
        object.x += destination.x - before.x;
        object.y += destination.y - before.y;
        if (!f.objects.includes(object)) {
          f.objects.push(object);
        }
      }
      if (destination.x !== before.x || destination.y !== before.y) {
        settleRouteEncounters(this.content, f);
      }
    }
    syncFlightRegion(this.content, f);
  }
  private ensureWhaleDebris(): void {
    const f = this.state.flight;
    if (!f || f.sector !== 3 || this.current.stage >= 2) {
      return;
    }
    const whale = f.objects.find((o) => o.id === "whale");
    if (!whale || f.objects.some((o) => o.id.startsWith("whale-debris:"))) {
      return;
    }
    const tuning = this.content.tuning.whaleDebris;
    for (let i = 0; i < tuning.count; i++) {
      const angle = (i * Math.PI * 2) / tuning.count;
      f.objects.push({
        hp: tuning.hp,
        id: `whale-debris:${i}`,
        kind: "debris",
        radius: tuning.radius,
        x: whale.x + Math.cos(angle) * tuning.spacing,
        y: whale.y + Math.sin(angle) * tuning.spacing,
      });
    }
  }
  interact(): void {
    const id = this.nearest();
    const f = this.state.flight;
    if (!id || !f) {
      return;
    }
    const destination = f.objects.find(
      (object) => object.kind === "destination" && object.id === id,
    );
    if (destination) {
      destination.persistent = true;
    }
    const p = this.current;
    if (f.sector === 1) {
      // Once their exchange is running, any outpost gives Ada the holodisk.
      if (p.questComplete && !p.holodisk) {
        this.recoverHolodisk(this.chapter.dialogue[dialogueKeys[id] ?? id]?.speaker);
      } else if (id === "growers" && p.stage === 1) {
        p.questItem = "food";
        this.exchange("grower");
      } else if (id === "workshop" && p.stage === 1 && p.questItem === "food") {
        p.stage = 2;
        p.questItem = "toolkit";
        this.exchange("workshop");
      } else if (id === "workshop" && p.stage === 2) {
        p.questItem = "toolkit";
        this.exchange("workshop");
      } else if (id === "salvagers" && p.stage === 2 && p.questItem === "toolkit") {
        p.stage = 3;
        p.questItem = "parts";
        this.exchange("salvager");
      } else if (id === "salvagers" && p.stage === 3) {
        p.questItem = "parts";
        this.exchange("salvager");
      } else if (id === "workshop" && p.stage === 3 && p.questItem === "parts") {
        p.stage = 4;
        p.questItem = null;
        this.complete();
        this.exchange("deliveryComplete");
      } else {
        this.exchange(dialogueKeys[id] ?? id);
      }
    } else if (f.sector === 2) {
      if (id === "hub" && p.questComplete && !p.holodisk) {
        p.deposited += f.cargo;
        f.cargo = 0;
        this.offerHolodisk();
      } else if (id === "hub") {
        p.deposited += f.cargo;
        f.cargo = 0;
        const [a, b, c] = this.content.tuning.miningMilestones;
        if (p.stage === 1 && p.deposited >= a) {
          p.stage = 2;
          this.exchange("firstDeposit");
        } else if (p.stage === 4 && p.deposited >= c) {
          p.stage = 5;
          this.complete();
          this.exchange("approach");
        } else {
          this.exchange("hub");
        }
        if (p.stage === 2 && p.deposited >= b) {
          ensureDestination(this.content, "miner", f);
        }
      } else if (
        id === "miner" &&
        p.stage === 2 &&
        p.deposited >= this.content.tuning.miningMilestones[1]
      ) {
        p.stage = 3;
        this.exchange("miner");
      } else if (id === "visitors" && p.stage === 3) {
        p.stage = 4;
        this.exchange("visitors");
      } else {
        this.exchange(id);
      }
    } else if (id === "whale" && p.stage === 1) {
      this.exchange("trapped");
    } else if (id === "whale" && p.stage === 2) {
      p.stage = 3;
      this.exchange("freed");
    } else if (id === "family" && p.stage === 3) {
      p.stage = 4;
      this.exchange("family");
    } else if (id === "whale" && p.stage === 4) {
      p.stage = 5;
      this.complete();
      this.exchange("reunion");
    } else {
      this.exchange(id);
    }
  }
  choose(id: string): void {
    const dialogue = this.state.dialogue;
    if (!dialogue || !dialogue.choices.some((c) => c.id === id)) {
      return;
    }
    if (id === "optional") {
      const entry = this.chapter.dialogue[dialogue.context];
      if (entry?.optional) {
        this.panel(dialogue.context, entry.optional, entry.speaker);
      }
      return;
    }
    if (dialogue.context === "holodiskOffer" && id === "buy") {
      this.buyHolodisk();
      return;
    }
    if (dialogue.context === "holodiskHandover") {
      this.insertion(0);
      return;
    }
    const inserted = /^holodisk:(\d+)$/.exec(dialogue.context);
    if (inserted) {
      this.insertion(Number(inserted[1]) + 1);
      return;
    }
    this.state.dialogue = null;
  }
  /** Start: galaxy one's home opening, then the prologue, until the first flight begins. */
  start(): void {
    if (this.screen !== "start" || this.state.started) {
      return;
    }
    this.state.progress[1].opened = false;
    this.startShown = false;
    this.beginVisit();
  }
  /** Continue: any waiting home scene, else the cockpit and Astra's line; then galaxy selection. */
  continueGame(): void {
    if (this.screen !== "start" || !this.state.started) {
      return;
    }
    this.startShown = false;
    if (this.waitingScene() || !this.state.prologueSeen) {
      this.beginVisit();
    } else {
      // Nothing waiting: the cockpit, Astra's boarding line, then galaxy selection.
      this.showScene(boardingScene(this.content, this.state.announceGalaxy, false));
    }
  }
  /**
   * Restart clears story progress, galaxies, holodisks, Stardust and purchases and replays from
   * Start. Device settings are stored apart from the save.
   */
  restart(): void {
    if (this.screen !== "start") {
      return;
    }
    this.state = newGameState();
    this.story = null;
    this.selection = null;
    this.startShown = true;
  }
  /** Next, or the page's named action; on the sleep scene, a tap once its skip delay passes. */
  storyNext(): void {
    if (this.sleeping && this.slept < OVERNIGHT_SLEEP.skipAfterSeconds) {
      return;
    }
    if (this.story && this.screen === "story" && !currentPage(this.story).choices) {
      this.moveStory(advance(this.story));
    }
  }
  /** A choice page's choice, by its index. */
  storyChoose(index: number): void {
    const choices = this.story && this.screen === "story" ? shownChoices(this.story) : [];
    if (this.story && index >= 0 && index < choices.length) {
      this.moveStory(advance(this.story, index));
    }
  }
  storyPrevious(): void {
    if (this.story && this.screen === "story" && canGoBack(this.story)) {
      this.story = goBack(this.story);
    }
  }
  /** Skip: the scene's end by the default path; the sleep scene shows no Skip. */
  storySkip(): void {
    if (this.story && this.screen === "story" && !this.sleeping) {
      this.moveStory(skip(this.story));
    }
  }
  /** Pages galaxy selection by delta, within galaxies one to four. */
  pageGalaxy(delta: number): void {
    if (this.selection !== null && this.screen === "selector") {
      this.selection = Math.min(GALAXY_COUNT, Math.max(1, this.selection + delta));
    }
  }
  /** Jump: the selected galaxy's flight; a locked galaxy refuses. */
  jump(): boolean {
    const galaxy = this.selectedGalaxy;
    if (galaxy === null || !this.isUnlocked(galaxy)) {
      return false;
    }
    this.startSector(galaxy as SectorId);
    return true;
  }
  /** Home, the close X, an outside tap, back and Escape: Ada's room, without a jump. */
  leaveCockpit(): void {
    if (this.screen === "selector") {
      this.selection = null;
      this.beginVisit();
    }
  }
  /** The first home scene waiting on story progress: a resolution, then an opening. */
  private waitingScene(): Scene | null {
    const galaxies = [1, 2, 3] as const;
    const resolution = galaxies.find(
      (id) => this.state.progress[id].questComplete && !this.state.progress[id].resolved,
    );
    if (resolution !== undefined) {
      return resolutionScene(this.content, resolution);
    }
    const opening = galaxies.find((id) => this.isUnlocked(id) && !this.state.progress[id].opened);
    return opening === undefined ? null : openingScene(this.content, opening);
  }
  /** After Earth scenes: the prologue the first time, else Ada's room with the rock. */
  private roomScene(empty: boolean): Scene {
    return this.state.prologueSeen
      ? roomScene(this.content, this.storyLabels, empty)
      : prologueScene(this.content, this.storyLabels);
  }
  private get storyLabels(): StoryLabels {
    return { continue: this.label("continue"), pickUpRock: this.label("pickUpRock") };
  }
  /** A home visit: waiting scenes, then Ada's room; an empty visit adds Penny's line. */
  private beginVisit(): void {
    this.selection = null;
    const waiting = this.waitingScene();
    this.showScene(waiting ?? this.roomScene(true));
  }
  private showScene(scene: Scene): void {
    this.story = storyStart(scene);
    this.showPage();
  }
  private showPage(): void {
    this.slept = 0;
    if (this.story && currentPage(this.story).announces) {
      this.state.announceGalaxy = false;
    }
  }
  /** Seconds the sleep scene on show has played; any other page resets it. */
  private slept = 0;
  private get sleeping(): boolean {
    return Boolean(this.story && this.screen === "story" && currentPage(this.story).sleep);
  }
  /** Plays the sleep scene on, moving to morning once its seconds are up. */
  storyTick(seconds: number): void {
    if (!this.sleeping || !Number.isFinite(seconds) || seconds <= 0) {
      return;
    }
    this.slept += seconds;
    if (this.slept >= OVERNIGHT_SLEEP.seconds) {
      this.moveStory(advance(this.story!));
    }
  }
  /** Moves to a page, or past a scene's end to what the scene leads to. */
  private moveStory(next: StoryPosition | null): void {
    const ended = this.story?.scene;
    if (next) {
      this.story = next;
      this.showPage();
      return;
    }
    if (!ended) {
      return;
    }
    this.applyEffect(ended);
    if (ended.lead === "home") {
      this.showScene(this.waitingScene() ?? this.roomScene(false));
    } else if (ended.lead === "visit") {
      this.beginVisit();
    } else if (ended.lead === "board") {
      this.showScene(boardingScene(this.content, this.state.announceGalaxy));
    } else {
      this.openSelection();
    }
  }
  private applyEffect(scene: Scene): void {
    const effect = scene.effect;
    if (effect?.kind === "opened") {
      this.state.progress[effect.galaxy].opened = true;
    } else if (effect?.kind === "resolved") {
      this.state.progress[effect.galaxy].resolved = true;
      this.unlockNext(effect.galaxy);
    } else if (effect?.kind === "prologue") {
      this.state.prologueSeen = true;
    }
  }
  /** Galaxy selection in the cockpit, open on the farthest unlocked galaxy. */
  private openSelection(): void {
    this.story = null;
    this.selection = Math.max(...this.state.unlocked);
  }
  save(): string {
    this.pullLoadout();
    return JSON.stringify(this.state);
  }
}
