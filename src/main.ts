import "./style.css";

import Phaser from "phaser";

import { PrototypeScene } from "./game/scene.ts";
import { followPageVisibility } from "./lifecycle.ts";

const parent = document.getElementById("game-canvas");
if (!parent) {
  throw new Error("Missing game canvas mount");
}

const game = new Phaser.Game({
  backgroundColor: "#101010",
  callbacks: {
    postBoot(bootedGame) {
      const stop = followPageVisibility(window, document, bootedGame.loop);
      bootedGame.events.once(Phaser.Core.Events.DESTROY, stop);
    },
  },
  parent,
  scale: { height: "100%", mode: Phaser.Scale.RESIZE, width: "100%" },
  scene: [PrototypeScene],
  type: Phaser.AUTO,
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
