// The crash listener and lightweight progress shell precede every game-module download.
import "../crash/install.ts";

import { CRASH_SCREEN } from "../crash/crashScreen.ts";
import type { RequiredBootResources } from "./bootReveal.ts";
import { EntryReloadRequired } from "./entryRecovery.ts";
import { requiredLoading } from "./required.ts";
import { requireBootFonts } from "./requiredFonts.ts";
import { requireBootUi } from "./requiredUi.ts";
import { startLoading } from "./startup.ts";

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing application mount");
}
const resources: RequiredBootResources = {
  stopFonts: requireBootFonts(requiredLoading, {
    document,
    stylesheets: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')],
    timer: window,
  }),
  ui: requireBootUi(requiredLoading, { document, window }),
};
const stopUi = requiredLoading.subscribe((state) => {
  if (state.kind === "disposed") {
    resources.stopFonts();
    resources.ui.dispose();
  }
});
let stopLoading: () => void;
try {
  stopLoading = await startLoading(
    requiredLoading,
    CRASH_SCREEN,
    async () => {
      const game = await import("../main.ts").catch((error: unknown) => {
        throw new EntryReloadRequired("module-import", error);
      });
      return {
        commit: game.commitGame,
        dispose: game.disposeGame,
        load: game.startGame,
        prepare: (required, attempt) => game.prepareGame(required, attempt, resources),
      };
    },
    app,
  );
} catch (error) {
  stopUi();
  resources.stopFonts();
  resources.ui.dispose();
  throw error;
}
const stop = () => {
  stopLoading();
  stopUi();
  resources.stopFonts();
  resources.ui.dispose();
};
if (import.meta.hot) {
  import.meta.hot.dispose(stop);
}
