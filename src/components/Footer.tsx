import React from "react";
import { LEGAL, LEGAL_PATHS, LEGAL_TITLES, LegalDoc } from "../legal";

/** Site footer: the legal links every page needs, and who runs the product. */
export const Footer: React.FC = () => (
  <footer className="w-full border-t border-slate-200 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-sans">
      <p>
        © {new Date().getFullYear()} {LEGAL.operator}. All rights reserved.
      </p>
      <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {(Object.keys(LEGAL_PATHS) as LegalDoc[]).map((doc) => (
          <a key={doc} href={LEGAL_PATHS[doc]} className="hover:text-[#2589BD] underline-offset-2 hover:underline">
            {LEGAL_TITLES[doc]}
          </a>
        ))}
      </nav>
    </div>
  </footer>
);
