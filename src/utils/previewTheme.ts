/**
 * Turns a palette into a usable interface theme for the "In Action" previews.
 *
 * Each colour is used for the job its role describes: the light neutral is
 * the page, the dark neutral is the text, the primary carries the brand and
 * main buttons, the secondary supports, the accent highlights. Anything the
 * palette does not provide (a second surface, muted text, hairlines) is
 * derived from the colours it does have, so the preview never invents an
 * unrelated colour. Text placed on a coloured fill is whichever of the
 * palette's own light or dark gives the better contrast.
 */

import { ColorItem, getContrastRatio } from "./colorUtils";
import { hexToOklch, oklchToHex, resolveRoles } from "./paletteEngine";

export interface PreviewTheme {
  dark: boolean;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  accent: string;
  onAccent: string;
  /** Distinct chromatic colours for charts and artwork, most important first. */
  series: string[];
  /** Picks readable text for any fill. */
  on: (fill: string) => string;
  /** Every palette colour with the job it has in the preview, in palette order. */
  usage: { hex: string; job: string }[];
  /** Colours the preview needed but the palette did not supply. */
  derived: { hex: string; job: string }[];
  /** Plain-language reasons for each kind of colour in `derived`. */
  derivedWhy: string[];
}

const isNeutral = (c: { role: string }) => c.role === "neutral-light" || c.role === "neutral-dark";

export function buildPreviewTheme(input: ColorItem[], dark: boolean): PreviewTheme {
  // Colours left on "general" are used for whatever their colour suits.
  const colors = resolveRoles(input);
  const ok = (hex: string) => hexToOklch(hex);
  const lights = colors.filter((c) => c.role === "neutral-light").sort((a, b) => ok(b.hex).L - ok(a.hex).L);
  const darks = colors.filter((c) => c.role === "neutral-dark").sort((a, b) => ok(a.hex).L - ok(b.hex).L);
  const chromatic = colors.filter((c) => !isNeutral(c));

  const primaryItem =
    colors.find((c) => c.role === "primary") ??
    [...chromatic].sort((a, b) => ok(b.hex).C - ok(a.hex).C)[0] ??
    colors[0];
  const primary = primaryItem.hex;
  const p = ok(primary);

  // Fall back to neutrals tinted with the primary hue when a palette has none.
  const light0 = lights[0]?.hex ?? oklchToHex(0.975, 0.008, p.h);
  const dark0 = darks[0]?.hex ?? oklchToHex(0.19, 0.02, p.h);

  const bg = dark ? dark0 : light0;
  const ink = dark ? light0 : dark0;
  const b = ok(bg);
  const k = ok(ink);

  const spare = dark ? darks[1]?.hex : lights[1]?.hex;
  const surface = spare ?? oklchToHex(b.L + (dark ? 0.055 : -0.035), Math.max(b.C, 0.006), b.h);
  const between = (t: number) => oklchToHex(k.L + (b.L - k.L) * t, k.C + (b.C - k.C) * t, k.h);
  const muted = between(0.42);
  const line = between(0.86);

  const secondary =
    colors.find((c) => c.role === "secondary")?.hex ??
    oklchToHex(Math.min(0.9, p.L + 0.2), p.C * 0.5, p.h);
  const accent = colors.find((c) => c.role === "accent")?.hex ?? secondary;

  const on = (fill: string) => {
    const withLight = getContrastRatio(fill, light0);
    const withDark = getContrastRatio(fill, dark0);
    if (Math.max(withLight, withDark) >= 3) return withLight >= withDark ? light0 : dark0;
    return getContrastRatio(fill, "#FFFFFF") >= getContrastRatio(fill, "#000000") ? "#FFFFFF" : "#000000";
  };

  const series: string[] = [];
  [primary, accent, secondary, ...chromatic.map((c) => c.hex)].forEach((hex) => {
    if (!series.some((s) => s.toLowerCase() === hex.toLowerCase())) series.push(hex);
  });
  // Charts need at least four steps; extend with tints of the primary.
  let step = 1;
  const ownSeries = series.length;
  const tints: string[] = [];
  while (series.length < 4) {
    tints.push(oklchToHex(Math.min(0.9, Math.max(0.3, p.L + 0.14 * step * (p.L > 0.6 ? -1 : 1))), p.C * 0.7, p.h));
    series.push(tints[tints.length - 1]);
    step++;
  }

  // What each palette colour is doing, so nothing in the palette is a mystery.
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const usage = colors.map((c) => {
    let job = "Charts and artwork";
    if (same(c.hex, bg)) job = "Page background";
    else if (same(c.hex, ink)) job = "Text";
    else if (same(c.hex, primary)) job = "Brand and main buttons";
    else if (same(c.hex, accent)) job = "Highlights";
    else if (same(c.hex, secondary)) job = "Supporting areas";
    else if (same(c.hex, surface)) job = "Cards and panels";
    else if (same(c.hex, (dark ? lights : darks)[1]?.hex ?? "")) job = dark ? "Cards in the light theme" : "Cards in the dark theme";
    else if (isNeutral(c)) job = "Spare neutral, not shown here";
    return { hex: c.hex, job };
  });
  const inPalette = (hex: string) => colors.some((c) => same(c.hex, hex));
  const derived = [
    { hex: bg, job: "Page background" },
    { hex: ink, job: "Text" },
    { hex: secondary, job: "Supporting areas" },
  ].filter((d) => !inPalette(d.hex));
  tints.forEach((hex) => {
    if (!inPalette(hex) && !derived.some((d) => same(d.hex, hex))) derived.push({ hex, job: `Tint of ${primary.toUpperCase()}` });
  });

  // Say why each addition exists, so nothing on screen is a mystery.
  const derivedWhy: string[] = [];
  if (tints.length) {
    derivedWhy.push(
      `Your palette has ${ownSeries} ${ownSeries === 1 ? "color that isn't" : "colors that aren't"} a neutral, and these layouts need 4 to tell chart bars, icons and shapes apart. The preview fills the gap with lighter or darker tints of your brand color ${primary.toUpperCase()}, the way a designer would stretch a small palette. Add more swatches and your own colors take their place.`
    );
  }
  if (!inPalette(bg) || !inPalette(ink)) {
    derivedWhy.push(
      `Your palette has no ${!inPalette(bg) && !inPalette(ink) ? "near-white or near-black" : (dark ? !inPalette(bg) : !inPalette(ink)) ? "near-black" : "near-white"} neutral, so the preview adds one, lightly tinted with your brand color, for the ${!inPalette(bg) && !inPalette(ink) ? "page and text" : !inPalette(bg) ? "page" : "text"}.`
    );
  }
  if (!inPalette(secondary) && !tints.some((t) => same(t, secondary))) {
    derivedWhy.push("Your palette has no supporting color, so the preview uses a softer version of your brand color for secondary areas.");
  }

  return {
    usage,
    derived,
    derivedWhy,
    dark,
    bg,
    surface,
    ink,
    muted,
    line,
    primary,
    onPrimary: on(primary),
    secondary,
    onSecondary: on(secondary),
    accent,
    onAccent: on(accent),
    series,
    on,
  };
}
