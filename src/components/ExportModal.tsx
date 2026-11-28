import React, { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { X, Copy, Check, Download, Lock, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import {
  buildCssVariables,
  buildTailwind,
  buildJsonTokens,
  buildClaudeBrief,
  zipFiles,
  downloadBlob,
  downloadText,
} from "../utils/exportFormats";
import { buildDesignSystemBundle, TYPE_STYLES, CORNER_STYLES, ICON_SETS, TypeStyle, CornerStyle, IconSet } from "../utils/designSystem";

type FormatId = "css" | "tailwind" | "json" | "claude";

const FORMATS: { id: FormatId; label: string; file: string; type: string; pro: boolean; blurb: string }[] = [
  { id: "css", label: "CSS variables", file: "palette.css", type: "text/css", pro: false, blurb: "Custom properties for any website or app." },
  { id: "tailwind", label: "Tailwind", file: "palette-tailwind.txt", type: "text/plain", pro: true, blurb: "Theme colors for Tailwind v4 and v3." },
  { id: "json", label: "Design tokens", file: "palette.tokens.json", type: "application/json", pro: true, blurb: "Standard token JSON for Figma plugins and token tools." },
  { id: "claude", label: "Claude", file: "palette-brief.md", type: "text/markdown", pro: true, blurb: "A brief Claude can follow, plus a starter design system for Claude Design." },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<Props> = ({ open, onClose }) => {
  const { currentColors, harmonyMode, userSubscription, setShowUpgradeModal, showToast } = useApp();
  const [format, setFormat] = useState<FormatId>("css");
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [typeStyle, setTypeStyle] = useState<TypeStyle>("modern");
  const [corners, setCorners] = useState<CornerStyle>("soft");
  const [iconSet, setIconSet] = useState<IconSet>("lucide");
  const [siteUrl, setSiteUrl] = useState("");
  const [voice, setVoice] = useState("");
  // Which choices were actually made. The bundle tells Claude Design to treat
  // an untouched default as something to confirm, not as a brand decision.
  const [chosen, setChosen] = useState({ type: false, corners: false, icons: false });
  const [nameMissing, setNameMissing] = useState(false);

  const isPro = userSubscription.tier !== "free";
  const active = FORMATS.find((f) => f.id === format)!;
  const locked = active.pro && !isPro;
  const title = name.trim() || "Untitled palette";

  const output = useMemo(() => {
    if (!open) return "";
    switch (format) {
      case "css":
        return buildCssVariables(currentColors, harmonyMode);
      case "tailwind":
        return buildTailwind(currentColors, harmonyMode);
      case "json":
        return buildJsonTokens(currentColors, harmonyMode);
      case "claude":
        return buildClaudeBrief(currentColors, harmonyMode, title);
    }
  }, [open, format, currentColors, harmonyMode, title]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      showToast("Could not copy. Select the text and copy it manually.", "error");
    }
  };

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "palette";

  const downloadBundle = () => {
    // A design system needs a name; "Untitled palette" is the first thing
    // Claude Design asks to have fixed.
    if (!name.trim()) {
      setNameMissing(true);
      showToast("Give the design system a brand name first.", "error");
      return;
    }
    const url = siteUrl.trim();
    const files = buildDesignSystemBundle(currentColors, harmonyMode, {
      name: name.trim(),
      typeStyle,
      cornerStyle: corners,
      iconSet,
      url: url ? (/^https?:\/\//i.test(url) ? url : `https://${url}`) : undefined,
      voice: voice.trim() || undefined,
      chosen,
    });
    downloadBlob(zipFiles(files, `${slug}-design-system`), `${slug}-design-system.zip`);
    showToast("Design-system bundle downloaded", "success");
  };

  const upgrade = () => {
    onClose();
    setShowUpgradeModal(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} onClick={onClose} className="absolute inset-0 bg-slate-900" />

      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] relative z-10 border border-slate-200 flex flex-col overflow-hidden"
        role="dialog"
        aria-label="Export palette"
      >
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-display font-bold text-slate-900">Export palette</h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">Colors are named by role, with a readable text color for each.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-9 shrink-0">
          {currentColors.map((c, i) => (
            <div key={i} className="flex-1" style={{ backgroundColor: c.hex }} />
          ))}
        </div>

        <div className="flex flex-wrap gap-2 px-5 pt-4" role="tablist" aria-label="Export format">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={format === f.id}
              onClick={() => setFormat(f.id)}
              className={`py-2 px-3 font-bold uppercase tracking-wider text-[11px] rounded border flex items-center gap-1.5 cursor-pointer transition-all ${
                format === f.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {f.pro && !isPro && <Lock className="w-3 h-3" />}
              {f.label}
            </button>
          ))}
        </div>

        <div className="px-5 pt-3 pb-5 space-y-3 overflow-y-auto">
          <p className="text-xs text-slate-500 font-sans">{active.blurb}</p>

          {format === "claude" && !locked && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mb-1">Brand name</label>
                  <input
                    type="text"
                    value={name}
                    maxLength={64}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameMissing(false);
                    }}
                    placeholder="e.g. vixxivapps"
                    className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-sans text-slate-800 focus:border-slate-900 focus:outline-hidden ${nameMissing ? "border-rose-400 bg-rose-50" : ""}`}
                  />
                  {nameMissing && <p className="text-[11px] text-rose-600 mt-1">Needed for the Claude Design bundle.</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mb-1">Website or product URL (optional)</label>
                  <input type="text" value={siteUrl} maxLength={200} onChange={(e) => setSiteUrl(e.target.value)} placeholder="e.g. vixxiv.com" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-sans text-slate-800 focus:border-slate-900 focus:outline-hidden" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mb-1">Type style</label>
                  <select value={typeStyle} onChange={(e) => { setTypeStyle(e.target.value as TypeStyle); setChosen((c) => ({ ...c, type: true })); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-sans text-slate-800 cursor-pointer">
                    {(Object.keys(TYPE_STYLES) as TypeStyle[]).map((k) => (
                      <option key={k} value={k}>{TYPE_STYLES[k].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mb-1">Corners</label>
                  <select value={corners} onChange={(e) => { setCorners(e.target.value as CornerStyle); setChosen((c) => ({ ...c, corners: true })); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-sans text-slate-800 cursor-pointer">
                    {(Object.keys(CORNER_STYLES) as CornerStyle[]).map((k) => (
                      <option key={k} value={k}>{CORNER_STYLES[k].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mb-1">Icon set</label>
                  <select value={iconSet} onChange={(e) => { setIconSet(e.target.value as IconSet); setChosen((c) => ({ ...c, icons: true })); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-sans text-slate-800 cursor-pointer">
                    {(Object.keys(ICON_SETS) as IconSet[]).map((k) => (
                      <option key={k} value={k}>{ICON_SETS[k].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mb-1">Tone of voice (optional)</label>
                <textarea
                  value={voice}
                  maxLength={400}
                  rows={2}
                  onChange={(e) => setVoice(e.target.value)}
                  placeholder="How the brand sounds, in your own words. e.g. Plain-spoken and confident, a little dry, never salesy."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-sans text-slate-800 focus:border-slate-900 focus:outline-hidden resize-y"
                />
              </div>
              <p className="text-[11px] text-slate-500 font-sans">These details go into the Claude Design bundle. The brief below uses the name only.</p>
            </div>
          )}

          {locked ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center space-y-3">
              <Lock className="w-5 h-5 mx-auto text-slate-400" />
              <p className="text-sm font-sans font-bold text-slate-800">{active.label} export is a Pro feature</p>
              <p className="text-xs font-sans text-slate-500">CSS variables are free. Tailwind, design tokens and the Claude exports come with Pro.</p>
              <button onClick={upgrade} className="inline-flex items-center gap-2 py-2.5 px-4 rounded text-xs font-bold uppercase tracking-wider text-white cursor-pointer hover:brightness-110" style={{ backgroundColor: "#7F345F" }}>
                <Sparkles className="w-3.5 h-3.5" />
                Upgrade to Pro
              </button>
            </div>
          ) : (
            <>
              <pre className="text-[12px] leading-relaxed font-mono bg-slate-950 text-slate-100 rounded-lg p-4 overflow-auto max-h-[38vh] whitespace-pre select-text">{output}</pre>

              <div className="flex flex-wrap gap-2">
                <button onClick={copy} className="py-2.5 px-4 rounded text-xs font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 flex items-center gap-2 cursor-pointer">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : format === "claude" ? "Copy brief" : "Copy"}
                </button>
                <button onClick={() => downloadText(output, format === "claude" ? `${slug}-brief.md` : active.file, active.type)} className="py-2.5 px-4 rounded text-xs font-bold uppercase tracking-wider text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                  <Download className="w-3.5 h-3.5" />
                  Download file
                </button>
                {format === "claude" && (
                  <button onClick={downloadBundle} className="py-2.5 px-4 rounded text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2 cursor-pointer hover:brightness-110" style={{ backgroundColor: "#059669" }}>
                    <Download className="w-3.5 h-3.5" />
                    Claude Design bundle (.zip)
                  </button>
                )}
              </div>

              {format === "claude" && (
                <div className="text-xs text-slate-600 font-sans bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                  <p><b>Copy brief:</b> paste it into any Claude chat or project and Claude will design and build with these colors and rules.</p>
                  <p><b>Claude Design bundle:</b> a starter design system built around your palette. It includes tints and shades, grays, status colors, a readable link color, a full dark theme, hover, focus and pressed states, your type pairing, corners and icon set, spacing, shadows and motion, and preview cards for buttons, forms, cards, alerts, navigation, tabs, checkboxes, switches, tooltips, toasts and dialogs. Unzip it and add the files to a design system in Claude Design.</p>
                  <p>It can't include your logo or imagery, so add those in Claude Design yourself. The bundle tells Claude to ask for them and not guess.</p>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
