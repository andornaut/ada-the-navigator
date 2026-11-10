import type { Vec } from "../model/types.ts";

interface SceneryDetail {
  readonly kind: "faceted-rock" | "ribbed-bulkhead" | "panel-mass";
  readonly outline: readonly Vec[];
  readonly seams: readonly (readonly [Vec, Vec])[];
}

// Normalized decoration stays within the existing rock ellipse and circular collider.
const DETAILS: readonly SceneryDetail[] = [
  {
    kind: "faceted-rock",
    outline: [
      { x: -0.72, y: -0.18 },
      { x: -0.3, y: -0.52 },
      { x: 0.44, y: -0.4 },
      { x: 0.78, y: 0.05 },
      { x: 0.28, y: 0.49 },
      { x: -0.46, y: 0.4 },
    ],
    seams: [
      [
        { x: -0.3, y: -0.52 },
        { x: 0.1, y: 0.02 },
      ],
      [
        { x: 0.1, y: 0.02 },
        { x: 0.78, y: 0.05 },
      ],
      [
        { x: 0.1, y: 0.02 },
        { x: -0.46, y: 0.4 },
      ],
    ],
  },
  {
    kind: "ribbed-bulkhead",
    outline: [
      { x: -0.62, y: -0.32 },
      { x: 0.62, y: -0.32 },
      { x: 0.62, y: 0.32 },
      { x: -0.62, y: 0.32 },
    ],
    seams: [-0.32, 0, 0.32].map(
      (x) =>
        [
          { x, y: -0.32 },
          { x, y: 0.32 },
        ] as const,
    ),
  },
  {
    kind: "panel-mass",
    outline: [
      { x: -0.7, y: -0.2 },
      { x: -0.3, y: -0.2 },
      { x: -0.3, y: -0.45 },
      { x: 0.45, y: -0.45 },
      { x: 0.45, y: -0.1 },
      { x: 0.72, y: -0.1 },
      { x: 0.72, y: 0.32 },
      { x: -0.7, y: 0.32 },
    ],
    seams: [
      [
        { x: -0.3, y: -0.2 },
        { x: -0.3, y: 0.32 },
      ],
      [
        { x: 0.45, y: -0.1 },
        { x: 0.45, y: 0.32 },
      ],
      [
        { x: -0.3, y: -0.1 },
        { x: 0.45, y: -0.1 },
      ],
    ],
  },
];

/** Object identity alone selects decoration; movement and collection order cannot change it. */
export function sceneryDetail(id: string): SceneryDetail {
  let hash = 0;
  for (const character of id) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  }
  return DETAILS[hash % DETAILS.length]!;
}
