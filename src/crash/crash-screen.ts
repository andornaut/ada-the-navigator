// The page's crash screen (the kit's web/crash/dom/crashScreen), in the game's words and the
// interface's colours, with the message, stack and build label under ?dev=1. It writes nothing to
// the save, whose in-memory state may be corrupt, and a crash stops the game's own saving
// (src/main.ts), so the next launch resumes from the last save. src/crash/install.ts imports this
// module before any other.
import "@andornaut/game-kit/web/crash/dom/crash.css";

import {
  type CrashColours,
  installCrashScreen,
} from "@andornaut/game-kit/web/crash/dom/crashScreen";

import { BUILD_LABEL } from "../build-label.ts";
import { CRASH_COPY } from "../data/crash-copy.ts";

// The play page's colours (theme-color #292734), with the primary button's face and lip and the
// cream label from the HTML interface (src/ui/modal.ts), so the screen needs none of its modules.
export const CRASH_COLOURS: CrashColours = {
  background: "#292734",
  buttonFace: "#bfa06f",
  buttonLip: "#8a7148",
  ink: "#181425",
  text: "#ead4aa",
};

export const CRASH_SCREEN = installCrashScreen(window, {
  buildLabel: BUILD_LABEL,
  colours: CRASH_COLOURS,
  dev: new URLSearchParams(window.location.search).get("dev") === "1",
  words: CRASH_COPY,
});
