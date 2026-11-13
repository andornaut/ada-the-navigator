import type { ProgressSnapshot } from "@andornaut/game-kit/progressState";
import { describe, expect, it } from "vitest";

import {
  installProgress,
  loadingProgress,
  offlineActivity,
  requiredUpdateActivity,
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
