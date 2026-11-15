import { LOADER_CONFIG } from "@andornaut/game-kit/runtime/load/loaderConfig";
import { createRequiredLoading } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { afterEach, expect, it, vi } from "vitest";

import { requireBootFonts } from "./requiredFonts.ts";

async function settle() {
  for (let turn = 0; turn < 20; turn++) {
    // Native face loading and registry callbacks settle in separate promise turns.
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

function fixture() {
  const active = new Set<Face>();
  const pending: { face: Face; resolve: () => void; reject: () => void }[] = [];
  class Face {
    family = "Liberation Sans";
    status = "unloaded";
    weight: string;
    constructor(weight: string) {
      this.weight = weight;
    }
    load() {
      return new Promise<Face>((resolve, reject) => {
        this.status = "loading";
        pending.push({
          face: this,
          reject: () => {
            this.status = "error";
            reject(new Error("font IO failed"));
          },
          resolve: () => {
            this.status = "loaded";
            resolve(this);
          },
        });
      });
    }
  }
  class Rule {
    readonly weight: string;
    face: Face;
    constructor(weight: string) {
      this.weight = weight;
      this.face = new Face(weight);
      active.add(this.face);
    }
    get cssText() {
      return this.weight;
    }
    get parentStyleSheet() {
      return sheet;
    }
    style = {
      getPropertyValue: (property: string) =>
        ({ "font-family": '"Liberation Sans"', "font-weight": this.weight })[property] ?? "",
    };
  }
  const sheet = {
    cssRules: [] as Rule[],
    deleteRule: vi.fn((index: number) => {
      active.delete(sheet.cssRules[index]!.face);
      sheet.cssRules.splice(index, 1);
      rebuildFaces();
    }),
    insertRule: vi.fn((text: string, index: number) => {
      sheet.cssRules.splice(index, 0, new Rule(text));
      rebuildFaces();
    }),
  };
  const rebuildFaces = () => {
    active.clear();
    for (const rule of sheet.cssRules) {
      rule.face = new Face(rule.weight);
      active.add(rule.face);
    }
  };
  sheet.cssRules.push(new Rule("400"), new Rule("700"));
  vi.stubGlobal("CSSFontFaceRule", Rule);
  const check = vi.fn(() => true);
  const fonts = {
    [Symbol.iterator]: () => active.values(),
    check,
    load: vi.fn(async (font: string) => {
      const current = [...active].find((face) => font.startsWith(face.weight));
      if (current && current.status !== "loaded") {
        await current.load();
      }
      return current ? [current] : [];
    }),
  };
  const document = { fonts, styleSheets: [sheet] } as unknown as Document;
  const required = createRequiredLoading();
  const dispose = requireBootFonts(required, {
    document,
    timer: globalThis as unknown as Window,
  });
  return { active, check, dispose, fonts, pending, required, sheet };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("revalidates both current faces after failed-weight rule replacement rebuilds the stylesheet", async () => {
  const f = fixture();
  const enter = vi.fn(() => [...f.active].map(({ status, weight }) => ({ status, weight })));
  f.required.wait(enter);
  await settle();
  const regular = f.pending[0]!.face;
  f.pending[0]!.resolve();
  f.pending[1]!.reject();
  await settle();
  expect(f.required.state.kind).toBe("failed");
  expect(enter).not.toHaveBeenCalled();
  const retry = f.required.retry();
  await settle();
  expect(f.pending.map(({ face }) => face.weight)).toEqual(["400", "700", "700", "400"]);
  expect(f.sheet.insertRule).toHaveBeenCalledWith("700", 1);
  expect(f.sheet.deleteRule).toHaveBeenCalledWith(2);
  expect(f.active.has(regular)).toBe(false);
  expect(f.required.state.kind).toBe("loading");
  f.pending[2]!.resolve();
  await settle();
  expect(enter).not.toHaveBeenCalled();
  f.pending[3]!.resolve();
  await retry;
  expect(f.required.state.kind).toBe("ready");
  expect(enter).toHaveBeenCalledOnce();
  expect(enter.mock.results[0]!.value).toEqual([
    { status: "loaded", weight: "400" },
    { status: "loaded", weight: "700" },
  ]);
  expect(f.sheet.cssRules.map(({ weight }) => weight)).toEqual(["400", "700"]);
  expect(f.check).toHaveBeenCalledWith('400 16px "Liberation Sans"');
  expect(f.check).toHaveBeenCalledWith('700 16px "Liberation Sans"');
  f.required.dispose();
  f.dispose();
});

it("rejects unusable font checks instead of accepting promise settlement", async () => {
  const f = fixture();
  f.check.mockReturnValue(false);
  await settle();
  f.pending.forEach(({ resolve }) => resolve());
  await settle();
  expect(f.required.state.kind).toBe("failed");
  f.required.dispose();
  f.dispose();
});

it("discards late native font results after timeout and disposal", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await settle();
  await vi.advanceTimersByTimeAsync(LOADER_CONFIG.timeout);
  expect(f.required.state.kind).toBe("failed");
  f.required.dispose();
  f.dispose();
  f.pending.forEach(({ resolve }) => resolve());
  await settle();
  expect(f.fonts.load).not.toHaveBeenCalled();
  expect(f.check).not.toHaveBeenCalled();
});

it("keeps entry failed if the rebuilt regular face fails, even when check returns true", async () => {
  const f = fixture();
  const enter = vi.fn();
  f.required.wait(enter);
  await settle();
  f.pending[0]!.resolve();
  f.pending[1]!.reject();
  await settle();
  const retry = f.required.retry();
  await settle();
  expect(f.pending[3]!.face.weight).toBe("400");
  f.pending[2]!.resolve();
  f.pending[3]!.reject();
  await retry;
  expect(f.check()).toBe(true);
  expect(f.required.state.kind).toBe("failed");
  expect(enter).not.toHaveBeenCalled();
  f.required.dispose();
  f.dispose();
});
