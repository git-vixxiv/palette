import React, { useCallback, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useApp } from "../context/AppContext";
import { Crown, Gift, RefreshCw, Tag, Users, DollarSign, AlertTriangle } from "lucide-react";

/* The owner's back office. Every number and action comes from the adminApi
   Cloud Function, which checks the caller is a verified admin sign-in; this
   page only draws what it returns. */

type Plan = "monthly" | "annual" | "lifetime";
const PLANS: Plan[] = ["monthly", "annual", "lifetime"];

const money = (cents: number) => (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
const day = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
const errText = (e: any) => String(e?.message || "Something went wrong.").replace(/^(internal|permission-denied)$/i, "Something went wrong.");

async function api<T = any>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!functions) throw new Error("The backend is not configured.");
  const res = await httpsCallable(functions, "adminApi")({ action, ...data });
  return res.data as T;
}

const card = "bg-white border border-slate-200 rounded-xl p-4 sm:p-5";
const label = "block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1";
const input = "w-full h-10 px-3 rounded-md bg-slate-50 border border-slate-300 text-sm text-slate-800 focus:outline-hidden focus:border-slate-900";
const btn = "h-10 px-4 rounded-md bg-slate-900 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-2";
const th = "text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2 whitespace-nowrap";
const td = "px-3 py-2.5 text-sm text-slate-700 whitespace-nowrap";

const Stat: React.FC<{ title: string; value: string; note?: string }> = ({ title, value, note }) => (
  <div className={card}>
    <p className={label}>{title}</p>
    <p className="text-2xl font-display font-black text-slate-900">{value}</p>
    {note && <p className="text-xs text-slate-500 mt-1">{note}</p>}
  </div>
);

const Notice: React.FC<{ kind: "error" | "ok"; children: React.ReactNode }> = ({ kind, children }) => (
  <p className={`text-sm rounded-md px-3 py-2 border ${kind === "error" ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>{children}</p>
);

const tierName = (u: any) =>
  u.tier === "free" ? "Free" : `${u.tier === "pro-lifetime" ? "Lifetime" : u.tier === "pro-annual" ? "Annual" : "Monthly"}${u.comp ? " (comp)" : ""}`;

/* ------------------------------ Overview ------------------------------ */
/** Shown once Square is in production: the one-click preparation step. */
const GoLive: React.FC<{ reload: () => void }> = ({ reload }) => {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const res: any = await api("prepareProduction");
      setReport(res.report);
      reload();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`${card} space-y-3`}>
      <p className="text-sm font-bold text-slate-900">Live payments setup</p>
      <p className="text-sm text-slate-600">
        Square is in production. Run this once after switching: it checks the live location, creates the monthly and annual plans in your live Square catalog, and clears sandbox billing records from test accounts. Running it again is harmless.
      </p>
      <button onClick={run} disabled={busy} className={btn}>{busy ? "Working…" : "Prepare production"}</button>
      {error && <Notice kind="error">{error}</Notice>}
      {report && (
        <ul className="text-sm text-slate-700 space-y-1">
          {Object.entries(report).map(([k, v]) => (
            <li key={k}><span className="font-semibold">{k}:</span> {v}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Overview: React.FC<{ users: any; revenue: any; reload: () => void }> = ({ users, revenue, reload }) => {
  const s = users?.summary;
  const max = Math.max(1, ...(revenue?.daily ?? []).map((d: any) => d.cents));
  return (
    <div className="space-y-5">
      {revenue?.environment !== "production" && revenue && (
        <Notice kind="error">Square is in sandbox mode. The money figures below are test payments, not real revenue.</Notice>
      )}
      {revenue?.environment === "production" && <GoLive reload={reload} />}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat title="Today" value={revenue ? money(revenue.today.grossCents - revenue.today.refundedCents) : "…"} note={revenue ? `${revenue.today.sales} payments` : undefined} />
        <Stat title="Last 7 days" value={revenue ? money(revenue.last7.grossCents - revenue.last7.refundedCents) : "…"} note={revenue ? `${revenue.last7.sales} payments` : undefined} />
        <Stat title="Last 30 days" value={revenue ? money(revenue.last30.grossCents - revenue.last30.refundedCents) : "…"} note={revenue ? `${revenue.last30.sales} payments` : undefined} />
        <Stat title={`Last ${revenue?.days ?? 90} days`} value={revenue ? money(revenue.window.grossCents - revenue.window.refundedCents) : "…"} note={revenue ? `${revenue.window.sales} payments${revenue.window.refundedCents ? `, ${money(revenue.window.refundedCents)} refunded` : ""}` : undefined} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat title="Accounts" value={s ? String(s.total) : "…"} note={s ? `${s.newLast7} new in 7 days, ${s.newLast30} in 30` : undefined} />
        <Stat title="Paying members" value={s ? String(s.monthly + s.annual + s.lifetime) : "…"} note={s ? `${s.monthly} monthly, ${s.annual} annual, ${s.lifetime} lifetime` : undefined} />
        <Stat title="Estimated monthly recurring" value={s ? money(s.mrrCents) : "…"} note="At list prices, from plans set to renew" />
        <Stat title="Comps / cancelling" value={s ? `${s.comps} / ${s.canceling}` : "…"} note="Complimentary accounts / plans set to end" />
      </div>

      <div className={card}>
        <p className={label}>Net sales per day</p>
        {revenue?.daily?.length ? (
          <div className="flex items-end gap-1 h-32 mt-3" role="img" aria-label="Net sales per day">
            {revenue.daily.map((d: any) => (
              <div key={d.day} className="flex-1 min-w-[3px] bg-[#2589BD] rounded-t" style={{ height: `${Math.max(3, (d.cents / max) * 100)}%` }} title={`${d.day}: ${money(d.cents)}`} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-2">{revenue ? "No completed payments in this period." : "Loading…"}</p>
        )}
      </div>

      <div className={`${card} overflow-x-auto`}>
        <p className={label}>Recent payments (from Square)</p>
        {revenue?.truncated && <p className="text-xs text-amber-700 mb-2">There are more payments in this period than are shown; totals cover the most recent 3,000.</p>}
        <table className="w-full">
          <thead>
            <tr><th className={th}>Date</th><th className={th}>Customer</th><th className={th}>What</th><th className={th}>Status</th><th className={`${th} text-right`}>Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(revenue?.payments ?? []).map((p: any) => (
              <tr key={p.id}>
                <td className={td}>{day(p.at)}</td>
                <td className={td}>{p.email || "—"}</td>
                <td className={td}>{p.note || "—"}</td>
                <td className={td}>{p.status === "COMPLETED" ? "Paid" : p.status.toLowerCase()}{p.refundedCents ? `, ${money(p.refundedCents)} refunded` : ""}</td>
                <td className={`${td} text-right font-mono`}>{money(p.amountCents)}</td>
              </tr>
            ))}
            {revenue && !revenue.payments.length && <tr><td className={td} colSpan={5}>No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ------------------------------- Users -------------------------------- */
const UsersTab: React.FC<{ data: any; reload: () => void }> = ({ data, reload }) => {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<"lifetime" | "until">("until");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.users ?? []).filter((u: any) => {
      if (needle && !`${u.email} ${u.name}`.toLowerCase().includes(needle)) return false;
      if (filter === "paying") return u.tier !== "free" && !u.comp;
      if (filter === "comp") return u.comp && u.tier !== "free";
      if (filter === "free") return u.tier === "free";
      return true;
    });
  }, [data, q, filter]);

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("grantComp", { email, kind, until });
      setMsg({ kind: "ok", text: `Comp issued to ${email}. They will see Pro the next time they open palette.` });
      setEmail("");
      reload();
    } catch (err) {
      setMsg({ kind: "error", text: errText(err) });
    } finally {
      setBusy(false);
    }
  };
  // The account whose "Manage" panel is open, and the date typed into it.
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [endDate, setEndDate] = useState("");
  const act = async (u: any, op: string, confirmText: string, extra: Record<string, unknown> = {}) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("userAction", { uid: u.uid, op, ...extra });
      setMsg({ kind: "ok", text: `Done: ${u.email}.` });
      setOpenUid(null);
      reload();
    } catch (err) {
      setMsg({ kind: "error", text: errText(err) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (u: any) => {
    if (!window.confirm(`Remove the comp from ${u.email}? Their account goes back to the free plan now.`)) return;
    try {
      await api("revokeComp", { uid: u.uid });
      reload();
    } catch (err) {
      setMsg({ kind: "error", text: errText(err) });
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={grant} className={`${card} space-y-3`}>
        <p className="text-sm font-bold text-slate-900 flex items-center gap-2"><Gift className="w-4 h-4 text-amber-600" /> Issue a comp</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className={label}>Account email</label>
            <input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" />
          </div>
          <div>
            <label className={label}>Length</label>
            <select className={input} value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="until">Pro until a date</option>
              <option value="lifetime">Lifetime Pro</option>
            </select>
          </div>
          <div>
            <label className={label}>Ends on</label>
            <input className={input} type="date" required={kind === "until"} disabled={kind === "lifetime"} value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className={btn} disabled={busy}>{busy ? "Issuing…" : "Issue comp"}</button>
          <p className="text-xs text-slate-500">The person needs a palette account first. No card is taken and nothing is charged.</p>
        </div>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      </form>

      <div className={`${card} overflow-x-auto`}>
        <div className="flex flex-wrap gap-3 items-end mb-3">
          <div className="flex-1 min-w-[200px]">
            <label className={label}>Search</label>
            <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email or name" />
          </div>
          <div>
            <label className={label}>Show</label>
            <select className={input} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Everyone</option>
              <option value="paying">Paying members</option>
              <option value="comp">Comps</option>
              <option value="free">Free</option>
            </select>
          </div>
          <p className="text-xs text-slate-500 pb-2.5">{rows.length} of {data?.users?.length ?? 0} accounts</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMsg(null);
              try {
                const res: any = await api("brevoSync");
                const problems = Object.entries(res.setup || {}).filter(([, v]) => /failed|not activated/.test(String(v))).map(([k, v]) => `${k}: ${v}`);
                setMsg({ kind: problems.length ? "error" : "ok", text: `${res.synced} accounts sent to Brevo.${problems.length ? ` Setup problems: ${problems.join("; ")}` : ""}` });
              } catch (err) {
                setMsg({ kind: "error", text: errText(err) });
              } finally {
                setBusy(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="h-9 px-3 rounded-md border border-slate-300 bg-white text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer hover:bg-slate-50 disabled:opacity-50"
          >
            Sync all to Brevo
          </button>
          <p className="text-xs text-slate-500">New and changed accounts sync by themselves. Use this once to send existing accounts, or to repair the lists.</p>
        </div>
        <table className="w-full">
          <thead>
            <tr><th className={th}>Account</th><th className={th}>Plan</th><th className={th}>Renews / ends</th><th className={th}>Joined</th><th className={th}>Last seen</th><th className={th}></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((u: any) => (
              <React.Fragment key={u.uid}>
              <tr className={u.disabled ? "opacity-60" : ""}>
                <td className={td}>
                  <span className="font-semibold text-slate-900">{u.email || "(no email)"}</span>
                  {u.name && <span className="text-slate-500"> · {u.name}</span>}
                  {u.disabled && <span className="ml-2 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">Deactivated</span>}
                  {u.promoRevertFailed && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-rose-700" title="A first-payment promo could not be set back to the normal price in Square. Check this subscription's price in Square.">
                      <AlertTriangle className="w-3 h-3" /> promo price not reverted
                    </span>
                  )}
                </td>
                <td className={td}>
                  <span className="inline-flex items-center gap-1.5">
                    {u.tier !== "free" && <Crown className="w-3.5 h-3.5 text-amber-600" />}
                    {tierName(u)}
                  </span>
                  {u.plan && !u.comp && <span className="text-slate-500"> · {u.plan}</span>}
                </td>
                <td className={td}>
                  {u.tier === "free" ? "—" : u.tier === "pro-lifetime" ? "Never" : `${u.status === "canceling" ? "Ends" : "Renews"} ${day(u.expires)}`}
                  {u.status === "past_due" && <span className="text-rose-700"> · payment failed</span>}
                </td>
                <td className={td}>{day(u.created)}</td>
                <td className={td}>{day(u.lastSignIn)}</td>
                <td className={`${td} text-right`}>
                  <button onClick={() => { setOpenUid(openUid === u.uid ? null : u.uid); setEndDate(""); }} className="text-xs font-bold text-[#2589BD] hover:underline cursor-pointer">
                    {openUid === u.uid ? "Close" : "Manage"}
                  </button>
                </td>
              </tr>
              {openUid === u.uid && (
                <tr className="bg-slate-50">
                  <td colSpan={6} className="px-3 py-4 whitespace-normal">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-700">
                      {/* Plan */}
                      <div className="space-y-2">
                        <p className={label}>Plan</p>
                        {u.tier === "free" && <p>On the free plan. Use "Issue a comp" above to give Pro.</p>}
                        {u.tier === "free" && (
                          <button onClick={() => { setEmail(u.email); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs font-bold text-[#2589BD] hover:underline cursor-pointer">Fill in their email above</button>
                        )}
                        {u.renewing && (
                          <>
                            <p>Paid plan, renews {day(u.expires)} through Square.</p>
                            <button disabled={busy} onClick={() => act(u, "cancelRenewal", `Stop ${u.email}'s plan from renewing? They keep Pro until ${day(u.expires)} and are not charged again.`)} className="block text-xs font-bold text-rose-600 hover:underline cursor-pointer">Cancel renewal</button>
                          </>
                        )}
                        {u.comp && u.tier !== "free" && (
                          <button disabled={busy} onClick={() => revoke(u)} className="block text-xs font-bold text-rose-600 hover:underline cursor-pointer">Remove comp (back to free now)</button>
                        )}
                        {u.tier !== "free" && !u.comp && (
                          <button disabled={busy} onClick={() => act(u, "endNow", `End Pro for ${u.email} right now? Any subscription is stopped and the account goes to the free plan immediately. Nothing is refunded.`)} className="block text-xs font-bold text-rose-600 hover:underline cursor-pointer">End Pro now</button>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="space-y-2">
                        <p className={label}>Date Pro ends</p>
                        {u.tier === "pro-lifetime" && !u.comp ? (
                          <p>Bought lifetime, so there is no end date.</p>
                        ) : u.renewing ? (
                          <p>The renewal date is set by Square's billing cycle. To choose your own end date, cancel the renewal first; the date can then be set here. To move the billing date while still charging, change it in the Square Dashboard.</p>
                        ) : (
                          <>
                            <p>{u.tier === "free" ? "Give Pro until a date you choose." : `Currently ${u.tier === "pro-lifetime" ? "never ends" : `ends ${day(u.expires)}`}. Set a new end date:`}</p>
                            <div className="flex gap-2">
                              <input type="date" className={input} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                              <button disabled={busy || !endDate} onClick={() => act(u, "setEndDate", "", { date: endDate })} className={btn}>Save</button>
                            </div>
                            <p className="text-xs text-slate-500">No charge is made. The account is held as complimentary until that date.</p>
                          </>
                        )}
                      </div>

                      {/* Sign-in */}
                      <div className="space-y-2">
                        <p className={label}>Account access</p>
                        {u.disabled ? (
                          <>
                            <p>Deactivated: this person can't sign in.</p>
                            <button disabled={busy} onClick={() => act(u, "reactivate", "")} className="text-xs font-bold text-[#2589BD] hover:underline cursor-pointer">Reactivate account</button>
                          </>
                        ) : (
                          <>
                            <p>Deactivating blocks sign-in and stops any subscription from renewing. Their data is kept, and you can reactivate later.</p>
                            <button disabled={busy} onClick={() => act(u, "deactivate", `Deactivate ${u.email}? They will be signed out and unable to sign in. Any subscription stops renewing.`)} className="text-xs font-bold text-rose-600 hover:underline cursor-pointer">Deactivate account</button>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
            {data && !rows.length && <tr><td className={td} colSpan={6}>No accounts match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ---------------------------- Promo codes ----------------------------- */
const PromosTab: React.FC<{ data: any; reload: () => void }> = ({ data, reload }) => {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed" | "comp">("percent");
  const [compKind, setCompKind] = useState<"lifetime" | "until">("until");
  const [compUntil, setCompUntil] = useState("");
  const [percentOff, setPercentOff] = useState("20");
  const [plans, setPlans] = useState<Plan[]>(["monthly", "annual", "lifetime"]);
  const [fixed, setFixed] = useState<Record<Plan, string>>({ monthly: "", annual: "", lifetime: "" });
  const [duration, setDuration] = useState<"first" | "forever">("first");
  const [maxRedemptions, setMax] = useState("");
  const [expiresAt, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const list = data?.listPrices as Record<Plan, number> | undefined;

  const toggle = (p: Plan) => setPlans((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const fixedCents: Record<string, number> = {};
      // Only a fixed-price code carries prices; blank fields must not be sent as NaN.
      if (kind === "fixed") {
        plans.forEach((p) => {
          const cents = Math.round(parseFloat(fixed[p]) * 100);
          if (Number.isFinite(cents)) fixedCents[p] = cents;
        });
      }
      const res = await api("createPromo", { code, kind, compKind, compUntil, percentOff: kind === "percent" ? Number(percentOff) || 0 : null, fixedCents, plans, duration, maxRedemptions: Number(maxRedemptions) || null, expiresAt: expiresAt || null, note });
      setMsg({ kind: "ok", text: `Code ${res.code} is live.` });
      setCode("");
      setNote("");
      reload();
    } catch (err) {
      setMsg({ kind: "error", text: errText(err) });
    } finally {
      setBusy(false);
    }
  };
  const setActive = async (p: any, active: boolean) => {
    try {
      await api("setPromoActive", { code: p.code, active });
      reload();
    } catch (err) {
      setMsg({ kind: "error", text: errText(err) });
    }
  };
  const describe = (p: any) =>
    p.kind === "comp"
      ? `Free Pro, ${p.compKind === "lifetime" ? "lifetime" : `until ${day(p.compUntil)}`}`
      : p.kind === "percent"
      ? `${p.percentOff}% off`
      : PLANS.filter((x) => p.fixedCents?.[x] != null).map((x) => `${x} ${money(p.fixedCents[x])}`).join(", ");

  return (
    <div className="space-y-5">
      <form onSubmit={create} className={`${card} space-y-4`}>
        <p className="text-sm font-bold text-slate-900 flex items-center gap-2"><Tag className="w-4 h-4 text-[#7F345F]" /> New promo code</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={label}>Code</label>
            <input className={`${input} uppercase font-mono`} required minLength={3} maxLength={32} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="LAUNCH20" />
          </div>
          <div>
            <label className={label}>Type</label>
            <select className={input} value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="percent">Percentage off</option>
              <option value="fixed">Special fixed price</option>
              <option value="comp">Complimentary Pro (100% off, no card)</option>
            </select>
          </div>
          {kind === "comp" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Gives</label>
                <select className={input} value={compKind} onChange={(e) => setCompKind(e.target.value as any)}>
                  <option value="until">Pro until a date</option>
                  <option value="lifetime">Lifetime Pro</option>
                </select>
              </div>
              <div>
                <label className={label}>Access ends on</label>
                <input className={input} type="date" required={compKind === "until"} disabled={compKind === "lifetime"} value={compUntil} onChange={(e) => setCompUntil(e.target.value)} />
              </div>
            </div>
          ) : (
            <div>
              <label className={label}>Applies to subscriptions for</label>
              <select className={input} value={duration} onChange={(e) => setDuration(e.target.value as any)}>
                <option value="first">The first payment only</option>
                <option value="forever">Every renewal</option>
              </select>
            </div>
          )}
        </div>
        {kind === "comp" && (
          <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Anyone who enters this code gets Pro for free, with no card and no charge. Set a maximum number of uses below unless you mean it to be open to everyone who has the code.
          </p>
        )}

        <div className={kind === "comp" ? "hidden" : ""}>
          <label className={label}>Plans this code works on{kind === "fixed" ? ", and the price for each" : ""}</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLANS.map((p) => (
              <div key={p} className={`rounded-md border p-3 ${plans.includes(p) ? "border-slate-900 bg-white" : "border-slate-200 bg-slate-50"}`}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 capitalize cursor-pointer">
                  <input type="checkbox" checked={plans.includes(p)} onChange={() => toggle(p)} /> {p}
                  {list && <span className="text-xs font-normal text-slate-500">normally {money(list[p])}</span>}
                </label>
                {kind === "fixed" && plans.includes(p) && (
                  <input className={`${input} mt-2`} type="number" min="1" step="0.01" required value={fixed[p]} onChange={(e) => setFixed({ ...fixed, [p]: e.target.value })} placeholder="Promo price in $" />
                )}
                {kind === "percent" && plans.includes(p) && list && Number(percentOff) > 0 && (
                  <p className="text-xs text-slate-500 mt-2">Customer pays {money(Math.max(100, Math.round((list[p] * (100 - Number(percentOff))) / 100)))}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {kind === "percent" && (
            <div>
              <label className={label}>Percent off (1 to 99)</label>
              <input className={input} type="number" min="1" max="99" required value={percentOff} onChange={(e) => setPercentOff(e.target.value)} />
            </div>
          )}
          <div>
            <label className={label}>Maximum uses (blank = no limit)</label>
            <input className={input} type="number" min="1" value={maxRedemptions} onChange={(e) => setMax(e.target.value)} />
          </div>
          <div>
            <label className={label}>Code stops working (blank = never)</label>
            <input className={input} type="date" value={expiresAt} onChange={(e) => setExpires(e.target.value)} />
          </div>
          <div className={kind === "percent" ? "" : "md:col-span-2"}>
            <label className={label}>Private note</label>
            <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who or what it's for" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className={btn} disabled={busy || !plans.length}>{busy ? "Creating…" : "Create code"}</button>
          <p className="text-xs text-slate-500">{kind === "comp" ? "Each account can use a code once." : "Each account can use a code once. The lowest price a card can be charged is $1; for free access, choose the Complimentary Pro type."}</p>
        </div>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      </form>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full">
          <thead>
            <tr><th className={th}>Code</th><th className={th}>Offer</th><th className={th}>Plans</th><th className={th}>Lasts</th><th className={th}>Used</th><th className={th}>Expires</th><th className={th}>Note</th><th className={th}></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data?.promos ?? []).map((p: any) => (
              <tr key={p.code} className={p.active ? "" : "opacity-50"}>
                <td className={`${td} font-mono font-bold text-slate-900`}>{p.code}</td>
                <td className={td}>{describe(p)}</td>
                <td className={td}>{p.kind === "comp" ? "—" : p.plans.join(", ")}</td>
                <td className={td}>{p.kind === "comp" ? "No payment" : p.duration === "first" ? "First payment" : "Every renewal"}</td>
                <td className={td}>{p.redeemed}{p.maxRedemptions ? ` of ${p.maxRedemptions}` : ""}</td>
                <td className={td}>{p.expiresAt ? day(p.expiresAt) : "Never"}</td>
                <td className={`${td} max-w-[220px] truncate`}>{p.note || "—"}</td>
                <td className={`${td} text-right`}>
                  <button onClick={() => setActive(p, !p.active)} className={`text-xs font-bold hover:underline cursor-pointer ${p.active ? "text-rose-600" : "text-[#2589BD]"}`}>{p.active ? "Turn off" : "Turn on"}</button>
                </td>
              </tr>
            ))}
            {data && !data.promos.length && <tr><td className={td} colSpan={8}>No promo codes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* -------------------------------- Page -------------------------------- */
export const AdminPage: React.FC = () => {
  const { user, loadingAuth } = useApp();
  const [tab, setTab] = useState<"overview" | "users" | "promos">("overview");
  const [allowed, setAllowed] = useState<null | boolean>(null);
  const [users, setUsers] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [promos, setPromos] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([api("users"), api("revenue", { days: 90 }), api("promos")]);
    if (results[0].status === "fulfilled") setUsers(results[0].value);
    if (results[1].status === "fulfilled") setRevenue(results[1].value);
    if (results[2].status === "fulfilled") setPromos(results[2].value);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (failed) setError(errText(failed.reason));
    setLoading(false);
  }, []);

  useEffect(() => {
    document.title = "Admin · palette";
    if (loadingAuth) return; // the saved sign-in is still being restored
    if (!user) {
      // Signed out means not an admin. This address is only for admins who
      // are already signed in, so send everyone else to the app.
      window.location.replace("/");
      return;
    }
    let cancelled = false;
    api("whoami")
      .then(() => {
        if (cancelled) return;
        setAllowed(true);
        load();
      })
      .catch(() => {
        if (cancelled) return;
        setAllowed(false);
        // Not an admin (for example someone who just signed up here): send
        // them to the app instead of leaving them on a dead end.
        window.location.replace("/");
      });
    return () => {
      cancelled = true;
    };
  }, [user, loadingAuth, load]);

  // Nothing is shown until the server has confirmed an admin sign-in; anyone
  // else is already being redirected to the home page.
  if (!user || !allowed) return <p className="text-center text-sm text-slate-500 py-20">Checking access…</p>;

  const tabs = [
    { id: "overview", label: "Revenue", icon: DollarSign },
    { id: "users", label: "Subscribers", icon: Users },
    { id: "promos", label: "Promo codes", icon: Tag },
  ] as const;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 select-text">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-slate-900">Admin</h1>
        <button onClick={load} disabled={loading} className="h-9 px-3 rounded-md border border-slate-300 bg-white text-xs font-bold uppercase tracking-wider text-slate-700 inline-flex items-center gap-2 cursor-pointer hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-5" role="tablist">
        {tabs.map(({ id, label: text, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-10 px-4 rounded-md border text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer ${tab === id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}>
            <Icon className="w-4 h-4" /> {text}
          </button>
        ))}
      </div>
      {error && <div className="mb-4"><Notice kind="error">Some data could not be loaded: {error}</Notice></div>}
      {tab === "overview" && <Overview users={users} revenue={revenue} reload={load} />}
      {tab === "users" && <UsersTab data={users} reload={load} />}
      {tab === "promos" && <PromosTab data={promos} reload={load} />}
    </div>
  );
};
