import { offersInstall } from "@andornaut/game-kit/web/pwa/installState";
import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { InstallOutcome, InstallState, InstallStepsKind } from "../pwa/index.ts";
import { type InstallPort, startInstall, watchInstallRow } from "./installRow.ts";

const KINDS = Object.keys(CONTENT.installSteps) as InstallStepsKind[];

function port(
  state: InstallState,
  outcome: InstallOutcome = "accepted",
  kind: InstallStepsKind = "other",
) {
  let listener: ((state: InstallState) => void) | undefined;
  const unsubscribe = vi.fn(() => {
    listener = undefined;
  });
  const fake: InstallPort = {
    install: vi.fn(() => Promise.resolve(outcome)),
    offers: offersInstall,
    onChange: (next) => {
      listener = next;
      return unsubscribe;
    },
    state: () => state,
    stepsKind: () => kind,
  };
  return { change: (next: InstallState) => listener?.(next), fake, unsubscribe };
}

describe("Settings Install row", () => {
  it.each([
    ["prompt", true],
    ["steps", true],
    ["installed", false],
  ] as const)("shows for install state %s: %s", (state, shown) => {
    const show = vi.fn();
    watchInstallRow(port(state).fake, show);
    expect(show).toHaveBeenCalledWith(shown);
  });

  it("follows install-state changes until it unsubscribes", () => {
    const { change, fake, unsubscribe } = port("prompt");
    const show = vi.fn();
    const stop = watchInstallRow(fake, show);
    change("installed");
    expect(show.mock.calls).toEqual([[true], [false]]);
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    change("prompt");
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("asks for the install prompt synchronously within the tap", () => {
    const { fake } = port("prompt");
    void startInstall(fake, vi.fn(), () => true);
    expect(fake.install).toHaveBeenCalledTimes(1);
  });

  it.each(KINDS)("opens %s's steps on a steps outcome", async (kind) => {
    const openSteps = vi.fn();
    await startInstall(port("steps", "steps", kind).fake, openSteps, () => true);
    expect(openSteps).toHaveBeenCalledWith(kind);
  });

  it("opens no steps after a prompt or once Settings closed", async () => {
    const openSteps = vi.fn();
    await startInstall(port("prompt", "accepted", "ios").fake, openSteps, () => true);
    await startInstall(port("prompt", "dismissed", "ios").fake, openSteps, () => true);
    await startInstall(port("steps", "steps", "ios").fake, openSteps, () => false);
    expect(openSteps).not.toHaveBeenCalled();
  });
});

describe("install steps words", () => {
  it("cover every browser kind with Gameplay's title and steps", () => {
    expect(KINDS.sort()).toEqual([
      "chromiumAndroid",
      "chromiumDesktop",
      "firefoxAndroid",
      "firefoxDesktop",
      "ios",
      "other",
      "safariMac",
      "samsungInternet",
    ]);
    expect(CONTENT.installSteps.ios).toEqual({
      steps: "Tap Share, then Add to Home Screen.",
      title: "Add to Home Screen",
    });
    expect(CONTENT.installSteps.safariMac).toEqual({
      steps: "Choose File, then Add to Dock.",
      title: "Add to Dock",
    });
    expect(CONTENT.installSteps.chromiumDesktop).toEqual({
      steps: "Choose Install in the address bar or the browser menu.",
      title: "Install app",
    });
    expect(CONTENT.installSteps.firefoxDesktop).toEqual({
      steps: "Firefox can't install this game. Open it in Chrome or Edge to install.",
      title: "Not available in Firefox",
    });
    expect(CONTENT.installSteps.other).toEqual({
      steps: "Use your browser's menu to install it or add it to your home screen.",
      title: "Install",
    });
  });
});
