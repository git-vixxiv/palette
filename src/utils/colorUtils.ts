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

export type ColorRole = "primary" | "secondary" | "accent" | "neutral-light" | "neutral-dark";

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

// Generate color based on HSL offset
export function offsetColor(baseHsl: HSL, hOffset: number, sOffset = 0, lOffset = 0): string {
  const h = (baseHsl.h + hOffset + 360) % 360;
  const s = Math.max(0, Math.min(100, baseHsl.s + sOffset));
  const l = Math.max(0, Math.min(100, baseHsl.l + lOffset));
  return rgbToHex(hslToRgb({ h, s, l }));
}

// Generate a list of harmonious HEX colors according to established color science with dynamic and randomized variations
export function generateHarmony(mode: HarmonyMode, baseHex?: string, numColors: number = 5): string[] {
  const base = baseHex ? hexToRgb(baseHex) : hexToRgb(getRandomHex());
  const baseHsl = rgbToHsl(base);
  const palette: string[] = [rgbToHex(base)];

  switch (mode) {
    case "analogous": {
      // Neighboring colors with step size randomization and slight saturation/lightness jitter
      const step = Math.floor(Math.random() * 20) + 15; // 15 to 35 deg steps
      const directionPattern = Math.random() > 0.5 ? 1 : -1;
      for (let i = 1; i < numColors; i++) {
        const offset = Math.ceil(i / 2) * step * (i % 2 === 0 ? 1 : -1) * directionPattern;
        const sJitter = Math.floor(Math.random() * 16) - 8; // -8 to 8
        const lJitter = Math.floor(Math.random() * 16) - 8; // -8 to 8
        palette.push(offsetColor(baseHsl, offset, sJitter, lJitter));
      }
      break;
    }

    case "monochromatic": {
      // Same Hue, varying Saturation & Lightness with randomized offsets to ensure diversity
      for (let i = 1; i < numColors; i++) {
        // Random Saturation shift (-30 to +15), Lightness shift distributed across the scale
        const sOffset = Math.floor(Math.random() * 41) - 25; // -25 to +15
        const lOffset = Math.floor(Math.random() * 61) - 30; // -30 to +30
        palette.push(offsetColor(baseHsl, 0, sOffset, lOffset));
      }
      break;
    }

    case "complementary": {
      // Base, minor variation, target opposite (180 deg) and its splits with randomized jitters
      const complementaryJitter = Math.floor(Math.random() * 30) - 15; // -15 to +15 deg
      for (let i = 1; i < numColors; i++) {
        if (i % 2 === 1) {
          // complementary offsets
          const angle = 180 + complementaryJitter + (Math.floor(i / 2) * 15);
          const sOffset = Math.floor(Math.random() * 21) - 10;
          const lOffset = Math.floor(Math.random() * 21) - 10;
          palette.push(offsetColor(baseHsl, angle, sOffset, lOffset));
        } else {
          // adjacent base offsets
          const angle = complementaryJitter + ((i / 2) * 20);
          const sOffset = Math.floor(Math.random() * 21) - 10;
          const lOffset = Math.floor(Math.random() * 21) - 10;
          palette.push(offsetColor(baseHsl, angle, sOffset, lOffset));
        }
      }
      break;
    }

    case "triadic": {
      // 120 and 240 degrees offsets with slight randomized variants
      const triadicJitter = Math.floor(Math.random() * 20) - 10; // -10 to +10 deg
      for (let i = 1; i < numColors; i++) {
        const stepAngle = i % 3 === 0 ? 0 : (i % 3 === 1 ? 120 : 240);
        const angle = stepAngle + triadicJitter + (Math.floor(i / 3) * 15);
        const sOffset = Math.floor(Math.random() * 21) - 10;
        const lOffset = Math.floor(Math.random() * 21) - 10;
        palette.push(offsetColor(baseHsl, angle, sOffset, lOffset));
      }
      break;
    }

    case "tetradic": {
      // Double complementary (90, 180, 270 deg) with minor variations
      const tetradicJitter = Math.floor(Math.random() * 20) - 10;
      for (let i = 1; i < numColors; i++) {
        const stepAngle = (i % 4) * 90;
        const angle = stepAngle + tetradicJitter + (Math.floor(i / 4) * 12);
        const sOffset = Math.floor(Math.random() * 21) - 10;
        const lOffset = Math.floor(Math.random() * 21) - 10;
        palette.push(offsetColor(baseHsl, angle, sOffset, lOffset));
      }
      break;
    }

    case "split": {
      // Base, opposite adjacent angles (150 and 210 deg) with soft jitter
      const splitJitter = Math.floor(Math.random() * 20) - 10;
      for (let i = 1; i < numColors; i++) {
        const stepAngle = i % 2 === 1 ? 150 : 210;
        const angle = stepAngle + splitJitter + (Math.floor(i / 2) * 12);
        const sOffset = Math.floor(Math.random() * 21) - 10;
        const lOffset = Math.floor(Math.random() * 21) - 10;
        palette.push(offsetColor(baseHsl, angle, sOffset, lOffset));
      }
      break;
    }

    case "random":
    default:
      // High visual diversity
      for (let i = 1; i < numColors; i++) {
        palette.push(getRandomHex());
      }
      break;
  }

  // Ensure returning exactly numColors
  while (palette.length < numColors) {
    palette.push(getRandomHex());
  }
  return palette.slice(0, numColors);
}

// Calculate the quality score (0 to 100) and evaluation comments of a palette
export function scorePalette(colors: ColorItem[], harmonyMode: HarmonyMode): {
  score: number;
  breakdown: {
    roles: number; // Max 30
    contrast: number; // Max 40
    harmony: number; // Max 30
  };
  tips: string[];
} {
  const tips: string[] = [];
  let rolesScore = 0;
  let contrastScore = 0;
  let harmonyScore = 0;

  // 1. Roles score evaluation
  const roleCounts = colors.reduce((acc, curr) => {
    acc[curr.role] = (acc[curr.role] || 0) + 1;
    return acc;
  }, {} as Record<ColorRole, number>);

  if (roleCounts.primary > 0) rolesScore += 10;
  else tips.push("Assign at least one 'primary' color to define your identity.");

  if (roleCounts.secondary > 0) rolesScore += 8;
  else tips.push("Assign at least one 'secondary' color to balance your layout.");

  if (roleCounts.accent > 0) rolesScore += 8;
  else tips.push("An 'accent' color is recommended to highlight key calls-to-action (CTAs).");

  if (roleCounts["neutral-light"] > 0 || roleCounts["neutral-dark"] > 0) {
    rolesScore += 4;
  } else {
    tips.push("Include a light or dark 'neutral' color for backgrounds, borders, or body text.");
  }
  rolesScore = Math.min(30, rolesScore);

  // 2. Contrast evaluation (find best pairs for reading)
  let bestContrast = 1;
  let hasExcellentTextPair = false;
  let hasGoodAccentPair = false;

  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const c1 = colors[i];
      const c2 = colors[j];
      const r = getContrastRatio(c1.hex, c2.hex);
      if (r > bestContrast) {
        bestContrast = r;
      }

      // Check specific roles' contrast
      if (
        (c1.role === "primary" && c2.role === "neutral-light") ||
        (c2.role === "primary" && c1.role === "neutral-light") ||
        (c1.role === "neutral-dark" && c2.role === "neutral-light") ||
        (c2.role === "neutral-dark" && c1.role === "neutral-light")
      ) {
        if (r >= 4.5) hasExcellentTextPair = true;
      }

      if (
        (c1.role === "accent" && (c2.role === "neutral-light" || c2.role === "neutral-dark")) ||
        (c2.role === "accent" && (c1.role === "neutral-light" || c1.role === "neutral-dark"))
      ) {
        if (r >= 3.0) hasGoodAccentPair = true;
      }
    }
  }

  if (bestContrast >= 7.0) {
    contrastScore += 25;
  } else if (bestContrast >= 4.5) {
    contrastScore += 18;
    tips.push("Your maximum contrast pair is good, but could be higher (aim for > 7 for title screens).");
  } else if (bestContrast >= 3.0) {
    contrastScore += 10;
    tips.push("Maximum contrast ratio is below 4.5:1. Your text pairings may be difficult to read.");
  } else {
    tips.push("Critical: Extremely low contrast in your palette. All your colors are of similar darkness/lightness.");
  }

  if (hasExcellentTextPair) contrastScore += 10;
  else tips.push("Try setting a high-contrast pair between a Neutral-Light/Dark and your Primary color.");

  if (hasGoodAccentPair) contrastScore += 5;
  else tips.push("Ensure your Accent color stands out significantly against at least one background neutral.");

  contrastScore = Math.min(40, contrastScore);

  // 3. Harmony evaluation based on the chosen mode
  const hsls = colors.map((c) => rgbToHsl(hexToRgb(c.hex)));
  
  if (harmonyMode === "random") {
    // Random elements can be beautiful, score depends on hue divergence (greater is better for high visual interest)
    const hues = hsls.map((h) => h.h).sort((a, b) => a - b);
    let maxDiff = 0;
    for (let i = 0; i < hues.length - 1; i++) {
      maxDiff = Math.max(maxDiff, hues[i + 1] - hues[i]);
    }
    if (maxDiff > 90) {
      harmonyScore = 24;
    } else {
      harmonyScore = 15;
      tips.push("Random selection resulted in colors with very close hues. Choose a specific harmony to structure it.");
    }
  } else {
    // For scientific harmonies, score how well they stick to the rules
    // Analogous: hues are clustered close
    if (harmonyMode === "analogous") {
      const hues = hsls.map((h) => h.h);
      const minHue = Math.min(...hues);
      const maxHue = Math.max(...hues);
      const spread = maxHue - minHue;
      if (spread < 80) {
        harmonyScore = 30;
      } else {
        harmonyScore = 18;
        tips.push("Hues are a bit spread out for analogous colors. Lock close hues or generate again.");
      }
    } else if (harmonyMode === "monochromatic") {
      // Same or extremely close hues, varying lightness
      const hues = hsls.map((h) => h.h);
      const avgHue = hues.reduce((a, b) => a + b, 0) / hues.length;
      const deviation = hues.map((h) => Math.abs(h - avgHue)).reduce((a, b) => a + b, 0) / hues.length;
      if (deviation < 15) {
        harmonyScore = 30;
      } else {
        harmonyScore = 15;
        tips.push("Monochromatic palettes demand identical hues. Lock a color to align them.");
      }
    } else if (harmonyMode === "complementary") {
      // Must contain complementary angles around 180 degrees
      let hasComplementaryPair = false;
      for (let i = 0; i < hsls.length; i++) {
        for (let j = i + 1; j < hsls.length; j++) {
          const diff = Math.abs(hsls[i].h - hsls[j].h);
          const hueDist = Math.min(diff, 360 - diff);
          if (hueDist >= 150 && hueDist <= 210) {
            hasComplementaryPair = true;
            break;
          }
        }
      }
      if (hasComplementaryPair) {
        harmonyScore = 30;
      } else {
        harmonyScore = 15;
        tips.push("A complementary palette should feature colors separated by 180 degrees on the hue wheel.");
      }
    } else {
      // General high rating for scientific layouts
      harmonyScore = 26;
    }
  }

  // Final sum
  const finalScore = Math.round(rolesScore + contrastScore + harmonyScore);

  if (finalScore >= 90) {
    tips.push("🌟 Excellent! Your palette meets top standard color science and accessibility practices.");
  } else if (finalScore >= 70) {
    tips.push("✨ Great! A few adjustments to roles or contrast would make it perfect.");
  }

  return {
    score: finalScore,
    breakdown: {
      roles: rolesScore,
      contrast: contrastScore,
      harmony: harmonyScore,
    },
    tips: tips.slice(0, 4), // Cap recommendations to keep it readable and clean
  };
}

/**
 * Calculates a standard color science score (45-99) for an individual color 
 * based on its role mapping, contrast pairings, and saturation parameters.
 */
export function getSingleColorScore(color: ColorItem, allColors: ColorItem[]): number {
  let score = 70; // start at standard pass
  const rgb = hexToRgb(color.hex);
  const hsl = rgbToHsl(rgb);

  // 1. Check role suitability
  if (color.role === "neutral-light") {
    if (hsl.l > 80) score += 15;
    else if (hsl.l > 65) score += 5;
    else score -= 15; // too dark for a light neutral
  } else if (color.role === "neutral-dark") {
    if (hsl.l < 30) score += 15;
    else if (hsl.l < 45) score += 5;
    else score -= 15; // too bright for a dark neutral
  } else if (color.role === "accent") {
    if (hsl.s > 45) score += 12;
    else if (hsl.s > 25) score += 5;
    else score -= 10; // too dull/grey for an accent
  } else if (color.role === "primary") {
    if (hsl.s > 20 && hsl.l > 15 && hsl.l < 85) score += 10;
  }

  // 2. Pair contrast validation
  let maxComplementContrast = 1;
  allColors.forEach((other) => {
    if (other.hex !== color.hex) {
      const contrast = getContrastRatio(color.hex, other.hex);
      if (contrast > maxComplementContrast) {
        maxComplementContrast = contrast;
      }
    }
  });

  if (maxComplementContrast >= 7.0) {
    score += 14;
  } else if (maxComplementContrast >= 4.5) {
    score += 8;
  } else if (maxComplementContrast < 3.0) {
    score -= 15;
  }

  // Soft clamp to a beautiful scientific grade aesthetic (45 to 99)
  return Math.max(45, Math.min(99, score));
}

export const COLOR_NAMES: { hex: string; name: string }[] = [
  { hex: "#000000", name: "Absolute Obsidian" },
  { hex: "#111111", name: "Deep Charcoal" },
  { hex: "#1A1A24", name: "Midnight Navy" },
  { hex: "#2C3E50", name: "Slate Blue" },
  { hex: "#34495E", name: "Steel Grey" },
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
  { hex: "#484848", name: "Slate Grey" },
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
  { hex: "#E2E8F0", name: "Cool Grey Alabaster" },
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
  { hex: "#F5F3FF", name: "Lavender Chalk Grey" },
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
