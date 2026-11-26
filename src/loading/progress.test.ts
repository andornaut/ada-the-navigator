import type { ProgressSnapshot } from "@andornaut/game-kit/runtime/progressState";
import { describe, expect, it, vi } from "vitest";

import {
  installProgress,
  launchProgress,
  launchProgressReport,
  loadingProgress,
  reportBoot,
  requiredUpdateActivity,
  subscribeLoadingProgress,
  updateProgressActivity,
  waitedProgress,
} from "./progress.ts";

const record = (source: {
  subscribe(listener: (snapshot: ProgressSnapshot) => void): () => void;
}) => {
  const snapshots: ProgressSnapshot[] = [];
  const stop = source.subscribe((snapshot) => snapshots.push(snapshot));
  return { last: () => snapshots.at(-1)!, snapshots, stop };
};

describe("the launch's progress", () => {
  it("fills one determinate value over the first install and boot, then ends at ready", () => {
    const bar = record(launchProgress);
    const snapshots: ProgressSnapshot[] = [];
    const stop = subscribeLoadingProgress(
      { clearTimeout: vi.fn(), setTimeout: vi.fn(() => 0) },
      { fadeMs: 150, fullMs: 250 },
      (snapshot) => snapshots.push(snapshot),
    );
    updateProgressActivity({ phase: "booting", version: "b" });
    expect(snapshots.at(-1)).toEqual({ active: true, value: undefined });
    const report = (phase: "installing" | "booting" | "ready", value: number) =>
      launchProgressReport({ phase, receivedBytes: 0, totalBytes: 100, value });
    report("installing", 0.25);
    expect(bar.last()).toEqual({ active: true, value: 0.25 });
    report("booting", 0.9);
    updateProgressActivity({ counts: { done: 9, total: 10 }, phase: "booting", version: "b" });
    expect(snapshots.at(-1)).toEqual({ active: true, value: 0.9 });
    expect(bar.last()).toEqual({ active: true, value: 0.9 });
    report("ready", 1);
    expect(bar.snapshots.at(-2)).toEqual({ active: true, value: 1 });
    expect(bar.last()).toEqual({ active: false, value: undefined });
    updateProgressActivity({ phase: "applied", version: "b" });
    expect(snapshots.at(-1)).toEqual({ active: false, value: undefined });
    const background = record(installProgress);
    expect(background.last().active).toBe(false);
    background.stop();
    bar.stop();
    stop();
  });

  it("tells the boot listener each settled share of the waited loads", () => {
    const boot = vi.fn();
    reportBoot(boot);
    const loads = record(loadingProgress);
    const handle = waitedProgress.begin();
    handle.progress(undefined);
    handle.progress(0.5);
    expect(loads.last()).toEqual({ active: true, value: 0.5 });
    handle.progress(1);
    handle.finish();
    expect(boot.mock.calls).toEqual([[0.5], [1]]);
    expect(loads.last().active).toBe(false);
    reportBoot(undefined);
    loads.stop();
  });
});

describe("the loading bar's background layer", () => {
  it("shows preparation and verification as pending and measures only transferred bytes", () => {
    const bar = record(installProgress);
    const pending = { active: true, value: undefined };
    const version = "b";
    updateProgressActivity({ phase: "preparing", version });
    expect(bar.last()).toEqual(pending);
    updateProgressActivity({ phase: "transferring", receivedBytes: 20, totalBytes: 100, version });
    expect(bar.last()).toEqual({ active: true, value: 0.2 });
    updateProgressActivity({ phase: "transferring", receivedBytes: 60, totalBytes: 100, version });
    expect(bar.last()).toEqual({ active: true, value: 0.6 });
    updateProgressActivity({ phase: "verifying", version });
    expect(bar.last()).toEqual(pending);
    updateProgressActivity({ phase: "ready", version });
    expect(bar.last()).toEqual({ active: false, value: undefined });
    bar.stop();
  });

  it("keeps the shared bar pending between the final byte and verified readiness", () => {
    const timer = { clearTimeout: vi.fn(), setTimeout: vi.fn(() => 0) };
    const snapshots: ProgressSnapshot[] = [];
    const stop = subscribeLoadingProgress(timer, { fadeMs: 150, fullMs: 250 }, (snapshot) =>
      snapshots.push(snapshot),
    );
    const version = "b";
    const transfer = (receivedBytes: number) =>
      updateProgressActivity({ phase: "transferring", receivedBytes, totalBytes: 100, version });
    const pending = { active: true, value: undefined };
    try {
      transfer(99);
      expect(snapshots.at(-1)).toEqual({ active: true, value: 0.99 });
      transfer(100);
      expect(snapshots.at(-1)).toEqual(pending);
      transfer(101);
      expect(snapshots.at(-1)).toEqual(pending);
      updateProgressActivity({ phase: "verifying", version });
      expect(snapshots.at(-1)).toEqual(pending);
      expect(snapshots).not.toContainEqual({ active: true, value: 1 });
      expect(timer.setTimeout).not.toHaveBeenCalled();
      updateProgressActivity({ phase: "ready", version });
      expect(snapshots.at(-1)).toEqual({ active: false, value: undefined });
      expect(timer.setTimeout).not.toHaveBeenCalled();
    } finally {
      updateProgressActivity({ phase: "idle" });
      stop();
    }
  });

  it.each([{ phase: "failed", version: "b" }, { phase: "idle" }] as const)(
    "clears a partial transfer on $phase without showing completion",
    (terminal) => {
      const timer = { clearTimeout: vi.fn(), setTimeout: vi.fn(() => 0) };
      const snapshots: ProgressSnapshot[] = [];
      const stop = subscribeLoadingProgress(timer, { fadeMs: 150, fullMs: 250 }, (snapshot) =>
        snapshots.push(snapshot),
      );
      try {
        updateProgressActivity({
          phase: "transferring",
          receivedBytes: 45,
          totalBytes: 100,
          version: "b",
        });
        expect(snapshots.at(-1)).toEqual({ active: true, value: 0.45 });
        updateProgressActivity(terminal);
        expect(snapshots.slice(-2)).toEqual([
          { active: true, value: undefined },
          { active: false, value: undefined },
        ]);
        expect(timer.setTimeout).not.toHaveBeenCalled();
      } finally {
        stop();
      }
    },
  );

  it("keeps staging, apply, and the required-save wait independent", () => {
    const bar = record(installProgress);
    const pending = { active: true, value: undefined };
    updateProgressActivity({
      phase: "transferring",
      receivedBytes: 50,
      totalBytes: 100,
      version: "b",
    });
    requiredUpdateActivity("updating");
    expect(bar.last()).toEqual(pending);
    updateProgressActivity({ phase: "ready", version: "b" });
    expect(bar.last()).toEqual(pending);
    updateProgressActivity({ phase: "applying", step: "save", version: "b" });
    requiredUpdateActivity("unavailable");
    updateProgressActivity({ phase: "preparing", version: "c" });
    updateProgressActivity({ phase: "failed", version: "c" });
    expect(bar.last()).toEqual(pending);
    requiredUpdateActivity("updating");
    updateProgressActivity({ phase: "applyFailed", version: "b" });
    expect(bar.last()).toEqual(pending);
    requiredUpdateActivity("unavailable");
    expect(bar.last().active).toBe(false);
    bar.stop();
  });

  it("preempts background staging with a waited load and resumes its latest measurement", () => {
    const timer = { clearTimeout: vi.fn(), setTimeout: vi.fn(() => 0) };
    const snapshots: ProgressSnapshot[] = [];
    const stop = subscribeLoadingProgress(timer, { fadeMs: 0, fullMs: 0 }, (snapshot) =>
      snapshots.push(snapshot),
    );
    updateProgressActivity({
      phase: "transferring",
      receivedBytes: 50,
      totalBytes: 100,
      version: "b",
    });
    expect(snapshots.at(-1)).toEqual({ active: true, value: 0.5 });
    const load = loadingProgress.begin();
    try {
      updateProgressActivity({
        phase: "transferring",
        receivedBytes: 90,
        totalBytes: 100,
        version: "b",
      });
      expect(snapshots.at(-1)).toEqual({ active: true, value: undefined });
      load.progress(0.4);
      expect(snapshots.at(-1)).toEqual({ active: true, value: 0.4 });
      load.progress(undefined);
      load.finish();
      expect(snapshots.at(-1)).toEqual({ active: true, value: 0.9 });
    } finally {
      load.finish();
      updateProgressActivity({ phase: "idle" });
      stop();
    }
  });
});
