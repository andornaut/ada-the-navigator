import { describe, expect, it, vi } from "vitest";

import type { InstallOutcome, InstallState, MenuInstallBrowser } from "../pwa/index.ts";
import { type InstallPort, startInstall, watchInstallRow } from "./install-row.ts";

function port(
  state: InstallState,
  outcome: InstallOutcome = "accepted",
  browser?: MenuInstallBrowser,
) {
  let listener: ((state: InstallState) => void) | undefined;
  const unsubscribe = vi.fn(() => {
    listener = undefined;
  });
  const fake: InstallPort = {
    install: vi.fn(() => Promise.resolve(outcome)),
    menuBrowser: () => browser,
    offers: (current) => current === "prompt" || current === "menuSteps",
    onChange: (next) => {
      listener = next;
      return unsubscribe;
    },
    state: () => state,
  };
  return { change: (next: InstallState) => listener?.(next), fake, unsubscribe };
}

describe("Settings Install row", () => {
  it.each([
    ["prompt", true],
    ["menuSteps", true],
    ["installed", false],
    ["unsupported", false],
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

  it.each(["ios", "firefoxAndroid"] as const)(
    "opens %s menu steps on a menuSteps outcome",
    async (browser) => {
      const openSteps = vi.fn();
      await startInstall(port("menuSteps", "menuSteps", browser).fake, openSteps, () => true);
      expect(openSteps).toHaveBeenCalledWith(browser);
    },
  );

  it("opens no steps after a prompt, without a menu browser or once Settings closed", async () => {
    const openSteps = vi.fn();
    await startInstall(port("prompt", "accepted", "ios").fake, openSteps, () => true);
    await startInstall(port("menuSteps", "menuSteps").fake, openSteps, () => true);
    await startInstall(port("menuSteps", "menuSteps", "ios").fake, openSteps, () => false);
    expect(openSteps).not.toHaveBeenCalled();
  });
});
