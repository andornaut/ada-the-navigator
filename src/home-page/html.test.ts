import { describe, expect, it } from "vitest";

import { SHIPPED_SHIP_SOURCES } from "../testing/shippedShipSources.ts";
import { homePageHtml, prebootShipHtml, webManifestJson } from "./html.ts";

const copy = { description: 'Ada & Penny "fly" <far>', mobile: "Tap {use} & go." } as const;

describe("the landing page's and manifest's copy", () => {
  it("fills every description token in the page, escaped", () => {
    expect(
      homePageHtml(copy, '<meta content="%HOME_DESCRIPTION%" /><p>%HOME_DESCRIPTION%</p>'),
    ).toBe(
      '<meta content="Ada &amp; Penny &quot;fly&quot; &lt;far&gt;" />' +
        "<p>Ada &amp; Penny &quot;fly&quot; &lt;far&gt;</p>",
    );
    expect(homePageHtml(copy, "<p>No tokens</p>")).toBe("<p>No tokens</p>");
  });

  it("follows each control named in the Mobile line with its icon", () => {
    expect(homePageHtml(copy, "<p>%HOME_MOBILE%</p>")).toBe(
      '<p>Tap <span class="ada-control-help">Use<img class="ada-control-icon" data-control="use" ' +
        'src="/art/ui/sprites/icon-use-control.png" alt="" aria-hidden="true" width="16" ' +
        'height="16"></span> &amp; go.</p>',
    );
  });

  it("refuses a token it has no string for", () => {
    expect(() => homePageHtml(copy, "%HOME_PITCH%")).toThrow("Unknown home page copy token PITCH");
  });

  it("writes the description into the manifest as JSON, and refuses a manifest without it", () => {
    expect(JSON.parse(webManifestJson(copy, '{"description": "%HOME_DESCRIPTION%"}'))).toEqual({
      description: copy.description,
    });
    expect(() => webManifestJson(copy, '{"description": "Fixed"}')).toThrow(
      'manifest.webmanifest has no "%HOME_DESCRIPTION%" description',
    );
  });
});

it("resolves landing and splash Classic images before either document runs a script", () => {
  const sources = SHIPPED_SHIP_SOURCES!;
  for (const [token, heading] of [
    ["%CLASSIC_SHIP_26%", 26],
    ["%CLASSIC_SHIP_40%", 40],
  ] as const) {
    expect(prebootShipHtml(`<img src="${token}">`, sources)).toBe(
      `<img src="${sources.standaloneClassic(heading)?.url}">`,
    );
  }
});
