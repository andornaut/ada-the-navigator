import { describe, expect, it, vi } from "vitest";

import { immutableScanOutcome, type ScanOutcome } from "../model/scanOutcomes.ts";
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
  measure: () => ({ height: 40, width: 200 }),
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
  it("holds for two seconds and fades in place over half a second", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt()]);
    const first = queue.frame(context, 1999)!.rect;
    expect(queue.frame(context, 1)).toMatchObject({ opacity: 1, rect: first });
    expect(queue.frame(context, 250)).toMatchObject({ opacity: 1, rect: first });
    expect(queue.frame(context, 250)).toMatchObject({ opacity: 0.5, rect: first });
    expect(queue.frame(context, 0)).toBeNull();
    expect(queue.length).toBe(0);
  });
  it("retains its position and anchor when existing dialogue, controls and projection change", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt()]);
    const first = queue.frame(context, 100)!;
    const dialogue = vi.fn(() => [{ height: 140, width: 400, x: 160, y: 100 }]);
    const blocked = vi.fn(() => [{ height: 40, width: 200, x: 260, y: 220 }]);
    const resolveAnchor = vi.fn(() => ({ x: 500, y: 300 }));
    expect(queue.frame({ ...context, blocked, dialogue, resolveAnchor }, 100)).toEqual(first);
    expect(dialogue).not.toHaveBeenCalled();
    expect(blocked).not.toHaveBeenCalled();
    expect(resolveAnchor).not.toHaveBeenCalled();
  });
  it("does not advance on repeated native refreshes at the same scene time", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt()]);
    queue.frame({ ...context, time: 0 }, 2000);
    const frame = queue.frame({ ...context, time: 16 }, 16)!;
    expect(queue.frame({ ...context, time: 16 }, 0)).toEqual(frame);
    const next = queue.frame({ ...context, time: 32 }, 16)!;
    expect(next.opacity).toBeLessThan(frame.opacity);
    expect(next.rect).toBe(frame.rect);
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
  it("measures no footprints while nothing shows and reads both sets once per placement", () => {
    const readers = {
      blocked: vi.fn(() => []),
      dialogue: vi.fn(() => []),
    };
    const measured = { ...context, ...readers };
    const queue = new ScanFeedbackQueue();
    expect(queue.frame(measured, 16)).toBeNull();
    queue.enqueue([receipt()]);
    expect(queue.frame({ ...measured, covered: true }, 16)).toBeNull();
    expect(readers.blocked).not.toHaveBeenCalled();
    expect(readers.dialogue).not.toHaveBeenCalled();
    queue.frame(measured, 16);
    queue.frame(measured, 16);
    expect(readers.blocked).toHaveBeenCalledOnce();
    expect(readers.dialogue).toHaveBeenCalledOnce();
  });
  it("starts an actual new/loaded model presentation empty without reconstructing remembered completion", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt([{ kind: "quest", quest }])]);
    queue.reset();
    expect(queue.frame(context, 0)).toBeNull();
    expect(queue.length).toBe(0);
  });
});
