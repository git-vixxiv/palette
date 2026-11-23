/**
 * Palette engine: role-aware generation and scoring in a perceptual colour space.
 *
 * How a spin works
 * ----------------
 * 1. Every colour is handled in OKLCH (Ottosson 2020), where equal steps in
 *    lightness, chroma and hue look roughly equal to the eye. HSL does not have
 *    that property: HSL "50% lightness" yellow and blue differ hugely in
 *    perceived lightness.
 * 2. Locked colours are fixed context. The harmony template (analogous,
 *    complementary, ...) is rotated to fit ALL locked chromatic colours, not
 *    just the first one.
 * 3. Each unlocked slot is drawn from a region that suits its ROLE: a light
 *    neutral is a near-white tinted with the key hue, a dark neutral a
 *    near-black, a primary a confident mid-lightness colour, an accent the
 *    most saturated colour in the set, a secondary a quieter partner.
 * 4. Many complete candidates are built and scored; one of the best is used.
 *
 * What the scoring rewards (and where it comes from)
 * --------------------------------------------------
 * - Lightness contrast between colours and a wide lightness range. This is the
 *   most consistent finding in the empirical literature on colour combinations
 *   (Ou & Luo 2006; Schloss & Palmer 2011; O'Donovan et al. 2011).
 * - Similar hue and similar "tone" read as harmonious; strongly different hues
 *   at the SAME lightness and high chroma clash (Ou & Luo 2006; Schloss &
 *   Palmer 2011). So multi-hue schemes are kept, but hues are separated in
 *   lightness and only one colour is allowed to be the loudest.
 * - A mild hue prior from single-colour preference studies: blues and cyans
 *   are liked most, dark yellow / olive / chartreuse least (Palmer & Schloss
 *   2010). Yellows are therefore generated light and clean, not dark.
 * - Each hue is placed near the lightness where it is naturally most vivid
 *   (yellow light, blue deep), and lighter / darker siblings drift slightly
 *   toward yellow / blue, as shaded surfaces do.
 * - WCAG contrast, so the set is usable as an interface, not just pretty.
 *
 * The weights that combine these are design judgement, not published
 * constants. They are all in one place (see WEIGHTS) so they can be tuned.
 */

import { ColorItem, ColorRole, HarmonyMode, hexToRgb, rgbToHex, getContrastRatio } from "./colorUtils";

/* ------------------------------------------------------------------ *
 * OKLCH conversions and sRGB gamut handling
 * ------------------------------------------------------------------ */

export interface Oklch {
  L: number; // 0..1 perceptual lightness
  C: number; // chroma, ~0..0.37 inside sRGB
  h: number; // hue angle in degrees, 0..360
}

const srgbToLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const linearToSrgb = (v: number) =>
  (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255;

export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = hexToRgb(hex);
  const lr = srgbToLinear(r || 0);
  const lg = srgbToLinear(g || 0);
  const lb = srgbToLinear(b || 0);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(a, bb), h };
}

function oklchToLinear(L: number, C: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (L: number, C: number, h: number) => {
  const [r, g, b] = oklchToLinear(L, C, h);
  const e = 0.0006;
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e;
};

const chromaCache = new Map<number, number>();

/** Largest chroma that still fits in sRGB at this lightness and hue. */
export function maxChroma(L: number, h: number): number {
  const Lq = Math.max(0, Math.min(200, Math.round(L * 200)));
  const hq = ((Math.round(h) % 360) + 360) % 360;
  const key = Lq * 360 + hq;
  const cached = chromaCache.get(key);
  if (cached !== undefined) return cached;
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(Lq / 200, mid, hq)) lo = mid;
    else hi = mid;
  }
  const value = lo * 0.985; // small safety margin for the quantised lookup
  chromaCache.set(key, value);
  return value;
}

const cuspCache: number[] = [];

/** Lightness at which a hue reaches its highest chroma (its "natural" lightness). */
export function cuspLightness(h: number): number {
  const hq = ((Math.round(h) % 360) + 360) % 360;
  if (cuspCache[hq] !== undefined) return cuspCache[hq];
  let bestL = 0.6;
  let bestC = -1;
  for (let L = 0.3; L <= 0.98; L += 0.01) {
    const c = maxChroma(L, hq);
    if (c > bestC) {
      bestC = c;
      bestL = L;
    }
  }
  cuspCache[hq] = bestL;
  return bestL;
}

export function oklchToHex(L: number, C: number, h: number): string {
  const Lc = Math.max(0, Math.min(1, L));
  const Cc = Math.max(0, Math.min(C, maxChroma(Lc, h)));
  const [r, g, b] = oklchToLinear(Lc, Cc, h);
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  return rgbToHex({
    r: linearToSrgb(clamp01(r)),
    g: linearToSrgb(clamp01(g)),
    b: linearToSrgb(clamp01(b)),
  });
}

/* ------------------------------------------------------------------ *
 * Small numeric helpers
 * ------------------------------------------------------------------ */

type Rng = () => number;

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const norm = (h: number) => ((h % 360) + 360) % 360;
/** Unsigned angular distance, 0..180. */
const hueDist = (a: number, b: number) => {
  const d = Math.abs(norm(a) - norm(b));
  return d > 180 ? 360 - d : d;
};
/** Signed shortest rotation from a to b, -180..180. */
const hueDelta = (a: number, b: number) => ((norm(b) - norm(a) + 540) % 360) - 180;
/** 0 below lo, 1 above hi, smooth in between. */
const smooth = (lo: number, hi: number, v: number) => {
  const t = clamp((v - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};
const gauss = (h: number, centre: number, width: number) => {
  const d = hueDist(h, centre);
  return Math.exp(-(d * d) / (2 * width * width));
};
const between = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();
function weighted<T>(rng: Rng, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
/** Rotate h toward target by up to `deg`, never overshooting. */
const driftToward = (h: number, target: number, deg: number) => {
  const d = hueDelta(h, target);
  return norm(h + Math.sign(d) * Math.min(Math.abs(d), deg));
};

const YELLOW = 100; // OKLCH hue of yellow: the naturally lightest hue
const BLUE = 265; // OKLCH hue of blue: the naturally darkest hue
const CHROMATIC = 0.035; // below this chroma a colour reads as a neutral

/* ------------------------------------------------------------------ *
 * Hue preference prior (Palmer & Schloss 2010)
 * ------------------------------------------------------------------ */

/** Relative liking of a hue, roughly 0.5..1.6. Used to choose a key hue. */
function hueAppeal(h: number): number {
  return (
    1 +
    0.4 * gauss(h, 255, 40) + // blues
    0.25 * gauss(h, 200, 26) + // cyans / teals
    0.3 * gauss(h, 22, 22) + // reds / corals
    0.15 * gauss(h, 58, 18) + // oranges
    0.2 * gauss(h, 305, 28) + // purples
    0.15 * gauss(h, 160, 20) - // clean greens
    0.45 * gauss(h, 118, 20) // chartreuse / olive
  );
}

function sampleAppealingHue(rng: Rng): number {
  for (let i = 0; i < 40; i++) {
    const h = rng() * 360;
    if (rng() * 1.5 <= hueAppeal(h)) return h;
  }
  return rng() * 360;
}

/**
 * Dark, warm-yellow colours (olive, khaki, mud brown) are the least liked
 * colours in preference studies. 0 = clean, 1 = squarely in that region.
 */
const muddy = (L: number, C: number, h: number) =>
  gauss(h, 92, 34) * (1 - smooth(0.5, 0.72, L)) * clamp(C / 0.05);

/**
 * A scheme's geometry sometimes lands a colour on chartreuse (the perceptual
 * triad of blue, for example). Slide it to clean yellow or clean green
 * instead: a small rotation the scheme tolerates, for a much better colour.
 */
function steerHue(h: number): number {
  const centre = 119;
  const d = hueDelta(centre, h);
  if (Math.abs(d) >= 17) return norm(h);
  return norm(centre + (d < 0 ? -17 : 17));
}

/* ------------------------------------------------------------------ *
 * Harmony templates (offsets from the key hue, in perceptual degrees)
 * ------------------------------------------------------------------ */

type ConcreteMode = Exclude<HarmonyMode, "random">;

function templatesFor(mode: ConcreteMode, rng: Rng): number[][] {
  switch (mode) {
    case "monochromatic":
      return [[0]];
    case "analogous": {
      const s = between(rng, 22, 38);
      return [
        [0, s, -s],
        [0, s, 2 * s],
        [0, -s, -2 * s],
      ];
    }
    case "complementary":
      return [[0, 180]];
    case "split":
      return [[0, 150, 210]];
    case "triadic":
      return [[0, 120, 240]];
    case "tetradic":
      return [
        [0, 60, 180, 240],
        [0, 90, 180, 270],
      ];
  }
}

/** For "random": weighted toward the schemes people rate highest on average. */
function pickConcreteMode(rng: Rng): ConcreteMode {
  return weighted<ConcreteMode>(
    rng,
    ["analogous", "complementary", "monochromatic", "split", "triadic", "tetradic"],
    [0.3, 0.25, 0.15, 0.13, 0.1, 0.07]
  );
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

interface Swatch extends Oklch {
  hex: string;
  role: ColorRole;
  rel: number; // chroma as a fraction of the maximum available at this L and h
}

function toSwatch(hex: string, role: ColorRole): Swatch {
  const o = hexToOklch(hex);
  const mc = maxChroma(o.L, o.h);
  return { ...o, hex, role, rel: mc > 0.004 ? clamp(o.C / mc) : 0 };
}

/** How well a colour suits the job its role describes, 0..1. */
function roleFit(s: Swatch): number {
  switch (s.role) {
    case "neutral-light":
      return smooth(0.75, 0.93, s.L) * (1 - smooth(0.035, 0.09, s.C));
    case "neutral-dark":
      return (1 - smooth(0.3, 0.5, s.L)) * (1 - smooth(0.05, 0.11, s.C));
    case "primary":
      return (
        smooth(0.15, 0.5, s.rel) *
        smooth(0.03, 0.07, s.C) *
        smooth(0.15, 0.35, s.L) *
        (1 - smooth(0.82, 0.95, s.L))
      );
    case "accent":
      return (
        smooth(0.3, 0.75, s.rel) *
        smooth(0.05, 0.11, s.C) *
        smooth(0.3, 0.45, s.L) *
        (1 - smooth(0.9, 0.97, s.L))
      );
    case "secondary":
    default:
      return (
        (0.6 + 0.4 * smooth(0.015, 0.04, s.C)) *
        smooth(0.12, 0.25, s.L) *
        (1 - smooth(0.9, 0.97, s.L))
      );
  }
}

/** Two saturated, clearly different hues at the same lightness vibrate. 0..1. */
function clash(a: Swatch, b: Swatch): number {
  const both = clamp(a.C / 0.1) * clamp(b.C / 0.1);
  return both * smooth(30, 70, hueDist(a.h, b.h)) * (1 - smooth(0.07, 0.2, Math.abs(a.L - b.L)));
}

const deltaE = (a: Oklch, b: Oklch) => {
  const ar = (a.h * Math.PI) / 180;
  const br = (b.h * Math.PI) / 180;
  return Math.hypot(
    a.L - b.L,
    a.C * Math.cos(ar) - b.C * Math.cos(br),
    a.C * Math.sin(ar) - b.C * Math.sin(br)
  );
};

/** Smallest arc of the hue circle that contains every hue. */
function hueArc(hues: number[]): number {
  if (hues.length < 2) return 0;
  const sorted = hues.map(norm).sort((a, b) => a - b);
  let largestGap = 360 - sorted[sorted.length - 1] + sorted[0];
  for (let i = 1; i < sorted.length; i++) largestGap = Math.max(largestGap, sorted[i] - sorted[i - 1]);
  return 360 - largestGap;
}

const ANCHOR_SETS: Record<ConcreteMode, number[][]> = {
  monochromatic: [[0]],
  analogous: [[0]], // scored by arc, not anchors
  complementary: [[0, 180]],
  split: [[0, 150, 210]],
  triadic: [[0, 120, 240]],
  tetradic: [
    [0, 60, 180, 240],
    [0, 90, 180, 270],
  ],
};

/** How closely a set of hues follows a harmony scheme: fit and coverage, 0..1. */
function schemeFit(hues: number[], mode: ConcreteMode): { fit: number; coverage: number } {
  if (hues.length < 2) return { fit: 1, coverage: 1 };
  if (mode === "monochromatic") return { fit: 1 - smooth(22, 60, hueArc(hues)), coverage: 1 };
  if (mode === "analogous") {
    const arc = hueArc(hues);
    return { fit: 1 - smooth(85, 150, arc), coverage: 0.6 + 0.4 * smooth(8, 22, arc) };
  }
  let best = { fit: 0, coverage: 0, total: -1 };
  for (const anchors of ANCHOR_SETS[mode]) {
    for (const hue of hues) {
      for (const anchor of anchors) {
        const key = hue - anchor;
        const used = new Set<number>();
        let fit = 0;
        for (const h of hues) {
          let nearest = 0;
          let d = 999;
          anchors.forEach((a, i) => {
            const dist = hueDist(h, key + a);
            if (dist < d) {
              d = dist;
              nearest = i;
            }
          });
          fit += 1 - smooth(12, 40, d);
          if (d < 25) used.add(nearest);
        }
        fit /= hues.length;
        const coverage = clamp(used.size / Math.min(anchors.length, hues.length));
        const total = fit * 0.6 + coverage * 0.4;
        if (total > best.total) best = { fit, coverage, total };
      }
    }
  }
  return { fit: best.fit, coverage: best.coverage };
}

const CONCRETE_MODES: ConcreteMode[] = [
  "monochromatic",
  "analogous",
  "complementary",
  "split",
  "triadic",
  "tetradic",
];

/** All tunable weights in one place. Each group sums to 1. */
const WEIGHTS = {
  total: { roles: 0.22, contrast: 0.2, lightness: 0.12, harmony: 0.26, distinct: 0.1, hierarchy: 0.06, appeal: 0.04 },
  harmony: { noClash: 0.45, fit: 0.35, coverage: 0.2 },
};

interface Analysis {
  swatches: Swatch[];
  roleFits: number[];
  roles: number;
  contrast: number;
  lightness: number;
  harmony: number;
  noClash: number;
  fit: number;
  coverage: number;
  distinct: number;
  hierarchy: number;
  appeal: number;
  total: number;
  bestRatio: number;
  textRatio: number;
  worstClash: { i: number; j: number; value: number } | null;
  closest: { i: number; j: number; value: number } | null;
}

function analyze(colors: { hex: string; role: ColorRole }[], mode: HarmonyMode): Analysis {
  const sw = colors.map((c) => toSwatch(c.hex, c.role));
  const n = sw.length;
  const roleFits = sw.map(roleFit);
  const roles = roleFits.reduce((a, b) => a + b, 0) / Math.max(1, n);

  // Contrast: is there a strong pair, a readable text pair, and does every
  // non-neutral colour have something it can sit on?
  let bestRatio = 1;
  let textRatio = 1;
  const partner = new Array(n).fill(1);
  const isNeutral = (s: Swatch) => s.role === "neutral-light" || s.role === "neutral-dark";
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = getContrastRatio(sw[i].hex, sw[j].hex);
      bestRatio = Math.max(bestRatio, r);
      partner[i] = Math.max(partner[i], r);
      partner[j] = Math.max(partner[j], r);
      const a = sw[i];
      const b = sw[j];
      const neutralPair = isNeutral(a) && isNeutral(b) && a.role !== b.role;
      const primaryOnNeutral =
        (a.role === "primary" && isNeutral(b)) || (b.role === "primary" && isNeutral(a));
      if (neutralPair || primaryOnNeutral) textRatio = Math.max(textRatio, r);
    }
  }
  if (!sw.some(isNeutral)) textRatio = bestRatio;
  const usable = sw.filter((s) => !isNeutral(s));
  const usableShare = usable.length
    ? sw.reduce((acc, s, i) => acc + (!isNeutral(s) && partner[i] >= 3 ? 1 : 0), 0) / usable.length
    : 1;
  const contrast =
    0.4 * smooth(3, 9, bestRatio) + 0.35 * clamp(textRatio / 4.5) + 0.25 * usableShare;

  // Lightness structure: overall range, and spacing between the chromatic colours.
  const Ls = sw.map((s) => s.L);
  const range = Math.max(...Ls) - Math.min(...Ls);
  const chroma = sw.filter((s) => s.C >= CHROMATIC);
  let spacing = 1;
  if (chroma.length >= 2) {
    const sorted = chroma.map((s) => s.L).sort((a, b) => a - b);
    let minGap = 1;
    for (let i = 1; i < sorted.length; i++) minGap = Math.min(minGap, sorted[i] - sorted[i - 1]);
    spacing = smooth(0.015, 0.1, minGap);
  }
  const lightness = 0.6 * smooth(0.2, 0.62, range) + 0.4 * spacing;

  // Harmony between the chromatic colours.
  let worstClash: Analysis["worstClash"] = null;
  let clashSum = 0;
  let pairs = 0;
  let closest: Analysis["closest"] = null;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = deltaE(sw[i], sw[j]);
      if (!closest || d < closest.value) closest = { i, j, value: d };
      if (sw[i].C >= CHROMATIC && sw[j].C >= CHROMATIC) {
        const c = clash(sw[i], sw[j]);
        clashSum += c;
        pairs++;
        if (!worstClash || c > worstClash.value) worstClash = { i, j, value: c };
      }
    }
  }
  // Mean clash understates one bad pair in a large set, so blend in the worst.
  const noClash = pairs ? 1 - (0.5 * (clashSum / pairs) + 0.5 * (worstClash?.value ?? 0)) : 1;
  const hues = chroma.map((s) => s.h);
  let scheme = { fit: 1, coverage: 1 };
  if (hues.length >= 2) {
    if (mode === "random") {
      scheme = CONCRETE_MODES.map((m) => schemeFit(hues, m)).sort(
        (a, b) => b.fit * 0.6 + b.coverage * 0.4 - (a.fit * 0.6 + a.coverage * 0.4)
      )[0];
    } else {
      scheme = schemeFit(hues, mode);
    }
  }
  const harmony =
    WEIGHTS.harmony.noClash * noClash +
    WEIGHTS.harmony.fit * scheme.fit +
    WEIGHTS.harmony.coverage * scheme.coverage;

  const distinct = closest ? smooth(0.015, 0.07, closest.value) : 1;

  // One colour should be the loudest, and it should be the accent.
  const accents = sw.filter((s) => s.role === "accent");
  const others = sw.filter((s) => s.role !== "accent" && s.C >= CHROMATIC);
  // "Loud" blends absolute chroma with how close a colour is to the most
  // saturated its hue can be, because raw chroma is not comparable across
  // hues (a full-strength pink has less chroma than a mid-strength blue).
  const loud = (s: Swatch) => 0.5 * clamp(s.C / 0.2) + 0.5 * s.rel;
  let hierarchy = 1;
  if (accents.length && others.length) {
    const loudestOther = Math.max(...others.map(loud));
    const loudestAccent = Math.max(...accents.map(loud));
    hierarchy = clamp(loudestAccent / Math.max(0.05, loudestOther * 0.92));
  }

  // Dark yellows, olives and mud browns are the least liked colours. The key
  // hue itself is sampled up front rather than optimised here, so that the
  // search cannot collapse every palette onto the single best-liked hue.
  const appeal = 1 - Math.max(0, ...sw.map((s) => muddy(s.L, s.C, s.h)));

  const w = WEIGHTS.total;
  const total =
    w.roles * roles +
    w.contrast * contrast +
    w.lightness * lightness +
    w.harmony * harmony +
    w.distinct * distinct +
    w.hierarchy * hierarchy +
    w.appeal * appeal;

  return {
    swatches: sw,
    roleFits,
    roles,
    contrast,
    lightness,
    harmony,
    noClash,
    fit: scheme.fit,
    coverage: scheme.coverage,
    distinct,
    hierarchy,
    appeal,
    total,
    bestRatio,
    textRatio,
    worstClash,
    closest,
  };
}

/* ------------------------------------------------------------------ *
 * Generation
 * ------------------------------------------------------------------ */

interface Tone {
  name: string;
  weight: number;
  primaryL: [number, number];
  primaryRel: [number, number];
  secondaryRel: [number, number];
  accentRel: [number, number];
  pull: number; // how far a colour is drawn to its hue's natural lightness
}

/** A palette shares one "tone" so its colours feel like a family. */
const TONES: Tone[] = [
  { name: "vivid", weight: 0.34, primaryL: [0.52, 0.64], primaryRel: [0.85, 1], secondaryRel: [0.45, 0.75], accentRel: [0.86, 1], pull: 0.35 },
  { name: "rich", weight: 0.3, primaryL: [0.4, 0.52], primaryRel: [0.7, 0.92], secondaryRel: [0.4, 0.7], accentRel: [0.8, 0.96], pull: 0.2 },
  { name: "soft", weight: 0.26, primaryL: [0.56, 0.68], primaryRel: [0.42, 0.65], secondaryRel: [0.25, 0.5], accentRel: [0.62, 0.82], pull: 0.3 },
  { name: "pastel", weight: 0.1, primaryL: [0.74, 0.83], primaryRel: [0.4, 0.65], secondaryRel: [0.25, 0.5], accentRel: [0.58, 0.8], pull: 0.15 },
];

const ROLE_ORDER: ColorRole[] = ["primary", "secondary", "accent", "neutral-light", "neutral-dark"];
const LIGHT_TIERS = [0.972, 0.925, 0.875, 0.83];
const DARK_TIERS = [0.185, 0.27, 0.345, 0.41];

interface Slot {
  role: ColorRole;
  fixed: Oklch | null;
}

/** Choose the key hue so the template lines up with every locked chromatic colour. */
function fitKeyHue(slots: Slot[], anchors: number[], rng: Rng): number {
  const locked = slots.filter((s) => s.fixed && s.fixed.C >= CHROMATIC) as { role: ColorRole; fixed: Oklch }[];
  if (!locked.length) return sampleAppealingHue(rng);
  let best: number[] = [];
  let bestCost = Infinity;
  for (const pin of locked) {
    anchors.forEach((anchor, ai) => {
      const key = norm(pin.fixed.h - anchor);
      let cost = 0;
      for (const other of locked) {
        let d = 999;
        let nearest = 0;
        anchors.forEach((a, i) => {
          const dist = hueDist(other.fixed.h, key + a);
          if (dist < d) {
            d = dist;
            nearest = i;
          }
        });
        cost += d;
        // A locked primary should sit on the dominant anchor.
        if (other.role === "primary" && nearest !== 0) cost += 25;
        if (other.role === "accent" && nearest === 0 && anchors.length > 1) cost += 8;
      }
      if (pin.role === "primary" && ai !== 0) cost += 25;
      if (cost < bestCost - 3) {
        bestCost = cost;
        best = [key];
      } else if (Math.abs(cost - bestCost) <= 3) {
        best.push(key);
      }
    });
  }
  // Several rotations often fit the locks equally well. Among those, favour
  // the ones that give the lead colour a well-liked hue.
  return weighted(rng, best, best.map((k) => Math.pow(hueAppeal(k), 3)));
}

function anchorFor(role: ColorRole, anchors: number[], rng: Rng): number {
  const last = anchors.length - 1;
  if (last === 0) return anchors[0];
  const idx = anchors.map((_, i) => i);
  if (role === "primary") return anchors[0];
  if (role === "secondary") {
    return anchors[weighted(rng, idx, idx.map((i) => (i === 1 ? 0.55 : i === 0 ? 0.35 : 0.1 / Math.max(1, last - 1))))];
  }
  // accent: the anchor furthest from the key hue reads as the "pop"
  const far = anchors.map((a) => hueDist(0, a));
  const maxFar = Math.max(...far);
  return anchors[weighted(rng, idx, far.map((d, i) => (i === 0 ? 0.08 : d >= maxFar - 1 ? 0.7 : 0.22)))];
}

/** Lightness for a vivid colour: its tone's range, drawn toward the hue's natural lightness. */
function naturalL(base: number, h: number, pull: number): number {
  // Yellows are only liked light, so they are pulled much harder.
  const p = lerp(pull, 0.8, gauss(h, YELLOW, 26));
  return clamp(lerp(base, cuspLightness(h), p), 0.3, 0.9);
}

/** Pick the option furthest in lightness from colours already placed. */
function spreadL(options: number[], taken: number[]): number {
  if (!taken.length) return options[0];
  let best = options[0];
  let bestGap = -1;
  for (const L of options) {
    const gap = Math.min(...taken.map((t) => Math.abs(t - L)));
    if (gap > bestGap) {
      bestGap = gap;
      best = L;
    }
  }
  return best;
}

/** The creative direction for one spin: scheme, key hue and tone. */
interface Concept {
  concrete: ConcreteMode;
  anchors: number[];
  key: number;
  tone: Tone;
}

function makeConcept(slots: Slot[], mode: HarmonyMode, rng: Rng): Concept {
  const concrete = mode === "random" ? pickConcreteMode(rng) : mode;
  const variants = templatesFor(concrete, rng);
  const anchors = variants[Math.floor(rng() * variants.length)];
  return {
    concrete,
    anchors,
    key: fitKeyHue(slots, anchors, rng),
    tone: weighted(rng, TONES, TONES.map((t) => t.weight)),
  };
}

// Vivid colours are capped below the gamut edge: the most extreme sRGB
// colours (neon cyan, electric violet) read as harsh rather than rich.
const PRIMARY_MAX_C = 0.2;
const ACCENT_MAX_C = 0.215;
/** Greens turn neon before any other hue, so their ceiling is lower. */
const chromaCeiling = (base: number, h: number) => base - 0.05 * gauss(h, 142, 30);

function buildCandidate(slots: Slot[], concept: Concept, rng: Rng): Oklch[] {
  const { concrete, anchors, key, tone } = concept;

  const out: (Oklch | null)[] = slots.map((s) => s.fixed);
  const placed = () => out.filter((c): c is Oklch => !!c);
  const chromaLs = () => placed().filter((c) => c.C >= CHROMATIC).map((c) => c.L);

  // The reference colour everything else is built around.
  const lockedPrimary = slots.find((s) => s.role === "primary" && s.fixed && s.fixed.C >= CHROMATIC)?.fixed;
  const loudestLocked = slots
    .filter((s) => s.fixed && s.fixed.C >= CHROMATIC)
    .map((s) => s.fixed as Oklch)
    .sort((a, b) => b.C - a.C)[0];
  let ref: Oklch =
    lockedPrimary ?? loudestLocked ?? { L: between(rng, tone.primaryL[0], tone.primaryL[1]), C: 0.12, h: key };
  let refIsReal = !!(lockedPrimary ?? loudestLocked);

  const order = slots
    .map((s, i) => ({ s, i }))
    .filter((x) => !x.s.fixed)
    .sort((a, b) => ROLE_ORDER.indexOf(a.s.role) - ROLE_ORDER.indexOf(b.s.role));

  for (const { s, i } of order) {
    let color: Oklch;

    if (s.role === "primary") {
      const h = steerHue(key + anchorFor("primary", anchors, rng) + between(rng, -5, 5));
      const options = [0, 1, 2].map(() =>
        naturalL(between(rng, tone.primaryL[0], tone.primaryL[1]), h, tone.pull)
      );
      const L = spreadL(options, chromaLs());
      color = { L, C: Math.min(chromaCeiling(PRIMARY_MAX_C, h), maxChroma(L, h) * between(rng, tone.primaryRel[0], tone.primaryRel[1])), h };
      if (!refIsReal) {
        ref = color;
        refIsReal = true;
      }
    } else if (s.role === "secondary") {
      let h = steerHue(key + anchorFor("secondary", anchors, rng) + between(rng, -6, 6));
      const sameFamily = hueDist(h, ref.h) < 14;
      const options: number[] = [];
      for (let k = 0; k < 4; k++) {
        const up = rng() < (ref.L < 0.55 ? 0.65 : 0.35);
        const step = sameFamily ? between(rng, 0.16, 0.3) : between(rng, 0.12, 0.26);
        let L = ref.L + (up ? step : -step);
        if (L > 0.88 || L < 0.3) L = ref.L + (up ? -step : step);
        options.push(clamp(L, 0.3, 0.88));
      }
      // A dark warm-yellow secondary turns to mud; prefer the clean options.
      const clean = options.filter((L) => muddy(L, 0.06, h) < 0.3);
      const L = clean.length ? spreadL(clean, chromaLs()) : clamp(Math.max(...options, 0.72), 0.3, 0.88);
      // Lighter siblings drift toward yellow, darker ones toward blue.
      if (sameFamily && concrete !== "monochromatic") {
        h = driftToward(h, L > ref.L ? YELLOW : BLUE, between(rng, 4, 10));
      }
      color = { L, C: Math.min(chromaCeiling(PRIMARY_MAX_C, h), maxChroma(L, h) * between(rng, tone.secondaryRel[0], tone.secondaryRel[1])), h };
    } else if (s.role === "accent") {
      const h = steerHue(key + anchorFor("accent", anchors, rng) + between(rng, -6, 6));
      // Bright enough to pop on a dark ground, but only yellows may go very
      // light: a near-white cyan or lime at full chroma is a neon.
      const ceiling = lerp(0.78, 0.9, gauss(h, YELLOW, 24));
      const base = naturalL(between(rng, 0.6, 0.7), h, 0.3);
      const options = [base, base + 0.07, base - 0.07, base + 0.13, base - 0.13].map((L) => clamp(L, 0.56, ceiling));
      const L = spreadL(options, chromaLs());
      color = { L, C: Math.min(chromaCeiling(ACCENT_MAX_C, h), maxChroma(L, h) * between(rng, tone.accentRel[0], tone.accentRel[1])), h };
    } else if (s.role === "neutral-light") {
      const takenL = placed().filter((c) => c.L > 0.78).map((c) => c.L);
      const tier = LIGHT_TIERS.find((t) => takenL.every((x) => Math.abs(x - t) > 0.03)) ?? LIGHT_TIERS[LIGHT_TIERS.length - 1];
      const L = clamp(tier + between(rng, -0.01, 0.012), 0.8, 0.992);
      const h = rng() < 0.78 ? ref.h : between(rng, 70, 95); // tinted with the key hue, or warm
      const maxTint = tone.name === "soft" || tone.name === "pastel" ? 0.02 : 0.014;
      color = { L, C: between(rng, 0.004, tier < 0.95 ? maxTint + 0.012 : maxTint), h };
    } else {
      const takenL = placed().filter((c) => c.L < 0.48).map((c) => c.L);
      const tier = DARK_TIERS.find((t) => takenL.every((x) => Math.abs(x - t) > 0.04)) ?? DARK_TIERS[DARK_TIERS.length - 1];
      const L = clamp(tier + between(rng, -0.03, 0.03), 0.13, 0.46);
      const h = rng() < 0.75 ? driftToward(ref.h, BLUE, between(rng, 0, 12)) : between(rng, 250, 280);
      color = { L, C: between(rng, 0.012, 0.036), h };
    }

    out[i] = color;
  }

  return out as Oklch[];
}

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenerateOptions {
  /** Which slots to keep. Defaults to each slot's `locked` flag. */
  fixed?: boolean[];
  /** How many complete candidates to build and score. */
  candidates?: number;
  /** Seed for reproducible output (tests). Omit for a fresh result each call. */
  seed?: number;
}

/**
 * Produce a hex colour for every slot. Fixed slots are returned unchanged;
 * the rest are generated to suit their role and the fixed colours around them.
 */
export function generatePalette(slots: ColorItem[], mode: HarmonyMode, options: GenerateOptions = {}): string[] {
  const fixedFlags = options.fixed ?? slots.map((s) => s.locked);
  if (fixedFlags.every(Boolean)) return slots.map((s) => s.hex);
  const rng = options.seed === undefined ? Math.random : mulberry32(options.seed);
  const internal: Slot[] = slots.map((s, i) => ({
    role: s.role,
    fixed: fixedFlags[i] ? hexToOklch(s.hex) : null,
  }));

  // The scheme, key hue and tone are decided once per spin, which is what
  // keeps successive spins varied. The search then finds the best execution
  // of that direction. A direction that cannot produce a strong result (some
  // lock combinations fight certain schemes) is replaced, up to twice.
  const count = options.candidates ?? 70;
  let scored: { hexes: string[]; score: number }[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const concept = makeConcept(internal, mode, rng);
    const batch: { hexes: string[]; score: number }[] = [];
    for (let k = 0; k < count; k++) {
      const candidate = buildCandidate(internal, concept, rng);
      const hexes = candidate.map((c, i) => (fixedFlags[i] ? slots[i].hex : oklchToHex(c.L, c.C, c.h)));
      const score = analyze(hexes.map((hex, i) => ({ hex, role: slots[i].role })), mode).total;
      batch.push({ hexes, score });
    }
    batch.sort((a, b) => b.score - a.score);
    if (!scored.length || batch[0].score > scored[0].score) scored = batch;
    if (scored[0].score >= 0.9) break;
  }

  // Choose among the best few so repeated spins stay varied.
  const top = scored.slice(0, 5);
  const floor = top[top.length - 1].score;
  return weighted(rng, top, top.map((t) => 0.02 + (t.score - floor))).hexes;
}

/* ------------------------------------------------------------------ *
 * Scores shown in the interface
 * ------------------------------------------------------------------ */

const ROLE_LABEL: Record<ColorRole, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  "neutral-light": "Light",
  "neutral-dark": "Dark",
};

/** Palette quality, 0..100, with the breakdown the scorecard displays. */
export function scorePalette(
  colors: ColorItem[],
  harmonyMode: HarmonyMode
): {
  score: number;
  breakdown: { roles: number; contrast: number; harmony: number };
  tips: string[];
} {
  const a = analyze(colors, harmonyMode);
  const tips: { weight: number; text: string }[] = [];
  const has = (role: ColorRole) => colors.some((c) => c.role === role);
  const hasNeutral = has("neutral-light") || has("neutral-dark");

  const presence = (has("primary") ? 0.4 : 0) + (hasNeutral ? 0.3 : 0) + (has("accent") || has("secondary") ? 0.3 : 0);
  const roles = Math.round(30 * (0.7 * a.roles + 0.3 * presence));
  const contrast = Math.round(40 * (0.65 * a.contrast + 0.35 * a.lightness));
  const harmony = Math.round(30 * (0.75 * a.harmony + 0.15 * a.distinct + 0.1 * a.hierarchy));

  if (!has("primary")) tips.push({ weight: 0.9, text: "Assign one colour the Primary role so the palette has a clear lead." });
  if (!hasNeutral) tips.push({ weight: 0.8, text: "Add a Light or Dark neutral for backgrounds and text." });

  a.swatches.forEach((s, i) => {
    const fit = a.roleFits[i];
    if (fit >= 0.6) return;
    const name = `${s.hex} (${ROLE_LABEL[s.role]})`;
    let text = "";
    if (s.role === "neutral-light") text = s.L < 0.9 ? `${name} is too dark for a light neutral. Aim for a near-white.` : `${name} is too saturated for a neutral. Reduce its saturation.`;
    else if (s.role === "neutral-dark") text = s.L > 0.35 ? `${name} is too light for a dark neutral. Aim for a near-black.` : `${name} is too saturated for a neutral. Reduce its saturation.`;
    else if (s.role === "accent") text = `${name} is too muted to work as an accent. Make it more saturated.`;
    else if (s.role === "primary") text = s.C < 0.07 ? `${name} is too grey to lead the palette. Give the primary more saturation.` : `${name} is too ${s.L > 0.8 ? "light" : "dark"} to lead the palette. Move it toward the mid-range.`;
    else text = `${name} is too ${s.L > 0.9 ? "light" : "dark"} to be useful as a secondary.`;
    tips.push({ weight: 0.75 * (1 - fit), text });
  });

  if (a.textRatio < 4.5) tips.push({ weight: 0.7, text: `No pair reaches 4.5:1 for body text (best is ${a.textRatio.toFixed(1)}:1). Push the light and dark colours further apart.` });
  else if (a.bestRatio < 7) tips.push({ weight: 0.3, text: `Strongest contrast is ${a.bestRatio.toFixed(1)}:1. A pair above 7:1 gives headlines more punch.` });

  if (a.worstClash && a.worstClash.value > 0.35) {
    const x = a.swatches[a.worstClash.i];
    const y = a.swatches[a.worstClash.j];
    tips.push({ weight: 0.65 * a.worstClash.value, text: `${x.hex} and ${y.hex} are different hues at the same lightness, so they compete. Make one clearly lighter or darker.` });
  }
  if (a.closest && a.closest.value < 0.04) {
    tips.push({ weight: 0.5, text: `${a.swatches[a.closest.i].hex} and ${a.swatches[a.closest.j].hex} are nearly the same colour. Separate them or drop one.` });
  }
  if (a.fit < 0.6 && harmonyMode !== "random") tips.push({ weight: 0.45, text: `The hues stray from a ${harmonyMode} scheme. Lock the colours you like and spin the rest.` });
  else if (a.coverage < 0.75 && harmonyMode !== "random") tips.push({ weight: 0.35, text: `This ${harmonyMode} scheme is only using part of its hue range. Spin an unlocked colour to complete it.` });
  if (a.hierarchy < 0.75) tips.push({ weight: 0.4, text: "The accent is not the most vivid colour here. Either boost it or calm the colour that outshines it." });
  if (a.lightness < 0.55) tips.push({ weight: 0.4, text: "The colours sit at similar lightness. A wider light-to-dark range reads as more polished." });

  const score = Math.max(0, Math.min(100, roles + contrast + harmony));
  const ordered = tips.sort((x, y) => y.weight - x.weight).map((t) => t.text);
  if (score >= 90) ordered.push("Excellent: clear roles, strong contrast and a coherent scheme.");
  else if (score >= 75 && ordered.length < 2) ordered.push("Solid palette. Small adjustments to the points above would lift it further.");

  return { score, breakdown: { roles, contrast, harmony }, tips: ordered.slice(0, 4) };
}

/**
 * Suggest a role for each colour from what the colour actually is: the
 * near-whites and near-blacks become neutrals, the colour best suited to lead
 * becomes the primary, the most vivid remaining colour the accent, and the
 * rest secondaries. Works for any number of colours.
 */
export function suggestRoles(hexes: string[]): ColorRole[] {
  const sw = hexes.map((hex) => toSwatch(hex, "secondary"));
  const roles: (ColorRole | null)[] = hexes.map(() => null);
  const open = () => sw.map((_, i) => i).filter((i) => roles[i] === null);

  // Neutrals: always claim the single lightest / darkest if plausible, then
  // any others that are unmistakably near-white or near-black.
  const lightest = open().sort((a, b) => sw[b].L - sw[a].L)[0];
  if (lightest !== undefined && sw[lightest].L >= 0.85 && sw[lightest].C < 0.08) roles[lightest] = "neutral-light";
  const darkest = open().sort((a, b) => sw[a].L - sw[b].L)[0];
  if (darkest !== undefined && sw[darkest].L <= 0.36 && sw[darkest].C < 0.1) roles[darkest] = "neutral-dark";
  for (const i of open()) {
    if (sw[i].L >= 0.9 && sw[i].C < 0.045) roles[i] = "neutral-light";
    else if (sw[i].L <= 0.3 && sw[i].C < 0.06) roles[i] = "neutral-dark";
  }

  const fitAs = (i: number, role: ColorRole) => roleFit({ ...sw[i], role });
  const lead = open().sort((a, b) => fitAs(b, "primary") - fitAs(a, "primary"))[0];
  if (lead !== undefined) roles[lead] = "primary";
  const pop = open().sort((a, b) => sw[b].C * (0.5 + sw[b].rel) - sw[a].C * (0.5 + sw[a].rel))[0];
  if (pop !== undefined && fitAs(pop, "accent") > 0.5) roles[pop] = "accent";

  return roles.map((r) => r ?? "secondary");
}

/** Score for one colour in context, 45..99: role fit plus how it sits with the rest. */
export function getSingleColorScore(color: ColorItem, allColors: ColorItem[]): number {
  const me = toSwatch(color.hex, color.role);
  const fit = roleFit(me);
  let partner = 1;
  let worstClash = 0;
  let nearest = 1;
  let seenSelf = false;
  for (const other of allColors) {
    if (!seenSelf && other === color) {
      seenSelf = true;
      continue;
    }
    const o = toSwatch(other.hex, other.role);
    partner = Math.max(partner, getContrastRatio(color.hex, other.hex));
    nearest = Math.min(nearest, deltaE(me, o));
    if (me.C >= CHROMATIC && o.C >= CHROMATIC) worstClash = Math.max(worstClash, clash(me, o));
  }
  const contrast = partner >= 7 ? 1 : partner >= 4.5 ? 0.8 : partner >= 3 ? 0.5 : 0.15;
  const relations = (1 - worstClash) * smooth(0.015, 0.07, nearest);
  const value = 45 + 54 * (0.55 * fit + 0.25 * contrast + 0.2 * relations);
  return Math.max(45, Math.min(99, Math.round(value)));
}
