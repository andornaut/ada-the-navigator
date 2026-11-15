import { LOADER_CONFIG } from "@andornaut/game-kit/runtime/load/loaderConfig";
import { createRequiredLoading } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { afterEach, expect, it, vi } from "vitest";

import { requireBootUi } from "./requiredUi.ts";

async function settle() {
  for (let n = 0; n < 20; n++) {
    /* Each turn advances a native decode/registry boundary. */
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}
function fixture() {
  const images: {
    src: string;
    naturalWidth: number;
    naturalHeight: number;
    resolve: () => void;
    reject: () => void;
    removeAttribute: ReturnType<typeof vi.fn>;
  }[] = [];
  const fetch = vi.fn();
  const required = createRequiredLoading();
  const document = {
    baseURI: "https://game.test/play/",
    createElement: () => {
      let resolve!: () => void, reject!: () => void;
      const decoded = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = () => no(new Error("decode failed"));
      });
      const image = {
        decode: () => decoded,
        naturalHeight: 10,
        naturalWidth: 10,
        reject,
        removeAttribute: vi.fn(),
        resolve,
        src: "",
      };
      images.push(image);
      return image;
    },
  } as unknown as Document;
  const page = {
    document,
    window: {
      clearTimeout: globalThis.clearTimeout,
      fetch,
      setTimeout: globalThis.setTimeout,
    } as unknown as Window,
  };
  return { fetch, images, page, required };
}
const manifest = {
  fonts: [{ png: "fonts/body.png" }],
  sprites: [{ png: "sprites/button.png" }],
};
afterEach(() => vi.useRealTimers());
it("rejects malformed manifest and retries its body before discovering all required sheets", async () => {
  const f = fixture();
  f.fetch
    .mockResolvedValueOnce({ json: async () => ({ sprites: [] }), ok: true })
    .mockResolvedValue({ json: async () => manifest, ok: true });
  const ui = requireBootUi(f.required, f.page);
  await settle();
  expect(f.required.state.kind).toBe("failed");
  expect(f.images).toHaveLength(0);
  const retry = f.required.retry();
  await settle();
  expect(f.images).toHaveLength(2);
  f.images.forEach((i) => i.resolve());
  await retry;
  expect(f.required.state.kind).toBe("ready");
  f.required.dispose();
  ui.dispose();
});
it("preserves successful bitmap decodes and retries only the failed image, entering once", async () => {
  const f = fixture();
  f.fetch.mockResolvedValue({ json: async () => manifest, ok: true });
  const ui = requireBootUi(f.required, f.page);
  const enter = vi.fn();
  f.required.wait(enter);
  await settle();
  f.images[0]!.resolve();
  f.images[1]!.reject();
  await settle();
  expect(enter).not.toHaveBeenCalled();
  const retry = f.required.retry();
  await settle();
  expect(f.fetch).toHaveBeenCalledOnce();
  expect(f.images).toHaveLength(3);
  expect(f.images[2]!.src).toBe(f.images[1]!.src);
  f.images[2]!.resolve();
  await retry;
  expect(enter).toHaveBeenCalledOnce();
  f.required.dispose();
  ui.dispose();
});
it("times out required manifest bodies without converting failure into fallback readiness", async () => {
  vi.useFakeTimers();
  const f = fixture();
  f.fetch.mockResolvedValue({ json: () => new Promise(() => {}), ok: true });
  const ui = requireBootUi(f.required, f.page);
  await settle();
  await vi.advanceTimersByTimeAsync(LOADER_CONFIG.timeout);
  expect(f.required.state.kind).toBe("failed");
  expect(f.images).toHaveLength(0);
  f.required.dispose();
  ui.dispose();
});
it("discards stale decode and manifest results after cancellation", async () => {
  const f = fixture();
  let json!: (v: unknown) => void;
  f.fetch.mockResolvedValue({
    json: () =>
      new Promise((resolve) => {
        json = resolve;
      }),
    ok: true,
  });
  const ui = requireBootUi(f.required, f.page);
  await settle();
  f.required.dispose();
  ui.dispose();
  json(manifest);
  await settle();
  expect(f.images).toHaveLength(0);
  expect(f.required.state.kind).toBe("disposed");
});

it.each(["http", "network", "json"])(
  "keeps a required UI %s failure failed until explicit Retry",
  async (kind) => {
    const f = fixture();
    if (kind === "http") {
      f.fetch.mockResolvedValueOnce({ ok: false });
    } else if (kind === "network") {
      f.fetch.mockRejectedValueOnce(new Error("offline"));
    } else {
      f.fetch.mockResolvedValueOnce({
        json: async () => {
          throw new Error("malformed body");
        },
        ok: true,
      });
    }
    f.fetch.mockResolvedValue({ json: async () => manifest, ok: true });
    const ui = requireBootUi(f.required, f.page);
    await settle();
    expect(f.required.state.kind).toBe("failed");
    expect(f.images).toHaveLength(0);
    const retry = f.required.retry();
    await settle();
    f.images.forEach((image) => image.resolve());
    await retry;
    expect(f.required.state.kind).toBe("ready");
    f.required.dispose();
    ui.dispose();
  },
);
it("times out a required bitmap and rejects late decode completion without granting entry", async () => {
  vi.useFakeTimers();
  const f = fixture();
  f.fetch.mockResolvedValue({ json: async () => manifest, ok: true });
  const ui = requireBootUi(f.required, f.page),
    enter = vi.fn();
  f.required.wait(enter);
  await settle();
  f.images[0]!.resolve();
  await vi.advanceTimersByTimeAsync(LOADER_CONFIG.timeout);
  expect(f.required.state.kind).toBe("failed");
  f.images[1]!.resolve();
  await settle();
  expect(enter).not.toHaveBeenCalled();
  const retry = f.required.retry();
  await settle();
  f.images[2]!.resolve();
  await retry;
  expect(enter).toHaveBeenCalledOnce();
  f.required.dispose();
  ui.dispose();
});
