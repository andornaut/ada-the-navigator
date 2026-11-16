// The security headers the build writes to dist/_headers, which Cloudflare serves with every
// static asset. securityHeadersPlugin adds the hashes of each page's inline <script> and <style>
// blocks to its rule's policy, so this module names only the sources a page loads.
import type { Directives, HeaderList, PageRule } from "@andornaut/game-kit/build/securityHeaders";

// Where the build writes its content-hashed files, as a _headers path pattern.
export const HASHED_ASSET_PATH = "/assets/*";

// Responses without a specific file rule retain platform revalidation, including /sw.js.
export const COMMON_RULE = {
  comment:
    "Every response. The game may request fullscreen and holds a screen wake lock during play; " +
    "the clipboard (the crash screen's Copy) keeps its default of self.",
  headers: [
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    [
      "Permissions-Policy",
      "fullscreen=(self), screen-wake-lock=(self), camera=(), microphone=(), geolocation=(), " +
        "payment=(), usb=()",
    ],
  ] satisfies HeaderList,
  path: "/*",
} as const;

// Cloudflare replaces its default with each explicitly configured cache policy.
export const FILE_RULES = [
  {
    comment:
      "Content-hashed build output: a changed file gets a new name, so a cached copy never " +
      "needs revalidating.",
    headers: [["Cache-Control", "public, max-age=31536000, immutable"]] satisfies HeaderList,
    path: HASHED_ASSET_PATH,
  },
  {
    comment: "Byte-pinned offline game HTML: revalidate without edge-injected scripts.",
    headers: [
      ["Cache-Control", "public, max-age=0, must-revalidate, no-transform"],
    ] satisfies HeaderList,
    path: "/play/*",
  },
] as const;

// Optional Cloudflare Web Analytics on the landing page. Game HTML excludes edge injection;
// only its page rule permits these external script and report origins.
export const ANALYTICS = {
  beacon: "https://static.cloudflareinsights.com",
  report: "https://cloudflareinsights.com",
} as const;

// Every page's policy before its rule's sources and hashes are added. Phaser loads images, the
// SVG art among them, through blob: URLs and its default textures as data: URIs.
export const BASE_DIRECTIVES: Directives = {
  "base-uri": ["'self'"],
  "connect-src": ["'self'"],
  "default-src": ["'self'"],
  "font-src": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "img-src": ["'self'", "data:", "blob:"],
  "manifest-src": ["'self'"],
  "media-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "script-src": ["'self'"],
  "style-src": ["'self'"],
  "worker-src": ["'self'"],
};

// Each built or public HTML page must match exactly one of these, or the build fails: two
// matching policies would join into one header and the browser would enforce both.
export const PAGE_RULES: readonly PageRule[] = [
  {
    comment: "The landing page with optional platform analytics.",
    directives: {
      "connect-src": [ANALYTICS.report],
      "script-src": [ANALYTICS.beacon],
    },
    path: "/",
  },
  { comment: "The game without analytics.", directives: {}, path: "/play/*" },
];
