import React, { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { getContrastRatio } from "../utils/colorUtils";
import { buildPreviewTheme, PreviewTheme } from "../utils/previewTheme";
import { Globe, LayoutDashboard, FileText, Smartphone, Briefcase, Sun, Moon, RefreshCw, Lock, Activity } from "lucide-react";

/**
 * "In Action": the current palette applied to realistic layouts, live.
 *
 * Every mockup is drawn on an 80 x 50 em stage whose font size follows the
 * stage width, so all inner sizes are in em and the whole thing scales as one
 * piece. Colours come only from the theme built out of the palette's roles.
 */

type TemplateId = "website" | "dashboard" | "admin" | "report" | "mobile" | "brand";

// The website layout is free; the rest come with Pro.
const TEMPLATES: { id: TemplateId; label: string; icon: React.ElementType; pro: boolean }[] = [
  { id: "website", label: "Website", icon: Globe, pro: false },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, pro: true },
  { id: "admin", label: "SaaS admin", icon: Activity, pro: true },
  { id: "report", label: "Report", icon: FileText, pro: true },
  { id: "mobile", label: "Mobile app", icon: Smartphone, pro: true },
  { id: "brand", label: "Brand kit", icon: Briefcase, pro: true },
];

const display = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const row = (extra: React.CSSProperties = {}): React.CSSProperties => ({ display: "flex", alignItems: "center", ...extra });
const col = (extra: React.CSSProperties = {}): React.CSSProperties => ({ display: "flex", flexDirection: "column", ...extra });

interface TProps {
  t: PreviewTheme;
}

/* ------------------------------ Website ------------------------------ */

const Website: React.FC<TProps> = ({ t }) => (
  <div style={col({ height: "100%", background: t.bg, color: t.ink })}>
    <div style={row({ height: "2.6em", padding: "0 1.2em", gap: "0.5em", background: t.surface, borderBottom: `0.08em solid ${t.line}` })}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: "0.75em", height: "0.75em", borderRadius: "50%", background: t.line }} />
      ))}
      <span style={{ marginLeft: "1.2em", flex: 1, maxWidth: "30em", height: "1.4em", borderRadius: "0.7em", background: t.bg, border: `0.08em solid ${t.line}`, fontSize: "0.7em", color: t.muted, display: "flex", alignItems: "center", padding: "0 1em" }}>
        vixxiv.com
      </span>
    </div>

    <div style={row({ height: "4.6em", padding: "0 4em", justifyContent: "space-between" })}>
      <div style={row({ gap: "0.6em" })}>
        <span style={{ width: "1.7em", height: "1.7em", borderRadius: "0.45em", background: t.primary, display: "grid", placeItems: "center" }}>
          <span style={{ width: "0.7em", height: "0.7em", borderRadius: "50%", background: t.onPrimary }} />
        </span>
        <span style={{ fontFamily: display, fontWeight: 700, fontSize: "1.3em" }}>vixxivapps</span>
      </div>
      <div style={row({ gap: "2.2em", fontSize: "0.92em", color: t.muted })}>
        <span>Product</span>
        <span>Pricing</span>
        <span>Stories</span>
        <span style={{ color: t.ink, fontWeight: 600 }}>Sign in</span>
        <span style={{ background: t.primary, color: t.onPrimary, fontWeight: 700, padding: "0.6em 1.2em", borderRadius: "0.5em" }}>Get started</span>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: "2em", padding: "2.2em 4em 0", flex: 1, minHeight: 0 }}>
      <div style={col({ gap: "1.3em" })}>
        <span style={{ alignSelf: "flex-start", background: t.secondary, color: t.onSecondary, fontSize: "0.78em", fontWeight: 700, padding: "0.4em 0.9em", borderRadius: "2em", letterSpacing: "0.04em" }}>
          NEW · AUTUMN RELEASE
        </span>
        <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: "3.5em", lineHeight: 1.04, letterSpacing: "-0.02em", margin: 0 }}>
          Make every color{" "}
          <span style={{ background: t.accent, color: t.onAccent, padding: "0 0.18em", borderRadius: "0.12em", whiteSpace: "nowrap" }}>earn its place</span>
        </h3>
        <p style={{ fontSize: "1.02em", lineHeight: 1.55, color: t.muted, margin: 0, maxWidth: "30em" }}>
          A design system that keeps your brand consistent from the first sketch to the shipped product.
        </p>
        <div style={row({ gap: "0.9em" })}>
          <span style={{ background: t.primary, color: t.onPrimary, fontWeight: 700, padding: "0.8em 1.6em", borderRadius: "0.55em" }}>Start free trial</span>
          <span style={{ border: `0.12em solid ${t.ink}`, color: t.ink, fontWeight: 700, padding: "0.7em 1.5em", borderRadius: "0.55em" }}>Watch demo</span>
        </div>
        <div style={row({ gap: "2.6em", marginTop: "0.4em" })}>
          {[
            ["12k+", "Teams"],
            ["98%", "Renewal"],
            ["4.9", "Rating"],
          ].map(([n, l]) => (
            <div key={l} style={col()}>
              <span style={{ fontFamily: display, fontWeight: 700, fontSize: "1.7em", color: t.ink }}>{n}</span>
              <span style={{ fontSize: "0.78em", color: t.muted }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", height: "26em" }}>
        <div style={{ position: "absolute", right: 0, top: "1em", width: "24em", height: "19em", borderRadius: "1.6em", background: t.primary }} />
        <div style={{ position: "absolute", right: "15em", top: 0, width: "13em", height: "13em", borderRadius: "50%", background: t.accent }} />
        <div style={{ position: "absolute", right: "2.5em", top: "11em", width: "14em", height: "14em", borderRadius: "14em 14em 0 14em", background: t.secondary }} />
        <div style={{ position: "absolute", right: "18.5em", top: "15em", width: "8em", height: "8em", borderRadius: "1.2em", background: t.series[3] }} />
        {t.series[4] && <div style={{ position: "absolute", right: "25em", top: "9.5em", width: "4.6em", height: "4.6em", borderRadius: "50%", background: t.series[4] }} />}
        {t.series[5] && <div style={{ position: "absolute", right: "0.5em", top: "22em", width: "5.5em", height: "3em", borderRadius: "1.5em", background: t.series[5] }} />}
        {t.series[6] && <div style={{ position: "absolute", right: "27.5em", top: "20em", width: "3em", height: "3em", borderRadius: "0.6em", background: t.series[6], transform: "rotate(18deg)" }} />}
        <div style={{ position: "absolute", right: "3em", top: "3em", width: "11em", padding: "1em", borderRadius: "0.9em", background: t.bg, color: t.ink, boxShadow: "0 0.8em 2em rgba(0,0,0,0.18)" }}>
          <div style={{ fontSize: "0.72em", color: t.muted }}>This month</div>
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: "1.6em" }}>+38.2%</div>
          <div style={row({ gap: "0.25em", alignItems: "flex-end", height: "2.6em", marginTop: "0.5em" })}>
            {[40, 62, 48, 80, 66, 100].map((h, i) => (
              <span key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "0.2em", background: i === 5 ? t.accent : t.primary }} />
            ))}
          </div>
        </div>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.4em", padding: "0 4em 2.4em" }}>
      {["Shared libraries", "Live handoff", "Brand guardrails"].map((title, i) => (
        <div key={title} style={col({ gap: "0.5em", padding: "1.1em 1.2em", borderRadius: "0.9em", background: t.surface, border: `0.08em solid ${t.line}` })}>
          <div style={row({ gap: "0.7em" })}>
            <span style={{ width: "1.9em", height: "1.9em", borderRadius: "0.5em", background: t.series[(i + Math.max(0, t.series.length - 3)) % t.series.length] }} />
            <span style={{ fontWeight: 700 }}>{title}</span>
          </div>
          <span style={{ fontSize: "0.82em", lineHeight: 1.45, color: t.muted }}>One source of truth for every team, updated the moment it changes.</span>
        </div>
      ))}
    </div>
  </div>
);

/* ----------------------------- Dashboard ----------------------------- */

const Dashboard: React.FC<TProps> = ({ t }) => {
  const side = t.dark ? t.surface : t.ink;
  const onSide = t.on(side);
  const bars = [52, 61, 47, 70, 66, 78, 59, 84, 73, 92, 81, 96];
  // One segment per chart colour the palette offers, so larger palettes show every colour.
  const plans = ["Team", "Studio", "Solo", "Legacy", "Partner", "Edu", "Trial"].slice(0, Math.min(7, t.series.length));
  const shares = [44, 27, 18, 11, 9, 7, 5].slice(0, plans.length);
  const shareTotal = shares.reduce((a, b) => a + b, 0);
  const donut = shares.map((v) => Math.round((v / shareTotal) * 100));
  donut[0] += 100 - donut.reduce((a, b) => a + b, 0);
  let offset = 0;
  const card: React.CSSProperties = { background: t.surface, border: `0.08em solid ${t.line}`, borderRadius: "0.9em", padding: "1.1em 1.2em" };
  return (
    <div style={row({ height: "100%", alignItems: "stretch", background: t.bg, color: t.ink })}>
      <div style={col({ width: "14em", background: side, color: onSide, padding: "1.6em 1.1em", gap: "0.35em" })}>
        <div style={row({ gap: "0.6em", marginBottom: "1.6em" })}>
          <span style={{ width: "1.7em", height: "1.7em", borderRadius: "0.45em", background: t.primary }} />
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: "1.2em" }}>vixxivapps</span>
        </div>
        {["Overview", "Revenue", "Customers", "Invoices", "Reports", "Settings"].map((item, i) => (
          <div key={item} style={row({ gap: "0.7em", padding: "0.65em 0.8em", borderRadius: "0.5em", fontSize: "0.9em", fontWeight: i === 0 ? 700 : 500, background: i === 0 ? t.primary : "transparent", color: i === 0 ? t.onPrimary : onSide, opacity: i === 0 ? 1 : 0.72 })}>
            <span style={{ width: "0.9em", height: "0.9em", borderRadius: "0.25em", border: `0.14em solid currentColor` }} />
            {item}
          </div>
        ))}
        <div style={{ marginTop: "auto", padding: "0.9em", borderRadius: "0.7em", background: t.accent, color: t.onAccent, fontSize: "0.8em", lineHeight: 1.4 }}>
          <b>Upgrade to Team</b>
          <br />
          Unlimited seats and exports
        </div>
      </div>

      <div style={col({ flex: 1, padding: "1.6em 2em", gap: "1.2em", minWidth: 0 })}>
        <div style={row({ justifyContent: "space-between" })}>
          <div>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: "1.7em" }}>Revenue overview</div>
            <div style={{ fontSize: "0.82em", color: t.muted }}>Fiscal year to date · updated 4 minutes ago</div>
          </div>
          <div style={row({ gap: "0.7em", fontSize: "0.85em" })}>
            <span style={{ padding: "0.55em 1em", borderRadius: "0.5em", border: `0.08em solid ${t.line}`, background: t.surface }}>Last 12 months</span>
            <span style={{ padding: "0.6em 1.1em", borderRadius: "0.5em", background: t.primary, color: t.onPrimary, fontWeight: 700 }}>Export</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1em" }}>
          {[
            ["Net revenue", "$482,900", "+12.4%"],
            ["New customers", "1,284", "+8.1%"],
            ["Avg. order", "$376", "+2.3%"],
            ["Churn", "1.9%", "-0.4%"],
          ].map(([label, value, delta], i) => (
            <div key={label} style={card}>
              <div style={{ fontSize: "0.78em", color: t.muted }}>{label}</div>
              <div style={row({ justifyContent: "space-between", marginTop: "0.3em" })}>
                <span style={{ fontFamily: display, fontWeight: 700, fontSize: "1.55em" }}>{value}</span>
                <span style={{ fontSize: "0.7em", fontWeight: 700, padding: "0.25em 0.6em", borderRadius: "1em", background: i === 3 ? t.accent : t.secondary, color: i === 3 ? t.onAccent : t.onSecondary }}>{delta}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "1em", flex: 1, minHeight: 0 }}>
          <div style={{ ...card, ...col({ gap: "0.8em" }) }}>
            <div style={row({ justifyContent: "space-between" })}>
              <b>Monthly revenue</b>
              <div style={row({ gap: "1em", fontSize: "0.75em", color: t.muted })}>
                <span style={row({ gap: "0.4em" })}><i style={{ width: "0.7em", height: "0.7em", borderRadius: "0.2em", background: t.primary }} />Recurring</span>
                <span style={row({ gap: "0.4em" })}><i style={{ width: "0.7em", height: "0.7em", borderRadius: "0.2em", background: t.secondary }} />One-time</span>
              </div>
            </div>
            <div style={row({ flex: 1, alignItems: "flex-end", gap: "0.7em", minHeight: "9em", borderBottom: `0.08em solid ${t.line}` })}>
              {bars.map((h, i) => (
                <div key={i} style={col({ flex: 1, height: `${h}%`, borderRadius: "0.3em 0.3em 0 0", overflow: "hidden" })}>
                  <div style={{ flex: 0.32, background: i === 9 ? t.accent : t.series.length > 4 && i % 3 === 1 ? t.series[3 + (i % (t.series.length - 3))] : t.secondary }} />
                  <div style={{ flex: 0.68, background: t.primary }} />
                </div>
              ))}
            </div>
            <div style={row({ justifyContent: "space-between", fontSize: "0.68em", color: t.muted })}>
              {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map((m, i) => (
                <span key={i} style={{ flex: 1, textAlign: "center" }}>{m}</span>
              ))}
            </div>
          </div>

          <div style={{ ...card, ...col({ gap: "0.6em", alignItems: "center" }) }}>
            <b style={{ alignSelf: "flex-start" }}>Revenue by plan</b>
            <svg viewBox="0 0 42 42" style={{ width: "9.5em", height: "9.5em" }}>
              {donut.map((v, i) => {
                const el = (
                  <circle key={i} cx="21" cy="21" r="15.915" fill="none" stroke={t.series[i]} strokeWidth="6" strokeDasharray={`${v} ${100 - v}`} strokeDashoffset={25 - offset} />
                );
                offset += v;
                return el;
              })}
              <text x="21" y="20.5" textAnchor="middle" fontSize="5.2" fontWeight="700" fill={t.ink} fontFamily={display}>$482k</text>
              <text x="21" y="25" textAnchor="middle" fontSize="2.6" fill={t.muted}>total</text>
            </svg>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35em 1em", fontSize: "0.75em", width: "100%" }}>
              {plans.map((name, i) => (
                <span key={name} style={row({ gap: "0.45em" })}>
                  <i style={{ width: "0.7em", height: "0.7em", borderRadius: "50%", background: t.series[i] }} />
                  {name}
                  <span style={{ marginLeft: "auto", color: t.muted }}>{donut[i]}%</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ----------------------------- SaaS admin ----------------------------- */

// Coarse dot map of the world: '#' is land. Decorative, not geographic data.
const WORLD = [
  "......###....................#####......",
  "..########..##......####.##########.....",
  ".##########.##.....##################...",
  "..#########........###################..",
  "...#######.........#################....",
  "....#####..........####.###########.....",
  ".....###...........########..####.......",
  "......##.....##.....#######...##........",
  ".......###..####.....#####.....#..#.....",
  "........#######.......####........###...",
  "........######........###.........#####.",
  ".........####.........##..........#####.",
  ".........###...........#...........###..",
  ".........##.............................",
];
// Regions drawn in the highlight colour: [colFrom, colTo, rowFrom, rowTo]
const ACTIVE_REGIONS = [
  [1, 11, 1, 6],
  [19, 24, 1, 5],
  [8, 14, 8, 13],
  [34, 39, 9, 12],
];

const SaasAdmin: React.FC<TProps> = ({ t }) => {
  const side = t.dark ? t.surface : t.ink;
  const onSide = t.on(side);
  const card: React.CSSProperties = { background: t.dark ? t.surface : t.bg, border: `0.08em solid ${t.line}`, borderRadius: "1em", padding: "1em 1.1em" };
  const canvas = t.dark ? t.bg : t.surface;
  const tiles: [string, string, string][] = [
    ["Current MRR", "$12.4k", t.accent],
    ["Current customers", "16,601", t.primary],
    ["Active customers", "33%", t.dark ? t.surface : t.bg],
    ["Churn rate", "2%", t.secondary],
  ];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const trend = [
    [60, 38, 18],
    [80, 50, 19],
    [71, 49, 34],
    [43, 24, 9],
    [78, 69, 37],
    [90, 58, 43],
    [85, 73, 21],
  ];
  const trendFill = [t.line, t.secondary, t.ink];
  const plans: [string, number, string][] = [
    ["Basic", 12, t.ink],
    ["Pro", 26, t.accent],
    ["Advanced", 56, t.primary],
    ["Enterprise", 6, t.line],
  ];
  let offset = 0;
  const rows: [string, string, string, string][] = [
    ["S. Evergreen", "PRO", "+$49", t.line],
    ["B. Sterling", "ADVANCED", "+$99", t.primary],
    ["O. Meadows", "BASIC", "+$19", t.secondary],
    ["I. Whitman", "ENTERPRISE", "+$299", t.ink],
    ["E. Frost", "BASIC", "+$19", t.secondary],
  ];
  const tickets: [string, string, string, string][] = [
    ["jessica.smith@example.com", "Login issue", "OPEN", t.primary],
    ["david.jones@example.com", "Billing inquiry", "PENDING", t.accent],
    ["emily.wilson@example.com", "Product malfunction", "CLOSED", t.ink],
    ["andrew.johnson@example.com", "Feature request", "OPEN", t.primary],
  ];
  const badge = (fill: string): React.CSSProperties => ({ fontSize: "0.55em", fontWeight: 800, letterSpacing: "0.06em", padding: "0.3em 0.6em", borderRadius: "0.35em", background: fill, color: t.on(fill) });
  const dropdown: React.CSSProperties = { fontSize: "0.62em", padding: "0.45em 0.9em", borderRadius: "0.5em", background: t.ink, color: t.bg };
  const title: React.CSSProperties = { fontFamily: display, fontWeight: 700, fontSize: "1.15em" };

  return (
    <div style={row({ height: "100%", alignItems: "stretch", background: canvas, color: t.ink })}>
      <div style={col({ width: "13em", background: side, color: onSide, padding: "1.8em 1.2em 1.4em", gap: "0.2em" })}>
        <div style={col({ alignItems: "center", gap: "0.6em", marginBottom: "1.6em" })}>
          <span style={{ width: "3em", height: "3em", borderRadius: "50%", background: onSide, position: "relative", overflow: "hidden" }}>
            <span style={{ position: "absolute", left: "-0.4em", top: "1.25em", width: "4em", height: "0.5em", background: side, transform: "rotate(-45deg)" }} />
          </span>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: "1.35em" }}>vixxivapps</span>
        </div>
        {["Overview", "Transactions", "Customers", "Reports", "Settings", "Developer"].map((item, i) => (
          <div key={item} style={row({ gap: "0.8em", padding: "0.6em 0.5em", borderRadius: "0.5em", fontSize: "0.86em", fontWeight: i === 0 ? 700 : 500, opacity: i === 0 ? 1 : 0.75, background: i === 0 ? t.primary : "transparent", color: i === 0 ? t.onPrimary : onSide })}>
            <span style={{ width: "0.95em", height: "0.95em", borderRadius: i % 2 ? "50%" : "0.25em", background: "currentColor", opacity: 0.9 }} />
            {item}
          </div>
        ))}
        <div style={row({ gap: "0.8em", marginTop: "auto", padding: "0.6em 0.5em", fontSize: "0.86em", opacity: 0.75 })}>
          <span style={{ width: "0.95em", height: "0.95em", borderRadius: "0.25em", border: "0.14em solid currentColor" }} />
          Log out
        </div>
      </div>

      <div style={col({ flex: 1, minWidth: 0 })}>
        <div style={row({ justifyContent: "space-between", padding: "0.9em 1.6em", background: t.dark ? t.surface : t.bg, borderBottom: `0.08em solid ${t.line}` })}>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: "1.6em" }}>Dashboard</span>
          <div style={row({ gap: "1em" })}>
            <span style={{ width: "27em", whiteSpace: "nowrap", overflow: "hidden", fontSize: "0.72em", padding: "0.7em 1.2em", borderRadius: "2em", background: t.ink, color: t.bg, opacity: 0.95 }}>Search transactions, customers, subscriptions</span>
            <span style={{ width: "2em", height: "2em", borderRadius: "50%", background: t.secondary }} />
          </div>
        </div>

        <div style={col({ flex: 1, minHeight: 0, padding: "1em 1.4em 1.2em", gap: "0.9em" })}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.9em" }}>
            {tiles.map(([label, value, fill]) => (
              <div key={label} style={{ background: fill, color: t.on(fill), borderRadius: "1em", padding: "0.9em 1.1em", border: `0.08em solid ${t.line}` }}>
                <div style={{ fontSize: "0.78em", fontWeight: 600 }}>{label}</div>
                <div style={{ fontFamily: display, fontWeight: 500, fontSize: "2em", lineHeight: 1.15, marginTop: "0.15em" }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2.05fr 1fr 1fr", gap: "0.9em", flex: 1.25, minHeight: 0 }}>
            <div style={{ ...card, ...col({ gap: "0.5em" }) }}>
              <div style={row({ justifyContent: "space-between" })}>
                <span style={title}>Trend</span>
                <div style={row({ gap: "0.9em", fontSize: "0.6em", fontWeight: 700, letterSpacing: "0.04em" })}>
                  {["NEW", "RENEWALS", "CHURNS"].map((k, i) => (
                    <span key={k} style={row({ gap: "0.4em" })}>
                      <i style={{ width: "0.8em", height: "0.8em", borderRadius: "50%", background: trendFill[i], border: `0.08em solid ${t.line}` }} />
                      {k}
                    </span>
                  ))}
                  <span style={dropdown}>This year</span>
                </div>
              </div>
              <div style={row({ flex: 1, alignItems: "stretch", gap: "0.6em", minHeight: 0 })}>
                <div style={col({ justifyContent: "space-between", fontSize: "0.6em", color: t.muted, paddingBottom: "1.6em" })}>
                  {["$15k", "$10k", "$5k", "$0"].map((v) => (
                    <span key={v}>{v}</span>
                  ))}
                </div>
                <div style={col({ flex: 1 })}>
                  <div style={row({ flex: 1, alignItems: "flex-end", justifyContent: "space-around", borderBottom: `0.08em solid ${t.line}`, borderTop: `0.08em solid ${t.line}` })}>
                    {trend.map((group, g) => (
                      <div key={g} style={row({ alignItems: "flex-end", gap: "0.12em", height: "100%" })}>
                        {group.map((h, i) => (
                          <span key={i} style={{ width: "0.85em", height: `${h}%`, background: trendFill[i] }} />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div style={row({ justifyContent: "space-around", fontSize: "0.62em", color: t.muted, paddingTop: "0.5em" })}>
                    {months.map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ ...card, ...col({ gap: "0.4em", alignItems: "center" }) }}>
              <div style={row({ justifyContent: "space-between", width: "100%" })}>
                <span style={title}>Sales</span>
                <span style={dropdown}>This year</span>
              </div>
              <svg viewBox="0 0 42 42" style={{ width: "8.2em", height: "8.2em" }}>
                {plans.map(([name, v, fill]) => {
                  const el = <circle key={name} cx="21" cy="21" r="15.915" fill="none" stroke={fill} strokeWidth="6.5" strokeDasharray={`${v} ${100 - v}`} strokeDashoffset={25 - offset} />;
                  offset += v;
                  return el;
                })}
                <text x="21" y="21" textAnchor="middle" fontSize="6" fontWeight="700" fill={t.ink} fontFamily={display}>342</text>
                <text x="21" y="25.5" textAnchor="middle" fontSize="2.4" fill={t.muted}>SALES</text>
              </svg>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3em 0.6em", fontSize: "0.56em", fontWeight: 700, letterSpacing: "0.04em", width: "100%" }}>
                {plans.map(([name, , fill]) => (
                  <span key={name} style={row({ gap: "0.45em" })}>
                    <i style={{ width: "0.9em", height: "0.9em", borderRadius: "50%", background: fill, border: `0.08em solid ${t.line}` }} />
                    {name.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ ...card, ...col({ gap: "0.3em" }) }}>
              <span style={title}>Transactions</span>
              <div style={col({ flex: 1, justifyContent: "space-around" })}>
                {rows.map(([name, plan, amount, fill], i) => (
                  <div key={i} style={row({ gap: "0.5em", fontSize: "0.7em", padding: "0.3em 0", borderBottom: `0.08em solid ${t.line}` })}>
                    <b>{name}</b>
                    <span style={{ ...badge(fill), fontSize: "0.72em", marginLeft: "auto" }}>{plan}</span>
                    <span style={{ color: t.muted, width: "3em", textAlign: "right" }}>{amount}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center", fontSize: "0.78em", fontWeight: 600, padding: "0.65em", borderRadius: "0.6em", background: t.accent, color: t.onAccent }}>View all transactions</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9em", flex: 1, minHeight: 0 }}>
            <div style={{ ...card, ...col({ gap: "0.5em" }) }}>
              <div style={row({ justifyContent: "space-between" })}>
                <span style={title}>Support tickets</span>
                <span style={dropdown}>This week</span>
              </div>
              <div style={row({ gap: "0.5em", fontSize: "0.68em" })}>
                {(
                  [
                    ["All", t.line, true],
                    ["Open", t.primary, false],
                    ["Pending", t.accent, false],
                    ["Closed", t.ink, false],
                  ] as [string, string, boolean][]
                ).map(([label, ring, filled]) => (
                  <span key={label} style={{ padding: "0.3em 0.95em", borderRadius: "2em", border: `0.16em solid ${ring}`, background: filled ? ring : "transparent" }}>{label}</span>
                ))}
              </div>
              <div style={col({ flex: 1, justifyContent: "space-around" })}>
                {tickets.map(([email, topic, status, fill], i) => (
                  <div key={i} style={row({ gap: "0.7em", fontSize: "0.68em", padding: "0.28em 0", borderBottom: i < tickets.length - 1 ? `0.08em solid ${t.line}` : "none" })}>
                    <i style={{ width: "1.1em", height: "1.1em", borderRadius: "50%", background: i === 0 ? t.secondary : t.line }} />
                    <span style={{ flex: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
                    <b style={{ flex: 1 }}>{topic}</b>
                    <span style={{ ...badge(fill), fontSize: "0.78em" }}>{status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...card, ...col({ gap: "0.5em" }) }}>
              <div style={row({ justifyContent: "space-between" })}>
                <span style={title}>Customer regions</span>
                <div style={row({ gap: "0.9em", fontSize: "0.6em", fontWeight: 700, letterSpacing: "0.04em" })}>
                  <span style={row({ gap: "0.4em" })}><i style={{ width: "0.8em", height: "0.8em", borderRadius: "50%", background: t.secondary }} />ACTIVE</span>
                  <span style={row({ gap: "0.4em" })}><i style={{ width: "0.8em", height: "0.8em", borderRadius: "50%", background: t.line }} />INACTIVE</span>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
              <svg viewBox="0 0 40 14" preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                {WORLD.flatMap((line, y) =>
                  line.split("").map((ch, x) => {
                    if (ch !== "#") return null;
                    const active = ACTIVE_REGIONS.some(([x0, x1, y0, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
                    return <circle key={`${x}-${y}`} cx={x + 0.5} cy={y + 0.5} r="0.36" fill={active ? t.secondary : t.line} />;
                  })
                )}
              </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ Report ------------------------------- */

const Report: React.FC<TProps> = ({ t }) => {
  const page: React.CSSProperties = { width: "30em", height: "42.5em", borderRadius: "0.3em", boxShadow: "0 1em 2.6em rgba(0,0,0,0.22)", overflow: "hidden", position: "relative" };
  return (
    <div style={row({ height: "100%", justifyContent: "center", gap: "3em", background: t.surface, color: t.ink })}>
      <div style={{ ...page, background: t.primary, color: t.onPrimary, padding: "3em 2.6em" }}>
        <div style={{ position: "absolute", right: "-6em", bottom: "-6em", width: "24em", height: "24em", borderRadius: "50%", background: t.secondary }} />
        <div style={{ position: "absolute", right: "7em", bottom: "9em", width: "9em", height: "9em", borderRadius: "50%", background: t.accent }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: "0.8em", fontWeight: 700, letterSpacing: "0.18em" }}>vixxivapps foundation</div>
          <div style={{ width: "4em", height: "0.4em", background: t.accent, margin: "1.4em 0" }} />
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: "3.6em", lineHeight: 1.02, letterSpacing: "-0.02em" }}>
            Annual
            <br />
            Impact
            <br />
            Report
          </div>
          <div style={{ fontSize: "1.1em", marginTop: "1em", opacity: 0.85 }}>Fiscal year 2026</div>
        </div>
      </div>

      <div style={{ ...page, background: t.bg, padding: "2.6em 2.4em", ...col({ gap: "1.1em" }) }}>
        <div style={row({ justifyContent: "space-between", fontSize: "0.68em", color: t.muted, letterSpacing: "0.12em" })}>
          <span>02 · YEAR IN REVIEW</span>
          <span>vixxivapps</span>
        </div>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: "2em", lineHeight: 1.1 }}>
          Growth that reached <span style={{ color: t.dark ? t.ink : t.primary, textDecoration: `underline ${t.accent}`, textDecorationThickness: "0.14em", textUnderlineOffset: "0.14em" }}>more people</span>
        </div>
        <p style={{ fontSize: "0.82em", lineHeight: 1.6, color: t.muted, margin: 0 }}>
          Programs expanded into nine new regions this year. Funding grew by a third, and four in five participants completed the full course.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.8em" }}>
          {[
            ["31%", "Funding growth", t.primary],
            ["9", "New regions", t.secondary],
            ["82%", "Completion", t.accent],
          ].map(([n, l, c]) => (
            <div key={l} style={{ padding: "0.8em", borderRadius: "0.6em", background: c, color: t.on(c) }}>
              <div style={{ fontFamily: display, fontWeight: 700, fontSize: "1.7em" }}>{n}</div>
              <div style={{ fontSize: "0.68em" }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ borderLeft: `0.3em solid ${t.accent}`, padding: "0.3em 0 0.3em 1em", fontFamily: display, fontSize: "1.02em", lineHeight: 1.35 }}>
          “The program gave our team a shared language for the first time.”
          <div style={{ fontFamily: "inherit", fontSize: "0.7em", color: t.muted, marginTop: "0.4em" }}>Regional lead, Lagos</div>
        </div>
        <div style={col({ gap: "0.55em", marginTop: "auto" })}>
          <b style={{ fontSize: "0.82em" }}>Participants by program</b>
          {(
            [
              ["Foundations", 92],
              ["Mentorship", 71],
              ["Field labs", 54],
              ["Fellowships", 33],
              ["Residencies", 24],
              ["Open days", 17],
            ] as [string, number][]
          )
            .slice(0, Math.max(4, Math.min(6, t.series.length)))
            .map(([name, v], i) => (
            <div key={name as string} style={row({ gap: "0.8em", fontSize: "0.72em" })}>
              <span style={{ width: "6.5em", color: t.muted }}>{name}</span>
              <span style={{ flex: 1, height: "0.9em", borderRadius: "0.45em", background: t.surface, overflow: "hidden" }}>
                <span style={{ display: "block", width: `${v}%`, height: "100%", borderRadius: "0.45em", background: t.series[i % t.series.length] }} />
              </span>
              <span style={{ width: "2.2em", textAlign: "right", fontWeight: 700 }}>{v}k</span>
            </div>
            ))}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ Mobile ------------------------------- */

const Phone: React.FC<{ t: PreviewTheme; children: React.ReactNode }> = ({ t, children }) => (
  <div style={{ width: "19.5em", height: "41em", borderRadius: "2.6em", padding: "0.5em", background: t.dark ? t.line : t.ink, boxShadow: "0 1.2em 3em rgba(0,0,0,0.28)" }}>
    <div style={col({ height: "100%", borderRadius: "2.15em", overflow: "hidden", background: t.bg, color: t.ink, position: "relative" })}>
      <div style={row({ justifyContent: "space-between", padding: "0.9em 1.6em 0.3em", fontSize: "0.7em", fontWeight: 700 })}>
        <span>9:41</span>
        <span style={{ width: "5em", height: "1.3em", borderRadius: "1em", background: t.ink }} />
        <span>5G</span>
      </div>
      {children}
    </div>
  </div>
);

const Mobile: React.FC<TProps> = ({ t }) => (
  <div style={row({ height: "100%", justifyContent: "center", gap: "4em", background: t.surface })}>
    <Phone t={t}>
      <div style={{ padding: "0.8em 1.3em 0" }}>
        <div style={{ fontSize: "0.78em", color: t.muted }}>Good morning</div>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: "1.5em" }}>Chili Vanilli</div>
      </div>
      <div style={{ margin: "1em 1.3em 0", padding: "1.2em", borderRadius: "1.2em", background: t.primary, color: t.onPrimary, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "-2em", top: "-2em", width: "7em", height: "7em", borderRadius: "50%", background: t.secondary, opacity: 0.9 }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: "0.72em", opacity: 0.85 }}>Total balance</div>
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: "2em" }}>$12,480.50</div>
          <span style={{ display: "inline-block", marginTop: "0.5em", fontSize: "0.68em", fontWeight: 700, padding: "0.3em 0.7em", borderRadius: "1em", background: t.accent, color: t.onAccent }}>+4.2% this week</span>
        </div>
      </div>
      <div style={row({ justifyContent: "space-between", padding: "1.1em 1.6em 0" })}>
        {["Send", "Request", "Top up", "More"].map((a, i) => (
          <div key={a} style={col({ alignItems: "center", gap: "0.35em", fontSize: "0.66em", color: t.muted })}>
            <span style={{ width: "3.6em", height: "3.6em", borderRadius: "50%", background: i === 0 ? t.accent : t.surface, border: `0.1em solid ${t.line}` }} />
            {a}
          </div>
        ))}
      </div>
      <div style={{ padding: "1.1em 1.3em 0", fontWeight: 700, fontSize: "0.9em" }}>Recent activity</div>
      <div style={col({ padding: "0.5em 1.3em", gap: "0.55em" })}>
        {[
          ["Studio rent", "-$1,200.00"],
          ["Client payment", "+$3,450.00"],
          ["Print supplies", "-$86.40"],
        ].map(([name, amount], i) => (
          <div key={name} style={row({ gap: "0.7em", padding: "0.65em 0.75em", borderRadius: "0.8em", background: t.surface })}>
            <span style={{ width: "2em", height: "2em", borderRadius: "0.6em", background: t.series[i] }} />
            <span style={{ fontSize: "0.8em", fontWeight: 600 }}>{name}</span>
            <span style={{ marginLeft: "auto", fontSize: "0.8em", fontWeight: 700, color: t.ink }}>{amount}</span>
          </div>
        ))}
      </div>
      <div style={row({ marginTop: "auto", justifyContent: "space-around", padding: "0.8em 1em 1.1em", borderTop: `0.08em solid ${t.line}`, background: t.bg })}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ width: i === 0 ? "2.6em" : "1.3em", height: "1.3em", borderRadius: "0.7em", background: i === 0 ? t.primary : t.line }} />
        ))}
      </div>
    </Phone>

    <Phone t={t}>
      <div style={{ margin: "0.6em 0.8em 0", height: "13em", borderRadius: "1.5em", background: t.secondary, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "-2em", bottom: "-3em", width: "11em", height: "11em", borderRadius: "50%", background: t.primary }} />
        <div style={{ position: "absolute", right: "1.5em", top: "1.5em", width: "6em", height: "6em", borderRadius: "1.2em", background: t.accent, transform: "rotate(14deg)" }} />
        <div style={{ position: "absolute", right: "5em", bottom: "1.2em", width: "4em", height: "4em", borderRadius: "50%", background: t.series[3] }} />
      </div>
      <div style={col({ padding: "1.1em 1.4em 0", gap: "0.6em" })}>
        <div style={row({ gap: "0.4em" })}>
          {["Workshop", "4 weeks"].map((chip, i) => (
            <span key={chip} style={{ fontSize: "0.66em", fontWeight: 700, padding: "0.3em 0.75em", borderRadius: "1em", background: i === 0 ? t.accent : t.surface, color: i === 0 ? t.onAccent : t.ink, border: i === 0 ? "none" : `0.1em solid ${t.line}` }}>{chip}</span>
          ))}
        </div>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: "1.55em", lineHeight: 1.1 }}>Color systems for product teams</div>
        <div style={{ fontSize: "0.78em", lineHeight: 1.5, color: t.muted }}>Build a palette that holds up across marketing, product and print, with roles your whole team can follow.</div>
        <div style={row({ gap: "0.6em", marginTop: "0.2em" })}>
          {t.series.slice(0, 5).map((c, i) => (
            <span key={i} style={{ width: "2.2em", height: "2.2em", borderRadius: "50%", background: c, border: `0.18em solid ${t.bg}`, marginLeft: i ? "-1em" : 0 }} />
          ))}
          <span style={{ fontSize: "0.72em", color: t.muted }}>214 enrolled</span>
        </div>
      </div>
      <div style={{ marginTop: "auto", padding: "0 1.4em 1.5em" }}>
        <div style={{ textAlign: "center", padding: "0.95em", borderRadius: "0.9em", background: t.primary, color: t.onPrimary, fontWeight: 700 }}>Enroll now · $149</div>
      </div>
    </Phone>
  </div>
);

/* ------------------------------- Brand ------------------------------- */

const Brand: React.FC<TProps> = ({ t }) => {
  const poster = t.dark ? t.surface : t.ink;
  const onPoster = t.on(poster);
  const shadow = "0 1em 2.4em rgba(0,0,0,0.22)";
  return (
    <div style={row({ height: "100%", justifyContent: "center", gap: "3.2em", background: t.surface, color: t.ink })}>
      <div style={col({ gap: "1.8em" })}>
        <div style={{ width: "27em", height: "15.5em", borderRadius: "0.8em", background: t.primary, color: t.onPrimary, boxShadow: shadow, padding: "1.8em", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: "-3em", bottom: "-5em", width: "15em", height: "15em", borderRadius: "50%", background: t.secondary }} />
          <div style={{ position: "absolute", right: "6.5em", bottom: "3em", width: "5em", height: "5em", borderRadius: "50%", background: t.accent }} />
          <div style={row({ gap: "0.7em", position: "relative" })}>
            <span style={{ width: "2.6em", height: "2.6em", borderRadius: "0.7em", background: t.onPrimary, display: "grid", placeItems: "center" }}>
              <span style={{ width: "1.1em", height: "1.1em", borderRadius: "50%", background: t.primary }} />
            </span>
            <span style={{ fontFamily: display, fontWeight: 700, fontSize: "1.9em" }}>vixxivapps</span>
          </div>
          <div style={{ position: "absolute", left: "1.8em", bottom: "1.6em", fontSize: "0.8em", letterSpacing: "0.14em", fontWeight: 600 }}>DESIGN STUDIO</div>
        </div>

        <div style={{ width: "27em", height: "15.5em", borderRadius: "0.8em", background: t.bg, boxShadow: shadow, padding: "1.8em", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "0.9em", background: t.accent }} />
          <div style={{ paddingLeft: "1em" }}>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: "1.6em" }}>Chili Vanilli</div>
            <div style={{ fontSize: "0.82em", fontWeight: 700, color: t.dark ? t.ink : t.primary, letterSpacing: "0.1em", marginTop: "0.2em" }}>ART DIRECTOR</div>
            <div style={{ width: "3em", height: "0.25em", background: t.secondary, margin: "1.3em 0" }} />
            <div style={{ fontSize: "0.82em", lineHeight: 1.7, color: t.muted }}>
              +1 (512) 555 0142
              <br />
              hello@vixxiv.com
              <br />
              vixxiv.com
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: "24em", height: "33em", borderRadius: "0.4em", background: poster, color: onPoster, boxShadow: shadow, padding: "2em", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "-4em", top: "8em", width: "17em", height: "17em", borderRadius: "50%", background: t.primary }} />
        <div style={{ position: "absolute", left: "2em", top: "14em", width: "10em", height: "10em", borderRadius: "10em 10em 0 10em", background: t.accent }} />
        <div style={{ position: "absolute", right: "3em", top: "19em", width: "7em", height: "7em", background: t.secondary, borderRadius: "1em" }} />
        <div style={{ position: "relative", fontFamily: display, fontWeight: 700, fontSize: "3.4em", lineHeight: 0.98, letterSpacing: "-0.02em" }}>
          Color
          <br />
          that
          <br />
          works.
        </div>
        <div style={row({ position: "absolute", left: "2em", right: "2em", bottom: "1.8em", justifyContent: "space-between", fontSize: "0.72em", letterSpacing: "0.14em", fontWeight: 600 })}>
          <span>OPEN STUDIO</span>
          <span>14 · 11 · 2026</span>
        </div>
      </div>

      <div style={col({ gap: "1.6em", alignItems: "center" })}>
        <div style={{ width: "8.5em", height: "8.5em", borderRadius: "2em", background: t.primary, boxShadow: shadow, display: "grid", placeItems: "center" }}>
          <span style={{ width: "4em", height: "4em", borderRadius: "50%", border: `0.9em solid ${t.onPrimary}` }} />
        </div>
        <div style={{ width: "8.5em", height: "8.5em", borderRadius: "50%", background: t.accent, color: t.onAccent, boxShadow: shadow, display: "grid", placeItems: "center", textAlign: "center", fontFamily: display, fontWeight: 700, fontSize: "1em", lineHeight: 1.1 }}>
          EST.
          <br />
          2026
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 2.8em)", boxShadow: shadow, borderRadius: "0.6em", overflow: "hidden" }}>
          {Array.from({ length: 9 }).map((_, i) => {
            const fill = t.series[i % t.series.length];
            return (
              <span key={i} style={{ width: "2.8em", height: "2.8em", background: i % 2 ? t.bg : fill, display: "grid", placeItems: "center" }}>
                <span style={{ width: "1.4em", height: "1.4em", borderRadius: i % 3 === 0 ? "50%" : "0.3em", background: i % 2 ? fill : t.bg }} />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const RENDER: Record<TemplateId, React.FC<TProps>> = {
  website: Website,
  dashboard: Dashboard,
  admin: SaasAdmin,
  report: Report,
  mobile: Mobile,
  brand: Brand,
};

/* ------------------------------ Section ------------------------------ */

const grade = (ratio: number) => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "Large text only" : "Too low");

export const PaletteVisualizer: React.FC = () => {
  const { currentColors, spinPalette, userSubscription, setShowUpgradeModal, showToast } = useApp();
  const isPro = userSubscription.tier !== "free";
  const [chosen, setTemplate] = useState<TemplateId>("website");
  // If Pro lapses while a Pro layout is open, fall back to the free one.
  const template: TemplateId = isPro || !TEMPLATES.find((x) => x.id === chosen)?.pro ? chosen : "website";

  const pickTemplate = (id: TemplateId, pro: boolean) => {
    if (pro && !isPro) {
      showToast("That layout comes with Pro. The Website layout is free.", "info");
      setShowUpgradeModal(true);
      return;
    }
    setTemplate(id);
  };
  const [dark, setDark] = useState(false);

  const theme = useMemo(() => buildPreviewTheme(currentColors, dark), [currentColors, dark]);
  const Active = RENDER[template];

  const checks = [
    { label: "Body text on page", pair: [theme.ink, theme.bg] },
    { label: "Primary button label", pair: [theme.onPrimary, theme.primary] },
    { label: "Accent label", pair: [theme.onAccent, theme.accent] },
  ].map((c) => ({ ...c, ratio: getContrastRatio(c.pair[0], c.pair[1]) }));

  const tabClass = (active: boolean) =>
    `py-2 px-3 font-bold uppercase tracking-wider text-[11px] transition-all flex items-center justify-center gap-2 cursor-pointer rounded border ${
      active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
    }`;

  return (
    <section className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-5" id="visualize">
      <div className="border-l-4 pl-4 space-y-1" style={{ borderLeftColor: "#d1c69e" }}>
        <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-slate-800">See It In Action</h2>
        <p className="text-xs sm:text-sm text-slate-500 font-sans">
          Your palette applied to real layouts, with each color doing the job of its role. It updates live as you spin, lock and edit.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 w-full sm:w-auto sm:flex sm:flex-wrap gap-2" role="tablist" aria-label="Preview layout">
          {TEMPLATES.map(({ id, label, icon: Icon, pro }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={template === id}
              onClick={() => pickTemplate(id, pro)}
              title={pro && !isPro ? `${label} layout: Pro` : `${label} layout`}
              className={tabClass(template === id)}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              {pro && !isPro && <Lock className="w-3 h-3 opacity-60" />}
            </button>
          ))}
        </div>

        <div className="flex items-stretch gap-2 w-full sm:w-auto">
          <div role="group" aria-label="Preview theme" className="flex items-center bg-white border border-slate-200 rounded shadow-3xs overflow-hidden">
            <button type="button" onClick={() => setDark(false)} aria-pressed={!dark} title="Preview as a light theme" className={`py-2 px-3 font-bold uppercase tracking-wider text-[11px] transition-all flex items-center gap-2 cursor-pointer ${!dark ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <Sun className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Light theme</span>
            </button>
            <button type="button" onClick={() => setDark(true)} aria-pressed={dark} title="Preview as a dark theme" className={`py-2 px-3 font-bold uppercase tracking-wider text-[11px] transition-all flex items-center gap-2 cursor-pointer ${dark ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <Moon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dark theme</span>
            </button>
          </div>
          <button type="button" onClick={spinPalette} title="Spin the unlocked colors" className="flex-1 sm:flex-initial py-2.5 sm:py-2 px-3 font-bold uppercase tracking-wider text-[11px] text-white rounded flex items-center justify-center gap-2 cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all touch-manipulation" style={{ backgroundColor: "#059669" }}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Spin</span>
          </button>
        </div>
      </div>

      {/* Stage: 80em x 50em, scaled by its own width */}
      <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white" style={{ containerType: "inline-size" } as React.CSSProperties}>
        <div style={{ fontSize: "1.25cqw", width: "80em", height: "50em", lineHeight: 1.3, fontFamily: "ui-sans-serif, system-ui, sans-serif", overflow: "hidden" }} aria-label={`${template} preview using the current palette`}>
          <Active t={theme} />
        </div>
      </div>

      {/* Where every colour in the palette is being used */}
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <p className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mb-2">
          How your {currentColors.length} colors are used
        </p>
        <div className="flex flex-wrap gap-2">
          {theme.usage.map((u, i) => (
            <span key={`${u.hex}-${i}`} className="flex items-center gap-2 border border-slate-200 rounded-md pl-1 pr-2.5 py-1">
              <span className="w-5 h-5 rounded border border-black/10 shrink-0" style={{ backgroundColor: u.hex }} />
              <span className="text-[11px] font-mono font-bold text-slate-700 uppercase">{u.hex}</span>
              <span className="text-[11px] font-sans text-slate-500">{u.job}</span>
            </span>
          ))}
        </div>

        {theme.derived.length > 0 && (
          <div className="mt-3 pt-3 border-t border-dashed border-slate-300">
            <p className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Added by the preview (not in your palette)
            </p>
            {theme.derivedWhy.map((why) => (
              <p key={why} className="text-xs font-sans text-slate-600 mb-2 max-w-4xl">{why}</p>
            ))}
            <div className="flex flex-wrap gap-2">
              {theme.derived.map((d, i) => (
                <span key={`derived-${d.hex}-${i}`} className="flex items-center gap-2 border border-dashed border-slate-300 rounded-md pl-1 pr-2.5 py-1">
                  <span className="w-5 h-5 rounded border border-black/10 shrink-0" style={{ backgroundColor: d.hex }} />
                  <span className="text-[11px] font-mono font-bold text-slate-700 uppercase">{d.hex}</span>
                  <span className="text-[11px] font-sans text-slate-500">{d.job}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="text-[11px] font-sans text-slate-500 mt-3">
          The soft grays used for card backgrounds, secondary text and borders are blended from your background and text colors.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-3">
            <span className="w-10 h-10 rounded-md shrink-0 grid place-items-center text-sm font-black border border-black/10" style={{ backgroundColor: c.pair[1], color: c.pair[0] }}>
              Aa
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest truncate">{c.label}</p>
              <p className="text-sm font-mono font-bold text-slate-800">
                {c.ratio.toFixed(2)}:1{" "}
                <span className={`text-[10px] font-sans uppercase tracking-wider ${c.ratio >= 4.5 ? "text-emerald-600" : c.ratio >= 3 ? "text-amber-600" : "text-rose-600"}`}>{grade(c.ratio)}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
