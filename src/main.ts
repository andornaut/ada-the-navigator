import "@andornaut/game-kit/web/view/frameTurnLandscapeGame.css";
import "./style.css";

import { MAX_RENDER_SCALE } from "@andornaut/game-kit/view/renderScale";
import { lockGameOrientation } from "@andornaut/game-kit/web/view/dom/watchFrameTurn";
import { followFrameTurn } from "@andornaut/game-kit/web/view/phaser/followFrameTurn";
import Phaser from "phaser";

import { SCREEN } from "./data/screen.ts";
import { PrototypeScene } from "./game/scene.ts";
import { followPageVisibility } from "./lifecycle.ts";
import { gameShown, setupPhoneApp } from "./pwa/index.ts";
import { FRAME_TURN } from "./view/frame-turn.ts";

const parent = document.getElementById("game-canvas");
if (!parent) {
  throw new Error("Missing game canvas mount");
}

lockGameOrientation("landscape", screen);
// At once: the browser's install prompt can come before the game has drawn anything.
setupPhoneApp();

// The canvas fills the play area with its backing in device pixels, up to MAX_RENDER_SCALE per CSS
// pixel (followFrameTurn's deviceResolution, Scale.NONE); above that the browser upscales it
// pixelated. Cameras zoom the logical view to fit (src/game/play-camera.ts). Every texture
// samples nearest unless src/game/textures.ts makes it linear, and nothing is smoothed implicitly.
const game = new Phaser.Game({
  backgroundColor: "#101010",
  callbacks: {
    postBoot(bootedGame) {
      bootedGame.canvas.setAttribute("aria-hidden", "true");
      followFrameTurn(FRAME_TURN, bootedGame.scale.gameSize, parent, bootedGame, {
        deviceResolution: { max: MAX_RENDER_SCALE },
      });
      const stop = followPageVisibility(window, document, bootedGame.loop);
      bootedGame.events.once(Phaser.Core.Events.DESTROY, stop);
      // A first visit registers the service worker once the game has drawn with its art loaded.
      bootedGame.scene.getScene("prototype")?.events.once(Phaser.Scenes.Events.CREATE, gameShown);
    },
  },
  height: SCREEN.height,
  parent,
  render: { antialias: false, antialiasGL: false, roundPixels: true },
  scale: { autoCenter: Phaser.Scale.CENTER_HORIZONTALLY, mode: Phaser.Scale.NONE },
  scene: [PrototypeScene],
  type: Phaser.AUTO,
  width: SCREEN.width,
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
