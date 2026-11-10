import "@andornaut/game-kit/web/view/frameTurnLandscapeGame.css";
import "./style.css";

import { lockGameOrientation } from "@andornaut/game-kit/web/view/dom/watchFrameTurn";
import { followFrameTurn } from "@andornaut/game-kit/web/view/phaser/followFrameTurn";
import Phaser from "phaser";

import { SCREEN } from "./data/screen.ts";
import { PrototypeScene } from "./game/scene.ts";
import { followPageVisibility } from "./lifecycle.ts";
import { FRAME_TURN } from "./view/frame-turn.ts";

const parent = document.getElementById("game-canvas");
if (!parent) {
  throw new Error("Missing game canvas mount");
}

lockGameOrientation("landscape", screen);

const game = new Phaser.Game({
  backgroundColor: "#101010",
  callbacks: {
    postBoot(bootedGame) {
      bootedGame.canvas.setAttribute("aria-hidden", "true");
      followFrameTurn(FRAME_TURN, bootedGame.scale.gameSize, parent, bootedGame);
      const stop = followPageVisibility(window, document, bootedGame.loop);
      bootedGame.events.once(Phaser.Core.Events.DESTROY, stop);
    },
  },
  height: SCREEN.height,
  parent,
  pixelArt: true,
  render: { antialias: false },
  scale: { autoCenter: Phaser.Scale.CENTER_HORIZONTALLY, mode: Phaser.Scale.EXPAND },
  scene: [PrototypeScene],
  type: Phaser.AUTO,
  width: SCREEN.width,
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
