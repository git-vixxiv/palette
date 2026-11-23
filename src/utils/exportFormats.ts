/**
 * Export formats for a palette: CSS variables, Tailwind, design-token JSON,
 * a written brief for Claude, and a small design-system bundle for Claude
 * Design. Everything is generated in the browser; nothing is uploaded.
 */

import { ColorItem, ColorRole, HarmonyMode, getContrastRatio } from "./colorUtils";
import { buildPreviewTheme } from "./previewTheme";

export interface NamedColor {
  token: string; // e.g. "primary", "secondary-2"
  label: string; // e.g. "Primary", "Secondary 2"
  hex: string;
  role: ColorRole;
  on: string; // readable text colour for this fill, taken from the palette
  job: string; // what the colour is for
}

const TOKEN: Record<ColorRole, string> = {
  primary: "primary",
  secondary: "secondary",
  accent: "accent",
  "neutral-light": "light",
  "neutral-dark": "dark",
};
const LABEL: Record<ColorRole, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  "neutral-light": "Light",
  "neutral-dark": "Dark",
};
const PURPOSE: Record<ColorRole, string> = {
  primary: "Brand color and main buttons",
  secondary: "Supporting areas, secondary buttons, tags",
  accent: "Highlights and calls to action, in small amounts",
  "neutral-light": "Page and card backgrounds",
  "neutral-dark": "Body text and dark surfaces",
};

/** Give every colour a stable token name from its role (primary, secondary-2, ...). */
export function nameColors(colors: ColorItem[]): NamedColor[] {
  const theme = buildPreviewTheme(colors, false);
  const seen: Partial<Record<ColorRole, number>> = {};
  return colors.map((c) => {
    const n = (seen[c.role] = (seen[c.role] ?? 0) + 1);
    return {
      token: n > 1 ? `${TOKEN[c.role]}-${n}` : TOKEN[c.role],
      label: n > 1 ? `${LABEL[c.role]} ${n}` : LABEL[c.role],
      hex: c.hex.toUpperCase(),
      role: c.role,
      on: theme.on(c.hex).toUpperCase(),
      job: PURPOSE[c.role],
    };
  });
}

const grade = (r: number) => (r >= 7 ? "AAA" : r >= 4.5 ? "AA" : "AA large text only");

/** Text/background pairs from the palette that meet WCAG AA, strongest first. */
export function readablePairs(named: NamedColor[], limit = 8) {
  const pairs: { text: NamedColor; bg: NamedColor; ratio: number }[] = [];
  // Contrast is symmetric, so list each pair once, written as dark on light.
  const darkness = (hex: string) => getContrastRatio(hex, "#FFFFFF");
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const ratio = getContrastRatio(named[i].hex, named[j].hex);
      if (ratio < 4.5) continue;
      const [text, bg] = darkness(named[i].hex) >= darkness(named[j].hex) ? [named[i], named[j]] : [named[j], named[i]];
      pairs.push({ text, bg, ratio });
    }
  }
  return pairs.sort((a, b) => b.ratio - a.ratio).slice(0, limit);
}

export function buildCssVariables(colors: ColorItem[], mode: HarmonyMode): string {
  const named = nameColors(colors);
  const lines = named.flatMap((c) => [`  --color-${c.token}: ${c.hex};`, `  --color-on-${c.token}: ${c.on};`]);
  return `/* palette by vixxiv · ${mode} scheme · ${named.length} colors */\n:root {\n${lines.join("\n")}\n}\n`;
}

export function buildTailwind(colors: ColorItem[], mode: HarmonyMode): string {
  const named = nameColors(colors);
  const v4 = named.flatMap((c) => [`  --color-${c.token}: ${c.hex};`, `  --color-on-${c.token}: ${c.on};`]).join("\n");
  const v3 = named.flatMap((c) => [`        "${c.token}": "${c.hex}",`, `        "on-${c.token}": "${c.on}",`]).join("\n");
  return (
    `/* palette by vixxiv · ${mode} scheme */\n\n` +
    `/* Tailwind v4: add to your main CSS file. Gives you bg-primary, text-on-primary, etc. */\n` +
    `@theme {\n${v4}\n}\n\n` +
    `/* Tailwind v3: merge into tailwind.config.js */\n` +
    `module.exports = {\n  theme: {\n    extend: {\n      colors: {\n${v3}\n      },\n    },\n  },\n};\n`
  );
}

/** Design Tokens Community Group format, readable by most token tools. */
export function buildJsonTokens(colors: ColorItem[], mode: HarmonyMode): string {
  const named = nameColors(colors);
  const color: Record<string, unknown> = {};
  named.forEach((c) => {
    color[c.token] = { $type: "color", $value: c.hex, $description: c.job };
    color[`on-${c.token}`] = { $type: "color", $value: c.on, $description: `Readable text on ${c.label}` };
  });
  return JSON.stringify({ $description: `palette by vixxiv · ${mode} scheme`, color }, null, 2) + "\n";
}

/** A written brief that tells Claude exactly how to use the palette. */
export function buildClaudeBrief(colors: ColorItem[], mode: HarmonyMode, name = "Untitled palette"): string {
  const named = nameColors(colors);
  const pairs = readablePairs(named);
  const rows = named.map((c) => `| ${c.label} | \`${c.hex}\` | ${c.job} | \`${c.on}\` |`).join("\n");
  const pairLines = pairs.length
    ? pairs.map((p) => `- ${p.text.label} \`${p.text.hex}\` on ${p.bg.label} \`${p.bg.hex}\`: ${p.ratio.toFixed(1)}:1 (${grade(p.ratio)})`).join("\n")
    : "- No pair in this palette reaches 4.5:1. Use near-black or near-white text and say so.";
  const has = (r: ColorRole) => named.some((c) => c.role === r);
  const rules = [
    "Use only these colors. Tints and shades of them are fine; do not introduce new hues.",
    has("neutral-light") && has("neutral-dark") ? "Light is the default page background and Dark is the default text color. For a dark theme, swap them." : null,
    has("primary") ? "Primary carries the brand: logo, main buttons, key links. One primary action per view." : null,
    has("secondary") ? "Secondary supports Primary: secondary buttons, tags, panels, chart series." : null,
    has("accent") ? "Accent is for emphasis only: a highlight, a badge, one call to action. Keep it to small areas." : null,
    "For text on a colored fill, use the \"Text on it\" color listed for that fill.",
    "Body text must meet 4.5:1 contrast. The pairs below are verified.",
  ].filter(Boolean);

  return (
    `# Color palette: ${name}\n\n` +
    `A ${named.length}-color ${mode} scheme. Apply it to everything you design or build for me.\n\n` +
    `## Colors\n\n| Role | Hex | Use for | Text on it |\n|---|---|---|---|\n${rows}\n\n` +
    `## Rules\n\n${rules.map((r) => `- ${r}`).join("\n")}\n\n` +
    `## Verified readable pairs\n\n${pairLines}\n\n` +
    `## CSS variables\n\n\`\`\`css\n${buildCssVariables(colors, mode)}\`\`\`\n`
  );
}

/* ------------------------------------------------------------------ *
 * Claude Design bundle
 * ------------------------------------------------------------------ */

export interface BundleFile {
  path: string;
  content: string;
}

const cardShell = (title: string, body: string, bg: string, ink: string) =>
  `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>\n` +
  `<link rel="stylesheet" href="../colors.css">\n` +
  `<style>body{margin:0;padding:24px;font-family:ui-sans-serif,system-ui,sans-serif;background:${bg};color:${ink}}h1{font-size:16px;margin:0 0 16px}` +
  `.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.sw{border-radius:10px;padding:14px;min-height:92px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid rgba(0,0,0,.08)}` +
  `.sw b{font-size:13px}.sw code{font-size:12px}.sw small{font-size:11px;opacity:.85}.row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;margin-bottom:8px;font-size:14px}.row span{margin-left:auto;font-size:12px;opacity:.85}</style></head>\n<body>\n${body}\n</body></html>\n`;

/**
 * A minimal design-system folder: tokens, a README of usage rules, and two
 * preview cards. The first line of each preview is the marker Claude Design's
 * design-system panel reads to list a card.
 */
export function buildClaudeDesignBundle(colors: ColorItem[], mode: HarmonyMode, name = "Untitled palette"): BundleFile[] {
  const named = nameColors(colors);
  const theme = buildPreviewTheme(colors, false);
  const pairs = readablePairs(named, 10);

  const swatches = named
    .map((c) => `  <div class="sw" style="background:${c.hex};color:${c.on}"><b>${c.label}</b><div><code>${c.hex}</code><br><small>${c.job}</small></div></div>`)
    .join("\n");
  const colorsCard =
    `<!-- @dsCard group="Colors" -->\n` + cardShell("Palette", `<h1>${name}: ${named.length}-color ${mode} palette</h1>\n<div class="grid">\n${swatches}\n</div>`, theme.bg, theme.ink);

  const pairRows = pairs
    .map((p) => `  <div class="row" style="background:${p.bg.hex};color:${p.text.hex}">${p.text.label} on ${p.bg.label}<span>${p.ratio.toFixed(1)}:1 ${grade(p.ratio)}</span></div>`)
    .join("\n");
  const pairsCard =
    `<!-- @dsCard group="Colors" -->\n` + cardShell("Readable pairs", `<h1>Readable text pairs (WCAG)</h1>\n${pairRows || "<p>No pair in this palette reaches 4.5:1.</p>"}`, theme.bg, theme.ink);

  const readme =
    buildClaudeBrief(colors, mode, name) +
    `\n## Files in this bundle\n\n` +
    `- \`colors.css\`: the palette as CSS custom properties\n` +
    `- \`tokens.json\`: the same values in design-token JSON\n` +
    `- \`preview/colors.html\`, \`preview/pairs.html\`: preview cards\n\n` +
    `Exported from palette by vixxiv (https://palette.vixxiv.com).\n`;

  return [
    { path: "README.md", content: readme },
    { path: "colors.css", content: buildCssVariables(colors, mode) },
    { path: "tokens.json", content: buildJsonTokens(colors, mode) },
    { path: "preview/colors.html", content: colorsCard },
    { path: "preview/pairs.html", content: pairsCard },
  ];
}

/* ------------------------------------------------------------------ *
 * Minimal ZIP writer (stored, no compression) so no dependency is needed
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipFiles(files: BundleFile[], folder: string): Blob {
  const enc = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = enc.encode(`${folder}/${file.path}`);
    const data = enc.encode(file.content);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, time, true);
    dir.setUint16(14, date, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: "application/zip" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const downloadText = (text: string, filename: string, type = "text/plain") =>
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
