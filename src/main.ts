import "./style.css";

import Phaser from "phaser";

import { followPageVisibility } from "./lifecycle.ts";

class ReadyScene extends Phaser.Scene {
  constructor() {
    super("ready");
  }

  create(): void {
    const title = this.add
      .text(0, 0, "Ada the Navigator", {
        align: "center",
        color: "#f0f3f6",
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
      })
      .setOrigin(0.5);
    const ready = this.add
      .text(0, 0, "Ready", {
        color: "#b1bac4",
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
      })
      .setOrigin(0.5);
    const layout = (): void => {
      const { height, width } = this.scale;
      title.setPosition(width / 2, height / 2 - 24);
      title.setScale(Math.min(1, Math.max(1, width - 32) / title.width));
      ready.setPosition(width / 2, height / 2 + 24);
    };
    layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, layout);
    });
  }
}

const parent = document.getElementById("app");
if (!parent) {
  throw new Error("Missing application mount");
}

const game = new Phaser.Game({
  backgroundColor: "#161b22",
  callbacks: {
    postBoot(bootedGame) {
      const stop = followPageVisibility(window, document, bootedGame.loop);
      bootedGame.events.once(Phaser.Core.Events.DESTROY, stop);
    },
  },
  parent,
  scale: { height: "100%", mode: Phaser.Scale.RESIZE, width: "100%" },
  scene: [ReadyScene],
  type: Phaser.AUTO,
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
