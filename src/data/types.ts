import type { InstallStepsKind } from "@andornaut/game-kit/web/pwa/installState";

import type { ShipPhysics } from "./ship-physics.ts";

export type SectorId = 1 | 2 | 3 | 4 | 5 | 6;
export type Weapon =
  "basic" | "rapidMissile" | "multiLaser" | "heavyMissile" | "scattershot" | "phaser";

export interface ChapterContent {
  name: string;
  opening: string;
  /** One branch page per opening choice, in choice order, before the story rejoins. */
  openingBranches: readonly [string, string];
  openingChoices: readonly [string, string];
  /** Pages after either branch page, where the story rejoins, each at its own location. */
  openingRejoin?: readonly PrologueStep[];
  resolution: string;
  /** One branch page per resolution choice, in choice order, before the closing. */
  resolutionBranches: readonly [string, string];
  resolutionChoices: readonly [string, string];
  closing: string;
  objectives: readonly string[];
  dialogue: Readonly<Record<string, { speaker: string; text: string; optional?: string }>>;
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
 * and the cockpit, empty while Ada and Penny stand and seated once they sit.
 */
export type ArtBackground =
  | "adaRoom"
  | "adaRoomMorning"
  | "adaRoomMorningCats"
  | "adaRoomNight"
  | "adaRoomRecorder"
  | "adaRoomRecorderDad"
  | "adaRoomSleep"
  | "adaRoomUnpolished"
  | "adaRoomUnpolishedCats"
  | "cockpit"
  | "cockpitSeated"
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
  /** Where the page is; the cockpit unless given. */
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
    /** Astra's memory line after each built galaxy's insertion. */
    memories: Readonly<Partial<Record<SectorId, string>>>;
    /** The holodisk's name in the hub's purchase confirm. */
    name: string;
  };
  /**
   * Plays once, after galaxy one's home opening and before the first flight: the park, Ada's
   * room, the cockpit standing with Astra's optional questions, then seated.
   */
  prologue: readonly PrologueStep[];
  /** Ada's room before a named action that takes her aboard. */
  roomRock: string;
}

export interface PrototypeContent {
  /** The built galaxies' chapters; a placeholder galaxy has none. */
  chapters: Readonly<Partial<Record<SectorId, ChapterContent>>>;
  premise: PremiseContent;
  labels: Readonly<Record<string, string>>;
  /** Each browser kind's own install steps, shown where the browser holds no install prompt. */
  installSteps: Readonly<Record<InstallStepsKind, { title: string; steps: string }>>;
  /** The start screen's update offer. */
  update: { accept: string; cancel: string; title: string };
  tuning: {
    chunkSize: number;
    /** Base maximum speed; every ship's physics speedRatio scales it. */
    maxSpeed: number;
    /** Fraction of Ada's maximum speed requested by the smallest movement input past the dead zone. */
    minSpeedFraction: number;
    /** Exponent applied to movement deflection before scaling toward Ada's maximum speed. */
    speedCurveExponent: number;
    /** Ada's ship physics. */
    physics: ShipPhysics;
    shieldMax: number;
    shieldRechargeDelay: number;
    shieldRechargeRate: number;
    enemyDamage: number;
    enemyProjectileSpeed: number;
    miningMilestones: readonly [number, number, number];
    introFreshDistance: number;
    encounterFreshDistance: number;
    safeRadius: number;
    /** The least distance between a flight's story destinations (gameplay/rules.md). */
    storySpacing: number;
    dangerReleaseSeconds: number;
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
      projectileSpeedFactor: number;
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
      pickupReach: number;
      engagementChunks: number;
    };
  };
}
