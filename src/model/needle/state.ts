import { NEEDLE } from "../../data/needle.ts";
import type { Vec } from "../types.ts";

export type NeedleApproach = "show" | "feedback" | "independent";
export interface NeedleProgress {
  practiceLit: number;
  eyeLit: number;
  /** Absent until Ada makes the required practice choice through Loom's Talk. */
  approach?: NeedleApproach;
}
export function unfinishedNeedleCourse(
  progress: Readonly<NeedleProgress> | undefined,
): "practice" | "eye" | undefined {
  if (!progress?.approach) {
    return undefined;
  }
  if (progress.practiceLit < NEEDLE.practiceGates) {
    return "practice";
  }
  return progress.eyeLit < NEEDLE.eyeGates ? "eye" : undefined;
}
/** Strict finite save validation; a completed Eye requires the practice course. */
export function readNeedleProgress(value: unknown): NeedleProgress | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const p = value as Record<string, unknown>;
  const count = (n: unknown, max: number): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;
  if (
    !count(p.practiceLit, NEEDLE.practiceGates) ||
    !count(p.eyeLit, NEEDLE.eyeGates) ||
    (p.eyeLit > 0 && p.practiceLit !== NEEDLE.practiceGates) ||
    (p.approach !== undefined &&
      !["show", "feedback", "independent"].includes(String(p.approach))) ||
    (p.practiceLit > 0 && p.approach === undefined)
  ) {
    return null;
  }
  return {
    ...(p.approach === undefined ? {} : { approach: p.approach as NeedleApproach }),
    eyeLit: p.eyeLit,
    practiceLit: p.practiceLit,
  };
}

export interface NeedleChapterProgress extends NeedleProgress {
  met: boolean;
  briefed: boolean;
  practiceThanked: boolean;
}
export interface NeedleCue {
  speaker: "loom" | "ada" | "astra";
  text: string;
}
export type StoryCourse = "practice" | "eye";
export interface NeedleFlight {
  anchor: Vec;
  activityPatrol?: { id: number; tried: number[] };
  chatter: NeedleCue[];
  exitPackPlaced: boolean;
  exitWarned?: boolean;
  /** The current course can be started with zero cleared gates, including across Continue. */
  startedCourse?: StoryCourse;
}

export function readNeedleChapterProgress(value: unknown): NeedleChapterProgress | null {
  const base = readNeedleProgress(value);
  if (!base || !value || typeof value !== "object") {
    return null;
  }
  const record = value as NeedleChapterProgress;
  if (
    [record.met, record.briefed, record.practiceThanked].some(
      (flag) => typeof flag !== "boolean",
    ) ||
    (record.briefed && !record.met) ||
    record.briefed !== Boolean(record.approach) ||
    ((base.practiceLit || base.eyeLit) && !record.briefed) ||
    (record.practiceThanked && base.practiceLit !== NEEDLE.practiceGates)
  ) {
    return null;
  }
  return {
    ...base,
    briefed: record.briefed,
    met: record.met,
    practiceThanked: record.practiceThanked,
  };
}
export function validNeedleFlight(value: unknown): value is NeedleFlight {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as NeedleFlight & { readonly guidance?: unknown };
  const point = (point: unknown): point is Vec =>
    Boolean(point) &&
    typeof point === "object" &&
    Number.isFinite((point as Vec).x) &&
    Number.isFinite((point as Vec).y);
  return (
    point(state.anchor) &&
    (state.activityPatrol === undefined ||
      (state.activityPatrol !== null &&
        Number.isSafeInteger(state.activityPatrol.id) &&
        state.activityPatrol.id >= 0 &&
        Array.isArray(state.activityPatrol.tried) &&
        state.activityPatrol.tried.length <= NEEDLE.activityPatrolGates.length &&
        state.activityPatrol.tried.every((index) =>
          NEEDLE.activityPatrolGates.some((gate) => gate === index),
        ) &&
        new Set(state.activityPatrol.tried).size === state.activityPatrol.tried.length)) &&
    typeof state.exitPackPlaced === "boolean" &&
    (state.exitWarned === undefined || typeof state.exitWarned === "boolean") &&
    (state.guidance === undefined || point(state.guidance)) &&
    (state.startedCourse === undefined ||
      state.startedCourse === "practice" ||
      state.startedCourse === "eye") &&
    Array.isArray(state.chatter) &&
    state.chatter.length <= 16 &&
    state.chatter.every(
      (cue) =>
        ["loom", "ada", "astra"].includes(cue.speaker) &&
        typeof cue.text === "string" &&
        cue.text.length <= 240,
    )
  );
}
