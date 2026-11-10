import type { SectorId, Weapon } from "../data/types.ts";

import type { EnemyState } from "./enemy-ai.ts";

export interface Vec {
  x: number;
  y: number;
}
export interface FlightInput {
  move: Vec;
  aim: Vec;
  use: boolean;
}
export type ObjectKind =
  "rock" | "resource" | "enemy" | "hazard" | "pickup" | "destination" | "debris";
export interface SpaceObject extends Vec {
  id: string;
  kind: ObjectKind;
  radius: number;
  hp: number;
  role?: string;
  enemy?: EnemyState;
  velocity?: Vec;
  routeId?: string;
  behavior?: "pursue" | "shoot" | "guard";
  weapon?: Exclude<Weapon, "basic">;
  cooldown?: number;
}
export interface Shot extends Vec {
  projectile?: "bolt" | "missile";
  id: string;
  velocity: Vec;
  enemy: boolean;
  life: number;
  piercing: boolean;
  hitIds: string[];
}
export interface FlightState {
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
  ammo: number;
  fireCooldown: number;
  objects: SpaceObject[];
  shots: Shot[];
  chunks: string[];
  exploredChunks: string[];
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
