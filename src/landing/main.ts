// The landing page's Install button beside Play, on the kit's install button: the browser's
// install prompt where it gives one, otherwise that browser's own install steps, and hidden once
// installed. It imports only the kit's install modules, so the landing page loads none of the game
// and registers no service worker.
import { wireInstallButton } from "@andornaut/game-kit/web/pwa/dom/installButton";
import { watchInstall } from "@andornaut/game-kit/web/pwa/dom/installFlow";

// Elements in pages/index.html. The steps dialog holds one section per InstallStepsKind, each
// marked data-steps with its kind and titled by its h2, and its close button, its only button.
const INSTALL_ID = "install";
const STEPS_ID = "install-steps";

// Listens at once: beforeinstallprompt can fire before the page has drawn anything.
const flow = watchInstall(window);
const button = document.getElementById(INSTALL_ID);
const steps = document.getElementById(STEPS_ID);

if (button !== null && steps instanceof HTMLDialogElement) {
  wireInstallButton(flow, button, steps);
}
