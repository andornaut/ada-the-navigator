import type { Achievement, AchievementGoal } from "../data/achievements.ts";
import type { SectorId } from "../data/types.ts";
import type { GameState } from "./types.ts";

// Achievements (gameplay/quests.md "Achievements"). They and their progress survive Restart, so
// their state holds every count it needs rather than reading story progress that Restart clears;
// only the story achievements read the game's progress, at the moment it is reached.

export interface AchievementState {
  /** Unlocked achievement ids, in the order they unlocked. */
  unlocked: string[];
  /** Landmarks charted, by galaxy number, Black Eye's included. */
  charted: Record<string, string[]>;
  jobs: number;
  activities: number;
  allies: string[];
  projects: string[];
  blockade: boolean;
  /** Ship paints ever owned, Classic included. */
  paints: string[];
  /** Points Penny sensed that Ada has not reached yet, as `penny:{sector}:{point}` instances. */
  sensed: string[];
  /** The points found in this world, each counted once; Restart starts the list anew. */
  found: string[];
  /** Penny finds counted, which Restart keeps. */
  finds: number;
}

/**
 * The totals achievements count toward that other systems supply. Zero means the system is not
 * built yet: its achievement stays locked and shows no count.
 */
export interface AchievementTotals {
  readonly allies: number;
  /** Landmarks to chart, by galaxy number 1 to 4. */
  readonly landmarks: Readonly<Record<number, number>>;
  readonly paints: number;
  readonly projects: number;
}

/** What the systems still to be built record when they happen. */
export type AchievementEvent =
  | { readonly kind: "activityCompleted" }
  | { readonly id: string; readonly kind: "allyMade" }
  | { readonly kind: "blockadeBroken" }
  | { readonly kind: "jobCompleted" }
  | { readonly galaxy: number; readonly id: string; readonly kind: "landmarkCharted" }
  | { readonly id: string; readonly kind: "projectFunded" };

/** The story progress the story achievements read when they are reached. */
export type AchievementGame = Pick<GameState, "economy" | "progress" | "prologueSeen">;

export function newAchievements(): AchievementState {
  return {
    activities: 0,
    allies: [],
    blockade: false,
    charted: {},
    finds: 0,
    found: [],
    jobs: 0,
    paints: [],
    projects: [],
    sensed: [],
    unlocked: [],
  };
}

const addOnce = (list: string[], id: string): void => {
  if (!list.includes(id)) {
    list.push(id);
  }
};

export function recordAchievement(achievements: AchievementState, event: AchievementEvent): void {
  switch (event.kind) {
    case "activityCompleted":
      achievements.activities++;
      return;
    case "allyMade":
      addOnce(achievements.allies, event.id);
      return;
    case "blockadeBroken":
      achievements.blockade = true;
      return;
    case "jobCompleted":
      achievements.jobs++;
      return;
    case "landmarkCharted":
      addOnce((achievements.charted[event.galaxy] ??= []), event.id);
      return;
    case "projectFunded":
      addOnce(achievements.projects, event.id);
  }
}

/** Penny sensed these points; each counts as a find once Ada reaches it. */
export function recordSensed(achievements: AchievementState, instances: readonly string[]): void {
  for (const instance of instances) {
    if (!achievements.found.includes(instance)) {
      addOnce(achievements.sensed, instance);
    }
  }
}

/**
 * Moves every sensed point of the galaxy within range of Ada to the finds. A point's object
 * must be in the flight to be reached; one that is not stays sensed.
 */
export function reachSensed(
  range: number,
  sector: SectorId,
  points: readonly { readonly id: string; readonly x: number; readonly y: number }[],
  player: { readonly x: number; readonly y: number },
  achievements: AchievementState,
): void {
  const prefix = `penny:${sector}:`;
  achievements.sensed = achievements.sensed.filter((instance) => {
    if (!instance.startsWith(prefix)) {
      return true;
    }
    const point = points.find(({ id }) => id === instance.slice(prefix.length));
    if (!point || Math.hypot(point.x - player.x, point.y - player.y) > range) {
      return true;
    }
    if (!achievements.found.includes(instance)) {
      achievements.found.push(instance);
      achievements.finds++;
    }
    return false;
  });
}

const charted = (achievements: AchievementState, galaxy: number): number =>
  achievements.charted[galaxy]?.length ?? 0;

/** An achievement's count toward it; a need of zero means its system is not built yet. */
export function achievementProgress(
  totals: AchievementTotals,
  goal: AchievementGoal,
  achievements: AchievementState,
): { readonly have: number; readonly need: number } {
  switch (goal.kind) {
    case "chartOne": {
      const galaxies = Object.keys(totals.landmarks)
        .map(Number)
        .filter((galaxy) => (totals.landmarks[galaxy] ?? 0) > 0);
      if (galaxies.length === 0) {
        return { have: 0, need: 0 };
      }
      // The galaxy with the most charted, nearest to done on a tie.
      const best = galaxies.reduce((a, b) => {
        const order =
          charted(achievements, b) - charted(achievements, a) ||
          (totals.landmarks[a] ?? 0) -
            charted(achievements, a) -
            ((totals.landmarks[b] ?? 0) - charted(achievements, b));
        return order > 0 ? b : a;
      });
      return { have: charted(achievements, best), need: totals.landmarks[best] ?? 0 };
    }
    case "chartAll": {
      const galaxies = [1, 2, 3, 4];
      const need = galaxies.every((galaxy) => (totals.landmarks[galaxy] ?? 0) > 0)
        ? galaxies.reduce((sum, galaxy) => sum + (totals.landmarks[galaxy] ?? 0), 0)
        : 0;
      const have = galaxies.reduce(
        (sum, galaxy) =>
          sum + Math.min(charted(achievements, galaxy), totals.landmarks[galaxy] ?? 0),
        0,
      );
      return { have, need };
    }
    case "jobs":
      return { have: achievements.jobs, need: goal.need };
    case "helps":
      return { have: achievements.jobs + achievements.activities, need: goal.need };
    case "allies":
      return { have: achievements.allies.length, need: totals.allies };
    case "projects":
      return {
        have: achievements.projects.length,
        need: totals.projects > 0 ? (goal.need ?? totals.projects) : 0,
      };
    case "pennyFinds":
      return { have: achievements.finds, need: goal.need };
    case "paints":
      return { have: achievements.paints.length, need: totals.paints };
    case "blockade":
      return { have: Number(achievements.blockade), need: 1 };
    default:
      // The prologue and chapters unlock when reached; a locked one has nothing counted yet.
      return { have: 0, need: 1 };
  }
}

function reached(
  totals: AchievementTotals,
  goal: AchievementGoal,
  achievements: AchievementState,
  game: AchievementGame,
): boolean {
  if (goal.kind === "prologue") {
    return game.prologueSeen;
  }
  if (goal.kind === "chapter") {
    return game.progress[goal.galaxy].resolved;
  }
  if (goal.kind === "chartOne") {
    // Any one galaxy fully charted, not only the one the card counts.
    return Object.entries(totals.landmarks).some(
      ([galaxy, total]) => total > 0 && charted(achievements, Number(galaxy)) >= total,
    );
  }
  const { have, need } = achievementProgress(totals, goal, achievements);
  return need > 0 && have >= need;
}

/**
 * Brings the counts up to date with the game (paints owned) and unlocks every achievement now
 * reached, returning the newly unlocked ones in card order.
 */
export function unlockAchievements(
  catalog: readonly Achievement[],
  totals: AchievementTotals,
  achievements: AchievementState,
  game: AchievementGame,
): Achievement[] {
  for (const paint of game.economy.paints) {
    addOnce(achievements.paints, paint);
  }
  const unlocked = catalog.filter(
    (achievement) =>
      !achievements.unlocked.includes(achievement.id) &&
      reached(totals, achievement.goal, achievements, game),
  );
  achievements.unlocked.push(...unlocked.map(({ id }) => id));
  return unlocked;
}
