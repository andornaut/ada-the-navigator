// The crash screen listens before any other module runs (src/crash/install.ts).
import "./crash/install.ts";
import "@andornaut/game-kit/web/view/frameTurnLandscapeGame.css";
import "./style.css";
// The HTML interface's stylesheet (src/ui/stylesheet.ts, served by src/tools/ui-style-plugin.ts).
import "virtual:ada-ui.css";

import { MAX_RENDER_SCALE } from "@andornaut/game-kit/view/renderScale";
import { lockGameOrientation } from "@andornaut/game-kit/web/view/dom/watchFrameTurn";
import { followFrameTurn } from "@andornaut/game-kit/web/view/phaser/followFrameTurn";
import { Core, Game, Scale, Scenes, WEBGL } from "phaser";

import { CRASH_SCREEN } from "./crash/crash-screen.ts";
import { SCREEN } from "./data/screen.ts";
import { stopSaving } from "./game/persistence.ts";
import { PrototypeScene } from "./game/scene.ts";
import { followPageVisibility } from "./lifecycle.ts";
import { mountLoading } from "./loading/progress.ts";
import { gameShown, setupPhoneApp } from "./pwa/index.ts";
import { FRAME_TURN } from "./view/frame-turn.ts";

const parent = document.getElementById("game-canvas");
if (!parent) {
  throw new Error("Missing game canvas mount");
}

lockGameOrientation("landscape", screen);
// Before the game boots, so the boot preload's progress shows.
const app = parent.closest<HTMLElement>("#app");
if (app) {
  mountLoading(app);
}
// At once: the browser's install prompt can come before the game has drawn anything.
setupPhoneApp();

// The canvas fills the play area with its backing in device pixels, up to MAX_RENDER_SCALE per CSS
// pixel (followFrameTurn's deviceResolution, Scale.NONE); above that the browser upscales it
// pixelated. Cameras zoom the logical view to fit (src/game/play-camera.ts). Every texture
// samples nearest unless src/game/textures.ts makes it linear, and nothing is smoothed implicitly.
const game = new Game({
  backgroundColor: "#101010",
  callbacks: {
    postBoot(bootedGame) {
      bootedGame.canvas.setAttribute("aria-hidden", "true");
      followFrameTurn(FRAME_TURN, bootedGame.scale.gameSize, parent, bootedGame, {
        deviceResolution: { max: MAX_RENDER_SCALE },
      });
      const stop = followPageVisibility(window, document, bootedGame.loop);
      bootedGame.events.once(Core.Events.DESTROY, stop);
      // A first visit registers the service worker once the game has drawn with its art loaded.
      bootedGame.scene.getScene("prototype")?.events.once(Scenes.Events.CREATE, gameShown);
    },
  },
  height: SCREEN.height,
  parent,
  // Lower input-to-screen delay: a desynchronized context lets the browser show a frame without
  // waiting on the page compositor, and the high-performance GPU where there is a choice.
  render: {
    antialias: false,
    antialiasGL: false,
    desynchronized: true,
    powerPreference: "high-performance",
    roundPixels: true,
  },
  scale: { autoCenter: Scale.CENTER_HORIZONTALLY, mode: Scale.NONE },
  scene: [PrototypeScene],
  // WebGL only: the build's Phaser has no Canvas renderer (src/tools/phaser-build.ts).
  type: WEBGL,
  width: SCREEN.width,
});
// A crash keeps the last save and stops the game under the crash screen.
CRASH_SCREEN.stopGameOnCrash(() => {
  stopSaving();
  game.pause();
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
