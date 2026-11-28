import { GALAXY_ID } from "../data/galaxies.ts";
import type { PhantomAllySpec } from "../model/phantom/allies/index.ts";

export const PHANTOM_ALLIES_ART = "phantom-allies";

type Fields = Record<string, unknown>;
interface Stroke {
  readonly alpha: number;
  readonly width: number;
}
interface Song {
  readonly colour: number;
  readonly fieldAlpha: number;
  readonly rim: Stroke;
  readonly ripples: Stroke & { readonly count: number; readonly periodMs: number };
  readonly droneRing: Stroke & { readonly margin: number };
}
export interface AllyJumpStep {
  readonly ms: number;
  readonly glow?: "full" | "mid" | "low";
  readonly iris?: number;
  readonly scale?: number;
  readonly star?: boolean;
  readonly stretch?: number;
  readonly white?: number;
}
export interface AllyJump {
  readonly glowReference: number;
  readonly fadeMs: number;
  readonly in: readonly AllyJumpStep[];
  readonly out: readonly AllyJumpStep[];
}
export interface PhantomAllyArt {
  readonly projects: ReadonlyMap<string, string>;
  readonly quests: ReadonlyMap<string, string>;
  readonly song?: Song;
  readonly jump?: AllyJump;
}

const fields = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : undefined;
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const share = (value: unknown): value is number =>
  typeof value === "number" && value >= 0 && value <= 1;

function stroke(value: unknown): Stroke | undefined {
  const data = fields(value);
  return share(data?.alpha) && positive(data?.width)
    ? { alpha: data.alpha, width: data.width }
    : undefined;
}

function readSong(value: unknown): Song | undefined {
  const data = fields(value);
  const field = fields(data?.field);
  const rim = stroke(data?.rim);
  const ring = fields(data?.droneRing);
  const droneRing = stroke(ring);
  const ripple = fields(data?.ripples);
  const ripples = stroke(ripple);
  if (
    typeof data?.color !== "string" ||
    !/^#[a-f0-9]{6}$/iu.test(data.color) ||
    (data.quest !== undefined && data.quest !== "whirlpool") ||
    !share(field?.alpha) ||
    !rim ||
    !droneRing ||
    !positive(ring?.margin) ||
    !ripples ||
    !positive(ripple?.count) ||
    !Number.isInteger(ripple.count) ||
    !positive(ripple.periodMs)
  ) {
    return undefined;
  }
  return {
    colour: Number.parseInt(data.color.slice(1), 16),
    droneRing: { ...droneRing, margin: ring.margin },
    fieldAlpha: field.alpha,
    rim,
    ripples: { ...ripples, count: ripple.count, periodMs: ripple.periodMs },
  };
}

function readJumpSteps(value: unknown): AllyJumpStep[] | undefined {
  if (!Array.isArray(value) || !value.length) {
    return undefined;
  }
  const steps: AllyJumpStep[] = [];
  for (const item of value as unknown[]) {
    const data = fields(item);
    if (!positive(data?.ms)) {
      return undefined;
    }
    const { glow, iris, ms, scale, star, stretch, white } = data;
    if (
      (glow !== undefined && glow !== "full" && glow !== "mid" && glow !== "low") ||
      (iris !== undefined && !positive(iris)) ||
      (scale !== undefined && !positive(scale)) ||
      (star !== undefined && typeof star !== "boolean") ||
      (stretch !== undefined && !positive(stretch)) ||
      (white !== undefined && !share(white))
    ) {
      return undefined;
    }
    steps.push({ glow, iris, ms, scale, star, stretch, white } as AllyJumpStep);
  }
  return steps;
}

function readJump(value: unknown): AllyJump | undefined {
  const data = fields(value);
  const reduced = fields(data?.reducedMotion);
  const arrival = readJumpSteps(data?.in);
  const departure = readJumpSteps(data?.out);
  if (!arrival || !departure || !positive(data?.glowReference) || !positive(reduced?.fadeMs)) {
    return undefined;
  }
  return { fadeMs: reduced.fadeMs, glowReference: data.glowReference, in: arrival, out: departure };
}

function craftMap(value: unknown): ReadonlyMap<string, string> {
  const rows = new Map<string, string>();
  for (const [key, entry] of Object.entries(fields(value) ?? {})) {
    const craft = fields(entry)?.craft;
    if (typeof craft === "string" && /^[a-z][a-z0-9-]*$/u.test(craft)) {
      rows.set(key, craft);
    }
  }
  return rows;
}

/** Art supplies display data only. Eligibility, position and song reach come from the flight. */
export function readPhantomAllyArt(value: unknown): PhantomAllyArt | undefined {
  const data = fields(value);
  const roster = fields(data?.roster);
  if (data?.version !== 1 || !roster) {
    return undefined;
  }
  const jump = readJump(data.jump);
  const song = readSong(data.song);
  return {
    ...(jump ? { jump } : {}),
    projects: craftMap(roster.projects),
    quests: craftMap(roster.quests),
    ...(song ? { song } : {}),
  };
}

export function finaleAllyCraft(
  art: PhantomAllyArt | undefined,
  ally: Pick<PhantomAllySpec, "id" | "galaxy">,
): string | undefined {
  const prefix = `project:${ally.galaxy}:`;
  return ally.id.startsWith(prefix)
    ? art?.projects.get(ally.id.slice(prefix.length))
    : art?.quests.get(GALAXY_ID[ally.galaxy]);
}

export function allyJumpStep(
  steps: readonly AllyJumpStep[],
  age: number,
): AllyJumpStep | undefined {
  let remaining = age;
  for (const step of steps) {
    if (remaining >= 0 && remaining < step.ms) {
      return step;
    }
    remaining -= step.ms;
  }
  return undefined;
}
