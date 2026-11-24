import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { Lock, Unlock, Copy, Check, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Sparkles, FolderPlus, Eye, RotateCcw, RotateCw, Plus, X, Star, Sun, Moon, Download } from "lucide-react";
import { getLuminance, hexToRgb, getColorName } from "../utils/colorUtils";
import { getSingleColorScore } from "../utils/paletteEngine";
import { ExportModal } from "./ExportModal";
import { ColorRole, HarmonyMode } from "../types";
import { motion, AnimatePresence } from "motion/react";


export const PaletteGenerator: React.FC = () => {
  const {
    currentColors,
    setColors,
    harmonyMode,
    setHarmonyMode,
    updateColorIndex,
    updateColorRole,
    toggleColorLock,
    regenerateUnlocked,
    respinColor,
    spinPalette,
    isSpinning,
    previousColors,
    undo,
    redo,
    canUndo,
    canRedo,
    addColumn,
    removeColumn,
    saveCurrentPalette,
    showToast,
    userSubscription,
    setShowUpgradeModal,
  } = useApp();

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [paletteName, setPaletteName] = useState("");

  // Backdrop behind the colour cards. Colours read differently on light and
  // dark surroundings, so the viewer can check a palette against both. The
  // choice is remembered per browser; it is a viewing aid, not palette data.
  const CANVAS_KEY = "palette_canvas_backdrop";
  const [canvasDark, setCanvasDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CANVAS_KEY) === "dark";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(CANVAS_KEY, canvasDark ? "dark" : "light");
    } catch {
      /* storage unavailable (private window): the toggle still works for this visit */
    }
  }, [canvasDark]);

  const handleCopy = (hex: string, index: number) => {
    navigator.clipboard.writeText(hex);
    setCopiedIndex(index);
    showToast(`Copied ${hex} to clipboard!`, "success");
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleManualHexChange = (index: number, value: string) => {
    // Only pass values that contain valid hex characters
    const cleanValue = value.replace(/[^#0-9A-Fa-f]/g, "");
    updateColorIndex(index, cleanValue);
  };

  const shiftColor = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentColors.length) return;

    setColors((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
    showToast("Color swapped", "info");
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paletteName.trim()) return;
    saveCurrentPalette(paletteName);
    setPaletteName("");
    setSaveOpen(false);
  };

  // Re-spin one card: a new colour for that card's role, designed around
  // every other colour currently in the palette.
  const reSpinSingleColor = (index: number) => {
    respinColor(index);
    showToast("Regenerated color slot", "info");
  };

  const firstRowModes: HarmonyMode[] = ["analogous", "monochromatic", "complementary", "triadic"];
  const secondRowModes: HarmonyMode[] = ["tetradic", "split", "random"];

  // Scale the hex readout to the number of columns so a full 7-char hex always
  // fits inside the card (more columns = narrower cards = smaller text/width).
  const cols = currentColors.length;
  const hexFont =
    cols >= 8 ? "sm:text-xs md:text-sm"
    : cols >= 6 ? "sm:text-sm md:text-base"
    : cols >= 5 ? "sm:text-base md:text-lg"
    : "sm:text-lg md:text-xl";
  const hexWidth =
    cols >= 8 ? "sm:w-16"
    : cols >= 6 ? "sm:w-20"
    : cols >= 5 ? "sm:w-24"
    : "sm:w-28";

  const harmonyDescriptions: Record<HarmonyMode, string> = {
    analogous: "Neighboring colors on the color wheel (e.g. 15-30 deg offsets) for soft, cohesive, low-contrast palettes.",
    monochromatic: "Same hue with variations in saturation and lightness for a clean, professional, unified scheme.",
    complementary: "Direct opposites on the color wheel (180 deg offset) for raw vibrancy, drama, and extreme key accents.",
    triadic: "Three perfectly balanced points spaced 120 degrees apart, producing a rich, vibrant, and multi-hue balance.",
    tetradic: "Double complementary pairs (four points at 90, 180, 270 deg) for complex schemes with rich dimensional depth.",
    split: "Base hue paired with the two colors adjacent to its complement (150 and 210 deg) for dynamic, refined contrast.",
    random: "A different harmony scheme on every spin, chosen for you and built around your locked colors. Good for breaking a creative block."
  };

  return (
    <section
      className="w-full border-b border-gray-25 p-4 md:p-8 flex flex-col items-center transition-colors duration-300"
      style={{ backgroundColor: canvasDark ? "#101114" : "transparent" }}
    >
      
      {/* Undo & Redo Action Bar - Positioned above columns & below Pro Tip bar */}
      <div className="w-full max-w-7xl flex flex-wrap justify-center items-center gap-3 mb-5">
        <button
          disabled={!canUndo}
          onClick={undo}
          className="py-2 px-3 sm:px-5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-white text-slate-705 font-bold uppercase tracking-wider text-[11px] rounded transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
          title="Undo last mutation"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Undo</span>
        </button>

        <button
          disabled={!canRedo}
          onClick={redo}
          className="py-2 px-3 sm:px-5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-white text-slate-705 font-bold uppercase tracking-wider text-[11px] rounded transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
          title="Redo mutation"
        >
          <RotateCw className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Redo</span>
        </button>

        {/* Backdrop switch: view the palette on a light or dark surround */}
        <div
          role="group"
          aria-label="Backdrop behind the colors"
          className="flex items-center bg-white border border-slate-200 rounded shadow-3xs overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setCanvasDark(false)}
            aria-pressed={!canvasDark}
            className={`py-2 px-3 font-bold uppercase tracking-wider text-[11px] transition-all flex items-center justify-center gap-2 cursor-pointer ${
              !canvasDark ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            title="Show colors on a light backdrop"
          >
            <Sun className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Light</span>
          </button>
          <button
            type="button"
            onClick={() => setCanvasDark(true)}
            aria-pressed={canvasDark}
            className={`py-2 px-3 font-bold uppercase tracking-wider text-[11px] transition-all flex items-center justify-center gap-2 cursor-pointer ${
              canvasDark ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            title="Show colors on a dark backdrop"
          >
            <Moon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dark</span>
          </button>
        </div>
      </div>
      
      {/* Dynamic Flex Palette Board - Responsive dual grid-to-flex layout */}
      <div className={`w-full max-w-7xl grid ${
        currentColors.length <= 4 
          ? currentColors.length === 2 ? "grid-cols-2" : currentColors.length === 3 ? "grid-cols-3" : "grid-cols-4"
          : currentColors.length <= 6 ? "grid-cols-3" : currentColors.length <= 8 ? "grid-cols-4" : "grid-cols-5"
      } auto-rows-fr sm:flex sm:flex-row gap-2 sm:gap-4 ${
        currentColors.length <= 4 ? "h-[210px]" : "h-[428px]"
      } sm:h-[520px] px-1 sm:px-0`}>
        {currentColors.map((color, idx) => {
          let isDark = true;
          try {
            const rgb = hexToRgb(color.hex);
            isDark = getLuminance(rgb) < 0.45;
          } catch (e) {
            // Safe fallback
          }

          // Dynamic colors styling parameters
          const labelColor = isDark ? "text-white" : "text-slate-900";
          const descColor = isDark ? "text-white/60" : "text-slate-550";
          const borderStyle = isDark ? "border-white/20" : "border-black/10";

          return (
            <motion.div
              key={idx}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, type: "spring", stiffness: 100 }}
              style={{ backgroundColor: color.hex }}
              className={`relative rounded-xl p-2 sm:p-5 flex flex-col justify-between items-stretch overflow-hidden shadow-xs sm:hover:shadow-xl transition-all group border h-full w-full ${canvasDark ? "border-white/15" : "border-black/5"}`}
            >
              {/* Controls: Left (Remove), Right (Re-spin) and centered Shift Color below X */}
              <div className="flex flex-col z-10 shrink-0 w-full mb-1 sm:mb-2">
                {/* Line 1: X (Far Left) and Re-spin (Far Right) */}
                <div className="flex justify-between items-center w-full">
                  {/* Far Left: X Icon (with word 'remove' beneath it on desktop) */}
                  <div className="flex-1 flex justify-start">
                    {currentColors.length > 2 ? (
                      <button
                        onClick={() => removeColumn(idx)}
                        className={`flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                          isDark ? "text-white/80 hover:text-white" : "text-slate-800/80 hover:text-slate-900"
                        }`}
                        title="Remove this color column"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span className={`hidden sm:block text-[7px] font-sans font-black uppercase tracking-widest mt-0.5 ${
                          isDark ? "text-white/60" : "text-slate-550"
                        }`}>
                          remove
                        </span>
                      </button>
                    ) : (
                      <div className="w-8 h-8 opacity-0 pointer-events-none" />
                    )}
                  </div>

                  {/* Desktop-only Center (Move) - Hidden on mobile */}
                  <div className="hidden sm:flex flex-1 justify-center">
                    <div className={`flex items-center justify-center space-x-1 px-1.5 py-0.5 rounded-full border shrink-0 ${
                      isDark ? "bg-white/10 border-white/10" : "bg-black/5 border-black/5"
                    }`}>
                      <button
                        disabled={idx === 0}
                        onClick={() => shiftColor(idx, "left")}
                        className={`p-0.5 disabled:opacity-20 transition-all cursor-pointer rounded-full ${
                          isDark ? "text-white/80 hover:bg-white/20" : "text-slate-800/80 hover:bg-black/10"
                        }`}
                        title="Move left"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <span className={`hidden sm:inline text-[7px] uppercase tracking-wider font-sans font-black select-none ${
                        isDark ? "text-white/70" : "text-slate-600"
                      }`}>
                        move
                      </span>
                      <button
                        disabled={idx === currentColors.length - 1}
                        onClick={() => shiftColor(idx, "right")}
                        className={`p-0.5 disabled:opacity-20 transition-all cursor-pointer rounded-full ${
                          isDark ? "text-white/80 hover:bg-white/20" : "text-slate-800/80 hover:bg-black/10"
                        }`}
                        title="Move right"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Far Right: Re-spin (with word 're-spin' beneath it on desktop) */}
                  <div className="flex-1 flex justify-end">
                    <button
                      onClick={() => reSpinSingleColor(idx)}
                      className={`flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                        isDark ? "text-white/80 hover:text-white" : "text-slate-800/80 hover:text-slate-900"
                      }`}
                      title="Re-spin just this slot"
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
                      <span className={`hidden sm:block text-[7px] font-sans font-black uppercase tracking-widest mt-0.5 ${
                        isDark ? "text-white/60" : "text-slate-550"
                      }`}>
                        re-spin
                      </span>
                    </button>
                  </div>
                </div>

                {/* Line 2 (Mobile only): shift color left right feature icons (< >) centered on the line below the x icon */}
                <div className="flex sm:hidden justify-center items-center w-full mt-1">
                  <div className={`flex items-center justify-center space-x-2 px-1.5 py-0.5 rounded-full border shrink-0 ${
                    isDark ? "bg-white/10 border-white/10" : "bg-black/5 border-black/5"
                  }`}>
                    <button
                      disabled={idx === 0}
                      onClick={() => shiftColor(idx, "left")}
                      className={`p-0.5 disabled:opacity-20 transition-all cursor-pointer rounded-full ${
                        isDark ? "text-white/80 hover:bg-white/20" : "text-slate-800/80 hover:bg-black/10"
                      }`}
                      title="Move left"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      disabled={idx === currentColors.length - 1}
                      onClick={() => shiftColor(idx, "right")}
                      className={`p-0.5 disabled:opacity-20 transition-all cursor-pointer rounded-full ${
                        isDark ? "text-white/80 hover:bg-white/20" : "text-slate-800/80 hover:bg-black/10"
                      }`}
                      title="Move right"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Middle Section: Manual HEX Input, copy button & Role selector */}
              <div className="flex flex-col items-center justify-center gap-1 sm:gap-2 text-center z-10 w-full my-auto">
                {/* Human-friendly premium color name - Hidden on small mobile heights or widths */}
                <div className={`hidden md:block text-[10px] font-sans font-semibold tracking-wide uppercase px-2 py-0.5 rounded cursor-default border border-current/10 select-none bg-black/5 ${descColor} truncate max-w-full`}>
                  {getColorName(color.hex)}
                </div>
                
                <div className="flex items-center space-x-1 justify-center w-full">
                  <input
                    type="text"
                    value={color.hex}
                    maxLength={7}
                    onChange={(e) => handleManualHexChange(idx, e.target.value)}
                    className={`font-mono text-[10px] ${hexFont} font-bold w-13 ${hexWidth} text-center border-b ${borderStyle} focus:border-indigo-400 focus:outline-hidden py-0.5 tracking-wider uppercase transition-colors ${labelColor}`}
                  />
                  <button
                    onClick={() => handleCopy(color.hex, idx)}
                    className={`p-0.5 sm:p-1.5 rounded-md hover:scale-115 active:scale-95 transition-all text-xs cursor-pointer ${
                      isDark ? "hover:bg-white/20 text-white/80" : "hover:bg-black/10 text-slate-800"
                    }`}
                    title="Copy hex code"
                  >
                    {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>

                {/* Unified Role Badge Selector */}
                <div className="relative w-full max-w-[56px] sm:max-w-none mt-1">
                  <select
                    value={color.role}
                    onChange={(e) => updateColorRole(idx, e.target.value as ColorRole)}
                    className={`w-full text-[6px] sm:text-[8.5px] font-sans font-black uppercase tracking-wider rounded px-0.5 py-0.5 border cursor-pointer pr-3 sm:pr-6 appearance-none transition-all outline-hidden text-center truncate ${
                      isDark ? "hover:bg-white/15" : "hover:bg-black/10"
                    }`}
                    style={{
                      // The closed control follows the card; the open list is
                      // styled on each option below so it is always dark text
                      // on white, whatever the card colour.
                      color: isDark ? "#F4F4F4" : "#1a1a1a",
                      borderColor: isDark ? "rgba(244,244,244,0.55)" : "rgba(26,26,26,0.5)",
                      backgroundColor: isDark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.45)",
                    }}
                    title="Set what this color is for. Spins build the color to suit its role."
                  >
                    {(
                      [
                        ["primary", "Primary"],
                        ["secondary", "Secondary"],
                        ["accent", "Accent"],
                        ["neutral-light", "Light"],
                        ["neutral-dark", "Dark"],
                      ] as const
                    ).map(([value, label]) => (
                      <option key={value} value={value} style={{ color: "#1a1a1a", backgroundColor: "#ffffff" }}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-0.5 sm:right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-85">
                    <ChevronDown className="w-1.5 h-1.5 sm:w-3 sm:h-3" style={{ color: isDark ? "#F4F4F4" : "#1a1a1a" }} />
                  </div>
                </div>

                {/* Lock toggle beneath Role Badge Selector & above Science Score */}
                <div className="mt-1.5 sm:mt-2 flex justify-center items-center">
                  <button
                    onClick={() => toggleColorLock(idx)}
                    style={{
                      color: isDark ? "#F4F4F4" : "#1a1a1a",
                      borderColor: isDark ? "rgba(244,244,244,0.45)" : "rgba(26,26,26,0.35)",
                    }}
                    className={`px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded transition-all cursor-pointer flex items-center justify-center gap-1 text-[8px] sm:text-[10px] uppercase font-sans font-black tracking-wider border ${
                      color.locked
                        ? isDark
                          ? "bg-white/20 shadow-xs scale-105"
                          : "bg-black/10 shadow-xs scale-105"
                        : isDark
                          ? "bg-white/5 hover:bg-white/15"
                          : "bg-black/5 hover:bg-black/10"
                    }`}
                    title={color.locked ? "Unlock Color shade" : "Lock Color shade"}
                  >
                    {color.locked ? (
                      <>
                        <Lock className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 animate-pulse" />
                        <span className="hidden sm:inline">Unlock</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 opacity-80" />
                        <span className="hidden sm:inline">Lock Color</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Science score rating indicator */}
              <div className="text-center font-sans pt-1.5 sm:pt-3 border-t border-current/10 select-none z-10 shrink-0 w-full">
                <div className={`hidden sm:block text-[9px] uppercase tracking-widest font-extrabold ${isDark ? "text-white/60" : "text-slate-550"}`}>
                  Science Score
                </div>
                <div className={`text-[10px] sm:text-2xl font-black sm:font-light ${labelColor}`}>
                  <span className="sm:hidden text-[7px] uppercase tracking-wide font-bold opacity-60 mr-0.5">Sc:</span>
                  {getSingleColorScore(color, currentColors)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Control Panel Bar */}
      <div className="w-full max-w-7xl mt-4 sm:mt-6 p-4 sm:p-6 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col lg:flex-row justify-between items-center gap-4 sm:gap-6">
        
        {/* Color Science Harmony Selection */}
        <div className="flex flex-col lg:flex-row items-center gap-3 sm:gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
            <Sparkles className="w-4 h-4" style={{ color: "#2589BD" }} />
            <span className="text-[11px] font-sans font-extrabold text-slate-400 uppercase tracking-widest">
              Harmony Rule:
            </span>
          </div>

          {/* Mobile Harmony representation: Highly functional and visual Native Select dropdown */}
          <div className="block sm:hidden w-full">
            <select
              value={harmonyMode}
              onChange={(e) => setHarmonyMode(e.target.value as HarmonyMode)}
              className="w-full p-2.5 rounded-lg bg-slate-50 border text-xs font-sans font-black text-slate-800 uppercase tracking-wider cursor-pointer outline-hidden focus:ring-1 focus:ring-slate-300"
              style={{ borderColor: "#1a1a1a" }}
            >
              <option value="analogous">Analogous ⭐ (Neighboring Shades)</option>
              <option value="monochromatic">Monochromatic (Clean Tones)</option>
              <option value="complementary">Complementary ⭐ (Opposite Contrast)</option>
              <option value="triadic">Triadic ⭐ (Balanced Triangles)</option>
              <option value="tetradic">Tetradic ⭐ (Four-Point Complex)</option>
              <option value="split">Split ⭐ (Refined Contrasts)</option>
              <option value="random">Random (Break Creative Block)</option>
            </select>
            <p className="text-[10px] text-slate-500 mt-1 italic leading-tight">
              {harmonyDescriptions[harmonyMode]}
            </p>
          </div>
          
          {/* Desktop Harmony representation: Beautiful multi-row interactive swatches */}
          <div className="hidden sm:flex flex-col gap-2.5 items-center w-full">
            {/* Top Row: 4 buttons */}
            <div className="flex flex-wrap justify-center gap-2 w-full">
              {firstRowModes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setHarmonyMode(mode)}
                  className="flex flex-col items-center justify-center px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border cursor-pointer min-w-[110px] transition-all"
                  style={
                    harmonyMode === mode
                      ? { backgroundColor: "#faf8f3", borderColor: "#d1c69e", color: "#1a1a1a", borderWidth: "1.5px", boxShadow: "0 1px 3px rgba(209, 198, 158, 0.2)" }
                      : { backgroundColor: "#ffffff", borderColor: "#e2e8f0", color: "#475569" }
                  }
                  title={harmonyDescriptions[mode]}
                >
                  <span className="flex items-center gap-1">
                    <span>{mode}</span>
                    {["analogous", "complementary", "triadic"].includes(mode) && (
                      <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 animate-pulse shrink-0" />
                    )}
                  </span>
                  {/* Visual Swatch for rule preview */}
                  <div className="flex items-center gap-0.5 mt-1.5 bg-slate-100 p-0.5 rounded-full border border-slate-200">
                    {mode === "analogous" && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-teal-400" />
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="w-2 h-2 rounded-full bg-lime-400" />
                      </>
                    )}
                    {mode === "monochromatic" && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-indigo-900" />
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        <span className="w-2 h-2 rounded-full bg-indigo-200" />
                      </>
                    )}
                    {mode === "complementary" && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      </>
                    )}
                    {mode === "triadic" && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="w-2 h-2 rounded-full bg-yellow-405 bg-[#E9C46A]" />
                        <span className="w-2 h-2 rounded-full bg-green-400" />
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Bottom Row: 3 buttons centered */}
            <div className="flex flex-wrap justify-center gap-2 w-full">
              {secondRowModes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setHarmonyMode(mode)}
                  className="flex flex-col items-center justify-center px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border cursor-pointer min-w-[110px] transition-all"
                  style={
                    harmonyMode === mode
                      ? { backgroundColor: "#faf8f3", borderColor: "#d1c69e", color: "#1a1a1a", borderWidth: "1.5px", boxShadow: "0 1px 3px rgba(209, 198, 158, 0.2)" }
                      : { backgroundColor: "#ffffff", borderColor: "#e2e8f0", color: "#475569" }
                  }
                  title={harmonyDescriptions[mode]}
                >
                  <span className="flex items-center gap-1">
                    <span>{mode}</span>
                    {["tetradic", "split"].includes(mode) && (
                      <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 animate-pulse shrink-0" />
                    )}
                  </span>
                  {/* Visual Swatch for rule preview */}
                  <div className="flex items-center gap-0.5 mt-1.5 bg-slate-100 p-0.5 rounded-full border border-slate-200">
                    {mode === "tetradic" && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="w-2 h-2 rounded-full bg-teal-500" />
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                      </>
                    )}
                    {mode === "split" && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-violet-600" />
                        <span className="w-2 h-2 rounded-full bg-orange-405 bg-[#E67E22]" />
                        <span className="w-2 h-2 rounded-full bg-[#E9C46A]" />
                        <span className="w-2 h-2 rounded-full bg-violet-300" />
                      </>
                    )}
                    {mode === "random" && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="w-2 h-2 rounded-full bg-[#2ECC71]" />
                        <span className="w-2 h-2 rounded-full bg-[#EC4899]" />
                        <span className="w-2 h-2 rounded-full bg-[#3498DB]" />
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Spin and Save Launch Buttons - Formatted as horizontal single-row stream on mobile */}
        <div className="flex flex-row items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full lg:w-auto shrink-0 mt-2 lg:mt-0">
          
          <div className="flex flex-row sm:flex-col items-stretch gap-1.5 sm:gap-2 flex-1 sm:flex-initial sm:w-36">
            {/* Add Color Column */}
            {currentColors.length < 10 && (
              <button
                onClick={addColumn}
                className="flex-1 sm:flex-initial py-2.5 sm:py-3 px-2 sm:px-5 bg-white border rounded font-black text-[9px] sm:text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1 cursor-pointer shadow-3xs"
                style={{ color: "#2589BD", borderColor: "#2589BD" }}
                title="Add a color column to your canvas (up to 10)"
              >
                <Plus className="w-3.5 h-3.5" style={{ color: "#2589BD" }} />
                <span className="hidden sm:inline">Add Color</span>
              </button>
            )}

            {/* Quick Save Trigger */}
            <button
              onClick={() => setSaveOpen(true)}
              className="flex-1 sm:flex-initial py-2.5 sm:py-3 px-2 sm:px-5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded font-black text-[9px] sm:text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1 cursor-pointer shadow-3xs"
            >
              <FolderPlus className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Save Palette</span>
            </button>

            {/* Export: CSS, Tailwind, tokens, Claude */}
            <button
              onClick={() => setExportOpen(true)}
              className="flex-1 sm:flex-initial py-2.5 sm:py-3 px-2 sm:px-5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded font-black text-[9px] sm:text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1 cursor-pointer shadow-3xs"
              title="Export this palette as CSS, Tailwind, design tokens or a Claude brief"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Quick Turn Pro Trigger */}
            {userSubscription.tier === "free" && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="flex-1 sm:flex-initial py-2.5 sm:py-3 px-2 sm:px-4 bg-amber-50 border text-[#7F345F] hover:bg-amber-100 rounded font-black text-[9px] sm:text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1 cursor-pointer shadow-3xs"
                style={{ borderColor: "#1F988C" }}
              >
                <span className="text-[10px] sm:text-xs font-black px-1 rounded" style={{ color: "#1F988C", backgroundColor: "rgba(31, 152, 140, 0.15)" }}>PRO</span>
                <span className="hidden sm:inline">Turn Pro</span>
              </button>
            )}
          </div>

          {/* SPIN Slot-Machine Button - Pills down compactly on mobile and circles on desktop */}
          <button
            onClick={spinPalette}
            disabled={isSpinning}
            style={{ backgroundColor: "#059669", borderColor: "#047857" }}
            className="py-2.5 sm:w-28 sm:h-28 sm:rounded-full rounded-lg px-4 sm:px-0 hover:brightness-110 active:scale-90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm tracking-widest uppercase shadow-lg transition-all flex sm:flex-col items-center justify-center gap-1 cursor-pointer border-2 select-none shrink-0"
            title="SPIN - Tap here or press spacebar!"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-7 sm:h-7 text-white ${isSpinning ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline font-sans font-extrabold text-[10px] sm:text-xs tracking-widest sm:mt-1">SPIN</span>
          </button>
        </div>
      </div>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />

      {/* Save Palette Modal/Inline Backdrop */}
      <AnimatePresence>
        {saveOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSaveOpen(false)}
              className="absolute inset-0 bg-slate-900"
            />

            {/* Content Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-xl p-6 shadow-2xl max-w-sm w-full relative z-10 border border-slate-250"
            >
              <h3 className="text-base font-display font-bold text-slate-900 mb-1">
                Save Palette to Account
              </h3>
              <p className="text-xs text-slate-500 font-sans mb-4">
                Name your color combo to preserve lock styles and assigned design roles permanently.
              </p>

              <form onSubmit={handleSaveSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest">
                    Palette Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ocean Twilight, Arctic Retro"
                    value={paletteName}
                    onChange={(e) => setPaletteName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded focus:border-slate-900 focus:outline-hidden text-sm font-sans transition-all text-slate-800"
                  />
                </div>

                {/* Previews */}
                <div className="space-y-1 mb-2">
                  <span className="block text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Preview Blocks
                  </span>
                  <div className="flex h-8 rounded overflow-hidden border border-slate-200 shadow-3xs">
                    {currentColors.map((c, i) => (
                      <div key={i} style={{ backgroundColor: c.hex }} className="flex-1" />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSaveOpen(false)}
                    className="flex-1 py-3 px-4 rounded border border-slate-200 text-center text-xs font-bold uppercase tracking-wider text-slate-600 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 rounded text-center text-xs font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Save Palette
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};
