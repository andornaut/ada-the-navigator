import type { CrashWords } from "@andornaut/game-kit/web/crash/crashModel";

// The crash screen's words, kept apart from the other player strings so the module that installs
// the crash screen, the page's first, loads none of the game's data.
export const CRASH_COPY: CrashWords = {
  body: "The game stopped. Reload to play again.",
  reload: "Reload",
  title: "Something went wrong",
};
