import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { getContrastRatio, getContrastRating, getLuminance, hexToRgb } from "../utils/colorUtils";
import { Eye, Check, AlertTriangle, HelpCircle, AlignLeft, Bold } from "lucide-react";
import { ColorItem } from "../types";

export const ContrastMatrix: React.FC = () => {
  const { currentColors, showToast } = useApp();
  
  // Sandbox state
  const [sandboxText, setSandboxText] = useState("We build digital products that feel premium, clean, and highly accessible.");
  const [textIndex, setTextIndex] = useState(0); // Default to color 1 (index 0)
  const [bgIndex, setBgIndex] = useState(3); // Default to light neutral index 3
  const [textSize, setTextSize] = useState<"small" | "large">("small");
  const [isBold, setIsBold] = useState(false);

  const colors = currentColors;
  const activeTextIndex = textIndex >= colors.length ? 0 : textIndex;
  const activeBgIndex = bgIndex >= colors.length ? Math.max(0, colors.length - 1) : bgIndex;

  const textColor = colors[activeTextIndex]?.hex || "#000000";
  const bgColor = colors[activeBgIndex]?.hex || "#FFFFFF";
  const sandboxRatio = getContrastRatio(textColor, bgColor);
  const sandboxRating = getContrastRating(sandboxRatio);

  const meetsAA = textSize === "large" || isBold ? sandboxRating.aaLarge : sandboxRating.aa;
  const meetsAAA = textSize === "large" || isBold ? sandboxRating.aaaLarge : sandboxRating.aaa;

  return (
    <section className="w-full max-w-7xl mx-auto p-6 md:p-8 space-y-8" id="accessibility-analyzer">
      
      {/* Visual Header Block */}
      <div className="border-l-4 pl-4 space-y-1" style={{ borderLeftColor: "#d1c69e" }}>
        <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <span>Contrast Ratio Matrix & Testing Sandbox</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 font-sans">
          Analyze WCAG 2.1 accessibility scores between color combos. Columns denote <strong>Text color</strong>, rows denote <strong>Background color</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: 5x5 Interactive Matrix (Span 7) */}
        <div className="lg:col-span-7 bg-white p-6 border border-slate-200 rounded-xl shadow-sm space-y-4 overflow-x-auto">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest">
              Contrast Matrix Table
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wide">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 bg-emerald-100 border border-emerald-400 rounded-xs" />
                AAA Pass (≥ 7)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 bg-blue-100 border border-blue-400 rounded-xs" />
                AA Pass (≥ 4.5)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 bg-amber-100 border border-amber-400 rounded-xs" />
                AA Large (≥ 3)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 bg-rose-100 border border-rose-300 rounded-xs" />
                Fail (&lt; 3)
              </span>
            </div>
          </div>

          <div className="min-w-[480px]">
            {/* Header Columns */}
            <div 
              style={{ gridTemplateColumns: `repeat(${colors.length + 1}, minmax(0, 1fr))` }}
              className="grid gap-2 mb-2"
            >
              <div className="flex items-center justify-center text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider">
                BG \ TEXT
              </div>
              {colors.map((color, cIdx) => (
                <div key={cIdx} className="text-center p-2 bg-slate-50 rounded border border-slate-150">
                  <div className="w-4 h-4 rounded-full mx-auto" style={{ backgroundColor: color.hex }} />
                  <span className="block text-[10px] font-mono font-bold mt-1 text-slate-700 truncate" title={color.hex}>
                    {color.hex}
                  </span>
                  <span className="block text-[8px] font-sans text-slate-400 font-semibold uppercase tracking-wider truncate">
                    {color.role}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid Matrix Rows */}
            <div className="space-y-2">
              {colors.map((bgCol, rIdx) => (
                <div 
                  key={rIdx} 
                  style={{ gridTemplateColumns: `repeat(${colors.length + 1}, minmax(0, 1fr))` }}
                  className="grid gap-2 items-center"
                >
                  
                  {/* Row background indicator */}
                  <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded border border-slate-150 h-14">
                    <div className="w-5 h-5 rounded shrink-0 shadow-3xs" style={{ backgroundColor: bgCol.hex }} />
                    <div className="truncate min-w-0">
                      <span className="block text-[10px] font-mono text-slate-600 font-bold uppercase truncate">{bgCol.hex}</span>
                      <span className="block text-[8px] font-sans text-slate-400 font-bold uppercase tracking-wider truncate">{bgCol.role}</span>
                    </div>
                  </div>

                  {/* Columns cell entries */}
                  {colors.map((textCol, cIdx) => {
                    if (rIdx === cIdx) {
                      return (
                        <div
                          key={cIdx}
                          className="flex items-center justify-center text-[10px] font-mono text-slate-300 bg-slate-50/50 rounded h-14 border border-dashed border-slate-200"
                        >
                          Same Color
                        </div>
                      );
                    }

                    const ratio = getContrastRatio(textCol.hex, bgCol.hex);
                    const rating = getContrastRating(ratio);
                    
                    // Assign aesthetic metrics with subtle accessibility border styling
                    let cellBg = "bg-slate-50";
                    let textClass = "text-slate-900";
                    let borderClass = "border-slate-150";
                    let label = "FAIL";

                    if (rating.aaa) {
                      cellBg = "bg-emerald-50/70";
                      textClass = "text-emerald-800";
                      borderClass = "border-emerald-200";
                      label = "AAA PASS";
                    } else if (rating.aa) {
                      cellBg = "bg-blue-50/70";
                      textClass = "text-blue-800";
                      borderClass = "border-blue-200";
                      label = "AA PASS";
                    } else if (rating.aaLarge) {
                      cellBg = "bg-amber-50/70";
                      textClass = "text-amber-800";
                      borderClass = "border-amber-200";
                      label = "AA LG TEXT";
                    } else {
                      cellBg = "bg-rose-50/60";
                      textClass = "text-rose-800";
                      borderClass = "border-rose-150";
                    }

                    return (
                      <button
                        key={cIdx}
                        onClick={() => {
                          setTextIndex(cIdx);
                          setBgIndex(rIdx);
                          showToast("Assigned selected colors check to Sandbox", "info");
                        }}
                        style={{ backgroundColor: bgCol.hex, color: textCol.hex }}
                        className="group flex flex-col items-center justify-center p-2 rounded h-14 border border-slate-200/25 shadow-3xs hover:scale-[1.03] active:scale-97 transition-all relative text-center text-xs select-none cursor-pointer"
                        title={`Click to analyze in detail under Sandbox. BG: ${bgCol.hex}, Text: ${textCol.hex}. Ratio: ${ratio}:1`}
                      >
                        <span className="font-bold text-xs font-sans leading-none z-10 transition-transform group-hover:scale-110">
                          Aa
                        </span>
                        <span className="text-[10px] font-mono leading-none font-bold mt-1 rounded-sm px-1.5 py-0.5 bg-black/10 text-white select-none">
                          {ratio}
                        </span>

                        {/* Badges on absolute scale */}
                        <div className="absolute inset-0 bg-transparent rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                          <span className={`text-[9px] font-sans font-black tracking-widest uppercase px-3 py-1.5 rounded shadow-lg ${
                            ratio >= 4.5 ? "bg-slate-900 text-emerald-400" : "bg-slate-900 text-rose-400"
                          }`}>
                            {ratio >= 4.5 ? "AA ✔" : "FAIL ✘"}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Right Column: Live Testing Sandbox Panel (Span 5) */}
        <div className="lg:col-span-5 bg-white p-6 border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between space-y-4">
          
          {/* Header */}
          <div className="space-y-1">
            <h3 className="text-xs font-sans font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Eye className="w-4 h-4" style={{ color: "#2589BD" }} />
              Interactive Pairing Sandbox
            </h3>
            <p className="text-xs text-slate-500 font-sans">
              Interactively design customized typographical nodes using any pairing combination from your palette.
            </p>
          </div>

          {/* Color Pair Pickers */}
          <div className="grid grid-cols-2 gap-4">
            {/* Text pick */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Text Shade
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-150 rounded">
                {colors.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setTextIndex(i)}
                    className={`w-6 h-6 rounded-full border transition-all ${
                      activeTextIndex === i ? "border-slate-800 scale-110 shadow-sm" : "border-slate-300"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={`Use ${c.hex} (${c.role}) for text`}
                  />
                ))}
              </div>
            </div>

            {/* Background pick */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Canvas Shade
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-150 rounded">
                {colors.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setBgIndex(i)}
                    className={`w-6 h-6 rounded-full border transition-all ${
                      activeBgIndex === i ? "border-slate-800 scale-110 shadow-sm" : "border-slate-200"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={`Use ${c.hex} (${c.role}) for background`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Sandbox Controls */}
          <div className="space-y-2.5 border-t border-slate-100 pt-3">
            <textarea
              value={sandboxText}
              onChange={(e) => setSandboxText(e.target.value)}
              placeholder="Type test strings here..."
              rows={2}
              className="w-full text-xs font-sans p-3 border border-slate-200 rounded bg-slate-50 focus:border-slate-950 focus:outline-hidden text-slate-800"
            />

            <div className="flex space-x-2">
              <button
                onClick={() => setTextSize(textSize === "small" ? "large" : "small")}
                className={`flex-1 py-2 px-3 rounded border text-xs font-sans font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  textSize === "large"
                    ? "bg-slate-900 border-transparent text-white"
                    : "bg-white border-slate-200 text-slate-655 hover:bg-slate-50"
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>{textSize === "large" ? "18pt Bold" : "14pt Body"}</span>
              </button>

              <button
                onClick={() => setIsBold(!isBold)}
                className={`px-3 py-2 rounded border text-xs font-sans font-bold flex items-center justify-center transition-all cursor-pointer ${
                  isBold
                    ? "bg-slate-900 border-transparent text-white"
                    : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                }`}
                title="Toggle Bold style"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Real-Time Live Render Field */}
          <div
            style={{ backgroundColor: bgColor, color: textColor }}
            className="flex-1 rounded p-6 shadow-3xs border border-transparent min-h-[140px] flex flex-col justify-between transition-colors duration-250"
          >
            <div>
              <p className={`font-sans leading-relaxed break-words ${
                textSize === "large" ? "text-lg sm:text-xl font-bold tracking-tight" : "text-sm"
              } ${isBold ? "font-bold" : "font-normal"}`}>
                {sandboxText || "A minimal sandbox space for accessibility."}
              </p>
            </div>

            <div className="pt-4 flex justify-between items-center border-t border-current/10 text-[10px] font-mono select-none uppercase tracking-wider opacity-80">
              <span>Text: {textColor}</span>
              <span>BG: {bgColor}</span>
            </div>
          </div>

          {/* Visual WCAG Readout */}
          <div className="grid grid-cols-3 gap-2 p-3.5 bg-slate-50 rounded border border-slate-150">
            <div className="text-center">
              <span className="block text-[8px] font-sans font-bold text-slate-400 uppercase tracking-widest">Ratio</span>
              <span className="text-base font-bold font-mono text-slate-800">{sandboxRatio}:1</span>
            </div>

            <div className="text-center border-x border-slate-200">
              <span className="block text-[8px] font-sans font-bold text-slate-400 uppercase tracking-widest">WCAG AA</span>
              <span className={`text-xs font-black font-sans flex items-center justify-center gap-1 select-none mt-0.5 ${
                meetsAA ? "text-emerald-600" : "text-rose-600"
              }`}>
                {meetsAA ? "✔ PASS" : "✘ FAIL"}
              </span>
            </div>

            <div className="text-center">
              <span className="block text-[8px] font-sans font-bold text-slate-400 uppercase tracking-widest">WCAG AAA</span>
              <span className={`text-xs font-black font-sans flex items-center justify-center gap-1 select-none mt-0.5 ${
                meetsAAA ? "text-emerald-500" : "text-rose-500"
              }`}>
                {meetsAAA ? "✔ PASS" : "✘ FAIL"}
              </span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
