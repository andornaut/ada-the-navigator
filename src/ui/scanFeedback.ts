import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { ScanOutcome, ScanQuestIdentity } from "../model/scanOutcomes.ts";
import type { Vec } from "../model/types.ts";
import { EASE_OUT, NOTICE_TIMING } from "./itemNotice.ts";
import { type ScanFeedbackPath, scanFeedbackPath, scanFeedbackTop } from "./layout/scanFeedback.ts";
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
  /** The shown HUD row's controls along the top, which every rise ends under. */
  readonly hudRow: readonly Rect[];
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
  /**
   * The rise now: from fromY at eased progress start to top. A conversation box shown or gone
   * mid-rise starts a new segment from where the receipt is, so it never hops or moves down.
   */
  segment?: { readonly fromY: number; readonly start: number; readonly top: number };
  /** The eased rise progress of the last shown frame. */
  shownProgress?: number;
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
        hudRow: context.hudRow,
        ...context.measure(next.content),
        progress: 0,
        reducedMotion: context.reducedMotion,
      });
      if (!path) {
        return null;
      }
      next.anchor = { ...anchor };
      next.path = path;
      delete next.segment;
      delete next.shownProgress;
    }
    const path = next.path!;
    const progress =
      context.reducedMotion || elapsed === 0
        ? 0
        : EASE_OUT(Math.min(1, elapsed / NOTICE_TIMING.holdMs));
    const end = scanFeedbackTop(path, context.dialogue);
    const yAt = (segment: NonNullable<Pending["segment"]>, at: number) =>
      segment.start >= 1
        ? segment.fromY
        : segment.fromY +
          (segment.top - segment.fromY) * Math.max(0, (at - segment.start) / (1 - segment.start));
    let segment = next.segment ?? { fromY: path.from.y, start: 0, top: end };
    if (end !== segment.top) {
      // From where the receipt was last shown, toward the new end, never down.
      const shown = next.shownProgress ?? 0;
      const y = yAt(segment, shown);
      segment = { fromY: y, start: shown, top: Math.min(end, y) };
    }
    next.segment = segment;
    next.shownProgress = progress;
    const rect = { ...path.from, y: yAt(segment, progress) };
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
