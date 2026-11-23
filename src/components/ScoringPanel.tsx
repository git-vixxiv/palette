import React from "react";
import { useApp } from "../context/AppContext";
import { getContrastRatio } from "../utils/colorUtils";
import { scorePalette, suggestRoles } from "../utils/paletteEngine";
import { Award, CheckCircle, BookOpen, ThumbsUp, HelpCircle, Activity } from "lucide-react";

export const ScoringPanel: React.FC = () => {
  const { currentColors, harmonyMode, setColors, showToast } = useApp();

  // Dynamically calculate quality metrics referencing current state
  const { score, breakdown, tips } = scorePalette(currentColors, harmonyMode);

  // Assign each colour the role it is actually suited to (near-whites and
  // near-blacks become neutrals, the most vivid spare colour the accent...).
  const autoFixColorRoles = () => {
    setColors((prev) => {
      const roles = suggestRoles(prev.map((c) => c.hex));
      return prev.map((c, i) => ({ ...c, role: roles[i] }));
    });
    showToast("Roles optimized for design harmony!", "success");
  };

  // Fetch color-science rules explanations based on chosen mode
  const getScienceInsight = () => {
    switch (harmonyMode) {
      case "analogous":
        return "Analogous colors sit adjacent on the 360° color circle. They naturally communicate visual comfort, sync smoothly, and are highly peaceful to the human eye.";
      case "monochromatic":
        return "Monochromatic themes use variations of a single base hue. They deliver an extremely clean, atmospheric cohesion, minimizing mental strain on interface elements.";
      case "complementary":
        return "Complementary hues are directly opposed (180° apart) on the color wheel. This creates maximum vibrant contrast and high focal draw. Use the accent role strictly as a highlight.";
      case "triadic":
        return "Triadic colors are spaced equally around the color wheel (120° apart). They offer high visual energy and distinct separation. Balance roles safely (60% primary, 30% secondary, 10% accent).";
      case "tetradic":
        return "Tetradic harmonies use two complementary pairs (four colors total, forming a rectangle). Rich and diverse, tetradic grids are excellent for branding.";
      case "split":
        return "Split-complementary pairs a base color with two adjacent adjacent colors of its complement (150° and 210°). Offers high visual contrast with less visual noise.";
      case "random":
      default:
        return "Each spin picks one of the harmony schemes for you, weighted toward the ones people rate highest, then builds it around your roles and locked colors.";
    }
  };

  return (
    <section className="w-full max-w-7xl mx-auto p-6 md:p-8 space-y-6" id="scoring-analytics">
      
      {/* Title */}
      <div className="border-l-4 pl-4 space-y-1" style={{ borderLeftColor: "#d1c69e" }}>
        <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <span>Aesthetic Science Scorecard</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 font-sans">
          Our algorithm checks the absolute visual hierarchy, contrast metrics, and color wheel distances to grade usability.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Quality Meter Gauge (Span 5) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 p-6 rounded-xl shadow-sm text-center flex flex-col justify-between items-center relative overflow-hidden">
          
          <div className="space-y-1 mt-2">
            <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest block">
              Composite Aesthetic Grade
            </span>
            <span className="text-base font-display font-bold text-slate-800 block capitalize">
              {score >= 90 ? "Master Composition (A+)" : score >= 75 ? "Highly Readable (B)" : score >= 60 ? "Functional (C)" : "Needs Work (D)"}
            </span>
          </div>

          {/* Centered Scoring Indicator */}
          <div className="my-6 relative flex items-center justify-center">
            {/* SVG Progress Circle */}
            <svg className="w-36 h-36 transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="64"
                stroke="#F1F5F9"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="64"
                stroke={score >= 80 ? "#10B981" : score >= 60 ? "#2589BD" : "#EF4444"}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 64}
                strokeDashoffset={2 * Math.PI * 64 * (1 - score / 100)}
                strokeLinecap="round"
                className="transition-all duration-750 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-display font-extrabold tracking-tight text-slate-900">
                {score}
              </span>
              <span className="text-[10px] font-sans text-slate-400 tracking-widest uppercase font-bold">
                Points Max 100
              </span>
            </div>
          </div>

          {/* Feedback */}
          <div className="w-full text-[11px] text-slate-500 font-sans border-t border-slate-100 pt-4 px-2">
            Max contrast ratio present:{" "}
            <span className="font-bold animate-pulse" style={{ color: "#2589BD" }}>
              {Math.max(
                ...currentColors.map((c1, i) =>
                  Math.max(...currentColors.map((c2, j) => (i === j ? 0 : getContrastRatio(c1.hex, c2.hex))))
                )
              )}
              :1
            </span>
          </div>
        </div>

        {/* Breakdown Stats Grid (Span 7) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col justify-between space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Stat: Role mapping */}
            <div className="p-4 bg-slate-50 border border-slate-150 rounded-lg">
              <span className="text-[10.5px] font-sans font-bold text-slate-400 uppercase tracking-widest block">
                Design Roles Setup
              </span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xl font-mono font-bold text-slate-800">{breakdown.roles}</span>
                <span className="text-[10px] font-sans text-slate-400 font-bold uppercase tracking-wider">/ 30 pts</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(breakdown.roles / 30) * 100}%` }} />
              </div>
            </div>

            {/* Stat: Accessibility */}
            <div className="p-4 bg-slate-50 border border-slate-150 rounded-lg">
              <span className="text-[10.5px] font-sans font-bold text-slate-400 uppercase tracking-widest block">
                Accessibility Strength
              </span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xl font-mono font-bold text-slate-800">{breakdown.contrast}</span>
                <span className="text-[10px] font-sans text-slate-400 font-bold uppercase tracking-wider">/ 40 pts</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="h-1.5 rounded-full" style={{ width: `${(breakdown.contrast / 40) * 100}%`, backgroundColor: "#2589BD" }} />
              </div>
            </div>

            {/* Stat: Harmony Mode */}
            <div className="p-4 bg-slate-50 border border-slate-150 rounded-lg font-sans">
              <span className="text-[10.5px] font-sans font-bold text-slate-400 uppercase tracking-widest block">
                Harmony Rule Fit
              </span>
              <div className="flex items-center justify-between mt-2 font-sans">
                <span className="text-xl font-mono font-bold text-slate-800">{breakdown.harmony}</span>
                <span className="text-[10px] font-sans text-slate-400 font-bold uppercase tracking-wider">/ 30 pts</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(breakdown.harmony / 30) * 100}%` }} />
              </div>
            </div>

          </div>

          {/* Actionable Tips recommendation segment */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-sans font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 animate-pulse" style={{ color: "#2589BD" }} />
                Optimization Review
              </h4>
              {score < 90 && (
                <button
                  onClick={autoFixColorRoles}
                  className="text-[10px] font-sans font-bold py-1.5 px-3 rounded uppercase tracking-wider transition-all cursor-pointer border"
                  style={{ color: "#2589BD", backgroundColor: "rgba(37, 137, 189, 0.08)", borderColor: "rgba(37, 137, 189, 0.15)" }}
                >
                  ⚡ Optimize Roles
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tips.map((tip, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-2 text-xs text-slate-600 bg-slate-50 border border-slate-150 p-3 rounded"
                >
                  <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#2589BD" }} />
                  <span className="font-sans font-medium">{tip}</span>
                </div>
              ))}
              {tips.length === 0 && (
                <div className="col-span-2 text-xs text-emerald-750 font-sans font-bold bg-emerald-50 p-4 rounded flex items-center gap-2 border border-emerald-150">
                  <ThumbsUp className="w-4 h-4 text-emerald-500 animate-bounce" />
                  No critique! This color scheme is perfectly calibrated for production launch.
                </div>
              )}
            </div>
          </div>

          {/* Education Block */}
          <div className="p-4 rounded flex items-start gap-3 border" style={{ backgroundColor: "rgba(209, 198, 158, 0.08)", borderColor: "rgba(209, 198, 158, 0.2)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs" style={{ backgroundColor: "rgba(209, 198, 158, 0.2)", color: "#1a1a1a" }}>
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest" style={{ color: "#1a1a1a" }}>
                Science Tip: &quot;{harmonyMode}&quot; rules
              </span>
              <p className="text-xs leading-relaxed font-sans text-slate-700">{getScienceInsight()}</p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
