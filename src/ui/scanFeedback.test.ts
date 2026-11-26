import { describe, expect, it } from "vitest";

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
const context: ScanFeedbackContext = { covered: false };
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
    expect(queue.frame(context, 0)).toMatchObject({ opacity: 1 });
    expect(outcome).toEqual(receipt());
  });
  it("holds for two seconds and fades in place over half a second", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt()]);
    const first = queue.frame(context, 1999)!;
    expect(queue.frame(context, 1)).toEqual(first);
    expect(queue.frame(context, 250)).toEqual(first);
    expect(queue.frame(context, 250)).toEqual({ ...first, opacity: 0.5 });
    expect(queue.frame(context, 0)).toBeNull();
    expect(queue.length).toBe(0);
  });
  it("does not advance on repeated native refreshes at the same scene time", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt()]);
    queue.frame({ ...context, time: 0 }, 2000);
    const frame = queue.frame({ ...context, time: 16 }, 16)!;
    expect(queue.frame({ ...context, time: 16 }, 0)).toEqual(frame);
    const next = queue.frame({ ...context, time: 32 }, 16)!;
    expect(next.opacity).toBeLessThan(frame.opacity);
    expect(next.content).toBe(frame.content);
    expect(queue.frame({ ...context, time: 32 }, 0)).toEqual(next);
  });
  it("starts an actual new/loaded model presentation empty without reconstructing remembered completion", () => {
    const queue = new ScanFeedbackQueue();
    queue.enqueue([receipt([{ kind: "quest", quest }])]);
    queue.reset();
    expect(queue.frame(context, 0)).toBeNull();
    expect(queue.length).toBe(0);
  });
});
