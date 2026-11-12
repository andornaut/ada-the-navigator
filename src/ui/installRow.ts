import type { InstallOutcome, InstallState, InstallStepsKind } from "../pwa/index.ts";

// The install functions the Settings Install row uses (src/pwa/index.ts), passed in so the row
// works the same in tests.
export interface InstallPort {
  install(): Promise<InstallOutcome>;
  stepsKind(): InstallStepsKind;
  offers(state: InstallState): boolean;
  onChange(listener: (state: InstallState) => void): () => void;
  state(): InstallState;
}

// Shows the Install row now and again on each install-state change, as in Archie: in every state
// but installed. Returns the function that stops watching.
export function watchInstallRow(port: InstallPort, show: (shown: boolean) => void): () => void {
  show(port.offers(port.state()));
  return port.onChange((state) => show(port.offers(state)));
}

// The Install button: asks for the browser's prompt at once, while the tap still counts as the
// player's gesture, or opens the browser's own install steps while Settings still shows.
export function startInstall(
  port: InstallPort,
  openSteps: (kind: InstallStepsKind) => void,
  active: () => boolean,
): Promise<void> {
  return port.install().then((outcome) => {
    if (outcome === "steps" && active()) {
      openSteps(port.stepsKind());
    }
  });
}
