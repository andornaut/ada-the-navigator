import { randomStream } from "@andornaut/game-kit/runtime/random";
import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { ACHIEVEMENTS, PENNY_FIND_RANGE } from "../data/achievements.ts";
import { ACTIVITIES } from "../data/activities.ts";
import { ANDROMEDA_CHAPTER, ANDROMEDA_LANE_COURIER, ANDROMEDA_PLACES } from "../data/andromeda.ts";
import {
  type CapitalBossHud,
  CARTWHEEL_CLAIM,
  CARTWHEEL_CLAIM_CUES,
  SUNFLOWER_BOSS_CUES,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_BOSS_CUES,
  WHIRLPOOL_CAPITAL_BOSS,
} from "../data/capitalBosses.ts";
import {
  ARCHIE_NAMED,
  CONVERSATION_TUNING,
  type ConversationLine,
  CONVERSATIONS,
  INTERACTION_COPY,
  type JobMoment,
  MAPPED_PLACE_RETURN_LINE,
  type Mood,
  type NoticeRank,
  SPEAKERS,
} from "../data/conversations.ts";
import { deliveryDestination, DESTINATIONS } from "../data/destinations.ts";
import { ECONOMY, type UpgradeWeapon } from "../data/economy.ts";
import { EXCHANGE_RATES } from "../data/exchange.ts";
import {
  BUILT,
  GALAXY_COUNT,
  GALAXY_NUMBERS,
  galaxyAt,
  ROUTE,
  ROUTE_POSITION,
  type RoutePosition,
  unlockedBy,
} from "../data/galaxies.ts";
import { HUNTING_PACKS } from "../data/galaxyFeatures.ts";
import { JOB_TUNING, type JobType } from "../data/jobs.ts";
import { LANDMARK_SCAN_COPY } from "../data/landmarkScanCopy.ts";
import { canAffordMapJump, MAP_JUMP_COST, travelState } from "../data/mapJump.ts";
import { isNeedleCourseStart, NEEDLE } from "../data/needle.ts";
import { NEEDLE_COURSE_COPY, NEEDLE_LEARNING } from "../data/needleCopy.ts";
import { visualNoticeTiming } from "../data/noticeTiming.ts";
import {
  PHANTOM_DESTINATIONS,
  PHANTOM_FINALE_CHATTER,
  PHANTOM_FLAGSHIP,
  PHANTOM_TUNING,
} from "../data/phantom.ts";
import {
  poiAmbientLine,
  type PoiApproachKind,
  poiDiscoveryPool,
} from "../data/poiDiscoveryLore.ts";
import { holodiskInsertion } from "../data/premiseCopy.ts";
import { galaxyProjects, PROJECT_THANKS } from "../data/projects.ts";
import { SCREEN } from "../data/screen.ts";
import { galaxyCard, OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import type { ChapterContent, GalaxyNumber, GameContent, Weapon } from "../data/types.ts";
import {
  ACHIEVEMENT_TOTALS,
  type AchievementEvent,
  type AchievementView,
  achievementViews,
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
  resetCourier,
  supplyTerms,
} from "./activities.ts";
import {
  andromedaCourierActor,
  andromedaStationTopic,
  chooseAndromeda,
  takeAndromedaCourierWarning,
  useAndromeda,
} from "./andromeda.ts";
import {
  ANDROMEDA_REDACT,
  ANDROMEDA_REDACT_CUES,
  andromedaRedactEligible,
  andromedaRelayWaypoint,
  reserveAndromedaRedact,
  resolveAndromedaRedact,
} from "./andromedaRedact.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { calfHome, calfRouteMidpoint, calfStart, placedCalf, stepCalf } from "./calf.ts";
import { capitalBossActor } from "./capitalBossEncounter.ts";
import type { ChapterContext, ChapterResult } from "./chapterProtocol.ts";
import { chapterRuntime } from "./chapters.ts";
import { applyEconomyCheat, type CheatId, economyCheatAvailable } from "./cheats.ts";
import {
  ConversationDirector,
  heavyInSight,
  holodisksHeld,
  pennyPoints,
  type PoiApproach,
  type PoiConfirmation,
  speakerName,
} from "./conversations.ts";
import {
  clearCourierPatrol,
  courierRendezvous,
  courierScoutTarget,
  courierTerms,
  positionCourier,
  stepCourierRun,
} from "./courierRun.ts";
import { inCurrent } from "./currents.ts";
import { carriesStardust, dropRandom } from "./drops.ts";
import { EARLY_ENCOUNTER_CUES } from "./earlyEncounterRuntime.ts";
import { edgeMarkerKind } from "./edgeMarkers.ts";
import {
  confirmExchange,
  type ExchangeOrder,
  type ExchangePreview,
  type ExchangeQuote,
  type ImmediateExchangeOrder,
  type ImmediateExchangePreview,
  type ImmediateExchangeResult,
  previewImmediateExchange,
  quoteExchange,
} from "./exchange.ts";
import {
  advanceExplorationPacing,
  commitExplorationOpportunity,
  EMPTY_EXPLORATION_PACING,
  type ExplorationSiteRegion,
  OUTER_OPPORTUNITY_SECONDS,
} from "./explorationPacing.ts";
import {
  admittedExplorationSites,
  type ExplorationSiteKind,
  explorationSiteScanned,
} from "./explorationState.ts";
import {
  activateRequiredCartwheelRoute,
  activateRequiredWhirlpoolRoute,
  activateRouteEncounter,
  admitRedactEncounter,
  beginArrivalGrace,
  carryPickup,
  createUnpopulatedFlight,
  dockFlight,
  dronesNear,
  ensureDestination,
  ensureDestinationAt,
  ensureHuntingPacks,
  ensureRouteEncounter,
  ensureStation,
  holdCartwheelClaimField,
  openCartwheelClaimField,
  pickupTouched,
  placeCartwheelClaim,
  placeDestinationAhead,
  placeExplorationSite,
  placeHuntingPack,
  placeNeedleCadence,
  placeSunflowerCapitalBoss,
  planRedactEncounter,
  planRequiredCartwheelRoute,
  planRequiredWhirlpoolRoutes,
  populateFlight,
  populateRequiredChapterFlight,
  populateRequiredFlight,
  questGuardPlacementContext,
  recoverExplorationWreck,
  reserveAndromedaRelaySite,
  reserveWhirlpoolDiskSite,
  restoreWhirlpoolSounder,
  retireLegacyWhirlpoolDiskGuard,
  routeBlocked,
  settleRouteEncounters,
  stepFlight,
  sunflowerBossCache,
  syncFlightRegion,
  teleport as teleportFlight,
  undockFlight,
  whirlpoolSounderActor,
} from "./flight.ts";
import {
  CURRENT_FLIGHT_TOPOLOGY,
  flightEncounterSeed,
  flightWorldContext,
} from "./flightTopology.ts";
import { initializeGalaxyGeography } from "./galaxyGeography.ts";
import { projectCapitalBossHud } from "./game/bossHud.ts";
import { earlyRequiredDestination, galaxyRoute, newGameState } from "./game/campaignState.ts";
import { dockedShopGroups, dockedShopOffers, dockedShopSupply } from "./game/dockedShop.ts";
import { encounterCues, stationsInRange } from "./game/encounterCues.ts";
import { dockedJobRows, type JobRow } from "./game/jobBoard.ts";
import { jobIndicator, jobMapTarget, type JobNavigationContext } from "./game/jobNavigation.ts";
import { projectJobText, projectPlaceLabel } from "./game/jobText.ts";
import {
  projectInRangeQuestDetails,
  projectQuestEntries,
  projectQuestLines,
  projectTaskObjective,
  type QuestTextContext,
} from "./game/questEntries.ts";
import { type HeldFlight, saveSnapshot } from "./game/saveSnapshot.ts";
import { aboard, shipItemFacts } from "./game/shipCargo.ts";
import {
  compactStationGreeting,
  keeperStationName,
  projectStationGreeting,
  projectStationWelcome,
  resolveStationGreeting,
  type StationGreetingVisit,
} from "./game/stationGreeting.ts";
import { projectStoryView, storyPageCanSkip, storyRoomPage } from "./game/storyView.ts";
import {
  floatingHolodisk,
  holodiskTouched,
  holodiskWaypoint,
  whirlpoolDiskWaypoint,
} from "./game/whirlpoolHolodisk.ts";
import { liveEnemy, worldSyncFlightRegion } from "./geography.ts";
import { hostileStationMapPlaces } from "./hostileStationMap.ts";
import { acknowledgeHostileStationIdentification } from "./hostileStationPersistence.ts";
import { materializeGeneratedHostileStations } from "./hostileStationRuntime.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import {
  INDICATOR_SOURCES,
  type IndicatorTarget,
  indicatorTargets,
  objectiveDestination,
  questItemDestination,
} from "./indicators.ts";
import type { ItemGain } from "./itemGains.ts";
import {
  acceptJob,
  type BoardContext,
  completeJob,
  dropJob,
  explorationLeadOffer,
  type ExplorationLeadPhase,
  heldJob,
  isPostedLead,
  jobHostiles,
  type LeadJobType,
  nearestWorldSafePlace,
  postExplorationLead,
  pullTow,
  rerollBoards,
  stationBoard,
} from "./jobs.ts";
import type { StationGreeting } from "./keepers.ts";
import {
  flightLandmarkSites,
  landmarkById,
  landmarkLabel,
  type LandmarkSite,
  landmarkSites,
} from "./landmarks.ts";
import { landmarkScanTarget } from "./landmarkScan.ts";
import { recoverLegacyQuestGuards } from "./legacyGuardRecovery.ts";
import {
  type LocalMap,
  localMap,
  type MapContext,
  recordExplored,
  selectMapTravelTarget,
  stationForMapDestination,
  withinChartingRadius,
} from "./map.ts";
import { markerKnowledgeStore } from "./markerBindings.ts";
import { markerActorTracked } from "./markerKnowledge.ts";
import { needleCourses, setNeedleActivity, stepNeedleCourse } from "./needle.ts";
import {
  ensureNeedleActivityPatrols,
  NEEDLE_ACTIVITY_TARGET,
  retireNeedleActivityPatrols,
} from "./needleActivity.ts";
import { clearNeedleEnemies, ensureNeedleDebris } from "./needleFlight.ts";
import {
  NEEDLE_CADENCE,
  NEEDLE_CADENCE_CUES,
  needleCadenceSite,
  needleCadenceTransmission,
  type NeedleTrackedObjective,
  needleTrackedObjective,
} from "./needleRuntime.ts";
import type { MarkerDetails, PennyMarker, PennyPoint } from "./pennyMarkers.ts";
import {
  phantomBlockadeAdmits,
  type PhantomContext,
  phantomWaypoint,
  settlePhantomSurrender,
} from "./phantom.ts";
import { phantomAllyRoster, type PhantomAllySpec } from "./phantomAllies.ts";
import { queuePhantomBlockadeCue } from "./phantomBlockadeCue.ts";
import { HUNT_GLINT } from "./pickupBody.ts";
import { ambientSecondThread } from "./poiDiscourse.ts";
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
import { questDetails, type QuestEntry, storyQuestId, taskQuestId } from "./questDetails.ts";
import {
  type ContextQuestDetails,
  type QuestObjectLink,
  questsForObject,
  taskMarkerCategory,
} from "./questObjectLinks.ts";
import { readRequiredRolePlan } from "./requiredRolePlans.ts";
import type { SaveRestore } from "./saveSchema.ts";
import {
  immutableScanOutcome,
  type ScanActionLead,
  type ScanCompletion,
  type ScanOutcome,
} from "./scanOutcomes.ts";
import { canRechargeShield } from "./shieldRecharge.ts";
import { SHIP_REACH } from "./shipBody.ts";
import {
  buy,
  fill,
  onSale,
  type PurchaseRequest,
  type PurchaseResult,
  requestPurchase,
  restockStationShop,
  selectPaint,
  type ShopItem,
  type ShopRow,
  type ShopTab,
} from "./shop.ts";
import { discoveryCacheGroup } from "./stardustPlacement.ts";
import { advanceStationRestock, newStationRestock } from "./stationRestock.ts";
import {
  flightStationContext,
  HUB_STATION,
  stationById,
  type StationSite,
  worldStationById,
} from "./stations.ts";
import { type StationServices, stationSpecialty } from "./stationServices.ts";
import {
  advance,
  atRunEnd,
  boardingScene,
  canGoBack,
  currentPage,
  goBack,
  holodiskScene,
  jumpHomeScene,
  replayChapterScene,
  roomBackground,
  runTrail,
  type Scene,
  sceneEnd,
  shownChoices,
  stepOf,
  stepPage,
  type StoryChoice,
  type StoryLabels,
  type StoryPage,
  type StoryPosition,
  storyStart,
  type StoryStep,
} from "./storybook.ts";
import { readStoryCursor, type StorySceneReference } from "./storyCursor.ts";
import {
  canReplayEarthChapter,
  resolveStoryScene,
  visitRoomScene,
  waitingEarthScene,
} from "./storyScenes.ts";
import { isCartwheelDockingTalkPage } from "./storyShips.ts";
import {
  resolveTargetObject,
  type TargetContribution,
  type TargetKnowledgeStore,
  TargetMarkerRegistry,
  type TargetResolution,
  type TrackedTarget,
} from "./targetMarkers.ts";
import type {
  Aboard,
  CourierApproach,
  DialogueState,
  FlightEvent,
  FlightInput,
  FlightLogEntry,
  FlightState,
  GalaxyProgress,
  GameSave,
  GameState,
  GuidedCalf,
  HeldActivity,
  HeldJob,
  JobOffer,
  JobTarget,
  ShipState,
  SpaceObject,
  UseAction,
  Vec,
} from "./types.ts";
import { applyUpgrade, chooseAmmoPack, chooseUpgrade } from "./upgradeDrops.ts";
import { shipTuning } from "./upgrades.ts";
import { visitedChunk } from "./visited.ts";
import {
  collectWeapon,
  ensureOwnedWeapons,
  ownedWeapons,
  selectFlightWeapon,
  UPGRADE_WEAPONS,
  type WeaponChoice,
} from "./weapons.ts";
import { periodicWorldGrid, worldCellAt, worldCellKey } from "./worldCells.ts";
import { worldDelta, worldDistance, worldPoint } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

export type { AchievementView } from "./achievements.ts";
export { galaxyRoute, newGameState } from "./game/campaignState.ts";
export type { JobRow } from "./game/jobBoard.ts";
export { newProgress } from "./progress.ts";

// The dialogue marker that holds the flight under the holodisk moment's story pages.
const ANDROMEDA_STATION_HINT = "Ask at a settlers’ station about the guide beacons.";
const HOLODISK_MOMENT = "holodiskMoment";
const NAMED_CAPITAL_IDS: Partial<Record<GalaxyNumber, string>> = {
  1: SUNFLOWER_CAPITAL_BOSS.id,
  2: CARTWHEEL_CLAIM.id,
  3: WHIRLPOOL_CAPITAL_BOSS.id,
  4: NEEDLE_CADENCE.id,
  5: ANDROMEDA_REDACT.id,
  6: PHANTOM_FLAGSHIP,
};
const GROWERS_APPROACH_CUE = "chapter:sunflower:growers:approach";
const GROWERS_APPROACH_LINE = poiDiscoveryPool(1, { id: "growers", kind: "storyPlace" })[0]
  ?.lines[0];
const NEEDLE_PRELUDE = ["arrival:4", "meeting:4:avi"] as const;

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
/** The destination that opens a built galaxy's story; none in a placeholder. */
const first = (galaxy: GalaxyNumber): string | undefined => galaxyRoute(galaxy)[0];

/** A placeholder galaxy's chapter: its name, with no story, objectives or dialogue. */
function placeholderChapter(galaxy: GalaxyNumber): ChapterContent {
  const none = ["", ""] as const;
  return {
    closing: "",
    dialogue: {},
    name: galaxyCard(galaxy).name,
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

interface ContextOffer {
  readonly action?: UseAction | undefined;
  readonly id?: string | undefined;
}

/** The conversation line the box shows, with its speaker's name tab and portrait side. */
export interface ConversationView {
  /** Flight seconds at which the final discovery line finishes fading. */
  readonly discoveryFadeEnd?: number;
  /** Seconds the line has shown, which times a speaking loop. */
  readonly elapsed: number;
  /** Changes with each line, so the box can restart its entrance. */
  readonly key: string;
  /** Ada's or Penny's portrait mood; neutral when the line names none. */
  readonly mood: Mood;
  readonly name: string;
  /** Whether Archie's tab reads his name, which switches his portrait's frame set. */
  readonly named: boolean;
  readonly side: "left" | "right";
  readonly speaker: keyof typeof SPEAKERS;
  readonly text: string;
  readonly desktop?: string;
}

export type PickupFeedback = Extract<ItemGain, { readonly kind: "ammo" }>;

interface MarkedPoiVisit {
  point: Vec;
  arrived: boolean;
  heard: boolean;
}

/** A source of uniform unsigned 32-bit draws, read for each new flight's geography and seed. */
export type Entropy = () => number;

export class GameModel {
  private readonly markerRegistry = new TargetMarkerRegistry();
  private readonly poiVisits = new WeakMap<FlightState, Map<string, MarkedPoiVisit>>();
  private readonly scanLeads = new WeakMap<FlightState, ScanActionLead & { origin: Vec }>();
  private readonly markerViews = new WeakMap<
    PennyMarker,
    {
      area: Rect;
      flight: FlightState;
      litCaches: ReadonlySet<string> | undefined;
      waypointId: string | undefined;
    }
  >();
  private readonly seenCacheGroups = new Set<string>();
  private scannedLandmarks: string[] = [];
  private scanOutcomes: ScanOutcome[] = [];
  state: GameState;
  /** The last flight step's events, for view effects; empty when no step ran. */
  flightEvents: FlightEvent[] = [];
  private readonly bossPlacementCells = new WeakMap<FlightState, string>();
  private readonly content: GameContent;
  private readonly saveRestore: SaveRestore;
  private readonly entropy: Entropy;
  private readonly talk: ConversationDirector;
  private pickupFeedback: PickupFeedback[] = [];
  private noticeClock = { elapsedMs: 0, ...visualNoticeTiming("brief", "") };
  /** The showing game notice's rank: a press refusal's, or an ordinary notice's. */
  private noticeRank: NoticeRank = "notice";
  /** Held-job moments since the last flight step, for the conversation director. */
  private jobMoments: (JobMoment | "jobComplete")[] = [];
  /** Whether Ada has docked this flight, which marks the dock lesson done. */
  private dockedThisFlight = false;
  // The docked station keeper's greeting: the keeper, this docking's lines and the one on show.
  private greeting: StationGreetingVisit | null = null;
  /** Achievements unlocked whose notice has not shown yet; notices show in flight. */
  private achievementNotices: string[] = [];
  private previousSeed = 0;
  // Every launch shows the title. Continue restores a saved story cursor or the held flight.
  private startShown = true;
  // A flight saved mid-flight, with its notice, held off the state while the launch's start
  // screen shows so nothing in flight runs or shows; save() writes it back unchanged and
  // Continue restores it.
  private heldFlight: HeldFlight | null = null;
  private stationTalkVisit: {
    readonly flight: FlightState;
    readonly stationId: string;
    readonly panel: DialogueState;
  } | null = null;
  private story: StoryPosition | null = null;
  private choosingReplay = false;
  private heldStory: { position: StoryPosition; slept: number } | null = null;
  private readonly emergencyReferences = new WeakMap<Scene, StorySceneReference>();
  private queuedNeedleTalk = false;
  // Use presses refused so far, which the scene plays as the Use disc's refusal cue; never saved.
  private useRefusalCount = 0;
  private suspendedInteraction: {
    readonly dialogue: DialogueState;
    readonly galaxy: GalaxyNumber;
  } | null = null;
  private depletionContinuation = false;
  private readonly playedInterludes = new Set<Scene>();

  // The galaxy map's ship, always on an open galaxy, and the locked galaxy whose panel shows
  // in its place after a tap or focus (null for the ship's own).
  private selection: RoutePosition | null = null;
  private viewing: RoutePosition | null = null;
  // The story page the galaxy map opened from at boarding, which its close X shows again.
  private boardedFrom: StoryPosition | null = null;
  // The galaxy map opened in flight from the local map's Galaxies, over the paused flight.
  private galaxyMapInFlight = false;
  // The last unlock, flown on the route map at the next boarding: from the galaxy completed to
  // the farthest it opened, the opened positions still showing locked until then.
  private unlockFlight: RouteFlight | null = null;
  constructor(content: GameContent, entropy: Entropy, saveRestore: SaveRestore, saved?: unknown) {
    this.content = content;
    this.entropy = entropy;
    this.saveRestore = saveRestore;
    const restored = saveRestore.restoreGameSave(content, saved);
    this.state = restored ?? newGameState();
    const navigation = restored as
      | (GameState & {
          pendingInteraction?: { dialogue?: DialogueState; galaxy?: GalaxyNumber };
          depletionContinuation?: unknown;
        })
      | null;
    const pendingStory = (restored as GameSave | null)?.pendingStory;
    if (pendingStory) {
      const position = readStoryCursor(
        {
          resolve: (reference) => {
            const scene = resolveStoryScene(this.storySceneContext, reference);
            if (scene?.id === "jumpHome") {
              this.emergencyReferences.set(scene, reference);
            }
            return scene;
          },
        },
        pendingStory.cursor,
      );
      if (position) {
        this.heldStory = { position, slept: pendingStory.slept };
      }
      delete (this.state as GameSave).pendingStory;
    }
    if (this.state.flight?.galaxy === 5 && this.state.dialogue?.context === "activity:pip") {
      this.state.dialogue = this.courierUnavailableDialogue();
    }
    const pending = navigation?.pendingInteraction;
    if (
      pending?.galaxy &&
      GALAXY_NUMBERS.includes(pending.galaxy) &&
      pending.dialogue &&
      this.saveRestore.restoreSave({ ...this.state, dialogue: pending.dialogue })
    ) {
      this.suspendedInteraction = {
        dialogue:
          pending.galaxy === 5 && pending.dialogue.context === "activity:pip"
            ? this.courierUnavailableDialogue()
            : pending.dialogue,
        galaxy: pending.galaxy,
      };
    }
    this.depletionContinuation =
      navigation?.depletionContinuation === true && this.state.mode === "home";
    // The save's navigation fields live on the model, not in its state.
    delete (this.state as GameSave).depletionContinuation;
    delete (this.state as GameSave).pendingInteraction;
    // Achievements the save already reached unlock without notices.
    unlockAchievements(ACHIEVEMENTS, ACHIEVEMENT_TOTALS, this.state.achievements, this.state);
    this.talk = new ConversationDirector(
      [...CONVERSATIONS, ...PROJECT_THANKS],
      this.state.seenConversations,
    );
    this.talk.setEligibilityReader(() => {
      const flight = this.state.flight;
      const progress = flight && this.state.progress[flight.galaxy];
      return {
        galaxy: flight?.galaxy ?? null,
        holodisks: holodisksHeld(this.state.progress),
        questComplete: progress?.questComplete ?? false,
        resolved: progress?.resolved ?? false,
      };
    });
    if (this.state.mode === "space") {
      this.holdFlight();
    }
  }
  /**
   * Sets the flight aside for Continue (rules.md "What each event keeps"): opening the app and
   * Back to title resume it exactly, its tow, calf and carried items included.
   */
  private holdFlight(): void {
    this.pickupFeedback = [];
    this.queuedNeedleTalk = false;
    const { dialogue, docked, flight, mode, notice } = this.state;
    this.heldFlight = { dialogue, docked, flight, mode, notice };
    this.state.mode = "home";
    this.state.flight = null;
    this.state.dialogue = null;
    this.state.docked = null;
    this.state.notice = "";
  }
  /**
   * A notice shows at once in the conversation box's slot, ahead of every line but a warning's or
   * a scan receipt's (BOX_PRIORITIES); lower lines wait under it and resume after. A warning or
   * receipt interrupts a notice, which resumes at the same point in its hold or fade.
   */
  private notify(
    text: string,
    timing: "brief" | "reading" = "brief",
    rank: NoticeRank = "notice",
  ): void {
    this.state.notice = text;
    this.noticeRank = rank;
    this.noticeClock = { elapsedMs: 0, ...visualNoticeTiming(timing, text) };
  }
  /**
   * The notice answering Ada's own refused press (Dock, Travel here, Galaxies or any other
   * refused action): it takes the slot at once, over a warning too, and the line it interrupts
   * resumes after it if still relevant (BOX_PRIORITIES).
   */
  private refuse(text: string, timing: "brief" | "reading" = "brief"): void {
    this.notify(text, timing, "refusal");
  }
  /** A tap on a game notice dismisses it at once; lines waiting under it resume. */
  dismissNotice(): void {
    this.state.notice = "";
  }
  /** Opacity at the notice's current phase, which pauses while another surface covers it. */
  get noticeOpacity(): number {
    if (!this.noticeShowing) {
      return 0;
    }
    const { elapsedMs, fadeMs, holdMs } = this.noticeClock;
    return Math.max(0, 1 - Math.max(0, elapsedMs - holdMs) / fadeMs);
  }
  private get noticeShowing(): boolean {
    return this.state.notice !== "";
  }
  /** A warning shows in the box, over any notice but a press refusal. */
  get warningShowing(): boolean {
    return this.state.mode === "space" && this.talk.warningShowing && !this.refusalShowing;
  }
  private get refusalShowing(): boolean {
    return this.noticeShowing && this.noticeRank === "refusal";
  }
  /**
   * The line the conversation box shows now, if any: a warning's or scan receipt's, or another
   * with no notice.
   */
  get conversation(): ConversationView | null {
    if (
      this.state.mode !== "space" ||
      this.state.dialogue ||
      this.state.docked ||
      this.screen !== "space"
    ) {
      return null;
    }
    const flight = this.state.flight;
    if (flight?.phantom?.blockadePhases) {
      queuePhantomBlockadeCue(this.talk, this.state.seenConversations, {
        content: this.content,
        flight,
        progress: this.current,
      });
    }
    if (this.noticeShowing && !this.talk.showsOver(this.noticeRank)) {
      return null;
    }
    const showing = this.talk.showing;
    if (!showing) {
      return null;
    }
    const { desktop, mood = "neutral", speaker, text } = showing.line;
    const name = speakerName(this.state.progress, speaker);
    const { discoveryFadeEnd } = showing;
    return {
      ...(discoveryFadeEnd === undefined ? {} : { discoveryFadeEnd }),
      ...(desktop === undefined ? {} : { desktop }),
      elapsed: showing.elapsed,
      key: `${showing.instance}:${showing.lineIndex}`,
      mood,
      name,
      named: speaker === "archie" && name === ARCHIE_NAMED.name,
      side: SPEAKERS[speaker].side,
      speaker,
      text,
    };
  }
  /** Called only after the visible conversation box has rendered this exact line. */
  pennyNoticeDisplayed(key: string): void {
    const f = this.state.flight;
    if (!f || this.conversation?.key !== key) {
      return;
    }
    const prefix = `penny:${f.galaxy}:`;
    const instance = key.slice(0, key.lastIndexOf(":"));
    if (instance.startsWith(prefix)) {
      const id = instance.slice(prefix.length);
      const store = this.markerStore(f);
      if (this.markerPoint(f, id) && store.get(id) !== "identified") {
        store.set(id, "sensed");
      }
    }
  }

  /** Marker identification is a renderer acknowledgment, separate from chart and story progress. */
  markerTargetDisplayed(id: string, litCaches?: ReadonlySet<string>): void {
    const f = this.state.flight;
    if (!f || this.screen !== "space" || this.state.dialogue || this.state.docked) {
      return;
    }
    // The family's charted waypoint can display before Sounder releases the disk body.
    if (f.galaxy === 3 && id === "holodisk" && !this.floatingHolodisk(f)) {
      return;
    }
    acknowledgeHostileStationIdentification(this.state.progress[f.galaxy], f, id);
    const store = this.markerStore(f);
    if (store.get(id) === "identified") {
      return;
    }
    const point = this.markerPoint(f, id, litCaches);
    if (!point || point.identifiable === false) {
      return;
    }
    store.set(id, "identified");
    const object = f.objects.find((candidate) => candidate.id === id);
    const relevant = this.poiNearby(f, point);
    const site =
      !object && !this.current.charted.includes(id)
        ? flightLandmarkSites(f).find((candidate) => candidate.id === id)
        : undefined;
    const cue =
      object?.kind === "destination" && id === "holodisk"
        ? { id, kind: "storyPlace" as const }
        : site && { id, kind: "landmark" as const, symbol: site.kind };
    if (cue) {
      const confirmation = this.poiVisitConfirmation(f, { cue, relevant });
      if (confirmation) {
        this.talk.poiDiscovered(
          confirmation.cue,
          confirmation.relevant,
          false,
          confirmation.onFirstShowing,
        );
      }
    }
  }

  /** A visible member can announce its generated bundle once per encounter, including Continue. */
  discoveryCacheDisplayed(group: string): void {
    const flight = this.state.flight;
    if (
      !flight ||
      this.screen !== "space" ||
      this.state.dialogue ||
      this.state.docked ||
      this.seenCacheGroups.has(group)
    ) {
      return;
    }
    const member = flight.objects.find((object) => discoveryCacheGroup(ECONOMY, object) === group);
    if (
      member &&
      this.talk.poiDiscovered(
        { group: `${flightEncounterSeed(flight)}:${group}`, kind: "cache" },
        this.poiNearby(flight, member),
      )
    ) {
      this.seenCacheGroups.add(group);
    }
  }

  private poiNearby(flight: FlightState, point: Vec): () => boolean {
    return () =>
      this.state.flight === flight &&
      worldDistance(flightWorldContext(flight), flight.player, point) <=
        CONVERSATION_TUNING.pennyRange;
  }

  /** Use the existing marker/landmark identities and the flight's wrapped closing velocity. */
  private poiApproach(
    flight: FlightState,
    sensed: readonly string[],
    landmarks: ReturnType<typeof flightLandmarkSites>,
  ): PoiApproach | undefined {
    if (flight.velocity.x === 0 && flight.velocity.y === 0) {
      return undefined;
    }
    const progress = this.state.progress[flight.galaxy];
    const store = this.markerStore(flight);
    const held = this.held;
    const candidates = new Map<string, PoiApproachKind>();
    if (held?.type === "delivery" && held.carrying) {
      candidates.set(held.target.id, "job");
    }
    if (this.talk.heardScanLesson) {
      for (const site of landmarks) {
        if (store.get(site.id) === "identified" && !candidates.has(site.id)) {
          candidates.set(site.id, "landmark");
        }
      }
    }
    for (const id of sensed) {
      if (!candidates.has(id) && this.talk.heardPennyPoint(id)) {
        candidates.set(id, "unknown");
      }
    }

    const closing = (id: string, kind: PoiApproachKind): number => {
      if (
        this.state.flight !== flight ||
        this.screen !== "space" ||
        this.state.dialogue ||
        this.state.docked ||
        this.hubSceneCoversFlightDialogue
      ) {
        return Infinity;
      }
      const point = this.markerPoint(flight, id);
      const identified = this.markerStore(flight).get(id) === "identified";
      if (!point) {
        return Infinity;
      }
      if (
        (kind === "unknown" && (identified || point.known)) ||
        (kind === "landmark" && (!identified || progress.charted.includes(id))) ||
        (kind === "job" &&
          (!point.known ||
            this.held?.id !== held?.id ||
            this.held?.target.id !== id ||
            !this.held.carrying))
      ) {
        return Infinity;
      }
      const delta = worldDelta(flightWorldContext(flight), flight.player, point);
      const distance = Math.hypot(delta.x, delta.y);
      return distance > this.content.tuning.talkRange &&
        distance <= CONVERSATION_TUNING.pennyRange &&
        delta.x * flight.velocity.x + delta.y * flight.velocity.y > 0
        ? distance
        : Infinity;
    };
    let selected: PoiApproach | undefined;
    let best = Infinity;
    for (const [id, kind] of candidates) {
      const instance = `poi:approach:${flight.galaxy}:${flightEncounterSeed(flight)}:${id}`;
      if (this.state.seenConversations.includes(instance)) {
        continue;
      }
      const distance = closing(id, kind);
      if (distance < best) {
        best = distance;
        const relevant = () => Number.isFinite(closing(id, kind));
        const presentation =
          kind === "unknown" && flight.galaxy === 5 && id === ANDROMEDA_PLACES.pip
            ? undefined
            : this.poiVisitPresentation(flight, id, relevant);
        selected = { instance, kind, relevant, ...presentation };
      }
    }
    return selected;
  }

  private coverPoiArrival(flight: FlightState, id: string): void {
    const visit = this.poiVisits.get(flight)?.get(id);
    if (visit) {
      visit.heard = true;
    }
  }

  private poiVisitPresentation(flight: FlightState, id: string, relevant?: () => boolean) {
    const visits = this.poiVisits.get(flight);
    const visit = visits?.get(id);
    if (!visit) {
      return undefined;
    }
    let showing = false;
    return {
      onFirstShowing: () => {
        showing = true;
        visit.heard = true;
      },
      relevant: () =>
        this.state.flight === flight &&
        visits?.get(id) === visit &&
        (showing || !visit.heard) &&
        relevant?.() !== false,
    };
  }

  private poiVisitConfirmation(
    flight: FlightState,
    confirmation: PoiConfirmation,
  ): PoiConfirmation | null {
    if (confirmation.cue.kind === "cache") {
      return confirmation;
    }
    const { id } = confirmation.cue;
    if (id === undefined) {
      return confirmation;
    }
    const presentation = this.poiVisitPresentation(flight, id, confirmation.relevant);
    if (presentation && flight.galaxy === 5 && id === ANDROMEDA_PLACES.pip) {
      return null;
    }
    return { ...confirmation, ...presentation };
  }

  private poiArrivalLine(
    flight: FlightState,
    id: string,
    point: PennyPoint,
  ): ConversationLine | undefined {
    if (flight.galaxy === 5 && id === ANDROMEDA_PLACES.pip) {
      const progress = this.state.progress[5];
      const text = !progress.introduced
        ? ANDROMEDA_STATION_HINT
        : progress.stage === 1
          ? "Check the dark guide beacon first."
          : this.objectiveFor(flight.galaxy);
      return text ? { speaker: "astra", text } : undefined;
    }
    if (point.symbol === "station") {
      return poiDiscoveryPool(flight.galaxy, { id, kind: "station" })[0]?.lines[0];
    }
    if (point.category === "discovery") {
      const authored = poiDiscoveryPool(flight.galaxy, {
        id,
        kind: "landmark",
        symbol: point.symbol,
      })[0]?.lines[0];
      if (authored) {
        return authored;
      }
      if (!this.scannedSite(id)) {
        return { speaker: "astra", text: LANDMARK_SCAN_COPY.surveyAbout };
      }
      const site = this.scannableSites(flight).find((candidate) => candidate.id === id);
      return site
        ? {
            speaker: "astra",
            text: LANDMARK_SCAN_COPY.outcomeRemembered.replace(
              "{target}",
              landmarkLabel((key) => this.label(key), site),
            ),
          }
        : undefined;
    }
    const resolved = resolveTargetObject(flight, id);
    if (resolved.state !== "present" || resolved.object.kind !== "destination") {
      return undefined;
    }
    const { role } = resolved.object;
    const authored = poiDiscoveryPool(flight.galaxy, {
      id,
      kind: "storyPlace",
      ...(role === ANDROMEDA_PLACES.settlement ? { role } : {}),
    })[0]?.lines[0];
    if (authored) {
      return authored;
    }
    // Visual identification alone does not put a destination on the map.
    if (
      !this.current.known.includes(id) ||
      stationForMapDestination(flight.galaxy, id) !== null ||
      (flight.galaxy === 4 && id === "holodisk")
    ) {
      return undefined;
    }
    return MAPPED_PLACE_RETURN_LINE;
  }

  private cueMarkedPoiArrivals(flight: FlightState): void {
    const visits = this.poiVisits.get(flight);
    if (!visits?.size) {
      return;
    }
    const world = flightWorldContext(flight);
    const range = this.content.tuning.talkRange;
    const coversFlight = () =>
      this.state.flight === flight &&
      this.screen === "space" &&
      !this.state.dialogue &&
      !this.state.docked &&
      !this.hubSceneCoversFlightDialogue &&
      this.suspendedInteraction?.galaxy !== flight.galaxy;
    const currentPoint = (id: string) => {
      const point = this.markerPoint(flight, id);
      return point &&
        (point.known || this.markerStore(flight).get(id) === "identified") &&
        point.identifiable !== false &&
        worldDistance(world, flight.player, point) <= range
        ? point
        : null;
    };
    for (const [id, visit] of visits) {
      const distance = worldDistance(world, flight.player, visit.point);
      if (distance > TARGET_MARKER_RANGE) {
        visits.delete(id);
        continue;
      }
      // Physical POIs are anchored. Keep the last shown position for the range check and
      // resolve the live target only when an unheard arrival can actually speak.
      if (distance > range) {
        if (visit.arrived) {
          visits.set(id, { arrived: false, heard: false, point: visit.point });
        }
        continue;
      }
      visit.arrived = true;
      if (
        visit.heard ||
        !coversFlight() ||
        (flight.galaxy === 1 && id === "growers" && !this.current.introduced)
      ) {
        continue;
      }
      const point = currentPoint(id);
      const line = point && this.poiArrivalLine(flight, id, point);
      if (!line) {
        continue;
      }
      const presentation = this.poiVisitPresentation(flight, id, () => {
        if (!coversFlight() || worldDistance(world, flight.player, visit.point) > range) {
          return false;
        }
        if (visit.heard) {
          return true;
        }
        const current = currentPoint(id);
        const next = current && this.poiArrivalLine(flight, id, current);
        return next?.text === line.text && next.speaker === line.speaker;
      });
      if (presentation) {
        this.talk.poiArrival(id, line, presentation);
      }
    }
  }

  private cueGrowersApproach(flight: FlightState): void {
    if (
      flight.galaxy !== 1 ||
      !GROWERS_APPROACH_LINE ||
      this.current.introduced ||
      !this.current.known.includes("growers") ||
      this.state.seenConversations.includes(GROWERS_APPROACH_CUE) ||
      this.talk.pending(GROWERS_APPROACH_CUE)
    ) {
      return;
    }
    const relevant = () =>
      this.state.flight === flight &&
      !this.current.introduced &&
      this.suspendedInteraction === null &&
      !this.state.docked &&
      this.screen === "space" &&
      this.nearest() === "growers";
    if (relevant()) {
      this.talk.poiArrival("growers", GROWERS_APPROACH_LINE, {
        onFirstShowing: () => this.coverPoiArrival(flight, "growers"),
        onceId: GROWERS_APPROACH_CUE,
        relevant,
      });
    }
  }

  /** The active hunt's actual glint uses the same stable target as its sensed contribution. */
  markerGlintDisplayed(): void {
    const held = this.held;
    if (held?.type === "hunt" && this.jobScenery.glint) {
      this.markerTargetDisplayed(`job:${held.id}`);
    }
  }

  private markerStore(f: FlightState): TargetKnowledgeStore {
    const progress = this.state.progress[f.galaxy];
    return markerKnowledgeStore(progress, f, (id) => {
      if (Object.hasOwn(progress.markerKnowledge ?? {}, id)) {
        return true;
      }
      if (markerActorTracked(f, id)) {
        return false;
      }
      const resolved = resolveTargetObject(f, id);
      if (
        resolved.state === "present" &&
        (resolved.object.kind === "destination" || resolved.object.kind === "station")
      ) {
        return true;
      }
      return (
        Boolean(worldStationById(flightStationContext(f), ECONOMY, f.galaxy, id)) ||
        this.scannableSites(f).some((site) => site.id === id)
      );
    });
  }

  private markerPoint(
    f: FlightState,
    id: string,
    litCaches?: ReadonlySet<string>,
  ): PennyPoint | null {
    const progress = this.state.progress[f.galaxy];
    const resolved = resolveTargetObject(f, id);
    if (resolved.state === "removed") {
      return null;
    }
    const object = resolved.state === "present" ? resolved.object : undefined;
    const landmark = object ? undefined : this.scannableSites(f).find((site) => site.id === id);
    const station = object
      ? undefined
      : worldStationById(flightStationContext(f), ECONOMY, f.galaxy, id);
    const held = this.held;
    const hunt = held?.type === "hunt" && `job:${held.id}` === id ? held.spot : null;
    const point =
      object ??
      station ??
      landmark ??
      hunt ??
      (id === "holodisk" ? this.whirlpoolDiskWaypoint(f) : null);
    if (!point || (object && object.hp <= 0)) {
      return null;
    }
    return {
      category:
        station ||
        object?.kind === "station" ||
        (object?.kind === "destination" && deliveryDestination(id))
          ? "station"
          : landmark || (object?.kind === "pickup" && object.role === "discovery")
            ? "discovery"
            : "objective",
      id,
      identifiable: hunt
        ? worldDistance(flightWorldContext(f), hunt, f.player) <= JOB_TUNING.hunt.glint
        : object?.kind === "pickup" && object.role === "discovery"
          ? litCaches?.has(id) === true
          : true,
      known: progress.known.includes(id) || progress.stations.includes(id) || this.scannedSite(id),
      symbol: hunt
        ? "job"
        : object?.kind === "enemy"
          ? (edgeMarkerKind(object) ?? "enemy")
          : station || object?.kind === "station"
            ? "station"
            : landmark
              ? landmark.kind
              : id === "holodisk"
                ? "holodisk"
                : (DESTINATIONS[id]?.mapKind ?? "destination"),
      x: point.x,
      y: point.y,
      ...(hunt ? { jobType: "hunt" as const } : {}),
      ...(object?.kind === "pickup" && object.role === "discovery"
        ? { item: "stardust" as const }
        : {}),
    };
  }

  /** Colour existing task associations without admitting or identifying another target. */
  private markerTaskContext(
    f: FlightState,
    known: readonly string[],
    quests?: readonly QuestObjectLink[],
  ) {
    const progress = this.state.progress[f.galaxy];
    const task = this.state.tasks[f.galaxy];
    const story = BUILT.has(f.galaxy) && progress.introduced && !progress.resolved;
    const storyTargets = [this.objectiveId(f.galaxy), questItemDestination(progress)].filter(
      (id): id is string => typeof id === "string",
    );
    const questContext = {
      galaxy: f.galaxy,
      knownIds: known,
      quests: (task || story ? (quests ?? this.questLines(f.galaxy)) : []).filter(
        ({ galaxy, line }) => galaxy === f.galaxy && (line.kind === "story" ? story : task),
      ),
      storyTargets,
      ...(task ? { task } : {}),
    };
    return {
      category: (
        id: string,
        links: readonly QuestObjectLink[],
        currentStory: boolean,
        currentJob: boolean,
      ) =>
        taskMarkerCategory(
          links,
          story && (currentStory || storyTargets.includes(id)),
          Boolean(task && (currentJob || (task.kind === "job" && id === `job:${task.id}`))),
        ),
      links: (id: string) => questsForObject(questContext, id),
      storyTargets,
    };
  }

  private trackedMarker(
    f: FlightState,
    known: readonly string[],
    storyTargets: readonly string[],
    job: IndicatorTarget | null,
    needle: NeedleTrackedObjective | null,
  ): (TrackedTarget & { readonly waypoint?: PennyPoint }) | undefined {
    const tracked = this.trackedQuestId;
    const waypoint = (
      id: string,
      point: Vec,
      symbol: PennyPoint["symbol"],
      label: string,
      jobType?: JobType,
    ) => ({
      id,
      label,
      revealed: true,
      waypoint: {
        category: "objective" as const,
        id,
        known: true,
        symbol,
        x: point.x,
        y: point.y,
        ...(jobType ? { jobType } : {}),
      },
    });
    if (tracked === null) {
      return undefined;
    }
    const held = tracked === f.trackedQuestId ? this.held : undefined;
    const activity = heldActivity(f.galaxy, this.state);
    if (activity && tracked === taskQuestId(f.galaxy, activity)) {
      if (activity.id === "courierRun") {
        const scout = courierScoutTarget(flightWorldContext(f), activity);
        if (scout) {
          return waypoint(scout.id, scout, "job", this.label(scout.label));
        }
      } else if (activity.id === "threadNeedle") {
        const ring = activity.lit ?? 0;
        const gate = needleCourses(f)?.activity.gates[ring];
        return (
          gate && waypoint(NEEDLE_ACTIVITY_TARGET, gate.point, "destination", `Ring ${ring + 1}`)
        );
      }
    }
    if (needle) {
      const label = needle.step === "ring" ? `Ring ${needle.ringIndex + 1}` : this.label(needle.id);
      return waypoint(needle.id, needle.point, "destination", label);
    }
    if (held?.type === "hunt") {
      return waypoint(`job:${held.id}:search`, held.target, "job", "Search area", held.type);
    }
    if (held?.type === "rescue" && !f.tow && job) {
      return waypoint(job.id, job, "job", held.item, held.type);
    }
    const id = held ? job?.id : (storyTargets[1] ?? storyTargets[0]);
    if (id && known.includes(id)) {
      const site = landmarkById(f.galaxy, id);
      const label = this.current.stations.includes(id)
        ? this.label("station")
        : site
          ? landmarkLabel((key) => this.label(key), site)
          : this.destinationLabel(id);
      return { id, label };
    }
    if (held) {
      return undefined;
    }
    if (!id || id === "holodisk") {
      const disk = this.whirlpoolDiskWaypoint(f);
      if (disk) {
        return waypoint("holodisk", disk, "holodisk", this.label("mapHolodiskWaypoint"));
      }
    }
    if (id === PHANTOM_FLAGSHIP) {
      const context = this.chapterContext();
      const point = context && phantomWaypoint(context);
      if (point) {
        return waypoint(id, point, "heavy", this.label(id));
      }
    }
    return undefined;
  }

  /** One merged registry for ordinary, sensed, quest and active encounter targets. */
  targetMarkers(area: Rect, litCaches?: ReadonlySet<string>): PennyMarker[] {
    const f = this.state.flight;
    if (!f || this.screen !== "space") {
      return [];
    }
    const { markers, waypointId } = this.projectTargetMarkers(f, area, litCaches);
    const view = { area: { ...area }, flight: f, litCaches, waypointId };
    for (const marker of markers) {
      this.markerViews.set(marker, view);
    }
    return markers;
  }

  /** Only a placed flight marker can start an arrival visit. */
  flightMarkerShown(marker: PennyMarker): void {
    const view = this.markerViews.get(marker);
    if (
      !view ||
      this.state.flight !== view.flight ||
      this.screen !== "space" ||
      this.state.dialogue ||
      this.state.docked ||
      marker.id === view.waypointId ||
      marker.jobType ||
      marker.item ||
      marker.symbol === "guard" ||
      marker.symbol === "heavy" ||
      marker.symbol === "enemy"
    ) {
      return;
    }
    const visits = this.poiVisits.get(view.flight) ?? new Map<string, MarkedPoiVisit>();
    this.poiVisits.set(view.flight, visits);
    const visit = visits.get(marker.id);
    if (visit) {
      visit.point = marker;
    } else {
      visits.set(marker.id, { arrived: false, heard: false, point: marker });
    }
  }

  private projectTargetMarkers(
    f: FlightState,
    area: Rect,
    litCaches: ReadonlySet<string> | undefined,
    readOnly = false,
  ) {
    const progress = this.state.progress[f.galaxy];
    const store = this.markerStore(f);
    const known = [
      ...new Set([
        ...progress.known,
        ...progress.stations,
        ...progress.charted,
        ...this.explorationSites(f)
          .filter(({ id }) => this.scannedSite(id))
          .map(({ id }) => id),
        ...store.ids().filter((id) => store.get(id) === "identified"),
      ]),
    ];
    const encounterIds =
      f.galaxy === 6 &&
      !progress.questComplete &&
      f.phantom?.phase === "flagship" &&
      f.phantom.enemyIds.includes(PHANTOM_FLAGSHIP)
        ? [PHANTOM_FLAGSHIP]
        : [];
    const job = this.jobIndicator(f);
    const needle = this.needleMarkerObjective(f);
    const indicators = new Map(
      this.flightIndicators(f, job, needle).map(({ id, kind }) => [id, kind]),
    );
    const candidates = new Set([...known, ...store.ids(), ...indicators.keys(), ...encounterIds]);
    const tasks = this.markerTaskContext(f, known);
    const tracked = this.trackedMarker(f, known, tasks.storyTargets, job, needle);
    const categories = new Map<string, NonNullable<PennyMarker["taskCategory"]>>();
    const contributions: TargetContribution[] = known.map((id) => ({ id, source: "ordinary" }));
    const lead = this.scanLeads.get(f);
    const leadTarget = lead && resolveTargetObject(f, lead.targetId);
    const activeLead =
      lead &&
      leadTarget?.state === "present" &&
      this.scanLeadAvailable(f, lead.origin, leadTarget.object)
        ? lead
        : undefined;
    if (activeLead) {
      contributions.push({
        id: activeLead.targetId,
        source: "scan",
      });
    } else if (lead && !readOnly) {
      this.scanLeads.delete(f);
    }
    for (const id of candidates) {
      const links = tasks.links(id);
      const indicator = indicators.get(id);
      const category = tasks.category(
        id,
        links,
        indicator === "objective" || indicator === "questItem" || indicator === "holodisk",
        indicator === "job",
      );
      categories.set(id, category);
      if (links.length > 0) {
        contributions.push({ id, source: "quest" });
      }
      if (encounterIds.includes(id)) {
        const resolved = resolveTargetObject(f, id);
        if (
          resolved.state === "present" &&
          resolved.object.enemy &&
          !resolved.object.enemy.disabled &&
          !resolved.object.enemy.salvaged
        ) {
          const kind = edgeMarkerKind(resolved.object);
          if (kind === "guard" || kind === "heavy") {
            contributions.push({ disclosed: true, distant: true, id, source: "encounter" });
          }
        }
      }
    }
    const points = new Map<string, PennyPoint>();
    const resolve = (id: string): TargetResolution => {
      const resolved = resolveTargetObject(f, id);
      if (resolved.state === "removed") {
        return { state: "removed" };
      }
      const waypoint = tracked?.id === id ? tracked.waypoint : undefined;
      // Course flags stay physical places. Their flight guidance comes from the active course step.
      if (!waypoint && f.galaxy === 4 && isNeedleCourseStart(id)) {
        return { state: "unresolved" };
      }
      const point = waypoint ?? this.markerPoint(f, id, litCaches);
      if (!point) {
        return { state: "unresolved" };
      }
      points.set(id, point);
      return {
        identified: (!waypoint && point.known) || store.get(id) === "identified",
        point,
        state: "present",
        symbol: point.symbol,
        taskCategory: waypoint
          ? waypoint.symbol === "job" || waypoint.jobType || id === NEEDLE_ACTIVITY_TARGET
            ? "job"
            : "story"
          : (categories.get(id) ?? "generic"),
      };
    };
    // Details use the same visibility rules without recording discoveries or retiring markers.
    const registry = readOnly ? new TargetMarkerRegistry() : this.markerRegistry;
    const markers = registry
      .evaluate(
        {
          area,
          player: f.player,
          resolve,
          store: readOnly ? { ...store, remove: () => {}, set: () => {} } : store,
          ...flightWorldContext(f),
          ...(tracked ? { tracked } : {}),
        },
        contributions,
      )
      .flatMap((marker) => {
        const point = points.get(marker.id);
        return point ? [{ ...point, ...marker }] : [];
      });
    return { known, markers, storyTargets: tasks.storyTargets, waypointId: tracked?.waypoint?.id };
  }

  /** Resolve a displayed flight marker against current world and quest state without updating it. */
  markerDetails(marker: PennyMarker): MarkerDetails | null {
    const view = this.markerViews.get(marker);
    const flight = this.state.flight;
    if (
      !view ||
      view.flight !== flight ||
      flight.galaxy !== this.state.selectedGalaxy ||
      this.screen !== "space" ||
      this.state.docked ||
      this.state.dialogue
    ) {
      return null;
    }
    const { known, markers, storyTargets, waypointId } = this.projectTargetMarkers(
      flight,
      view.area,
      view.litCaches,
      true,
    );
    const current = markers.find(({ id }) => id === marker.id);
    if (
      !current ||
      current.identified !== marker.identified ||
      current.trackedLabel !== marker.trackedLabel
    ) {
      return null;
    }
    const { category, id, identified, item, symbol } = current;
    const distance = worldDistance(flightWorldContext(flight), flight.player, current);
    if (!identified) {
      return { kind: "point", point: { category, distance, identified, symbol } };
    }
    const task = this.state.tasks[flight.galaxy];
    const entries = this.quests;
    const quests =
      id === waypointId
        ? entries.filter((entry) => entry.id === this.trackedQuestId)
        : questsForObject(
            {
              galaxy: flight.galaxy,
              knownIds: known,
              quests: entries,
              storyTargets,
              ...(task ? { task } : {}),
            },
            id,
          );
    if (quests.length) {
      return { details: { quests, targetId: id }, kind: "quest" };
    }
    const site =
      category === "discovery"
        ? this.scannableSites(flight).find((site) => site.id === id)
        : undefined;
    const label = site
      ? landmarkLabel((key) => this.label(key), site)
      : this.label(item ?? id) ||
        (symbol === "holodisk" ? this.label("mapHolodiskWaypoint") : "") ||
        (category === "station" ? this.label("station") : "") ||
        (id.startsWith("settlement:") ? this.label("settlement") : "");
    return {
      kind: "point",
      point: { category, distance, identified, symbol, ...(label ? { label } : {}) },
    };
  }

  /** Retained presentation facade; all targets now use the same registry. */
  pennyMarkers(area: Rect, litCaches?: ReadonlySet<string>): PennyMarker[] {
    return this.targetMarkers(area, litCaches);
  }
  /** A tap on the conversation box dismisses the whole conversation, skipping its remaining lines. */
  dismissConversation(): void {
    this.talk.skip();
    this.flushNeedleTalk();
  }
  private flushNeedleTalk(): void {
    if (!this.queuedNeedleTalk) {
      return;
    }
    if (
      this.state.flight?.galaxy !== 4 ||
      this.suspendedInteraction ||
      this.nearest() !== "elderLoom"
    ) {
      this.queuedNeedleTalk = false;
      return;
    }
    if (
      !this.talk.beforeInteraction(NEEDLE_PRELUDE) &&
      this.state.seenConversations.includes("meeting:4:avi") &&
      !this.state.dialogue &&
      !this.state.docked
    ) {
      this.queuedNeedleTalk = false;
      const context = this.chapterContext();
      if (context) {
        this.useChapterPlace(context, "elderLoom");
      }
    }
  }
  private beginConversations(): void {
    this.seenCacheGroups.clear();
    this.scannedLandmarks = [];
    this.scanOutcomes = [];
    // The line pools shuffle from the flight's own seed, so they never draw on launch seeds.
    this.talk.beginFlight(
      this.state.selectedGalaxy,
      { stardust: this.state.economy.stardust > 0 },
      randomStream(this.state.flight?.seed ?? 1, "line-pools"),
    );
    const flight = this.state.flight;
    if (flight?.galaxy === 3 && this.current.holodisk) {
      const pickup = this.whirlpoolDiskPickupId(flight);
      if (this.state.seenConversations.includes(pickup)) {
        this.queueWhirlpoolDiskLines(pickup);
      }
    }
    const courier = ANDROMEDA_LANE_COURIER;
    if (
      this.state.flight?.galaxy === 5 &&
      this.state.progress[5].questComplete &&
      this.state.seenConversations.includes(courier.sighting)
    ) {
      this.talk.authoredCue(courier.id, courier.line);
    }
  }
  get canContinue(): boolean {
    return this.state.started || this.heldStory !== null;
  }
  private get storySceneContext() {
    return {
      canReplay: (galaxy: GalaxyNumber) => canReplayEarthChapter(this.content, this.state, galaxy),
      content: this.content,
      holodisks: holodisksHeld(this.state.progress),
      labels: this.storyLabels,
    };
  }
  private resumeHeldStory(): boolean {
    const held = this.heldStory;
    if (!held) {
      return false;
    }
    this.story = held.position;
    this.slept = held.slept;
    this.heldStory = null;
    this.runScenes = [
      ...new Set([...held.position.trail.map((step) => step.scene), held.position.scene]),
    ];
    this.runs += 1;
    this.run = {
      id: `${held.position.scene.id}#${this.runs}`,
      pages: this.runScenes.flatMap((scene) => scene.pages),
    };
    this.playedInterludes.clear();
    for (const step of held.position.trail) {
      if (stepPage(step).sleep) {
        this.playedInterludes.add(step.scene);
      }
    }
    return true;
  }
  /** Which half and screen shows now. */
  get screen(): Screen {
    if (this.state.mode === "space") {
      // The holodisk moment pauses the flight under its story pages.
      return this.story?.scene.lead === "flight" ? "story" : "space";
    }
    if (this.startShown) {
      return "start";
    }
    return this.selection === null ? "story" : "selector";
  }
  private get replayChapters(): readonly GalaxyNumber[] {
    return ROUTE.filter((galaxy) => canReplayEarthChapter(this.content, this.state, galaxy));
  }
  /** The storybook page on show, with whether Previous can act. */
  get storyView(): StoryView | null {
    const position = this.story;
    if (!position || this.screen !== "story") {
      return null;
    }
    return projectStoryView(
      {
        canSkip: (page) => this.storyCanSkip(position, page),
        choosingReplay: () => this.choosingReplay,
        label: (key) => this.label(key),
        replayChoices: () =>
          this.replayChapters.map((galaxy) => ({ label: this.content.chapters[galaxy]!.name })),
        roomHasReplays: () => this.roomPage && this.replayChapters.length > 0,
        run: () => this.run,
      },
      position,
    );
  }
  private storyCanSkip(position: StoryPosition, page: StoryPage): boolean {
    return storyPageCanSkip(
      (scene) => this.playedInterludes.has(scene),
      () => this.runScenes,
      position,
      page,
    );
  }
  /** Ada's room page, where Back opens Menu unless chapter selection is open. */
  get roomPage(): boolean {
    return storyRoomPage(() => this.screen === "story", this.choosingReplay, this.story);
  }
  /**
   * Whether the Paused card shows Map: in flight only, separate from Pause visibility, and never
   * during dialogue, docking, a suspended interaction or depleted shields.
   */
  get pauseMapAvailable(): boolean {
    if (
      !this.state.prologueSeen ||
      this.state.dialogue ||
      this.state.docked ||
      this.suspendedInteraction ||
      this.depletionContinuation
    ) {
      return false;
    }
    return this.screen === "space" && this.state.flight !== null && this.state.flight.shield > 0;
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
    return this.galaxyMapShownInFlight && this.galaxyMapSelection === this.state.selectedGalaxy;
  }
  /** The galaxy on show in the galaxy map's panel: the ship's, or a locked one viewed. */
  get galaxyMapSelection(): GalaxyNumber | null {
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
  private readonly chapterRosters = new WeakMap<FlightState, readonly PhantomAllySpec[]>();
  private chapterContext(): PhantomContext | undefined {
    const flight = this.state.flight;
    if (!flight) {
      return undefined;
    }
    setNeedleActivity(flight, heldActivity(flight.galaxy, this.state)?.id === "threadNeedle");
    let allies = this.chapterRosters.get(flight);
    if (flight.galaxy === 6 && !allies) {
      allies = phantomAllyRoster(
        GALAXY_NUMBERS.filter((galaxy) => galaxy !== 6).map((galaxy) => ({
          activityCompleted: this.state.progress[galaxy].activityCompleted === true,
          galaxy,
          projects: this.allies(galaxy),
        })),
        SHIP_REACH,
      );
      this.chapterRosters.set(flight, allies);
    }
    return { content: this.content, flight, progress: this.current, ...(allies ? { allies } : {}) };
  }
  private applyChapterResult(result: ChapterResult | void): void {
    if (!result) {
      return;
    }
    if (result.complete && !this.current.questComplete) {
      this.complete();
      const flight = this.state.flight;
      if (flight?.galaxy === 5) {
        this.prepareRedact({ content: this.content, flight, progress: this.current });
      }
    }
    if (result.dialogue) {
      this.state.dialogue = result.dialogue;
    }
    if (result.holodisk && !this.current.holodisk) {
      this.recoverHolodisk();
    }
  }
  private get current(): GalaxyProgress {
    return this.state.progress[this.state.selectedGalaxy];
  }
  private get chapter(): ChapterContent {
    const galaxy = this.state.selectedGalaxy;
    return (BUILT.has(galaxy) && this.content.chapters[galaxy]) || placeholderChapter(galaxy);
  }
  private label(id: string): string {
    return id === ANDROMEDA_REDACT.relayId
      ? ANDROMEDA_REDACT.relayLabel
      : (this.content.labels[id] ?? "");
  }
  /** How many Use presses have been refused, such as Dock in danger; the scene cues each new one. */
  get useRefusals(): number {
    return this.useRefusalCount;
  }
  get inDanger(): boolean {
    return (this.state.flight?.dangerFor ?? 0) > 0;
  }
  get objective(): string {
    return this.objectiveFor(this.state.selectedGalaxy);
  }
  private objectiveFor(galaxy: GalaxyNumber): string {
    const chapter =
      galaxy === this.state.selectedGalaxy
        ? this.chapter
        : (BUILT.has(galaxy) && this.content.chapters[galaxy]) || placeholderChapter(galaxy);
    const context = galaxy === this.state.selectedGalaxy ? this.chapterContext() : undefined;
    const chapterIndex =
      context && chapterRuntime(context.flight.galaxy)?.objectiveIndex?.(context);
    if (chapterIndex !== undefined) {
      return chapter.objectives[chapterIndex] ?? "";
    }
    const p = this.state.progress[galaxy];
    const stages: Partial<Record<GalaxyNumber, readonly number[]>> = {
      1: [0, 1, 2, 3, 4],
      2: [0, 1, 2, 3, 4, 5],
      3: [0, 1, 2, 3, 4, 5],
    };
    // After the space quest, recovering the holodisk comes before the return home.
    const last = chapter.objectives.length - 1;
    const index = p.questComplete ? last - (p.holodisk ? 0 : 1) : (stages[galaxy]?.[p.stage] ?? 0);
    return chapter.objectives[index] ?? "";
  }
  private protectedUsePlace(flight: FlightState, id: string): boolean {
    return (
      routeBlocked(id, flight) ||
      (flight.galaxy === 6 &&
        PHANTOM_DESTINATIONS.some((site) => site === id) &&
        !this.current.phantom?.broken.includes(id))
    );
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
    const progress = this.current;
    let nearest: string | undefined;
    let reach = this.content.tuning.talkRange;
    for (const object of f.objects) {
      if (!(
        (object.kind === "destination" &&
          object.id !== ANDROMEDA_REDACT.relayId &&
          (f.galaxy !== 4 || !isNeedleCourseStart(object.id)) &&
          progress.known.includes(object.id) &&
          !this.protectedUsePlace(f, object.id)) ||
        (object.kind === "station" && progress.stations.includes(object.id))
      )) {
        continue;
      }
      const gap = distance(object, f.player);
      if (gap <= reach && (nearest === undefined || gap < reach)) {
        nearest = object.id;
        reach = gap;
      }
    }
    return nearest;
  }
  /** Save the first visible pass even if Pip's cue waits behind other chatter. */
  andromedaCourierDisplayed(flight: FlightState): void {
    const courier = ANDROMEDA_LANE_COURIER;
    const seen = this.state.seenConversations;
    if (
      this.state.flight !== flight ||
      flight.galaxy !== 5 ||
      !this.state.progress[5].questComplete ||
      this.screen !== "space" ||
      this.state.dialogue ||
      this.state.docked ||
      seen.includes(courier.sighting)
    ) {
      return;
    }
    seen.push(courier.sighting);
    this.talk.authoredCue(courier.id, courier.line);
  }

  /** A rendered landmark may teach Scan without granting charting or survey outcomes. */
  landmarkDisplayed(id: string): void {
    const f = this.state.flight;
    if (
      !f ||
      this.screen !== "space" ||
      this.state.dialogue ||
      this.state.docked ||
      this.scannedSite(id) ||
      !this.scannableSites(f).some((site) => site.id === id)
    ) {
      return;
    }
    this.talk.requestScanLesson(() => this.state.flight === f && !this.scannedSite(id));
  }

  private explorationSites(flight: FlightState) {
    const { worldSide } = flightWorldContext(flight);
    const sites = this.current.explorationSites;
    return sites && worldSide !== undefined
      ? admittedExplorationSites(worldSide, flight.galaxy, flight.seed, sites)
      : [];
  }

  private scannableSites(flight: FlightState): readonly LandmarkSite[] {
    const landmarks = flightLandmarkSites(flight);
    const sites = this.explorationSites(flight);
    return sites.length ? [...landmarks, ...sites] : landmarks;
  }

  private scannedSite(id: string): boolean {
    return (
      this.current.charted.includes(id) ||
      explorationSiteScanned(this.current.explorationSites?.[id])
    );
  }

  private nearestScan(placeId: string | undefined) {
    const f = this.state.flight;
    if (!f || this.state.mode !== "space" || this.state.dialogue || this.state.docked) {
      return undefined;
    }
    const context = flightWorldContext(f);
    const range = this.content.tuning.talkRange;
    const charted = [...this.current.charted];
    for (const { id, opportunity, x, y } of this.explorationSites(f)) {
      if (!this.scannedSite(id)) {
        continue;
      }
      // An older chart can record a Scan before the player recovered this exact wreck.
      const pending =
        opportunity.kind === "salvage" &&
        worldDistance(context, f.player, { x, y }) <= range &&
        f.objects.some(
          (object) =>
            object.id === `${id}:salvage` &&
            object.hp > 0 &&
            object.enemy?.archetype === "frigate" &&
            object.enemy.disabled &&
            !object.enemy.salvaged &&
            worldDistance(context, f.player, object) <= range,
        );
      if (!pending) {
        charted.push(id);
      }
    }
    const site = landmarkScanTarget(
      { ...context, charted, player: f.player, range },
      this.scannableSites(f),
    );
    const place = placeId && f.objects.find(({ id }) => id === placeId);
    return site &&
      (!place || worldDistance(context, f.player, site) < worldDistance(context, f.player, place))
      ? site
      : undefined;
  }

  bossHud(): CapitalBossHud | null {
    const flight = this.state.flight;
    if (this.screen !== "space" || this.state.docked || !flight) {
      return null;
    }
    return projectCapitalBossHud({ content: this.content, flight, progress: this.current });
  }

  private prepareCartwheelClaim(flight: FlightState): void {
    const progress = this.current;
    if (flight.galaxy !== 2 || progress.stage < 3 || !progress.known.includes(HUB_STATION)) {
      return;
    }
    const claim = progress.claim;
    const world = flightWorldContext(flight);
    if (claim?.phase === "away") {
      const { actor, ...saved } = claim;
      holdCartwheelClaimField(flight, claim.fieldId);
      flight.objects.push(actor);
      progress.claim = { ...saved, phase: "active" };
      worldSyncFlightRegion(world, this.content, flight);
      return;
    }
    if (claim) {
      return;
    }
    const hub = flight.objects.find(
      (object) => object.kind === "destination" && object.id === HUB_STATION,
    );
    if (!hub) {
      return;
    }
    const grid = periodicWorldGrid(world, this.content.tuning.chunkSize);
    const cell = worldCellKey(grid, worldCellAt(grid, flight.player));
    if (this.bossPlacementCells.get(flight) === cell) {
      return;
    }
    this.bossPlacementCells.set(flight, cell);
    const placement = placeCartwheelClaim(this.content, flight, hub);
    if (placement) {
      progress.claim = { ...placement, phase: "active" };
    }
  }

  private resolveCartwheelClaim(flight: FlightState, outcome: "defeated" | "salvaged"): void {
    const claim = this.current.claim;
    if (claim?.phase === "active") {
      this.current.claim = { ...claim, outcome, phase: "resolved" };
      openCartwheelClaimField(this.content, flight, claim);
      this.cartwheelClaimCues();
    }
  }

  private cartwheelClaimCues(): void {
    const { id } = CARTWHEEL_CLAIM;
    const claim = this.current.claim;
    if (claim?.phase === "resolved") {
      this.talk.authoredCue(`${id}:resolved`, CARTWHEEL_CLAIM_CUES.resolved);
    } else if (claim?.phase === "active" && this.bossHud()) {
      this.talk.authoredCue(`${id}:approach`, CARTWHEEL_CLAIM_CUES.approach);
    }
  }

  private prepareNeedleBoss(context: ChapterContext): void {
    const { flight, progress } = context;
    const boss = progress.capitalBoss;
    const world = flightWorldContext(flight);
    if (boss?.phase === "away") {
      const { actor, ...saved } = boss;
      flight.objects.push(actor);
      progress.capitalBoss = { ...saved, phase: "active" };
      worldSyncFlightRegion(world, this.content, flight);
      return;
    }
    if (boss || progress.needle?.eyeLit !== NEEDLE.eyeGates) {
      return;
    }
    const grid = periodicWorldGrid(world, this.content.tuning.chunkSize);
    const cell = worldCellKey(grid, worldCellAt(grid, flight.player));
    if (this.bossPlacementCells.get(flight) === cell) {
      return;
    }
    this.bossPlacementCells.set(flight, cell);
    const site = placeNeedleCadence(this.content, flight, (placement) =>
      needleCadenceSite(context, placement),
    );
    if (site) {
      progress.capitalBoss = { phase: "active", site };
    }
  }

  private resolveNeedleBoss(outcome: "defeated" | "salvaged"): void {
    const boss = this.current.capitalBoss;
    if (boss?.phase === "active") {
      this.current.capitalBoss = { outcome, phase: "resolved", site: boss.site };
      this.needleBossCues();
    }
  }

  private needleBossCues(): void {
    const { id } = NEEDLE_CADENCE;
    const boss = this.current.capitalBoss;
    if (boss?.phase === "resolved") {
      this.talk.authoredCue(`${id}:resolved`, NEEDLE_CADENCE_CUES.resolved);
    } else if (boss?.phase === "active" && this.bossHud()) {
      this.talk.authoredCue(`${id}:approach`, NEEDLE_CADENCE_CUES.approach);
    }
  }

  private prepareRedact(context: ChapterContext): void {
    const { flight, progress } = context;
    if (!andromedaRedactEligible(context)) {
      return;
    }
    const boss = progress.redact;
    const world = flightWorldContext(flight);
    if (boss) {
      reserveAndromedaRelaySite(flight, boss.relay);
      if (boss.phase === "away") {
        const { actor, ...saved } = boss;
        flight.objects.push(actor);
        progress.redact = { ...saved, phase: "active" };
        worldSyncFlightRegion(world, this.content, flight);
      } else {
        const relay = andromedaRelayWaypoint(boss);
        if (relay) {
          ensureDestinationAt(this.content, relay.id, relay, flight);
        }
      }
      return;
    }
    const grid = periodicWorldGrid(world, this.content.tuning.chunkSize);
    const cell = worldCellKey(grid, worldCellAt(grid, flight.player));
    if (this.bossPlacementCells.get(flight) === cell) {
      return;
    }
    this.bossPlacementCells.set(flight, cell);
    const stops = [progress.andromeda?.station, progress.andromeda?.settlement].filter(
      (id): id is string => id !== undefined,
    );
    const reservation = reserveAndromedaRedact(
      context,
      (placement) => planRedactEncounter(placement, stops),
      boss,
    );
    if (reservation) {
      progress.redact = reservation;
      admitRedactEncounter(this.content, flight, reservation.site, reservation.relay);
    }
  }

  private resolveRedact(flight: FlightState, outcome: "defeated" | "salvaged"): void {
    const progress = this.current;
    const result = resolveAndromedaRedact(
      { content: this.content, flight, progress },
      progress.redact,
      { id: ANDROMEDA_REDACT.id, outcome },
    );
    if (!result) {
      return;
    }
    progress.redact = result.progress;
    ensureDestinationAt(this.content, result.relay.id, result.relay, flight);
    if (!progress.known.includes(result.discovery.id)) {
      progress.known.push(result.discovery.id);
      progress.discoveries++;
      this.flightEvents.push(result.discovery);
    }
    this.talk.authoredCue(result.cue.id, result.cue.line);
  }

  private redactCues(): void {
    const { id } = ANDROMEDA_REDACT;
    const boss = this.current.redact;
    if (boss?.phase === "resolved") {
      this.talk.authoredCue(`${id}:resolved`, ANDROMEDA_REDACT_CUES.resolved);
    } else if (boss?.phase === "active" && this.bossHud()) {
      this.talk.authoredCue(`${id}:approach`, ANDROMEDA_REDACT_CUES.approach);
    }
  }

  /** Intercepted entries retain their identity as their disclosed attribution changes. */
  get flightLog(): readonly FlightLogEntry[] {
    const needle = this.state.progress[4];
    const memoryPending =
      this.state.selectedGalaxy === 4 &&
      (this.story?.scene.id === "holodisk" ||
        this.heldStory?.position.scene.id === "holodisk" ||
        this.state.dialogue?.context === HOLODISK_MOMENT ||
        this.heldFlight?.dialogue?.context === HOLODISK_MOMENT);
    // Older saves have no completion field. The saved holodisk story cursor still gates them.
    const archieRevealed =
      needle.holodisk &&
      holodisksHeld(this.state.progress) >= ARCHIE_NAMED.holodisks &&
      (needle.needleMemoryRead ?? !memoryPending);
    const transmission = needleCadenceTransmission(needle.capitalBoss, archieRevealed);
    const relay = andromedaRelayWaypoint(this.state.progress[5].redact);
    return [
      ...(transmission ? [transmission] : []),
      ...(relay ? [{ id: relay.id, text: ANDROMEDA_REDACT.relayLabel, waypoint: relay }] : []),
    ];
  }

  private prepareWhirlpoolDisk(flight: FlightState): void {
    const progress = this.current;
    if (
      flight.galaxy !== 3 ||
      progress.holodisk ||
      !progress.questComplete ||
      progress.stage !== 5
    ) {
      return;
    }
    if (!progress.sounder) {
      // Legacy saves had no reveal flag. Preserve any still-unread lead sequence, including
      // a temporarily dismissed panel, and treat an already finished sequence as revealed.
      const pending =
        this.suspendedInteraction?.galaxy === 3
          ? this.suspendedInteraction.dialogue.context
          : undefined;
      const panel = this.state.dialogue?.context ?? pending;
      const hidden =
        panel === "reunion" || panel === "reunionDeparture" || panel === "holodiskLead";
      retireLegacyWhirlpoolDiskGuard(this.content, progress, flight);
      progress.sounder = { phase: hidden ? "hidden" : "revealed" };
    }
    const site = progress.requiredSites?.holodisk;
    if (site) {
      reserveWhirlpoolDiskSite(flight, site);
    }
    if (progress.sounder.phase === "resolved") {
      if (site) {
        ensureDestinationAt(this.content, "holodisk", site, flight);
      }
      return;
    }
    if (progress.sounder.phase === "away") {
      restoreWhirlpoolSounder(this.content, progress.sounder.actors, flight);
      progress.sounder = { phase: "active" };
      return;
    }
    if (progress.sounder.phase !== "revealed") {
      return;
    }
    if (!readRequiredRolePlan(flight, "holodisk")) {
      const grid = periodicWorldGrid(flightWorldContext(flight), this.content.tuning.chunkSize);
      const cell = worldCellKey(grid, worldCellAt(grid, flight.player));
      if (this.bossPlacementCells.get(flight) === cell) {
        return;
      }
      this.bossPlacementCells.set(flight, cell);
      planRequiredWhirlpoolRoutes(this.content, progress, flight, ["holodisk"]);
    }
    if (
      readRequiredRolePlan(flight, "holodisk")?.role === "whirlpool-sounder" &&
      activateRequiredWhirlpoolRoute(this.content, progress, flight, "holodisk")
    ) {
      progress.sounder = { phase: "active" };
    }
  }

  private resolveSounder(flight: FlightState, outcome: "defeated" | "disabled"): void {
    if (flight.galaxy !== 3 || this.current.sounder?.phase !== "active") {
      return;
    }
    this.current.sounder = { outcome, phase: "resolved" };
    this.prepareWhirlpoolDisk(flight);
    this.sounderCues(flight);
  }

  private sounderCues(flight: FlightState): void {
    const { id } = WHIRLPOOL_CAPITAL_BOSS;
    if (flight.galaxy !== 3) {
      return;
    }
    if (this.current.sounder?.phase === "resolved") {
      this.talk.authoredCue(`${id}:resolved`, WHIRLPOOL_BOSS_CUES.resolved);
    } else if (this.current.sounder?.phase === "active" && this.bossHud()) {
      this.talk.authoredCue(`${id}:approach`, WHIRLPOOL_BOSS_CUES.approach);
    }
  }

  private prepareSunflowerBoss(flight: FlightState): void {
    if (flight.galaxy !== 1 || !this.current.questComplete || this.current.stage !== 4) {
      return;
    }
    const saved = this.current.capitalBoss;
    if (saved?.phase === "away") {
      flight.objects.push(saved.actor);
      worldSyncFlightRegion(flightWorldContext(flight), this.content, flight);
      this.current.capitalBoss = { phase: "active", site: saved.site };
      return;
    }
    if (saved) {
      if (
        saved.phase === "resolved" &&
        !saved.cacheClaimed &&
        capitalBossActor(flight, SUNFLOWER_CAPITAL_BOSS.cacheId) === undefined
      ) {
        flight.objects.push(sunflowerBossCache(this.content, saved.site));
        worldSyncFlightRegion(flightWorldContext(flight), this.content, flight);
      }
      return;
    }
    const grid = periodicWorldGrid(flightWorldContext(flight), this.content.tuning.chunkSize);
    const cell = worldCellKey(grid, worldCellAt(grid, flight.player));
    if (this.bossPlacementCells.get(flight) === cell) {
      return;
    }
    this.bossPlacementCells.set(flight, cell);
    const [growers, workshop, salvagers] = ["growers", "workshop", "salvagers"].map(
      (id) =>
        flight.objects.find((object) => object.kind === "destination" && object.id === id) ??
        this.current.requiredSites?.[id],
    );
    if (growers && workshop && salvagers) {
      const site = placeSunflowerCapitalBoss(this.content, flight, [growers, workshop, salvagers]);
      if (site) {
        this.current.capitalBoss = { phase: "active", site };
      }
    }
  }

  private resolveSunflowerBoss(flight: FlightState, outcome: "defeated" | "salvaged"): void {
    const boss = this.current.capitalBoss;
    if (flight.galaxy === 1 && boss?.phase === "active") {
      this.current.capitalBoss = {
        cacheClaimed: false,
        outcome,
        phase: "resolved",
        site: boss.site,
      };
      this.prepareSunflowerBoss(flight);
      this.sunflowerBossCues(flight);
    }
  }

  private sunflowerBossCues(flight: FlightState): void {
    const { id } = SUNFLOWER_CAPITAL_BOSS;
    const boss = this.current.capitalBoss;
    if (flight.galaxy !== 1 || !boss) {
      return;
    }
    if (boss.phase === "resolved") {
      this.talk.authoredCue(`${id}:resolved`, SUNFLOWER_BOSS_CUES.resolved);
    } else if (boss.phase === "active" && this.bossHud()) {
      this.talk.authoredCue(`${id}:approach`, SUNFLOWER_BOSS_CUES.approach);
    }
  }

  private availableContextOffer(id: string | undefined): ContextOffer {
    if (
      this.suspendedInteraction &&
      this.suspendedInteraction.galaxy === this.state.flight?.galaxy &&
      !this.state.dialogue &&
      !this.state.docked
    ) {
      return { action: "use" };
    }
    const job = this.jobUse(id);
    if (job) {
      return { action: job, id };
    }
    const scan = this.nearestScan(id);
    if (scan) {
      return { action: "scan", id: scan.id };
    }
    return id === undefined ? {} : { action: this.availablePlaceAction(id), id };
  }

  private availablePlaceAction(id: string): UseAction | undefined {
    const context = this.chapterContext();
    if (!context) {
      return undefined;
    }
    const { flight, progress } = context;
    const action = chapterRuntime(flight.galaxy)?.action?.(context, id);
    if (action) {
      return action;
    }
    // At a station an action due there comes before Dock (gameplay/rules.md).
    if (id === HUB_STATION) {
      if (flight.galaxy === 2 && this.hubIntroductionDue) {
        return !this.hubSceneDue || this.readyHubDockingScene ? "talk" : undefined;
      }
      if (flight.cargo > 0) {
        return "deposit";
      }
      if (this.readyHubDockingScene) {
        return "talk";
      }
      return this.hubSceneDue ? undefined : "dock";
    }
    if (progress.stations.includes(id)) {
      return this.supplyDue(id) ? "deliver" : "dock";
    }
    if (flight.galaxy === 1 && id === questItemDestination(progress)) {
      return "deliver";
    }
    const authored = this.chapter.dialogue[dialogueKeys[id] ?? id];
    return authored || placeActivity(flight.galaxy, progress, id) ? "talk" : undefined;
  }

  /** Known, in-range places without an available interaction can answer an explicit press. */
  private useHintTarget(place: string | undefined): string | undefined {
    const flight = this.state.flight;
    if (!flight || this.screen !== "space" || this.state.docked || this.state.dialogue) {
      return undefined;
    }
    if (place !== undefined) {
      return place === HUB_STATION && this.hubSceneDue ? undefined : place;
    }
    if (!this.current.charted.length && !this.current.explorationSites) {
      return undefined;
    }
    const world = flightWorldContext(flight);
    let nearest: string | undefined;
    let reach = this.content.tuning.talkRange;
    for (const site of this.scannableSites(flight)) {
      const gap = worldDistance(world, flight.player, site);
      if (
        gap <= reach &&
        (nearest === undefined || gap < reach) &&
        this.scannedSite(site.id) &&
        !this.protectedUsePlace(flight, site.id)
      ) {
        nearest = site.id;
        reach = gap;
      }
    }
    return nearest;
  }

  private contextOffer(): ContextOffer {
    const flight = this.state.flight;
    const place = this.nearest();
    const offer = this.availableContextOffer(place);
    if (!flight || offer.action !== undefined) {
      return offer;
    }
    const id = this.useHintTarget(place);
    return id !== undefined && !this.inRangeQuestDetails(flight, id)
      ? { action: "use", id }
      : offer;
  }

  get contextAction(): UseAction | undefined {
    return this.contextOffer().action;
  }

  /** An explicit press gets the existing immediate feedback slot without a refusal pulse. */
  private showUseHint(id: string): void {
    const flight = this.state.flight;
    if (!flight) {
      return;
    }
    if (this.scannedSite(id)) {
      const site = this.scannableSites(flight).find((candidate) => candidate.id === id);
      if (site) {
        this.notify(
          fill(LANDMARK_SCAN_COPY.outcomeRemembered, {
            target: landmarkLabel((key) => this.label(key), site),
          }),
          "brief",
          "refusal",
        );
        return;
      }
    }
    if (flight.galaxy !== 5) {
      this.notify(MAPPED_PLACE_RETURN_LINE.text, "brief", "refusal");
      return;
    }
    const progress = this.state.progress[5];
    const objective = this.objectiveId(5);
    const known =
      objective && (progress.known.includes(objective) || progress.stations.includes(objective));
    const text =
      progress.stage === 0
        ? id === ANDROMEDA_PLACES.pip
          ? ANDROMEDA_STATION_HINT
          : ANDROMEDA_CHAPTER.objectives[0]
        : known && objective !== id && !progress.questComplete
          ? this.objectiveFor(5)
          : MAPPED_PLACE_RETURN_LINE.text;
    this.notify(text ?? MAPPED_PLACE_RETURN_LINE.text, "brief", "refusal");
  }
  /**
   * The destination or station Use acts on and its action, for the Use callout above it;
   * undefined when Use acts on no place, as on a tow line's craft.
   */
  get useTarget(): { action: UseAction; id: string } | undefined {
    const { action, id } = this.contextOffer();
    return action === undefined || action === "tow" || id === undefined || this.suspendedInteraction
      ? undefined
      : { action, id };
  }
  /** Read-only Use fallback. Every available interaction takes priority on every visit. */
  get contextQuestDetails(): ContextQuestDetails | null {
    const flight = this.state.flight;
    if (
      this.screen !== "space" ||
      !flight ||
      this.state.dialogue ||
      this.state.docked ||
      this.suspendedInteraction
    ) {
      return null;
    }
    const place = this.nearest();
    if (this.availableContextOffer(place).action !== undefined) {
      return null;
    }
    return this.questDetailsFallback(flight, place, this.useHintTarget(place));
  }

  private questDetailsFallback(
    flight: FlightState,
    place: string | undefined,
    hint: string | undefined,
  ): ContextQuestDetails | null {
    return this.screen !== "space" || (place !== undefined && hint === undefined)
      ? null
      : this.inRangeQuestDetails(flight, hint);
  }

  private inRangeQuestDetails(
    flight: FlightState,
    hintTarget?: string,
  ): ContextQuestDetails | null {
    const progress = this.current;
    const task = this.state.tasks[flight.galaxy];
    return projectInRangeQuestDetails(
      {
        galaxy: flight.galaxy,
        knownIds: [...progress.known, ...progress.stations, ...progress.charted],
        quests: this.quests,
        storyTargets: [this.objectiveId(flight.galaxy), questItemDestination(progress)].filter(
          (id): id is string => typeof id === "string",
        ),
        ...(task ? { task } : {}),
        protectedUsePlace: (id) => this.protectedUsePlace(flight, id),
        range: this.content.tuning.talkRange,
      },
      flight,
      hintTarget,
    );
  }
  /** The Use action's name, the disc's accessible name. */
  get contextLabel(): string | undefined {
    const action = this.contextAction;
    return action === "scan"
      ? LANDMARK_SCAN_COPY.action
      : action === undefined
        ? undefined
        : this.label(action);
  }
  weapons(): WeaponChoice[] {
    return this.state.mode === "space" && this.state.flight ? ownedWeapons(this.state.flight) : [];
  }
  /** False when the current screen or loadout refuses the selection. */
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
        label: this.destinationLabel(id),
      })),
      ...this.current.stations
        .filter((id) => !this.current.known.includes(id))
        .filter((id) => !this.state.flight || this.stationSite(this.state.flight, id) !== null)
        .map((id) => ({ id, label: this.label("station") })),
    ];
  }
  private cartwheelHubName(galaxy: GalaxyNumber, id: string): string | undefined {
    return galaxy === CARTWHEEL_STORY_SHIPS.galaxy && id === HUB_STATION
      ? this.content.chapters[galaxy]?.name
      : undefined;
  }
  private destinationLabel(id: string): string {
    return (
      this.cartwheelHubName(this.state.selectedGalaxy, id) ??
      (this.label(id) ||
        (id.startsWith("settlement:")
          ? this.label("settlement")
          : (this.chapter.dialogue[dialogueKeys[id] ?? id]?.speaker ?? this.chapter.name)))
    );
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
    return canRechargeShield(ship, flight) && flight.sinceDamage >= ship.shieldRechargeDelay;
  }
  /** During a flight its loadout is authoritative; the economy mirrors it. */
  private pullLoadout(): void {
    const flight = this.state.flight;
    if (!flight) {
      return;
    }
    const economy = this.state.economy;
    economy.ownedWeapons = [...ensureOwnedWeapons(flight)];
    economy.weapon = flight.weapon;
    economy.levels = structuredClone(flight.levels);
    if (flight.shieldRechargeCredit !== undefined) {
      economy.shieldRechargeCredit = flight.shieldRechargeCredit;
    }
    if (flight.shieldOreSpent !== undefined) {
      economy.shieldOreSpent = flight.shieldOreSpent;
    }
    for (const weapon of UPGRADE_WEAPONS) {
      economy.ammo[weapon] = flight.ammo[weapon];
    }
  }
  private grantPickupAmmo(weapon: UpgradeWeapon): void {
    const before = this.state.economy.ammo[weapon];
    applyUpgrade(ECONOMY, { kind: "ammo", weapon }, this.state.economy);
    const added = this.state.economy.ammo[weapon] - before;
    this.pushLoadout();
    if (added > 0) {
      this.pickupFeedback.push({ added, kind: "ammo", weapon });
    }
  }
  /** Applied pickup feedback leaves once and is never serialized. */
  drainPickupFeedback(): readonly PickupFeedback[] {
    const feedback = this.pickupFeedback;
    this.pickupFeedback = [];
    return feedback;
  }
  /** Immutable scan facts leave once; presentation never reconstructs quest completion. */
  drainScanOutcomes(): readonly ScanOutcome[] {
    const outcomes = Object.freeze([...this.scanOutcomes]);
    this.scanOutcomes = [];
    return outcomes;
  }
  private scanLeadAvailable(flight: FlightState, origin: Vec, object: SpaceObject): boolean {
    const enemy = object.enemy;
    if (!enemy || object.hp <= 0) {
      return false;
    }
    const world = flightWorldContext(flight);
    if (
      worldDistance(world, origin, object) > TARGET_MARKER_RANGE ||
      worldDistance(world, flight.player, object) > TARGET_MARKER_RANGE
    ) {
      return false;
    }
    return !enemy.disabled && enemy.packId?.startsWith("pack:") === true;
  }

  private scanActionLead(
    flight: FlightState,
    site: LandmarkSite,
    leadStation: string | undefined,
  ): ScanActionLead | undefined {
    if (leadStation !== undefined) {
      return undefined;
    }
    const store = this.markerStore(flight);
    const world = flightWorldContext(flight);
    const patrol = flight.objects
      .filter(
        (object) =>
          store.get(object.id) === "identified" && this.scanLeadAvailable(flight, site, object),
      )
      .sort(
        (a, b) =>
          worldDistance(world, site, a) - worldDistance(world, site, b) || a.id.localeCompare(b.id),
      )[0];
    return patrol ? { kind: "patrol", targetId: patrol.id } : undefined;
  }

  private emitScanOutcome(
    flight: FlightState,
    targetId: string,
    source: ScanOutcome["source"],
    completions: readonly ScanCompletion[],
    site = landmarkById(flight.galaxy, targetId),
    leadStation?: string,
    wreckRecovered?: true,
  ): void {
    if (!site) {
      return;
    }
    const actionLead =
      source === "scan" && !wreckRecovered
        ? this.scanActionLead(flight, site, leadStation)
        : undefined;
    if (source === "scan") {
      if (actionLead) {
        this.scanLeads.set(flight, { ...actionLead, origin: { x: site.x, y: site.y } });
      } else {
        this.scanLeads.delete(flight);
      }
    }
    const outcome = immutableScanOutcome({
      ...(actionLead ? { actionLead } : {}),
      completions,
      galaxy: flight.galaxy,
      ...(leadStation === undefined ? {} : { leadStation }),
      source,
      target: {
        id: site.id,
        name: landmarkLabel((key) => this.label(key), site),
        symbol: site.kind,
      },
      targetId,
      ...(wreckRecovered ? { wreckRecovered } : {}),
    });
    this.scanOutcomes.push(outcome);
    this.talk.scanOutcome(outcome);
    if (
      source === "scan" &&
      !Object.hasOwn(this.current.explorationSites ?? {}, targetId) &&
      !this.talk.poiDiscovered(
        { id: site.id, kind: "landmark", symbol: site.kind },
        this.poiNearby(flight, site),
        true,
      )
    ) {
      this.scannedLandmarks.push(site.id);
    }
  }
  /** Credit only the accepted survey's actual target through the ordinary completion pipeline. */
  private reconcileScannedSurvey(
    flight: FlightState,
    source: ScanOutcome["source"],
    scannedId?: string,
  ): boolean {
    const held = this.held;
    if (
      !held ||
      held.type !== "survey" ||
      (scannedId !== undefined && held.target.id !== scannedId) ||
      !this.state.progress[flight.galaxy].charted.includes(held.target.id)
    ) {
      return false;
    }
    const quest = {
      icon: { jobType: held.type, symbol: "job" as const },
      id: taskQuestId(flight.galaxy, held),
      name: this.jobTextIn(flight.galaxy, held).title,
    };
    this.finishJob(flight);
    if (this.held?.id === held.id) {
      return false;
    }
    this.emitScanOutcome(flight, held.target.id, source, [{ kind: "quest", quest }]);
    return true;
  }
  /**
   * Gives an upgrade pickup's gift, chosen from what Ada can use as she collects it and seeded
   * by the pickup; the HUD's item notice names it from what Ada then holds. A new weapon joins
   * the roster with its packs and equips immediately.
   */
  private collectUpgrade(id: string, flight: FlightState): void {
    this.pullLoadout();
    const gift = chooseUpgrade(
      ECONOMY,
      this.state.economy,
      ROUTE_POSITION[flight.galaxy],
      dropRandom(flight.seed, `upgrade:${id}`),
    );
    if (!gift) {
      return;
    }
    if (gift.kind === "weapon") {
      collectWeapon(gift.weapon, flight);
      this.pullLoadout();
    } else if (gift.kind === "ammo") {
      this.grantPickupAmmo(gift.weapon);
    } else {
      applyUpgrade(ECONOMY, gift, this.state.economy);
      this.pushLoadout();
    }
    this.syncAchievements();
  }
  /**
   * Gives an ammo pack pickup's pack, for an owned weapon other than Laser in any galaxy, chosen
   * by the ammo pack weights as Ada collects it and seeded by the pickup; the item notice names
   * it.
   */
  private collectAmmoPack(id: string, flight: FlightState): void {
    this.pullLoadout();
    const weapon = chooseAmmoPack(
      ECONOMY,
      this.state.economy.ownedWeapons,
      dropRandom(flight.seed, `ammo:${id}`),
    );
    if (weapon) {
      this.grantPickupAmmo(weapon);
    }
  }
  /** Purchases change the economy, which then refreshes the flight's loadout. */
  private pushLoadout(): void {
    const flight = this.state.flight;
    if (!flight) {
      return;
    }
    const economy = this.state.economy;
    const before = shipTuning(ECONOMY, this.content, flight.levels).shieldMax;
    flight.ownedWeapons = [...economy.ownedWeapons];
    flight.levels = structuredClone(economy.levels);
    for (const weapon of UPGRADE_WEAPONS) {
      flight.ammo[weapon] = economy.ammo[weapon];
    }
    // A bought shield level adds its capacity to the current charge.
    const after = shipTuning(ECONOMY, this.content, flight.levels).shieldMax;
    flight.shield = Math.min(after, flight.shield + Math.max(0, after - before));
  }
  get stationServices(): StationServices | null {
    const flight = this.state.flight;
    const id = this.state.docked;
    if (!flight || !id || !this.stationSite(flight, id)) {
      return null;
    }
    const specialty = stationSpecialty(flight.galaxy, id);
    const all = specialty === null;
    return {
      equipment: all || specialty === "equipment",
      exchange: true,
      heldTask: Boolean(this.state.tasks[flight.galaxy]),
      jobs: all || specialty === "jobs",
      projects: this.projects !== null,
      weaponsAmmo: all || specialty === "weaponsAmmo",
    };
  }
  private shopSupply() {
    return dockedShopSupply(this.stationServices, this.shopPosition, this.state);
  }
  shopGroups() {
    const supply = this.shopSupply();
    if (!supply) {
      return undefined;
    }
    this.pullLoadout();
    return dockedShopGroups(this.state.economy, supply);
  }
  shopRows(tab: ShopTab): ShopRow[] {
    return (
      this.shopGroups()?.flatMap(({ category, rows }) =>
        (category === "equipment") === (tab === "ship") ? rows : [],
      ) ?? []
    );
  }
  /** The route position of the galaxy whose shop Ada is at, which sets what it sells. */
  private get shopPosition(): RoutePosition {
    return ROUTE_POSITION[this.state.flight?.galaxy ?? this.state.selectedGalaxy];
  }
  requestPurchase(item: ShopItem): PurchaseRequest {
    const supply = this.shopSupply();
    if (!supply || !dockedShopOffers(supply, item)) {
      return { kind: "refused", reason: "notForSale" };
    }
    this.pullLoadout();
    if (item.kind === "holodisk") {
      const row = supply.holodisk;
      const stardust = this.state.economy.stardust;
      return row?.price == null
        ? { kind: "refused", reason: "notForSale" }
        : row.price > stardust
          ? { kind: "refused", reason: "cantAfford" }
          : { kind: "confirm", left: stardust - row.price, price: row.price };
    }
    if (!onSale(this.shopPosition, item)) {
      return { kind: "refused", reason: "notForSale" };
    }
    return requestPurchase(ECONOMY, this.state.economy, item, supply.visit);
  }
  /**
   * Purchases happen only while docked. Buying the hub's holodisk closes the station card and
   * plays its insertion, as funding a project closes it for the thank-you line.
   */
  buy(item: ShopItem): PurchaseResult {
    const supply = this.shopSupply();
    if (!supply || !dockedShopOffers(supply, item)) {
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
    if (!onSale(this.shopPosition, item)) {
      return { kind: "refused", reason: "notForSale" };
    }
    const visit = supply.visit ?? {
      ...supply.station,
      state: newStationRestock(),
      stock: supply.stock,
    };
    const result = buy(ECONOMY, item, this.state.economy, visit);
    if (result.kind === "bought") {
      this.state.stationRestock = visit.state;
    }
    this.pushLoadout();
    this.syncAchievements();
    return result;
  }
  /**
   * The docked galaxy's unlocked community projects, or null if the station offers none.
   */
  get projects(): ProjectView[] | null {
    const galaxy = this.state.flight?.galaxy;
    if (!this.state.docked || !galaxy || !projectsOffered(this.state.progress[galaxy])) {
      return null;
    }
    const catalog = galaxyProjects(galaxy);
    return catalog.length ? projectViews(catalog, this.state.progress[galaxy]) : null;
  }
  /** The donation confirm for a docked galaxy's project (projects.ts). */
  donationRequest(id: string): DonationRequest {
    const galaxy = this.state.flight?.galaxy;
    if (!this.state.docked || !galaxy) {
      return { kind: "refused" };
    }
    return donationRequest(
      galaxyProjects(galaxy),
      this.state.progress[galaxy],
      this.state.economy.stardust,
      id,
    );
  }
  /**
   * A confirmed donation toward a docked galaxy's project. Funding the last part closes the
   * station card and queues the speaker's thank-you line in the conversation box.
   */
  donate(id: string): DonationResult {
    const galaxy = this.state.flight?.galaxy;
    if (!this.state.docked || !galaxy) {
      return { kind: "refused" };
    }
    const economy = this.state.economy;
    const result = donate(
      galaxyProjects(galaxy),
      this.state.progress[galaxy],
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
  /** Each galaxy's allies for the Phantom finale, one per funded project. */
  allies(galaxy: GalaxyNumber): ReturnType<typeof projectAllies> {
    return projectAllies(galaxyProjects(galaxy), this.state.progress[galaxy]);
  }
  /** Each galaxy's world changes at their sites, one per funded project (projects.ts). */
  worldChanges(galaxy: GalaxyNumber): WorldChange[] {
    return worldChanges(galaxyProjects(galaxy), this.state.progress[galaxy]);
  }
  /** Records that a funded project's world change has played its one reveal (projects.ts). */
  revealWorldChange(galaxy: GalaxyNumber, id: string): boolean {
    return revealWorldChange(galaxyProjects(galaxy), this.state.progress[galaxy], id);
  }
  /** Exchange uses the one fungible ore balance and never emits a pickup event. */
  previewExchange(order: ExchangeOrder): ExchangePreview {
    const flight = this.state.flight;
    if (this.state.mode !== "space" || !flight || !this.state.docked || this.state.dialogue) {
      return { kind: "refused", reason: "unavailable" };
    }
    return quoteExchange(
      EXCHANGE_RATES,
      { ore: flight.cargo, stardust: this.state.economy.stardust },
      order,
    );
  }
  confirmExchange(quote: ExchangeQuote): ExchangePreview {
    const flight = this.state.flight;
    if (this.state.mode !== "space" || !flight || !this.state.docked || this.state.dialogue) {
      return { kind: "refused", reason: "unavailable" };
    }
    const result = confirmExchange(
      EXCHANGE_RATES,
      { ore: flight.cargo, stardust: this.state.economy.stardust },
      quote,
    );
    if (result.kind === "quote") {
      flight.cargo = result.after.ore;
      this.state.economy.stardust = result.after.stardust;
    }
    return result;
  }
  previewImmediateExchange(order: ImmediateExchangeOrder): ImmediateExchangePreview {
    const flight = this.state.flight;
    if (this.state.mode !== "space" || !flight || !this.state.docked || this.state.dialogue) {
      return { kind: "refused", reason: "unavailable" };
    }
    return previewImmediateExchange(
      { ore: flight.cargo, stardust: this.state.economy.stardust },
      order,
    );
  }
  /** Recheck live balances and apply both resource changes in one transaction. */
  exchangeImmediately(order: ImmediateExchangeOrder): ImmediateExchangeResult {
    const flight = this.state.flight;
    const result = this.previewImmediateExchange(order);
    if (!flight || result.kind === "refused") {
      return { kind: "refused", reason: result.kind === "refused" ? result.reason : "unavailable" };
    }
    flight.cargo = result.after.ore;
    this.state.economy.stardust = result.after.stardust;
    return { ...result, kind: "exchanged" };
  }
  selectPaint(scheme: string): boolean {
    return selectPaint(ECONOMY, scheme, this.state.economy);
  }
  /** The berth and committed story state reconstruct the due panel on Continue. */
  get stationTalk(): { readonly stationId: string; readonly panel: DialogueState | null } | null {
    const { docked, flight } = this.state;
    if (
      !docked ||
      !flight ||
      this.screen !== "space" ||
      this.state.dialogue ||
      !this.stationServices
    ) {
      return null;
    }
    if (flight.galaxy === 2 && docked === HUB_STATION) {
      const scene = this.readyHubDockingScene;
      const key = scene
        ? (scene.talkPage ?? CARTWHEEL_STORY_SHIPS.scenes.docking.line)
        : !this.hubSceneDue && this.hubIntroductionDue
          ? HUB_STATION
          : undefined;
      const entry = key && this.chapter.dialogue[key];
      if (!key || !entry) {
        return { panel: null, stationId: docked };
      }
      if (
        this.stationTalkVisit?.flight !== flight ||
        this.stationTalkVisit.stationId !== docked ||
        this.stationTalkVisit.panel.context !== key
      ) {
        this.stationTalkVisit = {
          flight,
          panel: this.dialoguePanel(key, entry.text, entry.speaker),
          stationId: docked,
        };
      }
      return { panel: this.stationTalkVisit.panel, stationId: docked };
    }
    if (flight.galaxy !== 5) {
      return { panel: null, stationId: docked };
    }
    const context = { content: this.content, flight, progress: this.current };
    const topic = andromedaStationTopic(context, docked);
    if (!topic) {
      this.stationTalkVisit = null;
      return { panel: null, stationId: docked };
    }
    if (
      this.stationTalkVisit?.flight !== flight ||
      this.stationTalkVisit.stationId !== docked ||
      this.stationTalkVisit.panel.context !== `andromeda:${topic}`
    ) {
      const panel = useAndromeda(context, docked)?.dialogue;
      this.stationTalkVisit = panel ? { flight, panel, stationId: docked } : null;
    }
    return { panel: this.stationTalkVisit?.panel ?? null, stationId: docked };
  }

  chooseStationTalk(panel: DialogueState, id: string): void {
    if (
      this.stationTalk?.panel !== panel ||
      !panel.choices.some((choice) => choice.id === id && !choice.refused)
    ) {
      return;
    }
    const flight = this.state.flight;
    if (
      flight?.galaxy === 2 &&
      this.state.docked === HUB_STATION &&
      panel.context === HUB_STATION &&
      id === "continue"
    ) {
      this.current.introduced = true;
      this.current.stage = Math.max(1, this.current.stage);
      this.stationTalkVisit = null;
      return;
    }
    const scene = this.readyHubDockingScene;
    if (scene && this.state.docked === HUB_STATION) {
      if (id !== "continue") {
        return;
      }
      const next = this.chapter.dialogue[panel.context]?.then;
      if (isCartwheelDockingTalkPage(next)) {
        scene.talkPage = next;
      } else if (panel.context === "approachThanks") {
        this.stationTalkVisit = null;
        scene.lineDue = false;
        delete scene.talkPage;
      }
      return;
    }
    const result =
      flight &&
      chooseAndromeda({ content: this.content, flight, progress: this.current }, panel, id);
    if (result) {
      this.stationTalkVisit = null;
      this.applyChapterResult(result);
    }
  }

  /** Undocking leaves Ada at rest where she docked (gameplay/economy.md). */
  undock(): void {
    if (this.state.docked && this.state.flight) {
      undockFlight(this.content, this.state.flight);
    }
    this.state.docked = null;
    this.greeting = null;
    this.stationTalkVisit = null;
  }
  /**
   * A docking's keeper greeting (gameplay/rules.md "Species and greeters"): the full greeting the
   * first time, then one later line in turn. The docking counts as greeted at once.
   */
  private greet(galaxy: GalaxyNumber, id: string): void {
    const greetings = this.state.progress[galaxy].greetings;
    const docked = greetings[id] ?? 0;
    this.restoreGreeting(galaxy, id, docked);
    if (this.greeting) {
      greetings[id] = docked + 1;
    }
  }
  private restoreGreeting(galaxy: GalaxyNumber, id: string, docked: number): void {
    this.greeting = resolveStationGreeting(this.state, galaxy, id, docked);
  }
  /** The docked station keeper's line on show; null where the generic welcome shows. */
  get stationGreeting(): StationGreeting | null {
    const greeting = this.greeting;
    return projectStationGreeting(this.state.docked, greeting);
  }
  /** The compact Dock tab uses the personal name without changing the greeting text. */
  dockGreeting(): StationGreeting | null {
    const greeting = this.stationGreeting;
    return compactStationGreeting(this.state, greeting);
  }
  /** The ordinary Station welcome retains the selected keeper and all authored sentences. */
  dockWelcome(): StationGreeting | null {
    const greeting = this.dockGreeting();
    return greeting ? projectStationWelcome(this.greeting, greeting) : null;
  }
  get dockedStationName(): string | undefined {
    const { docked, flight } = this.state;
    return docked && flight ? this.keeperStationName(flight.galaxy, docked) : undefined;
  }
  private keeperStationName(galaxy: GalaxyNumber, id: string): string {
    return keeperStationName(galaxy, id);
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
    // Danger blocks Dock as it blocks Travel: Ada must break contact first.
    if (this.inDanger) {
      this.refuse(this.label("travelUnavailable"));
      this.useRefusalCount++;
      return;
    }
    if (!dockFlight(this.content, id, f)) {
      return;
    }
    this.state.docked = id;
    this.stationTalkVisit = null;
    if (this.state.stationRestock) {
      const supply = this.shopSupply();
      if (supply?.visit) {
        this.pullLoadout();
        restockStationShop(
          ECONOMY,
          this.state.economy,
          this.shopPosition,
          supply.stock,
          supply.visit,
        );
      }
    }
    this.dockedThisFlight = true;
    this.greet(f.galaxy, id);
    const held = this.held;
    if (held?.type === "delivery" && held.station === id) {
      held.carrying = true;
    }
  }
  /** The introduction must finish before the first ordinary ore deposit. */
  private get hubIntroductionDue(): boolean {
    const progress = this.current;
    return progress.stage === 0 || (!progress.introduced && !progress.questComplete);
  }
  /** Pending docked Talk is separate from an active scene or its blocked-approach reaction. */
  private get hubSceneCoversFlightDialogue(): boolean {
    return this.state.flight?.storyScene?.lineDue === true && !this.readyHubDockingScene;
  }
  /** Dock waits for the hub scene and its dialogue, including a docking replay yet to start. */
  private get hubSceneDue(): boolean {
    const flight = this.state.flight;
    return Boolean(
      flight?.storyScene?.lineDue ||
      (flight?.galaxy === 2 && this.current.replayScene === "docking"),
    );
  }
  private get readyHubDockingScene(): FlightState["storyScene"] {
    const flight = this.state.flight;
    const scene = flight?.storyScene;
    return flight?.galaxy === 2 &&
      scene?.id === "docking" &&
      scene.lineDue &&
      flight.time >= scene.at + CARTWHEEL_STORY_SHIPS.scenes.docking.duration
      ? scene
      : undefined;
  }
  /** Whether a carried supply run is bound for this station, so Use delivers it there. */
  private supplyDue(id: string): boolean {
    const f = this.state.flight;
    const activity = f && heldActivity(f.galaxy, this.state);
    return activity?.id === "supplyRun" && activity.carrying === true && activity.target?.id === id;
  }
  private dialoguePanel(context: string, text: string, title = this.chapter.name): DialogueState {
    return {
      choices: [{ id: "continue", label: this.label("continue") }],
      context,
      text,
      title,
    };
  }
  private panel(context: string, text: string, title?: string): void {
    this.state.dialogue = this.dialoguePanel(context, text, title);
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
    const activity = f && placeActivity(f.galaxy, this.current, place);
    if (!f || !activity) {
      this.exchange(key);
      return;
    }
    const speaker = this.chapter.dialogue[key]?.speaker ?? (this.label(place) || this.chapter.name);
    const context = this.chapterContext();
    const extraChoices = context
      ? (chapterRuntime(f.galaxy)?.activityChoices?.(context, place) ?? [])
      : [];
    const held = heldActivity(f.galaxy, this.state);
    if (held?.place === place) {
      if (held.id === "supplyRun") {
        held.carrying = true;
      }
      this.state.dialogue = {
        choices: [
          { id: "drop", label: this.label("jobDrop") },
          { id: "continue", label: this.label("activityKeep") },
          ...extraChoices,
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
      if (activity.id === "courierRun") {
        this.state.dialogue = this.courierUnavailableDialogue();
      } else {
        this.exchange(key);
      }
      return;
    }
    const busy = this.state.tasks[f.galaxy];
    if (activity.id === "courierRun") {
      const refused = busy ? { refused: true } : {};
      this.state.dialogue = {
        choices: [
          { id: "scout", label: this.label("activityPipScout"), ...refused },
          { id: "escort", label: this.label("activityPipStay"), ...refused },
          { id: "skip", label: this.label("activitySkip") },
        ],
        context: "activity:courier",
        text: this.label("activityPipChoice"),
        title: speaker,
      };
      return;
    }
    this.state.dialogue = {
      choices: [
        { id: "take", label: this.label("activityTake"), ...(busy ? { refused: true } : {}) },
        { id: "skip", label: this.label("activitySkip") },
        ...extraChoices,
      ],
      context: `activity:${place}`,
      text: this.label(activity.places[place]!),
      title: speaker,
    };
  }
  private courierUnavailableDialogue(): DialogueState {
    return {
      choices: [{ id: "continue", label: this.label("continue") }],
      context: "courierUnavailable",
      text: this.label("activityPipUnavailable"),
      title: this.label(ANDROMEDA_PLACES.pip),
    };
  }
  /**
   * The terms a place's activity would be accepted on now, or null when it makes no offer: the
   * next guide's calf start from the family where it is this flight, a supply run's destination
   * and pay from the known stations, or the activity's own reward.
   */
  private activityTerms(f: FlightState, place: string): ActivityTerms | null {
    const activity = placeActivity(f.galaxy, this.current, place);
    const at = f.objects.find((o) => o.kind === "destination" && o.id === place);
    if (!activity || !at) {
      return null;
    }
    if (activity.id === "courierRun") {
      return courierTerms(this.content, f, at, activity.reward!);
    }
    if (activity.id === "supplyRun") {
      const stations = this.current.stations.flatMap((id) => this.stationSite(f, id) ?? []);
      return supplyTerms(f.galaxy, stations, at);
    }
    if (activity.id === "guideCalf") {
      const start = calfStart(f.galaxy, at, this.current.guides ?? 0);
      return start ? { reward: activity.reward!, start } : null;
    }
    return { reward: activity.reward! };
  }
  /** Accepts the offered activity, or refuses while the galaxy's slot is taken. */
  private takeActivity(place: string, courierApproach?: CourierApproach): void {
    const f = this.state.flight;
    if (!f) {
      return;
    }
    const busy = this.state.tasks[f.galaxy];
    if (busy) {
      this.refuse(this.label(busy.kind === "job" ? "jobBusy" : "activityBusy"), "reading");
      return;
    }
    const terms = this.activityTerms(f, place);
    if (!terms) {
      if (courierApproach) {
        this.state.dialogue = this.courierUnavailableDialogue();
      }
      return;
    }
    if (
      !acceptActivity(f.galaxy, this.current, this.state, place, {
        ...terms,
        ...(courierApproach ? { courierApproach } : {}),
      })
    ) {
      return;
    }
    if (terms.start && !courierApproach) {
      this.current.guides = (this.current.guides ?? 0) + 1;
    }
    if (heldActivity(f.galaxy, this.state)?.id === "threadNeedle") {
      setNeedleActivity(f, true);
    }
    this.state.dialogue = null;
  }
  /**
   * Returns the galaxy's held activity to its start: the guided calf goes back to its start spot
   * and its hunter pack is placed again. Leaving the galaxy (the galaxy map's Earth or Jump), a
   * shield-depletion jump and Drop use it.
   */
  resetActivity(galaxy: GalaxyNumber): void {
    const f = this.state.flight;
    const held = heldActivity(galaxy, this.state);
    if (held?.id === "courierRun") {
      resetCourier(held);
      if (f?.galaxy === galaxy && held.start) {
        positionCourier(this.content, f, held.start);
        clearCourierPatrol(this.content, f);
      }
    }
    if (held?.id === "threadNeedle") {
      held.lit = 0;
      held.cleanRun = true;
      if (f?.galaxy === galaxy) {
        setNeedleActivity(f, false);
        retireNeedleActivityPatrols(this.content, f);
      }
    }
    if (f?.galaxy === galaxy && held?.id === "guideCalf") {
      delete f.calf;
    }
  }
  /** Drops the held activity, losing its progress. */
  private dropHeldActivity(galaxy: GalaxyNumber): boolean {
    this.resetActivity(galaxy);
    return dropActivity(galaxy, this.state);
  }
  /** Pays the held activity with the job completion notice and frees the galaxy's slot. */
  private finishActivity(galaxy: GalaxyNumber, completionNote?: string): void {
    const reward = completeActivity(galaxy, this.state);
    if (!reward) {
      return;
    }
    this.state.progress[galaxy].activityCompleted = true;
    this.state.economy.stardust += reward;
    const notice = fill(this.label("jobComplete"), { amount: reward });
    this.notify(completionNote ? `${notice} ${completionNote}` : notice);
    this.recordAchievement({ kind: "activityCompleted" });
  }
  private exchange(key: string): void {
    const entry = this.chapter.dialogue[key];
    if (!entry) {
      return;
    }
    this.panel(key, entry.text, entry.speaker);
    const flight = this.state.flight;
    if (
      flight?.galaxy === 3 &&
      key === "holodiskLeadSong" &&
      this.current.sounder?.phase === "hidden"
    ) {
      this.current.sounder = { phase: "revealed" };
      this.prepareWhirlpoolDisk(flight);
    }
  }
  private launch(): void {
    this.pickupFeedback = [];
    const geography = initializeGalaxyGeography(this.entropy, this.current);
    const randomSeed = this.entropy();
    const seed = randomSeed === this.previousSeed ? (randomSeed + 1) >>> 0 : randomSeed;
    this.previousSeed = seed;
    const flight = createUnpopulatedFlight(
      this.content,
      this.state.selectedGalaxy,
      geography.seed,
      this.state.economy,
      seed,
    );
    flight.topology = CURRENT_FLIGHT_TOPOLOGY;
    if (flight.galaxy === 1 && !this.current.questComplete) {
      const sites = galaxyRoute(flight.galaxy).filter((id) => !this.current.known.includes(id));
      if (populateRequiredFlight(this.content, this.current, sites, flight).status === "blocked") {
        return;
      }
    } else if (flight.galaxy === 1) {
      populateRequiredChapterFlight(this.content, this.current, flight, () => {
        for (const id of this.current.known) {
          const site = this.current.requiredSites?.[id];
          if (site) {
            ensureDestinationAt(this.content, id, site, flight);
          } else {
            ensureDestination(this.content, id, flight);
          }
        }
        this.prepareSunflowerBoss(flight);
      });
    } else if (flight.galaxy === 2) {
      populateRequiredChapterFlight(this.content, this.current, flight, () => {
        planRequiredCartwheelRoute(this.content, this.current, flight);
        this.prepareCartwheelClaim(flight);
      });
    } else if (flight.galaxy === 3) {
      populateRequiredChapterFlight(this.content, this.current, flight, () => {
        for (const id of this.current.known) {
          if (id !== "holodisk") {
            ensureDestination(this.content, id, flight);
          }
        }
        const pending = this.current.sounder?.phase;
        planRequiredWhirlpoolRoutes(this.content, this.current, flight, [
          ...(this.current.questComplete
            ? []
            : galaxyRoute(3).filter((id) => !this.current.known.includes(id))),
          ...(!this.current.holodisk && pending !== "away" && pending !== "resolved"
            ? ["holodisk"]
            : []),
        ]);
        this.prepareWhirlpoolDisk(flight);
      });
    } else if (flight.galaxy === 4 || flight.galaxy === 5 || flight.galaxy === 6) {
      populateRequiredChapterFlight(this.content, this.current, flight, () => {
        const context = { content: this.content, flight, progress: this.current };
        chapterRuntime(flight.galaxy)?.init?.(context);
        if (flight.galaxy === 4) {
          this.prepareNeedleBoss(context);
        } else if (flight.galaxy === 5) {
          this.prepareRedact(context);
        }
      });
    } else {
      populateFlight(this.content, this.current, flight);
    }
    beginArrivalGrace(this.content, flight);
    this.state.flight = flight;
    delete this.state.economy.cargo;
    this.state.mode = "space";
    this.state.dialogue = null;
    this.state.docked = null;
    rerollBoards(this.state.selectedGalaxy, this.state);
    for (const id of this.current.known) {
      if (flight.galaxy !== 3 || id !== "holodisk") {
        ensureDestination(this.content, id, this.state.flight);
      }
    }
    this.restoreCourierPosition(flight, true);
    this.prepareSunflowerBoss(flight);
    this.explore(this.state.flight);
    this.ensureWhaleDebris();
    this.beginConversations();
    const context = this.chapterContext();
    if (context) {
      chapterRuntime(context.flight.galaxy)?.init?.(context);
      clearNeedleEnemies(context.flight);
      ensureNeedleDebris(this.content, context.flight);
      syncFlightRegion(this.content, context.flight);
    }
    materializeGeneratedHostileStations(this.content, this.current, flight);
    this.reopenInteraction();
  }
  /** Records the chunk Ada is in to the galaxy's explored record, which the Map's fog reveals. */
  private explore(f: FlightState): void {
    recordExplored(this.content.tuning.chunkSize, this.current.explored, f.player);
  }
  /** Whether a cheat has anything left to grant (gameplay/cheats.md "Cheats"). */
  cheatAvailable(id: CheatId): boolean {
    if (id === "unlockAllGalaxies") {
      return GALAXY_NUMBERS.some((galaxy) => !this.state.unlocked.includes(galaxy));
    }
    this.pullLoadout();
    return economyCheatAvailable(id, this.state.economy);
  }
  /**
   * Applies a cheat to the current play, in flight or not; false when it has nothing left to
   * grant. It acts on the real save like normal play.
   */
  cheat(id: CheatId): boolean {
    const held = this.heldFlight;
    if (held) {
      // On Start, a flight held for Continue carries the loadout and ore the cheat changes.
      const { dialogue, docked, flight, mode, notice } = this.state;
      Object.assign(this.state, held);
      this.heldFlight = null;
      try {
        return this.cheat(id);
      } finally {
        const state = this.state;
        this.heldFlight = {
          dialogue: state.dialogue,
          docked: state.docked,
          flight: state.flight,
          mode: state.mode,
          notice: state.notice,
        };
        Object.assign(this.state, { dialogue, docked, flight, mode, notice });
      }
    }
    if (!this.cheatAvailable(id)) {
      return false;
    }
    if (id === "unlockAllGalaxies") {
      // The next boarding flies the route from the farthest galaxy so far to the farthest new one.
      const from = Math.max(...this.state.unlocked.map((galaxy) => ROUTE_POSITION[galaxy]));
      const fresh = GALAXY_NUMBERS.filter((galaxy) => !this.state.unlocked.includes(galaxy));
      this.state.unlocked.push(...fresh);
      const opened = fresh.map((galaxy) => ROUTE_POSITION[galaxy]);
      this.unlockFlight = {
        from: from as RoutePosition,
        opened,
        to: Math.max(...opened) as RoutePosition,
      };
      return true;
    }
    applyEconomyCheat(id, this.state);
    this.pushLoadout();
    return true;
  }
  /** Jumps to an unlocked galaxy's flight. */
  startGalaxy(id: GalaxyNumber): void {
    if (this.suspendedInteraction && this.suspendedInteraction.galaxy !== id) {
      return;
    }
    if (!this.state.unlocked.includes(id) || this.state.mode === "space") {
      return;
    }
    this.depletionContinuation = false;
    this.state.selectedGalaxy = id;
    this.state.started = true;
    this.startShown = false;
    this.story = null;
    this.closeSelection();
    this.launch();
  }
  private home(forced: boolean): void {
    if (!forced && this.inDanger) {
      this.refuse(this.label("travelUnavailable"));
      return;
    }
    this.endFlight(forced ? "lose" : "keep");
    this.beginVisit();
  }
  /**
   * Ends the flight for Earth, Jump or the shield-failure jump (rules.md "What each event
   * keeps"): the held job keeps its carried item and the story its item. Undeposited ore stays
   * aboard for the next flight after voluntary travel and is lost on shield failure. Pickups
   * go with the flight, a towed craft returns to where it was stranded, a guided calf and Pip
   * return to their starts with the activity still held, and a scene still due its line replays
   * at the hub next time. An in-flight notice ends with its flight.
   */
  private endFlight(cargo: "keep" | "lose" = "keep"): void {
    this.pickupFeedback = [];
    this.queuedNeedleTalk = false;
    this.closeGalaxyMapInFlight();
    const flight = this.state.flight;
    if (flight) {
      const boss = this.current.capitalBoss;
      if ((flight.galaxy === 1 || flight.galaxy === 4) && boss?.phase === "active") {
        const identity = flight.galaxy === 4 ? NEEDLE_CADENCE : SUNFLOWER_CAPITAL_BOSS;
        const actor = capitalBossActor(flight, identity.id);
        if (actor) {
          this.current.capitalBoss = { ...boss, actor, phase: "away" };
        }
      }
      if (flight.galaxy === 3 && this.current.sounder?.phase === "active") {
        const actors = stationPopulationObjects(flight).filter(
          (actor) => whirlpoolSounderActor(actor) && liveEnemy(actor),
        );
        this.current.sounder = actors.some(({ id }) => id === WHIRLPOOL_CAPITAL_BOSS.id)
          ? { actors, phase: "away" }
          : { phase: "revealed" };
      }
      const redact = this.current.redact;
      if (flight.galaxy === 5 && redact?.phase === "active") {
        const actor = capitalBossActor(flight, ANDROMEDA_REDACT.id);
        if (actor) {
          this.current.redact = { ...redact, actor, phase: "away" };
        }
      }
      const claim = this.current.claim;
      if (flight.galaxy === 2 && claim?.phase === "active") {
        const actor = capitalBossActor(flight, CARTWHEEL_CLAIM.id);
        if (actor) {
          this.current.claim = { ...claim, actor, phase: "away" };
        }
      }
      if (cargo === "keep" && flight.cargo > 0) {
        this.state.economy.cargo = flight.cargo;
      } else {
        delete this.state.economy.cargo;
      }
    }
    this.resetActivity(this.state.selectedGalaxy);
    // A story scene still due its line replays at the hub on the next flight.
    const scene = this.state.flight?.storyScene;
    if (scene?.lineDue) {
      this.current.replayScene = scene.id;
    }
    this.pullLoadout();
    if (this.state.flight) {
      this.previousSeed = flightEncounterSeed(this.state.flight);
      this.current.geography ??= {
        seed: this.state.flight.seed,
        sitePolicy: "legacy-fixed",
        version: 1,
      };
    }
    this.talk.endFlight();
    this.state.mode = "home";
    this.state.flight = null;
    this.state.dialogue = null;
    this.state.docked = null;
    this.state.notice = "";
  }
  returnHome(): void {
    if (this.state.dialogue) {
      return;
    }
    if (this.reopenInteraction()) {
      return;
    }
    this.home(false);
  }
  /**
   * Back to title: the start screen, where Continue resumes. From flight it first ends the flight
   * with its exact flight held, even in danger. Story pages retain their cursor and questions.
   */
  backToTitle(): void {
    if (this.screen === "start") {
      return;
    }
    const position = this.story ?? this.boardedFrom;
    if (position) {
      this.heldStory = { position, slept: this.slept };
    }
    if (this.state.mode === "space" && this.state.flight) {
      this.closeGalaxyMapInFlight();
      this.holdFlight();
    } else if (!position) {
      return;
    }
    this.story = null;
    this.choosingReplay = false;
    this.closeSelection();
    this.startShown = true;
  }
  private mapTravel(id: string) {
    const flight = this.state.flight;
    if (!flight || this.state.mode !== "space" || this.state.dialogue || this.state.docked) {
      return null;
    }
    const target = selectMapTravelTarget(
      {
        galaxy: flight.galaxy,
        hasStationSite: (id) => this.stationSite(flight, id) !== null,
        map: () => this.map,
        progress: this.current,
      },
      id,
    );
    if (!target) {
      return null;
    }
    const { reason } = travelState(this.inDanger, this.towing, this.carrying, { travel: true });
    return { flight, ...target, reason };
  }
  canTeleport(id: string): boolean {
    const travel = this.mapTravel(id);
    return (
      travel !== null && travel.reason === null && canAffordMapJump(this.state.economy.stardust)
    );
  }
  teleport(id: string): boolean {
    if (this.reopenInteraction()) {
      return false;
    }
    const travel = this.mapTravel(id);
    if (!travel) {
      return false;
    }
    const { flight, place, reason, station } = travel;
    if (reason !== null) {
      this.refuse(
        this.label(
          { carrying: "carryTravel", danger: "travelUnavailable", towing: "towTravel" }[reason],
        ),
      );
      return false;
    }
    const economy = this.state.economy;
    if (!canAffordMapJump(economy.stardust)) {
      return false;
    }
    if (station) {
      ensureStation(this.content, id, flight);
    } else if (!place) {
      ensureDestination(this.content, id, flight);
    }
    if (!teleportFlight(this.content, place ?? id, flight)) {
      return false;
    }
    economy.stardust -= MAP_JUMP_COST;
    // Travel ends a guide's follow: the calf waits where it is.
    if (flight.calf) {
      flight.calf.following = false;
    }
    this.explore(flight);
    return true;
  }
  /**
   * Shield depletion quantum jumps Ada home and ends the flight. Its open-space enemies,
   * pickups and all undeposited ore are lost.
   * Weapons, levels, Stardust, purchases, accepted quests and story progress stay. She lands at
   * night and sleeps while Astra recharges overnight. The jump-home line shows on its page only,
   * never as a notice carried into the next flight.
   */
  private jumpHome(): void {
    if (!this.state.flight) {
      return;
    }
    const oreLost = this.state.flight.cargo > 0;
    this.home(true);
    const line = this.label("jumpHome");
    const page = oreLost ? `${line}\n${this.label("jumpHomeOreLost")}` : line;
    this.depletionContinuation = true;
    const scene = jumpHomeScene(page, this.label("morningRecharge"));
    this.emergencyReferences.set(scene, {
      id: scene.id,
      ...(oreLost ? { variant: "oreLost" as const } : {}),
    });
    this.showScene(scene);
  }
  private complete(): void {
    this.current.questComplete = true;
    if (this.current.holodisk) {
      this.notify(this.label("chapterComplete"), "reading");
    }
  }
  /**
   * Once a galaxy's holodisk, space quest and home resolution are done, unlocks the next position
   * on the route, every placeholder after it and the next built galaxy (unlockedBy).
   */
  private unlockNext(galaxy: GalaxyNumber = this.state.selectedGalaxy): void {
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
    this.state.announceGalaxy = fresh.some(
      (id) => BUILT.has(id) && Object.hasOwn(this.content.chapters, id),
    );
  }
  private takeHolodisk(): boolean {
    const p = this.current;
    if (p.holodisk) {
      return false;
    }
    p.holodisk = true;
    const f = this.state.flight;
    if (f?.galaxy === 4) {
      p.needleMemoryRead = false;
    }
    if (f) {
      this.markerRegistry.forget({ store: this.markerStore(f) }, "holodisk");
      f.objects = f.objects.filter(
        (object) => !(object.kind === "destination" && object.id === "holodisk"),
      );
    }
    this.unlockNext();
    if (p.questComplete) {
      this.notify(this.label("chapterComplete"), "reading");
    }
    return true;
  }
  private recoverHolodisk(giver?: string): void {
    if (!this.takeHolodisk()) {
      return;
    }
    if (giver) {
      this.panel("holodiskHandover", this.content.premise.holodisk.handover, giver);
    } else {
      this.holodiskMoment();
    }
  }
  private resolvePhantomSurrender(context: ChapterContext): void {
    if (!settlePhantomSurrender(context)) {
      return;
    }
    if (this.takeHolodisk()) {
      this.state.economy.stardust += PHANTOM_TUNING.salvageStardust;
    }
    this.complete();
  }

  private showPhantomAftermath(): void {
    const copy = INTERACTION_COPY["6.phantom.aftermath"];
    if (copy) {
      this.panel("phantom.aftermath", copy.lines[0]!.text, copy.party);
    }
  }

  private whirlpoolDiskPickupId(flight: FlightState): string {
    return `chapter:3:holodisk:pickup:${flightEncounterSeed(flight)}`;
  }
  private pickUpWhirlpoolDisk(flight: FlightState): void {
    if (!this.takeHolodisk()) {
      return;
    }
    const pickup = this.whirlpoolDiskPickupId(flight);
    // Resume unheard lines on Continue in the pickup flight. Older saves already have a story.
    this.state.seenConversations.push(pickup);
    this.queueWhirlpoolDiskLines(pickup);
  }
  private queueWhirlpoolDiskLines(pickup: string): void {
    const { inserted, memories } = this.content.premise.holodisk;
    const held = holodisksHeld(this.state.progress);
    const restored = holodiskInsertion(held, inserted).at(-1);
    if (restored?.speaker === "Astra") {
      this.talk.authoredCue(`${pickup}:restored`, { speaker: "astra", text: restored.text });
    }
    const memory = memories[held - 1];
    if (memory) {
      this.talk.authoredCue(`${pickup}:memory`, { speaker: "astra", text: memory });
    }
  }
  /**
   * The holodisk moment's story pages over the paused flight. Its dialogue marker holds the
   * flight and keeps the moment in the save, so a reload shows it again from its first page.
   */
  private holodiskMoment(): void {
    const { inserted, memories } = this.content.premise.holodisk;
    this.state.dialogue = { choices: [], context: HOLODISK_MOMENT, text: "", title: "" };
    const held = holodisksHeld(this.state.progress);
    this.showScene(holodiskScene(holodiskInsertion(held, inserted), memories[held - 1] ?? ""));
  }
  /**
   * The authored route's placed legs from flight entry, projected in the ship's chart.
   */
  private explorationRoute(flight: FlightState): (point: Vec) => boolean {
    const world = flightWorldContext(flight);
    const progress = this.current;
    const legs: { from: Vec; delta: Vec; squared: number }[] = [];
    let from = { x: 0, y: 0 };
    for (const id of galaxyRoute(flight.galaxy)) {
      const to =
        flight.objects.find((object) => object.kind === "destination" && object.id === id) ??
        flight.world.notables[id] ??
        progress.requiredSites?.[id];
      if (!to) {
        continue;
      }
      const delta = worldDelta(world, from, to);
      legs.push({ delta, from, squared: delta.x ** 2 + delta.y ** 2 });
      from = to;
    }
    return (point) =>
      legs.some(({ delta, from, squared }) => {
        const offset = worldDelta(world, from, point);
        const projection =
          squared === 0
            ? 0
            : Math.max(0, Math.min(1, (offset.x * delta.x + offset.y * delta.y) / squared));
        return (
          (offset.x - delta.x * projection) ** 2 + (offset.y - delta.y * projection) ** 2 <=
          TARGET_MARKER_RANGE ** 2
        );
      });
  }

  step(
    dt: number,
    input: FlightInput,
    openQuestDetails?: (details: ContextQuestDetails) => void,
  ): void {
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
    if (input.use && this.suspendedInteraction) {
      this.reopenInteraction();
      return;
    }
    const noticeAtStart = this.noticeClock;
    const runtime = chapterRuntime(f.galaxy);
    const context = runtime && this.chapterContext();
    if (context) {
      setNeedleActivity(f, heldActivity(f.galaxy, this.state)?.id === "threadNeedle");
      runtime?.beforeStep?.(context, dt);
    }
    const previousChapterPosition = runtime?.afterStep ? { ...f.player } : undefined;
    this.ensureRequiredApproaches();
    this.prepareSunflowerBoss(f);
    this.prepareCartwheelClaim(f);
    this.prepareWhirlpoolDisk(f);
    const sounderFighting =
      f.galaxy === 3 &&
      this.current.sounder?.phase === "active" &&
      capitalBossActor(f, WHIRLPOOL_CAPITAL_BOSS.id)?.enemy?.archetype === "capital";

    // Before the step, so a sensed cache collected this step still counts as reached.
    reachSensed(PENNY_FIND_RANGE, f.galaxy, f.objects, f.player, this.state.achievements);
    const previousFreshDistance = f.freshDistance;
    const travel: {
      nearRoute?: (point: Vec) => boolean;
      attempt?: { cell: string; region: ExplorationSiteRegion; ordinal: number };
    } = {};
    const world = flightWorldContext(f);
    const grid = periodicWorldGrid(world, this.content.tuning.chunkSize);
    const cellOf = (point: Vec) => worldCellKey(grid, worldCellAt(grid, point));
    const pacingActive = f.topology && this.current.geography?.seed === f.seed;
    const flightTimeBeforeStep = f.time;
    const admitEnemy: FlightInput["admitEnemy"] =
      f.phantom?.blockadePhases || f.galaxy === 5
        ? (flight, enemy) => {
            if (flight.phantom?.blockadePhases && !phantomBlockadeAdmits(flight, enemy)) {
              return false;
            }
            const courier =
              flight.galaxy === 5 ? andromedaCourierActor(flight, enemy.id) : undefined;
            return (
              courier !== "held" &&
              courier !== "ended" &&
              input.admitEnemy?.(flight, enemy) !== false
            );
          }
        : undefined;
    const combatInput =
      f.galaxy === 2 && this.current.known.includes(HUB_STATION)
        ? { ...input, cartwheelHubKnown: true }
        : input;
    const events = stepFlight(
      this.content,
      dt,
      admitEnemy ? { ...combatInput, admitEnemy } : combatInput,
      f,
      pacingActive
        ? (distance, seconds, point) => {
            const nearRoute = (travel.nearRoute ??= this.explorationRoute(f));
            const region = nearRoute(point) ? "near" : "far";
            const next = advanceExplorationPacing(
              f.exploration?.pacing ?? EMPTY_EXPLORATION_PACING,
              {
                freshDistance: distance,
                piloting: true,
                region:
                  region === "near"
                    ? { kind: "nearRoute" }
                    : { kind: "outer", targetSeconds: OUTER_OPPORTUNITY_SECONDS },
                seconds,
              },
            );
            const exploration = (f.exploration ??= { renewals: {}, version: 1 });
            exploration.pacing = next.state;
            if (next.opportunity === undefined) {
              return;
            }
            const cell = cellOf(point);
            const pending = next.state.pending;
            if (!pending) {
              exploration.pacing = { ...next.state, pending: { cell, region } };
            } else if (
              pending.cell !== cell &&
              pending.region === region &&
              (f.freshChunk === cell || !visitedChunk(f.visited, cell))
            ) {
              travel.attempt = { cell, ordinal: next.opportunity, region };
            }
          }
        : undefined,
    );
    if (this.state.stationRestock) {
      advanceStationRestock(this.state.stationRestock, f.time - flightTimeBeforeStep);
    }
    const { attempt, nearRoute } = travel;
    if (nearRoute && attempt && cellOf(f.player) === attempt.cell) {
      const inRegion = (point: Vec) => nearRoute(point) === (attempt.region === "near");
      if (inRegion(f.player)) {
        this.admitExplorationSite(f, inRegion, attempt);
      }
    }
    this.carryStoryPickups(dt, f);
    this.explore(f);
    this.flightEvents = events;
    this.pullLoadout();
    const mapped: string[] = this.scannedLandmarks.splice(0);
    const stationsDiscovered: string[] = [];
    const poiConfirmations: PoiConfirmation[] = mapped.map((id) => ({
      cue: { id, kind: "storyPlace" },
    }));
    // Apply durable outcomes from the entire physics step before a depletion can end the flight.
    if (
      context &&
      events.some((event) => event.type === "enemySurrendered" && event.id === PHANTOM_FLAGSHIP)
    ) {
      this.resolvePhantomSurrender(context);
    }
    if (sounderFighting) {
      if (
        events.some(
          (event) => event.type === "enemyDestroyed" && event.id === WHIRLPOOL_CAPITAL_BOSS.id,
        )
      ) {
        this.resolveSounder(f, "defeated");
      } else if (capitalBossActor(f, WHIRLPOOL_CAPITAL_BOSS.id)?.enemy?.disabled) {
        this.resolveSounder(f, "disabled");
      }
    }
    if (f.galaxy === 1 && this.current.capitalBoss) {
      if (
        events.some(
          (event) => event.type === "enemyDestroyed" && event.id === SUNFLOWER_CAPITAL_BOSS.id,
        )
      ) {
        this.resolveSunflowerBoss(f, "defeated");
      }
      const boss = this.current.capitalBoss;
      if (
        boss.phase === "resolved" &&
        events.some(
          (event) => event.type === "collected" && event.id === SUNFLOWER_CAPITAL_BOSS.cacheId,
        )
      ) {
        boss.cacheClaimed = true;
      }
    }
    if (f.galaxy === 4 && this.current.capitalBoss?.phase === "active") {
      if (
        events.some((event) => event.type === "enemyDestroyed" && event.id === NEEDLE_CADENCE.id)
      ) {
        this.resolveNeedleBoss("defeated");
      }
    }
    if (f.galaxy === 5 && this.current.redact?.phase === "active") {
      if (
        events.some((event) => event.type === "enemyDestroyed" && event.id === ANDROMEDA_REDACT.id)
      ) {
        this.resolveRedact(f, "defeated");
      }
    }
    if (f.galaxy === 2 && this.current.claim?.phase === "active") {
      if (
        events.some((event) => event.type === "enemyDestroyed" && event.id === CARTWHEEL_CLAIM.id)
      ) {
        this.resolveCartwheelClaim(f, "defeated");
      }
    }
    for (const event of events) {
      if (event.type === "earlyEncounterCue") {
        this.talk.encounterCue(
          `chapter:encounter:${event.encounter}`,
          EARLY_ENCOUNTER_CUES[event.encounter],
          () => {
            const boss = capitalBossActor(f, event.id);
            return this.state.flight === f && (boss?.hp ?? 0) > 0 && !boss?.enemy?.disabled;
          },
        );
      }
      if (event.type === "cartwheelPatrolWarning") {
        this.talk.chapterCue({
          speaker: "astra",
          text: "Patrol ahead. Use the rocks for cover or take the marked route around.",
        });
      }
      if (event.type === "guardCue") {
        const store = this.markerStore(f);
        for (const guard of f.objects) {
          if (
            guard.routeId === event.id &&
            liveEnemy(guard) &&
            !guard.enemy?.disabled &&
            guard.enemy?.escortOf == null &&
            store.get(guard.id) !== "identified"
          ) {
            store.set(guard.id, "sensed");
          }
        }
      }
      if (
        event.type === "enemyDestroyed" ||
        event.type === "collected" ||
        event.type === "debrisCleared" ||
        event.type === "asteroidDestroyed"
      ) {
        this.markerRegistry.forget({ store: this.markerStore(f) }, event.id);
      }
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
        stationsDiscovered.push(event.id);
        const station = worldStationById(flightStationContext(f), ECONOMY, f.galaxy, event.id);
        if (station) {
          poiConfirmations.push({
            cue: { id: event.id, kind: "station" },
            relevant: this.poiNearby(f, station),
          });
        }
      }
      if (event.type === "enemyDestroyed") {
        this.current.destroyedEnemies++;
      }
      if (event.type === "upgradeCollected") {
        this.collectUpgrade(event.id, f);
      }
      if (event.type === "ammoCollected") {
        this.collectAmmoPack(event.id, f);
      }
      // Touching the guarded holodisk recovers it, like a pickup; it never becomes a travel
      // destination.
      if (event.type === "discovered" && event.id === "holodisk" && f.galaxy === 3) {
        if (this.holodiskWaypoint && this.holodiskTouched(f)) {
          this.pickUpWhirlpoolDisk(f);
        }
        continue;
      }
      if (event.type === "discovered" && !this.current.known.includes(event.id)) {
        this.current.known.push(event.id);
        this.current.discoveries++;
        if (
          (event.id !== "holodisk" || f.galaxy !== 4) &&
          (f.galaxy !== 1 || event.id !== "growers" || this.current.introduced)
        ) {
          const place = f.objects.find(({ id }) => id === event.id);
          const role =
            f.galaxy === 5 && place?.role === ANDROMEDA_PLACES.settlement ? place.role : undefined;
          mapped.push(event.id);
          poiConfirmations.push({
            cue: { id: event.id, kind: "storyPlace", ...(role ? { role } : {}) },
            ...(place ? { relevant: this.poiNearby(f, place) } : {}),
          });
        }
      }
      if (
        event.type === "debrisCleared" &&
        f.galaxy === 3 &&
        this.current.stage <= 1 &&
        !f.objects.some((o) => o.id.startsWith("whale-debris:") && o.hp > 0)
      ) {
        this.current.stage = 2;
      }
    }
    // However the hub became known, it is one of Cartwheel's discovered stations.
    if (
      f.galaxy === 2 &&
      this.current.known.includes(HUB_STATION) &&
      !this.current.stations.includes(HUB_STATION)
    ) {
      this.current.stations.push(HUB_STATION);
      stationsDiscovered.push(HUB_STATION);
    }
    this.stepJob(f);
    this.stepCalf(dt, f);
    this.advanceCourier(f, f.time - flightTimeBeforeStep);
    if (context && previousChapterPosition) {
      const arrival = runtime?.afterStep?.(context, dt, previousChapterPosition, events);
      if (arrival) {
        this.talk.poiArrival(arrival.place, arrival.line, {
          chapterArrival: true,
          onFirstShowing: () => this.coverPoiArrival(f, arrival.place),
          onceId: arrival.id,
          relevant: () =>
            this.state.flight === f &&
            this.screen === "space" &&
            !this.state.dialogue &&
            !this.state.docked &&
            !this.suspendedInteraction &&
            arrival.relevant(),
        });
      }
      if (f.galaxy === 5) {
        const warning = takeAndromedaCourierWarning(f);
        if (warning) {
          this.talk.encounterCue(
            "chapter:encounter:andromedaCourier",
            warning,
            () => this.state.flight === f && this.current.stage === 4,
          );
        }
      }
      if (f.galaxy === 4) {
        this.prepareNeedleBoss(context);
        this.needleBossCues();
      } else if (f.galaxy === 5) {
        this.prepareRedact(context);
        this.redactCues();
      }
      const thread = heldActivity(f.galaxy, this.state);
      const layout = needleCourses(f);
      if (thread?.id === "threadNeedle" && layout) {
        const from = worldPoint(world, layout.activity.path[0]!, previousChapterPosition);
        const attempt = stepNeedleCourse(
          {
            checkOrder: thread.cleanRun === true,
            from,
            to: worldPoint(world, from, f.player),
            topSpeed: shipTuning(ECONOMY, this.content, f.levels).physics.maxSpeed,
            velocity: f.velocity,
          },
          layout.activity,
          thread.lit!,
        );
        thread.lit = attempt.lit;
        if (attempt.missed) {
          this.talk.chapterCue({ speaker: "elderLoom", text: NEEDLE_LEARNING.tooFast });
        }
        if (thread.cleanRun && (attempt.missed || attempt.outOfOrder)) {
          thread.cleanRun = false;
        }
        if (thread.lit === layout.activity.gates.length) {
          this.finishActivity(
            f.galaxy,
            thread.cleanRun ? NEEDLE_COURSE_COPY.cleanRunFinish : undefined,
          );
          setNeedleActivity(f, false);
          retireNeedleActivityPatrols(this.content, f);
        } else {
          ensureNeedleActivityPatrols(this.content, f);
        }
      }
      for (const cue of f.needle?.chatter.splice(0) ?? []) {
        this.talk.chapterCue({
          speaker: cue.speaker === "loom" ? "elderLoom" : cue.speaker,
          text: cue.text,
        });
      }
      if (f.phantom) {
        if (this.current.phantom?.surrenderAftermathDue) {
          for (const key of PHANTOM_FINALE_CHATTER) {
            if (
              !f.phantom.chatter.includes(key) &&
              !this.state.seenConversations.includes(`chapter:phantom:${key}`)
            ) {
              f.phantom.chatter.push(key);
            }
          }
        }
        this.talk.queuePhantomChatter(f.phantom.chatter);
      }
    }
    materializeGeneratedHostileStations(this.content, this.current, f);
    const jobMoments = this.jobMoments;
    this.jobMoments = [];
    const near = (range: number) => (object: { x: number; y: number }) =>
      Math.hypot(object.x - f.player.x, object.y - f.player.y) <= range;
    const held = this.noticeShowing ? this.noticeRank : null;
    // Count the step only for a notice that was already present and is still uncovered.
    const clock = this.noticeClock;
    if (
      held &&
      clock === noticeAtStart &&
      !this.state.dialogue &&
      !this.state.docked &&
      this.screen === "space" &&
      !this.talk.showsOver(held)
    ) {
      clock.elapsedMs += dt * 1000;
      if (clock.elapsedMs >= clock.holdMs + clock.fadeMs - 1e-6) {
        this.dismissNotice();
      }
    }
    const landmarks = flightLandmarkSites(f);
    const unknownPoi = pennyPoints(
      this.current,
      this.holodiskWaypoint,
      [...landmarks, ...this.explorationSites(f)].filter(({ id }) => !this.scannedSite(id)),
      f,
      flightWorldContext(f).worldSide,
    );
    const approach = this.poiApproach(f, unknownPoi, landmarks);
    this.cueGrowersApproach(f);
    this.cueMarkedPoiArrivals(f);
    this.sunflowerBossCues(f);
    this.sounderCues(f);
    if (f.galaxy === 2) {
      this.cartwheelClaimCues();
      const scene = f.storyScene;
      const blocked = CARTWHEEL_STORY_SHIPS.scenes.blocked;
      if (
        scene?.id === "blocked" &&
        scene.lineDue &&
        !this.suspendedInteraction &&
        f.time >= scene.at + blocked.duration
      ) {
        const reaction = this.chapter.dialogue[blocked.line];
        if (reaction) {
          this.talk.authoredCue(
            "chapter:cartwheel:firstDeposit",
            { speaker: "ada", text: reaction.text },
            {
              onFirstShowing: () => {
                scene.lineDue = false;
              },
              relevant: () =>
                this.state.flight === f && f.storyScene === scene && !this.state.docked,
            },
          );
        }
      }
    }
    this.talk.step(dt, held, {
      aimed: Math.hypot(input.aim.x, input.aim.y) > 0,
      capitalInSight: heavyInSight("capital", SCREEN, f, NAMED_CAPITAL_IDS[f.galaxy]),
      collectedStardust: events.some((event) => event.type === "stardust"),
      docked: this.dockedThisFlight,
      dronesNear: dronesNear(f),
      encounters: encounterCues(f),
      frigateInSight: heavyInSight("frigate", SCREEN, f),
      guardCues: events.flatMap((event) =>
        event.type === "guardCue"
          ? [{ destination: event.id, pick: dropRandom(f.seed, `guard-line:${event.id}`)() }]
          : [],
      ),
      heavyDisabled: events.some(
        (event) =>
          event.type === "enemyDisabled" &&
          event.id !== SUNFLOWER_CAPITAL_BOSS.id &&
          event.id !== WHIRLPOOL_CAPITAL_BOSS.id &&
          event.id !== PHANTOM_FLAGSHIP &&
          event.id !== NEEDLE_CADENCE.id &&
          event.id !== ANDROMEDA_REDACT.id &&
          event.id !== CARTWHEEL_CLAIM.id,
      ),
      holodisks: holodisksHeld(this.state.progress),
      inCurrent: inCurrent(f.galaxy, 0, f.player),
      inDanger: this.inDanger,
      jobMoments,
      lostItemNear: this.lostItemNear(f),
      moved: Math.hypot(input.move.x, input.move.y) > 0,
      // The hub counts as a station for returns, but its mapping is a new place's.
      newStation: stationsDiscovered.some((id) => id !== HUB_STATION),
      newlyMapped: mapped,
      pennyPoints: unknownPoi,
      ...(approach ? { poiApproach: approach } : {}),
      poiAmbient: () => {
        if (
          this.state.flight !== f ||
          this.screen !== "space" ||
          this.state.dialogue ||
          this.state.docked ||
          this.hubSceneCoversFlightDialogue
        ) {
          return undefined;
        }
        const second = ambientSecondThread(f.galaxy, this.state.progress[f.galaxy]);
        return second === undefined ? undefined : poiAmbientLine(f.galaxy, second);
      },
      poiConfirmations: poiConfirmations.flatMap((confirmation) => {
        const covered = this.poiVisitConfirmation(f, confirmation);
        return covered ? [covered] : [];
      }),
      poiVisit: (id) => this.poiVisitPresentation(f, id),
      shieldFraction: this.shieldMax > 0 ? f.shield / this.shieldMax : 1,
      stardustInSight: f.objects.some(
        (object) => carriesStardust(object) && near(CONVERSATION_TUNING.stardustSightRange)(object),
      ),
      stationsDiscovered,
      stationsNear: stationsInRange(f)
        .filter(({ id }) => this.current.stations.includes(id))
        .map(({ id }) => id),
    });
    this.flushNeedleTalk();
    if (
      f.galaxy === 6 &&
      this.current.phantom?.surrenderAftermathDue &&
      this.current.holodisk &&
      this.current.questComplete &&
      this.screen === "space" &&
      !this.state.dialogue &&
      !this.state.docked &&
      !this.suspendedInteraction &&
      PHANTOM_FINALE_CHATTER.every((key) => {
        const id = `chapter:phantom:${key}`;
        return this.state.seenConversations.includes(id) && !this.talk.pending(id);
      })
    ) {
      this.showPhantomAftermath();
    }
    const sensed = this.talk.takeSensed();
    recordSensed(this.state.achievements, sensed);
    const prefix = `penny:${f.galaxy}:`;
    for (const instance of sensed) {
      if (instance.startsWith(prefix)) {
        const id = instance.slice(prefix.length);
        if (this.markerPoint(f, id) && this.markerStore(f).get(id) !== "identified") {
          this.markerStore(f).set(id, "sensed");
        }
      }
    }
    this.syncAchievements();
    // One achievement notice at a time, each once the notice slot is free.
    const unlocked = this.state.notice ? undefined : this.achievementNotices.shift();
    if (unlocked !== undefined) {
      this.notify(fill(this.label("achievement"), { name: unlocked }));
    }
    if (this.suspendedInteraction) {
      return;
    }
    if (runtime) {
      if (input.use && !this.state.dialogue) {
        this.interact(openQuestDetails);
      }
      return;
    }
    const opener = first(f.galaxy);
    if (
      opener !== undefined &&
      !this.current.introduced &&
      f.freshDistance >= this.content.tuning.introFreshDistance
    ) {
      if (
        (f.galaxy !== 3 || activateRequiredWhirlpoolRoute(this.content, this.current, f, opener)) &&
        activateRequiredCartwheelRoute(this.content, this.current, f, opener)
      ) {
        ensureDestination(this.content, opener, f);
      }
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
      const id = earlyRequiredDestination(f.galaxy, this.current.stage);
      if (
        id &&
        (f.galaxy !== 3 || activateRequiredWhirlpoolRoute(this.content, this.current, f, id))
      ) {
        ensureDestination(this.content, id, f);
        if (f.freshDistance > previousFreshDistance && !this.current.known.includes(id)) {
          this.placePending(id);
        }
      }
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
      Math.hypot(hub.x - f.player.x, hub.y - f.player.y) <= this.content.tuning.approachRadius
    ) {
      f.storyScene = { at: f.time, id: replay, lineDue: true };
      delete this.current.replayScene;
    }
    if (input.use) {
      this.interact(openQuestDetails);
    }
  }
  /** The places the direction indicators mark (indicators.ts). */
  get indicatorTargets(): IndicatorTarget[] {
    const f = this.state.flight;
    if (!f || this.state.mode !== "space") {
      return [];
    }
    return this.flightIndicators(f, this.jobIndicator(f), this.needleMarkerObjective(f));
  }
  private needleMarkerObjective(f: FlightState): NeedleTrackedObjective | null {
    if (
      f.galaxy !== 4 ||
      heldActivity(f.galaxy, this.state)?.id === "threadNeedle" ||
      (f.trackedQuestId !== undefined && this.canTrackQuest(f.trackedQuestId))
    ) {
      return null;
    }
    return needleTrackedObjective({ content: this.content, flight: f, progress: this.current });
  }
  private flightIndicators(
    f: FlightState,
    job: IndicatorTarget | null,
    needle: NeedleTrackedObjective | null,
  ): IndicatorTarget[] {
    const p = this.current;
    const chapter = chapterRuntime(f.galaxy);
    const storyObjective = this.objectiveId(f.galaxy);
    const objective =
      f.galaxy === 4 && storyObjective && isNeedleCourseStart(storyObjective)
        ? null
        : storyObjective;
    const point =
      chapter && objective
        ? (f.objects.find((object) => object.id === objective) ?? f.world.notables[objective])
        : null;
    const context = chapter && this.chapterContext();
    const waypoint = context && f.galaxy === 6 ? phantomWaypoint(context) : null;
    const marked = indicatorTargets(INDICATOR_SOURCES, {
      flight: f,
      galaxy: f.galaxy,
      holodiskWaypoint: this.holodiskWaypoint,
      job,
      objective,
      ...(needle
        ? {
            objectivePoint: {
              id: needle.id,
              ...worldPoint(flightWorldContext(f), f.player, needle.point),
            },
          }
        : point
          ? { objectivePoint: { id: point.id, x: point.x, y: point.y } }
          : {}),
      progress: p,
      questItem: questItemDestination(p),
    });
    const whirlpoolDisk = this.whirlpoolDiskWaypoint(f);
    if (whirlpoolDisk && !marked.some((target) => target.id === "holodisk")) {
      marked.unshift({ ...whirlpoolDisk, id: "holodisk", kind: "holodisk" });
    }
    if (waypoint && !p.holodisk) {
      const existing = marked.findIndex((target) => target.id === PHANTOM_FLAGSHIP);
      if (existing !== -1) {
        marked.splice(existing, 1);
      }
      marked.unshift({ ...waypoint, id: PHANTOM_FLAGSHIP, kind: "holodisk" });
    }
    return marked;
  }
  /**
   * The pause menu's Map of the current galaxy (map.ts), or null outside a flight: with its
   * charted landmarks (landmarks.ts) and the held job's target.
   */
  get map(): LocalMap | null {
    const f = this.state.flight;
    if (!f || this.state.mode !== "space") {
      return null;
    }
    const landmarks = landmarkSites(f.galaxy);
    const labels = new Map(this.destinations().map(({ id, label }) => [id, label]));
    const objective = this.objectiveId(f.galaxy);
    const context = this.chapterContext();
    const waypoint = context && f.galaxy === 6 ? phantomWaypoint(context) : null;
    const boss = f.galaxy === 1 ? this.current.capitalBoss : undefined;
    const sunflowerWaypoint =
      boss?.phase === "resolved"
        ? {
            ...boss.site,
            id: SUNFLOWER_CAPITAL_BOSS.routeId,
            label: boss.cacheClaimed
              ? SUNFLOWER_CAPITAL_BOSS.chartLabel.route
              : SUNFLOWER_CAPITAL_BOSS.chartLabel.cache,
            objective: false,
            symbol: "destination" as const,
          }
        : boss?.phase === "active"
          ? {
              ...(capitalBossActor(f, SUNFLOWER_CAPITAL_BOSS.id)?.enemy?.home ?? boss.site),
              id: SUNFLOWER_CAPITAL_BOSS.id,
              label: SUNFLOWER_CAPITAL_BOSS.ship,
              objective: false,
              optionalEncounter: true as const,
              symbol: "destination" as const,
            }
          : undefined;
    const needle = f.galaxy === 4 ? this.current.capitalBoss : undefined;
    const redact = f.galaxy === 5 ? this.current.redact : undefined;
    const otherWaypoint =
      redact?.phase === "active"
        ? {
            ...redact.site,
            id: ANDROMEDA_REDACT.id,
            label: ANDROMEDA_REDACT.ship,
            objective: false,
            optionalEncounter: true as const,
            symbol: "destination" as const,
          }
        : needle?.phase === "active"
          ? {
              ...needle.site,
              id: NEEDLE_CADENCE.id,
              label: NEEDLE_CADENCE.ship,
              objective: false,
              optionalEncounter: true as const,
              symbol: "destination" as const,
            }
          : sunflowerWaypoint;
    const claim = f.galaxy === 2 ? this.current.claim : undefined;
    const optionalBossWaypoint =
      claim?.phase === "active" || claim?.phase === "resolved"
        ? {
            ...(claim.phase === "active" ? claim.site : claim.fieldSite),
            id: claim.phase === "active" ? CARTWHEEL_CLAIM.id : claim.fieldId,
            label: claim.phase === "active" ? CARTWHEEL_CLAIM.ship : CARTWHEEL_CLAIM.fieldLabel,
            objective: false,
            ...(claim.phase === "active" ? { optionalEncounter: true as const } : {}),
            symbol: "destination" as const,
          }
        : otherWaypoint;
    const map = localMap({
      ...flightStationContext(f),
      ...(waypoint
        ? {
            chapterWaypoint: {
              ...waypoint,
              id: PHANTOM_FLAGSHIP,
              label: this.label(PHANTOM_FLAGSHIP),
              objective: !this.current.questComplete,
            },
          }
        : optionalBossWaypoint
          ? { chapterWaypoint: optionalBossWaypoint }
          : {}),
      catalog: ECONOMY,
      chartedPois: this.explorationSites(f)
        .filter(({ id }) => this.scannedSite(id))
        .map((site) => ({ ...site, label: this.label(site.name) })),
      chunkSize: this.content.tuning.chunkSize,
      destinations: galaxyRoute(f.galaxy),
      explored: this.current.explored,
      flight: f,
      holodisk: this.whirlpoolDiskWaypoint(f),
      job: this.jobMapTarget(f),
      knownHostileStationPlaces: hostileStationMapPlaces(f, this.current),
      label: (id, kind) => {
        if (kind === "holodisk") {
          return this.label("mapHolodiskWaypoint");
        }
        if (kind === "station" && id === objective) {
          return this.keeperStationName(f.galaxy, id);
        }
        return labels.get(id) ?? id;
      },
      landmarks: {
        charted: landmarks
          .filter(({ id }) => this.current.charted.includes(id))
          .map((site) => ({
            id: site.id,
            kind: site.kind,
            label: landmarkLabel((key) => this.label(key), site),
            x: site.x,
            y: site.y,
          })),
        surveyTotal: landmarks.filter(withinChartingRadius).length,
        total: landmarks.length,
      },
      objective,
      progress: this.current,
      quests: {
        ...questDetails(
          {
            galaxy: f.galaxy,
            jobText: (job) => this.jobText(job),
            label: (key) => this.label(key),
            miningMilestones: this.content.tuning.miningMilestones,
            placeLabel: (id) => this.placeLabel(id),
          },
          {
            flight: f,
            progress: this.current,
            ...(this.state.tasks[f.galaxy] ? { task: this.state.tasks[f.galaxy]! } : {}),
          },
        ),
        job: this.jobObjective,
        story: this.objective,
        storyComplete: this.current.resolved,
      },
    });
    const tasks = this.markerTaskContext(
      f,
      [
        ...this.current.known,
        ...this.current.stations,
        ...this.current.charted,
        ...map.places.filter(({ kind }) => kind === "holodisk").map(({ id }) => id),
      ],
      map.quests.flatMap((line) =>
        line.kind === "job" || line.kind === "story" ? [{ galaxy: f.galaxy, line }] : [],
      ),
    );
    const boards = this.state.jobs.boards[f.galaxy];
    const held = heldJob(f.galaxy, this.state)?.id;
    const task = this.state.tasks[f.galaxy];
    return {
      ...map,
      places: map.places.map((place) => {
        const pendingJobLead =
          place.kind === "station" &&
          boards?.[place.id]?.some((offer) => isPostedLead(offer) && offer.id !== held);
        const links = tasks.links(place.id);
        const questLinks = links.flatMap(({ line }) => {
          const id =
            line.kind === "story"
              ? storyQuestId(f.galaxy, this.current.stage)
              : task && taskQuestId(f.galaxy, task);
          return id ? [{ id, label: line.text }] : [];
        });
        const category = tasks.category(
          place.id,
          links,
          place.objective || place.kind === "holodisk",
          place.job,
        );
        return {
          ...place,
          ...(pendingJobLead
            ? { label: this.keeperStationName(f.galaxy, place.id), pendingJobLead: true as const }
            : {}),
          ...(questLinks.length ? { questLinks } : {}),
          taskCategory: pendingJobLead && category === "generic" ? "job" : category,
        };
      }),
    };
  }
  /** The current objective's destination in a galaxy, if it has one (indicators.ts). */
  private objectiveId(galaxy: GalaxyNumber): string | null {
    const context = this.chapterContext();
    if (context && context.flight.galaxy === galaxy) {
      const runtime = chapterRuntime(galaxy);
      if (runtime?.objective) {
        return runtime.objective(context);
      }
    }
    const p = this.current;
    return objectiveDestination(galaxy, p, p.deposited >= this.content.tuning.miningMilestones[1]);
  }
  private get holodiskWaypoint(): boolean {
    return holodiskWaypoint(this.state);
  }

  private whirlpoolDiskWaypoint(flight: FlightState): Vec | null {
    return whirlpoolDiskWaypoint(this.state, flight);
  }

  private floatingHolodisk(f: FlightState): SpaceObject | undefined {
    return floatingHolodisk(this.state, f);
  }

  private holodiskTouched(f: NonNullable<GameState["flight"]>): boolean {
    return holodiskTouched(this.state, this.content, f);
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
    if (!f || chapterRuntime(f.galaxy) || (this.current.questComplete && !this.holodiskWaypoint)) {
      return;
    }
    for (const object of [...f.objects]) {
      if (
        object.kind === "destination" &&
        !(f.galaxy === 3 && object.id === "holodisk") &&
        !this.current.known.includes(object.id)
      ) {
        ensureRouteEncounter(this.content, object.id, f);
      }
    }
  }
  private placePending(id: string): void {
    const f = this.state.flight;
    if (!f) {
      return;
    }
    if ((f.galaxy === 1 || f.galaxy === 2 || f.galaxy === 3) && this.current.requiredSites?.[id]) {
      ensureDestination(this.content, id, f);
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
    if (!f || f.galaxy !== 3 || this.current.stage >= 2) {
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
  closeInteraction(): void {
    const dialogue = this.state.dialogue;
    const flight = this.state.flight;
    if (!dialogue || !flight || dialogue.context === HOLODISK_MOMENT || this.suspendedInteraction) {
      return;
    }
    this.suspendedInteraction = { dialogue, galaxy: flight.galaxy };
    this.state.dialogue = null;
  }
  reopenInteraction(): boolean {
    const pending = this.suspendedInteraction;
    if (
      !pending ||
      this.state.mode !== "space" ||
      this.state.flight?.galaxy !== pending.galaxy ||
      this.state.dialogue ||
      this.state.docked
    ) {
      return false;
    }
    this.suspendedInteraction = null;
    this.state.dialogue = pending.dialogue;
    return true;
  }
  interact(openQuestDetails?: (details: ContextQuestDetails) => void): void {
    if (
      this.state.mode !== "space" ||
      !this.state.flight ||
      this.state.dialogue ||
      this.state.docked
    ) {
      return;
    }
    if (this.suspendedInteraction) {
      this.reopenInteraction();
      return;
    }
    const id = this.nearest();
    if (this.useJob(id)) {
      return;
    }
    const chapterContext = this.chapterContext();
    const scan = this.nearestScan(id);
    if (scan) {
      const sites = this.current.explorationSites;
      const site = sites?.[scan.id];
      if (sites && site !== undefined) {
        let leadStation: string | undefined;
        if (typeof site !== "boolean" && (site.kind === "rescue" || site.kind === "hunt")) {
          const stations = this.discoveredJobStations(this.state.flight);
          const lead = this.explorationOffer(this.state.flight, "scan", scan, site.kind, stations);
          if (!lead) {
            this.notify(this.label("huntScanRetry"), "brief", "refusal");
            return;
          }
          postExplorationLead(this.state.flight.galaxy, this.state, lead);
          leadStation = this.keeperStationName(this.state.flight.galaxy, lead.station);
        }
        const flight = this.state.flight;
        const wreck = this.explorationSites(flight).some(
          ({ id, opportunity }) => id === scan.id && opportunity.kind === "salvage",
        );
        const recovered = wreck && recoverExplorationWreck(this.content, flight, scan.id);
        const charted = this.scannedSite(scan.id);
        const paid =
          wreck &&
          !recovered &&
          flight.objects.some(({ enemy, id }) => id === `${scan.id}:salvage` && enemy?.salvaged);
        if (!charted) {
          this.current.explorationSites = {
            ...sites,
            [scan.id]: typeof site === "boolean" ? true : { ...site, scanned: true },
          };
        }
        this.talk.completeScanLesson();
        this.emitScanOutcome(
          flight,
          scan.id,
          !recovered && (charted || paid) ? "remembered" : "scan",
          [],
          scan,
          leadStation,
          recovered ? true : undefined,
        );
        return;
      }
      this.current.charted.push(scan.id);
      this.talk.completeScanLesson();
      this.recordAchievement({
        galaxy: this.state.flight.galaxy,
        id: scan.id,
        kind: "landmarkCharted",
      });
      if (!this.reconcileScannedSurvey(this.state.flight, "scan", scan.id)) {
        this.emitScanOutcome(this.state.flight, scan.id, "scan", []);
      }
      this.stepJob(this.state.flight);
      return;
    }
    const f = this.state.flight;
    const action = id === undefined ? undefined : this.availablePlaceAction(id);
    if (!id || action === undefined) {
      const hint = this.useHintTarget(id);
      const details = this.questDetailsFallback(f, id, hint);
      if (details) {
        openQuestDetails?.(details);
      } else if (hint !== undefined) {
        this.showUseHint(hint);
      }
      return;
    }
    if (
      f.galaxy === 4 &&
      id === "elderLoom" &&
      !this.current.needle?.met &&
      (!this.state.seenConversations.includes("meeting:4:avi") ||
        this.talk.pending("meeting:4:avi"))
    ) {
      this.talk.encounter("stationNear");
      this.queuedNeedleTalk = true;
      this.talk.beforeInteraction(NEEDLE_PRELUDE);
      return;
    }
    if (chapterContext && this.useChapterPlace(chapterContext, id)) {
      return;
    }
    if (id !== HUB_STATION && this.current.stations.includes(id)) {
      if (this.supplyDue(id)) {
        this.finishActivity(f.galaxy);
        this.panel("deliver", this.state.notice, "Astra");
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
    if (f.galaxy === 1) {
      // Once their exchange is running, any outpost gives Ada the holodisk.
      if (p.questComplete && !p.holodisk) {
        this.recoverHolodisk(this.chapter.dialogue[dialogueKeys[id] ?? id]?.speaker);
      } else if (id === "growers" && (!p.introduced || p.stage === 1)) {
        if (!p.introduced) {
          this.coverPoiArrival(f, id);
          p.introduced = true;
          p.stage = Math.max(1, p.stage);
        }
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
    } else if (f.galaxy === 2) {
      if (id === HUB_STATION && (action === "dock" || action === "talk")) {
        this.dock(id, f);
      } else if (id === HUB_STATION) {
        const load = f.cargo;
        p.deposited += load;
        f.cargo = 0;
        if (contractDeposit(f.galaxy, this.state, load)) {
          this.finishActivity(f.galaxy);
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
        this.panel("deposit", INTERACTION_COPY.deposit!.lines[0]!.text, "Astra");
      } else if (
        id === "miner" &&
        p.stage === 2 &&
        p.deposited >= this.content.tuning.miningMilestones[1]
      ) {
        p.stage = 3;
        this.prepareCartwheelClaim(f);
        this.exchange("miner");
      } else if (id === "visitors" && p.stage === 3) {
        p.stage = 4;
        this.exchange("visitors");
      } else {
        this.exchange(id);
      }
    } else if (f.galaxy === 3 && id === "whale" && !p.introduced) {
      this.coverPoiArrival(f, id);
      p.introduced = true;
      p.stage = Math.max(1, p.stage);
      this.ensureWhaleDebris();
      if (p.stage === 2) {
        p.stage = 3;
        this.exchange("freed");
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
      p.sounder = { phase: "hidden" };
      this.complete();
      this.exchange("reunion");
    } else {
      this.talkAt(id, id);
    }
  }
  /** Dispatches the place already selected by an explicit press. */
  private useChapterPlace(context: ChapterContext, id: string): boolean {
    const { flight, progress } = context;
    const runtime = chapterRuntime(flight.galaxy);
    if (runtime && placeActivity(flight.galaxy, progress, id)) {
      this.talkAt(id, id);
      return true;
    }
    if (andromedaStationTopic(context, id) && this.stationSite(flight, id)) {
      this.dock(id, flight);
      return true;
    }
    const result = runtime?.use?.(context, id);
    if (result === undefined) {
      return false;
    }
    if (result.useRefused) {
      this.refuse(this.objective);
      this.useRefusalCount++;
    } else {
      this.applyChapterResult(result);
    }
    return true;
  }
  /** The current galaxy's held station job. */
  private get held(): HeldJob | undefined {
    return heldJob(this.state.selectedGalaxy, this.state);
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
   * the galaxy, with the hub listed once as the outpost it also is.
   */
  private towPlaces(flight: FlightState): JobTarget[] {
    const outposts = this.outposts(flight);
    const ids = this.current.stations;
    const stations = [...new Set(ids)]
      .filter((id) => !outposts.some((outpost) => outpost.id === id))
      .flatMap((id) => this.stationSite(flight, id) ?? []);
    return [...outposts, ...stations.map(({ id, x, y }) => ({ id, x, y }))];
  }
  private discoveredJobStations(flight: FlightState): StationSite[] {
    const ids = new Set(this.current.stations);
    if (flight.galaxy === 2 && this.current.known.includes(HUB_STATION)) {
      ids.add(HUB_STATION);
    }
    return [...ids].flatMap((id) => {
      const specialty = stationSpecialty(flight.galaxy, id);
      const site = specialty === null || specialty === "jobs" ? this.stationSite(flight, id) : null;
      return site ? [site] : [];
    });
  }

  private explorationOffer(
    flight: FlightState,
    phase: ExplorationLeadPhase,
    site: JobTarget,
    kind: LeadJobType,
    stations = this.discoveredJobStations(flight),
  ): JobOffer | null {
    const world = flightWorldContext(flight);
    const issuer = [...stations].sort(
      (a, b) =>
        worldDistance(world, site, a) - worldDistance(world, site, b) || a.id.localeCompare(b.id),
    )[0];
    if (!issuer) {
      return null;
    }
    const context = {
      ...this.jobContext(flight),
      hostiles: jobHostiles({ objects: stationPopulationObjects(flight) }),
    };
    return explorationLeadOffer(world, context, flight.seed, issuer, site, kind, phase);
  }

  private admitExplorationSite(
    flight: FlightState,
    inRegion: (point: Vec) => boolean,
    attempt: { cell: string; region: ExplorationSiteRegion; ordinal: number },
  ): void {
    const { cell, ordinal, region } = attempt;
    const exploration = flight.exploration!;
    const pacing = exploration.pacing!;
    exploration.pacing = { ...pacing, pending: { cell, region } };
    const admitted = this.current.explorationSites ?? {};
    const stations = this.discoveredJobStations(flight);
    const jobTemplates: readonly LeadJobType[] = !stations.length
      ? []
      : region === "far" || flight.galaxy === 6
        ? ["rescue"]
        : ["rescue", "hunt"];
    const kinds = new Map<string, ExplorationSiteKind>();
    const site = placeExplorationSite(this.content, flight, {
      admitted,
      canPostLead: (candidate) => {
        const next = dropRandom(flight.seed, `exploration-lead-kind:${candidate.id}`);
        const kind = jobTemplates[Math.floor(next() * jobTemplates.length)]!;
        kinds.set(candidate.id, kind);
        return this.explorationOffer(flight, "placement", candidate, kind, stations) !== null;
      },
      inRegion,
      opportunityEligibility: { jobTemplates, region },
      protectedSites: Object.values(this.current.requiredSites ?? {}),
    });
    if (site) {
      const kind = site.opportunity.kind === "job" ? kinds.get(site.id)! : site.opportunity.kind;
      this.current.explorationSites = { ...admitted, [site.id]: { kind, scanned: false } };
      exploration.pacing = commitExplorationOpportunity(pacing, ordinal);
    }
  }

  private jobContext(flight: FlightState): BoardContext {
    return {
      galaxy: flight.galaxy,
      hostiles: jobHostiles(flight),
      landmarks: flightLandmarkSites(flight),
      outposts: this.outposts(flight),
      progress: this.current,
      stationSite: (id) => this.stationSite(flight, id),
    };
  }
  private jobStation(job: HeldJob): StationSite | null {
    const f = this.state.flight;
    return f && f.galaxy === this.state.selectedGalaxy
      ? this.stationSite(f, job.station)
      : stationById(ECONOMY, this.state.selectedGalaxy, job.station);
  }
  /**
   * A place's name inside a sentence, as job titles and objectives use it, with its article: a
   * station's or a story destination's sentence name (data/destinations.ts), else its Map name.
   */
  private placeLabel(id: string): string {
    return this.placeLabelIn(this.state.selectedGalaxy, id);
  }
  private placeLabelIn(galaxy: GalaxyNumber, id: string): string {
    return projectPlaceLabel(
      {
        chapter: () =>
          (BUILT.has(galaxy) && this.content.chapters[galaxy]) || placeholderChapter(galaxy),
        label: (key) => this.label(key),
        mappedLabel: () =>
          galaxy === this.state.selectedGalaxy
            ? this.destinations().find((place) => place.id === id)?.label
            : undefined,
        speaker: (chapter) => chapter.dialogue[dialogueKeys[id] ?? id]?.speaker,
      },
      id,
    );
  }
  /** A job's title and one line of detail (gameplay/quests.md "Player strings"). */
  jobText(job: JobOffer): { readonly detail: string; readonly title: string } {
    return this.jobTextIn(this.state.selectedGalaxy, job);
  }
  private jobTextIn(
    galaxy: GalaxyNumber,
    job: JobOffer,
  ): { readonly detail: string; readonly title: string } {
    return projectJobText(
      (key) => this.label(key),
      (id) => this.placeLabelIn(galaxy, id),
      galaxy,
      job,
    );
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
    const board = this.stationServices?.jobs
      ? stationBoard(this.jobContext(f), this.state, site)
      : [];
    const held = this.held;
    const busy = Boolean(this.state.tasks[f.galaxy]);
    const activity = this.activity;
    const featured = activity ?? this.boardActivity(f, site.id);
    return dockedJobRows(
      {
        activity: featured
          ? { held: Boolean(activity), id: featured.id, reward: featured.reward }
          : null,
        busy,
        galaxy: f.galaxy,
        held,
        jobText: (job) => this.jobText(job),
        label: (key) => this.label(key),
      },
      board,
    );
  }
  /** Why a board's Accept refuses while the slot is taken: an activity, else a held job. */
  get jobBusyLine(): string {
    return this.label(this.activity ? "activityBusy" : "jobBusy");
  }
  /** Accepts an offer on the docked station's board, with no confirm. */
  acceptJob(id: string): "accepted" | "busy" | "missing" {
    const station = this.state.docked;
    const f = this.state.flight;
    if (!station || !f || !this.stationServices?.jobs) {
      return "missing";
    }
    const offered = this.boardActivity(f, station);
    if (offered?.id === id) {
      if (this.state.tasks[f.galaxy]) {
        return "busy";
      }
      this.takeActivity(station);
      return heldActivity(f.galaxy, this.state) ? "accepted" : "missing";
    }
    const accepted = acceptJob(f.galaxy, station, id, this.state);
    if (accepted === "accepted") {
      this.reconcileScannedSurvey(f, "remembered");
    }
    return accepted;
  }
  /**
   * The galaxy's activity a docked station offers on its board, with its reward: the hub's
   * mining contract once the chapter is resolved. Null at any other station.
   */
  private boardActivity(f: FlightState, station: string): { id: string; reward: number } | null {
    const activity = placeActivity(f.galaxy, this.current, station);
    const terms = activity && this.activityTerms(f, station);
    return activity && terms ? { id: activity.id, reward: terms.reward } : null;
  }
  /**
   * A station's site: a seeded station's, or the hub's where it stands in this flight, since the
   * hub is Cartwheel's station (gameplay/rules.md).
   */
  private stationSite(f: FlightState, id: string): StationSite | null {
    const seeded = worldStationById(flightStationContext(f), ECONOMY, f.galaxy, id);
    if (seeded || id !== HUB_STATION || f.galaxy !== 2) {
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
    if (this.dropHeldActivity(this.state.selectedGalaxy)) {
      return true;
    }
    const held = this.held;
    const dropped = dropJob(this.state.selectedGalaxy, this.state);
    if (dropped && this.state.flight) {
      if (held && this.state.flight.galaxy === this.state.selectedGalaxy) {
        delete this.state.flight.trackedQuestId;
        this.markerRegistry.forget(
          { store: this.markerStore(this.state.flight) },
          `job:${held.id}`,
        );
      }
      delete this.state.flight.tow;
    }
    return dropped;
  }
  /** The held job's objective, shown beside the story objective and labelled Job. */
  get jobObjective(): string | null {
    return this.taskObjective(this.state.selectedGalaxy);
  }
  /** Only the currently held station job is selectable. Story is the default. */
  canTrackQuest(id: string): boolean {
    const flight = this.state.flight;
    if (!flight || this.state.mode !== "space" || flight.galaxy !== this.state.selectedGalaxy) {
      return false;
    }
    const held = heldJob(flight.galaxy, this.state);
    return held !== undefined && taskQuestId(flight.galaxy, held) === id;
  }
  trackQuest(id: string): boolean {
    const flight = this.state.flight;
    if (!flight || !this.canTrackQuest(id)) {
      return false;
    }
    flight.trackedQuestId = id;
    return true;
  }
  get trackedQuestId(): string | null {
    const flight = this.state.flight;
    if (!flight || this.state.mode !== "space") {
      return null;
    }
    const id = flight.trackedQuestId;
    if (id !== undefined && this.canTrackQuest(id)) {
      return id;
    }
    const activity = heldActivity(flight.galaxy, this.state);
    if (activity?.id === "threadNeedle") {
      return taskQuestId(flight.galaxy, activity);
    }
    if (activity?.id === "courierRun" && activity.courier?.scout) {
      return taskQuestId(flight.galaxy, activity);
    }
    const progress = this.state.progress[flight.galaxy];
    return BUILT.has(flight.galaxy) && progress.introduced && !progress.resolved
      ? storyQuestId(flight.galaxy, progress.stage)
      : null;
  }
  private questText(galaxy: GalaxyNumber): QuestTextContext {
    return {
      galaxy,
      jobText: (job) => this.jobTextIn(galaxy, job),
      label: (key) => this.label(key),
      placeLabel: (id) => this.placeLabelIn(galaxy, id),
    };
  }
  private taskObjective(galaxy: GalaxyNumber): string | null {
    return projectTaskObjective(this.questText(galaxy), this.state);
  }
  private questLines(galaxy: GalaxyNumber): Omit<QuestEntry, "locations">[] {
    return projectQuestLines(
      {
        ...this.questText(galaxy),
        miningMilestones: this.content.tuning.miningMilestones,
        storyObjective: () => this.objectiveFor(galaxy),
        taskObjective: () => this.taskObjective(galaxy),
      },
      this.state,
    );
  }

  /** All accepted tasks and introduced, unresolved story quests, derived without switching galaxies. */
  get quests(): readonly QuestEntry[] {
    return projectQuestEntries(
      {
        hubName: (galaxy, id) => this.cartwheelHubName(galaxy, id),
        label: (key) => this.label(key),
        placeLabel: (galaxy, id) => this.placeLabelIn(galaxy, id),
        questLines: (galaxy) => this.questLines(galaxy),
      },
      this.state.progress,
    );
  }
  get aboardQuestId(): string | null {
    if (!this.aboard) {
      return null;
    }
    const galaxy = this.state.flight?.galaxy;
    const kind = this.carrying || this.towing ? "job" : "story";
    return (
      this.quests.find((entry) => entry.galaxy === galaxy && entry.line.kind === kind)?.id ?? null
    );
  }
  /** The current galaxy's accepted activity. */
  private get activity(): HeldActivity | undefined {
    return heldActivity(this.state.selectedGalaxy, this.state);
  }
  /** Whether Whirlpool's guided calf is away from its family: while Guide a calf is held. */
  get calfAway(): boolean {
    return heldActivity(3, this.state)?.id === "guideCalf";
  }
  /** The guided calf in this flight, for the scene. */
  get guidedCalf(): Readonly<GuidedCalf> | null {
    return this.state.mode === "space" ? (this.state.flight?.calf ?? null) : null;
  }
  get aboard(): Aboard | null {
    return aboard(this.state);
  }
  /** The Ship card's facts: what Ada carries this flight and her ship's levels and weapons. */
  get ship(): ShipState {
    const { economy, flight } = this.state;
    const { carrying, towing } = shipItemFacts(() => this.quests, this.state);
    const levels = (this.state.mode === "space" && flight?.levels) || economy.levels;
    return {
      aboard: this.aboard,
      carrying,
      engine: levels.engine,
      holodisks: Object.values(this.state.progress).filter((progress) => progress.holodisk).length,
      ore: this.state.mode === "space" ? (flight?.cargo ?? 0) : 0,
      paint: economy.paint,
      shield: levels.shield,
      stardust: economy.stardust,
      towing,
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
  private jobUse(place: string | undefined): "tow" | "deliver" | null {
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
      worldDistance(flightWorldContext(f), held.target, f.player) <= JOB_TUNING.tow.attach
    ) {
      return "tow";
    }
    // A delivery bound for a station or an outpost hands over with Use, before Dock.
    if (held.type === "delivery" && held.carrying && place === held.target.id) {
      return "deliver";
    }
    return null;
  }
  /** Use for the held job: attaches the tow line or delivers to a station or an outpost. */
  private useJob(place: string | undefined): boolean {
    const use = this.jobUse(place);
    const f = this.state.flight;
    const held = this.held;
    if (!use || !f || !held) {
      return false;
    }
    if (use === "tow") {
      f.tow = { x: held.target.x, y: held.target.y };
      const tow = CONVERSATIONS.find(
        ({ trigger }) => trigger.kind === "job" && trigger.moment === "towAttached",
      );
      this.panel("tow", tow?.lines[0]?.text ?? this.label("tow"), "Astra");
    } else {
      const party =
        this.chapter.dialogue[dialogueKeys[held.target.id] ?? held.target.id]?.speaker ?? "Astra";
      this.finishJob(f);
      this.panel("deliver", this.state.notice, party);
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
    if (this.held?.id !== held.id) {
      delete flight.trackedQuestId;
      this.markerRegistry.forget({ store: this.markerStore(flight) }, `job:${held.id}`);
    }
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
      this.reconcileScannedSurvey(f, "remembered");
    } else if (held.type === "rescue" && f.tow) {
      const world = flightWorldContext(f);
      f.tow = { ...worldPoint(world, f.player, f.tow) };
      pullTow(f.player, f.tow);
      if (world.worldSide !== undefined) {
        f.tow = wrapPoint(world.worldSide, f.tow);
      }
      const place = nearestWorldSafePlace(world, this.towPlaces(f), f.tow);
      if (place && worldDistance(world, place, f.tow) <= JOB_TUNING.tow.complete) {
        this.finishJob(f);
      }
    } else if (held.type === "hunt") {
      if (
        !held.entered &&
        worldDistance(flightWorldContext(f), held.target, f.player) <= JOB_TUNING.hunt.radius
      ) {
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
    const activity = heldActivity(f.galaxy, this.state);
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
    stepCalf(f.galaxy, this.content.tuning.physics, dt, f.player, f.calf);
    if (calfHome(family, f.calf)) {
      delete f.calf;
      this.finishActivity(f.galaxy);
    }
  }
  private restoreCourierPosition(flight: FlightState, newFlight = false): void {
    if (flight.galaxy !== 5) {
      return;
    }
    const held = heldActivity(5, this.state);
    if (held?.id === "courierRun" && held.courier?.approach) {
      positionCourier(this.content, flight, held.courier.position);
    } else if (newFlight && this.state.progress[5].resolved) {
      const pip = flight.objects.find(({ id }) => id === ANDROMEDA_PLACES.pip);
      if (pip) {
        positionCourier(
          this.content,
          flight,
          courierRendezvous(this.content, flight, pip, ACTIVITIES[5]!.reward!),
        );
      }
    }
  }

  private advanceCourier(flight: FlightState, seconds: number): void {
    const held = heldActivity(flight.galaxy, this.state);
    if (held?.id !== "courierRun" || !held.courier?.approach) {
      return;
    }
    const result = stepCourierRun(this.content, flight, held, seconds);
    if (result.spotted) {
      this.talk.chapterCue({ speaker: "astra", text: this.label("courierPatrolSpotted") });
    }
    if (result.complete) {
      this.resetActivity(flight.galaxy);
      this.finishActivity(flight.galaxy);
    }
  }

  /** A held hunt's lost item within Penny's hunt range, as its point id. */
  private lostItemNear(f: FlightState): string | null {
    const held = this.held;
    return held?.type === "hunt" &&
      held.spot &&
      worldDistance(flightWorldContext(f), held.spot, f.player) <= JOB_TUNING.hunt.penny
      ? `job:${held.id}`
      : null;
  }
  private readonly jobNavigation: JobNavigationContext = {
    held: () => this.held,
    jobObjective: () => this.jobObjective,
    state: () => this.state,
    towPlaces: (flight) => this.towPlaces(flight),
  };
  private jobIndicator(f: FlightState): IndicatorTarget | null {
    return jobIndicator(this.jobNavigation, f);
  }
  private jobMapTarget(f: FlightState): MapContext["job"] {
    return jobMapTarget(this.jobNavigation, f);
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
        hunt?.spot &&
        worldDistance(flightWorldContext(f), hunt.spot, f.player) <= JOB_TUNING.hunt.glint
          ? { ...hunt.spot }
          : null,
      landmarks: this.scannableSites(f).map((site) => ({
        ...site,
        charted: this.scannedSite(site.id),
      })),
      towing: Boolean(f.tow),
    };
  }
  choose(id: string): void {
    const dialogue = this.state.dialogue;
    if (!dialogue) {
      return;
    }
    const selected = dialogue.choices.find((choice) => choice.id === id);
    if (!selected) {
      return;
    }
    if (selected.refused) {
      const busy = this.state.tasks[this.state.selectedGalaxy];
      if (busy && dialogue.context.startsWith("activity:")) {
        this.refuse(this.label(busy.kind === "job" ? "jobBusy" : "activityBusy"), "reading");
      }
      return;
    }
    if (
      dialogue.context === "phantom.aftermath" &&
      id === "continue" &&
      this.state.selectedGalaxy === 6 &&
      this.current.questComplete &&
      this.current.holodisk &&
      this.current.phantom
    ) {
      this.current.phantom.aftermathComplete = true;
      delete this.current.phantom.surrenderAftermathDue;
      this.state.dialogue = null;
      return;
    }
    const context = this.chapterContext();
    if (context) {
      const result = chapterRuntime(context.flight.galaxy)?.choose?.(context, dialogue, id);
      if (result !== undefined) {
        this.state.dialogue = null;
        this.applyChapterResult(result);
        return;
      }
    }
    if (id === "optional") {
      const entry = this.chapter.dialogue[dialogue.context];
      if (entry?.optional) {
        this.panel(dialogue.context, entry.optional, entry.speaker);
      }
      return;
    }
    if (dialogue.context === "activity:courier" && (id === "scout" || id === "escort")) {
      this.takeActivity(ANDROMEDA_PLACES.pip, id);
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
      this.dropHeldActivity(this.state.selectedGalaxy);
      this.state.dialogue = null;
      return;
    }
    if (dialogue.context === "holodiskHandover") {
      this.holodiskMoment();
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
    if (this.screen !== "start" || this.canContinue) {
      return;
    }
    this.state.progress[1].opened = false;
    this.startShown = false;
    this.beginVisit();
  }
  /**
   * Continue: a flight saved mid-flight resumes exactly as saved; otherwise a home visit, any
   * waiting home scene first, then Ada's room page.
   */
  continueGame(): void {
    if (this.screen !== "start" || !this.canContinue) {
      return;
    }
    this.startShown = false;
    if (this.heldFlight) {
      Object.assign(this.state, this.heldFlight);
      this.heldFlight = null;
      this.stationTalkVisit = null;
      const { docked, flight } = this.state;
      if (flight) {
        const claim = this.current.claim;
        if (flight.galaxy === 2 && claim?.phase === "active") {
          holdCartwheelClaimField(flight, claim.fieldId);
        }
        recoverLegacyQuestGuards(questGuardPlacementContext(this.content, flight));
        this.prepareWhirlpoolDisk(flight);
      }
      if (docked && flight && !this.greeting) {
        const visits = this.state.progress[flight.galaxy].greetings[docked] ?? 0;
        this.restoreGreeting(flight.galaxy, docked, Math.max(0, visits - 1));
      }
      this.beginConversations();
      const chapter = this.chapterContext();
      if (chapter) {
        if (chapter.flight.galaxy === 5 && this.current.redact) {
          reserveAndromedaRelaySite(chapter.flight, this.current.redact.relay);
        }
        chapterRuntime(chapter.flight.galaxy)?.init?.(chapter);
        if (chapter.flight.galaxy === 6) {
          this.resolvePhantomSurrender(chapter);
        }
      }
      if (flight) {
        this.restoreCourierPosition(flight);
        this.reconcileScannedSurvey(flight, "remembered");
      }
      if (this.resumeHeldStory()) {
        return;
      }
      // A legacy holodisk moment without a cursor resumes from its first page.
      if (this.state.dialogue?.context === HOLODISK_MOMENT) {
        this.holodiskMoment();
      }
      return;
    }
    if (!this.resumeHeldStory()) {
      this.beginVisit();
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
    this.suspendedInteraction = null;
    this.pickupFeedback = [];
    this.depletionContinuation = false;
    this.playedInterludes.clear();
    this.heldFlight = null;
    this.heldStory = null;
    this.unlockFlight = null;
    this.story = null;
    this.choosingReplay = false;
    this.closeSelection();
    this.startShown = true;
  }
  /** Next, or the page's named action; on the sleep scene, a tap once its skip delay passes. */
  storyNext(): void {
    if (this.sleeping && this.slept < OVERNIGHT_SLEEP.skipAfterSeconds) {
      return;
    }
    if (
      this.story &&
      this.screen === "story" &&
      !this.choosingReplay &&
      !currentPage(this.story).choices
    ) {
      this.moveStory(advance(this.story));
    }
  }
  /** A choice page's choice, by its index. */
  storyChoose(index: number): void {
    const position = this.story;
    if (!position || this.screen !== "story" || !Number.isInteger(index) || index < 0) {
      return;
    }
    if (this.choosingReplay) {
      const galaxy = this.replayChapters[index];
      if (galaxy !== undefined) {
        this.choosingReplay = false;
        this.showScene(
          replayChapterScene(this.content, galaxy),
          [...position.trail, stepOf(position)],
          true,
        );
      }
      return;
    }
    if (this.roomPage) {
      if (index === 0 && this.replayChapters.length > 0) {
        this.choosingReplay = true;
      }
      return;
    }
    const choice = shownChoices(position)[index];
    if (!choice) {
      return;
    }
    const { effect, replayGalaxy } = position.scene;
    const galaxy =
      replayGalaxy ?? (effect && effect.kind !== "prologue" ? effect.galaxy : undefined);
    if (
      galaxy !== undefined &&
      choice.next &&
      (position.page === "opening" || position.page === "resolution")
    ) {
      const progress = this.state.progress[galaxy];
      progress.earthChoices = { ...progress.earthChoices, [position.page]: choice.next };
    }
    this.moveStory(advance(position, index));
  }
  storyPrevious(): void {
    if (this.choosingReplay) {
      this.choosingReplay = false;
      return;
    }
    if (this.story && this.screen === "story" && canGoBack(this.story)) {
      if (currentPage(this.story).sleep) {
        this.playedInterludes.add(this.story.scene);
      }
      let previous = goBack(this.story);
      while (currentPage(previous).sleep && canGoBack(previous)) {
        previous = goBack(previous);
      }
      if (this.story.scene.replayGalaxy !== undefined && previous.page === "room") {
        this.finishReplay(this.story);
      } else if (!currentPage(previous).sleep) {
        this.story = previous;
        this.showPage();
      }
    }
  }
  /** Skip follows Next through scene boundaries, stopping for an explicit unresolved choice. */
  storySkip(): void {
    const from = this.story;
    if (!from || this.screen !== "story" || this.sleeping || this.choosingReplay) {
      return;
    }
    if (from.scene.replayGalaxy !== undefined) {
      this.finishReplay(from);
      return;
    }
    const visited = new Set<string>();
    while (this.story && this.screen === "story") {
      const position = this.story;
      const page = currentPage(position);
      if (page.choices?.length) {
        return;
      }
      const key = `${position.scene.id}:${position.page}`;
      if (visited.has(key)) {
        throw new Error(`Story continuation cycle at ${key}`);
      }
      visited.add(key);
      this.moveStory(advance(position));
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
    if (this.reopenInteraction()) {
      return false;
    }
    const f = this.state.flight;
    if (this.state.mode !== "space" || !f || this.state.dialogue || this.state.docked) {
      return false;
    }
    if (this.inDanger) {
      this.refuse(this.label("travelUnavailable"));
      return false;
    }
    this.selection = ROUTE_POSITION[this.state.selectedGalaxy];
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
   * The galaxy map's close X, back and Escape, one step back: in flight, the local map it opened
   * from; at boarding, the story page it opened from, "Welcome back, Navigator.", with its run's
   * Previous intact.
   */
  closeGalaxyMap(): void {
    if (this.galaxyMapShownInFlight) {
      this.closeGalaxyMapInFlight();
    } else if (this.screen === "selector" && this.boardedFrom) {
      const from = this.boardedFrom;
      this.closeSelection();
      this.story = from;
      this.showPage();
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
    this.boardedFrom = null;
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
    const galaxy = this.galaxyMapSelection;
    if (this.suspendedInteraction && galaxy !== this.suspendedInteraction.galaxy) {
      return false;
    }
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
    this.startGalaxy(galaxy);
    return true;
  }
  /**
   * Earth: Ada's room, at boarding without a jump; in flight it ends the flight, story progress
   * saved and no sleep scene.
   */
  leaveCockpit(): void {
    if (this.galaxyMapShownInFlight) {
      this.returnHome();
    } else if (this.screen === "selector") {
      this.closeSelection();
      this.beginVisit();
    }
  }
  private get storyLabels(): StoryLabels {
    return { next: this.label("next"), pickUpRock: this.label("pickUpRock") };
  }
  /**
   * A home visit: waiting scenes, then Ada's room; an empty visit adds Penny's line. `trail`
   * continues a story run that leads into the visit; a visit from the start screen or galaxy
   * selection starts one.
   */
  private beginVisit(trail: readonly StoryStep[] = [], startsRun = trail.length === 0): void {
    this.closeSelection();
    this.showScene(
      waitingEarthScene(this.content, this.state) ??
        visitRoomScene(this.content, this.storyLabels, this.state.prologueSeen, trail, true),
      trail,
      startsRun,
    );
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
      this.playedInterludes.clear();
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
    if (scene.replayGalaxy !== undefined) {
      return [scene];
    }
    const copy = new GameModel(
      this.content,
      this.entropy,
      this.saveRestore,
      JSON.stringify(this.state),
    );
    copy.simulating = true;
    copy.depletionContinuation = this.depletionContinuation;
    copy.startShown = false;
    copy.story = storyStart(scene);
    const scenes = [scene];
    // A run chains only a few scenes; the bound only guards a cycle.
    for (let steps = 0; copy.story && steps < 32; steps++) {
      const end = sceneEnd(copy.story);
      if (atRunEnd(end) && !copy.depletionContinuation) {
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
    if (position && currentPage(position).sleep) {
      this.playedInterludes.add(position.scene);
    }
    const destination =
      next && currentPage(next).sleep && this.playedInterludes.has(next.scene)
        ? advance(next)
        : next;
    if (destination) {
      this.story = destination;
      this.showPage();
      return;
    }
    if (!position) {
      return;
    }
    if (position.scene.replayGalaxy !== undefined) {
      this.finishReplay(position);
      return;
    }
    const ended = position.scene;
    const trail = this.depletionContinuation
      ? [...position.trail, stepOf(position)]
      : runTrail(position);
    const startsRun = Boolean(ended.endsRun) && !this.depletionContinuation;
    this.applyEffect(ended);
    if (ended.lead === "home") {
      this.showScene(
        waitingEarthScene(this.content, this.state) ??
          visitRoomScene(this.content, this.storyLabels, this.state.prologueSeen, trail, false),
        trail,
        startsRun,
      );
    } else if (ended.lead === "visit") {
      this.beginVisit(trail, startsRun);
    } else if (ended.lead === "board") {
      this.showScene(
        boardingScene(this.content, this.state.announceGalaxy, roomBackground(trail.map(stepPage))),
        trail,
        startsRun,
      );
    } else if (ended.lead === "flight") {
      // Back to the flight the moment paused.
      this.story = null;
      if (this.state.dialogue?.context === HOLODISK_MOMENT) {
        this.state.dialogue = null;
        if (
          ended.id === "holodisk" &&
          position.page === "holodisk:memory" &&
          this.state.selectedGalaxy === 4 &&
          this.current.holodisk &&
          holodisksHeld(this.state.progress) === ARCHIE_NAMED.holodisks
        ) {
          this.current.needleMemoryRead = true;
        }
        if (
          this.state.selectedGalaxy === 6 &&
          this.current.holodisk &&
          this.current.questComplete
        ) {
          this.showPhantomAftermath();
        }
      }
    } else {
      this.openSelection(position);
    }
  }
  private finishReplay(position: StoryPosition): void {
    const index = position.trail.findLastIndex(({ page }) => page === "room");
    const room = position.trail[index];
    if (room) {
      this.showScene(room.scene, position.trail.slice(0, index), true);
    }
  }
  private applyEffect(scene: Scene): void {
    const effect = scene.effect;
    if (
      (effect?.kind === "opened" && this.state.progress[effect.galaxy].opened) ||
      (effect?.kind === "resolved" && this.state.progress[effect.galaxy].resolved) ||
      (effect?.kind === "prologue" && this.state.prologueSeen)
    ) {
      return;
    }
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
    return achievementViews(this.state.achievements);
  }
  /**
   * Galaxy selection, the ship on the farthest unlocked position on the route; after an unlock,
   * on the galaxy it flew from until the unlock flight ends. `from` is the story page it opened
   * from, which its close X shows again.
   */
  private openSelection(from: StoryPosition): void {
    this.depletionContinuation = false;
    this.boardedFrom = from;
    this.story = null;
    this.viewing = null;
    this.selection =
      this.unlockFlight?.from ??
      (Math.max(...this.state.unlocked.map((id) => ROUTE_POSITION[id])) as RoutePosition);
  }
  saveDocument(): GameSave {
    this.pullLoadout();
    return saveSnapshot(
      {
        depletionContinuation: this.depletionContinuation,
        emergency: (scene) => this.emergencyReferences.get(scene),
        heldFlight: this.heldFlight,
        pendingInteraction: this.suspendedInteraction,
        story: this.story ? { position: this.story, slept: this.slept } : this.heldStory,
      },
      this.state,
    );
  }
  save(): string {
    return JSON.stringify(this.saveDocument());
  }
}
