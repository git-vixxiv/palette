import React from "react";
import { useApp } from "../context/AppContext";
import { X, ShieldCheck, Layers, Bookmark, Palette, Flame, ArrowRight, Sparkles, LogIn } from "lucide-react";
import { motion } from "motion/react";
import { MEMBERSHIP_URL } from "../hub";

/**
 * Membership prompt. palette sells nothing itself: ADR-0001 makes Square the
 * single billing truth, owned by the vixxiv-id hub, and membership is bought
 * on vixxiv.com (R5). Tool access is Gold or Black, or the client flag (D4).
 * All of palette's own Square code was removed in Brief 2.
 */
export const UpgradeModal: React.FC = () => {
  const { showUpgradeModal, setShowUpgradeModal, user, signIn, entitlement, membership } = useApp();

  if (!showUpgradeModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => setShowUpgradeModal(false)}
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row relative z-10"
        id="upgrade-pro-dialog"
      >
        <button
          onClick={() => setShowUpgradeModal(false)}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer z-20"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: premium feature value */}
        <div className="w-full md:w-1/2 p-6 md:p-8 bg-slate-950 text-white flex flex-col justify-between relative overflow-y-auto max-h-[300px] sm:max-h-[350px] md:max-h-none md:overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#7F345F]/20 rounded-full blur-3xl translate-y-1/2 translate-x-1/2" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] uppercase font-mono tracking-widest text-[#d1c69e] mb-6">
              <Sparkles className="w-3 h-3 text-[#d1c69e]" />
              <span>palette · vixxiv membership</span>
            </div>

            <h3 className="text-2xl md:text-3xl font-display font-black tracking-tight mb-2 leading-none">
              Maximize Your <br />
              Color Science.
            </h3>
            <p className="text-xs text-slate-400 font-sans mb-8">
              Unlock the core algorithms, expanding to complete bento-grid layouts with WCAG contrast metrics.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Expand up to 10 Color Columns</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Go beyond the 5-column preview. Add up to 10 custom shades in a single workbench composition.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Palette className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Advanced Academic Harmonies</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Access Analogous, Complementary, Triadic, Tetradic, and Split-Complementary math configurations instantly.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Unlimited Cloud Vault Space</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Archive as many palettes as you want, synced to your vixxiv account. The preview keeps 2 in this browser only.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Unlimited Design Workbench Generation</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Instant spacebar-powered randomized rolls and continuous lock-to-fit mutations.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10 mt-6 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-emerald-400" /> One vixxiv account for every tool</span>
          </div>
        </div>

        {/* Right: where to get access */}
        <div className="w-full md:w-1/2 p-6 md:p-8 bg-slate-50 flex flex-col justify-center gap-4 text-left">
          <h4 className="text-sm font-sans font-extrabold tracking-tight uppercase text-slate-400">
            Included with vixxiv membership
          </h4>
          <p className="text-sm text-slate-700 font-sans">
            The full palette lab comes with <strong>Gold</strong> and <strong>Black</strong> vixxiv memberships, and
            with every vixxiv client account. Membership is purchased on vixxiv.com.
          </p>

          {user && !entitlement.tools && membership.status !== "none" && (
            <p className="text-xs text-amber-800 bg-amber-50 border-l-4 border-amber-400 p-2.5 rounded">
              {membership.label}{membership.detail ? ` — ${membership.detail}` : ""}
            </p>
          )}

          <a
            href={MEMBERSHIP_URL}
            className="w-full mt-2 py-3 text-xs font-sans font-black uppercase tracking-wider text-white rounded-lg flex items-center justify-center gap-2 transition-all active:scale-98"
            style={{ backgroundColor: "#7F345F" }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>See memberships on vixxiv.com</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>

          {!user && (
            <button
              onClick={signIn}
              className="w-full py-2.5 text-xs font-sans font-bold uppercase tracking-wider text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Already a member? Sign in</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
