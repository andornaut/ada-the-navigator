import { describe, expect, it } from "vitest";

import { homePageHtml, webManifestJson } from "./html.ts";

const copy = { description: 'Ada & Penny "fly" <far>' } as const;

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
