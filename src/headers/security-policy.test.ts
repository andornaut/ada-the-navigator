import { describe, expect, it } from "vitest";

import {
  ANALYTICS,
  BASE_DIRECTIVES,
  COMMON_RULE,
  FILE_RULES,
  PAGE_RULES,
} from "./security-policy.ts";

describe("the security headers", () => {
  it("gives each page one policy that runs and styles only same-origin files and the beacon", () => {
    expect(PAGE_RULES.map(({ path }) => path)).toEqual(["/", "/play/*"]);
    for (const { directives } of PAGE_RULES) {
      expect({ ...BASE_DIRECTIVES, ...directives }).toMatchObject({
        "connect-src": ["'self'", "https://cloudflareinsights.com"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "script-src": ["'self'", "https://static.cloudflareinsights.com"],
        "style-src": ["'self'"],
      });
    }
    expect(Object.values(BASE_DIRECTIVES).flat()).not.toContain("'unsafe-inline'");
    // Cloudflare's analytics are the only origins beyond the page's own.
    const origins = Object.values(BASE_DIRECTIVES)
      .flat()
      .filter((source) => source.startsWith("https:"));
    expect(origins.sort()).toEqual([ANALYTICS.report, ANALYTICS.beacon].sort());
  });

  it("allows the screen wake lock the game holds during play, and no device access", () => {
    const policy = new Map(COMMON_RULE.headers).get("Permissions-Policy");
    expect(policy?.split(", ")).toEqual([
      "fullscreen=(self)",
      "screen-wake-lock=(self)",
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
    ]);
  });

  it("caches content-hashed build output for a year, and nothing else", () => {
    expect(FILE_RULES).toEqual([
      expect.objectContaining({
        headers: [["Cache-Control", "public, max-age=31536000, immutable"]],
        path: "/assets/*",
      }),
    ]);
    expect(COMMON_RULE.headers.map(([name]) => name)).not.toContain("Cache-Control");
  });
});
