import type { LoadingAttemptState } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { createProgressState } from "@andornaut/game-kit/runtime/progressState";
import type { AssetGroupsResult } from "@andornaut/game-kit/runtime/web/pwa/assetGroups";
import { expect, it, vi } from "vitest";

import { createGalaxyDownloads } from "./galaxyAssetGroups.ts";

async function settle() {
  for (let n = 0; n < 4; n++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}
function fixture() {
  const requests: string[][] = [];
  const states: LoadingAttemptState[] = [];
  const ports: MessagePort[] = [];
  let available: string[] = ["sunflower", "whirlpool"];
  let result: AssetGroupsResult | undefined;
  let ensureResult: AssetGroupsResult | undefined;
  let hold = false;
  const progress = createProgressState(),
    snapshots: { active: boolean; value: number | undefined }[] = [];
  const stop = progress.subscribe((value) => snapshots.push(value));
  const worker = {
    postMessage(message: { groups: readonly string[] }, transfer: Transferable[]) {
      requests.push([...message.groups]);
      const port = transfer[0] as MessagePort;
      ports.push(port);
      port.postMessage({
        progress: {
          operationId: `operation-${requests.length}`,
          phase: "checking",
          value: undefined,
          version: "document-version",
        },
        type: "progress",
      });
      if (hold) {
        return;
      }
      if (message.groups.length && result === undefined && ensureResult === undefined) {
        available = [...new Set([...available, ...message.groups])];
      }
      port.postMessage({
        result: (message.groups.length ? ensureResult : undefined) ??
          result ?? {
            readyGroups: available,
            status: "available",
            version: "document-version",
          },
        type: "result",
      });
    },
  };
  const container = Object.assign(new EventTarget(), {
    controller: worker,
    getRegistration: vi.fn(async () => ({ active: worker })),
  });
  const eventTarget = new EventTarget(),
    visibilitySource = Object.assign(new EventTarget(), {
      visibilityState: "visible" as DocumentVisibilityState,
    });
  const groups = createGalaxyDownloads({
    buildId: "1".repeat(40),
    container,
    eventTarget,
    onState: (state) => states.push(state),
    progress,
    requestTimeoutMs: 1000,
    visibilitySource,
  });
  return {
    container,
    eventTarget,
    groups,
    ports,
    progress,
    requests,
    setEnsureResult: (next: AssetGroupsResult | undefined) => {
      ensureResult = next;
    },
    setHold: (next: boolean) => {
      hold = next;
    },
    setResult: (next: AssetGroupsResult | undefined) => {
      result = next;
    },
    snapshots,
    states,
    stop,
    visibilitySource,
  };
}
it("starts only after prepared entry and stages the durable restored route through one ahead", async () => {
  const f = fixture();
  f.groups.setUnlocked([1, 3]);
  await f.groups.resume();
  expect(f.requests).toEqual([]);
  await f.groups.start();
  expect(f.requests).toEqual([[], ["needle", "sunflower", "whirlpool"]]);
  f.groups.setUnlocked([3, 1]);
  await settle();
  expect(f.requests).toHaveLength(2);
  f.groups.setUnlocked([1, 3, 4]);
  await settle();
  expect(f.requests.at(-1)).toEqual(["andromeda", "needle", "sunflower", "whirlpool"]);
  f.groups.dispose();
  f.stop();
});
it("reads durable state again on resume and retries failure without inferring successful settlement", async () => {
  const f = fixture();
  f.setResult({ reason: "offline", status: "unavailable" });
  f.groups.setUnlocked([1, 3]);
  await f.groups.start();
  expect(f.requests).toEqual([[]]);
  f.setResult(undefined);
  f.eventTarget.dispatchEvent(new Event("online"));
  await settle();
  expect(f.requests).toEqual([[], [], ["needle", "sunflower", "whirlpool"]]);
  f.eventTarget.dispatchEvent(Object.assign(new Event("pagehide"), { persisted: true }));
  f.eventTarget.dispatchEvent(new Event("pageshow"));
  await settle();
  expect(f.requests.at(-1)).toEqual([]);
  f.groups.dispose();
  f.stop();
});
it("owns only its operation handle and ignores another fingerprint and disposed late progress", async () => {
  const f = fixture(),
    rootProgress = createProgressState(),
    rootSnapshots: { active: boolean; value: number | undefined }[] = [];
  const rootStop = rootProgress.subscribe((value) => rootSnapshots.push(value));
  const root = rootProgress.begin();
  root.progress(0.6);
  f.setHold(true);
  const pending = f.groups.start();
  await settle();
  const port = f.ports[0]!;
  port.postMessage({
    progress: {
      operationId: "operation-1",
      phase: "downloading",
      value: 0.4,
      version: "document-version",
    },
    type: "progress",
  });
  await settle();
  const measured = f.snapshots.at(-1)!;
  expect(measured.active).toBe(true);
  expect(measured.value).toBeDefined();
  const count = f.snapshots.length;
  port.postMessage({
    progress: { operationId: "unrelated", phase: "complete", value: 1, version: "other-version" },
    type: "progress",
  });
  await settle();
  expect(f.snapshots).toHaveLength(count);
  f.groups.dispose();
  await pending;
  expect(rootSnapshots.at(-1)).toEqual({ active: true, value: 0.6 });
  f.eventTarget.dispatchEvent(new Event("online"));
  f.container.dispatchEvent(new Event("controllerchange"));
  await settle();
  expect(f.requests).toHaveLength(1);
  root.finish();
  rootStop();
  f.stop();
});
it("coalesces durable signature changes while keeping one published client", async () => {
  const f = fixture();
  f.setHold(true);
  const pending = f.groups.start();
  await settle();
  f.groups.setUnlocked([1, 3]);
  f.groups.setUnlocked([1, 3, 4]);
  f.setHold(false);
  f.ports[0]!.postMessage({
    result: {
      readyGroups: ["sunflower", "whirlpool"],
      status: "available",
      version: "document-version",
    },
    type: "result",
  });
  await pending;
  expect(f.requests.filter((ids) => ids.length)).toEqual([
    ["andromeda", "needle", "sunflower", "whirlpool"],
  ]);
  f.groups.dispose();
  f.groups.dispose();
  f.stop();
});

it("retries a failed ensure from actual durable state rather than treating settlement as readiness", async () => {
  const f = fixture();
  f.setEnsureResult({ reason: "failed", status: "unavailable" });
  f.groups.setUnlocked([1, 3]);
  await f.groups.start();
  expect(f.requests.filter((ids) => ids.length)).toHaveLength(1);
  expect(f.states.map(({ kind }) => kind)).toEqual(["loading", "failed"]);
  expect(f.snapshots.at(-1)?.active).toBe(false);
  f.setEnsureResult(undefined);
  await f.groups.resume();
  expect(f.requests.filter((ids) => ids.length)).toEqual([
    ["needle", "sunflower", "whirlpool"],
    ["needle", "sunflower", "whirlpool"],
  ]);
  expect(f.states.at(-1)?.kind).toBe("ready");
  await f.groups.resume();
  expect(f.requests.filter((ids) => ids.length)).toHaveLength(2);
  f.groups.dispose();
  f.stop();
});

it("shows an initial group-state timeout and clears it only after verified readiness", async () => {
  const f = fixture();
  f.setResult({ reason: "timeout", status: "unavailable" });
  await f.groups.start();
  expect(f.states.at(-1)).toMatchObject({
    error: { reason: "timeout", status: "unavailable" },
    kind: "failed",
  });
  expect(f.requests).toEqual([[]]);
  f.setResult(undefined);
  await f.groups.resume();
  expect(f.states.at(-1)?.kind).toBe("ready");
  expect(f.requests).toEqual([[], []]);
  f.groups.dispose();
  f.stop();
});
