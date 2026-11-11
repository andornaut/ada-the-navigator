import type { InstallOutcome, InstallState, MenuInstallBrowser } from "../pwa/index.ts";

// The install functions the Settings Install row uses (src/pwa/index.ts), passed in so the row
// works the same in tests.
export interface InstallPort {
  install(): Promise<InstallOutcome>;
  menuBrowser(): MenuInstallBrowser | undefined;
  offers(state: InstallState): boolean;
  onChange(listener: (state: InstallState) => void): () => void;
  state(): InstallState;
}

// Shows the Install row now and again on each install-state change, as in Archie: only while
// the game can be installed. Returns the function that stops watching.
export function watchInstallRow(port: InstallPort, show: (shown: boolean) => void): () => void {
  show(port.offers(port.state()));
  return port.onChange((state) => show(port.offers(state)));
}

// The Install button: asks for the browser's prompt at once, while the tap still counts as the
// player's gesture, or opens the steps for the browser's own menu while Settings still shows.
export function startInstall(
  port: InstallPort,
  openSteps: (browser: MenuInstallBrowser) => void,
  active: () => boolean,
): Promise<void> {
  return port.install().then((outcome) => {
    const browser = port.menuBrowser();
    if (outcome === "menuSteps" && browser !== undefined && active()) {
      openSteps(browser);
    }
  });
}
