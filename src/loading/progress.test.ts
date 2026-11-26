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
  updateActivationActivity,
  updateStateActivity,
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
    const report = (phase: "installing" | "booting" | "ready", value: number) =>
      launchProgressReport({ phase, receivedBytes: 0, totalBytes: 100, value });
    report("installing", 0.25);
    expect(bar.last()).toEqual({ active: true, value: 0.25 });
    report("booting", 0.9);
    expect(bar.last()).toEqual({ active: true, value: 0.9 });
    report("ready", 1);
    expect(bar.snapshots.at(-2)).toEqual({ active: true, value: 1 });
    expect(bar.last()).toEqual({ active: false, value: undefined });
    bar.stop();
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
  it("measures a staging update and hides once it is ready, failed or idle", () => {
    const bar = record(installProgress);
    updateStateActivity({ phase: "staging", value: 0.2, version: "b" });
    expect(bar.last()).toEqual({ active: true, value: 0.2 });
    updateStateActivity({ phase: "staging", value: 0.6, version: "b" });
    expect(bar.last()).toEqual({ active: true, value: 0.6 });
    updateStateActivity({ phase: "ready", version: "b" });
    expect(bar.last().active).toBe(false);
    updateStateActivity({ phase: "staging", value: 0.1, version: "c" });
    updateStateActivity({ phase: "failed", version: "c" });
    expect(bar.last().active).toBe(false);
    updateStateActivity({ phase: "idle" });
    expect(bar.last().active).toBe(false);
    bar.stop();
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
        updateStateActivity({ phase: "staging", value: 0.45, version: "b" });
        expect(snapshots.at(-1)).toEqual({ active: true, value: 0.45 });
        updateStateActivity(terminal);
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

  it("travels while Update now switches or a forced update runs, until every one ends", () => {
    const bar = record(installProgress);
    updateStateActivity({ phase: "staging", value: 0.5, version: "b" });
    requiredUpdateActivity("updating");
    // Two kinds of work at once have no single measure.
    expect(bar.last()).toEqual({ active: true, value: undefined });
    updateStateActivity({ phase: "ready", version: "b" });
    expect(bar.last().active).toBe(true);
    updateActivationActivity(true);
    requiredUpdateActivity("unavailable");
    expect(bar.last()).toEqual({ active: true, value: undefined });
    updateActivationActivity(false);
    expect(bar.last().active).toBe(false);
    bar.stop();
  });

  it("leaves measured foreground loading intact while an update stages", () => {
    const loads = record(loadingProgress);
    const load = loadingProgress.begin();
    load.progress(0.4);
    updateStateActivity({ phase: "staging", value: 0.9, version: "b" });
    expect(loads.last()).toEqual({ active: true, value: 0.4 });
    updateStateActivity({ phase: "idle" });
    expect(loads.last()).toEqual({ active: true, value: 0.4 });
    load.finish();
    loads.stop();
  });
});
