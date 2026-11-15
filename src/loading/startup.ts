import {
  createLoadingAttempts,
  type LoadingAttempt,
  type LoadingAttemptState,
  type RequiredLoading,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";
import type { CrashScreen } from "@andornaut/game-kit/runtime/web/crash/dom/crashScreen";
import {
  type LoadingFailurePresentation,
  mountLoadingFailure,
} from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";

import { FRAME_LINE, TEXT_BUTTON } from "../data/layout.ts";
import {
  type BackgroundLoadingPresentation,
  observeInstallation,
} from "../pwa/installationPresentation.ts";
import { viewScale } from "../ui/layout/playView.ts";
import { VIEW_SCALE_EVENT } from "../ui/layout/viewScale.ts";
import { LOADING_LAYER } from "../ui/loadingBar.ts";
import { TEXT_TOKENS } from "../ui/modal.ts";
import { EntryReloadRequired } from "./entryRecovery.ts";
import { loadingProgress, mountLoading } from "./progress.ts";

export const startupFence = { crashed: false };

export interface RequiredGame {
  prepare(required: RequiredLoading, attempt: LoadingAttempt): void | Promise<void>;
  load(attempt: LoadingAttempt): Promise<void>;
  commit(): void;
  dispose(): void;
}

/** One page owns the registry, failure presenter and existing bar through every Retry. */
export async function startLoading(
  required: RequiredLoading,
  crash: Pick<CrashScreen, "stopGameOnCrash">,
  loadGame: () => Promise<RequiredGame>,
  root: HTMLElement,
): Promise<() => void> {
  const stop = mountLoading(root);
  let game: RequiredGame | undefined;
  let background: BackgroundLoadingPresentation | undefined;
  const presentation = (): LoadingFailurePresentation => {
    const scale = viewScale({ height: root.clientHeight, width: root.clientWidth });
    const unit = Number.isFinite(scale) && scale > 0 ? scale : 1;
    return {
      action: {
        borderWidthPx: FRAME_LINE * unit,
        heightPx: TEXT_BUTTON.height * unit,
        highlightHeightPx: FRAME_LINE * unit,
        paddingBottomPx: TEXT_BUTTON.lipHeight * unit,
        paddingXPx: TEXT_BUTTON.inset * unit,
        shadeHeightPx: TEXT_BUTTON.lipHeight * unit,
        widthPx: 128 * unit,
      },
      palette: {
        action: "#bfa06f",
        actionText: TEXT_TOKENS.buttonLabel,
        border: "#181425",
        highlight: "#d2b886",
        lip: "#2f2d3d",
        panel: "#3b3850",
        shade: "#8a7148",
        shadow: "#181425",
        text: TEXT_TOKENS.label,
      },
      panel: {
        bodyActionGapPx: 24,
        borderWidthPx: 1,
        lipHeightPx: 4,
        maxWidthPx: 328,
        paddingBottomPx: 16,
        paddingTopPx: 24,
        paddingXPx: 16,
        safeInsetPx: 16,
        shadowOffsetPx: 4,
        titleBodyGapPx: 16,
      },
      text: {
        action: { lineHeight: 1.2, sizePx: 18, weight: 700 },
        body: { lineHeight: 1.45, sizePx: 18, weight: 400 },
        title: { lineHeight: 1.2, sizePx: 24, weight: 700 },
      },
    };
  };
  const frame = root.ownerDocument.createElement("div");
  frame.className = "ada-loading-failure-frame";
  root.ownerDocument.body.append(frame);
  const failure = mountLoadingFailure(
    {
      async onRetry() {
        if (disposed || startupFence.crashed) {
          return;
        }
        try {
          const needsDocument = [moduleAttempt.state, gameAttempt.state].some(
            (state) => state.kind === "failed" && state.error instanceof EntryReloadRequired,
          );
          if (needsDocument) {
            dispose();
            root.ownerDocument.defaultView!.location.reload();
            return;
          }
          if (required.state.kind === "ready" && background?.state.kind === "failed") {
            await background.retry();
          } else {
            await required.retry();
          }
        } catch (error) {
          dispose();
          reportError(error);
        }
      },
      presentation: presentation(),
    },
    frame,
  );
  const onScale = () => failure.setPresentation(presentation());
  const events = root.ownerDocument.defaultView;
  events?.addEventListener("resize", onScale);
  events?.addEventListener(VIEW_SCALE_EVENT, onScale);
  // Required entry and offline installation have independent attempt number domains.
  let presentationRevision = 0;
  const showFailure = (state: LoadingAttemptState) => {
    failure.update({ ...state, attempt: ++presentationRevision });
  };
  Object.assign(frame.style, {
    alignItems: "center",
    display: "flex",
    inset: "0",
    justifyContent: "center",
    pointerEvents: "none",
    position: "fixed",
    zIndex: String(LOADING_LAYER - 1),
  });
  const moduleAttempt = createLoadingAttempts({
    async load(attempt) {
      const loaded = await loadGame();
      if (!attempt.isCurrent() || startupFence.crashed) {
        return;
      }
      game = loaded;
      await loaded.prepare(required, attempt);
    },
    onState() {
      required.invalidate();
    },
  });
  const gameAttempt = createLoadingAttempts({
    async load(attempt) {
      if (!startupFence.crashed) {
        await game!.load(attempt);
      }
    },
    onState() {
      required.invalidate();
    },
  });
  const unobserveModule = required.observe({
    retry: () => moduleAttempt.retry(),
    status: () =>
      moduleAttempt.state.kind === "ready"
        ? "ready"
        : moduleAttempt.state.kind === "failed"
          ? "failed"
          : "loading",
  });
  let unobserveGame: (() => void) | undefined;
  const stopPrepare = required.wait(() => {
    if (startupFence.crashed) {
      return;
    }
    // The public registry rechecks readiness between waiters after this late registration.
    unobserveGame = required.observe({
      retry: () => gameAttempt.retry(),
      status: () =>
        gameAttempt.state.kind === "ready"
          ? "ready"
          : gameAttempt.state.kind === "failed"
            ? "failed"
            : "loading",
    });
    void gameAttempt.start().catch((error) => {
      dispose();
      reportError(error);
    });
  });
  const stopCommit = required.wait(() => {
    if (!startupFence.crashed) {
      game!.commit();
    }
  });
  let pending: ProgressHandle | undefined;
  const unsubscribe = required.subscribe((state) => {
    if (state.kind === "loading") {
      pending ??= loadingProgress.begin();
    } else {
      pending?.finish();
      pending = undefined;
    }
    showFailure(state.kind === "ready" && background !== undefined ? background.state : state);
  });
  const stopInstallation = observeInstallation((view) => {
    background = view;
    if (required.state.kind === "ready") {
      showFailure(view.state);
    }
  });
  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    stopPrepare();
    stopCommit();
    unsubscribe();
    stopInstallation();
    moduleAttempt.dispose();
    gameAttempt.dispose();
    game?.dispose();
    required.dispose();
    unobserveModule();
    unobserveGame?.();
    pending?.finish();
    events?.removeEventListener("resize", onScale);
    events?.removeEventListener(VIEW_SCALE_EVENT, onScale);
    failure.dispose();
    frame.remove();
    stop();
  };
  crash.stopGameOnCrash(() => {
    startupFence.crashed = true;
    dispose();
  });
  try {
    await moduleAttempt.start();
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
