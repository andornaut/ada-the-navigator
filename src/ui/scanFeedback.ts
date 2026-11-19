import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { ScanOutcome, ScanQuestIdentity } from "../model/scanOutcomes.ts";
import type { Vec } from "../model/types.ts";
import { EASE_OUT, NOTICE_TIMING } from "./itemNotice.ts";
import {
  type ScanFeedbackPath,
  scanFeedbackPath,
  scanFeedbackRect,
} from "./layout/scanFeedback.ts";
import { chipGlyph } from "./mapScreen.ts";
export interface ScanFeedbackContent {
  readonly checkbox: boolean;
  readonly glyph: string | null;
  readonly kind: "scan" | "task" | "quest";
  readonly outcome: ScanOutcome;
  readonly questId?: string;
  readonly text: string;
}
/** Format only the committed receipt. A Survey quest is never inferred to be a task. */
export function scanFeedbackContents(outcome: ScanOutcome): readonly ScanFeedbackContent[] {
  const questGlyph = (quest: ScanQuestIdentity) => chipGlyph(quest.icon);
  if (!outcome.completions.length) {
    return [
      {
        checkbox: false,
        glyph: chipGlyph({ symbol: outcome.target.symbol }),
        kind: "scan",
        outcome,
        text: outcome.target.name,
      },
    ];
  }
  return outcome.completions.map((completion) => ({
    checkbox: completion.kind === "task",
    glyph: questGlyph(completion.quest),
    kind: completion.kind,
    outcome,
    questId: completion.quest.id,
    text: completion.kind === "task" ? completion.task.text : completion.quest.name,
  }));
}
export type ScanFeedbackPart =
  | {
      readonly checked: true;
      readonly kind: "checkbox";
      readonly label: string;
    }
  | {
      readonly kind: "text";
      readonly text: string;
    }
  | {
      readonly glyph: string | null;
      readonly kind: "quest-icon" | "target-icon";
    };
/** The existing renderer receives explicit order, with no task icon on a quest completion. */
export function scanFeedbackParts(content: ScanFeedbackContent): readonly ScanFeedbackPart[] {
  const text: ScanFeedbackPart = { kind: "text", text: content.text };
  const icon: ScanFeedbackPart = {
    glyph: content.glyph,
    kind: content.kind === "scan" ? "target-icon" : "quest-icon",
  };
  return content.kind === "task"
    ? [{ checked: true, kind: "checkbox", label: content.text }, text, icon]
    : [icon, text];
}
export interface ScanFeedbackFrame {
  readonly anchor: Vec;
  readonly content: ScanFeedbackContent;
  readonly opacity: number;
  readonly rect: Rect;
}
export interface ScanFeedbackContext {
  readonly area: Rect;
  readonly blocked: readonly Rect[];
  /** Covered includes paused, dialog, settings, unavailable renderer and loading states. */
  readonly covered: boolean;
  /** The shown conversation box's parts, which the rise stops below. */
  readonly dialogue: readonly Rect[];
  readonly measure: (content: ScanFeedbackContent) => {
    readonly height: number;
    readonly width: number;
  };
  readonly reducedMotion: boolean;
  /** Native caller clock: repeated refreshes in one scene frame reuse the displayed position. */
  readonly time?: number;
  /** The caller uses the existing authoritative target resolver and scene projection. */
  readonly resolveAnchor: (outcome: ScanOutcome) => Vec | undefined;
}
interface Pending {
  readonly content: ScanFeedbackContent;
  elapsed: number;
  anchor?: Vec;
  path?: ScanFeedbackPath;
  /** The last shown top: the receipt only rises, so a box shown later never pushes it down. */
  shownY?: number;
  sampledAt?: number;
  sampledElapsed?: number;
}
/** Transient UI ownership begins after drain; cover and failed placement never consume receipts. */
export class ScanFeedbackQueue {
  private pending: Pending[] = [];
  private received = new WeakSet<ScanOutcome>();
  get length(): number {
    return this.pending.length;
  }
  enqueue(outcomes: readonly ScanOutcome[]): void {
    for (const outcome of outcomes) {
      if (this.received.has(outcome)) {
        continue;
      }
      this.received.add(outcome);
      this.pending.push(
        ...scanFeedbackContents(outcome).map((content) => ({ content, elapsed: 0 })),
      );
    }
  }
  /** Reset only at an actual new/loaded model boundary, never when a covering card opens. */
  reset(): void {
    this.pending = [];
    this.received = new WeakSet();
  }
  frame(context: ScanFeedbackContext, milliseconds: number): ScanFeedbackFrame | null {
    if (context.covered) {
      return null;
    }
    const next = this.pending[0];
    if (!next) {
      return null;
    }
    const sameTime = context.time !== undefined && next.sampledAt === context.time;
    const elapsed = sameTime ? next.sampledElapsed! : next.elapsed;
    const duration =
      NOTICE_TIMING.holdMs +
      (context.reducedMotion ? NOTICE_TIMING.reducedFadeMs : NOTICE_TIMING.fadeMs);
    if (elapsed >= duration) {
      this.pending.shift();
      return this.frame(context, 0);
    }
    const anchor = next.anchor ?? context.resolveAnchor(next.content.outcome);
    if (!anchor) {
      return null;
    }
    const retained = next.path?.area;
    if (
      !retained ||
      retained.x !== context.area.x ||
      retained.y !== context.area.y ||
      retained.width !== context.area.width ||
      retained.height !== context.area.height
    ) {
      const path = scanFeedbackPath({
        anchor,
        area: context.area,
        blocked: context.blocked,
        dialogue: context.dialogue,
        ...context.measure(next.content),
        progress: 0,
        reducedMotion: context.reducedMotion,
      });
      if (!path) {
        return null;
      }
      next.anchor = { ...anchor };
      next.path = path;
      delete next.shownY;
    }
    const path = next.path!;
    const placed = scanFeedbackRect({
      anchor,
      area: context.area,
      blocked: context.blocked,
      dialogue: context.dialogue,
      height: path.from.height,
      path,
      progress: elapsed === 0 ? 0 : EASE_OUT(Math.min(1, elapsed / NOTICE_TIMING.holdMs)),
      reducedMotion: context.reducedMotion,
      width: path.from.width,
    })!;
    const rect = { ...placed, y: Math.min(placed.y, next.shownY ?? placed.y) };
    next.shownY = rect.y;
    const fade = context.reducedMotion ? NOTICE_TIMING.reducedFadeMs : NOTICE_TIMING.fadeMs;
    const opacity = Math.max(0, 1 - Math.max(0, elapsed - NOTICE_TIMING.holdMs) / fade);
    if (context.time !== undefined) {
      next.sampledAt = context.time;
      next.sampledElapsed = elapsed;
    }
    if (!sameTime && Number.isFinite(milliseconds) && milliseconds > 0) {
      next.elapsed += milliseconds;
    }
    return { anchor, content: next.content, opacity, rect };
  }
}
