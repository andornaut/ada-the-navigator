import type { SectorId, Weapon } from "../data/types.ts";
import type { EnemyState } from "./enemy-ai.ts";
import type { ProjectileFade } from "./player-projectiles.ts";

export interface Vec {
  x: number;
  y: number;
}
export interface FlightInput {
  move: Vec;
  aim: Vec;
  use: boolean;
  viewportWidth?: number;
}
export type ObjectKind =
  "rock" | "resource" | "enemy" | "hazard" | "pickup" | "destination" | "debris";
export interface SpaceObject extends Vec {
  id: string;
  kind: ObjectKind;
  radius: number;
  hp: number;
  role?: string;
  persistent?: boolean;
  enemy?: EnemyState;
  velocity?: Vec;
  routeId?: string;
  behavior?: "pursue" | "shoot" | "guard";
  weapon?: Exclude<Weapon, "basic">;
  cooldown?: number;
}
export interface Shot extends Vec {
  projectile?: "bolt" | "missile" | "dot";
  damage?: number;
  fade?: ProjectileFade;
  id: string;
  velocity: Vec;
  enemy: boolean;
  life: number;
  piercing: boolean;
  hitIds: string[];
}
/** Only inactive notable records and permanent defeat tombstones survive chunk eviction. */
export interface PersistentWorldState {
  version: 1;
  notables: Record<string, SpaceObject | null>;
}
export interface FlightState {
  world: PersistentWorldState;
  visited: Record<string, string>;
  combat?: { initialPackSizes: Record<string, number>; routeEncounters: string[] };
  sector: SectorId;
  seed: number;
  time: number;
  player: Vec;
  velocity: Vec;
  facing: Vec;
  shield: number;
  sinceDamage: number;
  dangerFor: number;
  cargo: number;
  weapon: Weapon;
  ownedWeapons?: Exclude<Weapon, "basic">[];
  ammo: number;
  fireCooldown: number;
  objects: SpaceObject[];
  shots: Shot[];
  chunks: string[];
  freshChunk: string | null;
  freshDistance: number;
  nextId: number;
}
export interface SectorProgress {
  stage: number;
  introduced: boolean;
  questComplete: boolean;
  resolved: boolean;
  known: string[];
  deposited: number;
  questItem: string | null;
  discoveries: number;
  disabledEnemies: number;
}
export interface DialogueChoice {
  id: string;
  label: string;
}
export interface DialogueState {
  title: string;
  text: string;
  choices: DialogueChoice[];
  context: string;
}
export interface GameState {
  version: 1;
  mode: "home" | "space";
  selectedSector: SectorId;
  unlocked: SectorId[];
  progress: Record<SectorId, SectorProgress>;
  flight: FlightState | null;
  dialogue: DialogueState | null;
  notice: string;
}
export type FlightEvent =
  | { type: "depleted" }
  | { type: "enemyDisabled" }
  | { type: "debrisCleared"; id: string }
  | { type: "discovered"; id: string };
