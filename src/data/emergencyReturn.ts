import jump from "../../public/art/quantum-jump.json" with { type: "json" };

export const EMERGENCY_RETURN = {
  key: "emergency-return",
  layers: { dialogue: 1001, jump: 1000 },
  line: "Shields are down. We need to jump to safety!",
  shield: {
    age: 0.2,
    colour: Number.parseInt(jump.emergency.charge.wash.colour.slice(1), 16),
    damagedColour: 0x300c14,
    sectorEnd: -Math.PI / 4,
    sectorStart: (-3 * Math.PI) / 4,
  },
  visibleSeconds: 3,
} as const;
