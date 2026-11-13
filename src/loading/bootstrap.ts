// The crash listener and lightweight progress shell precede every game-module download.
import "../crash/install.ts";

import { CRASH_SCREEN } from "../crash/crashScreen.ts";
import { startLoading } from "./startup.ts";

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing application mount");
}
const stop = await startLoading(CRASH_SCREEN, () => import("../main.ts"), app);
if (import.meta.hot) {
  import.meta.hot.dispose(stop);
}
