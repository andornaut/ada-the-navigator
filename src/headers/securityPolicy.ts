// The security headers the build writes to dist/_headers, which Cloudflare serves with every
// static asset. securityHeadersPlugin adds the hashes of each page's inline <script> and <style>
// blocks to its rule's policy, so this module names only the sources a page loads.
import type {
  Directives,
  HeaderList,
  PageRule,
} from "@andornaut/game-kit/web/headers/securityHeaders";

// Where the build writes its content-hashed files, as a _headers path pattern.
export const HASHED_ASSET_PATH = "/assets/*";

// On every response. No Cache-Control: every file but FILE_RULES' hashed build output keeps the
// platform default (max-age=0, must-revalidate), which the service worker relies on to see a new
// /sw.js on the next launch.
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

// Headers for files rather than pages. Cloudflare sets a header a rule names, replacing its own.
export const FILE_RULES = [
  {
    comment:
      "Content-hashed build output: a changed file gets a new name, so a cached copy never " +
      "needs revalidating.",
    headers: [["Cache-Control", "public, max-age=31536000, immutable"]] satisfies HeaderList,
    path: HASHED_ASSET_PATH,
  },
] as const;

// Cloudflare's Web Analytics, which Cloudflare injects into each page at its edge: the beacon
// script and the endpoint it reports to. The only origins the policy allows beyond 'self'.
export const ANALYTICS = {
  beacon: "https://static.cloudflareinsights.com",
  report: "https://cloudflareinsights.com",
} as const;

// Every page's policy before its rule's sources and hashes are added. Phaser loads images, the
// SVG art among them, through blob: URLs and its default textures as data: URIs.
export const BASE_DIRECTIVES: Directives = {
  "base-uri": ["'self'"],
  "connect-src": ["'self'", ANALYTICS.report],
  "default-src": ["'self'"],
  "font-src": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "img-src": ["'self'", "data:", "blob:"],
  "manifest-src": ["'self'"],
  "media-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "script-src": ["'self'", ANALYTICS.beacon],
  "style-src": ["'self'"],
  "worker-src": ["'self'"],
};

// Each built or public HTML page must match exactly one of these, or the build fails: two
// matching policies would join into one header and the browser would enforce both.
export const PAGE_RULES: readonly PageRule[] = [
  { comment: "The landing page.", directives: {}, path: "/" },
  { comment: "The game.", directives: {}, path: "/play/*" },
];
