import type { ProgressSnapshot } from "@andornaut/game-kit/progressState";
import { describe, expect, it } from "vitest";

import { installProgress, offlineActivity, requiredUpdateActivity } from "./progress.ts";

describe("the loading bar's background layer", () => {
  it("travels while the first visit precaches or a forced update downloads, until both end", () => {
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
    // An update that installs silently shows nothing; only the forced one does.
    offlineActivity("updating");
    expect(active()).toBe(false);
    requiredUpdateActivity("updating");
    expect(active()).toBe(true);
    requiredUpdateActivity("unavailable");
    stop();
    // Never measured: work of unknown total travels.
    expect(snapshots.every(({ value }) => value === undefined)).toBe(true);
  });
});
