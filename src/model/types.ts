import type { ActivityId } from "../data/activities.ts";
import type { UpgradeWeapon } from "../data/economy.ts";
import type { EnemyArchetype } from "../data/enemyCatalog.ts";
import type { JobType } from "../data/jobs.ts";
import type { ResourceClass } from "../data/resourceRocks.ts";
import type { StorySceneId } from "../data/storyShips.ts";
import type { GalaxyNumber, Weapon } from "../data/types.ts";
import type { AchievementState } from "./achievements.ts";
import type { EnemyState } from "./enemyAi.ts";
import type { ProjectileFade } from "./playerProjectiles.ts";

/** What Use does here: the disc's symbol, and its name the disc's accessible name. */
export type UseAction = "deliver" | "deposit" | "dock" | "salvage" | "talk" | "tow" | "use";

export interface Vec {
  x: number;
  y: number;
}
export interface FlightInput {
  move: Vec;
  aim: Vec;
  use: boolean;
  viewportWidth?: number;
  /** The device's reduced-motion setting, which times and places destruction drops. */
  reducedMotion?: boolean;
}
export type ObjectKind =
  | "rock"
  | "resource"
  | "enemy"
  | "hazard"
  | "pickup"
  | "destination"
  | "debris"
  | "station"
  | "wreck";
/** A destroyed enemy breaking apart before it releases its drops. */
export interface WreckState {
  archetype: EnemyArchetype;
  age: number;
  facing: Vec;
  /** Whether the wreck has released its drops; it stays until its destruction ends. */
  released?: boolean;
  /** Whether a missile blast destroyed it, so the blast's flash stands in for its own. */
  blasted?: boolean;
}
/**
 * When a released pickup starts to draw and, for a wreck's drop, where it left from for the
 * view's settle. Without `from` it appears in place.
 */
export interface PickupRelease {
  at: number;
  from?: Vec;
}
export interface SpaceObject extends Vec {
  id: string;
  kind: ObjectKind;
  /** Asteroid variant id for a rock with a polygon collision shape. */
  asteroid?: string;
  /** Seeded drift path of an asteroid around its anchor `x`, `y`. */
  orbit?: Vec & { phase: number; radius: number; rate: number };
  /** A debris river rock's current and its arc position along the centre line at time 0. */
  river?: { arc: number; current: string };
  /** The spin frame an ore field rock starts on (art/cartwheel-props.md "Ore field"). */
  spinStart?: number;
  /** A resource rock's class; a rock saved without one is medium. */
  resource?: ResourceClass;
  radius: number;
  hp: number;
  role?: string;
  persistent?: boolean;
  enemy?: EnemyState;
  velocity?: Vec;
  routeId?: string;
  behavior?: "pursue" | "shoot" | "guard";
  /** An upgrade pickup; its gift is chosen when Ada collects it. */
  upgrade?: true;
  /** An ammo pack pickup; its weapon is chosen when Ada collects it. */
  ammoPack?: true;
  cooldown?: number;
  /** Stardust carried by a Stardust pickup. */
  amount?: number;
  wreck?: WreckState;
  release?: PickupRelease;
}
export interface Shot extends Vec {
  projectile?: "bolt" | "missile" | "dot";
  /** An enemy-only weapon's bolt, which draws as its own. */
  enemyWeapon?: "ringBurst";
  /** HP a hit removes. */
  damage: number;
  /** World radius of a player missile's blast, which damages every enemy in it. */
  blast?: number;
  fade?: ProjectileFade;
  id: string;
  velocity: Vec;
  enemy: boolean;
  life: number;
  piercing: boolean;
  hitIds: string[];
}
/** A laid enemy mine (gameplay/ships.md "Enemy weapons"), still until it bursts or fades. */
export interface Mine extends Vec {
  /** Seconds since it was laid. */
  age: number;
  damage: number;
  /** Its fizzle at the end of its life, or its pop, still playing; it no longer collides. */
  end?: { age: number; kind: "fizzle" | "pop" };
  id: string;
  /** The ship that laid it. */
  ownerId: string;
}
/** Only inactive notable records and permanent defeat tombstones survive chunk eviction. */
export interface PersistentWorldState {
  version: 1;
  notables: Record<string, SpaceObject | null>;
}
export interface FlightState {
  /** Travel arrival points; encounters stay clear of them as of the flight's start. */
  arrivals?: Vec[];
  world: PersistentWorldState;
  visited: Record<string, string>;
  combat?: {
    initialPackSizes: Record<string, number>;
    routeEncounters: string[];
    /** Whale destinations whose hunting pack has been placed this flight. */
    huntingPacks?: string[];
    unloadedPackMembers?: Record<string, number>;
  };
  galaxy: GalaxyNumber;
  seed: number;
  time: number;
  /** Cartwheel's story ship scene started this flight, if any. */
  storyScene?: { at: number; id: StorySceneId; lineDue: boolean };
  player: Vec;
  velocity: Vec;
  facing: Vec;
  shield: number;
  sinceDamage: number;
  /** Unused paid recharge as a fraction of maximum capacity, at most 0.01. */
  shieldRechargeCredit?: number;
  /** Cumulative whole ore paid for recharge, including credit not consumed yet. */
  shieldOreSpent?: number;
  /** Flight time of the last scenery bump that dealt damage (rules.md "bump damage"). */
  lastBump?: number;
  /** Seconds Ada has been in danger without a break (rules.md), 0 outside danger. */
  dangerFor: number;
  cargo: number;
  weapon: Weapon;
  ownedWeapons?: Exclude<Weapon, "laser">[];
  /** Run-only weapons from the grant cheat; they never enter saved ownership. */
  grantedWeapons?: Exclude<Weapon, "laser">[];
  /** Destinations whose blocking guard has been cued this flight (flight.ts cueGuards). */
  guardCues?: string[];
  /** Cued guards flying toward Ada until they are on screen. */
  summonedGuards?: string[];
  /** The ship's bought upgrade levels, mirrored from the economy for this flight. */
  levels: UpgradeLevels;
  /** Shots left per upgrade weapon, mirrored from the economy; granted weapons keep their own. */
  ammo: AmmoCounts;
  /** Seconds until Ada can switch weapons again; 0 when she can. */
  weaponSwitchFor: number;
  /** The towed craft's position while a rescue job's tow line is attached. */
  tow?: Vec;
  /** Guide a calf's calf in this flight, once placed at its start (model/calf.ts). */
  calf?: GuidedCalf;
  fireCooldown: number;
  /** Enemy mines laid this flight. */
  mines: Mine[];
  objects: SpaceObject[];
  shots: Shot[];
  chunks: string[];
  freshChunk: string | null;
  freshDistance: number;
  nextId: number;
}
export interface GalaxyProgress {
  /** At least one repeatable activity completed here, for this galaxy's finale ally. */
  activityCompleted?: boolean;
  stage: number;
  introduced: boolean;
  questComplete: boolean;
  resolved: boolean;
  known: string[];
  deposited: number;
  questItem: string | null;
  discoveries: number;
  destroyedEnemies: number;
  /** Discovered station ids, which are travel destinations. */
  stations: string[];
  /**
   * How many dockings each station's keeper has greeted, by station id: 1 after the first, full
   * greeting, then one more per later line (model/keepers.ts). Restart clears it.
   */
  greetings: Record<string, number>;
  /** The galaxy's holodisk is recovered and inserted into Astra's drive. */
  holodisk: boolean;
  /** The chapter's home opening has played; old scenes never replay. */
  opened: boolean;
  /** Stardust paid toward each of the galaxy's community projects, by project id. */
  donated: Record<string, number>;
  /** Charted landmark ids (model/landmarks.ts). */
  charted: string[];
  /** Funded projects whose world change has played its reveal, in reveal order. */
  revealed: string[];
  /**
   * The Map's explored record across flights: the id of each chunk in the charting disc Ada has
   * visited (model/map.ts recordExplored). Restart clears it.
   */
  explored: string[];
  /** A story ship scene cut short by the end of a flight, replayed at the hub. */
  replayScene?: StorySceneId;
  /** Guides of the calf accepted so far, which seed the next calf's start; absent before one. */
  guides?: number;
}
/** A job's fixed place: a station, outpost or landmark by id, or a spot ("" id). */
export interface JobTarget extends Vec {
  id: string;
}
/** A station job on offer (gameplay/quests.md "Station jobs"); its targets are fixed when made. */
export interface JobOffer {
  id: string;
  type: JobType;
  /** The issuing station. */
  station: string;
  reward: number;
  /** The pool item it names: a delivery's cargo, a stranded craft or a lost item. */
  item: string;
  /**
   * A survey's landmark, a delivery's destination, a rescue's stranded craft or a hunt's search
   * area centre.
   */
  target: JobTarget;
  /** A lost item's spot inside its search area. */
  spot?: Vec;
}
/** What Ada carries for a job or an activity, or tows for a rescue: its kind and its name. */
export interface Aboard {
  kind: "carrying" | "towing";
  name: string;
}
/** The Ship card's facts (gameplay/rules.md "Pause"): what Ada carries and how she is fitted. */
export interface ShipState {
  aboard: Aboard | null;
  engine: number;
  /** Holodisks recovered across the galaxies. */
  holodisks: number;
  /** Ore carried this flight. */
  ore: number;
  /** The ship paint's id. */
  paint: string;
  shield: number;
  stardust: number;
  tractor: number;
  /** Owned weapons in the HUD weapon icons' order, with levels and shots left (null: unlimited). */
  weapons: { id: Weapon; level: number; ammo: number | null }[];
}
/** The held job and how far it has come. */
export interface HeldJob extends JobOffer {
  kind: "job";
  /** A delivery's item is aboard; a lost one is replaced at the issuing station. */
  carrying?: boolean;
  /** Ada has entered a hunt's search area. */
  entered?: boolean;
}
/** An accepted repeatable activity (data/activities.ts) and how far it has come. */
export interface HeldActivity {
  kind: "activity";
  id: ActivityId;
  /** The story place that offered it. */
  place: string;
  reward: number;
  /** A courier escort resumes at its saved position with its one patrol. */
  courier?: { position: Vec; patrolSpawned: boolean };
  /** Gates lit in the held Thread the needle run, separate from the chapter's gates. */
  lit?: number;
  /** A mining contract's resources deposited at the hub since accepting. */
  deposited?: number;
  /** A supply run's item is aboard; a lost one is replaced through Talk at the issuer. */
  carrying?: boolean;
  /** A guide's calf start, as an offset from the family. */
  start?: Vec;
  /** A supply run's destination station, fixed when accepted. */
  target?: JobTarget;
}
/** The guided calf: where it is, how it moves and whether it follows Ada. */
export interface GuidedCalf extends Vec {
  following: boolean;
  velocity: Vec;
}
/** A galaxy's one optional task: a held station job or an accepted repeatable activity. */
export type OptionalTask = HeldActivity | HeldJob;
export interface JobsState {
  /** Each station's offers in slot order, by galaxy and station id. */
  boards: Partial<Record<GalaxyNumber, Record<string, JobOffer[]>>>;
  /** Jobs made so far, which seeds the next. */
  made: number;
}
/** Shots left for each upgrade weapon; Laser is unlimited. No cap. */
export type AmmoCounts = Record<UpgradeWeapon, number>;
export interface UpgradeLevels {
  weapons: Record<Weapon, number>;
  /** The Shield upgrade, which sets both its capacity and its recharge. */
  shield: number;
  engine: number;
  tractor: number;
}
/** Stardust and purchases, kept across flights with story progress. */
export interface EconomyState {
  stardust: number;
  ownedWeapons: UpgradeWeapon[];
  weapon: Weapon;
  levels: UpgradeLevels;
  ammo: AmmoCounts;
  paints: string[];
  paint: string;
  /** Undeposited ore kept aboard between flights, carried to any galaxy; absent with none. */
  cargo?: number;
  /** Paid shield credit and ore spending retained between flights. */
  shieldRechargeCredit?: number;
  shieldOreSpent?: number;
}
export interface DialogueChoice {
  id: string;
  label: string;
  /** A choice that cannot act looks disabled, stays tappable and plays the shared refusal. */
  refused?: boolean;
}
export interface DialogueState {
  title: string;
  text: string;
  choices: DialogueChoice[];
  context: string;
}
export interface GameState {
  /** The save format; a save of another version is reset, not migrated. */
  version: 12;
  mode: "home" | "space";
  selectedGalaxy: GalaxyNumber;
  unlocked: GalaxyNumber[];
  progress: Record<GalaxyNumber, GalaxyProgress>;
  flight: FlightState | null;
  dialogue: DialogueState | null;
  /** The station whose card is open; action pauses as in a conversation. */
  docked: string | null;
  economy: EconomyState;
  notice: string;
  /** The prologue plays once. */
  prologueSeen: boolean;
  /** Astra announces a newly unlocked galaxy once, at the next boarding. */
  announceGalaxy: boolean;
  /** The first flight has begun, so the start screen offers Continue and Restart. */
  started: boolean;
  /** In-flight conversations already shown, which do not repeat (data/conversations.ts). */
  seenConversations: string[];
  /** Station job boards; Restart clears them. */
  jobs: JobsState;
  /** Each galaxy's one optional task, such as a held station job; Restart clears them. */
  tasks: Partial<Record<GalaxyNumber, OptionalTask>>;
  /** Unlocked achievements and their counts, which Restart keeps. */
  achievements: AchievementState;
}
export type FlightEvent =
  | { type: "depleted" }
  /** The equipped weapon ran out of ammunition and Ada switched to Laser. */
  | { type: "outOfAmmo" }
  | { type: "stardust"; amount: number }
  /** Actual ore paid this step and its persisted cumulative total, for each ten-ore HUD tick. */
  | { type: "shieldOreSpent"; amount: number; total: number }
  | { type: "stationDiscovered"; id: string }
  | { type: "enemyDestroyed" }
  /** Ada collected an upgrade pickup. */
  | { id: string; type: "upgradeCollected" }
  | { id: string; type: "ammoCollected" }
  /** A heavy's last weapon hardpoint was destroyed while its hull holds. */
  | { id: string; type: "enemyDisabled" }
  | { type: "debrisCleared"; id: string }
  /** A destroyed rock, for the view's break at its pivot; it changes no state. */
  | {
      type: "asteroidDestroyed";
      asteroid: string;
      id: string;
      /** A resource rock, drawn as Art's `resource-{shape}`. */
      resource?: true;
      x: number;
      y: number;
    }
  | { type: "discovered"; id: string }
  /** A pickup collected at contact, for the view's zip into the ship; it changes no state. */
  | { type: "collected"; id: string; lostItem?: true; x: number; y: number }
  /** Ada came within Talk range of a destination its guard still blocks, first time this flight. */
  | { id: string; type: "guardCue" };
