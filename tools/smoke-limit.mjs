// The browser smoke's whole-run limit, shared by the smoke (browser-smoke.mjs) and the preview
// server it runs against (browser-check.mjs serve), which outlives it by PREVIEW_MARGIN_SECONDS.
// The canvas renders at its device-pixel backing in software GL.
export const SMOKE_LIMIT_SECONDS = 300;
export const PREVIEW_MARGIN_SECONDS = 30;
