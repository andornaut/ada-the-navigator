import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const offline = vi.hoisted(() => {
  const play = { bootable: Promise.resolve(), flow: {}, registrationReady: vi.fn() };
  return {
    play,
    start: vi.fn((options: { activationPolicy?: string; serviceWorkerUrl: string }) => {
      void options;
      return play;
    }),
  };
});
vi.mock("@andornaut/game-kit/web/pwa/dom/offlinePlay", () => ({
  browserOfflinePage: () => ({}),
  startOfflinePlay: offline.start,
}));
vi.mock("@andornaut/game-kit/web/pwa/storagePersistence", () => ({
  requestPersistentStorage: vi.fn(() => Promise.resolve("unsupported")),
}));

interface Device {
  readonly app?: boolean;
  readonly maxTouchPoints?: number;
  readonly userAgent?: string;
}

const CHROME = "Mozilla/5.0 (X11; Linux x86_64) Chrome/142.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1";
const FIREFOX_ANDROID = "Mozilla/5.0 (Android 15; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0";

// The browser's window as the kit's install flow reads it.
function stubDevice({ app = false, maxTouchPoints = 0, userAgent = CHROME }: Device): EventTarget {
  const navigator = { maxTouchPoints, standalone: false, userAgent };
  const page = Object.assign(new EventTarget(), {
    matchMedia: () => ({ addEventListener: () => undefined, matches: app }),
    navigator,
  });
  vi.stubGlobal("window", page);
  vi.stubGlobal("navigator", navigator);
  return page;
}

// A beforeinstallprompt event whose prompt the player answers with outcome.
function installPrompt(outcome: "accepted" | "dismissed") {
  return Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome }),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("PROD", true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("offline play", () => {
  it("registers /sw.js with manual activation once a first visit's game shows", async () => {
    stubDevice({});
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const options = offline.start.mock.calls[0]![0];
    expect(options.activationPolicy).toBe("manual");
    expect(options.serviceWorkerUrl).toBe("/sw.js");
    expect(offline.play.registrationReady).not.toHaveBeenCalled();
    pwa.gameShown();
    expect(offline.play.registrationReady).toHaveBeenCalledOnce();
  });

  it("starts no service worker outside the production build", async () => {
    vi.stubEnv("PROD", false);
    stubDevice({});
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    pwa.gameShown();
    expect(offline.start).not.toHaveBeenCalled();
  });

  it.each([false, true])("asks for persistent storage as the installed app: %s", async (app) => {
    const { requestPersistentStorage } =
      await import("@andornaut/game-kit/web/pwa/storagePersistence");
    stubDevice({ app });
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    expect(vi.mocked(requestPersistentStorage)).toHaveBeenCalledExactlyOnceWith(app, undefined);
  });
});

describe("install offer", () => {
  it("offers the browser's prompt once it arrives, and is installed after acceptance", async () => {
    const page = stubDevice({});
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const states: string[] = [];
    pwa.onInstallStateChange((state) => states.push(state));
    expect(pwa.installState()).toBe("unsupported");
    expect(pwa.offersInstall(pwa.installState())).toBe(false);

    const prompt = installPrompt("accepted");
    page.dispatchEvent(prompt);
    expect(prompt.defaultPrevented).toBe(true);
    expect(pwa.installState()).toBe("prompt");
    expect(pwa.offersInstall(pwa.installState())).toBe(true);

    await expect(pwa.installApp()).resolves.toBe("accepted");
    expect(prompt.prompt).toHaveBeenCalledOnce();
    expect(pwa.installState()).toBe("installed");
    expect(states).toEqual(["prompt", "installed"]);
  });

  it("hides the offer after a dismissed prompt until the browser offers another", async () => {
    const page = stubDevice({});
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    page.dispatchEvent(installPrompt("dismissed"));
    await expect(pwa.installApp()).resolves.toBe("dismissed");
    expect(pwa.installState()).toBe("unsupported");
    await expect(pwa.installApp()).resolves.toBe("unavailable");
  });

  it("stops calling a listener once it unsubscribes", async () => {
    const page = stubDevice({});
    const pwa = await import("./index.ts");
    const listener = vi.fn();
    pwa.onInstallStateChange(listener)();
    page.dispatchEvent(installPrompt("accepted"));
    expect(listener).not.toHaveBeenCalled();
  });

  it.each([
    { browser: "ios", device: { maxTouchPoints: 5, userAgent: IPHONE } },
    { browser: "firefoxAndroid", device: { maxTouchPoints: 5, userAgent: FIREFOX_ANDROID } },
  ] as const)(
    "asks for $browser's menu steps where no prompt exists",
    async ({ browser, device }) => {
      stubDevice(device);
      const pwa = await import("./index.ts");
      pwa.setupPhoneApp();
      expect(pwa.installState()).toBe("menuSteps");
      expect(pwa.offersInstall(pwa.installState())).toBe(true);
      expect(pwa.menuBrowser()).toBe(browser);
      await expect(pwa.installApp()).resolves.toBe("menuSteps");
    },
  );

  it("offers nothing while running as the installed app", async () => {
    stubDevice({ app: true, maxTouchPoints: 5, userAgent: IPHONE });
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    expect(pwa.installState()).toBe("installed");
    expect(pwa.offersInstall(pwa.installState())).toBe(false);
  });
});
