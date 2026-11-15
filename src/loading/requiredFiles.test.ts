import {
  createLoadingAttempts,
  createRequiredLoading,
} from "@andornaut/game-kit/load/loadingAttempts";
import { expect, it, vi } from "vitest";

import { requiredSceneFile, requireSceneFiles } from "./requiredFiles.ts";

async function settle() {
  for (let n = 0; n < 30; n++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}
const failure = (key: string) => ({ key });
it("retries only failed required loader resources and never treats COMPLETE settlement as success", async () => {
  const required = createRequiredLoading();
  let failures = [failure("ui-move-hint"), failure("optional-world")];
  const retryFailures = vi.fn(async (select: (f: { readonly key: string }) => boolean) => {
    expect(failures.filter(select).map((f) => f.key)).toEqual(["ui-move-hint"]);
  });
  const entered = vi.fn();
  const watch = { failures: () => failures, retryFailures };
  const owner = createLoadingAttempts({
    load: (attempt) => requireSceneFiles(required, attempt, watch),
    onReady: entered,
    onState: () => {},
  });
  const pending = owner.start();
  await settle();
  expect(required.state.kind).toBe("failed");
  expect(entered).not.toHaveBeenCalled();
  await required.retry();
  expect(required.state.kind).toBe("failed");
  expect(entered).not.toHaveBeenCalled();
  retryFailures.mockImplementation(async (select) => {
    failures = failures.filter((f) => !select(f));
  });
  await required.retry();
  await pending;
  expect(entered).toHaveBeenCalledOnce();
  expect(retryFailures).toHaveBeenCalledTimes(2);
  expect(failures.map((f) => f.key)).toEqual(["optional-world"]);
  required.dispose();
  owner.dispose();
});
it("cancels an outstanding required file barrier and ignores a late retry result", async () => {
  const required = createRequiredLoading();
  let release!: () => void;
  let failures = [failure("ship")];
  const watch = {
    failures: () => failures,
    retryFailures: vi.fn(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      failures = [];
    }),
  };
  const entered = vi.fn();
  const owner = createLoadingAttempts({
    load: (attempt) => requireSceneFiles(required, attempt, watch),
    onReady: entered,
    onState: () => {},
  });
  const pending = owner.start();
  await settle();
  const retry = required.retry();
  await settle();
  owner.dispose();
  release();
  await retry;
  await pending;
  expect(entered).not.toHaveBeenCalled();
  expect(owner.state.kind).toBe("disposed");
  required.dispose();
});
it("classifies exact core/UI keys and default heading bounds without promoting optional assets", () => {
  for (const key of [
    "ship",
    "ship-0",
    "ship-63",
    "ship-materials",
    "ui-move-hint",
    "ui-move-knob",
  ]) {
    expect(requiredSceneFile({ key })).toBe(true);
  }
  for (const key of ["ship-64", "ship-thrust-0", "ship-blue-1", "ui-unknown", "enemy-turret"]) {
    expect(requiredSceneFile({ key })).toBe(false);
  }
});
