import type { ProgressSnapshot } from "@andornaut/game-kit/runtime/progressState";
import { describe, expect, it } from "vitest";

import {
  installProgress,
  loadingProgress,
  offlineActivity,
  offlineDownloadProgress,
  requiredUpdateActivity,
  updateActivationActivity,
} from "./progress.ts";

describe("the loading bar's background layer", () => {
  it("travels while offline installation or a forced update runs, until both end", () => {
    const snapshots: ProgressSnapshot[] = [];
    const stop = installProgress.subscribe((snapshot) => snapshots.push(snapshot));
    const active = () => snapshots.at(-1)!.active;
    expect(active()).toBe(false);
    offlineActivity("precaching");
    expect(snapshots.at(-1)).toEqual({ active: true, value: undefined });
    requiredUpdateActivity("updating");
    offlineActivity("idle");
    // The forced update still downloads.
    expect(active()).toBe(true);
    requiredUpdateActivity("unavailable");
    expect(active()).toBe(false);
    offlineActivity("updating");
    expect(active()).toBe(true);
    requiredUpdateActivity("updating");
    requiredUpdateActivity("unavailable");
    // An unavailable forced update does not hide an offline installation still running.
    expect(active()).toBe(true);
    offlineActivity("idle");
    expect(active()).toBe(false);
    stop();
    // Never measured: work of unknown total travels.
    expect(snapshots.every(({ value }) => value === undefined)).toBe(true);
  });
});

it("keeps one pending session across repeated and changing offline activity reports", () => {
  const snapshots: ProgressSnapshot[] = [];
  const stop = installProgress.subscribe((snapshot) => snapshots.push(snapshot));
  offlineActivity("precaching");
  const pending = snapshots.length;
  offlineActivity("updating");
  offlineActivity("updating");
  expect(snapshots).toHaveLength(pending);
  expect(snapshots.at(-1)).toEqual({ active: true, value: undefined });
  offlineActivity("idle");
  expect(snapshots.at(-1)).toEqual({ active: false, value: undefined });
  const completed = snapshots.length;
  offlineActivity("idle");
  expect(snapshots).toHaveLength(completed);
  stop();
});

it("leaves measured foreground loading intact while an offline update begins and ends", () => {
  const snapshots: ProgressSnapshot[] = [];
  const stop = loadingProgress.subscribe((snapshot) => snapshots.push(snapshot));
  const load = loadingProgress.begin();
  load.progress(0.4);
  offlineActivity("updating");
  expect(snapshots.at(-1)).toEqual({ active: true, value: 0.4 });
  offlineActivity("idle");
  expect(snapshots.at(-1)).toEqual({ active: true, value: 0.4 });
  load.finish();
  stop();
});

it("uses measured worker progress on the existing background handle and leaves other work pending", () => {
  const snapshots: ProgressSnapshot[] = [];
  const stop = installProgress.subscribe((snapshot) => snapshots.push(snapshot));
  const report = (phase: "checking" | "downloading" | "verifying" | "complete", value?: number) =>
    offlineDownloadProgress({ operationId: "measured-worker", phase, value, version: "build-one" });
  report("checking");
  expect(snapshots.at(-1)!.active).toBe(false);
  offlineActivity("precaching");
  report("downloading", 0.4);
  expect(snapshots.at(-1)).toEqual({ active: true, value: 0.4 });
  report("verifying");
  expect(snapshots.at(-1)).toEqual({ active: true, value: undefined });
  report("complete", 1);
  expect(snapshots.at(-1)).toEqual({ active: true, value: 1 });
  updateActivationActivity(true);
  offlineActivity("idle");
  expect(snapshots.at(-1)).toEqual({ active: true, value: undefined });
  updateActivationActivity(false);
  expect(snapshots.at(-1)!.active).toBe(false);
  stop();
});

it("ignores retired operations and mismatched versions without completing a newer wait", () => {
  const snapshots: ProgressSnapshot[] = [];
  const stop = installProgress.subscribe((snapshot) => snapshots.push(snapshot));
  offlineActivity("updating");
  const report = (
    operationId: string,
    version: string,
    value: number,
    phase: "downloading" | "complete" = "downloading",
  ) => offlineDownloadProgress({ operationId, phase, value, version });
  report("stale-worker", "old", 0.2);
  report("new-worker", "new", 0.3);
  report("stale-worker", "old", 1, "complete");
  report("new-worker", "wrong", 0.9);
  expect(snapshots.at(-1)).toEqual({ active: true, value: 0.3 });
  report("new-worker", "new", 0.6);
  expect(snapshots.at(-1)).toEqual({ active: true, value: 0.6 });
  offlineActivity("idle");
  requiredUpdateActivity("updating");
  report("new-worker", "new", 1, "complete");
  expect(snapshots.at(-1)).toEqual({ active: true, value: undefined });
  requiredUpdateActivity("unavailable");
  stop();
});

it("keeps galaxy transactions separate from root installation and required-update handles", async () => {
  const { galaxyProgress } = await import("./progress.ts");
  const root: ProgressSnapshot[] = [],
    group: ProgressSnapshot[] = [];
  const stopRoot = installProgress.subscribe((value) => root.push(value));
  const stopGroup = galaxyProgress.subscribe((value) => group.push(value));
  offlineActivity("precaching");
  const handle = galaxyProgress.begin();
  handle.progress(0.75);
  const rootCount = root.length;
  handle.finish();
  expect(root).toHaveLength(rootCount);
  expect(root.at(-1)!.active).toBe(true);
  expect(group.at(-1)!.active).toBe(false);
  offlineActivity("idle");
  stopRoot();
  stopGroup();
});
