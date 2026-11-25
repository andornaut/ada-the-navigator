// The landing page's Install button beside Play, on the kit's install button: the browser's
// install prompt where it gives one, otherwise that browser's own install steps, and hidden once
// installed. It imports only the kit's install and launch modules, so the landing page loads none
// of the game. It registers the router without installing a build, so an app installed from this
// page opens through the router, offline once the game's launch has installed a build.
import { wireInstallButton } from "@andornaut/game-kit/runtime/web/pwa/dom/installButton";
import { watchInstall } from "@andornaut/game-kit/runtime/web/pwa/dom/installFlow";
import { registerRouter } from "@andornaut/game-kit/runtime/web/pwa/dom/launch";

// Elements in pages/index.html. The steps dialog holds one section per InstallStepsKind, each
// marked data-steps with its kind and titled by its h2, and its close button, its only button.
const INSTALL_ID = "install";
const STEPS_ID = "install-steps";
// The router the build writes (src/build/precachePlugin.ts), as the game page registers it.
const SERVICE_WORKER_URL = "/sw.js";

// Listens at once: beforeinstallprompt can fire before the page has drawn anything.
const flow = watchInstall(window);
const button = document.getElementById(INSTALL_ID);
const steps = document.getElementById(STEPS_ID);

if (button !== null && steps instanceof HTMLDialogElement) {
  wireInstallButton(flow, button, steps);
}

// The production build only: the dev server has no sw.js.
if (import.meta.env.PROD) {
  void registerRouter(
    "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
    SERVICE_WORKER_URL,
  );
}
