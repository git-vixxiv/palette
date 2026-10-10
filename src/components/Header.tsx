import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { Palette, LogIn, LogOut, ChevronDown, CheckCircle, Database, Sparkles, Star, Award } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const Header: React.FC = () => {
  const { user, signIn, logout, isDbActive, savedPalettes, entitlement, membership, setShowUpgradeModal } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const tierLabel = entitlement.tier === "none" ? (entitlement.client ? "client" : "no tier") : entitlement.tier;

  return (
    <header className="flex items-center justify-between px-6 md:px-12 py-4 bg-white border-b border-slate-200 shadow-sm relative z-45">
      {/* Brand Logo and Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#2589BD" }}>
          <div className="w-4 h-4 border-2 border-white rounded-full"></div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg md:text-xl font-display font-black tracking-tight text-slate-800 lowercase">
              palette <span className="font-bold text-xs font-sans tracking-normal lowercase" style={{ color: "#2589BD" }}>by vixxiv</span>
            </span>
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm sm:inline-block hidden">
              Lab & Analyzer
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-sans hidden md:block mt-0.5">
            Color science engine, WCAG contrast matrix compliance, and AI optimization
          </p>
        </div>
      </div>

      {/* User Actions */}
      <div className="flex items-center gap-6">
        <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <a href="#scoring-analytics" className="hover:text-[#2589BD] transition-colors">Theory & Analytics</a>
          <a href="#accessibility-analyzer" className="hover:text-[#2589BD] transition-colors">Contrast Matrix</a>
          <a href="#saved-cabinet" className="hover:text-[#2589BD] transition-colors">Vault Cabinet</a>
        </nav>

        <div className="hidden lg:block h-5 w-[1px] bg-slate-200" />

        <div className="flex items-center gap-4">
          {/* Connection badge status */}
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
              {isDbActive ? "● Cloud Vault" : "○ Local Vault"}
            </p>
            <p className="text-[10px] font-sans font-bold uppercase tracking-wider" style={{ color: "#2589BD" }}>
              {savedPalettes.length} Saved Combo{savedPalettes.length !== 1 && "s"}
            </p>
          </div>

          {/* Membership badge — tool access comes from the vixxiv-id token */}
          {!entitlement.tools ? (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="px-3 py-1.5 text-[9px] font-sans font-extrabold uppercase tracking-wider rounded border cursor-pointer transition-all hover:bg-rose-50 flex items-center gap-1.5 shrink-0 bg-white"
              style={{ color: "#7F345F", borderColor: "#7F345F" }}
            >
              <Sparkles className="w-3 h-3 text-amber-500 animate-spin-hover" />
              <span className="hidden sm:inline">Membership</span>
              <span className="sm:hidden">Join</span>
            </button>
          ) : (
            <div
              className="px-2.5 py-1.5 text-[9px] font-sans font-black uppercase tracking-widest rounded border shrink-0 flex items-center gap-1 select-none"
              style={{ color: "#22c55e", borderColor: "#22c55e", backgroundColor: "rgba(34, 197, 94, 0.05)" }}
            >
              <Award className="w-3 h-3 text-emerald-500" />
              <span>{entitlement.client && entitlement.tier === "none" ? "Client" : entitlement.tier}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {!user ? (
              <motion.button
                key="signin"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                onClick={signIn}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-all shadow-xs flex items-center border border-transparent cursor-pointer"
              >
                <span className="hidden sm:inline" style={{ fontSize: "9.6px" }}>Sign In</span>
                <span className="sm:hidden" style={{ fontSize: "9.6px" }}>Sign In</span>
              </motion.button>
            ) : (
              <div className="relative">
                <motion.button
                  key="user-badge"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center space-x-2.5 p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-all cursor-pointer"
                >
                  <img
                    src={user.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50"}
                    alt="Avatar"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 roundedobject-cover shadow-3xs border border-white"
                  />
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
                          {entitlement.tools ? (
                            <span className="text-[8px] font-mono uppercase bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-black flex items-center gap-0.5">
                              <Star className="w-2 h-2 text-emerald-600 fill-emerald-600" /> {tierLabel}
                            </span>
                          ) : (
                            <span className="text-[8px] font-mono uppercase bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                              {tierLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-sans font-bold text-slate-800 truncate">{user.displayName || "Explorer"}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">{user.email || ""}</p>
                      </div>

                      <div className="p-1 space-y-1">
                        {/* Membership status — `status` read verbatim from users/{uid} (ADR-0001 §10 gap 2).
                            Billing and cancellation are the hub's; palette has no billing code. */}
                        <div
                          data-status={membership.status}
                          className={`p-2 rounded text-xs border font-sans ${
                            membership.tone === "warn"
                              ? "bg-amber-50 border-amber-200 text-amber-900"
                              : membership.tone === "ok"
                                ? "bg-emerald-50/50 border-emerald-100 text-emerald-900"
                                : "bg-slate-50 border-slate-100 text-slate-700"
                          }`}
                        >
                          <p className="font-bold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {membership.label}
                          </p>
                          {membership.detail && <p className="text-[9px] mt-1 font-mono">{membership.detail}</p>}
                        </div>

                        {!entitlement.tools && (
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              setShowUpgradeModal(true);
                            }}
                            className="w-full flex items-center justify-between p-2 rounded text-xs text-[#7F345F] bg-rose-50 border border-purple-100 hover:bg-rose-100 transition-colors font-sans font-extrabold cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin-hover" />
                              Get palette with vixxiv membership
                            </span>
                            <span className="text-[9px] uppercase tracking-wider opacity-85">Go</span>
                          </button>
                        )}

                        <div className="flex items-center space-x-2 p-2 rounded text-xs text-slate-600 bg-slate-50">
                          {isDbActive ? (
                            <>
                              <Database className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Saved to Cloud Firestore</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" style={{ color: "#2589BD" }} />
                              <span>Saved Offline to Browser</span>
                            </>
                          )}
                        </div>

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
    </header>
  );
};
