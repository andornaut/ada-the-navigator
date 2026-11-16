import { expect, it } from "vitest";

import { verifiedJsonFamilies } from "./verifiedJsonFamilies.ts";

const expected = [
  [
    "/art/andromeda/enemies/capital-hardpoints.json",
    "/art/cartwheel/enemies/capital-hardpoints.json",
    "/art/enemies/capital-hardpoints.json",
    "/art/needle/enemies/capital-hardpoints.json",
  ],
  [
    "/art/andromeda/enemies/frigate-hardpoints.json",
    "/art/cartwheel/enemies/frigate-hardpoints.json",
    "/art/enemies/frigate-hardpoints.json",
    "/art/needle/enemies/frigate-hardpoints.json",
  ],
  [
    "/art/andromeda/enemies/hostileStation-hardpoints.json",
    "/art/cartwheel/enemies/hostileStation-hardpoints.json",
    "/art/enemies/hostileStation-hardpoints.json",
  ],
];
it("selects only the eleven approved data URLs in three families from complete discovery", () => {
  const urls = [...expected.flat(), "/art/unapproved/enemies/frigate-hardpoints.json"];
  expect(verifiedJsonFamilies({ sounds: {}, urls })).toEqual(
    expected.map((urls) => ({ responseProfile: "fetch-json-data-v1", urls })),
  );
});
it("rejects missing approved emitted URLs instead of silently reducing coverage", () => {
  for (const missing of expected.flat()) {
    expect(() =>
      verifiedJsonFamilies({ sounds: {}, urls: expected.flat().filter((url) => url !== missing) }),
    ).toThrow(missing);
  }
});
