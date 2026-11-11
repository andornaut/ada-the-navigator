import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";

const LANDING = readFileSync(new URL("../../pages/index.html", import.meta.url), "utf8");

const CHROME = "Mozilla/5.0 (X11; Linux x86_64) Chrome/142.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1";
const FIREFOX_ANDROID = "Mozilla/5.0 (Android 15; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0";

// The landing page is static HTML, so its install copy is checked against the data here.
describe("the landing page's install markup", () => {
  it("gives every menu-installing browser its install steps as the data has them", () => {
    const shown = Object.fromEntries(
      [
        ...LANDING.matchAll(
          /<div data-browser="(\w+)" hidden>\s*<h2 id="install-steps-\1">([^<]*)<\/h2>\s*<p>([^<]*)<\/p>/gu,
        ),
      ].map(([, browser, title, steps]) => [browser, { steps, title }]),
    );
    expect(shown).toEqual(PROTOTYPE.installSteps);
  });

  it("starts with Install hidden, labelled as the data has it", () => {
    expect(LANDING).toMatch(
      new RegExp(`<button[^>]*\\bid="install"[^>]*\\bhidden>${PROTOTYPE.labels.installButton}<`),
    );
  });

  it("gives the steps dialog Close as its only button", () => {
    const dialog = /<dialog[^>]*id="install-steps"[^>]*>([\s\S]*?)<\/dialog>/u.exec(LANDING)?.[1];
    expect(dialog?.match(/<button\b[^>]*>([^<]*)</gu)).toEqual([
      `<button class="site-steps-close" type="button">${PROTOTYPE.labels.close}<`,
    ]);
  });

  it("loads the landing script and none of the game", () => {
    const scripts = [...LANDING.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gu)].map(([, src]) => src);
    expect(scripts).toEqual(["/src/landing/main.ts"]);
  });
});

// Stand-ins for the elements in pages/index.html that the kit's install button reads.
class FakeDialog extends EventTarget {
  readonly close = vi.fn();
  readonly closeButton = new EventTarget();
  readonly labelledBy = vi.fn();
  readonly sections = (["firefoxAndroid", "ios"] as const).map((browser) => ({
    dataset: { browser },
    hidden: true,
  }));
  readonly showModal = vi.fn();
  querySelector(selector: string) {
    if (selector === "button") {
      return this.closeButton;
    }
    const browser = /data-browser="(\w+)"\] h2/u.exec(selector)?.[1];
    return browser === undefined ? null : { id: `install-steps-${browser}` };
  }
  querySelectorAll() {
    return this.sections;
  }
  setAttribute(name: string, value: string) {
    this.labelledBy(name, value);
  }
}

describe("the landing page's Install button", () => {
  let button: EventTarget & { hidden: boolean };
  let dialog: FakeDialog;
  let page: EventTarget;

  async function load(userAgent: string): Promise<void> {
    const navigator = { maxTouchPoints: userAgent === CHROME ? 0 : 5, userAgent };
    page = Object.assign(new EventTarget(), {
      matchMedia: () => ({ addEventListener: () => undefined, matches: false }),
      navigator,
    });
    vi.stubGlobal("window", page);
    vi.stubGlobal("HTMLDialogElement", FakeDialog);
    vi.stubGlobal("document", {
      getElementById: (id: string) => ({ install: button, "install-steps": dialog })[id] ?? null,
    });
    await import("./main.ts");
  }
  // Lets the click's install promise settle.
  const settle = () =>
    new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

  beforeEach(() => {
    vi.resetModules();
    button = Object.assign(new EventTarget(), { hidden: true });
    dialog = new FakeDialog();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays hidden where the browser offers no way to install", async () => {
    await load(CHROME);
    expect(button.hidden).toBe(true);
  });

  it("shows for the browser's prompt and asks it to prompt on a click", async () => {
    await load(CHROME);
    const prompt = vi.fn(() => Promise.resolve());
    page.dispatchEvent(
      Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt,
        userChoice: Promise.resolve({ outcome: "accepted" }),
      }),
    );
    expect(button.hidden).toBe(false);
    button.dispatchEvent(new Event("click"));
    await settle();
    expect(prompt).toHaveBeenCalledOnce();
    expect(button.hidden).toBe(true);
    expect(dialog.showModal).not.toHaveBeenCalled();
  });

  it.each([
    ["ios", IPHONE],
    ["firefoxAndroid", FIREFOX_ANDROID],
  ])("opens %s's steps alone on a click, and Close closes them", async (browser, userAgent) => {
    await load(userAgent);
    expect(button.hidden).toBe(false);
    button.dispatchEvent(new Event("click"));
    await settle();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.sections.filter((section) => !section.hidden)).toEqual([
      { dataset: { browser }, hidden: false },
    ]);
    expect(dialog.labelledBy).toHaveBeenCalledWith("aria-labelledby", `install-steps-${browser}`);
    dialog.closeButton.dispatchEvent(new Event("click"));
    expect(dialog.close).toHaveBeenCalledOnce();
  });
});
