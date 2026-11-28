import { afterEach, expect, it, vi } from "vitest";

import type { StoryOverlay } from "./storyArt.ts";
import { createStoryOverlay, setStoryScenePreview } from "./storySceneView.ts";

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const make = () => ({
    children: [] as unknown[],
    className: "",
    dataset: {},
    replaceChildren(...nodes: unknown[]) {
      this.children = nodes;
    },
    style: {},
  });
  vi.stubGlobal("document", { createElement: make });
  return make() as unknown as HTMLElement;
}

const rock: StoryOverlay = {
  box: { height: 10, left: 40, top: 50, width: 20 },
  id: "polished-rock",
  source: { height: 200, rect: { height: 100, width: 100, x: 100, y: 0 }, width: 200 },
  url: "/art/story-composed/prop-polished-rock.webp",
};

it("retains ordered canonical room layers and encoded sheet crops in the thumbnail", () => {
  const target = fixture();
  const recorder = {
    box: rock.box,
    id: "recorder",
    url: "/art/story-composed/prop-recorder.webp",
  };
  setStoryScenePreview(
    { overlays: [rock, recorder], url: "/art/story-composed/base-ada-room-unpolished.webp" },
    "/obsolete-room.png",
    target,
  );
  expect(target.style.backgroundImage).toContain("base-ada-room-unpolished.webp");
  const layers = [...target.children] as HTMLElement[];
  expect(layers.map((node) => node.dataset.overlay)).toEqual(["polished-rock", "recorder"]);
  expect(layers[0]!.style.backgroundPosition).toBe("100% 0%");
  expect(layers[0]!.style.backgroundSize).toBe("200% 200%");
  expect(layers[0]!.style.top).toBe("50%");
  expect(layers[1]!.style.backgroundImage).toContain("prop-recorder.webp");
});

it("removes Earth layers when returning to a galaxy or an unavailable preview", () => {
  const target = fixture();
  setStoryScenePreview({ overlays: [rock], url: "/base.webp" }, undefined, target);
  setStoryScenePreview(undefined, "/galaxy.png", target);
  expect(target.children).toHaveLength(0);
  expect(target.style.backgroundImage).toContain("galaxy.png");
  setStoryScenePreview(undefined, undefined, target);
  expect(target.style.backgroundImage).toBe("none");
});

it("reuses a live story overlay node while applying the next canonical layer crop", () => {
  fixture();
  const first = createStoryOverlay(rock);
  expect(createStoryOverlay({ box: rock.box, id: "recorder", url: rock.url }, first)).toBe(first);
  expect(first.dataset.overlay).toBe("recorder");
  expect(first.style.backgroundSize).toBe("100% 100%");
});
