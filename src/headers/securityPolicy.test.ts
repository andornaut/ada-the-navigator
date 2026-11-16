import { pageRules, renderPolicy } from "@andornaut/game-kit/build/securityHeaders";
import { describe, expect, it } from "vitest";

import {
  ANALYTICS,
  BASE_DIRECTIVES,
  COMMON_RULE,
  FILE_RULES,
  PAGE_RULES,
} from "./securityPolicy.ts";

describe("the security headers", () => {
  it("keeps analytics only on the landing page under the published additive policy merge", () => {
    expect(PAGE_RULES.map(({ path }) => path)).toEqual(["/", "/play/*"]);
    const policies = pageRules(
      BASE_DIRECTIVES,
      PAGE_RULES,
      new Map([
        ["/", { scriptHashes: [], styleHashes: [] }],
        ["/play/", { scriptHashes: [], styleHashes: [] }],
      ]),
    );
    const policyAt = (path: string) =>
      new Map(policies.find((rule) => rule.path === path)!.headers).get("Content-Security-Policy")!;
    expect(policyAt("/")).toContain(`script-src 'self' ${ANALYTICS.beacon}`);
    expect(policyAt("/")).toContain(`connect-src 'self' ${ANALYTICS.report}`);
    expect(policyAt("/play/*")).toBe(renderPolicy(BASE_DIRECTIVES));
    expect(policyAt("/play/*")).not.toContain("cloudflareinsights");
    expect(BASE_DIRECTIVES).toMatchObject({
      "connect-src": ["'self'"],
      "frame-ancestors": ["'none'"],
      "img-src": ["'self'", "data:", "blob:"],
      "object-src": ["'none'"],
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "worker-src": ["'self'"],
    });
    expect(Object.values(BASE_DIRECTIVES).flat()).not.toContain("'unsafe-inline'");
    expect(
      Object.values(BASE_DIRECTIVES)
        .flat()
        .filter((source) => source.startsWith("https:")),
    ).toEqual([]);
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

  it("keeps hashed assets immutable and game HTML byte-stable without changing worker revalidation", () => {
    expect(FILE_RULES).toEqual([
      expect.objectContaining({
        headers: [["Cache-Control", "public, max-age=31536000, immutable"]],
        path: "/assets/*",
      }),
      expect.objectContaining({
        headers: [["Cache-Control", "public, max-age=0, must-revalidate, no-transform"]],
        path: "/play/*",
      }),
    ]);
    expect(COMMON_RULE.headers.map(([name]) => name)).not.toContain("Cache-Control");
  });
});
