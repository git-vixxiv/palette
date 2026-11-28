/**
 * Color Science and Analysis Utilities
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/** A role the user has chosen for a colour. */
export type AssignedRole = "primary" | "secondary" | "accent" | "neutral-light" | "neutral-dark";
/**
 * "general" means the user has not said what the colour is for. The engine
 * then decides the structure itself (see planRoles / resolveRoles in
 * paletteEngine).
 */
export type ColorRole = AssignedRole | "general";

export interface ColorItem {
  hex: string;
  role: ColorRole;
  locked: boolean;
}

export type HarmonyMode = "analogous" | "monochromatic" | "complementary" | "triadic" | "tetradic" | "split" | "random";

// Convert HEX string to RGB object
export function hexToRgb(hex: string): RGB {
  // Normalize hex
  let c = hex.replace(/^#/, "");
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Convert RGB to HEX string
export function rgbToHex({ r, g, b }: RGB): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

// Convert RGB to HSL
export function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Convert HSL to RGB
export function hslToRgb({ h, s, l }: HSL): RGB {
  h /= 360;
  s /= 100;
  l /= 100;
  let r = l;
  let g = l;
  let b = l;

  if (s !== 0) {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// Retrieve relative luminance of RGB color
// WCAG 2.0 formula
export function getLuminance({ r, g, b }: RGB): number {
  const parts = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}

// Calculate WCAG contrast ratio between two HEX colors
export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const l1 = getLuminance(rgb1);
  const l2 = getLuminance(rgb2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (brighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

// Check WCAG compliance level
// AAA: >= 7.0 for normal, >= 4.5 for large
// AA: >= 4.5 for normal, >= 3.0 for large
export function getContrastRating(ratio: number) {
  return {
    aaa: ratio >= 7.0,
    aaaLarge: ratio >= 4.5,
    aa: ratio >= 4.5,
    aaLarge: ratio >= 3.0,
  };
}

// Generate a random high-quality HEX color
export function getRandomHex(): string {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Palette generation and scoring live in ./paletteEngine.

export const COLOR_NAMES: { hex: string; name: string }[] = [
  { hex: "#000000", name: "Absolute Obsidian" },
  { hex: "#111111", name: "Deep Charcoal" },
  { hex: "#1A1A24", name: "Midnight Navy" },
  { hex: "#2C3E50", name: "Slate Blue" },
  { hex: "#34495E", name: "Steel Gray" },
  { hex: "#18BC9C", name: "Emerald Teal" },
  { hex: "#2ECC71", name: "Forest Mint" },
  { hex: "#3498DB", name: "Sky Blue" },
  { hex: "#9B59B6", name: "Royal Amethyst" },
  { hex: "#F1C40F", name: "Golden Amber" },
  { hex: "#E67E22", name: "Terracotta Orange" },
  { hex: "#E74C3C", name: "Crimson Scarlet" },
  { hex: "#ECF0F1", name: "Soft Alabaster" },
  { hex: "#95A5A6", name: "Cool Platinum" },
  { hex: "#7F8C8D", name: "Muted Asphalt" },
  { hex: "#FF5A5F", name: "Coral Rose" },
  { hex: "#00A699", name: "Dark Teal" },
  { hex: "#FC642D", name: "Vibrant Tangerine" },
  { hex: "#484848", name: "Slate Gray" },
  { hex: "#FFFFFF", name: "Pure Lily White" },
  { hex: "#F8F9FA", name: "Warm Off-White" },
  { hex: "#6366F1", name: "Classic Indigo" },
  { hex: "#10B981", name: "Vibrant Emerald" },
  { hex: "#F59E0B", name: "Bright Amber" },
  { hex: "#EF4444", name: "Bright Crimson" },
  { hex: "#3B82F6", name: "Pacific Blue" },
  { hex: "#8B5CF6", name: "Soft Clover Violet" },
  { hex: "#EC4899", name: "Dusty Blush Rose" },
  { hex: "#14B8A6", name: "Mediterranean Teal" },
  { hex: "#F43F5E", name: "Rose Indigo" },
  { hex: "#2DD4BF", name: "Oceanic Turquoise" },
  { hex: "#A855F7", name: "Midnight Orchid" },
  { hex: "#E2E8F0", name: "Cool Gray Alabaster" },
  { hex: "#0F172A", name: "Dark Slate Abyss" },
  { hex: "#F8FAFC", name: "Pristine Ice White" },
  { hex: "#475569", name: "Sophisticated Slate" },
  { hex: "#D97706", name: "Burnt Toffee" },
  { hex: "#059669", name: "Forest Grass Green" },
  { hex: "#2563EB", name: "Deep Royal Cobalt" },
  { hex: "#7C3AED", name: "Imperial Clover Lavender" },
  { hex: "#DB2777", name: "Rich Berry Pink" },
  { hex: "#D1FAE5", name: "Pale Mint Sage" },
  { hex: "#FEE2E2", name: "Whisper Coral Pink" },
  { hex: "#FEF3C7", name: "Soft Sand Cream" },
  { hex: "#E0F2FE", name: "Glacier Ice Blue" },
  { hex: "#F5F3FF", name: "Lavender Chalk Gray" },
  { hex: "#1E293B", name: "Slate Pearl Blue" },
  { hex: "#0284C7", name: "Azure Sky Blue" },
  { hex: "#0891B2", name: "Bright Turquoise Cyan" },
  { hex: "#4B5563", name: "Mineral Ash Gray" },
  { hex: "#9CA3AF", name: "Pebble Stone Gray" },
  { hex: "#D1D5DB", name: "Light Cloud Gray" },
  { hex: "#E5E7EB", name: "Metallic Fog Gray" },
  { hex: "#F3F4F6", name: "Chalkboard Off-White" },
  { hex: "#F9FAFB", name: "Porcelain Ice" },
  { hex: "#78350F", name: "Rustic Cacao Brown" },
  { hex: "#064E3B", name: "Deep Sage Forest" },
  { hex: "#1E1B4B", name: "Twilight Purple Midnight" },
  { hex: "#831843", name: "Deep Mulberry Crimson" },
  { hex: "#1E3A8A", name: "Dark Indigo Ocean" },
  { hex: "#E76F51", name: "Vapor Terracotta Rose" },
  { hex: "#F4A261", name: "Golden Apricot Sunset" },
  { hex: "#E9C46A", name: "Calm Ochre Sand" },
  { hex: "#2A9D8F", name: "Earthy Sage Teal" },
  { hex: "#264653", name: "Deep Abyssal Teal" },
  { hex: "#E07A5F", name: "Muted Brick Orange" },
  { hex: "#3D405B", name: "Stormy Deep Blue-Gray" },
  { hex: "#81B29A", name: "Earthy Pastel Mint" },
  { hex: "#F4F1DE", name: "Warm Linen Cream" },
  { hex: "#F2CC8F", name: "Oatmeal Sandy Gold" },
];

export function getColorName(hex: string): string {
  let rgb;
  try {
    rgb = hexToRgb(hex);
  } catch (e) {
    return "Custom Hue";
  }

  let minDistance = Infinity;
  let bestName = "Custom Hue";

  for (const item of COLOR_NAMES) {
    let itemRgb;
    try {
      itemRgb = hexToRgb(item.hex);
    } catch (e) {
      continue;
    }
    const d = Math.sqrt(
      Math.pow(rgb.r - itemRgb.r, 2) +
      Math.pow(rgb.g - itemRgb.g, 2) +
      Math.pow(rgb.b - itemRgb.b, 2)
    );
    if (d < minDistance) {
      minDistance = d;
      bestName = item.name;
    }
  }

  return bestName;
}
