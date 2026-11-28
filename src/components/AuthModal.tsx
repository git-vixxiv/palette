import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { X, Mail, Lock, User as UserIcon, LogIn } from "lucide-react";
import { motion } from "motion/react";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** "upgrade" when the visitor came here from an upgrade button. */
  reason?: "signin" | "upgrade";
}

type Mode = "signin" | "signup" | "reset";

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, reason = "signin" }) => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, sendReset } = useApp();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Someone arriving from an upgrade button most likely has no account yet.
  useEffect(() => {
    if (open) {
      setMode(reason === "upgrade" ? "signup" : "signin");
      setError("");
    }
  }, [open, reason]);

  if (!open) return null;

  const reset = () => {
    setError("");
    setPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await loginWithEmail(email, password);
        onClose();
      } else if (mode === "signup") {
        await registerWithEmail(email, password, name);
        onClose();
      } else {
        await sendReset(email);
        setMode("signin");
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset password";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <h3 className="text-xl font-display font-black tracking-tight text-slate-800 lowercase">
            {title}
          </h3>
          <p className="text-xs text-slate-500 font-sans mt-1">
            {mode === "reset"
              ? "We'll email you a password reset link."
              : reason === "upgrade"
                ? "One quick step before Pro: your subscription is tied to an account. Create one or sign in and you'll go straight on to checkout."
                : "Sign in to manage your plan and your palette library."}
          </p>
        </div>

        {/* Google */}
        {mode !== "reset" && (
          <>
            <button
              onClick={async () => {
                setBusy(true);
                try {
                  await loginWithGoogle();
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-300 rounded-lg text-sm font-sans font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">or</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full text-sm pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:border-slate-400 outline-none transition-colors"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full text-sm pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:border-slate-400 outline-none transition-colors"
            />
          </div>

          {mode !== "reset" && (
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full text-sm pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:border-slate-400 outline-none transition-colors"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-500 font-sans font-medium bg-rose-50 border-l-4 border-rose-500 p-2.5 rounded">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-sans font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        {mode !== "reset" && (
          <label className="flex items-start gap-2 mt-4 text-xs text-slate-600 font-sans cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5"
                onChange={(e) => {
                  // Read after sign-in, when the profile is created or loaded.
                  try {
                    if (e.target.checked) localStorage.setItem("palette_marketing_opt_in", "1");
                    else localStorage.removeItem("palette_marketing_opt_in");
                  } catch {
                    /* storage unavailable */
                  }
                }}
              />
              <span>Email me palette tips and news about other vixxiv apps. Optional; unsubscribe any time.</span>
            </label>
        )}

        {/* Mode switches */}
        <div className="mt-4 text-center text-xs text-slate-500 font-sans space-y-1">
          {mode === "signin" && (
            <>
              <p>
                New here?{" "}
                <button onClick={() => { setMode("signup"); reset(); }} className="text-[#2589BD] font-bold hover:underline cursor-pointer">
                  Create an account
                </button>
              </p>
              <p>
                <button onClick={() => { setMode("reset"); reset(); }} className="text-slate-400 hover:underline cursor-pointer">
                  Forgot your password?
                </button>
              </p>
            </>
          )}
          {mode === "signup" && (
            <p>
              Already have an account?{" "}
              <button onClick={() => { setMode("signin"); reset(); }} className="text-[#2589BD] font-bold hover:underline cursor-pointer">
                Sign in
              </button>
            </p>
          )}
          {mode === "reset" && (
            <p>
              <button onClick={() => { setMode("signin"); reset(); }} className="text-[#2589BD] font-bold hover:underline cursor-pointer">
                Back to sign in
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
