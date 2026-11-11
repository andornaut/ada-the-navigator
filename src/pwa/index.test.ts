import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const offline = vi.hoisted(() => {
  const flow = {
    accept: vi.fn(),
    beginOfferVisit: vi.fn(),
    dismissOffer: vi.fn(),
    setOfferVisible: vi.fn(),
  };
  const play = { bootable: Promise.resolve(), flow, registrationReady: vi.fn() };
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
const FIREFOX_DESKTOP = "Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Mobile Safari/537.36";
const SAMSUNG =
  "Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36";
const OPERA = "Mozilla/5.0 (X11; Linux x86_64) Chrome/142.0 Safari/537.36 OPR/120.0";

// The browser's window as the kit's install flow and back guard read it.
function stubDevice({ app = false, maxTouchPoints = 0, userAgent = CHROME }: Device): EventTarget {
  const navigator = { maxTouchPoints, standalone: false, userAgent };
  const page = Object.assign(new EventTarget(), {
    matchMedia: () => ({ addEventListener: () => undefined, matches: app }),
    navigator,
  });
  vi.stubGlobal("window", page);
  vi.stubGlobal("navigator", navigator);
  stubHistory();
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

  it("wires the start screen and update offer to the kit's update flow", async () => {
    stubDevice({});
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const options = offline.start.mock.calls[0]![0] as unknown as {
      onUpdateShown: (shown: boolean) => void;
    };
    const { flow } = offline.play;
    pwa.beginStartUpdateVisit();
    pwa.startScreenShown(true);
    expect(flow.beginOfferVisit).toHaveBeenCalledOnce();
    expect(flow.setOfferVisible).toHaveBeenLastCalledWith(true);
    pwa.coverStartScreen("settings", true);
    expect(flow.setOfferVisible).toHaveBeenLastCalledWith(false);
    pwa.coverStartScreen("settings", false);
    options.onUpdateShown(true);
    pwa.updateOffer.defer();
    expect(flow.dismissOffer).toHaveBeenCalledOnce();
    options.onUpdateShown(true);
    pwa.updateOffer.accept();
    expect(flow.accept).toHaveBeenCalledOnce();
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

// The page's history as the back guard reads it, with no entry before the game.
function stubHistory() {
  const history = {
    back: vi.fn(),
    length: 1,
    pushState: vi.fn((state: unknown) => {
      history.state = state;
      history.length += 1;
    }),
    state: null as unknown,
  };
  vi.stubGlobal("history", history);
  return history;
}

describe("back gesture", () => {
  it("leaves back to the browser until the player's first input", async () => {
    const page = stubDevice({});
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const backs = vi.fn();
    page.addEventListener(pwa.PHONE_EVENTS.backPressed, backs);
    expect(history.pushState).not.toHaveBeenCalled();
    page.dispatchEvent(new Event("pointerup"));
    expect(history.pushState).toHaveBeenCalledOnce();
    // Back pops the guard entry: the game hears back and the guard returns.
    history.state = null;
    page.dispatchEvent(new Event("popstate"));
    expect(backs).toHaveBeenCalledOnce();
    expect(history.pushState).toHaveBeenCalledTimes(2);
  });

  it("ignores forward onto the guard entry", async () => {
    const page = stubDevice({});
    stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const backs = vi.fn();
    page.addEventListener(pwa.PHONE_EVENTS.backPressed, backs);
    page.dispatchEvent(new Event("pointerup"));
    page.dispatchEvent(new Event("popstate"));
    expect(backs).not.toHaveBeenCalled();
  });

  it("leaves back to the browser on the start screen with nothing open", async () => {
    const page = stubDevice({});
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const backs = vi.fn();
    page.addEventListener(pwa.PHONE_EVENTS.backPressed, backs);
    page.dispatchEvent(new Event("pointerup"));
    pwa.setBackArmed(false);
    // Back pops the guard entry; the game hears nothing, no guard returns and the browser steps
    // back past the game.
    history.state = null;
    page.dispatchEvent(new Event("popstate"));
    expect(backs).not.toHaveBeenCalled();
    expect(history.pushState).toHaveBeenCalledOnce();
    expect(history.back).toHaveBeenCalledOnce();
    // Input on the released start screen adds no guard.
    page.dispatchEvent(new Event("pointerup"));
    expect(history.pushState).toHaveBeenCalledOnce();
    pwa.setBackArmed(true);
  });

  it("re-arms during the player's input as flight starts or a card opens", async () => {
    const page = stubDevice({});
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const backs = vi.fn();
    page.addEventListener(pwa.PHONE_EVENTS.backPressed, backs);
    pwa.setBackArmed(false);
    Object.assign(navigator, { userActivation: { isActive: true } });
    pwa.setBackArmed(true);
    expect(history.pushState).toHaveBeenCalledOnce();
    history.state = null;
    page.dispatchEvent(new Event("popstate"));
    expect(backs).toHaveBeenCalledOnce();
    expect(history.back).not.toHaveBeenCalled();
  });

  it("re-arms without an entry outside the player's input, until the next input", async () => {
    const page = stubDevice({});
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    pwa.setBackArmed(false);
    pwa.setBackArmed(true);
    expect(history.pushState).not.toHaveBeenCalled();
    page.dispatchEvent(new Event("pointerup"));
    expect(history.pushState).toHaveBeenCalledOnce();
  });

  it("keeps the browser's back in Firefox for Android's installed app", async () => {
    const page = stubDevice({ app: true, userAgent: FIREFOX_ANDROID });
    const history = stubHistory();
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    page.dispatchEvent(new Event("pointerup"));
    expect(history.pushState).not.toHaveBeenCalled();
  });
});

describe("install offer", () => {
  it("offers the browser's prompt once it arrives, and is installed after acceptance", async () => {
    const page = stubDevice({});
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    const states: string[] = [];
    pwa.onInstallStateChange((state) => states.push(state));
    expect(pwa.installState()).toBe("steps");
    expect(pwa.offersInstall(pwa.installState())).toBe(true);

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

  it("falls back to the browser's steps after a dismissed prompt", async () => {
    const page = stubDevice({});
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    page.dispatchEvent(installPrompt("dismissed"));
    await expect(pwa.installApp()).resolves.toBe("dismissed");
    expect(pwa.installState()).toBe("steps");
    expect(pwa.offersInstall(pwa.installState())).toBe(true);
    await expect(pwa.installApp()).resolves.toBe("steps");
    expect(pwa.stepsKind()).toBe("chromiumDesktop");
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
    { device: { userAgent: CHROME }, kind: "chromiumDesktop" },
    { device: { maxTouchPoints: 5, userAgent: CHROME_ANDROID }, kind: "chromiumAndroid" },
    { device: { userAgent: FIREFOX_DESKTOP }, kind: "firefoxDesktop" },
    { device: { maxTouchPoints: 5, userAgent: FIREFOX_ANDROID }, kind: "firefoxAndroid" },
    { device: { maxTouchPoints: 5, userAgent: IPHONE }, kind: "ios" },
    { device: { userAgent: SAFARI_MAC }, kind: "safariMac" },
    { device: { maxTouchPoints: 5, userAgent: SAMSUNG }, kind: "samsungInternet" },
    { device: { userAgent: OPERA }, kind: "other" },
  ] as const)("asks for $kind's steps where no prompt exists", async ({ device, kind }) => {
    stubDevice(device);
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    expect(pwa.installState()).toBe("steps");
    expect(pwa.offersInstall(pwa.installState())).toBe(true);
    expect(pwa.stepsKind()).toBe(kind);
    await expect(pwa.installApp()).resolves.toBe("steps");
  });

  it("offers nothing while running as the installed app", async () => {
    stubDevice({ app: true, maxTouchPoints: 5, userAgent: IPHONE });
    const pwa = await import("./index.ts");
    pwa.setupPhoneApp();
    expect(pwa.installState()).toBe("installed");
    expect(pwa.offersInstall(pwa.installState())).toBe(false);
  });
});
