import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GameModel } from "../model/game.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { acknowledgeCacheSprite, acknowledgeTargetDraws } from "./sceneTargetMarkers.ts";

function fixture() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.startGalaxy(1);
  model.state.dialogue = null;
  model.state.flight!.objects = [
    { hp: 1, id: "target", kind: "destination", radius: 20, x: 0, y: 0 },
  ];
  const displayed = vi.spyOn(model, "markerTargetDisplayed").mockImplementation(() => {});
  const glint = vi.spyOn(model, "markerGlintDisplayed").mockImplementation(() => {});
  const node = {
    alpha: 1,
    getBounds: () => ({ bottom: 20, left: -5, right: 15, top: 0 }),
    visible: true,
  };
  const context = {
    enemySprites: new Map([["target", node]]),
    landmarkSprites: new Map(),
    litCaches: new Set<string>(),
    model,
    revealGroups: new Map(),
    settingsOpen: false,
    warpCover: false,
  };
  return { context, displayed, glint, node };
}

describe("actual target render acknowledgment", () => {
  it("requires an unmasked placed cache sprite crossing the view", () => {
    const f = fixture();
    const cache = vi.spyOn(f.context.model, "discoveryCacheDisplayed");
    const group = "chunk:0,1:2";
    acknowledgeCacheSprite(f.context, { ...f.node, mask: {} }, group);
    acknowledgeCacheSprite(f.context, { ...f.node, visible: false }, group);
    f.context.settingsOpen = true;
    acknowledgeCacheSprite(f.context, f.node, group);
    expect(cache).not.toHaveBeenCalled();
    f.context.settingsOpen = false;
    acknowledgeCacheSprite(f.context, f.node, group);
    expect(cache).toHaveBeenCalledExactlyOnceWith(group);
    expect(f.displayed).not.toHaveBeenCalled();
  });

  it("acknowledges a partially drawn target once across render collections", () => {
    const f = fixture();
    f.context.revealGroups.set("target", f.node);
    acknowledgeTargetDraws(f.context);
    expect(f.displayed).toHaveBeenCalledExactlyOnceWith("target", f.context.litCaches);
  });

  it("does not identify a projected object without a render node", () => {
    const f = fixture();
    f.context.enemySprites.clear();
    acknowledgeTargetDraws(f.context);
    expect(f.displayed).not.toHaveBeenCalled();
  });

  it.each(["hidden-parent", "transparent-parent", "masked-node", "masked-parent"])(
    "does not identify through %s",
    (kind) => {
      const f = fixture();
      const parent = { ...f.node };
      if (kind === "hidden-parent") {
        parent.visible = false;
      }
      if (kind === "transparent-parent") {
        parent.alpha = 0;
      }
      if (kind === "masked-node") {
        Object.assign(f.node, { mask: {} });
      }
      if (kind === "masked-parent") {
        Object.assign(parent, { mask: {} });
      }
      Object.assign(f.node, { parentContainer: parent });
      acknowledgeTargetDraws(f.context);
      expect(f.displayed).not.toHaveBeenCalled();
    },
  );

  it.each(["hidden", "transparent", "outside", "empty"])("ignores %s nodes", (kind) => {
    const f = fixture();
    if (kind === "hidden") {
      f.node.visible = false;
    }
    if (kind === "transparent") {
      f.node.alpha = 0;
    }
    if (kind === "outside") {
      f.node.getBounds = () => ({ bottom: -1, left: 0, right: 20, top: -21 });
    }
    if (kind === "empty") {
      f.node.getBounds = () => ({ bottom: 0, left: 0, right: 0, top: 0 });
    }
    acknowledgeTargetDraws(f.context);
    expect(f.displayed).not.toHaveBeenCalled();
  });

  it.each(["settings", "warp", "dialogue", "docked"])(
    "does not acknowledge objects covered by %s",
    (kind) => {
      const f = fixture();
      if (kind === "settings") {
        f.context.settingsOpen = true;
      }
      if (kind === "warp") {
        f.context.warpCover = true;
      }
      if (kind === "dialogue") {
        f.context.model.state.dialogue = {
          choices: [],
          context: "test",
          text: "Covered",
          title: "Ada",
        };
      }
      if (kind === "docked") {
        f.context.model.state.docked = "station";
      }
      acknowledgeTargetDraws(f.context);
      expect(f.displayed).not.toHaveBeenCalled();
    },
  );
});
