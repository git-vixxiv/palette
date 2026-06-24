import React from "react";
import { useApp } from "../context/AppContext";
import { Folder, Trash2, ArrowUpRight, HelpCircle, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const CabinetPanel: React.FC = () => {
  const { savedPalettes, loadSavedPalette, deleteSavedPalette, loadingPalettes, user } = useApp();

  return (
    <section className="w-full max-w-7xl mx-auto p-6 md:p-8" id="saved-cabinet">
      
      {/* Title */}
      <div className="border-l-4 pl-4 space-y-1 mb-6 flex justify-between items-center" style={{ borderLeftColor: "#d1c69e" }}>
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <span>Palette Design Vault</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-sans">
            Retrieve your custom color compositions. {user ? `Signed in as ${user.displayName || "explorer"}` : "Guest local index preview."}
          </p>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {loadingPalettes ? (
          <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
            Querying your design database...
          </div>
        ) : savedPalettes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border border-dashed border-slate-250 rounded-xl p-8 text-center text-sm font-sans text-slate-500 bg-slate-50/50"
          >
            <Folder className="w-8 h-8 mx-auto text-slate-350 mb-2" />
            <p className="font-bold text-slate-700">No saved palettes yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Assign roles, calibrate your locked shades above, and click &apos;Save Palette&apos; to archive your favorite combinations.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedPalettes.map((palette) => (
              <motion.div
                key={palette.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group overflow-hidden relative"
              >
                {/* Header Information */}
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="truncate pr-4">
                      <h3 className="text-base font-display font-bold text-slate-800 truncate">
                        {palette.name}
                      </h3>
                      <span className="inline-block text-[9px] font-sans font-bold px-2 py-0.5 rounded uppercase tracking-wider" style={{ color: "#2589BD", backgroundColor: "rgba(37, 137, 189, 0.1)" }}>
                        {palette.harmonyMode}
                      </span>
                    </div>

                    {/* Delete action */}
                    <button
                      onClick={() => deleteSavedPalette(palette.id)}
                      className="p-1.5 rounded hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors cursor-pointer"
                      title="Delete Palette"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Visual palette row thumbnails */}
                  <div className="flex h-12 rounded overflow-hidden border border-slate-200 mb-4 shadow-3xs">
                    {palette.colors.map((color, cIdx) => (
                      <div
                        key={cIdx}
                        className="flex-1 relative group/color flex items-center justify-center transition-all duration-300 hover:flex-[1.5]"
                        style={{ backgroundColor: color.hex }}
                        title={`${color.hex} (${color.role})`}
                      >
                        {/* Interactive floating indicator */}
                        <span className="opacity-0 group-hover/color:opacity-90 transition-opacity bg-slate-900 text-white font-mono text-[8px] font-black px-1.5 py-0.5 rounded leading-none select-none">
                          {color.hex.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Open Palette Trigger */}
                <button
                  onClick={() => loadSavedPalette(palette)}
                  className="w-full py-2.5 bg-slate-50 border border-slate-150 text-slate-800 hover:bg-slate-900 hover:text-white rounded text-xs font-sans font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Restore Canvas</span>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};
