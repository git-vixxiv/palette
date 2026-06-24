import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { 
  X, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  Layers, 
  Bookmark, 
  Palette, 
  Flame,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const UpgradeModal: React.FC = () => {
  const { 
    showUpgradeModal, 
    setShowUpgradeModal, 
    upgradeToPro, 
    userSubscription, 
    downgradeToFree,
    user 
  } = useApp();
  
  const [billingPlan, setBillingPlan] = useState<"monthly" | "annual" | "lifetime">("annual");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Simulated Card Billing Form States
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [formError, setFormError] = useState("");

  if (!showUpgradeModal) return null;

  let priceText = "$25";
  let intervalText = "year (billed as $25/yr)";
  if (billingPlan === "monthly") {
    priceText = "$5";
    intervalText = "month (billed as $5/mo)";
  } else if (billingPlan === "lifetime") {
    priceText = "$50";
    intervalText = "lifetime (one-time checkout)";
  }

  const handleCheckoutSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!cardName.trim()) {
      setFormError("Cardholder name is required.");
      return;
    }
    if (cardNumber.replace(/\s+/g, "").length < 16) {
      setFormError("Please enter a valid 16-digit credit card number.");
      return;
    }
    if (cardExpiry.length < 5) {
      setFormError("Please enter card expiry date (MM/YY).");
      return;
    }
    if (cardCvc.length < 3) {
      setFormError("Please enter cvc.");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate payment gateway call latency (via Square Sandbox Web Payments SDK)
    setTimeout(async () => {
      try {
        await upgradeToPro(billingPlan);
        setSuccess(true);
        setIsSubmitting(false);
        
        // Auto-close success modal after brief delay
        setTimeout(() => {
          setSuccess(false);
          setShowUpgradeModal(false);
        }, 2200);
      } catch (err) {
        setIsSubmitting(false);
        setFormError("Square Authorization Failed: Cannot generate payment token.");
      }
    }, 1800);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    let formatted = "";
    for (let i = 0; i < raw.length && i < 16; i++) {
      if (i > 0 && i % 4 === 0) formatted += " ";
      formatted += raw[i];
    }
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    let formatted = "";
    if (raw.length > 0) {
      formatted += raw.substring(0, 2);
      if (raw.length > 2) {
        formatted += "/" + raw.substring(2, 4);
      }
    }
    setCardExpiry(formatted);
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setCardCvc(raw.substring(0, 4));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark overlay backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => !isSubmitting && setShowUpgradeModal(false)}
      />

      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row relative z-10"
        id="upgrade-pro-dialog"
      >
        {/* Absolute header actions */}
        <button 
          onClick={() => setShowUpgradeModal(false)}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer z-20"
          title="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Aspect: Highlighting Premium features value offer */}
        <div className="w-full md:w-1/2 p-6 md:p-8 bg-slate-950 text-white flex flex-col justify-between relative overflow-y-auto max-h-[300px] sm:max-h-[350px] md:max-h-none md:overflow-hidden shrink-0">
          {/* Ambient lighting effects */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#7F345F]/20 rounded-full blur-3xl translate-y-1/2 translate-x-1/2" />

          <div className="relative z-10">
            {/* Header tier badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] uppercase font-mono tracking-widest text-[#d1c69e] mb-6">
              <Sparkles className="w-3 h-3 text-[#d1c69e]" />
              <span>Color Pro Premium Partner</span>
            </div>

            <h3 className="text-2xl md:text-3xl font-display font-black tracking-tight mb-2 leading-none">
              Maximize Your <br />
              Color Science.
            </h3>
            <p className="text-xs text-slate-400 font-sans mb-8">
              Unlock the core algorithms, expanding to complete bento-grid layouts with WCAG contrast metrics.
            </p>

            {/* Core features block */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Expand up to 10 Color Columns</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Go beyond the 4-column limit. Add up to 10 custom shades in a single workbench composition.</p>
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
                  <p className="text-[10px] text-slate-400 mt-0.5">Archive as many palettes as you want. Standard accounts are capped at only 2 saved combomatrices.</p>
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
            <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Secured connection</span>
            <span>Billing handled globally</span>
          </div>
        </div>

        {/* Right Aspect: Upgrading checkout panel */}
        <div className="w-full md:w-1/2 p-6 md:p-8 bg-slate-50 flex flex-col justify-between overflow-y-auto max-h-[85vh] md:max-h-full">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div 
                key="success-prompt"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex-1 flex flex-col items-center justify-center text-center py-12"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20 animate-bounce">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <h4 className="text-lg font-display font-black text-slate-800 lowercase">payment authorized!</h4>
                <p className="text-xs text-slate-500 mt-2 max-w-xs">
                  Your premium access tier has been updated. Unlocked 10-column workspace, advanced mathematics, and unlimited collections.
                </p>
              </motion.div>
            ) : (
              <motion.div 
                key="payment-flows"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col justify-between"
              >
                <div>
                  <h4 className="text-sm font-sans font-extrabold tracking-tight uppercase text-slate-400 mb-4 text-left">
                    Select Your Premium Duration:
                  </h4>

                  {/* Toggle Pricing Tier Duration Selector */}
                  <div className="grid grid-cols-3 gap-2 p-1 bg-slate-200/60 rounded-lg mb-6">
                    <button
                      type="button"
                      onClick={() => setBillingPlan("monthly")}
                      className={`py-2 px-1 text-xs font-sans font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer flex flex-col items-center justify-center ${billingPlan === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      <span>Monthly</span>
                      <span className="text-[8px] opacity-70 font-mono mt-0.5 leading-none">$5/mo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingPlan("annual")}
                      className={`py-2 px-1 text-xs font-sans font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer flex flex-col items-center justify-center ${billingPlan === "annual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      <span>Annual</span>
                      <span className="text-[8px] text-emerald-600 font-mono font-bold mt-0.5 leading-none">save 58%</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingPlan("lifetime")}
                      className={`py-2 px-1 text-xs font-sans font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer flex flex-col items-center justify-center ${billingPlan === "lifetime" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      <span>Lifetime</span>
                      <span className="text-[8px] text-purple-600 font-mono font-bold mt-0.5 leading-none">Best Value</span>
                    </button>
                  </div>

                  {/* Pricing dynamic highlights */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs mb-6 text-left">
                    <p className="text-[10px] text-slate-400 uppercase font-sans font-bold tracking-wider">Estimated price</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-3xl font-display font-black text-slate-800">{priceText}</span>
                      <span className="text-xs text-slate-500 font-sans">/ {intervalText}</span>
                    </div>
                  </div>

                  {/* Checkout inputs */}
                  <form onSubmit={handleCheckoutSimulate} className="space-y-4 text-left">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                      <h5 className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-500 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-[#3e8e41]" />
                        Square Secure Hosted Payments
                      </h5>
                      <span className="text-[8px] uppercase tracking-widest font-black text-[#7F345F] bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 font-mono">
                        Square Gateway
                      </span>
                    </div>

                    {formError && (
                      <p className="text-xs text-rose-500 font-sans font-medium bg-rose-50 border-l-4 border-rose-500 p-2.5 rounded">
                        {formError}
                      </p>
                    )}

                    <div className="space-y-3">
                      {/* Cardholder name */}
                      <div>
                        <label className="block text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Cardholder Name
                        </label>
                        <input
                          type="text"
                          required
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="e.g. Alexis Carter"
                          disabled={isSubmitting}
                          className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:border-slate-400 outline-none transition-colors"
                        />
                      </div>

                      {/* Card number */}
                      <div>
                        <label className="block text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wide mb-1 flex justify-between">
                          <span>Card Number</span>
                          <span className="text-[8px] text-slate-400 font-mono normal-case">hosted securely by Square</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          placeholder="4111 2222 3333 4444"
                          disabled={isSubmitting}
                          className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:border-slate-400 outline-none transition-colors font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Expiration date */}
                        <div>
                          <label className="block text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wide mb-1">
                            Expiry (MM/YY)
                          </label>
                          <input
                            type="text"
                            required
                            value={cardExpiry}
                            onChange={handleExpiryChange}
                            placeholder="12/28"
                            disabled={isSubmitting}
                            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:border-slate-400 outline-none transition-colors font-mono"
                          />
                        </div>

                        {/* CVV */}
                        <div>
                          <label className="block text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wide mb-1">
                            CVV / CVC
                          </label>
                          <input
                            type="text"
                            required
                            value={cardCvc}
                            onChange={handleCvcChange}
                            placeholder="123"
                            disabled={isSubmitting}
                            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded focus:border-slate-400 outline-none transition-colors font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit checkout triggers */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-4 py-3 cursor-pointer text-xs font-sans font-black uppercase tracking-wider text-white rounded-lg flex items-center justify-center gap-2 transition-all transition-colors active:scale-98 disabled:opacity-50"
                      style={{ backgroundColor: "#7F345F" }}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Connecting Square Sandbox APIs...</span>
                        </div>
                      ) : (
                        <>
                          <span>Pay via Square & Turn Pro</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                </div>

                <div className="text-center mt-6 text-[10px] text-slate-400">
                  By upgrading, you agree to our terms. You can cancellation any time. Want to return to free status for testing? Click{" "}
                  <button 
                    onClick={() => {
                      downgradeToFree();
                      setShowUpgradeModal(false);
                    }}
                    className="underline text-[#7F345F] hover:text-[#5F2445] font-bold inline cursor-pointer"
                  >
                    Downgrade Account here
                  </button>.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
