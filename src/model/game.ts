import { ACHIEVEMENTS, PENNY_FIND_RANGE } from "../data/achievements.ts";
import { ACTIVITIES, SUPPLY_ITEMS } from "../data/activities.ts";
import type { CastKey } from "../data/cast.ts";
import {
  CONVERSATION_TUNING,
  CONVERSATIONS,
  GENERAL_NAMED,
  type JobMoment,
  type Mood,
  SPEAKERS,
} from "../data/conversations.ts";
import { DESTINATIONS, STATION_SENTENCE } from "../data/destinations.ts";
import { ECONOMY } from "../data/economy.ts";
import {
  BUILT,
  GALAXY_COUNT,
  galaxyAt,
  ROUTE,
  ROUTE_POSITION,
  type RoutePosition,
  SECTORS,
  unlockedBy,
} from "../data/galaxies.ts";
import { HUNTING_PACKS } from "../data/galaxy-features.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { carriedItemName, STORY_ITEM_NAMES } from "../data/item-names.ts";
import { JOB_TUNING, type JobType } from "../data/jobs.ts";
import { galaxyProjects, PROJECT_THANKS } from "../data/projects.ts";
import { SCREEN } from "../data/screen.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/story-ships.ts";
import { galaxyCard, OVERNIGHT_SLEEP } from "../data/storybook.ts";
import type { ChapterContent, PrototypeContent, SectorId, Weapon } from "../data/types.ts";
import {
  ACHIEVEMENT_TOTALS,
  type AchievementEvent,
  achievementProgress,
  newAchievements,
  reachSensed,
  recordAchievement,
  recordSensed,
  unlockAchievements,
} from "./achievements.ts";
import {
  acceptActivity,
  type ActivityTerms,
  completeActivity,
  contractDeposit,
  dropActivity,
  heldActivity,
  placeActivity,
  supplyTerms,
} from "./activities.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { calfHome, calfRouteMidpoint, calfStart, placedCalf, stepCalf } from "./calf.ts";
import {
  capitalInSight,
  ConversationDirector,
  holodisksHeld,
  pennyPoints,
  speakerName,
} from "./conversations.ts";
import { inCurrent } from "./currents.ts";
import { carriesStardust, dropRandom } from "./drops.ts";
import {
  activateRouteEncounter,
  carryPickup,
  createFlight,
  dockFlight,
  dronesNear,
  ensureDestination,
  ensureHuntingPacks,
  ensureRouteEncounter,
  ensureStation,
  pickupTouched,
  placeDestinationAhead,
  placeHuntingPack,
  routeBlocked,
  salvage,
  salvageTarget,
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
import {
  acceptJob,
  type BoardContext,
  completeJob,
  dropJob,
  heldJob,
  jobHostiles,
  nearestSafePlace,
  pullTow,
  rerollBoards,
  stationBoard,
} from "./jobs.ts";
import { greetingLines, type StationGreeting, stationKeeper } from "./keepers.ts";
import {
  chartLandmarks,
  galaxyLandmarks,
  landmarkById,
  landmarkSites,
  unchartedNear,
} from "./landmarks.ts";
import { type GalaxyMap, galaxyMap, type MapContext, recordExplored } from "./map.ts";
import { HUNT_GLINT } from "./pickup-body.ts";
import { newProgress } from "./progress.ts";
import {
  donate,
  type DonationRequest,
  donationRequest,
  type DonationResult,
  projectAllies,
  projectsOffered,
  type ProjectView,
  projectViews,
  revealWorldChange,
  type WorldChange,
  worldChanges,
} from "./projects.ts";
import { restoreSave, SAVE_VERSION } from "./save.ts";
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
import { HUB_STATION, stationById, type StationSite } from "./stations.ts";
import {
  advance,
  atRunEnd,
  boardingScene,
  canGoBack,
  currentPage,
  goBack,
  jumpHomeScene,
  openingScene,
  prologueScene,
  resolutionScene,
  roomScene,
  runTrail,
  type Scene,
  sceneEnd,
  shownChoices,
  skipPassesPage,
  stepOf,
  stepPage,
  type StoryChoice,
  type StoryLabels,
  type StoryPage,
  type StoryPosition,
  storyStart,
  type StoryStep,
} from "./storybook.ts";
import type {
  Aboard,
  FlightEvent,
  FlightInput,
  FlightState,
  GameState,
  GuidedCalf,
  HeldActivity,
  HeldJob,
  JobOffer,
  JobTarget,
  SectorProgress,
  ShipState,
  SpaceObject,
  UseAction,
  Vec,
} from "./types.ts";
import { applyUpgrade, chooseUpgrade } from "./upgrade-drops.ts";
import { newEconomy, shipTuning } from "./upgrades.ts";
import {
  collectWeapon,
  ownedForSave,
  ownedWeapons,
  selectFlightWeapon,
  UPGRADE_WEAPONS,
  type WeaponChoice,
} from "./weapons.ts";

export { newProgress } from "./progress.ts";
const progress = newProgress;
/** A first launch: galaxy one unlocked and nothing begun. */
export function newGameState(): GameState {
  return {
    achievements: newAchievements(),
    announceGalaxy: false,
    dialogue: null,
    docked: null,
    economy: newEconomy(ECONOMY),
    flight: null,
    jobs: { boards: {}, made: 0 },
    mode: "home",
    notice: "",
    progress: Object.fromEntries(SECTORS.map((id) => [id, progress()])) as Record<
      SectorId,
      SectorProgress
    >,
    prologueSeen: false,
    seenConversations: [],
    selectedSector: 1,
    started: false,
    tasks: {},
    unlocked: [1],
    version: SAVE_VERSION,
  };
}
/** What the home half shows: the start screen, a storybook page or galaxy selection. */
export type Screen = "selector" | "space" | "start" | "story";

/**
 * An unlock on the route map: the ship flies from the completed galaxy's route position to the
 * farthest it opened, past the others it opened, which show locked until then.
 */
export interface RouteFlight {
  readonly from: RoutePosition;
  readonly opened: readonly RoutePosition[];
  readonly to: RoutePosition;
}
/**
 * A story run's pages: every page of each scene it chains by the default path from its start,
 * the run's first page through its end, fixed when the run starts. `id` changes with each run.
 */
export interface StoryRun {
  readonly id: string;
  readonly pages: readonly StoryPage[];
}
export interface StoryView {
  readonly page: StoryPage;
  /** The story run the page belongs to. */
  readonly run: StoryRun;
  readonly canGoBack: boolean;
  /**
   * Skip shows only where it passes a page Next or the named action would show: not on the
   * story run's end, the page before it or the sleep scene.
   */
  readonly canSkip: boolean;
  /** The choices shown: a choice page's, or the optional questions not yet asked. */
  readonly choices: readonly StoryChoice[];
}
// The built galaxies' story destinations; a placeholder galaxy has none.
const required: Partial<Record<SectorId, readonly string[]>> = {
  1: ["growers", "workshop", "salvagers", "workshop"],
  2: ["hub", "hub", "miner", "visitors", "hub"],
  3: ["whale", "whale", "whale", "family", "whale"],
};

/** A galaxy's story destinations in the order its route first visits them; the first opens it. */
export function galaxyRoute(sector: SectorId): readonly string[] {
  return [...new Set(required[sector] ?? [])];
}
/** The destination that opens a built galaxy's story; none in a placeholder. */
const first = (sector: SectorId): string | undefined => galaxyRoute(sector)[0];

/** A placeholder galaxy's chapter: its name, with no story, objectives or dialogue. */
function placeholderChapter(sector: SectorId): ChapterContent {
  const none = ["", ""] as const;
  return {
    closing: "",
    dialogue: {},
    name: galaxyCard(sector).name,
    objectives: [],
    opening: "",
    openingBranches: none,
    openingChoices: none,
    resolution: "",
    resolutionBranches: none,
    resolutionChoices: none,
  };
}
const dialogueKeys: Record<string, string> = { growers: "grower", salvagers: "salvager" };

/** A job board row: the held job (Active, with Drop) or an offer, refused while Ada is busy. */
export interface JobRow {
  readonly id: string;
  /** A station job, or the galaxy's active repeatable activity. */
  readonly kind: "activity" | "job";
  /** The row's icon: the job's type, or `activity`. */
  readonly type: JobType | "activity";
  readonly title: string;
  readonly detail: string;
  readonly reward: number;
  readonly state: "held" | "offer" | "busy";
}

/** What the scene draws for jobs: landmarks, a rescue's craft and a hunt's area and glint. */
export interface JobScenery {
  readonly landmarks: readonly (Vec & {
    readonly charted: boolean;
    readonly id: string;
    readonly kind: string;
  })[];
  /** A rescue's stranded or towed craft, with the pool item it is. */
  readonly craft: (Vec & { readonly item: string }) | null;
  readonly towing: boolean;
  /** A hunt's search area. */
  readonly area: (Vec & { readonly radius: number }) | null;
  /** A hunt's lost item while it glints, within glint range of Ada. */
  readonly glint: Vec | null;
}

const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

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

/** One entry on the Achievements card, in Gameplay's table order. */
export interface AchievementView {
  readonly condition: string;
  readonly id: string;
  readonly name: string;
  /** A locked counted achievement's count; absent once unlocked or while its system is unbuilt. */
  readonly progress?: { readonly have: number; readonly need: number };
  readonly unlocked: boolean;
}

export class GameModel {
  state: GameState;
  /** The last flight step's events, for view effects; empty when no step ran. */
  flightEvents: FlightEvent[] = [];
  private readonly content: PrototypeContent;
  private readonly talk: ConversationDirector;
  private noticeShownFor = 0;
  /** Held-job moments since the last flight step, for the conversation director. */
  private jobMoments: (JobMoment | "jobComplete")[] = [];
  /** Whether Ada has docked this flight, which marks the dock lesson done. */
  private dockedThisFlight = false;
  // The docked station keeper's greeting: the keeper, this docking's lines and the one on show.
  private greeting: {
    index: number;
    readonly keeper: CastKey;
    readonly lines: readonly string[];
  } | null = null;
  /** Achievements unlocked whose notice has not shown yet; notices show in flight. */
  private achievementNotices: string[] = [];
  private previousSeed = 0;
  // The home half's place is not saved: every launch shows the start screen, and Continue
  // rebuilds any waiting scene from story progress or resumes the saved flight.
  private startShown = true;
  // A flight saved mid-flight, with its notice, held off the state while the launch's start
  // screen shows so nothing in flight runs or shows; save() writes it back unchanged and
  // Continue restores it.
  private heldFlight: Pick<GameState, "dialogue" | "docked" | "flight" | "mode" | "notice"> | null =
    null;
  private story: StoryPosition | null = null;
  // The galaxy map's ship, always on an open galaxy, and the locked galaxy whose panel shows
  // in its place after a tap or focus (null for the ship's own).
  private selection: RoutePosition | null = null;
  private viewing: RoutePosition | null = null;
  // The galaxy map opened in flight from the local map's Galaxies, over the paused flight.
  private galaxyMapInFlight = false;
  // The last unlock, flown on the route map at the next boarding: from the galaxy completed to
  // the farthest it opened, the opened positions still showing locked until then.
  private unlockFlight: RouteFlight | null = null;
  constructor(content: PrototypeContent, saved?: unknown) {
    this.content = content;
    this.state = restoreSave(saved) ?? newGameState();
    // Achievements the save already reached unlock without notices.
    unlockAchievements(ACHIEVEMENTS, ACHIEVEMENT_TOTALS, this.state.achievements, this.state);
    this.talk = new ConversationDirector(
      [...CONVERSATIONS, ...PROJECT_THANKS],
      this.state.seenConversations,
    );
    if (this.state.mode === "space") {
      const { dialogue, docked, flight, mode, notice } = this.state;
      this.heldFlight = { dialogue, docked, flight, mode, notice };
      this.state.mode = "home";
      this.state.flight = null;
      this.state.dialogue = null;
      this.state.docked = null;
      this.state.notice = "";
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
          canSkip: !currentPage(this.story).sleep && skipPassesPage(this.runScenes, this.story),
          choices: shownChoices(this.story),
          page: currentPage(this.story),
          run: this.run,
        }
      : null;
  }
  /** Ada's room page, with "Pick up the rock": the page whose pause card has Back to title. */
  get roomPage(): boolean {
    return this.story !== null && this.screen === "story" && currentPage(this.story).id === "room";
  }
  /** Whether the galaxy map shows: at boarding, or in flight over the local map. */
  get galaxyMapOpen(): boolean {
    return this.screen === "selector" || this.galaxyMapShownInFlight;
  }
  /** Whether the galaxy map opened in flight shows, over the paused flight's local map. */
  get galaxyMapShownInFlight(): boolean {
    return this.galaxyMapInFlight && this.state.mode === "space" && this.state.flight !== null;
  }
  /**
   * Whether the galaxy map's default action is Stay here: in flight, with the panel on the galaxy
   * Ada is flying in.
   */
  get galaxyMapStays(): boolean {
    return this.galaxyMapShownInFlight && this.selectedGalaxy === this.state.selectedSector;
  }
  /** The galaxy on show in the galaxy map's panel: the ship's, or a locked one viewed. */
  get selectedGalaxy(): SectorId | null {
    const position = this.selectedPosition;
    return position === null ? null : galaxyAt(position);
  }
  /** The route position on show in the galaxy map's panel, 1 to 6. */
  get selectedPosition(): RoutePosition | null {
    return this.galaxyMapOpen ? (this.viewing ?? this.selection) : null;
  }
  /** The route position the galaxy map's ship is on, always an open galaxy. */
  get shipPosition(): RoutePosition | null {
    return this.galaxyMapOpen ? this.selection : null;
  }
  /** The unlock the galaxy map flies as it opens at boarding, until it ends or is skipped. */
  get routeFlight(): RouteFlight | null {
    return this.screen === "selector" ? this.unlockFlight : null;
  }
  isUnlocked(galaxy: number): boolean {
    return this.state.unlocked.some((id) => id === galaxy);
  }
  private get current(): SectorProgress {
    return this.state.progress[this.state.selectedSector];
  }
  private get chapter(): ChapterContent {
    const sector = this.state.selectedSector;
    return this.content.chapters[sector] ?? placeholderChapter(sector);
  }
  private label(id: string): string {
    return this.content.labels[id] ?? "";
  }
  get inDanger(): boolean {
    return (this.state.flight?.dangerFor ?? 0) > 0;
  }
  get objective(): string {
    const p = this.current;
    const stages: Partial<Record<SectorId, readonly number[]>> = {
      1: [0, 1, 2, 3, 4],
      2: [0, 1, 2, 3, 4, 5],
      3: [0, 1, 2, 3, 4, 5],
    };
    // After the space quest, recovering the holodisk comes before the return home.
    const last = this.chapter.objectives.length - 1;
    const index = p.questComplete
      ? last - (p.holodisk ? 0 : 1)
      : (stages[this.state.selectedSector]?.[p.stage] ?? 0);
    return this.chapter.objectives[index] ?? "";
  }
  /**
   * The nearest known destination or discovered station within Talk range, its route open
   * (gameplay/rules.md "Talk range").
   */
  private nearest(): string | undefined {
    const f = this.state.flight;
    if (!f || this.state.mode !== "space" || this.state.dialogue) {
      return undefined;
    }
    return f.objects
      .filter(
        (o) =>
          ((o.kind === "destination" &&
            this.current.known.includes(o.id) &&
            !routeBlocked(o.id, f)) ||
            (o.kind === "station" && this.current.stations.includes(o.id))) &&
          Math.hypot(o.x - f.player.x, o.y - f.player.y) <= this.content.tuning.talkRange,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - f.player.x, a.y - f.player.y) -
          Math.hypot(b.x - f.player.x, b.y - f.player.y),
      )[0]?.id;
  }
  /** What Use does here, or undefined with nothing in reach. */
  get contextAction(): UseAction | undefined {
    const job = this.jobUse();
    if (job) {
      return job;
    }
    if (this.salvageable()) {
      return "salvage";
    }
    const id = this.nearest();
    if (!id) {
      return undefined;
    }
    // At a station an action due there comes before Dock (gameplay/rules.md).
    if (id === HUB_STATION) {
      if ((this.state.flight?.cargo ?? 0) > 0) {
        return "deposit";
      }
      return this.hubSceneDue ? undefined : "dock";
    }
    if (this.current.stations.includes(id)) {
      return this.supplyDue(id) ? "deliver" : "dock";
    }
    if ((id === "workshop" || id === "salvagers") && this.current.questItem) {
      return "deliver";
    }
    return "talk";
  }
  /**
   * The destination or station Use acts on and its action, for the Use callout above it;
   * undefined when Use acts on no place, as on a tow line's craft.
   */
  get useTarget(): { action: UseAction; id: string } | undefined {
    const action = this.contextAction;
    if (action === undefined || action === "tow") {
      return undefined;
    }
    const id = this.nearest();
    return id === undefined ? undefined : { action, id };
  }
  /** The Use action's name, the disc's accessible name. */
  get contextLabel(): string | undefined {
    const action = this.contextAction;
    return action === undefined ? undefined : this.label(action);
  }
  weapons(): WeaponChoice[] {
    return this.state.mode === "space" && this.state.flight ? ownedWeapons(this.state.flight) : [];
  }
  /** False when the switch is refused, as during the wait after the last switch. */
  selectWeapon(weapon: Weapon): boolean {
    const flight = this.state.flight;
    if (this.state.mode !== "space" || this.state.dialogue || this.state.docked || !flight) {
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
      ...this.current.stations
        .filter((id) => !this.current.known.includes(id))
        .map((id) => ({ id, label: this.label("station") })),
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
    if (flight.weapon === "laser" || owned.includes(flight.weapon)) {
      economy.weapon = flight.weapon;
    } else if (economy.weapon !== "laser" && !owned.includes(economy.weapon)) {
      economy.weapon = "laser";
    }
    economy.levels = structuredClone(flight.levels);
    // A granted weapon's flight ammunition stays out of the economy.
    for (const weapon of UPGRADE_WEAPONS) {
      if (!flight.grantedWeapons?.includes(weapon)) {
        economy.ammo[weapon] = flight.ammo[weapon];
      }
    }
  }
  /**
   * Gives an upgrade pickup's gift, chosen from what Ada can use as she collects it and seeded
   * by the pickup; the HUD's item notice names it from what Ada then holds. A new weapon joins
   * the roster with its packs and is equipped unless the switch wait runs.
   */
  private collectUpgrade(id: string, flight: FlightState): void {
    this.pullLoadout();
    const gift = chooseUpgrade(
      ECONOMY,
      this.state.economy,
      dropRandom(flight.seed, `upgrade:${id}`),
    );
    if (gift.kind === "weapon") {
      collectWeapon(gift.weapon, flight);
      this.pullLoadout();
    } else {
      applyUpgrade(ECONOMY, gift, this.state.economy);
      this.pushLoadout();
    }
    this.syncAchievements();
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
    for (const weapon of UPGRADE_WEAPONS) {
      if (!granted.includes(weapon)) {
        flight.ammo[weapon] = economy.ammo[weapon];
      }
    }
    // A bought shield level adds its capacity to the current charge.
    const after = shipTuning(ECONOMY, this.content, flight.levels).shieldMax;
    flight.shield = Math.min(after, flight.shield + Math.max(0, after - before));
  }
  shopRows(tab: ShopTab): ShopRow[] {
    this.pullLoadout();
    const holodisk = tab === "ship" ? this.holodiskRow() : null;
    return [...(holodisk ? [holodisk] : []), ...shopRows(ECONOMY, this.state.economy, tab)];
  }
  /**
   * The hub's holodisk row, first on its Ship tab once Cartwheel's space quest is complete:
   * Owned once bought (gameplay/economy.md). Null at any other station or before then.
   */
  private holodiskRow(): ShopRow | null {
    const sector = this.state.flight?.sector;
    if (this.state.docked !== HUB_STATION || sector !== 2) {
      return null;
    }
    const progress = this.state.progress[sector];
    if (!progress.questComplete) {
      return null;
    }
    return {
      inUse: false,
      item: { kind: "holodisk" },
      level: null,
      owned: progress.holodisk,
      price: progress.holodisk ? null : HOLODISKS.hubPrice,
    };
  }
  requestPurchase(item: ShopItem): PurchaseRequest {
    this.pullLoadout();
    if (item.kind === "holodisk") {
      const row = this.holodiskRow();
      const stardust = this.state.economy.stardust;
      return row?.price == null
        ? { kind: "refused", reason: "notForSale" }
        : row.price > stardust
          ? { kind: "refused", reason: "cantAfford" }
          : { kind: "confirm", left: stardust - row.price, price: row.price };
    }
    return requestPurchase(ECONOMY, this.state.economy, item);
  }
  /**
   * Purchases happen only while docked. Buying the hub's holodisk closes the station card and
   * plays its insertion, as funding a project closes it for the thank-you line.
   */
  buy(item: ShopItem): PurchaseResult {
    if (!this.state.docked) {
      return { kind: "refused", reason: "notForSale" };
    }
    if (item.kind === "holodisk") {
      const request = this.requestPurchase(item);
      if (request.kind === "refused") {
        return request;
      }
      this.state.economy.stardust -= request.price;
      this.undock();
      this.recoverHolodisk();
      this.syncAchievements();
      return { kind: "bought", price: request.price };
    }
    this.pullLoadout();
    const result = buy(ECONOMY, item, this.state.economy);
    this.pushLoadout();
    this.syncAchievements();
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
    return projectViews(galaxyProjects(sector), this.state.progress[sector]);
  }
  /** The donation confirm for a docked galaxy's project (projects.ts). */
  donationRequest(id: string): DonationRequest {
    const sector = this.state.flight?.sector;
    if (!this.state.docked || !sector) {
      return { kind: "refused" };
    }
    return donationRequest(
      galaxyProjects(sector),
      this.state.progress[sector],
      this.state.economy.stardust,
      id,
    );
  }
  /**
   * A confirmed donation toward a docked galaxy's project. Funding the last part closes the
   * station card and queues the speaker's thank-you line in the conversation box.
   */
  donate(id: string): DonationResult {
    const sector = this.state.flight?.sector;
    if (!this.state.docked || !sector) {
      return { kind: "refused" };
    }
    const economy = this.state.economy;
    const result = donate(
      galaxyProjects(sector),
      this.state.progress[sector],
      economy.stardust,
      id,
    );
    if (result.kind === "paid") {
      economy.stardust -= result.amount;
      if (result.funded) {
        this.undock();
        this.talk.thank(id);
        this.recordAchievement({ id, kind: "projectFunded" });
      }
    }
    return result;
  }
  /** Each galaxy's allies for the Black Eye finale, one per funded project. */
  allies(sector: SectorId): ReturnType<typeof projectAllies> {
    return projectAllies(galaxyProjects(sector), this.state.progress[sector]);
  }
  /** Each galaxy's world changes at their sites, one per funded project (projects.ts). */
  worldChanges(sector: SectorId): WorldChange[] {
    return worldChanges(galaxyProjects(sector), this.state.progress[sector]);
  }
  /** Records that a funded project's world change has played its one reveal (projects.ts). */
  revealWorldChange(sector: SectorId, id: string): boolean {
    return revealWorldChange(galaxyProjects(sector), this.state.progress[sector], id);
  }
  selectPaint(scheme: string): boolean {
    return selectPaint(ECONOMY, scheme, this.state.economy);
  }
  /** Undocking leaves Ada at rest where she docked (gameplay/economy.md). */
  undock(): void {
    if (this.state.docked && this.state.flight) {
      undockFlight(this.state.flight);
    }
    this.state.docked = null;
    this.greeting = null;
  }
  /**
   * A docking's keeper greeting (gameplay/rules.md "Species and greeters"): the full greeting the
   * first time, then one later line in turn. The docking counts as greeted at once.
   */
  private greet(sector: SectorId, id: string): void {
    const keeper = stationKeeper(ECONOMY, sector, id);
    if (!keeper) {
      this.greeting = null;
      return;
    }
    const greetings = this.state.progress[sector].greetings;
    const docked = greetings[id] ?? 0;
    greetings[id] = docked + 1;
    this.greeting = {
      index: 0,
      keeper: keeper.key,
      lines: greetingLines(keeper.greetings, docked),
    };
  }
  /** The docked station keeper's line on show; null where the generic welcome shows. */
  get stationGreeting(): StationGreeting | null {
    const greeting = this.greeting;
    return this.state.docked && greeting
      ? {
          count: greeting.lines.length,
          index: greeting.index,
          keeper: greeting.keeper,
          line: greeting.lines[greeting.index]!,
        }
      : null;
  }
  /** A tap on the keeper block: the greeting's next line, the last staying on show. */
  advanceGreeting(): void {
    const greeting = this.greeting;
    if (this.state.docked && greeting && greeting.index < greeting.lines.length - 1) {
      greeting.index += 1;
    }
  }
  /**
   * Docks at a station in Talk range: the station card opens, and a delivery job's lost item is
   * replaced at its issuing station.
   */
  private dock(id: string, f: FlightState): void {
    if (!dockFlight(this.content, id, f)) {
      return;
    }
    this.state.docked = id;
    this.dockedThisFlight = true;
    this.greet(f.sector, id);
    const held = this.held;
    if (held?.type === "delivery" && held.station === id) {
      held.carrying = true;
    }
  }
  /**
   * Whether a Cartwheel story scene near the hub or its line is still to play: Dock waits until
   * both have ended (gameplay/rules.md).
   */
  private get hubSceneDue(): boolean {
    return Boolean(this.state.flight?.storyScene?.lineDue);
  }
  /** Whether a carried supply run is bound for this station, so Use delivers it there. */
  private supplyDue(id: string): boolean {
    const f = this.state.flight;
    const activity = f && heldActivity(f.sector, this.state);
    return activity?.id === "supplyRun" && activity.carrying === true && activity.target?.id === id;
  }
  private panel(context: string, text: string, title = this.chapter.name): void {
    this.state.dialogue = {
      choices: [{ id: "continue", label: this.label("continue") }],
      context,
      text,
      title,
    };
  }
  /**
   * Talk at a story place once its galaxy's chapter is complete (gameplay/quests.md "Repeatable
   * activities"): with the slot empty, its activity line with Accept and Not now; while a job or
   * another place's activity holds the slot, the same line with Accept refused; while its own
   * activity is active, that activity's objective with Drop, replacing a supply run's lost item.
   * Else its usual line.
   */
  private talkAt(place: string, key: string): void {
    const f = this.state.flight;
    const activity = f && placeActivity(f.sector, this.current, place);
    if (!f || !activity) {
      this.exchange(key);
      return;
    }
    const speaker = this.chapter.dialogue[key]?.speaker ?? this.chapter.name;
    const held = heldActivity(f.sector, this.state);
    if (held?.place === place) {
      if (held.id === "supplyRun") {
        held.carrying = true;
      }
      this.state.dialogue = {
        choices: [
          { id: "drop", label: this.label("jobDrop") },
          { id: "continue", label: this.label("continue") },
        ],
        context: `activityActive:${place}`,
        text: this.jobObjective ?? "",
        title: speaker,
      };
      return;
    }
    // No offer without its terms: a calf start for the family where it is this flight, or a
    // known station far enough for a supply run.
    if (!this.activityTerms(f, place)) {
      this.exchange(key);
      return;
    }
    const busy = this.state.tasks[f.sector];
    this.state.dialogue = {
      choices: [
        { id: "take", label: this.label("activityTake"), ...(busy ? { refused: true } : {}) },
        { id: "skip", label: this.label("activitySkip") },
      ],
      context: `activity:${place}`,
      text: this.label(activity.places[place]!),
      title: speaker,
    };
  }
  /**
   * The terms a place's activity would be accepted on now, or null when it makes no offer: the
   * next guide's calf start from the family where it is this flight, a supply run's destination
   * and pay from the known stations, or the activity's own reward.
   */
  private activityTerms(f: FlightState, place: string): ActivityTerms | null {
    const activity = placeActivity(f.sector, this.current, place);
    const at = f.objects.find((o) => o.kind === "destination" && o.id === place);
    if (!activity || !at) {
      return null;
    }
    if (activity.id === "supplyRun") {
      const stations = this.current.stations.flatMap(
        (id) => stationById(ECONOMY, f.sector, id) ?? [],
      );
      return supplyTerms(f.sector, stations, at);
    }
    if (activity.id === "guideCalf") {
      const start = calfStart(f.sector, at, this.current.guides ?? 0);
      return start ? { reward: activity.reward!, start } : null;
    }
    return { reward: activity.reward! };
  }
  /** Accepts the offered activity, or refuses while the galaxy's slot is taken. */
  private takeActivity(place: string): void {
    const f = this.state.flight;
    if (!f) {
      return;
    }
    const busy = this.state.tasks[f.sector];
    if (busy) {
      this.notify(this.label(busy.kind === "job" ? "jobBusy" : "activityBusy"));
      return;
    }
    const terms = this.activityTerms(f, place);
    if (!terms || !acceptActivity(f.sector, this.current, this.state, place, terms)) {
      return;
    }
    if (terms.start) {
      this.current.guides = (this.current.guides ?? 0) + 1;
    }
    this.state.dialogue = null;
  }
  /**
   * Returns the galaxy's held activity to its start: the guided calf goes back to its start spot
   * and its hunter pack is placed again. Leaving the galaxy (the galaxy map's Earth or Jump), a
   * shield-depletion jump, Drop and Back to title use it.
   */
  resetActivity(sector: SectorId): void {
    const f = this.state.flight;
    if (f?.sector === sector && heldActivity(sector, this.state)?.id === "guideCalf") {
      delete f.calf;
    }
  }
  /** Drops the held activity, losing its progress. */
  private dropHeldActivity(sector: SectorId): boolean {
    this.resetActivity(sector);
    return dropActivity(sector, this.state);
  }
  /** Pays the held activity with the job completion notice and frees the galaxy's slot. */
  private finishActivity(sector: SectorId): void {
    const reward = completeActivity(sector, this.state);
    if (!reward) {
      return;
    }
    this.state.economy.stardust += reward;
    this.notify(fill(this.label("jobComplete"), { amount: reward }));
    this.recordAchievement({ kind: "activityCompleted" });
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
    rerollBoards(this.state.selectedSector, this.state);
    for (const id of this.current.known) {
      ensureDestination(this.content, id, this.state.flight);
    }
    this.explore(this.state.flight);
    this.ensureWhaleDebris();
    this.beginConversations();
  }
  /** Records the chunk Ada is in to the galaxy's explored record, which the Map's fog reveals. */
  private explore(f: FlightState): void {
    recordExplored(this.content.tuning.chunkSize, this.current.explored, f.player);
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
    this.closeSelection();
    this.launch();
  }
  private home(forced: boolean): void {
    if (!forced && this.inDanger) {
      this.notify(this.label("travelUnavailable"));
      return;
    }
    this.endFlight();
    this.beginVisit();
  }
  /**
   * Ends the flight with story progress saved: a carried story or delivery item is lost, a towed
   * craft, a guided calf and Pip return to their starts, and a scene still due its line replays
   * at the hub next time.
   */
  private endFlight(): void {
    this.closeGalaxyMapInFlight();
    this.current.questItem = null;
    // A delivery's item is lost like a story item, and a towed craft returns to where it was
    // stranded with the flight.
    const held = heldJob(this.state.selectedSector, this.state);
    if (held?.type === "delivery") {
      held.carrying = false;
    }
    const activity = this.activity;
    if (activity?.id === "supplyRun") {
      activity.carrying = false;
    }
    this.resetActivity(this.state.selectedSector);
    // A story scene still due its line replays at the hub on the next flight.
    const scene = this.state.flight?.storyScene;
    if (scene?.lineDue) {
      this.current.replayScene = scene.id;
    }
    this.pullLoadout();
    this.previousSeed = this.state.flight?.seed ?? this.previousSeed;
    this.talk.endFlight();
    this.state.mode = "home";
    this.state.flight = null;
    this.state.dialogue = null;
    this.state.docked = null;
  }
  returnHome(): void {
    this.home(false);
  }
  /**
   * Back to title: the start screen, where Continue resumes. From flight it first ends the flight
   * as the galaxy map's Earth does, with story progress saved and no sleep scene, even in danger;
   * it also leaves Ada's room page.
   */
  backToTitle(): void {
    if (this.state.mode === "space" && this.state.flight) {
      this.home(true);
    } else if (!this.roomPage) {
      return;
    }
    this.story = null;
    this.closeSelection();
    this.startShown = true;
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
    if (f.tow) {
      this.notify(this.label("towTravel"));
      return;
    }
    if (this.carrying) {
      this.notify(this.label("carryTravel"));
      return;
    }
    if (station) {
      ensureStation(this.content, id, f);
    } else {
      ensureDestination(this.content, id, f);
    }
    // Travel ends a guide's follow: the calf waits where it is.
    if (f.calf) {
      f.calf.following = false;
    }
    teleportFlight(this.content, id, f);
    this.explore(f);
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
  /**
   * Once a galaxy's holodisk, space quest and home resolution are done, unlocks the next position
   * on the route, every placeholder after it and the next built galaxy (unlockedBy).
   */
  private unlockNext(galaxy: SectorId = this.state.selectedSector): void {
    const p = this.state.progress[galaxy];
    if (!p.holodisk || !p.questComplete || !p.resolved) {
      return;
    }
    const fresh = unlockedBy(galaxy).filter((id) => !this.state.unlocked.includes(id));
    if (fresh.length === 0) {
      return;
    }
    this.state.unlocked.push(...fresh);
    const opened = fresh.map((id) => ROUTE_POSITION[id]);
    this.unlockFlight = {
      from: ROUTE_POSITION[galaxy],
      opened,
      to: Math.max(...opened) as RoutePosition,
    };
    // Astra announces it only when a newly unlocked galaxy has a built story.
    this.state.announceGalaxy = fresh.some((id) => Object.hasOwn(this.content.chapters, id));
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
  /** The insertion panels, then Astra's memory line for how many holodisks she now holds. */
  private insertion(index: number): void {
    const { inserted, memories } = this.content.premise.holodisk;
    // Astra, who speaks the last insertion line, continues with the memory.
    const memory = {
      speaker: inserted.at(-1)?.speaker,
      text: memories[holodisksHeld(this.state.progress) - 1] ?? "",
    };
    const lines = [...inserted, memory];
    const line = lines[index];
    if (line) {
      this.panel(`holodisk:${index}`, line.text, line.speaker);
    } else {
      this.state.dialogue = null;
    }
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
    // Before the step, so a sensed cache collected this step still counts as reached.
    reachSensed(PENNY_FIND_RANGE, f.sector, f.objects, f.player, this.state.achievements);
    const previousFreshDistance = f.freshDistance;
    const events = stepFlight(this.content, dt, input, f);
    this.carryStoryPickups(dt, f);
    this.explore(f);
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
      if (event.type === "outOfAmmo") {
        this.notify(this.label("outOfAmmo"));
      }
      if (event.type === "stationDiscovered" && !this.current.stations.includes(event.id)) {
        this.current.stations.push(event.id);
        newStation = true;
      }
      if (event.type === "enemyDestroyed") {
        this.current.destroyedEnemies++;
      }
      if (event.type === "upgradeCollected") {
        this.collectUpgrade(event.id, f);
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
    // However the hub became known, it is one of Cartwheel's discovered stations.
    if (
      f.sector === 2 &&
      this.current.known.includes(HUB_STATION) &&
      !this.current.stations.includes(HUB_STATION)
    ) {
      this.current.stations.push(HUB_STATION);
    }
    const charted = chartLandmarks(f.sector, this.current, f.player);
    mapped.push(...charted);
    for (const id of charted) {
      this.recordAchievement({ galaxy: f.sector, id, kind: "landmarkCharted" });
    }
    this.stepJob(f);
    this.stepCalf(dt, f);
    const jobMoments = this.jobMoments;
    this.jobMoments = [];
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
      docked: this.dockedThisFlight,
      dronesNear: dronesNear(this.content, f),
      guardCues: events.flatMap((event) =>
        event.type === "guardCue"
          ? [{ destination: event.id, pick: dropRandom(f.seed, `guard-line:${event.id}`)() }]
          : [],
      ),
      heavyDisabled: events.some((event) => event.type === "enemyDisabled"),
      holodisks: holodisksHeld(this.state.progress),
      inCurrent: inCurrent(f.sector, 0, f.player),
      inDanger: this.inDanger,
      jobMoments,
      lostItemNear: this.lostItemNear(f),
      moved: Math.hypot(input.move.x, input.move.y) > 0,
      newStation,
      newlyMapped: mapped,
      pennyPoints: pennyPoints(
        this.current,
        this.holodiskWaypoint,
        unchartedNear(f.sector, this.current, CONVERSATION_TUNING.pennyRange, f.player),
        f,
      ),
      shieldFraction: this.shieldMax > 0 ? f.shield / this.shieldMax : 1,
      stardustInSight: f.objects.some(
        (object) => carriesStardust(object) && near(CONVERSATION_TUNING.stardustSightRange)(object),
      ),
    });
    recordSensed(this.state.achievements, this.talk.takeSensed());
    this.syncAchievements();
    // One achievement notice at a time, each once the notice slot is free.
    const unlocked = this.state.notice ? undefined : this.achievementNotices.shift();
    if (unlocked !== undefined) {
      this.notify(fill(this.label("achievement"), { name: unlocked }));
    }
    const opener = first(f.sector);
    if (
      opener !== undefined &&
      !this.current.introduced &&
      f.freshDistance >= this.content.tuning.introFreshDistance
    ) {
      ensureDestination(this.content, opener, f);
      if (f.freshDistance > previousFreshDistance && !this.current.known.includes(opener)) {
        this.placePending(opener);
      }
    }
    if (
      this.current.introduced &&
      !this.current.questComplete &&
      f.freshDistance >=
        this.content.tuning.introFreshDistance +
          this.current.stage * this.content.tuning.encounterFreshDistance
    ) {
      const id = required[f.sector]?.[this.current.stage];
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
    ensureHuntingPacks(this.content, f);
    this.ensureWhaleDebris();
    // A scene cut short by an earlier flight's end replays once Ada reaches the hub.
    const replay = this.current.replayScene;
    const hub = replay && f.objects.find((o) => o.kind === "destination" && o.id === "hub");
    if (
      replay &&
      hub &&
      !f.storyScene?.lineDue &&
      Math.hypot(hub.x - f.player.x, hub.y - f.player.y) <= this.content.tuning.safeRadius
    ) {
      f.storyScene = { at: f.time, id: replay, lineDue: true };
      delete this.current.replayScene;
    }
    // A story ship scene plays first; its line follows when it ends.
    const scene = f.storyScene;
    if (
      scene?.lineDue &&
      !this.state.dialogue &&
      f.time >= scene.at + CARTWHEEL_STORY_SHIPS.scenes[scene.id].duration
    ) {
      scene.lineDue = false;
      this.exchange(CARTWHEEL_STORY_SHIPS.scenes[scene.id].line);
      return;
    }
    const intro = first(f.sector);
    if (
      intro !== undefined &&
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
      job: this.jobIndicator(f),
      objective: this.objectiveId(f.sector),
      progress: p,
      questItem: questItemDestination(p),
      sector: f.sector,
    });
  }
  /**
   * The pause menu's Map of the current galaxy (map.ts), or null outside a flight: with its
   * charted landmarks (landmarks.ts) and the held job's target.
   */
  get map(): GalaxyMap | null {
    const f = this.state.flight;
    if (!f || this.state.mode !== "space") {
      return null;
    }
    const labels = new Map(this.destinations().map(({ id, label }) => [id, label]));
    return galaxyMap({
      catalog: ECONOMY,
      chunkSize: this.content.tuning.chunkSize,
      destinations: galaxyRoute(f.sector),
      explored: this.current.explored,
      flight: f,
      holodisk: this.holodiskWaypoint
        ? (f.objects.find((o) => o.kind === "destination" && o.id === "holodisk") ?? null)
        : null,
      job: this.jobMapTarget(f),
      label: (id, kind) =>
        kind === "holodisk" ? this.label("mapHolodiskWaypoint") : (labels.get(id) ?? id),
      landmarks: {
        charted: galaxyLandmarks(f.sector, this.current)
          .filter(({ charted }) => charted)
          .map(({ id, kind, name, x, y }) => ({ id, kind, label: this.label(name), x, y })),
        total: landmarkSites(f.sector).length,
      },
      objective: this.objectiveId(f.sector),
      progress: this.current,
      quests: {
        job: this.jobObjective,
        story: this.objective,
        storyComplete: this.current.resolved,
      },
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
  /** The floating holodisk while it is a pickup, the waypoint the family gives. */
  private floatingHolodisk(f: FlightState): SpaceObject | undefined {
    return this.holodiskWaypoint
      ? f.objects.find((o) => o.kind === "destination" && o.id === "holodisk")
      : undefined;
  }
  /** Ada is within pickup reach of the holodisk, a pickup-sized object. */
  private holodiskTouched(f: NonNullable<GameState["flight"]>): boolean {
    const disk = this.floatingHolodisk(f);
    return (
      disk !== undefined &&
      pickupTouched(this.content, f, disk, this.content.tuning.flight.pickupRadius)
    );
  }
  /**
   * The pickups the model holds outside the flight's objects, the floating holodisk and a hunt's
   * lost item, move as every pickup does: a current drifts them and the tractor beam pulls them.
   */
  private carryStoryPickups(dt: number, f: FlightState): void {
    const ship = shipTuning(ECONOMY, this.content, f.levels);
    const disk = this.floatingHolodisk(f);
    if (disk) {
      carryPickup(ship, dt, f, disk);
    }
    const held = this.held;
    if (held?.type === "hunt" && held.spot) {
      carryPickup(ship, dt, f, held.spot);
    }
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
      for (const guard of f.objects.filter(
        (object) => object.routeId === id || object.id.startsWith(`hunt:${id}:`),
      )) {
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
      const asteroid = tuning.asteroids[i % tuning.asteroids.length]!;
      f.objects.push({
        asteroid,
        hp: tuning.hp,
        id: `whale-debris:${i}`,
        kind: "debris",
        radius: ASTEROID_SHAPES.get(asteroid)!.radius,
        x: whale.x + Math.cos(angle) * tuning.spacing,
        y: whale.y + Math.sin(angle) * tuning.spacing,
      });
    }
  }
  interact(): void {
    if (this.useJob()) {
      return;
    }
    const flight = this.state.flight;
    if (flight && this.salvageable() && salvage(this.content, flight)) {
      return;
    }
    const id = this.nearest();
    const f = this.state.flight;
    if (!id || !f) {
      return;
    }
    if (id !== HUB_STATION && this.current.stations.includes(id)) {
      if (this.supplyDue(id)) {
        this.finishActivity(f.sector);
      } else {
        this.dock(id, f);
      }
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
        this.talkAt(id, dialogueKeys[id] ?? id);
      }
    } else if (f.sector === 2) {
      if (id === HUB_STATION && f.cargo === 0) {
        if (!this.hubSceneDue) {
          this.dock(id, f);
        }
      } else if (id === HUB_STATION) {
        const load = f.cargo;
        p.deposited += load;
        f.cargo = 0;
        if (contractDeposit(f.sector, this.state, load)) {
          this.finishActivity(f.sector);
        }
        const [a, b, c] = this.content.tuning.miningMilestones;
        if (p.stage === 1 && p.deposited >= a) {
          p.stage = 2;
          f.storyScene = { at: f.time, id: "blocked", lineDue: true };
        } else if (p.stage === 4 && p.deposited >= c) {
          p.stage = 5;
          f.storyScene = { at: f.time, id: "docking", lineDue: true };
          this.complete();
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
      this.talkAt(id, id);
    }
  }
  /** The current galaxy's held station job. */
  private get held(): HeldJob | undefined {
    return heldJob(this.state.selectedSector, this.state);
  }
  /** Known outposts in the flight: delivery destinations and tow safe places. */
  private outposts(flight: FlightState): JobTarget[] {
    return flight.objects
      .filter(
        (object) =>
          object.kind === "destination" &&
          object.id !== "holodisk" &&
          this.current.known.includes(object.id),
      )
      .map(({ id, x, y }) => ({ id, x, y }));
  }
  /**
   * Where a towed craft is safe (quests.md "Rescue and tow"): any known station or outpost in
   * the galaxy, the issuing station among them, the hub listed once as the outpost it also is.
   */
  private towPlaces(flight: FlightState): JobTarget[] {
    const outposts = this.outposts(flight);
    const held = this.held;
    const ids = [...this.current.stations, ...(held ? [held.station] : [])];
    const stations = [...new Set(ids)]
      .filter((id) => !outposts.some((outpost) => outpost.id === id))
      .flatMap((id) => this.stationSite(flight, id) ?? []);
    return [...outposts, ...stations.map(({ id, x, y }) => ({ id, x, y }))];
  }
  private jobContext(flight: FlightState): BoardContext {
    return {
      hostiles: jobHostiles(flight),
      outposts: this.outposts(flight),
      progress: this.current,
      sector: flight.sector,
    };
  }
  private jobStation(job: HeldJob): StationSite | null {
    const f = this.state.flight;
    return f && f.sector === this.state.selectedSector
      ? this.stationSite(f, job.station)
      : stationById(ECONOMY, this.state.selectedSector, job.station);
  }
  /**
   * A place's name inside a sentence, as job titles and objectives use it, with its article: a
   * station's or a story destination's sentence name (data/destinations.ts), else its Map name.
   */
  private placeLabel(id: string): string {
    if (id.startsWith("station:")) {
      return STATION_SENTENCE;
    }
    return (
      DESTINATIONS[id]?.sentence ??
      this.destinations().find((place) => place.id === id)?.label ??
      this.chapter.dialogue[dialogueKeys[id] ?? id]?.speaker ??
      this.chapter.name
    );
  }
  /** A job's title and one line of detail (gameplay/quests.md "Player strings"). */
  jobText(job: JobOffer): { readonly detail: string; readonly title: string } {
    const titles: Record<JobType, string> = {
      delivery: fill(this.label("deliveryTitle"), {
        item: job.item,
        place: this.placeLabel(job.target.id),
      }),
      hunt: fill(this.label("huntTitle"), { item: job.item }),
      rescue: fill(this.label("rescueTitle"), { craft: job.item }),
      survey: fill(this.label("surveyTitle"), {
        landmark: this.label(landmarkById(this.state.selectedSector, job.target.id)?.name ?? ""),
      }),
    };
    return { detail: this.label(`${job.type}About`), title: titles[job.type] };
  }
  /**
   * The docked station's job board: the held job first, marked Active, then the station's
   * offers, which refuse while the galaxy's optional task slot is taken.
   */
  jobBoard(): JobRow[] {
    const f = this.state.flight;
    const site = f && this.state.docked && this.stationSite(f, this.state.docked);
    if (!f || !site) {
      return [];
    }
    const board = stationBoard(this.jobContext(f), this.state, site);
    const held = this.held;
    const busy = Boolean(this.state.tasks[f.sector]);
    const row = (job: JobOffer, state: JobRow["state"]): JobRow => ({
      ...this.jobText(job),
      id: job.id,
      kind: "job",
      reward: job.reward,
      state,
      type: job.type,
    });
    // An active activity heads the board, marked Active with Drop, as a held job does; a
    // station that offers the galaxy's activity (the hub's mining contract) heads its board with
    // the offer instead.
    const activity = this.activity;
    const offered = activity ? null : this.boardActivity(f, site.id);
    const activityRow: JobRow[] =
      activity || offered
        ? [
            {
              detail: this.label(ACTIVITIES[f.sector]?.goal ?? ""),
              id: activity?.id ?? offered!.id,
              kind: "activity",
              reward: activity?.reward ?? offered!.reward,
              state: activity ? "held" : busy ? "busy" : "offer",
              title: ACTIVITIES[f.sector]?.name ?? "",
              type: "activity",
            },
          ]
        : [];
    return [
      ...activityRow,
      ...(held ? [row(held, "held")] : []),
      ...board
        .filter((offer) => offer.id !== held?.id)
        .map((offer) => row(offer, busy ? "busy" : "offer")),
    ];
  }
  /** Why a board's Accept refuses while the slot is taken: an activity, else a held job. */
  get jobBusyLine(): string {
    return this.label(this.activity ? "activityBusy" : "jobBusy");
  }
  /** Accepts an offer on the docked station's board, with no confirm. */
  acceptJob(id: string): "accepted" | "busy" | "missing" {
    const station = this.state.docked;
    const f = this.state.flight;
    if (!station || !f) {
      return "missing";
    }
    const offered = this.boardActivity(f, station);
    if (offered?.id === id) {
      if (this.state.tasks[f.sector]) {
        return "busy";
      }
      this.takeActivity(station);
      return heldActivity(f.sector, this.state) ? "accepted" : "missing";
    }
    return acceptJob(f.sector, station, id, this.state);
  }
  /**
   * The galaxy's activity a docked station offers on its board, with its reward: the hub's
   * mining contract once the chapter is resolved. Null at any other station.
   */
  private boardActivity(f: FlightState, station: string): { id: string; reward: number } | null {
    const activity = placeActivity(f.sector, this.current, station);
    const terms = activity && this.activityTerms(f, station);
    return activity && terms ? { id: activity.id, reward: terms.reward } : null;
  }
  /**
   * A station's site: a seeded station's, or the hub's where it stands in this flight, since the
   * hub is Cartwheel's station (gameplay/rules.md).
   */
  private stationSite(f: FlightState, id: string): StationSite | null {
    const seeded = stationById(ECONOMY, f.sector, id);
    if (seeded || id !== HUB_STATION || f.sector !== 2) {
      return seeded;
    }
    const hub = f.objects.find((object) => object.kind === "destination" && object.id === id);
    return hub ? { id, x: hub.x, y: hub.y } : null;
  }
  /**
   * Drops the task in the galaxy's slot: an activity, losing its progress, or the held job, whose
   * towed craft goes back to where it was stranded.
   */
  dropJob(): boolean {
    if (this.dropHeldActivity(this.state.selectedSector)) {
      return true;
    }
    const dropped = dropJob(this.state.selectedSector, this.state);
    if (dropped && this.state.flight) {
      delete this.state.flight.tow;
    }
    return dropped;
  }
  /** The held job's objective, shown beside the story objective and labelled Job. */
  get jobObjective(): string | null {
    const held = this.held;
    if (held) {
      return this.jobText(held).title;
    }
    const activity = this.activity;
    if (activity?.id === "supplyRun") {
      return fill(this.label("supplyObjective"), {
        destination: this.placeLabel(activity.target?.id ?? ""),
        item: SUPPLY_ITEMS[activity.place] ?? "",
      });
    }
    if (activity?.id === "miningContract") {
      return fill(this.label("contractObjective"), { have: activity.deposited ?? 0 });
    }
    if (activity?.id === "guideCalf") {
      return this.label(this.state.flight?.calf?.following ? "calfGuide" : "calfFind");
    }
    return null;
  }
  /** The current galaxy's accepted activity. */
  private get activity(): HeldActivity | undefined {
    return heldActivity(this.state.selectedSector, this.state);
  }
  /** Whether Whirlpool's guided calf is away from its family: while Guide a calf is held. */
  get calfAway(): boolean {
    return heldActivity(3, this.state)?.id === "guideCalf";
  }
  /** The guided calf in this flight, for the scene. */
  get guidedCalf(): Readonly<GuidedCalf> | null {
    return this.state.mode === "space" ? (this.state.flight?.calf ?? null) : null;
  }
  /**
   * What Ada carries in flight: a rescue's towed craft, a delivery's item or a supply run's
   * cargo; null with nothing aboard.
   */
  get aboard(): Aboard | null {
    if (this.state.mode !== "space" || !this.state.flight) {
      return null;
    }
    const held = this.held;
    if (this.towing && held) {
      return { kind: "towing", name: carriedItemName(held.item) };
    }
    if (held?.carrying) {
      return { kind: "carrying", name: carriedItemName(held.item) };
    }
    const activity = this.activity;
    if (activity?.id === "supplyRun" && activity.carrying) {
      return { kind: "carrying", name: carriedItemName(SUPPLY_ITEMS[activity.place] ?? "") };
    }
    const story = this.current.questItem;
    if (story !== null && STORY_ITEM_NAMES[story] !== undefined) {
      return { kind: "carrying", name: STORY_ITEM_NAMES[story] };
    }
    return null;
  }
  /** The Ship card's facts: what Ada carries this flight and her ship's levels and weapons. */
  get ship(): ShipState {
    const { economy, flight } = this.state;
    const levels = (this.state.mode === "space" && flight?.levels) || economy.levels;
    return {
      aboard: this.aboard,
      engine: levels.engine,
      holodisks: Object.values(this.state.progress).filter((progress) => progress.holodisk).length,
      ore: this.state.mode === "space" ? (flight?.cargo ?? 0) : 0,
      paint: economy.paint,
      shield: levels.shield,
      stardust: economy.stardust,
      tractor: levels.tractor,
      weapons: this.weapons().map((choice) => ({
        ammo: choice.ammo,
        id: choice.id,
        level: levels.weapons[choice.id],
      })),
    };
  }
  /** Whether a rescue's tow line is attached, which refuses Travel. */
  get towing(): boolean {
    return this.state.mode === "space" && Boolean(this.state.flight?.tow);
  }
  /** Whether Use salvages a disabled heavy here: in flight, with no conversation or card open. */
  private salvageable(): boolean {
    const f = this.state.flight;
    return (
      f !== null &&
      this.state.mode === "space" &&
      !this.state.dialogue &&
      !this.state.docked &&
      salvageTarget(this.content, f) !== undefined
    );
  }
  /** A delivery's or a supply run's item is aboard in flight: Travel here refuses, as towing. */
  get carrying(): boolean {
    if (this.state.mode !== "space" || !this.state.flight) {
      return false;
    }
    const activity = this.activity;
    return Boolean(
      (this.held?.type === "delivery" && this.held.carrying) ||
      (activity?.id === "supplyRun" && activity.carrying),
    );
  }
  /** What the Use button does for the held job here, if anything: Tow or Deliver. */
  private jobUse(): "tow" | "deliver" | null {
    const f = this.state.flight;
    const held = this.held;
    if (!f || this.state.mode !== "space" || this.state.dialogue || this.state.docked) {
      return null;
    }
    if (!held) {
      return null;
    }
    if (
      held.type === "rescue" &&
      !f.tow &&
      distance(held.target, f.player) <= JOB_TUNING.tow.attach
    ) {
      return "tow";
    }
    // A delivery bound for a station or an outpost hands over with Use, before Dock.
    if (held.type === "delivery" && held.carrying && this.nearest() === held.target.id) {
      return "deliver";
    }
    return null;
  }
  /** Use for the held job: attaches the tow line or delivers to a station or an outpost. */
  private useJob(): boolean {
    const use = this.jobUse();
    const f = this.state.flight;
    const held = this.held;
    if (!use || !f || !held) {
      return false;
    }
    if (use === "tow") {
      f.tow = { x: held.target.x, y: held.target.y };
      this.jobMoments.push("towAttached");
    } else {
      this.finishJob(f);
    }
    return true;
  }
  /** Pays the held job wherever Ada is, refills its board slot and asks for a lore line. */
  private finishJob(flight: FlightState): void {
    const held = this.held;
    if (!held) {
      return;
    }
    const reward = completeJob(this.jobContext(flight), this.jobStation(held), this.state);
    delete flight.tow;
    this.state.economy.stardust += reward;
    this.notify(fill(this.label("jobComplete"), { amount: reward }));
    this.jobMoments.push("jobComplete");
    this.recordAchievement({ kind: "jobCompleted" });
  }
  /** One flight step of the held job: surveys, the tow line and the hunt. */
  private stepJob(f: FlightState): void {
    const held = this.held;
    if (!held) {
      return;
    }
    if (held.type === "survey" && this.current.charted.includes(held.target.id)) {
      this.finishJob(f);
    } else if (held.type === "rescue" && f.tow) {
      pullTow(f.player, f.tow);
      const place = nearestSafePlace(this.towPlaces(f), null, f.tow);
      if (place && distance(place, f.tow) <= JOB_TUNING.tow.complete) {
        this.finishJob(f);
      }
    } else if (held.type === "hunt") {
      if (!held.entered && distance(held.target, f.player) <= JOB_TUNING.hunt.radius) {
        held.entered = true;
        this.jobMoments.push("searchEntered");
      }
      const { pickupRadius } = this.content.tuning.flight;
      // The lost item is touched as its glint is drawn, with the pickups' shared reach.
      if (
        held.spot &&
        pickupTouched(this.content, f, held.spot, pickupRadius, HUNT_GLINT ?? null)
      ) {
        this.flightEvents.push({
          id: "hunt-glint",
          lostItem: true,
          type: "collected",
          ...held.spot,
        });
        this.finishJob(f);
      }
    }
  }
  /**
   * One flight step of Guide a calf: the calf waits at its start with its hunter pack at the
   * midpoint home, placed again after a reset, then follows Ada and completes at the family.
   */
  private stepCalf(dt: number, f: FlightState): void {
    const activity = heldActivity(f.sector, this.state);
    const family = f.objects.find((o) => o.kind === "destination" && o.id === "family");
    if (activity?.id !== "guideCalf" || !activity.start || !family) {
      return;
    }
    if (!f.calf) {
      f.calf = placedCalf(family, activity.start);
      const next = dropRandom(f.seed, `calf-pack:${this.current.guides ?? 0}`);
      const [fewest, most] = HUNTING_PACKS.count;
      placeHuntingPack(
        this.content,
        "hunt:calf",
        calfRouteMidpoint(family, activity.start),
        fewest + Math.floor(next() * (most - fewest + 1)),
        f,
      );
    }
    stepCalf(f.sector, this.content.tuning.physics, dt, f.player, f.calf);
    if (calfHome(family, f.calf)) {
      delete f.calf;
      this.finishActivity(f.sector);
    }
  }
  /** A held hunt's lost item within Penny's hunt range, as its point id. */
  private lostItemNear(f: FlightState): string | null {
    const held = this.held;
    return held?.type === "hunt" &&
      held.spot &&
      distance(held.spot, f.player) <= JOB_TUNING.hunt.penny
      ? `job:${held.id}`
      : null;
  }
  /**
   * Where the held job sends Ada now: a survey's landmark; a delivery's destination, or the
   * issuing station to replace a lost item; a stranded craft, then the nearest safe place while
   * towing; a hunt's area centre while Ada is outside it.
   */
  private jobIndicator(f: FlightState): IndicatorTarget | null {
    const held = this.held;
    const target = this.jobTarget(f);
    // A hunt's indicator hides while Ada is inside its search area.
    return held?.type === "hunt" && distance(held.target, f.player) <= JOB_TUNING.hunt.radius
      ? null
      : target;
  }
  /** The held job's target on the Map, named by the job's title. */
  private jobMapTarget(f: FlightState): MapContext["job"] {
    const target = this.jobTarget(f);
    const title = this.jobObjective;
    const held = this.held;
    // A hunt's target is its search area's centre, which the Map rings.
    return target && title !== null
      ? {
          area: held?.type === "hunt" ? JOB_TUNING.hunt.radius : null,
          id: target.id,
          label: title,
          type: held?.type ?? null,
          x: target.x,
          y: target.y,
        }
      : null;
  }
  /** Where the held job sends Ada now, for the indicator and the Map. */
  private jobTarget(f: FlightState): IndicatorTarget | null {
    const held = this.held;
    if (!held) {
      return this.activityTarget(f);
    }
    const mark = ({ id, x, y }: JobTarget): IndicatorTarget => ({
      id: id || `job:${held.id}`,
      kind: "job",
      x,
      y,
    });
    if (held.type === "survey") {
      const site = landmarkById(f.sector, held.target.id);
      return site ? mark(site) : null;
    }
    if (held.type === "delivery") {
      const station = held.carrying ? held.target.id : held.station;
      const place =
        stationById(ECONOMY, f.sector, station) ??
        f.objects.find((object) => object.kind === "destination" && object.id === station) ??
        held.target;
      return mark({ id: station, x: place.x, y: place.y });
    }
    if (held.type === "rescue") {
      const place = f.tow ? nearestSafePlace(this.towPlaces(f), null, f.tow) : held.target;
      return place ? mark(place) : null;
    }
    return mark(held.target);
  }
  /**
   * Where the activity sends Ada now: a supply run's destination, or its issuing outpost to
   * replace a lost item; the hub for a mining contract; the calf until it follows, then the family.
   */
  private activityTarget(f: FlightState): IndicatorTarget | null {
    const activity = heldActivity(f.sector, this.state);
    if (!activity) {
      return null;
    }
    const mark = ({ x, y }: Vec, id: string): IndicatorTarget => ({ id, kind: "job", x, y });
    const place = (id: string) =>
      f.objects.find((object) => object.kind === "destination" && object.id === id);
    if (activity.id === "guideCalf") {
      const calf = f.calf;
      const family = place("family");
      return calf && !calf.following
        ? mark(calf, "activity:calf")
        : family
          ? mark(family, "family")
          : null;
    }
    // A supply run's item goes to its station; a lost one is replaced at the issuing outpost.
    if (activity.id === "supplyRun" && activity.carrying && activity.target) {
      const site = stationById(ECONOMY, f.sector, activity.target.id) ?? activity.target;
      return mark(site, activity.target.id);
    }
    const at = place(activity.place);
    return at ? mark(at, activity.place) : null;
  }
  /** Landmarks and the held job's craft, search area and glint, for the scene. */
  get jobScenery(): JobScenery {
    const f = this.state.flight;
    const held = this.held;
    if (!f || this.state.mode !== "space") {
      return { area: null, craft: null, glint: null, landmarks: [], towing: false };
    }
    const hunt = held?.type === "hunt" ? held : undefined;
    return {
      area: hunt ? { radius: JOB_TUNING.hunt.radius, x: hunt.target.x, y: hunt.target.y } : null,
      craft:
        held?.type === "rescue"
          ? { item: held.item, x: (f.tow ?? held.target).x, y: (f.tow ?? held.target).y }
          : null,
      glint:
        hunt?.spot && distance(hunt.spot, f.player) <= JOB_TUNING.hunt.glint
          ? { ...hunt.spot }
          : null,
      landmarks: galaxyLandmarks(f.sector, this.current),
      towing: Boolean(f.tow),
    };
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
    const offered = /^activity:(.+)$/.exec(dialogue.context);
    if (offered && id === "take") {
      this.takeActivity(offered[1]!);
      return;
    }
    if (/^activityActive:/.test(dialogue.context) && id === "drop") {
      this.state.dialogue = {
        choices: [
          { id: "confirmDrop", label: this.label("jobDrop") },
          { id: "cancel", label: this.label("jobDropCancel") },
        ],
        context: "activityDrop",
        text: this.jobObjective ?? "",
        title: this.label("activityDrop"),
      };
      return;
    }
    if (dialogue.context === "activityDrop" && id === "confirmDrop") {
      this.dropHeldActivity(this.state.selectedSector);
      this.state.dialogue = null;
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
    // A panel that hands on to another speaker's shows it next, one speaker a panel.
    const next = id === "continue" ? this.chapter.dialogue[dialogue.context]?.then : undefined;
    if (next) {
      this.exchange(next);
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
  /**
   * Continue: a flight saved mid-flight resumes exactly as saved; otherwise any waiting home
   * scene, else the cockpit and Astra's line, then galaxy selection.
   */
  continueGame(): void {
    if (this.screen !== "start" || !this.state.started) {
      return;
    }
    this.startShown = false;
    if (this.heldFlight) {
      Object.assign(this.state, this.heldFlight);
      this.heldFlight = null;
      this.beginConversations();
      return;
    }
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
    // Achievements and their counts survive Restart. Penny's sensed and found points belong to
    // the old world, so finds in the new one count again.
    const achievements = { ...this.state.achievements, found: [], sensed: [] };
    this.state = { ...newGameState(), achievements };
    this.heldFlight = null;
    this.unlockFlight = null;
    this.story = null;
    this.closeSelection();
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
  /**
   * Skip passes every remaining page and scene of the story run by the default path, each scene
   * applying its effect as it ends, and stops where play resumes: galaxy selection, or Ada's room
   * page with its named action, whose Previous returns to the page Skip left. Where it would pass
   * no page (the run's end and the page before it) and on the sleep scene it does nothing.
   */
  storySkip(): void {
    const from = this.story;
    if (
      !from ||
      this.screen !== "story" ||
      this.sleeping ||
      !skipPassesPage(this.runScenes, from)
    ) {
      return;
    }
    // Each pass ends one scene; a run holds only a few, so the bound only guards a cycle.
    for (let scenes = 0; this.story && this.screen === "story"; scenes++) {
      if (scenes > 32) {
        throw new Error(`Skip found no end to the story run from ${from.scene.id}`);
      }
      const end = sceneEnd(this.story);
      if (atRunEnd(end)) {
        this.story = { ...end, trail: [...from.trail, stepOf(from)] };
        this.showPage();
        return;
      }
      // Passing a scene's last page counts as showing it, as Skip landing there once did.
      this.story = end;
      this.showPage();
      this.moveStory(null);
    }
  }
  /**
   * Right (1) and Left (-1): the ship to the next or previous open galaxy in route order,
   * skipping locked ones; at either end it stays. The panel returns to the ship's galaxy.
   */
  stepGalaxy(delta: 1 | -1): void {
    if (this.selection === null || !this.galaxyMapOpen) {
      return;
    }
    this.finishRouteFlight();
    this.viewing = null;
    for (let at = this.selection + delta; at >= 1 && at <= GALAXY_COUNT; at += delta) {
      if (this.isUnlocked(galaxyAt(at as RoutePosition))) {
        this.selection = at as RoutePosition;
        return;
      }
    }
  }
  /**
   * A tap or focus on a route position's marker: an open galaxy takes the ship there; a locked
   * one shows its panel while the ship stays.
   */
  viewGalaxy(position: RoutePosition): void {
    if (this.selection === null || !this.galaxyMapOpen) {
      return;
    }
    this.finishRouteFlight();
    if (this.isUnlocked(galaxyAt(position))) {
      this.selection = position;
      this.viewing = null;
    } else {
      this.viewing = position;
    }
  }
  /**
   * The local map's Galaxies: the galaxy map over the paused flight, its ship on the galaxy Ada is
   * flying in. Refused in danger (galaxiesAvailable); towing never refuses it.
   */
  openGalaxyMap(): boolean {
    const f = this.state.flight;
    if (this.state.mode !== "space" || !f || this.state.dialogue || this.state.docked) {
      return false;
    }
    if (this.inDanger) {
      this.notify(this.label("travelUnavailable"));
      return false;
    }
    this.selection = ROUTE_POSITION[this.state.selectedSector];
    this.viewing = null;
    this.galaxyMapInFlight = true;
    return true;
  }
  /** Stay here, and the galaxy map's close X, back and Escape in flight: the local map again. */
  private closeGalaxyMapInFlight(): void {
    if (this.galaxyMapInFlight) {
      this.galaxyMapInFlight = false;
      this.selection = null;
      this.viewing = null;
    }
  }
  /**
   * The galaxy map's close X, back and Escape: in flight, the local map it opened from; at
   * boarding, Ada's room, as Earth.
   */
  closeGalaxyMap(): void {
    if (this.galaxyMapShownInFlight) {
      this.closeGalaxyMapInFlight();
    } else {
      this.leaveCockpit();
    }
  }
  /**
   * Leaves the galaxy map at boarding; an unlock flight it showed is done. Every flight start
   * passes here, so a galaxy map opened in a flight that ended otherwise never reopens.
   */
  private closeSelection(): void {
    if (this.selection !== null && !this.galaxyMapInFlight) {
      this.unlockFlight = null;
    }
    this.galaxyMapInFlight = false;
    this.selection = null;
    this.viewing = null;
  }
  /** Ends the unlock flight, or skips it: the ship on the farthest galaxy it opened. */
  finishRouteFlight(): void {
    if (this.unlockFlight && this.screen === "selector") {
      this.selection = this.unlockFlight.to;
      this.viewing = null;
      this.unlockFlight = null;
    }
  }
  /**
   * Jump: the selected galaxy's flight; a locked galaxy refuses. In flight, Stay here on the
   * galaxy Ada is flying in closes the galaxy map and resumes the same flight; another galaxy
   * ends the flight, story progress saved, and starts its own.
   */
  jump(): boolean {
    const galaxy = this.selectedGalaxy;
    if (galaxy === null || !this.isUnlocked(galaxy)) {
      return false;
    }
    if (this.galaxyMapStays) {
      this.closeGalaxyMapInFlight();
      return true;
    }
    if (this.galaxyMapShownInFlight) {
      this.endFlight();
    }
    this.startSector(galaxy);
    return true;
  }
  /**
   * Earth: Ada's room. At boarding, back and Escape do the same, without a jump; in flight it
   * ends the flight, story progress saved and no sleep scene.
   */
  leaveCockpit(): void {
    if (this.galaxyMapShownInFlight) {
      this.returnHome();
    } else if (this.screen === "selector") {
      this.closeSelection();
      this.beginVisit();
    }
  }
  /** The first home scene waiting on story progress: a resolution, then an opening. */
  private waitingScene(): Scene | null {
    // Only built galaxies have Earth scenes, in route order.
    const galaxies = ROUTE.filter((id) => BUILT.has(id));
    const resolution = galaxies.find(
      (id) => this.state.progress[id].questComplete && !this.state.progress[id].resolved,
    );
    if (resolution !== undefined) {
      return resolutionScene(this.content, resolution);
    }
    const opening = galaxies.find((id) => this.isUnlocked(id) && !this.state.progress[id].opened);
    // Before the prologue is seen, chapter one's opening is the first launch's.
    return opening === undefined
      ? null
      : openingScene(this.content, opening, !this.state.prologueSeen);
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
  /**
   * A home visit: waiting scenes, then Ada's room; an empty visit adds Penny's line. `trail`
   * continues a story run that leads into the visit; a visit from the start screen or galaxy
   * selection starts one.
   */
  private beginVisit(trail: readonly StoryStep[] = [], startsRun = trail.length === 0): void {
    this.closeSelection();
    const waiting = this.waitingScene();
    this.showScene(waiting ?? this.roomScene(true), trail, startsRun);
  }
  /**
   * A scene's first page; `trail` carries the story run's earlier pages. A run starts with an
   * empty trail, or with the one page whose named action ended the run before it.
   */
  private showScene(
    scene: Scene,
    trail: readonly StoryStep[] = [],
    startsRun = trail.length === 0,
  ): void {
    this.story = storyStart(scene, trail);
    if (startsRun && !this.simulating) {
      this.runs += 1;
      this.runScenes = this.chainedScenes(scene);
      this.run = {
        id: `${scene.id}#${this.runs}`,
        pages: [...trail.map(stepPage), ...this.runScenes.flatMap(({ pages }) => pages)],
      };
    }
    this.showPage();
  }
  /** The story run on show, and how many have started. */
  private run: StoryRun = { id: "", pages: [] };
  /** The story run's scenes in the order it chains them. */
  private runScenes: readonly Scene[] = [];
  private runs = 0;
  /** A copy that follows a run's scenes without starting runs of its own. */
  private simulating = false;
  /**
   * Every scene the run starting at scene chains by the default path, as moveStory follows it:
   * each scene's end applies its effect to a copy of the state, which picks the next.
   */
  private chainedScenes(scene: Scene): readonly Scene[] {
    const copy = new GameModel(this.content, JSON.stringify(this.state));
    copy.simulating = true;
    copy.startShown = false;
    copy.story = storyStart(scene);
    const scenes = [scene];
    // A run chains only a few scenes; the bound only guards a cycle.
    for (let steps = 0; copy.story && steps < 32; steps++) {
      const end = sceneEnd(copy.story);
      if (atRunEnd(end)) {
        break;
      }
      copy.story = end;
      copy.moveStory(null);
      if (copy.story) {
        scenes.push(copy.story.scene);
      }
    }
    return scenes;
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
  /** Plays the sleep scene on, moving to morning once its `sleepSeconds` are up. */
  storyTick(sleepSeconds: number, seconds: number): void {
    if (!this.sleeping || !Number.isFinite(seconds) || seconds <= 0) {
      return;
    }
    this.slept += seconds;
    if (this.slept >= sleepSeconds) {
      this.moveStory(advance(this.story!));
    }
  }
  /**
   * Moves to a page, or past a scene's end to what the scene leads to. The scene's effect applies
   * as it ends; the next scene continues the story run's trail unless the run ended there.
   */
  private moveStory(next: StoryPosition | null): void {
    const position = this.story;
    if (next) {
      this.story = next;
      this.showPage();
      return;
    }
    if (!position) {
      return;
    }
    const ended = position.scene;
    const trail = runTrail(position);
    const startsRun = Boolean(ended.endsRun);
    this.applyEffect(ended);
    if (ended.lead === "home") {
      this.showScene(this.waitingScene() ?? this.roomScene(false), trail, startsRun);
    } else if (ended.lead === "visit") {
      this.beginVisit(trail, startsRun);
    } else if (ended.lead === "board") {
      this.showScene(boardingScene(this.content, this.state.announceGalaxy), trail, startsRun);
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
    this.syncAchievements();
  }
  /** Unlocks every achievement now reached, queueing its notice for the next flight step. */
  private syncAchievements(): void {
    const unlocked = unlockAchievements(
      ACHIEVEMENTS,
      ACHIEVEMENT_TOTALS,
      this.state.achievements,
      this.state,
    );
    this.achievementNotices.push(...unlocked.map(({ name }) => name));
  }
  /** Records an achievement event from a system that counts toward one (data/achievements.ts). */
  recordAchievement(event: AchievementEvent): void {
    recordAchievement(this.state.achievements, event);
    this.syncAchievements();
  }
  /** The Achievements card's entries, in Gameplay's table order. */
  get achievements(): readonly AchievementView[] {
    const state = this.state.achievements;
    return ACHIEVEMENTS.map(({ condition, counted, goal, id, name }) => {
      const unlocked = state.unlocked.includes(id);
      const progress = achievementProgress(ACHIEVEMENT_TOTALS, goal, state);
      return {
        condition,
        id,
        name,
        ...(counted && !unlocked && progress.need > 0 && { progress }),
        unlocked,
      };
    });
  }
  /**
   * Galaxy selection, the ship on the farthest unlocked position on the route; after an unlock,
   * on the galaxy it flew from until the unlock flight ends.
   */
  private openSelection(): void {
    this.story = null;
    this.viewing = null;
    this.selection =
      this.unlockFlight?.from ??
      (Math.max(...this.state.unlocked.map((id) => ROUTE_POSITION[id])) as RoutePosition);
  }
  save(): string {
    this.pullLoadout();
    return JSON.stringify(this.heldFlight ? { ...this.state, ...this.heldFlight } : this.state);
  }
}
