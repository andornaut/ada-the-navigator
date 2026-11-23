// Paint for Cartwheel's existing hostile hull. New station variants use a separate exporter.
// All coordinates are inside the existing top polygon shared by the sixteen headings.
const centerX = 200;
const centerY = 184;
const ratio = 0.577;
const palette: Readonly<Record<string, string>> = {
  "#924e28": "#29374c",
  "#bd7042": "#495d78",
  "#703921": "#334159",
  "#b5a998": "#4e637e",
  "#fa6d38": "#8dc8d0",
};

function armorPanels(): string {
  const outer = 169;
  const inner = 132;
  const polar = (radius: number, angle: number) => {
    const theta = (angle * Math.PI) / 180;
    return `${(centerX + radius * Math.cos(theta)).toFixed(2)} ${(centerY + ratio * radius * Math.sin(theta)).toFixed(2)}`;
  };
  return Array.from({ length: 4 }, (_, index) => {
    const start = index * 90 + 4;
    const end = start + 82;
    const path = `M${polar(outer, start)}A${outer} ${outer * ratio} 0 0 1 ${polar(outer, end)}L${polar(inner, end)}A${inner} ${inner * ratio} 0 0 0 ${polar(inner, start)}Z`;
    return `<path d="${path}" fill="#607891"/>`;
  }).join("");
}

const armor = armorPanels();
const vault = `
  <ellipse cx="200" cy="184" rx="124" ry="68" fill="#354963"/>
  <path d="M133 164H267V177A67 38 0 0 1 133 177Z" fill="#304967"/>
  <ellipse cx="200" cy="164" rx="67" ry="38" fill="#6b829b"/>
  <path d="M160 130H240V145A40 23 0 0 1 160 145Z" fill="#456680"/>
  <ellipse cx="200" cy="130" rx="40" ry="23" fill="#91abc0"/>
`;

function glazing(): string {
  const windows = [3, 11, 19]
    .map((x) => `<rect x="${x}" y="2" width="4.5" height="4.5" fill="#c6edf2"/>`)
    .join("");
  const run = `<g transform="translate(161 189)"><rect width="27" height="9" fill="#273951"/>${windows}</g>`;
  return `${run}<g transform="translate(400 0) scale(-1 1)">${run}</g>`;
}

export function claimStationPaint(file: string, hull: string): string {
  const heading = /^hostileStation-(\d+)\.svg$/u.exec(file);
  if (!heading) return hull;
  const painted = hull.replace(/#[0-9a-f]{6}\b/gu, (colour) => palette[colour] ?? colour);
  // One centred pixel group stays fixed on the crown through the heading sequence.
  const scanner = '<rect x="197" y="128" width="6" height="4" fill="#c6edf2"/>';
  return painted.replace("</svg>", armor + vault + glazing() + scanner + "</svg>");
}
