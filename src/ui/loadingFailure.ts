import {
  type LoadingFailurePresentationView,
  mountLoadingFailure,
} from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";

import { LOADING_LAYER, SCROLL } from "../data/layout.ts";
import type { MountStartupFailure } from "../loading/index.ts";
import {
  bindAdaRecoveryActionRoot,
  createAdaFactoryHoldBinding,
  rootPressGuard,
} from "./actions/index.ts";
import { adaForegroundInput } from "./foregroundInput.ts";
import { loadingFailureLayout } from "./layout/loadingFailureLayout.ts";
import { viewScale } from "./layout/playView.ts";
import { VIEW_SCALE_EVENT } from "./layout/viewScale.ts";

function recoveryUnit(root: HTMLElement): number {
  const viewport = root.ownerDocument.defaultView;
  const scale = viewScale({
    height: viewport?.innerHeight ?? root.clientHeight,
    width: viewport?.innerWidth ?? root.clientWidth,
  });
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function styleLoadingFailureFrame(frame: HTMLDivElement): void {
  frame.className = "ada-loading-failure-frame";
  Object.assign(frame.style, {
    alignItems: "center",
    display: "flex",
    inset: "0",
    justifyContent: "center",
    pointerEvents: "none",
    position: "fixed",
    zIndex: String(LOADING_LAYER - 1),
  });
}

export const loadingFailureChrome = {
  presentation: (root: HTMLElement) => loadingFailureLayout(recoveryUnit(root)),
  styleFrame: styleLoadingFailureFrame,
};

export const mountStartupFailure: MountStartupFailure = ({ onRetry, subscribeRequired }, root) => {
  const frame = root.ownerDocument.createElement("div");
  styleLoadingFailureFrame(frame);
  root.ownerDocument.body.append(frame);
  const recovery = bindAdaRecoveryActionRoot({ guard: rootPressGuard(frame) }, frame);
  const stopRecoveryRequired = subscribeRequired(() => recovery.invalidate());
  const bindHoldAction = createAdaFactoryHoldBinding(
    { current: () => frame.isConnected, slopPx: () => SCROLL.dragThreshold * recoveryUnit(root) },
    frame,
  );
  const failure = (() => {
    let view: LoadingFailurePresentationView | undefined;
    try {
      view = mountLoadingFailure(
        {
          bindHoldAction,
          foregroundInput: adaForegroundInput(root.ownerDocument),
          onRetry,
          presentation: loadingFailureChrome.presentation(root),
        },
        frame,
      );
      recovery.assertBindings();
      return view;
    } catch (error) {
      stopRecoveryRequired();
      recovery.dispose();
      view?.dispose();
      frame.remove();
      throw error;
    }
  })();
  const onScale = () => {
    recovery.invalidate();
    failure.setPresentation(loadingFailureChrome.presentation(root));
  };
  const events = root.ownerDocument.defaultView;
  events?.addEventListener("resize", onScale);
  events?.addEventListener(VIEW_SCALE_EVENT, onScale);
  return {
    dispose() {
      events?.removeEventListener("resize", onScale);
      events?.removeEventListener(VIEW_SCALE_EVENT, onScale);
      failure.dispose();
      frame.remove();
    },
    retireActions() {
      stopRecoveryRequired();
      recovery.dispose();
    },
    update(state) {
      recovery.invalidate();
      failure.update(state);
    },
  };
};
