import type { InstallStepsKind } from "@andornaut/game-kit/web/pwa/installState";

import type { ShipPhysics } from "./shipPhysics.ts";

export type GalaxyNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type Weapon =
  "laser" | "rapidMissile" | "multiLaser" | "heavyMissile" | "scattershot" | "phaser";
/** Weapons only enemies carry (gameplay/ships.md "Enemy weapons"). */
export type EnemyOnlyWeapon = "chargedLance" | "mineLayer" | "ringBurst";
/** Any weapon an enemy fires: the shared weapons and the enemy-only ones. */
export type EnemyWeapon = Weapon | EnemyOnlyWeapon;
/** A weapon level; level 1 is the base and levels 2 and 3 are bought or reached by position. */
export type WeaponLevel = 1 | 2 | 3;

export interface ChapterContent {
  name: string;
  opening: string;
  /** One branch page per opening choice, in choice order, before the story rejoins. */
  openingBranches: readonly [string, string];
  openingChoices: readonly [string, string];
  /** Pages after either branch page, where the story rejoins, each at its own location. */
  openingRejoin?: readonly PrologueStep[];
  resolution: string;
  /** Ordered pages after either resolution branch. */
  resolutionRejoin?: readonly PremiseLine[];
  /** Ordered speaker pages after the chapter's closing narration. */
  closingLines?: readonly PremiseLine[];
  /** One branch page per resolution choice, in choice order, before the closing. */
  resolutionBranches: readonly [string, string];
  resolutionChoices: readonly [string, string];
  closing: string;
  objectives: readonly string[];
  /**
   * Space dialogue panels by key, one speaker each; narration has none and shows the chapter's
   * panel title. `then` names the panel Continue shows next.
   */
  dialogue: Readonly<
    Record<string, { speaker?: string; text: string; optional?: string; then?: string }>
  >;
}

/** A dialogue panel; narration has no speaker. */
export interface PremiseLine {
  speaker?: string;
  text: string;
}
/** A prologue panel. Its choice replaces Continue; its optional questions never gate progress. */
/**
 * A storybook location with Art's background: the Earth scenes (Ada's room also before the rock
 * is polished and with the recorder, Grandma's garden also with the tray spilled and replanted)
 * and aboard: Ada's ship from outside on every page set on the ship, and in the emergency jump's
 * red on the jump-home page.
 */
export type ArtBackground =
  | "aboard"
  | "aboardEmergency"
  | "adaRoom"
  | "adaRoomInvitations"
  | "adaRoomMorning"
  | "adaRoomMorningCats"
  | "adaRoomNight"
  | "adaRoomRecorder"
  | "adaRoomRecorderDad"
  | "adaRoomSleep"
  | "adaRoomUnpolished"
  | "adaRoomUnpolishedCats"
  | "concertHall"
  | "frontDoor"
  | "frontDoorMom"
  | "gardenLot"
  | "grandmaGarden"
  | "grandmaGardenReplanted"
  | "grandmaGardenSpilled"
  | "kitchen"
  | "park"
  | "schoolHallway"
  | "schoolyard";
/** A storybook page's location. */
export type Background = ArtBackground;

export interface PrologueStep extends PremiseLine {
  /** Where the page is; aboard unless given. */
  background?: Background;
  choice?: string;
  questions?: readonly { question: string; answer: string }[];
}
/** Ada, Astra and the ship between chapters. */
export interface PremiseContent {
  /** The boarding panels before each later chapter's jump. */
  boarding: readonly PremiseLine[];
  /** Replaces the last boarding line once, at the first boarding after a galaxy unlocks. */
  boardingNewGalaxy: Required<PremiseLine>;
  /** Ada's room on a home visit with no new scene, before "Pick up the rock.". */
  emptyHome: string;
  /** First launch only: Grandma's garden before chapter one's opening. */
  gardenArrival: readonly PrologueStep[];
  /** First launch only: Grandma's line after chapter one's opening branch, still in the garden. */
  gardenFarewell: PrologueStep;
  holodisk: {
    /** Said by whichever outpost gives Ada galaxy one's holodisk, before the insertion. */
    handover: string;
    /** Plays as each recovered holodisk is inserted into Astra's drive. */
    inserted: readonly PremiseLine[];
    /** Astra's memory lines in the order holodisks are inserted: the Nth plays the Nth. */
    memories: readonly string[];
    /** The holodisk's name in the hub's purchase confirm. */
    name: string;
  };
  /**
   * Plays once, after galaxy one's home opening and before the first flight: the park, Ada's
   * room, then aboard with Astra's optional questions.
   */
  prologue: readonly PrologueStep[];
  /** Ada's room before a named action that takes her aboard. */
  roomRock: string;
}

export interface GameContent {
  /** The built galaxies' chapters; a placeholder galaxy has none. */
  chapters: Readonly<Partial<Record<GalaxyNumber, ChapterContent>>>;
  premise: PremiseContent;
  labels: Readonly<Record<string, string>>;
  /** Each browser kind's own install steps, shown where the browser holds no install prompt. */
  installSteps: Readonly<Record<InstallStepsKind, { title: string; steps: string }>>;
  /** The start screen's update offer. */
  update: { accept: string; cancel: string; title: string };
  tuning: {
    chunkSize: number;
    /** Fraction of Ada's maximum speed requested by the smallest movement input past the dead zone. */
    minSpeedFraction: number;
    /** Exponent applied to movement deflection before scaling toward Ada's maximum speed. */
    speedCurveExponent: number;
    /** Ada's ship physics at her base engine. */
    physics: ShipPhysics;
    /** The shield's capacity at its base level, in HP; 1 damage removes 1 HP. */
    shieldMax: number;
    /** Seconds after Ada was last hit before the shield recharges, at every shield level. */
    shieldRechargeDelay: number;
    /** Seconds the base shield takes to refill from empty, whatever its capacity. */
    shieldFillSeconds: number;
    /** Damage a traveling debris rock or a marked hazard deals per hit. */
    hazardDamage: number;
    /**
     * World units beyond half the game area's width that the battle square reaches from
     * Ada along each axis; the shield never recharges while an attacker is inside it.
     */
    battleMargin: number;
    miningMilestones: readonly [number, number, number];
    introFreshDistance: number;
    encounterFreshDistance: number;
    safeRadius: number;
    /**
     * Talk range, centre to centre: Use at a destination, its discovery, and Salvage on a
     * disabled heavy (gameplay/rules.md).
     */
    talkRange: number;
    /** The least distance between a flight's story destinations (gameplay/rules.md). */
    storySpacing: number;
    whaleDebris: { asteroids: string[]; count: number; hp: number; spacing: number };
    flight: {
      objectsPerChunk: number;
      spawnWeights: { resource: number; rock: number; enemy: number; pickup: number };
      rockHp: number;
      enemyHp: number;
      playerShotDamage: number;
      pursuitSpeedFactor: number;
      damageInterval: number;
      enemyFireInterval: number;
      /** Ada's base projectile speed, whatever her engine level; weapon speed ratios multiply it. */
      projectileSpeed: number;
      projectileLifetime: number;
      enemyProjectileLifetime: number;
      shipRadius: number;
      enemyRadius: number;
      rockRadius: number;
      /** Share of the approaching speed returned when a ship bounces off scenery. */
      sceneryRestitution: number;
      /** Minimum speed away from scenery after a bounce, in world units per second. */
      sceneryRecoil: number;
      /** No encounter ship is placed this close to a flight's start or a jump arrival. */
      arrivalCalm: number;
      pickupRadius: number;
      pieceRadius: number;
      /**
       * How far past Ada's drawn ship every pickup collects, in world units on the world plane
       * from its drawn outline: the one pickup rule (gameplay/rules.md forgiving contacts).
       */
      pickupMargin: number;
      /** The seconds a collected pickup takes to zip into the ship, drawn only. */
      pickupZip: number;
      engagementChunks: number;
    };
  };
}
