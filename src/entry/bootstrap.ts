// The crash listener and lightweight progress shell precede every game-module download.
import "./crash.ts";
import "@andornaut/game-kit/runtime/web/progress/dom/progressBar.css";

import type { LaunchResult } from "@andornaut/game-kit/runtime/web/pwa/buildContract";

import { EntryReloadRequired } from "../loading/entryRecovery.ts";
import { type RequiredBootResources, requiredLoading } from "../loading/required.ts";
import { requireBootFonts } from "../loading/requiredFonts.ts";
import { requireBootUi } from "../loading/requiredUi.ts";
import { startLoading } from "../loading/startup.ts";
import { preparePhoneLaunch } from "../pwa/index.ts";
import { CRASH_SCREEN } from "../ui/crashScreen.ts";
import { mountLoading } from "../ui/loadingBar.ts";
import { loadingFailureChrome, mountStartupFailure } from "../ui/loadingFailure.ts";

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing application mount");
}
// The launch installs the complete build before the game downloads, under the one loading bar,
// or activates a staged build; the game module loads from the installed build afterwards.
const launch = preparePhoneLaunch(loadingFailureChrome, app);
let stop: () => void;
if (launch.kind === "unsupported") {
  stop = launch.dispose;
  CRASH_SCREEN.stopGameOnCrash(stop);
} else {
  stop = await startSupportedLaunch(app, launch.result);
}

async function startSupportedLaunch(app: HTMLElement, launched: Promise<LaunchResult>) {
  // The boot fonts and UI art load once the launch resolves, from the installed build, so on a slow
  // link they never wait behind the install's download and time out.
  let resources: RequiredBootResources | undefined;
  const bootResources = (): RequiredBootResources => {
    resources ??= {
      stopFonts: requireBootFonts(requiredLoading, {
        document,
        stylesheets: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')],
        timer: window,
      }),
      ui: requireBootUi(requiredLoading, { document, window }),
    };
    return resources;
  };
  const disposeResources = () => {
    resources?.stopFonts();
    resources?.ui.dispose();
  };
  const stopUi = requiredLoading.subscribe((state) => {
    if (state.kind === "disposed") {
      disposeResources();
    }
  });
  let stopLoading: () => void;
  try {
    stopLoading = await startLoading(
      requiredLoading,
      CRASH_SCREEN,
      async () => {
        if ((await launched) === "reloading") {
          // The page is reloading into another build: nothing of this document starts.
          return new Promise<never>(() => {});
        }
        const boot = bootResources();
        const game = await import("./main.ts").catch((error: unknown) => {
          throw new EntryReloadRequired("module-import", error);
        });
        return {
          commit: game.commitGame,
          dispose: game.disposeGame,
          load: game.startGame,
          prepare: (required, attempt) => game.prepareGame(required, attempt, boot),
        };
      },
      { mountFailure: mountStartupFailure, mountLoading },
      app,
    );
  } catch (error) {
    stopUi();
    disposeResources();
    throw error;
  }
  return () => {
    stopLoading();
    stopUi();
    disposeResources();
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(stop);
}
