// The crash listener and lightweight progress shell precede every game-module download.
import "../crash/install.ts";

import { CRASH_SCREEN } from "../crash/crashScreen.ts";
import { requiredLoading } from "./required.ts";
import { startLoading } from "./startup.ts";

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing application mount");
}
const stop = await startLoading(
  requiredLoading,
  CRASH_SCREEN,
  async () => {
    const game = await import("../main.ts");
    return {
      commit: game.commitGame,
      dispose: game.disposeGame,
      load: game.startGame,
      prepare: game.prepareGame,
    };
  },
  app,
);
if (import.meta.hot) {
  import.meta.hot.dispose(stop);
}
