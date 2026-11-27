import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { LogOut, ChevronDown, CheckCircle, Sparkles, Crown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AuthModal } from "./AuthModal";
import logoUrl from "../assets/logo.webp";

export const Header: React.FC = () => {
  const { user, logout, userSubscription, setShowUpgradeModal, cancelSubscription, authPrompt, openAuth, closeAuth } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const isPro = userSubscription.tier !== "free";
  const goldBadge = { background: "linear-gradient(135deg, #F7DC8A 0%, #D9A62E 55%, #B8860B 100%)" };

  return (
    <header className="flex items-center justify-between gap-3 px-4 sm:px-6 md:px-8 xl:px-12 py-3 sm:py-4 bg-white border-b border-slate-200 shadow-sm relative z-45">
      {/* Brand Logo and Title */}
      <a href="/" className="flex items-center gap-2.5 sm:gap-3 min-w-0 sm:shrink-0" aria-label="palette by vixxiv, home">
        <img src={logoUrl} alt="" width={40} height={40} className="w-10 h-10 shrink-0 object-contain" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* Lockup: stacked beside the mark on phones, one line from sm up. Never wraps. */}
            <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5 whitespace-nowrap">
              <span className="text-xl font-display font-black tracking-tight text-slate-800 lowercase leading-none">palette</span>
              <span className="text-[11px] sm:text-xs font-bold font-sans lowercase leading-none mt-1 sm:mt-0" style={{ color: "#2589BD" }}>by vixxiv</span>
            </span>
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm whitespace-nowrap hidden xl:inline-block">
              Lab & Analyzer
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-sans hidden xl:block whitespace-nowrap mt-0.5">
            Color science engine, WCAG contrast matrix compliance, and AI optimization
          </p>
        </div>
      </a>

      {/* User Actions */}
      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
        <nav className="hidden lg:flex items-center gap-4 xl:gap-5 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
          <a href="/#visualize" className="hover:text-[#2589BD] transition-colors">In Action</a>
          <a href="/#scoring-analytics" className="hover:text-[#2589BD] transition-colors">Theory & Analytics</a>
          <a href="/#accessibility-analyzer" className="hover:text-[#2589BD] transition-colors">Contrast Matrix</a>
          <a href="/#palette-library" className="hover:text-[#2589BD] transition-colors">Palette Library</a>
        </nav>

        <div className="hidden lg:block h-5 w-[1px] bg-slate-200" />

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Join Pro CTA badge */}
          {!isPro && (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="h-9 px-3 text-[11px] font-sans font-extrabold uppercase tracking-wider rounded-md border cursor-pointer transition-all hover:bg-rose-50 flex items-center gap-1.5 shrink-0 bg-white whitespace-nowrap"
              style={{ color: "#7F345F", borderColor: "#7F345F" }}
              title="See what palette Pro adds"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin-hover" />
              <span>Go Pro</span>
            </button>
          )}

          <AnimatePresence mode="wait">
            {!user ? (
              <motion.button
                key="signin"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                onClick={() => openAuth("signin")}
                className="h-9 px-3 text-[11px] font-sans font-extrabold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-all shadow-xs flex items-center border border-slate-900 cursor-pointer whitespace-nowrap"
              >
                Sign In
              </motion.button>
            ) : (
              <div className="relative">
                <motion.button
                  key="user-badge"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={`h-9 flex items-center gap-1.5 sm:gap-2 pl-1 pr-1.5 border rounded-md transition-all cursor-pointer ${
                    isPro ? "bg-amber-50/70 hover:bg-amber-50 border-amber-300" : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                  }`}
                  title={isPro ? "Pro member account" : "Account"}
                >
                  <img
                    src={user.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50"}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded object-cover shadow-3xs border border-white"
                  />
                  {isPro && (
                    <span className="w-5 h-5 rounded-full grid place-items-center shrink-0 shadow-sm ring-1 ring-amber-600/20" style={goldBadge} aria-label="Pro member">
                      <Crown className="w-3 h-3 text-white" strokeWidth={2.5} />
                    </span>
                  )}
                  <span className="text-xs font-sans font-bold text-slate-700 max-w-[120px] truncate hidden sm:inline">
                    {user.displayName || "Explorer"}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </motion.button>

                {/* Account Dropdown Menu */}
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 text-left"
                    >
                      <div className="p-3 border-b border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-[9px] text-slate-400 font-sans uppercase tracking-widest font-bold">Account Owner</p>
                          {isPro ? (
                            <span className="text-[9px] font-sans font-extrabold text-white pl-1 pr-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm" style={goldBadge}>
                              <Crown className="w-2.5 h-2.5" strokeWidth={2.5} /> {userSubscription.tier === "pro-lifetime" ? "Lifetime Pro" : "Pro member"}
                            </span>
                          ) : (
                            <span className="text-[9px] font-sans bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              Free plan
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-sans font-bold text-slate-800 truncate">{user.displayName || "Explorer"}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">{user.email || ""}</p>
                      </div>

                      <div className="p-1 space-y-1">
                        {/* Subscription Quick Upgrade Trigger */}
                        {userSubscription.tier === "free" ? (
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              setShowUpgradeModal(true);
                            }}
                            className="w-full flex items-center justify-between p-2 rounded text-xs text-[#7F345F] bg-rose-50 border border-purple-100 hover:bg-rose-100 transition-colors font-sans font-extrabold cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin-hover" />
                              Upgrade to Premium Pro
                            </span>
                            <span className="text-[9px] uppercase tracking-wider opacity-85">Go</span>
                          </button>
                        ) : (
                          <div className="p-2 rounded text-xs bg-emerald-50/50 border border-emerald-100 text-slate-700 font-sans">
                            <p className="font-bold text-emerald-800 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              Thanks for being a Pro member
                            </p>
                            <p className="text-[9px] text-slate-500 mt-1 font-mono">
                              Plan: {userSubscription.pricingPlan || "Beta Access"} <br />
                              {userSubscription.tier === "pro-lifetime"
                                ? "Lifetime access — never expires"
                                : `${userSubscription.subscriptionStatus === "canceling" ? "Ends" : "Renews"}: ${userSubscription.premiumExpires ? new Date(userSubscription.premiumExpires).toLocaleDateString() : "—"}`}
                            </p>
                            {userSubscription.tier !== "pro-lifetime" && userSubscription.subscriptionStatus !== "canceling" && (
                              <button
                                onClick={() => {
                                  if (window.confirm("Cancel your subscription? You'll keep Pro access until the end of the current billing period.")) {
                                    setMenuOpen(false);
                                    cancelSubscription();
                                  }
                                }}
                                className="mt-2 text-[9px] uppercase tracking-wider font-bold text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
                              >
                                Cancel subscription
                              </button>
                            )}
                          </div>
                        )}

                        <a href="/refunds" className="block px-3 py-2 rounded text-xs font-sans text-slate-600 hover:bg-slate-50">
                          Plan, cancellation &amp; refunds
                        </a>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            logout();
                          }}
                          className="w-full text-left flex items-center space-x-2 px-3 py-2 rounded text-xs font-sans font-bold uppercase tracking-wider text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AuthModal open={authPrompt !== null} reason={authPrompt ?? "signin"} onClose={closeAuth} />
    </header>
  );
};
