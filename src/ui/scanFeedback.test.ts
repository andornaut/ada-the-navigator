import { describe, expect, it, vi } from "vitest";

import { immutableScanOutcome, type ScanOutcome } from "../model/scanOutcomes.ts";
import { NOTICE_TIMING } from "./itemNotice.ts";
import {
  scanFeedbackContents,
  type ScanFeedbackContext,
  scanFeedbackParts,
  ScanFeedbackQueue,
} from "./scanFeedback.ts";
const quest = {
  icon: { jobType: "survey" as const, symbol: "job" as const },
  id: "job:1:receipt",
  name: "Canonical quest name",
};
const receipt = (completions: ScanOutcome["completions"] = []): ScanOutcome =>
  immutableScanOutcome({
    completions,
    galaxy: 1,
    source: "scan",
    target: { id: "landmark:1", name: "Actual scanned target", symbol: "wreck" },
    targetId: "landmark:1",
  });
const context: ScanFeedbackContext = {
  area: { height: 360, width: 720, x: 0, y: 0 },
  blocked: () => [],
  covered: false,
  dialogue: () => [],
  hudRow: () => [],
  measure: () => ({ height: 40, width: 200 }),
  reducedMotion: false,
  resolveAnchor: () => ({ x: 360, y: 240 }),
};
describe("authoritative scan presentation receipts", () => {
  it("uses only the scanned target identity for a neutral scan", () => {
    expect(scanFeedbackContents(receipt())).toMatchObject([
      { checkbox: false, glyph: "map-wreck", kind: "scan", text: "Actual scanned target" },
    ]);
  });
  it("shows a full Survey quest's icon and name without a task or checkbox", () => {
    const outcome = receipt([{ kind: "quest", quest }]);
    expect(scanFeedbackContents(outcome)).toEqual([
      {
        checkbox: false,
        glyph: "map-job-survey",
        kind: "quest",
        outcome,
        questId: quest.id,
        text: quest.name,
      },
    ]);
  });
  it("formats a supplied task receipt using its actual text and parent quest icon", () => {
    const outcome = receipt([
      {
        kind: "task",
        quest,
        task: { id: "provided-task", text: "Authoritative completed task text" },
      },
    ]);
    expect(scanFeedbackContents(outcome)).toMatchObject([
      {
        checkbox: true,
        glyph: "map-job-survey",
        kind: "task",
        text: "Authoritative completed task text",
      },
    ]);
    expect(outcome.completions[0]?.kind).toBe("task");
  });
  it("orders task checkbox/text/quest icon and full quest icon/name without a checkbox", () => {
    const task = scanFeedbackContents(
      receipt([{ kind: "task", quest, task: { id: "provided-task", text: "Actual task text" } }]),
    )[0]!;
    expect(scanFeedbackParts(task).map(({ kind }) => kind)).toEqual([
      "checkbox",
      "text",
      "quest-icon",
    ]);
    const full = scanFeedbackContents(receipt([{ kind: "quest", quest }]))[0]!;
    expect(scanFeedbackParts(full).map(({ kind }) => kind)).toEqual(["quest-icon", "text"]);
  });
  it("retains drained receipts while paused or covered and deduplicates the same frozen receipt", () => {
    const queue = new ScanFeedbackQueue(),
      outcome = receipt();
    queue.enqueue([outcome]);
    queue.enqueue([outcome]);
    expect(queue.length).toBe(1);
    expect(queue.frame({ ...context, covered: true }, 100000)).toBeNull();
    expect(queue.length).toBe(1);
    expect(queue.frame(context, 0)).toMatchObject({ opacity: 1, rect: { y: 220 } });
    expect(outcome).toEqual(receipt());
  });
  it("retains receipts when projection or safe placement is temporarily unavailable", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt()]);
    expect(queue.frame({ ...context, resolveAnchor: () => undefined }, 100000)).toBeNull();
    expect(queue.frame({ ...context, blocked: () => [context.area] }, 100000)).toBeNull();
    expect(queue.frame(context, 0)?.opacity).toBe(1);
  });
  it("rises normally, fades in place under reduced motion, and only consumes displayed entries", () => {
    const normal = new ScanFeedbackQueue();
    normal.enqueue([receipt()]);
    normal.frame(context, NOTICE_TIMING.holdMs / 2);
    expect(normal.frame(context, 0)!.rect.y).toBeLessThan(220);
    const reduced = new ScanFeedbackQueue();
    reduced.enqueue([receipt()]);
    reduced.frame(
      { ...context, reducedMotion: true },
      NOTICE_TIMING.holdMs + NOTICE_TIMING.reducedFadeMs / 2,
    );
    expect(reduced.frame({ ...context, reducedMotion: true }, 0)).toMatchObject({
      opacity: 0.5,
      rect: { y: 220 },
    });
    reduced.frame({ ...context, reducedMotion: true }, NOTICE_TIMING.reducedFadeMs);
    expect(reduced.frame({ ...context, reducedMotion: true }, 0)).toBeNull();
    expect(reduced.length).toBe(0);
  });
  it("retains one canonical anchor and vertical path as dialogue footprints and projection change", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt()]);
    const first = queue.frame(context, 100)!;
    const changed = {
      ...context,
      blocked: () => [{ height: 140, width: 400, x: 160, y: 100 }],
      resolveAnchor: () => ({ x: 500, y: 300 }),
    };
    const second = queue.frame(changed, 100)!;
    const third = queue.frame(context, 0)!;
    expect(second.anchor).toEqual(first.anchor);
    expect(second.rect.x).toBe(first.rect.x);
    expect(third.rect.x).toBe(first.rect.x);
    expect(second.rect.y).toBeLessThan(first.rect.y);
    expect(third.rect.y).toBeLessThan(second.rect.y);
    const reference = new ScanFeedbackQueue();
    reference.enqueue([receipt()]);
    reference.frame(context, 200);
    expect(third.rect).toEqual(reference.frame(context, 0)!.rect);
  });
  it("only rises: a conversation box shown after the receipt passed it never pushes it down", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt()]);
    const dialogue = [{ height: 60, width: 480, x: 120, y: 66 }];
    const start = queue.frame(context, NOTICE_TIMING.holdMs)!;
    expect(start.rect.y).toBe(220);
    const top = queue.frame(context, 0)!;
    expect(top.rect.y).toBe(0);
    expect(queue.frame({ ...context, dialogue: () => dialogue }, 0)!.rect.y).toBe(0);
    const stopped = new ScanFeedbackQueue();
    stopped.enqueue([receipt()]);
    stopped.frame(context, NOTICE_TIMING.holdMs);
    expect(stopped.frame({ ...context, dialogue: () => dialogue }, 0)!.rect.y).toBe(134);
  });
  it("rises on from where it is when the conversation box goes mid-rise, without a hop", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt()]);
    const dialogue = [{ height: 60, width: 480, x: 120, y: 66 }];
    expect(
      queue.frame({ ...context, dialogue: () => dialogue }, NOTICE_TIMING.holdMs / 2)!.rect.y,
    ).toBe(220);
    const held = queue.frame({ ...context, dialogue: () => dialogue }, 0)!.rect.y;
    expect(held).toBeGreaterThan(134);
    expect(held).toBeLessThan(220);
    expect(queue.frame(context, 0)!.rect.y).toBeCloseTo(held);
    queue.frame(context, NOTICE_TIMING.holdMs / 2);
    expect(queue.frame(context, 0)!.rect.y).toBe(0);
  });
  it("does not advance on repeated native refreshes at the same scene time", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt()]);
    queue.frame({ ...context, time: 0 }, 0);
    const frame = queue.frame({ ...context, time: 16 }, 16)!;
    expect(queue.frame({ ...context, time: 16 }, 0)).toEqual(frame);
    const next = queue.frame({ ...context, time: 32 }, 16)!;
    expect(next.rect.y).toBeLessThan(frame.rect.y);
    expect(queue.frame({ ...context, time: 32 }, 0)).toEqual(next);
  });
  it("keeps the retained receipt inside a resized viewport", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt()]);
    queue.frame(context, 100);
    const frame = queue.frame({ ...context, area: { height: 240, width: 300, x: 0, y: 0 } }, 0)!;
    expect(frame.rect.x).toBeGreaterThanOrEqual(0);
    expect(frame.rect.x + frame.rect.width).toBeLessThanOrEqual(300);
    expect(frame.rect.y).toBeGreaterThanOrEqual(0);
    expect(frame.rect.y + frame.rect.height).toBeLessThanOrEqual(240);
  });
  it("measures no footprint while nothing shows, the HUD once per placement, dialogue per frame", () => {
    const readers = {
      blocked: vi.fn(() => []),
      dialogue: vi.fn(() => []),
      hudRow: vi.fn(() => []),
    };
    const measured = { ...context, ...readers };
    const queue = new ScanFeedbackQueue();
    expect(queue.frame(measured, 16)).toBeNull();
    queue.enqueue([receipt()]);
    expect(queue.frame({ ...measured, covered: true }, 16)).toBeNull();
    expect(readers.blocked).not.toHaveBeenCalled();
    expect(readers.dialogue).not.toHaveBeenCalled();
    expect(readers.hudRow).not.toHaveBeenCalled();
    queue.frame(measured, 16);
    queue.frame(measured, 16);
    expect(readers.blocked).toHaveBeenCalledOnce();
    expect(readers.hudRow).toHaveBeenCalledOnce();
    expect(readers.dialogue).toHaveBeenCalledTimes(2);
  });
  it("starts an actual new/loaded model presentation empty without reconstructing remembered completion", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt([{ kind: "quest", quest }])]);
    queue.reset();
    expect(queue.frame(context, 0)).toBeNull();
    expect(queue.length).toBe(0);
  });
});
