import { afterEach, describe, expect, it, vi } from "vitest";

import { applyButtonSkin, BUTTON_SHEETS, buttonProperty } from "./uiSkin.ts";

// Exercise the published kit with a minimal document, including its canvas encoding boundary.
function fixture() {
  const drawImage = vi.fn();
  const document = {
    baseURI: "https://ada.invalid/play/",
    createElement: vi.fn((tag: string) => {
      if (tag === "img") {
        return { decode: vi.fn().mockResolvedValue(undefined), src: "" };
      }
      return {
        getContext: () => ({ drawImage }),
        toBlob: (callback: BlobCallback) => callback(new Blob(["frame"])),
      };
    }),
  } as unknown as Document;
  const root = () =>
    ({ ownerDocument: document, style: { setProperty: vi.fn() } }) as unknown as HTMLElement;
  return { document, drawImage, root };
}

function serveSheets() {
  const fetch = vi.fn(async (url: string) => ({
    json: async () =>
      url.endsWith("manifest.json")
        ? {
            sprites: BUTTON_SHEETS.map((key) => ({
              json: `sprites/${key}.json`,
              key,
              png: `sprites/${key}.png`,
            })),
          }
        : {
            frames: Object.fromEntries(
              ["normal", "pressed", "disabled"].map((tag, index) => [
                tag,
                { duration: 100, frame: { h: 28, w: 16, x: index * 16, y: 0 } },
              ]),
            ),
            meta: {
              frameTags: ["normal", "pressed", "disabled"].map((name, from) => ({
                direction: "forward",
                from,
                name,
                to: from,
              })),
            },
          },
    ok: true,
  }));
  vi.stubGlobal("fetch", fetch);
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:skin-${Math.random()}`);
  return fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Ada's published button skin adapter", () => {
  it("shares one extraction across concurrent and later roots with every Ada state", async () => {
    const fetch = serveSheets();
    const { drawImage, root } = fixture();
    const first = root();
    const second = root();
    await Promise.all([applyButtonSkin(first), applyButtonSkin(second)]);
    await applyButtonSkin(root());
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch).toHaveBeenCalledWith("https://ada.invalid/art/ui/manifest.json");
    expect(fetch).toHaveBeenCalledWith("https://ada.invalid/art/ui/sprites/ui-button.json");
    expect(drawImage).toHaveBeenCalledTimes(9);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 16, 0, 16, 28, 0, 0, 16, 28);
    for (const sheet of BUTTON_SHEETS) {
      for (const tag of ["normal", "pressed", "disabled"] as const) {
        expect(first.style.setProperty).toHaveBeenCalledWith(
          buttonProperty(sheet, tag),
          expect.stringMatching(/^url\("blob:skin-/),
        );
      }
    }
    expect(second.style.setProperty).toHaveBeenCalledTimes(9);
  });

  it("keeps each document's skin independent", async () => {
    const fetch = serveSheets();
    await applyButtonSkin(fixture().root());
    await applyButtonSkin(fixture().root());
    expect(fetch).toHaveBeenCalledTimes(8);
  });

  it("leaves fallback styles intact when the manifest fails without retrying each root", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    const { root } = fixture();
    const first = root();
    await applyButtonSkin(first);
    await applyButtonSkin(root());
    expect(first.style.setProperty).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("isolates a failed sheet while applying the other sheets", async () => {
    serveSheets();
    const { document, root } = fixture();
    vi.mocked(document.createElement).mockImplementation((tag: string) => {
      if (tag === "img") {
        const image = {
          decode: async () => {
            if (image.src.endsWith("ui-button-primary.png")) {
              throw new Error("decode failed");
            }
          },
          src: "",
        };
        return image as unknown as HTMLElement;
      }
      return {
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (callback: BlobCallback) => callback(new Blob()),
      } as unknown as HTMLElement;
    });
    const target = root();
    await applyButtonSkin(target);
    expect(target.style.setProperty).toHaveBeenCalledTimes(6);
    expect(target.style.setProperty).not.toHaveBeenCalledWith(
      "--ui-button-primary-normal",
      expect.anything(),
    );
  });
});
