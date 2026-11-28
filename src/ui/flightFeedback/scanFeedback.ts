import { visualNoticeTiming } from "../../data/noticeTiming.ts";
import type { ScanOutcome, ScanQuestIdentity } from "../../model/scanOutcomes.ts";
import { chipGlyph } from "../map/index.ts";

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
  readonly content: ScanFeedbackContent;
  readonly opacity: number;
}

export interface ScanFeedbackContext {
  /** Covered includes paused, dialog, settings, unavailable renderer and loading states. */
  readonly covered: boolean;
  /** Repeated refreshes in one scene frame do not advance the timer. */
  readonly time?: number;
}

interface Pending {
  readonly content: ScanFeedbackContent;
  readonly timing: ReturnType<typeof visualNoticeTiming>;
  elapsed: number;
  sampledAt?: number;
  sampledElapsed?: number;
}

/** Transient UI ownership begins after drain. Covered time never consumes receipts. */
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
        ...scanFeedbackContents(outcome).map((content) => ({
          content,
          elapsed: 0,
          timing: visualNoticeTiming(content.kind === "task" ? "reading" : "brief", content.text),
        })),
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
    const { fadeMs, holdMs } = next.timing;
    const duration = holdMs + fadeMs;
    if (elapsed >= duration) {
      this.pending.shift();
      return this.frame(context, 0);
    }
    const opacity = Math.max(0, 1 - Math.max(0, elapsed - holdMs) / fadeMs);
    if (context.time !== undefined) {
      next.sampledAt = context.time;
      next.sampledElapsed = elapsed;
    }
    if (!sameTime && Number.isFinite(milliseconds) && milliseconds > 0) {
      next.elapsed += milliseconds;
    }
    return { content: next.content, opacity };
  }
}
