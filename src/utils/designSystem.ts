/**
 * Starter design system built around a palette, for the Claude Design bundle.
 *
 * A palette alone leaves a designer (or Claude Design) guessing at type,
 * spacing, shape, states and components. This fills those in:
 *   - derived from the palette: tint ramps, a gray ramp tinted with the brand
 *     hue, status colors tuned to sit with the brand, a link color that is
 *     verified readable, shadows and borders;
 *   - chosen by the user from short lists: a type pairing and a corner style;
 *   - standard starter values: the type scale and the spacing scale.
 * Everything that is a default, not a brand decision, is labelled as such in
 * the README so nothing is passed off as more than it is.
 */

import { ColorItem, HarmonyMode, getContrastRatio } from "./colorUtils";
import { hexToOklch, oklchToHex } from "./paletteEngine";
import { buildPreviewTheme } from "./previewTheme";
import { BundleFile, NamedColor, nameColors, readablePairs } from "./exportFormats";

export type TypeStyle = "modern" | "geometric" | "editorial" | "friendly";
export type CornerStyle = "sharp" | "soft" | "round";

export const TYPE_STYLES: Record<TypeStyle, { label: string; heading: string; body: string; mono: string; url: string; note: string }> = {
  modern: {
    label: "Modern sans (Inter)",
    heading: "Inter",
    body: "Inter",
    mono: "JetBrains Mono",
    url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
    note: "One neutral sans for everything. Clean and product-like.",
  },
  geometric: {
    label: "Geometric (Space Grotesk + Inter)",
    heading: "Space Grotesk",
    body: "Inter",
    mono: "JetBrains Mono",
    url: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
    note: "A characterful geometric sans for headings over a neutral body. Confident and technical.",
  },
  editorial: {
    label: "Editorial serif (Fraunces + Inter)",
    heading: "Fraunces",
    body: "Inter",
    mono: "JetBrains Mono",
    url: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
    note: "A serif for headings over a sans body. Warm and considered.",
  },
  friendly: {
    label: "Friendly rounded (Nunito)",
    heading: "Nunito",
    body: "Nunito",
    mono: "JetBrains Mono",
    url: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap",
    note: "A soft rounded sans throughout. Approachable and informal.",
  },
};

export const CORNER_STYLES: Record<CornerStyle, { label: string; sm: number; md: number; lg: number }> = {
  sharp: { label: "Sharp", sm: 0, md: 2, lg: 4 },
  soft: { label: "Soft", sm: 6, md: 10, lg: 16 },
  round: { label: "Round", sm: 10, md: 16, lg: 24 },
};

export type IconSet = "lucide" | "phosphor" | "heroicons" | "material";
export const ICON_SETS: Record<IconSet, { label: string; url: string; note: string }> = {
  lucide: { label: "Lucide", url: "https://lucide.dev", note: "Outline icons with a 2px stroke and rounded joins. 24px grid." },
  phosphor: { label: "Phosphor", url: "https://phosphoricons.com", note: "A flexible family with thin to bold and filled weights. Use Regular by default." },
  heroicons: { label: "Heroicons", url: "https://heroicons.com", note: "Outline for navigation and actions, solid for small or emphasised icons." },
  material: { label: "Material Symbols", url: "https://fonts.google.com/icons", note: "Use the Rounded style, weight 400, unfilled by default." },
};

/** Everything the owner chooses in the export screen. */
export interface DesignSystemOptions {
  name: string;
  typeStyle: TypeStyle;
  cornerStyle: CornerStyle;
  iconSet: IconSet;
  /** A live site or product to use as a reference, if the owner gave one. */
  url?: string;
  /** The owner's own words on tone of voice, if given. */
  voice?: string;
  /** Which of the three choices the owner actually made, as opposed to leaving the default. */
  chosen: { type: boolean; corners: boolean; icons: boolean };
}

const BREAKPOINTS: [string, number][] = [["sm", 640], ["md", 768], ["lg", 1024], ["xl", 1280]];
const MOTION: [string, string][] = [["duration-fast", "120ms"], ["duration-base", "200ms"], ["duration-slow", "320ms"], ["ease-standard", "cubic-bezier(0.2, 0, 0, 1)"], ["ease-out", "cubic-bezier(0, 0, 0.2, 1)"]];

const TYPE_SCALE: { token: string; label: string; size: number; line: number; weight: number; heading: boolean }[] = [
  { token: "display", label: "Display", size: 48, line: 1.1, weight: 700, heading: true },
  { token: "h1", label: "Heading 1", size: 36, line: 1.15, weight: 700, heading: true },
  { token: "h2", label: "Heading 2", size: 28, line: 1.2, weight: 700, heading: true },
  { token: "h3", label: "Heading 3", size: 22, line: 1.3, weight: 600, heading: true },
  { token: "body-lg", label: "Body large", size: 18, line: 1.6, weight: 400, heading: false },
  { token: "body", label: "Body", size: 16, line: 1.6, weight: 400, heading: false },
  { token: "small", label: "Small", size: 14, line: 1.5, weight: 400, heading: false },
  { token: "caption", label: "Caption", size: 12, line: 1.4, weight: 500, heading: false },
];

const SPACING: [string, number][] = [["1", 4], ["2", 8], ["3", 12], ["4", 16], ["6", 24], ["8", 32], ["12", 48], ["16", 64]];
const RAMP_STEPS: [number, number, number][] = [
  // step, lightness, share of the color's own chroma
  [50, 0.975, 0.12],
  [100, 0.94, 0.25],
  [200, 0.88, 0.45],
  [300, 0.8, 0.7],
  [400, 0.7, 0.9],
  [500, 0.6, 1],
  [600, 0.5, 1],
  [700, 0.41, 0.92],
  [800, 0.32, 0.8],
  [900, 0.23, 0.65],
];

const up = (hex: string) => hex.toUpperCase();
const best = (fill: string, a: string, b: string) => (getContrastRatio(fill, a) >= getContrastRatio(fill, b) ? a : b);

export interface DesignSystem {
  name: string;
  mode: HarmonyMode;
  named: NamedColor[];
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  link: { hex: string; from: string; ratio: number; derived: boolean };
  ramps: { token: string; label: string; steps: { step: number; hex: string }[] }[];
  gray: { step: number; hex: string }[];
  status: { token: string; label: string; hex: string; on: string; soft: string; onSoft: string }[];
  type: (typeof TYPE_STYLES)[TypeStyle];
  corners: (typeof CORNER_STYLES)[CornerStyle];
  shadows: { token: string; value: string }[];
  /** Hover and pressed versions of the main button fill, and the focus ring. */
  states: { primaryHover: string; primaryPressed: string; focusRing: string };
  /** The dark theme: every surface, text, border, link, status and shadow value. */
  dark: {
    bg: string;
    surface: string;
    ink: string;
    muted: string;
    line: string;
    link: string;
    linkRatio: number;
    status: { token: string; soft: string; onSoft: string }[];
    shadows: { token: string; value: string }[];
    focusRing: string;
  };
  icons: (typeof ICON_SETS)[IconSet];
  options: DesignSystemOptions;
}

const rgbOf = (hex: string) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : "0, 0, 0";
};

export function buildDesignSystem(colors: ColorItem[], mode: HarmonyMode, options: DesignSystemOptions): DesignSystem {
  const { name, typeStyle, cornerStyle } = options;
  const named = nameColors(colors);
  const theme = buildPreviewTheme(colors, false);
  const bg = up(theme.bg);
  const ink = up(theme.ink);
  const primary = up(theme.primary);
  const p = hexToOklch(primary);

  // Tint and shade ramps for each brand color (not the neutrals).
  const chromatic = named.filter((c) => c.role !== "neutral-light" && c.role !== "neutral-dark").slice(0, 4);
  const ramps = chromatic.map((c) => {
    const o = hexToOklch(c.hex);
    return { token: c.token, label: c.label, steps: RAMP_STEPS.map(([step, L, share]) => ({ step, hex: up(oklchToHex(L, o.C * share, o.h)) })) };
  });
  // Grays carry a trace of the brand hue so they sit with it.
  const gray = RAMP_STEPS.map(([step, L]) => ({ step, hex: up(oklchToHex(L, 0.012, p.h)) }));

  // Links must be readable as text on the page background.
  const candidates = chromatic.map((c) => ({ c, ratio: getContrastRatio(c.hex, bg) })).sort((a, b) => b.ratio - a.ratio);
  const primaryRatio = getContrastRatio(primary, bg);
  let link: DesignSystem["link"];
  if (primaryRatio >= 4.5) link = { hex: primary, from: "Primary", ratio: primaryRatio, derived: false };
  else if (candidates[0] && candidates[0].ratio >= 4.5) link = { hex: candidates[0].c.hex, from: candidates[0].c.label, ratio: candidates[0].ratio, derived: false };
  else {
    // No palette color is readable as text here: darken the primary until it is.
    let L = Math.min(p.L, 0.5);
    let hex = up(oklchToHex(L, p.C, p.h));
    while (getContrastRatio(hex, bg) < 4.5 && L > 0.15) {
      L -= 0.03;
      hex = up(oklchToHex(L, p.C, p.h));
    }
    link = { hex, from: "a darker shade of Primary", ratio: getContrastRatio(hex, bg), derived: true };
  }

  // Status colors: conventional hues, with strength matched to the brand color.
  const strength = Math.min(0.17, Math.max(0.1, p.C));
  const status = (
    [
      ["success", "Success", 150, 0.52],
      ["warning", "Warning", 75, 0.72],
      ["danger", "Danger", 27, 0.55],
      ["info", "Info", 245, 0.55],
    ] as [string, string, number, number][]
  ).map(([token, label, hue, L]) => {
    const hex = up(oklchToHex(L, strength, hue));
    const soft = up(oklchToHex(0.95, 0.035, hue));
    return { token, label, hex, on: best(hex, "#FFFFFF", ink), soft, onSoft: up(oklchToHex(0.3, strength * 0.8, hue)) };
  });

  const k = rgbOf(ink);
  const shadows = [
    { token: "sm", value: `0 1px 2px rgba(${k}, 0.08)` },
    { token: "md", value: `0 4px 12px rgba(${k}, 0.10)` },
    { token: "lg", value: `0 12px 32px rgba(${k}, 0.14)` },
  ];

  // Interaction states for the main button: a step darker on hover, two when
  // pressed (lighter instead when the fill is already very dark).
  const dir = p.L < 0.35 ? 1 : -1;
  const states = {
    primaryHover: up(oklchToHex(p.L + dir * 0.06, p.C, p.h)),
    primaryPressed: up(oklchToHex(p.L + dir * 0.12, p.C, p.h)),
    focusRing: `0 0 0 2px ${bg}, 0 0 0 4px ${link.hex}`,
  };

  // Dark theme: its own surfaces, text, borders, link and status backgrounds.
  const dk = buildPreviewTheme(colors, true);
  const dbg = up(dk.bg);
  // The dark link stays in the same color family as the light one: the same
  // palette color if it is readable on the dark background, otherwise a
  // lighter version of it.
  const linkBase = link.derived || link.hex === primary ? primary : link.hex;
  const lb = hexToOklch(linkBase);
  let dLink = linkBase;
  let dL = Math.max(lb.L, 0.6);
  while (getContrastRatio(dLink, dbg) < 4.5 && dL < 0.93) {
    dLink = up(oklchToHex(dL, lb.C, lb.h));
    dL += 0.03;
  }
  const dark = {
    bg: dbg,
    surface: up(dk.surface),
    ink: up(dk.ink),
    muted: up(dk.muted),
    line: up(dk.line),
    link: dLink,
    linkRatio: getContrastRatio(dLink, dbg),
    status: (
      [
        ["success", 150],
        ["warning", 75],
        ["danger", 27],
        ["info", 245],
      ] as [string, number][]
    ).map(([token, hue]) => ({ token, soft: up(oklchToHex(0.28, 0.05, hue)), onSoft: up(oklchToHex(0.9, 0.07, hue)) })),
    shadows: [
      { token: "sm", value: "0 1px 2px rgba(0, 0, 0, 0.40)" },
      { token: "md", value: "0 4px 12px rgba(0, 0, 0, 0.45)" },
      { token: "lg", value: "0 12px 32px rgba(0, 0, 0, 0.55)" },
    ],
    focusRing: `0 0 0 2px ${dbg}, 0 0 0 4px ${dLink}`,
  };

  return {
    states,
    dark,
    icons: ICON_SETS[options.iconSet],
    options,
    name,
    mode,
    named,
    bg,
    surface: up(theme.surface),
    ink,
    muted: up(theme.muted),
    line: up(theme.line),
    link,
    ramps,
    gray,
    status,
    type: TYPE_STYLES[typeStyle],
    corners: CORNER_STYLES[cornerStyle],
    shadows,
  };
}

/* ------------------------------ tokens ------------------------------ */

function tokensCss(ds: DesignSystem): string {
  const L: string[] = [];
  const add = (s = "") => L.push(s);
  add(`/* ${ds.name} · starter design system · exported from palette by vixxiv */`);
  add(`@import url("${ds.type.url}");`);
  add();
  add(":root {");
  add("  /* Palette */");
  ds.named.forEach((c) => {
    add(`  --color-${c.token}: ${c.hex};`);
    add(`  --color-on-${c.token}: ${c.on};`);
  });
  add();
  add("  /* Surfaces and text */");
  add(`  --color-bg: ${ds.bg};`);
  add(`  --color-surface: ${ds.surface};`);
  add(`  --color-text: ${ds.ink};`);
  add(`  --color-text-muted: ${ds.muted};`);
  add(`  --color-border: ${ds.line};`);
  add(`  --color-link: ${ds.link.hex};`);
  add();
  add("  /* Tints and shades of the brand colors */");
  ds.ramps.forEach((r) => r.steps.forEach((s) => add(`  --color-${r.token}-${s.step}: ${s.hex};`)));
  add();
  add("  /* Grays, lightly tinted with the brand hue */");
  ds.gray.forEach((s) => add(`  --color-gray-${s.step}: ${s.hex};`));
  add();
  add("  /* Status */");
  ds.status.forEach((s) => {
    add(`  --color-${s.token}: ${s.hex};`);
    add(`  --color-on-${s.token}: ${s.on};`);
    add(`  --color-${s.token}-soft: ${s.soft};`);
    add(`  --color-on-${s.token}-soft: ${s.onSoft};`);
  });
  add();
  add("  /* Type */");
  add(`  --font-heading: "${ds.type.heading}", ui-sans-serif, system-ui, sans-serif;`);
  add(`  --font-body: "${ds.type.body}", ui-sans-serif, system-ui, sans-serif;`);
  add(`  --font-mono: "${ds.type.mono}", ui-monospace, monospace;`);
  TYPE_SCALE.forEach((t) => {
    add(`  --text-${t.token}: ${t.size / 16}rem;`);
    add(`  --leading-${t.token}: ${t.line};`);
    add(`  --weight-${t.token}: ${t.weight};`);
  });
  add();
  add("  /* Spacing (4px base) */");
  SPACING.forEach(([k, v]) => add(`  --space-${k}: ${v}px;`));
  add();
  add("  /* Shape */");
  add(`  --radius-sm: ${ds.corners.sm}px;`);
  add(`  --radius-md: ${ds.corners.md}px;`);
  add(`  --radius-lg: ${ds.corners.lg}px;`);
  add("  --radius-pill: 999px;");
  add("  --border-width: 1px;");
  ds.shadows.forEach((s) => add(`  --shadow-${s.token}: ${s.value};`));
  add();
  add("  /* Interaction states */");
  add(`  --color-primary-hover: ${ds.states.primaryHover};`);
  add(`  --color-primary-pressed: ${ds.states.primaryPressed};`);
  add(`  --focus-ring: ${ds.states.focusRing};`);
  add("  --opacity-disabled: 0.45;");
  add();
  add("  /* Motion */");
  MOTION.forEach(([k, v]) => add(`  --${k}: ${v};`));
  add();
  add("  /* Layout. Breakpoints: " + BREAKPOINTS.map(([k, v]) => `${k} ${v}px`).join(", ") + " */");
  add("  --container-max: 1200px;");
  add("  --container-narrow: 720px;");
  add("}");
  add();
  add("/* Dark theme. Set data-theme=\"dark\" on <html>. Brand, ramp and status solid colors stay the same. */");
  add('[data-theme="dark"] {');
  add(`  --color-bg: ${ds.dark.bg};`);
  add(`  --color-surface: ${ds.dark.surface};`);
  add(`  --color-text: ${ds.dark.ink};`);
  add(`  --color-text-muted: ${ds.dark.muted};`);
  add(`  --color-border: ${ds.dark.line};`);
  add(`  --color-link: ${ds.dark.link};`);
  ds.dark.status.forEach((s) => {
    add(`  --color-${s.token}-soft: ${s.soft};`);
    add(`  --color-on-${s.token}-soft: ${s.onSoft};`);
  });
  ds.dark.shadows.forEach((s) => add(`  --shadow-${s.token}: ${s.value};`));
  add(`  --focus-ring: ${ds.dark.focusRing};`);
  add("}");
  return L.join("\n") + "\n";
}

function tokensJson(ds: DesignSystem): string {
  const color: Record<string, unknown> = {};
  const c = (v: string, d?: string) => ({ $type: "color", $value: v, ...(d ? { $description: d } : {}) });
  ds.named.forEach((n) => {
    color[n.token] = c(n.hex, n.job);
    color[`on-${n.token}`] = c(n.on, `Readable text on ${n.label}`);
  });
  Object.assign(color, {
    bg: c(ds.bg, "Page background"),
    surface: c(ds.surface, "Cards and panels"),
    text: c(ds.ink, "Body text"),
    "text-muted": c(ds.muted, "Secondary text"),
    border: c(ds.line, "Hairlines and input borders"),
    link: c(ds.link.hex, `Link text, ${ds.link.ratio.toFixed(1)}:1 on the page background`),
  });
  ds.ramps.forEach((r) => (color[`${r.token}-ramp`] = Object.fromEntries(r.steps.map((s) => [s.step, c(s.hex)]))));
  color.gray = Object.fromEntries(ds.gray.map((s) => [s.step, c(s.hex)]));
  ds.status.forEach((s) => {
    color[s.token] = c(s.hex, `${s.label} state`);
    color[`on-${s.token}`] = c(s.on);
    color[`${s.token}-soft`] = c(s.soft, `${s.label} background`);
    color[`on-${s.token}-soft`] = c(s.onSoft);
  });
  const dim = (px: number) => ({ $type: "dimension", $value: `${px}px` });
  return (
    JSON.stringify(
      {
        $description: `${ds.name} · starter design system · palette by vixxiv`,
        color,
        font: {
          heading: { $type: "fontFamily", $value: [ds.type.heading, "sans-serif"] },
          body: { $type: "fontFamily", $value: [ds.type.body, "sans-serif"] },
          mono: { $type: "fontFamily", $value: [ds.type.mono, "monospace"] },
        },
        text: Object.fromEntries(
          TYPE_SCALE.map((t) => [
            t.token,
            { $type: "typography", $value: { fontFamily: t.heading ? ds.type.heading : ds.type.body, fontSize: `${t.size}px`, lineHeight: t.line, fontWeight: t.weight } },
          ])
        ),
        space: Object.fromEntries(SPACING.map(([k, v]) => [k, dim(v)])),
        radius: { sm: dim(ds.corners.sm), md: dim(ds.corners.md), lg: dim(ds.corners.lg), pill: dim(999) },
        shadow: Object.fromEntries(ds.shadows.map((s) => [s.token, { $type: "shadow", $value: s.value }])),
        state: {
          "primary-hover": c(ds.states.primaryHover, "Main button fill on hover"),
          "primary-pressed": c(ds.states.primaryPressed, "Main button fill when pressed"),
          "focus-ring": { $type: "shadow", $value: ds.states.focusRing, $description: "Keyboard focus ring" },
          "disabled-opacity": { $type: "number", $value: 0.45 },
        },
        motion: Object.fromEntries(MOTION.map(([k, v]) => [k, { $type: k.startsWith("ease") ? "cubicBezier" : "duration", $value: v }])),
        breakpoint: Object.fromEntries(BREAKPOINTS.map(([k, v]) => [k, dim(v)])),
        container: { max: dim(1200), narrow: dim(720) },
        dark: {
          color: {
            bg: c(ds.dark.bg),
            surface: c(ds.dark.surface),
            text: c(ds.dark.ink),
            "text-muted": c(ds.dark.muted),
            border: c(ds.dark.line),
            link: c(ds.dark.link, `${ds.dark.linkRatio.toFixed(1)}:1 on the dark background`),
            ...Object.fromEntries(ds.dark.status.flatMap((x) => [[`${x.token}-soft`, c(x.soft)], [`on-${x.token}-soft`, c(x.onSoft)]])),
          },
          shadow: Object.fromEntries(ds.dark.shadows.map((x) => [x.token, { $type: "shadow", $value: x.value }])),
        },
      },
      null,
      2
    ) + "\n"
  );
}

/* ------------------------------ preview cards ------------------------------ */

const grade = (r: number) => (r >= 7 ? "AAA" : r >= 4.5 ? "AA" : "AA large text only");

const card = (group: string, title: string, body: string, extraCss = "", theme: "light" | "dark" = "light") =>
  `<!-- @dsCard group="${group}" -->\n<!doctype html>\n<html lang="en"${theme === "dark" ? ' data-theme="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>\n` +
  `<link rel="stylesheet" href="../tokens.css">\n<style>` +
  `body{margin:0;padding:var(--space-6);font-family:var(--font-body);font-size:var(--text-body);line-height:var(--leading-body);background:var(--color-bg);color:var(--color-text)}` +
  `h1{font-family:var(--font-heading);font-size:var(--text-h3);line-height:var(--leading-h3);margin:0 0 var(--space-4)}` +
  `h2{font-family:var(--font-heading);font-size:var(--text-small);text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin:var(--space-6) 0 var(--space-3)}` +
  `code{font-family:var(--font-mono);font-size:var(--text-caption)}` +
  extraCss +
  `</style></head>\n<body>\n<h1>${title}</h1>\n${body}\n</body></html>\n`;

function previewCards(ds: DesignSystem): BundleFile[] {
  const sw = (bgc: string, fg: string, top: string, bottom: string) =>
    `<div class="sw" style="background:${bgc};color:${fg}"><b>${top}</b><div><code>${bgc}</code>${bottom ? `<br><small>${bottom}</small>` : ""}</div></div>`;
  const swCss =
    `.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--space-3)}` +
    `.sw{border-radius:var(--radius-md);padding:var(--space-3);min-height:92px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid var(--color-border)}.sw b{font-size:var(--text-small)}.sw small{font-size:var(--text-caption);opacity:.85}` +
    `.ramp{display:flex;border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--color-border);margin-bottom:var(--space-3)}.ramp div{flex:1;padding:var(--space-3) 4px;text-align:center;font-family:var(--font-mono);font-size:10px}` +
    `.row{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border-radius:var(--radius-sm);margin-bottom:var(--space-2);font-size:var(--text-small)}.row span{margin-left:auto;font-size:var(--text-caption);opacity:.85}`;

  const palette = card(
    "Colors",
    `${ds.name}: palette`,
    `<div class="grid">\n${ds.named.map((c) => sw(c.hex, c.on, c.label, c.job)).join("\n")}\n</div>\n<h2>Surfaces and text</h2>\n<div class="grid">\n` +
      [
        sw(ds.bg, ds.ink, "Background", "Page"),
        sw(ds.surface, ds.ink, "Surface", "Cards and panels"),
        sw(ds.ink, ds.bg, "Text", "Body text"),
        sw(ds.muted, best(ds.muted, ds.bg, ds.ink), "Muted text", "Secondary text"),
        sw(ds.line, ds.ink, "Border", "Hairlines"),
        sw(ds.link.hex, best(ds.link.hex, ds.bg, ds.ink), "Link", `${ds.link.ratio.toFixed(1)}:1 on background`),
      ].join("\n") +
      `\n</div>`,
    swCss
  );

  const pairs = readablePairs(ds.named, 10);
  const pairsCard = card(
    "Colors",
    "Readable text pairs (WCAG)",
    pairs.map((p) => `<div class="row" style="background:${p.bg.hex};color:${p.text.hex}">${p.text.label} on ${p.bg.label}<span>${p.ratio.toFixed(1)}:1 ${grade(p.ratio)}</span></div>`).join("\n") ||
      "<p>No pair in this palette reaches 4.5:1.</p>",
    swCss
  );

  const rampRow = (label: string, steps: { step: number; hex: string }[]) =>
    `<h2>${label}</h2>\n<div class="ramp">${steps.map((s) => `<div style="background:${s.hex};color:${best(s.hex, "#FFFFFF", ds.ink)}">${s.step}</div>`).join("")}</div>`;
  const rampsCard = card("Colors", "Tints, shades and grays", [...ds.ramps.map((r) => rampRow(r.label, r.steps)), rampRow("Gray", ds.gray)].join("\n"), swCss);

  const statusCard = card(
    "Colors",
    "Status colors",
    `<div class="grid">\n${ds.status.map((s) => sw(s.hex, s.on, s.label, "Solid")).join("\n")}\n</div>\n<h2>Soft backgrounds</h2>\n<div class="grid">\n${ds.status.map((s) => sw(s.soft, s.onSoft, s.label, "Banner or badge")).join("\n")}\n</div>`,
    swCss
  );

  const typeCard = card(
    "Type",
    "Type scale",
    `<p style="color:var(--color-text-muted);font-size:var(--text-small)">Headings: ${ds.type.heading}. Body: ${ds.type.body}. Mono: ${ds.type.mono}.</p>\n` +
      TYPE_SCALE.map(
        (t) =>
          `<div class="t"><div style="font-family:var(--font-${t.heading ? "heading" : "body"});font-size:var(--text-${t.token});line-height:var(--leading-${t.token});font-weight:var(--weight-${t.token})">${t.label}: the quick brown fox</div><code>${t.size}px / ${t.line} / ${t.weight}</code></div>`
      ).join("\n"),
    `.t{padding:var(--space-3) 0;border-bottom:1px solid var(--color-border)}.t code{color:var(--color-text-muted)}`
  );

  const shapeCard = card(
    "Spacing",
    "Spacing, corners and shadows",
    `<h2>Spacing</h2>\n${SPACING.map(([k, v]) => `<div class="sp"><code>space-${k}</code><span style="width:${v}px"></span><code>${v}px</code></div>`).join("\n")}\n` +
      `<h2>Corners</h2>\n<div class="boxes">${(["sm", "md", "lg", "pill"] as const).map((r) => `<div class="bx" style="border-radius:var(--radius-${r})">${r}</div>`).join("")}</div>\n` +
      `<h2>Shadows</h2>\n<div class="boxes">${ds.shadows.map((s) => `<div class="bx" style="box-shadow:var(--shadow-${s.token});border-radius:var(--radius-md);border-color:transparent">${s.token}</div>`).join("")}</div>`,
    `.sp{display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-2)}.sp code:first-child{width:80px}.sp span{height:14px;background:var(--color-primary);border-radius:2px}` +
      `.boxes{display:flex;gap:var(--space-4);flex-wrap:wrap}.bx{width:92px;height:64px;display:grid;place-items:center;background:var(--color-surface);border:1px solid var(--color-border);font-family:var(--font-mono);font-size:var(--text-caption)}`
  );

  const BTN_CSS =
    `.r{display:flex;gap:var(--space-3);flex-wrap:wrap;align-items:flex-end}` +
    `.btn{font:inherit;font-weight:600;font-size:var(--text-small);padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);border:var(--border-width) solid transparent;cursor:pointer;transition:background var(--duration-fast) var(--ease-standard),box-shadow var(--duration-fast) var(--ease-standard)}` +
    `.btn.primary{background:var(--color-primary);color:var(--color-on-primary)}.btn.primary:hover,.btn.primary.is-hover{background:var(--color-primary-hover)}.btn.primary:active,.btn.primary.is-pressed{background:var(--color-primary-pressed)}` +
    `.btn.secondary{background:var(--color-surface);color:var(--color-text);border-color:var(--color-border)}.btn.secondary:hover,.btn.secondary.is-hover{border-color:var(--color-text-muted)}` +
    `.btn.ghost{background:transparent;color:var(--color-link)}.btn.ghost:hover,.btn.ghost.is-hover{background:var(--color-surface)}` +
    `.btn.danger{background:var(--color-danger);color:var(--color-on-danger)}` +
    `.btn:focus-visible,.btn.is-focus,input:focus-visible,select:focus-visible,.is-focus{outline:none;box-shadow:var(--focus-ring)}` +
    `.btn:disabled{opacity:var(--opacity-disabled);cursor:not-allowed}`;

  const statesCard = card(
    "Components",
    "Interaction states",
    `<p class="note">Every interactive element has these five states. Hover and pressed darken the fill; focus adds the ring; disabled drops to 45% opacity.</p>\n` +
      `<table><tr><th></th><th>Default</th><th>Hover</th><th>Pressed</th><th>Focus</th><th>Disabled</th></tr>` +
      (["primary", "secondary", "ghost"] as const)
        .map((k) => `<tr><th>${k[0].toUpperCase() + k.slice(1)}</th><td><button class="btn ${k}">Button</button></td><td><button class="btn ${k} is-hover">Button</button></td><td><button class="btn ${k} is-pressed">Button</button></td><td><button class="btn ${k} is-focus">Button</button></td><td><button class="btn ${k}" disabled>Button</button></td></tr>`)
        .join("") +
      `<tr><th>Input</th><td><input value="Text"></td><td><input value="Text" class="is-hover"></td><td></td><td><input value="Text" class="is-focus"></td><td><input value="Text" disabled></td></tr></table>`,
    BTN_CSS +
      `.note{color:var(--color-text-muted);font-size:var(--text-small);max-width:60ch}table{border-collapse:separate;border-spacing:var(--space-3)}th{font-size:var(--text-caption);font-weight:600;color:var(--color-text-muted);text-align:left}` +
      `input{font:inherit;width:96px;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);border:var(--border-width) solid var(--color-border);background:var(--color-bg);color:var(--color-text)}input.is-hover{border-color:var(--color-text-muted)}input:disabled{opacity:var(--opacity-disabled)}`
  );

  const moreCard = card(
    "Components",
    "Selection, navigation and feedback",
    `<h2>Navigation</h2>\n<nav class="nav"><b>${ds.name}</b><a class="on" href="#">Overview</a><a href="#">Projects</a><a href="#">Team</a><span></span><button class="btn primary">New project</button></nav>\n` +
      `<h2>Tabs</h2>\n<div class="tabs"><a class="on" href="#">Details</a><a href="#">Activity</a><a href="#">Settings</a></div>\n` +
      `<h2>Checkbox, radio and switch</h2>\n<div class="r"><label class="ck"><input type="checkbox" checked> Checked</label><label class="ck"><input type="checkbox"> Unchecked</label><label class="ck"><input type="radio" name="r" checked> Selected</label><label class="ck"><input type="radio" name="r"> Option</label><span class="sw on"></span><span class="sw"></span></div>\n` +
      `<h2>Tooltip and toast</h2>\n<div class="r" style="align-items:center"><span class="tip">Copied to clipboard</span><div class="toast"><b>Saved.</b> Your changes are live. <a href="#">Undo</a></div></div>\n` +
      `<h2>Dialog</h2>\n<div class="scrim"><div class="dialog"><h3>Delete this project?</h3><p>This removes the project and its files for everyone. It can't be undone.</p><div class="r" style="justify-content:flex-end"><button class="btn ghost">Cancel</button><button class="btn danger">Delete project</button></div></div></div>`,
    BTN_CSS +
      `.nav{display:flex;align-items:center;gap:var(--space-6);padding:var(--space-3) var(--space-4);background:var(--color-surface);border:var(--border-width) solid var(--color-border);border-radius:var(--radius-lg)}.nav b{font-family:var(--font-heading)}.nav a{color:var(--color-text-muted);text-decoration:none;font-size:var(--text-small);font-weight:600}.nav a.on{color:var(--color-text)}.nav span{flex:1}` +
      `.tabs{display:flex;gap:var(--space-6);border-bottom:var(--border-width) solid var(--color-border)}.tabs a{padding:var(--space-3) 0;color:var(--color-text-muted);text-decoration:none;font-size:var(--text-small);font-weight:600;border-bottom:2px solid transparent;margin-bottom:-1px}.tabs a.on{color:var(--color-text);border-color:var(--color-primary)}` +
      `.ck{display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-small)}.ck input{width:18px;height:18px;accent-color:var(--color-link)}` +
      `.sw{width:40px;height:24px;border-radius:var(--radius-pill);background:var(--color-border);position:relative;display:inline-block}.sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--color-bg);box-shadow:var(--shadow-sm);transition:left var(--duration-fast) var(--ease-standard)}.sw.on{background:var(--color-link)}.sw.on::after{left:19px}` +
      `.tip{background:var(--color-text);color:var(--color-bg);font-size:var(--text-caption);padding:var(--space-1) var(--space-2);border-radius:var(--radius-sm)}` +
      `.toast{background:var(--color-surface);border:var(--border-width) solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-md);padding:var(--space-3) var(--space-4);font-size:var(--text-small)}.toast a{color:var(--color-link);font-weight:600;margin-left:var(--space-2)}` +
      `.scrim{background:rgba(0,0,0,.35);border-radius:var(--radius-lg);padding:var(--space-8);display:grid;place-items:center}.dialog{background:var(--color-bg);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:var(--space-6);max-width:420px}.dialog h3{font-family:var(--font-heading);font-size:var(--text-h3);margin:0 0 var(--space-2)}.dialog p{color:var(--color-text-muted);margin:0 0 var(--space-6);font-size:var(--text-small)}`
  );

  const darkBody =
    `<p class="note">The same tokens with <code>data-theme="dark"</code> on the page. Brand and status colors do not change; surfaces, text, borders, the link color, soft status backgrounds and shadows do.</p>\n` +
    `<div class="r"><button class="btn primary">Primary action</button><button class="btn secondary">Secondary</button><button class="btn ghost">Ghost</button></div>\n` +
    `<div class="card"><h3>Card title</h3><p>Body text on the dark surface. <a href="#">Links use the dark link color.</a></p></div>\n` +
    ds.status.map((s) => `<div class="alert" style="background:var(--color-${s.token}-soft);color:var(--color-on-${s.token}-soft);border-color:var(--color-${s.token})"><b>${s.label}.</b> A short message.</div>`).join("\n");
  const darkCard = card(
    "Colors",
    "Dark theme",
    darkBody,
    BTN_CSS +
      `.note{color:var(--color-text-muted);font-size:var(--text-small);max-width:60ch}.r{margin:var(--space-4) 0}` +
      `.card{background:var(--color-surface);border:var(--border-width) solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-6);box-shadow:var(--shadow-md);max-width:440px;margin-bottom:var(--space-4)}.card h3{font-family:var(--font-heading);font-size:var(--text-h3);margin:0 0 var(--space-2)}.card p{margin:0;color:var(--color-text-muted)}.card a{color:var(--color-link)}` +
      `.alert{border-left:4px solid;border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-2);font-size:var(--text-small)}`,
    "dark"
  );

  const componentsCard = card(
    "Components",
    "Core components",
    `<h2>Buttons</h2>\n<div class="r"><button class="btn primary">Primary action</button><button class="btn secondary">Secondary</button><button class="btn ghost">Ghost</button><button class="btn danger">Delete</button><button class="btn primary" disabled>Disabled</button></div>\n` +
      `<h2>Form</h2>\n<div class="r"><label class="f">Email<input type="email" placeholder="you@example.com"></label><label class="f">Plan<select><option>Monthly</option><option>Annual</option></select></label></div>\n` +
      `<h2>Card</h2>\n<div class="card"><span class="badge">New</span><h3>Card title</h3><p>Cards sit on the surface color with a hairline border and a small shadow. <a href="#">Links use the link color.</a></p><div class="r"><button class="btn primary">Continue</button><button class="btn ghost">Cancel</button></div></div>\n` +
      `<h2>Alerts</h2>\n${ds.status.map((s) => `<div class="alert" style="background:var(--color-${s.token}-soft);color:var(--color-on-${s.token}-soft);border-color:var(--color-${s.token})"><b>${s.label}.</b> A short message that says what happened and what to do next.</div>`).join("\n")}`,
    `.r{display:flex;gap:var(--space-3);flex-wrap:wrap;align-items:flex-end}` +
      `.btn{font:inherit;font-weight:600;font-size:var(--text-small);padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);border:var(--border-width) solid transparent;cursor:pointer}` +
      `.btn.primary{background:var(--color-primary);color:var(--color-on-primary)}.btn.secondary{background:var(--color-surface);color:var(--color-text);border-color:var(--color-border)}.btn.ghost{background:transparent;color:var(--color-link)}.btn.danger{background:var(--color-danger);color:var(--color-on-danger)}.btn:disabled{opacity:.45;cursor:not-allowed}` +
      `.f{display:flex;flex-direction:column;gap:var(--space-1);font-size:var(--text-small);font-weight:600}.f input,.f select{font:inherit;font-weight:400;padding:var(--space-3);border-radius:var(--radius-md);border:var(--border-width) solid var(--color-border);background:var(--color-bg);color:var(--color-text);min-width:220px}` +
      `.card{background:var(--color-surface);border:var(--border-width) solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-6);box-shadow:var(--shadow-sm);max-width:440px}.card h3{font-family:var(--font-heading);font-size:var(--text-h3);margin:var(--space-2) 0}.card p{margin:0 0 var(--space-4);color:var(--color-text-muted)}.card a{color:var(--color-link)}` +
      `.badge{display:inline-block;font-size:var(--text-caption);font-weight:600;padding:2px var(--space-2);border-radius:var(--radius-pill);background:${ds.named.find((n) => n.role === "accent")?.hex ?? "var(--color-primary)"};color:${ds.named.find((n) => n.role === "accent")?.on ?? "var(--color-on-primary)"}}` +
      `.alert{border-left:4px solid;border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-2);font-size:var(--text-small)}`
  );

  return [
    { path: "preview/colors.html", content: palette },
    { path: "preview/pairs.html", content: pairsCard },
    { path: "preview/ramps.html", content: rampsCard },
    { path: "preview/status.html", content: statusCard },
    { path: "preview/type.html", content: typeCard },
    { path: "preview/spacing.html", content: shapeCard },
    { path: "preview/components.html", content: componentsCard },
    { path: "preview/states.html", content: statesCard },
    { path: "preview/components-more.html", content: moreCard },
    { path: "preview/dark.html", content: darkCard },
  ];
}

/* ------------------------------ README ------------------------------ */

function readme(ds: DesignSystem): string {
  const has = (r: string) => ds.named.some((c) => c.role === r);
  const rows = ds.named.map((c) => `| ${c.label} | \`${c.hex}\` | ${c.job} | \`${c.on}\` |`).join("\n");
  const pairs = readablePairs(ds.named, 10);
  const rules = [
    "Use the palette colors and the ramps, grays and status colors defined here. Do not introduce other hues.",
    "Background is the default page color and Text is the default text color. The dark theme has its own values, listed below; do not simply swap the two.",
    has("primary") ? "Primary carries the brand: the logo, main buttons and key fills. One primary action per view." : null,
    `Links use \`${ds.link.hex}\` (${ds.link.from}), which is ${ds.link.ratio.toFixed(1)}:1 on the page background.${
      ds.link.hex !== ds.named.find((n) => n.role === "primary")?.hex ? " Primary is not readable enough as text on the background, so do not use it for links or body text." : ""
    }`,
    has("secondary") ? "Secondary supports Primary: secondary fills, tags, panels, chart series." : null,
    has("accent") ? "Accent is for emphasis only: a highlight, a badge, one call to action. Keep it to small areas." : null,
    "For text on a colored fill, use the matching `on-` color.",
    "Status colors are for state only (success, warning, danger, info), never for decoration.",
    "Body text must meet 4.5:1 contrast. The pairs below are verified.",
  ].filter(Boolean);

  return (
    `# ${ds.name}: starter design system\n\n` +
    `Built around a ${ds.named.length}-color ${ds.mode} palette. Use it as the foundation for everything you design or build for this brand.\n\n` +
    `## What is a brand decision and what is a default\n\n` +
    `- **Brand name:** ${ds.name}.\n` +
    `- **Palette:** chosen by the owner.\n` +
    `- **Type pairing:** ${ds.type.heading}${ds.type.body !== ds.type.heading ? ` + ${ds.type.body}` : ""}. ${ds.options.chosen.type ? "Selected by the owner; treat it as a brand decision." : "Left on the export default. Confirm it with the owner before treating it as the brand typeface."}\n` +
    `- **Corner style:** ${ds.corners.label.toLowerCase()}. ${ds.options.chosen.corners ? "Selected by the owner." : "Left on the export default; confirm with the owner."}\n` +
    `- **Icon set:** ${ds.icons.label}. ${ds.options.chosen.icons ? "Selected by the owner." : "Left on the export default; confirm with the owner."}\n` +
    `- **Derived from the palette:** tint and shade ramps, the gray ramp (tinted with the brand hue), status colors (strength matched to the brand color), the link color, hover and pressed states, the dark theme, borders and shadows.\n` +
    `- **Standard starter values:** the type scale, the 4px spacing scale, motion timings, breakpoints and container widths. Sensible, but not specific to this brand. Adjust if the owner gives other guidance.\n\n` +
    `## Palette\n\n| Role | Hex | Use for | Text on it |\n|---|---|---|---|\n${rows}\n\n` +
    `## Surfaces and text\n\n` +
    `| Token | Hex | Use for |\n|---|---|---|\n| Background | \`${ds.bg}\` | Page |\n| Surface | \`${ds.surface}\` | Cards and panels |\n| Text | \`${ds.ink}\` | Body text |\n| Muted text | \`${ds.muted}\` | Secondary text |\n| Border | \`${ds.line}\` | Hairlines, input borders |\n| Link | \`${ds.link.hex}\` | Link text |\n\n` +
    `## Rules\n\n${rules.map((r) => `- ${r}`).join("\n")}\n\n` +
    `## Verified readable pairs\n\n${
      pairs.length ? pairs.map((p) => `- ${p.text.label} \`${p.text.hex}\` on ${p.bg.label} \`${p.bg.hex}\`: ${p.ratio.toFixed(1)}:1 (${grade(p.ratio)})`).join("\n") : "- No pair in this palette reaches 4.5:1. Use near-black or near-white text."
    }\n\n` +
    `## Status colors\n\n| State | Solid | Text on it | Soft background | Text on soft |\n|---|---|---|---|---|\n${ds.status.map((s) => `| ${s.label} | \`${s.hex}\` | \`${s.on}\` | \`${s.soft}\` | \`${s.onSoft}\` |`).join("\n")}\n\n` +
    `## Typography\n\n${ds.type.note}\n\n- Headings: **${ds.type.heading}**\n- Body: **${ds.type.body}**\n- Code and numbers: **${ds.type.mono}**\n\nAll three are open-source Google Fonts, loaded by \`tokens.css\`.\n\n` +
    `| Style | Size | Line height | Weight |\n|---|---|---|---|\n${TYPE_SCALE.map((t) => `| ${t.label} | ${t.size}px | ${t.line} | ${t.weight} |`).join("\n")}\n\n` +
    `## Shape and spacing\n\n- Corners: small ${ds.corners.sm}px, medium ${ds.corners.md}px (buttons, inputs), large ${ds.corners.lg}px (cards), plus a full pill for badges.\n` +
    `- Spacing: a 4px base: ${SPACING.map(([, v]) => `${v}`).join(", ")}px.\n- Borders: 1px in the Border color.\n- Shadows: three levels (sm, md, lg), tinted with the Text color.\n\n` +
    `## Interaction states\n\n- **Hover:** the main button fill becomes \`${ds.states.primaryHover}\`; secondary buttons and inputs darken their border; ghost buttons gain the Surface color.\n- **Pressed:** the main button fill becomes \`${ds.states.primaryPressed}\`.\n- **Focus:** a 2px ring in the Link color, offset by 2px of the background (\`--focus-ring\`). Show it for keyboard focus on every interactive element.\n- **Disabled:** 45% opacity, no hover change, \`not-allowed\` cursor.\n\n` +
    `## Dark theme\n\nSet \`data-theme="dark"\` on the page. Brand, ramp and solid status colors are unchanged.\n\n| Token | Dark value |\n|---|---|\n| Background | \`${ds.dark.bg}\` |\n| Surface | \`${ds.dark.surface}\` |\n| Text | \`${ds.dark.ink}\` |\n| Muted text | \`${ds.dark.muted}\` |\n| Border | \`${ds.dark.line}\` |\n| Link | \`${ds.dark.link}\` (${ds.dark.linkRatio.toFixed(1)}:1 on the dark background) |\n\nSoft status backgrounds switch to deep tints with light text, and shadows become stronger and pure black. All values are in \`tokens.css\` under \`[data-theme="dark"]\`.\n\n` +
    `## Icons\n\nUse **${ds.icons.label}** (${ds.icons.url}). ${ds.icons.note} Icons take the color of the text beside them; do not color them with status colors unless they signal that state.\n\n` +
    `## Motion and layout\n\n- Durations: fast 120ms (hover, focus), base 200ms (menus, toggles), slow 320ms (dialogs, page-level changes).\n- Easing: \`cubic-bezier(0.2, 0, 0, 1)\` as the standard curve. Respect reduced-motion preferences.\n- Breakpoints: ${BREAKPOINTS.map(([k, v]) => `${k} ${v}px`).join(", ")}.\n- Content width: 1200px maximum, 720px for long-form reading.\n\n` +
    `## Components\n\nThe preview cards show the starting set, built only from these tokens:\n\n- \`preview/components.html\`: primary, secondary, ghost and danger buttons, text input, select, a card with a badge, and the four alerts\n- \`preview/states.html\`: default, hover, pressed, focus and disabled for buttons and inputs\n- \`preview/components-more.html\`: navigation bar, tabs, checkbox, radio, switch, tooltip, toast and dialog\n- \`preview/dark.html\`: the dark theme applied\n\nAuthor any further components in the same style.\n\n` +
    (ds.options.url ? `## Product reference\n\nThe owner's live site or product: ${ds.options.url}\n\nUse it as the reference for real screens, layout and density. Where it disagrees with a starter value in this file, the product wins.\n\n` : "") +
    (ds.options.voice ? `## Voice and tone\n\nIn the owner's words:\n\n> ${ds.options.voice.replace(/\s+/g, " ").trim()}\n\nWrite interface copy and sample content to match.\n\n` : "") +
    `## Not included: ask, do not invent\n\nThis export comes from a color tool, so it cannot supply the following. Ask the owner for them before relying on a guess:\n\n` +
    `- **Logo** files and the rules for using them\n- **Imagery:** photo or illustration style, with examples\n` +
    (ds.options.voice ? "" : `- **Voice and tone:** sample copy and casing rules\n`) +
    (ds.options.url ? "" : `- **Product references:** screenshots, a live URL or a repository of anything already built\n`) +
    `\n` +
    `## Files\n\n- \`tokens.css\`: every token as a CSS custom property, and the font import\n- \`tokens.json\`: the same values in design-token JSON\n- \`preview/*.html\`: preview cards for colors, ramps, status, the dark theme, type, spacing, components and interaction states\n\n` +
    `Exported from palette by vixxiv (https://palette.vixxiv.com).\n`
  );
}

/** The full Claude Design bundle: tokens, a README of rules, and preview cards. */
export function buildDesignSystemBundle(colors: ColorItem[], mode: HarmonyMode, options: DesignSystemOptions): BundleFile[] {
  const ds = buildDesignSystem(colors, mode, options);
  return [{ path: "README.md", content: readme(ds) }, { path: "tokens.css", content: tokensCss(ds) }, { path: "tokens.json", content: tokensJson(ds) }, ...previewCards(ds)];
}
