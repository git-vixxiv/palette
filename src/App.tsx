import React, { useEffect } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { Header } from "./components/Header";
import { PaletteGenerator } from "./components/PaletteGenerator";
import { ContrastMatrix } from "./components/ContrastMatrix";
import { ScoringPanel } from "./components/ScoringPanel";
import { CabinetPanel } from "./components/CabinetPanel";
import { UpgradeModal } from "./components/UpgradeModal";
import { Sparkles, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

function MainWorkbenchContent() {
  const { spinPalette, isSpinning, notification, clearToast } = useApp();

  // Bind Spacebar key listeners to easily spin colors like Coolors.co!
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const target = e.target as HTMLElement;
        // Check if user is typing in forms to avoid intercepting normal spacebar entries
        const isTyping =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable;

        if (!isTyping) {
          e.preventDefault();
          if (!isSpinning) {
            spinPalette();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [spinPalette, isSpinning]);

  // Self closing alert toast
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        clearToast();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="min-h-screen flex flex-col antialiased select-none" style={{ backgroundColor: "#f4f4f4" }}>
      
      {/* Brand Header */}
      <Header />

      {/* Primary Workstation App Canvas */}
      <main className="flex-1 pb-16">
        
        {/* Spacebar guide helper label in UI margins (designed humby and non-bothering) */}
        <div className="hidden sm:flex bg-slate-900 text-white/90 text-center py-2 px-4 text-xs font-sans tracking-wide font-medium items-center justify-center gap-2 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 animate-spin-hover" style={{ color: "#d1c69e" }} />
          <span>Pro Tip: Press the <strong>SPACEBAR</strong> on your keyboard to instantly re-spin all un-locked colors!</span>
        </div>

        {/* 1. Generator Block */}
        <PaletteGenerator />

        {/* 2. Analytical Score Card */}
        <div className="mt-4">
          <ScoringPanel />
        </div>

        {/* 3. Accessibility Checker */}
        <div className="mt-4">
          <ContrastMatrix />
        </div>

        {/* 4. saved cabinet database list */}
        <div className="mt-4 border-t border-gray-150 pt-4">
          <CabinetPanel />
        </div>

      </main>

      {/* Custom responsive absolute Notifications Panel */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-2xl items-start space-x-3.5 ${
              notification.message.toLowerCase().includes("generated") ? "hidden sm:flex" : "flex"
            }`}
          >
            <div className="p-1 rounded-lg shrink-0" style={{ backgroundColor: "rgba(37, 137, 189, 0.1)", color: "#2589BD" }}>
              <Info className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-sans leading-relaxed text-slate-100 pr-4">
                {notification.message}
              </p>
            </div>
            <button
              onClick={clearToast}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle responsive footer layout */}
      <footer className="bg-white border-t border-gray-150 py-6 px-4 text-center text-xs text-gray-400 font-sans">
        <p>© {new Date().getFullYear()} palette by vixxiv. Backed by established WCAG 2.1 accessibility guidance & color harmony science.</p>
        <p className="text-[10px] mt-1 text-gray-300">Space Grotesk typography & lucide vector assets</p>
      </footer>

      {/* Subscription Checkout Drawer Dialog */}
      <AnimatePresence>
        <UpgradeModal />
      </AnimatePresence>

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainWorkbenchContent />
    </AppProvider>
  );
}
