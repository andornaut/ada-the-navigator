import { describe, expect, it } from "vitest";

import normal from "../../public/art/ship-jets.json";
import { forwardFlightPlumes, readForwardFlightJets } from "./forwardFlightJets.ts";
import { readEngineJets, travelJets } from "./shipJets.ts";

const fixture = () => ({
  frame: 96,
  headings: normal.headings.map(({ index, mouths }) => ({
    index,
    mouths: mouths.map(({ anchor, half }) => ({ anchor, half })),
  })),
  version: 1,
});

describe("forward flight sidecar", () => {
  it("validates the whole file and retains two indexed mouth identities", () => {
    const data = fixture();
    const tagged = {
      ...data.headings[24]!,
      farMouth: 1,
      tailEdge: [
        [40, 40],
        [43, 50],
      ],
    };
    data.headings[24] = tagged;
    data.headings.reverse();
    const result = readForwardFlightJets(data)!;
    expect(result).toHaveLength(64);
    expect(result[24]).toMatchObject({
      farMouth: 1,
      tailEdge: [
        { x: 40, y: 40 },
        { x: 43, y: 50 },
      ],
    });
    expect(result[24]?.mouths.map(({ anchor }) => [anchor.x, anchor.y])).toEqual(
      tagged.mouths.map(({ anchor }) => anchor),
    );
  });

  it("rejects malformed optional fields, duplicate headings and unusable geometry", () => {
    const edit = (entry: Record<string, unknown>) => {
      const data = fixture();
      return { ...data, headings: [{ ...data.headings[0], ...entry }, ...data.headings.slice(1)] };
    };
    expect(readForwardFlightJets(undefined)).toBeUndefined();
    expect(readForwardFlightJets({ ...fixture(), frame: 42 })).toBeUndefined();
    expect(readForwardFlightJets(edit({ index: 1 }))).toBeUndefined();
    expect(readForwardFlightJets(edit({ farMouth: 2 }))).toBeUndefined();
    expect(
      readForwardFlightJets(
        edit({
          tailEdge: [
            [1, 1],
            [2, 3],
          ],
        }),
      ),
    ).toBeUndefined();
    expect(
      readForwardFlightJets(
        edit({
          farMouth: 0,
          tailEdge: [
            [1, 1],
            [1, 1],
          ],
        }),
      ),
    ).toBeUndefined();
    const [a, b] = fixture().headings[0]!.mouths;
    expect(readForwardFlightJets(edit({ mouths: [a] }))).toBeUndefined();
    expect(readForwardFlightJets(edit({ mouths: [{ ...a, half: [0, 0] }, b] }))).toBeUndefined();
    expect(
      readForwardFlightJets(edit({ mouths: [{ ...a, capCenter: [NaN, 0] }, b] })),
    ).toBeUndefined();
  });

  it("retains selected layers, extends end-on length and supports an authored midpoint", () => {
    const data = fixture();
    const index = 24;
    const profile = data.headings[index]!;
    const rounded = profile.mouths.map((mouth) => ({ ...mouth, capCenter: mouth.anchor }));
    data.headings[index] = { ...profile, mouths: rounded };
    const headings = readForwardFlightJets(data)!;
    const display = { displayHeight: 96, displayWidth: 96, pivot: { x: 0, y: 0 } };
    const normalJets = readEngineJets(normal)!;
    const colors = { core: [0x64caff, 0x64caff], outer: [0x2585d0, 0x2585d0] } as const;
    for (const level of [1, 2, 3]) {
      const jets = travelJets(
        normalJets,
        undefined,
        undefined,
        level,
        "forward",
        level === 1 ? colors : undefined,
      )!;
      const plumes = forwardFlightPlumes(jets, headings[8]!, 8, display, 1)!;
      const { anchor, axis } = jets.headings[8]![0]!;
      const reach = Math.max(...plumes[0]!.points.map(({ y }) => (y - anchor.y) / axis.y));
      expect(reach).toBeCloseTo(37.8, 10);
      expect(plumes.map(({ mouth }) => mouth)).toEqual([0, 0, 1, 1]);
      const shaped = forwardFlightPlumes(jets, headings[index]!, index, display, 0.6)!;
      expect(shaped[0]?.points[shaped[0].points.length - 8]).toEqual(
        headings[index]!.mouths[0].capCenter,
      );
      if (level === 1) {
        expect(plumes.map(({ color }) => color)).toEqual([0x2585d0, 0x64caff, 0x2585d0, 0x64caff]);
      }
    }
  });
});
