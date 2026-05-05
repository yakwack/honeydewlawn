import { useState, useEffect, useCallback } from "react";
import {
  signInWithEmail, signOut,
  fetchLawnSignup, saveLawnSignup,
  fetchVisits, fetchAllVisits, upsertVisit, updateVisitStatus, deleteVisit,
  saveContactMessage, fetchContactMessages,
  fetchAllSignups, updateSignup,
  fetchMySchedules, fetchAllSchedules, upsertSchedule, deleteSchedule,
} from "./supabase.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const LOT_OPTIONS = [
  { value: "small",  label: "Up to 1/4 acre",  priceVisit: 45,  priceMonth: 140 },
  { value: "medium", label: "1/4 – 1/2 acre",  priceVisit: 65,  priceMonth: 210 },
  { value: "large",  label: "1/2 – 1 acre",    priceVisit: 90,  priceMonth: 290 },
  { value: "xlarge", label: "1 – 2 acres",      priceVisit: 140, priceMonth: 450 },
  { value: "custom", label: "2+ acres",          priceVisit: null, priceMonth: null },
];
const getLot = (v) => LOT_OPTIONS.find(l => l.value === v) ?? LOT_OPTIONS[0];

const PAYMENT_OPTIONS = [
  { value: "venmo",   label: "Venmo",           desc: "Pay after each visit or monthly" },
  { value: "cash",    label: "Cash / Check",    desc: "Leave it in the mailbox, we'll grab it" },
  { value: "invoice", label: "Monthly Invoice", desc: "We bill on the 1st, due by the 5th" },
];

const SERVICE_OPTIONS = [
  { id: "lawn",    name: "Full Lawn Service", priceNote: "Priced by lot size", desc: "Mow, edge, trim, and haul. We don't cut corners — we edge 'em." },
  { id: "flowers", name: "Bucket O' Flowers", priceNote: "$25/mo add-on",     desc: "Fresh seasonal flowers, in and out every month. Always something new." },
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const STATUS_STYLE = {
  scheduled: { bg: "rgba(46,90,24,0.1)",  color: "var(--grass)" },
  completed: { bg: "rgba(46,90,24,0.15)", color: "var(--grass-dark)" },
  cancelled: { bg: "rgba(150,32,32,0.1)", color: "var(--danger)" },
  pending:   { bg: "rgba(154,120,24,0.1)",color: "var(--gold)" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function generateInvoice(signup, visits) {
  const total = visits.reduce((a, v) => a + (v.cost ?? 0), 0);
  const payLabel = PAYMENT_OPTIONS.find(p => p.value === signup.payment_method)?.label ?? "—";
  const lines = [
    "HONEYDEW LAWN SERVICES",
    "Invoice",
    "─────────────────────────────────────",
    "",
    `Invoice Date:  ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    `Invoice #:     HD-${String(Date.now()).slice(-6)}`,
    "",
    "Bill To:",
    `  ${signup.first_name} ${signup.last_name}`,
    `  ${signup.address}`,
    signup.email ? `  ${signup.email}` : "",
    "",
    "─────────────────────────────────────",
    "  Date           Service        Amount",
    "─────────────────────────────────────",
    ...visits.map(v =>
      `  ${fmtDate(v.visit_date).padEnd(15)}${v.service_type.toUpperCase().padEnd(15)}$${(v.cost ?? 0).toFixed(2)}`
    ),
    "─────────────────────────────────────",
    `  TOTAL DUE:                    $${total.toFixed(2)}`,
    "",
    `  Payment Method: ${payLabel}`,
    "",
    "─────────────────────────────────────",
    "  Thank you for your business.",
    "  We'll see you on the next one.",
    "",
    "  HoneyDew Lawn Services",
  ];
  return lines.filter(l => l !== null).join("\n");
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  Check:    (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,6.5 4.5,9.5 10.5,2.5"/></svg>,
  Arrow:    (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="6" x2="10" y2="6"/><polyline points="7,3 10,6 7,9"/></svg>,
  Calendar: (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="2" width="10" height="9" rx="1"/><line x1="1" y1="5" x2="11" y2="5"/><line x1="4" y1="1" x2="4" y2="3"/><line x1="8" y1="1" x2="8" y2="3"/></svg>,
  Wrench:   (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 1a3 3 0 0 0-2.5 4.7L2 9.5a1.4 1.4 0 1 0 2 2l4-4.3A3 3 0 1 0 8.5 1z"/></svg>,
  User:     (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="4" r="2.5"/><path d="M1 11c0-2.8 2.2-5 5-5s5 2.2 5 5"/></svg>,
  Mail:     (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2.5" width="10" height="7" rx="1"/><polyline points="1,3 6,7.5 11,3"/></svg>,
  Dollar:   (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><path d="M4 3.5C4 2.7 4.9 2 6 2s2 .7 2 1.5S7 5 6 5.5 4 6.8 4 8s1 2 2 2 2-.5 2-1.5"/></svg>,
  Clock:    (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="6" r="5"/><polyline points="6,3 6,6.5 8.5,8"/></svg>,
  X:        (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>,
  Plus:     (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="2" x2="6" y2="10"/><line x1="2" y1="6" x2="10" y2="6"/></svg>,
  Leaf:     (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 10C2 10 3 4 10 2c0 0-1 6-8 8z"/><line x1="2" y1="10" x2="6" y2="6"/></svg>,
  Send:     (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="11" y1="1" x2="5" y2="7"/><path d="M11 1L7.5 11 5 7 1 4.5z"/></svg>,
  File:     (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5z"/><polyline points="7,1 7,5 11,5"/></svg>,
  Clip:     (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="1" width="6" height="10" rx="1"/><line x1="5" y1="4" x2="7" y2="4"/><line x1="5" y1="6" x2="7" y2="6"/><line x1="5" y1="8" x2="7" y2="8"/></svg>,
  Phone:    (p) => <svg width={p.s??13} height={p.s??13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 1h3l1.5 3.5-1.5 1.5a7 7 0 0 0 1.5 1.5 7 7 0 0 0 1.5 1.5L9.5 8 13 9.5V12a1 1 0 0 1-1 1A10 10 0 0 1 1 2a1 1 0 0 1 1-1z"/></svg>,
  Mower:    (p) => <svg width={p.s??16} height={p.s??14} viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="4" width="8" height="5" rx="1"/><path d="M11 4L14 6v3H2"/><circle cx="4.5" cy="11.5" r="2"/><circle cx="11.5" cy="11.5" r="2"/><line x1="7" y1="4" x2="7" y2="1"/><line x1="5" y1="1" x2="9" y2="1"/></svg>,
};

// ─── Global Styles ────────────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #f0e8d0;
      --card: #faf6ee;
      --parchment: #e6dcc6;
      --border: #c0a87c;
      --bark: #180c02;
      --forest: #1c3a10;
      --grass: #2e5a18;
      --grass-dark: #1e3d0c;
      --grass-light: #4a7d2a;
      --rust: #b84818;
      --rust-dark: #8c3410;
      --stone: #7a6a52;
      --tan: #c8b48a;
      --danger: #962020;
      --gold: #9a7818;
      --header-bg: #0c1a06;
      --nav-bg: #141e0a;
    }
    html { scroll-behavior: smooth; }
    body { background: var(--bg); font-family: 'EB Garamond', Georgia, serif; color: var(--bark); min-height: 100vh; }
    h1, h2, h3, h4 { font-family: 'Playfair Display', Georgia, serif; color: var(--bark); }
    @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin   { to { transform: rotate(360deg); } }
    .fade-in { animation: fadeIn 0.25s ease; }
    .spinner { display:inline-block; width:18px; height:18px; border:2px solid var(--tan); border-top-color:var(--grass); border-radius:50%; animation:spin 0.7s linear infinite; }

    .btn { border:none; cursor:pointer; font-family:'Courier Prime',monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; transition:all 0.15s ease; padding:10px 22px; display:inline-flex; align-items:center; gap:7px; font-weight:700; }
    .btn:disabled { opacity:0.45; cursor:not-allowed; }
    .btn-primary  { background:var(--rust); color:#fff; }
    .btn-primary:hover:not(:disabled)  { background:var(--rust-dark); }
    .btn-green    { background:var(--grass); color:#fff; }
    .btn-green:hover:not(:disabled)    { background:var(--grass-dark); }
    .btn-ghost    { background:transparent; color:var(--stone); border:2px solid var(--border); }
    .btn-ghost:hover:not(:disabled)    { border-color:var(--bark); color:var(--bark); }
    .btn-dark     { background:var(--bark); color:var(--bg); }
    .btn-dark:hover:not(:disabled)     { background:var(--forest); }
    .btn-danger   { background:transparent; color:var(--danger); border:2px solid var(--danger); }
    .btn-danger:hover:not(:disabled)   { background:var(--danger); color:#fff; }

    .tag { display:inline-block; background:rgba(46,90,24,0.1); color:var(--grass); border:1px solid rgba(46,90,24,0.25); padding:2px 9px; font-family:'Courier Prime',monospace; font-size:10px; letter-spacing:0.1em; text-transform:uppercase; font-weight:700; }
    .tag-rust    { background:rgba(184,72,24,0.1);  color:var(--rust);   border-color:rgba(184,72,24,0.3); }
    .tag-gold    { background:rgba(154,120,24,0.1); color:var(--gold);   border-color:rgba(154,120,24,0.3); }
    .tag-off     { background:rgba(0,0,0,0.04);     color:var(--stone);  border-color:var(--border); }
    .tag-danger  { background:rgba(150,32,32,0.1);  color:var(--danger); border-color:rgba(150,32,32,0.3); }

    input, select, textarea { width:100%; background:var(--card); border:2px solid var(--border); padding:10px 13px; font-size:15px; color:var(--bark); font-family:'EB Garamond',Georgia,serif; outline:none; transition:border-color 0.15s; border-radius:0; }
    input:focus, select:focus, textarea:focus { border-color:var(--grass); }
    textarea { resize:vertical; min-height:80px; line-height:1.6; }
    label { font-family:'Courier Prime',monospace; font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:var(--grass); font-weight:700; display:block; margin-bottom:5px; }

    .status-pill { font-family:'Courier Prime',monospace; font-size:10px; letter-spacing:0.08em; padding:3px 9px; text-transform:uppercase; font-weight:700; }
    .data-table th { font-family:'Courier Prime',monospace; font-size:10px; letter-spacing:0.15em; text-transform:uppercase; color:var(--grass); padding:0 0 8px; text-align:left; border-bottom:2px solid var(--border); }
    .data-table td { font-size:14px; padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.06); color:var(--bark); }
    .admin-table { border-collapse:collapse; width:100%; }
    .admin-table th { background:var(--parchment); font-family:'Courier Prime',monospace; font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--grass); padding:10px 14px; text-align:left; border-bottom:2px solid var(--border); white-space:nowrap; }
    .admin-table td { padding:11px 14px; font-size:14px; border-bottom:1px solid rgba(0,0,0,0.05); vertical-align:middle; }
    .admin-table tr:hover td { background:rgba(46,90,24,0.03); }

    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(3px); z-index:200; display:flex; align-items:flex-start; justify-content:center; overflow-y:auto; padding:24px 16px; }
    .modal { background:var(--card); border:2px solid var(--border); width:100%; max-width:520px; margin:auto; animation:fadeIn 0.2s ease; }

    ::-webkit-scrollbar { width:5px; }
    ::-webkit-scrollbar-track { background:var(--parchment); }
    ::-webkit-scrollbar-thumb { background:var(--tan); }

    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
    .grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
    .grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }

    @media (max-width: 700px) {
      .grid-2 { grid-template-columns:1fr !important; }
      .grid-3 { grid-template-columns:1fr 1fr !important; }
      .grid-4 { grid-template-columns:1fr 1fr !important; }
      .hide-sm { display:none !important; }
      .nav-inner { overflow-x:auto; }
      .page-pad { padding:20px 16px 48px !important; }
      .hero-grid { grid-template-columns:1fr !important; }
      .admin-table th, .admin-table td { padding:8px 10px !important; font-size:12px !important; }
    }
  `}</style>
);

// ─── Shared Components ────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label>{label}</label>}
    {children}
  </div>
);

const FieldRow = ({ children }) => (
  <div className="grid-2">{children}</div>
);

const Card = ({ children, style, accent }) => (
  <div style={{ background: "var(--card)", border: "2px solid var(--border)", padding: 24, borderLeft: accent ? `4px solid ${accent}` : undefined, ...style }}>{children}</div>
);

const Parchment = ({ children, style }) => (
  <div style={{ background: "var(--parchment)", border: "2px solid var(--border)", padding: "16px 20px", ...style }}>{children}</div>
);

const SectionRule = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "32px 0 20px" }}>
    <div style={{ flex: 1, height: 2, background: "var(--border)" }} />
    <span style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--grass)", whiteSpace: "nowrap", fontWeight: 700 }}>{label}</span>
    <div style={{ flex: 1, height: 2, background: "var(--border)" }} />
  </div>
);

const StatBox = ({ label, value, note }) => (
  <Parchment>
    <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--grass)", marginBottom: 5, fontWeight: 700 }}>{label}</div>
    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: "var(--bark)", fontWeight: 900, lineHeight: 1 }}>{value}</div>
    {note && <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", marginTop: 5 }}>{note}</div>}
  </Parchment>
);

const ErrMsg = ({ msg }) => msg ? (
  <p style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--danger)", margin: "8px 0", display: "flex", alignItems: "center", gap: 6 }}>
    <Ic.X s={11} /> {msg}
  </p>
) : null;

const StatusPill = ({ status }) => {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.scheduled;
  return <span className="status-pill" style={{ background: s.bg, color: s.color }}>{status}</span>;
};

function Toast({ message, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3400); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 300,
      background: "var(--bark)", color: "var(--bg)",
      padding: "13px 20px", fontFamily: "'Courier Prime',monospace",
      fontSize: 12, letterSpacing: "0.06em", animation: "fadeIn 0.2s ease",
      maxWidth: 320, boxShadow: "0 8px 28px rgba(0,0,0,0.3)",
      borderLeft: `4px solid ${type === "error" ? "var(--danger)" : "var(--grass)"}`,
    }}>{message}</div>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ background: "var(--header-bg)", color: "var(--bg)", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {subtitle && <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.55, marginBottom: 3 }}>{subtitle}</div>}
            <h3 style={{ color: "var(--bg)", fontSize: 20, fontWeight: 700 }}>{title}</h3>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--bg)", fontSize: 26, cursor: "pointer", opacity: 0.65, lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({ onClose, redirectTo = "?page=account" }) {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const handleSubmit = async () => {
    setErr("");
    if (!email || !email.includes("@")) { setErr("Need a real email address."); return; }
    setLoading(true);
    try { await signInWithEmail(email, redirectTo); setSent(true); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Sign In" subtitle="HoneyDew" onClose={onClose}>
      {sent ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ marginBottom: 16, color: "var(--grass)" }}><Ic.Mail s={40} /></div>
          <h3 style={{ fontSize: 22, marginBottom: 10 }}>Check your inbox</h3>
          <p style={{ fontSize: 16, color: "var(--stone)", lineHeight: 1.7 }}>
            We sent a link to <strong>{email}</strong>.<br />Click it and you're in. No password needed.
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", lineHeight: 1.65, marginBottom: 20 }}>
            Enter your email and we'll shoot you a sign-in link. Same account works for everything we do.
          </p>
          <Field label="Your Email">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="you@email.com" autoFocus />
          </Field>
          <ErrMsg msg={err} />
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}
            style={{ width: "100%", padding: 13, marginTop: 6, justifyContent: "center" }}>
            {loading ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Sending…</> : <><Ic.Send /> Send My Link</>}
          </button>
        </>
      )}
    </Modal>
  );
}

// ─── Page: Home ───────────────────────────────────────────────────────────────
function HomePage({ onNav }) {
  return (
    <div className="fade-in">
      {/* Hero */}
      <div style={{ background: "var(--forest)", color: "var(--bg)", padding: "52px 32px 48px", borderBottom: "4px solid var(--grass)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center", maxWidth: 900, margin: "0 auto" }} className="hero-grid">
            <div>
              <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--grass-light)", marginBottom: 14, fontWeight: 700 }}>HoneyDew Lawn Services</div>
              <h1 style={{ fontSize: "clamp(34px,5vw,58px)", fontWeight: 900, lineHeight: 1.05, color: "#fff", marginBottom: 16 }}>
                Your yard ain't gonna cut itself.
              </h1>
              <p style={{ fontSize: 18, fontStyle: "italic", color: "rgba(240,232,208,0.75)", lineHeight: 1.7, marginBottom: 30 }}>
                We show up. We mow. You carry on. That's the whole deal.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={() => onNav("signup")} style={{ padding: "13px 28px", fontSize: 12 }}>
                  Get on the Schedule <Ic.Arrow />
                </button>
                <button className="btn btn-ghost" onClick={() => onNav("contact")} style={{ color: "rgba(240,232,208,0.8)", borderColor: "rgba(240,232,208,0.3)", padding: "13px 24px" }}>
                  Got Questions?
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { n: "01", label: "Sign Up",   desc: "Takes two minutes. Fill out the form, pick your plan, done." },
                { n: "02", label: "We Show Up", desc: "Your yard gets put on the schedule. We come to you." },
                { n: "03", label: "Enjoy It",   desc: "Track visits and manage your service right from your account." },
              ].map(s => (
                <div key={s.n} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "var(--grass-light)", flexShrink: 0, fontWeight: 900, lineHeight: 1 }}>{s.n}</div>
                  <div>
                    <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--grass-light)", marginBottom: 4, fontWeight: 700 }}>{s.label}</div>
                    <div style={{ fontSize: 14, color: "rgba(240,232,208,0.7)", lineHeight: 1.55 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
      </div>

      {/* Services + Pricing */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px 60px" }} className="page-pad">
        <SectionRule label="What We Offer" />

        {/* Pricing model explainer */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }} className="grid-2">
          <Parchment style={{ borderLeft: "4px solid var(--grass)" }}>
            <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--grass)", marginBottom: 8, fontWeight: 700 }}>Per-Visit Plan</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, fontFamily: "'Playfair Display',serif" }}>Pay as you go.</div>
            <p style={{ fontSize: 14, color: "var(--stone)", lineHeight: 1.65 }}>
              Schedule when you need it. No commitment, no minimum. We come out, we mow, you pay. Simple as that.
            </p>
          </Parchment>
          <Parchment style={{ borderLeft: "4px solid var(--rust)" }}>
            <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--rust)", marginBottom: 8, fontWeight: 700 }}>Monthly Plan</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, fontFamily: "'Playfair Display',serif" }}>4 visits a month.</div>
            <p style={{ fontSize: 14, color: "var(--stone)", lineHeight: 1.65 }}>
              Same day every week, regular cadence. Set it and forget it. Best deal we offer, and your yard stays sharp all season.
            </p>
          </Parchment>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="grid-2">
          {/* Lawn Service */}
          <Card accent="var(--grass)">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ color: "var(--grass)" }}><Ic.Mower s={18} /></span>
              <span className="tag">Most Popular</span>
            </div>
            <h3 style={{ fontSize: 21, marginBottom: 4 }}>Full Lawn Service</h3>
            <p style={{ fontSize: 14, color: "var(--stone)", lineHeight: 1.6, marginBottom: 16 }}>
              Mow, edge, trim, and haul. We don't cut corners — we edge 'em.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["Lot Size", "Per Visit", "Monthly (4x)"].map(h => (
                  <th key={h} style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--grass)", padding: "0 0 8px", textAlign: "left", borderBottom: "2px solid var(--border)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {LOT_OPTIONS.map(l => (
                  <tr key={l.value}>
                    <td style={{ fontSize: 13, padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", color: "var(--bark)" }}>{l.label}</td>
                    <td style={{ fontSize: 13, padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", color: "var(--rust)", fontFamily: "'Courier Prime',monospace", fontWeight: 700 }}>{l.priceVisit ? `$${l.priceVisit}` : "—"}</td>
                    <td style={{ fontSize: 13, padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", color: "var(--grass)", fontFamily: "'Courier Prime',monospace", fontWeight: 700 }}>{l.priceMonth ? `$${l.priceMonth}/mo` : <em style={{ color: "var(--stone)", fontWeight: 400 }}>Quote</em>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Flowers */}
          <Card accent="var(--gold)">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ color: "var(--gold)" }}><Ic.Leaf s={18} /></span>
              <span className="tag tag-gold">Add-On</span>
            </div>
            <h3 style={{ fontSize: 21, marginBottom: 4 }}>Bucket O' Flowers</h3>
            <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--gold)", letterSpacing: "0.06em", marginBottom: 10, fontWeight: 700 }}>$25 / month</div>
            <p style={{ fontSize: 14, color: "var(--stone)", lineHeight: 1.65, marginBottom: 14 }}>
              We bring in fresh seasonal flowers every month — planted, arranged, and swapped out when the season turns. Your yard always has something going on.
            </p>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {["Hand-picked seasonal varieties", "Delivered and planted every month", "Bed prep and soil touch-up included", "We swap 'em out as seasons change"].map(f => (
                <li key={f} style={{ fontSize: 13, color: "var(--stone)", display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--gold)", marginTop: 2, flexShrink: 0 }}><Ic.Check s={11} /></span>{f}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* CTA Banner */}
        <div style={{ background: "var(--bark)", color: "var(--bg)", padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginTop: 28, borderTop: "4px solid var(--rust)" }}>
          <div>
            <h3 style={{ color: "var(--bg)", fontSize: 22, marginBottom: 4 }}>Ready to get this done?</h3>
            <p style={{ fontSize: 15, opacity: 0.65, fontStyle: "italic" }}>Your neighbors are already on the list. Just sayin'.</p>
          </div>
          <button className="btn btn-primary" style={{ padding: "13px 26px", fontSize: 12 }} onClick={() => onNav("signup")}>
            Sign Me Up <Ic.Arrow />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page: About ──────────────────────────────────────────────────────────────
function AboutPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "36px 24px 60px" }} className="fade-in page-pad">
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--grass)", marginBottom: 8, fontWeight: 700 }}>HoneyDew Lawn Services</div>
        <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 900, lineHeight: 1.1, color: "var(--bark)" }}>The Straight Story</h2>
      </div>

      <SectionRule label="What We Believe" />
      <Card accent="var(--grass)" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[
            { title: "A man's word means something.", body: "When we say we'll be there Tuesday, we mean Tuesday. Not Wednesday, not 'sometime this week.' Tuesday." },
            { title: "Fair pricing is just good business.", body: "You'll know exactly what you're paying before we ever show up. No surprises on the bill, no nickel-and-diming for every little thing." },
            { title: "Your lawn should look better than your neighbor's.", body: "We'll never tell 'em who does it. That's between you and us." },
            { title: "Good work speaks for itself.", body: "We're not big on sales pitches. We'd rather just show you a sharp mow line and let that do the talking." },
          ].map(item => (
            <div key={item.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ color: "var(--grass)", flexShrink: 0, marginTop: 3 }}><Ic.Check s={14} /></span>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                <p style={{ fontSize: 15, color: "var(--stone)", lineHeight: 1.65 }}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <SectionRule label="Who We Are" />
      <Card accent="var(--rust)">
        <p style={{ fontSize: 16, lineHeight: 1.8, color: "var(--stone)", marginBottom: 16, fontStyle: "italic" }}>
          "HoneyDew started with one guy who got tired of looking at shaggy lawns and figured somebody oughta do something about it."
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 15, color: "var(--bark)", lineHeight: 1.75 }}>
            We're your neighbors. We know these streets, these yards, and how the grass grows out here. We're not a franchise. We're not a corporation. We're just a small operation with good equipment, a solid work ethic, and enough pride to never leave a yard looking halfway done.
          </p>
          <p style={{ fontSize: 15, color: "var(--bark)", lineHeight: 1.75 }}>
            We started HoneyDew because lawn care shouldn't be complicated. You shouldn't need a contract or a 12-month commitment to get your grass cut. You should be able to sign up, pick a plan, and trust that somebody's going to show up and do the job right.
          </p>
          <p style={{ fontSize: 15, color: "var(--bark)", lineHeight: 1.75 }}>
            One man, one truck, one mower. The truck's newer than it used to be. The work ethic hasn't changed.
          </p>
        </div>
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700 }}>HoneyDew Lawn Services</div>
          <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>Est. 2024 · Your Neighborhood</div>
        </div>
      </Card>
    </div>
  );
}

// ─── Page: Sign Up ────────────────────────────────────────────────────────────
function SignupPage({ user, onNav, onSignupComplete, showToast }) {
  const [form, setForm]         = useState({ first_name: "", last_name: "", address: "", lot: "small", billing: "monthly", preferred_day: "", notes: "", payment_method: "venmo" });
  const [services, setServices] = useState({ lawn: true, flowers: false });
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");
  const [success, setSuccess]   = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!user) return;
    const saved = sessionStorage.getItem('honeydew_pending_signup');
    if (saved) {
      try {
        const { form: f, services: svcs } = JSON.parse(saved);
        sessionStorage.removeItem('honeydew_pending_signup');
        setForm(f); setServices(svcs);
        setSaving(true);
        const svcList = Object.entries(svcs).filter(([, v]) => v).map(([k]) => k);
        saveLawnSignup({ user_id: user.id, email: user.email, ...f, services: svcList })
          .then(() => { setSuccess(true); onSignupComplete?.(); showToast("You're on the schedule. Welcome to HoneyDew."); })
          .catch(e => setErr("Save failed: " + e.message))
          .finally(() => setSaving(false));
        return;
      } catch {}
    }
    fetchLawnSignup(user.id).then(s => {
      if (!s) return;
      setForm({ first_name: s.first_name ?? "", last_name: s.last_name ?? "", address: s.address ?? "", lot: s.lot ?? "small", billing: s.billing ?? "monthly", preferred_day: s.preferred_day ?? "", notes: s.notes ?? "", payment_method: s.payment_method ?? "venmo" });
      const svcs = {};
      (s.services ?? []).forEach(sv => { svcs[sv] = true; });
      if (Object.keys(svcs).length) setServices({ lawn: false, flowers: false, ...svcs });
    }).catch(() => {});
  }, [user?.id]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    setErr("");
    if (!form.first_name || !form.last_name) return setErr("Need your full name.");
    if (!form.address) return setErr("Need your address so we know where to show up.");
    if (!services.lawn && !services.flowers) return setErr("Pick at least one service.");
    if (!user) {
      sessionStorage.setItem('honeydew_pending_signup', JSON.stringify({ form, services }));
      setShowAuth(true);
      return;
    }
    setSaving(true);
    try {
      const svcList = Object.entries(services).filter(([, v]) => v).map(([k]) => k);
      await saveLawnSignup({ user_id: user.id, email: user.email, ...form, services: svcList });
      setSuccess(true);
      onSignupComplete?.();
      showToast("You're on the schedule. Welcome to HoneyDew.");
    } catch (e) { setErr("Save failed: " + e.message); }
    finally { setSaving(false); }
  };

  if (success) return (
    <div style={{ maxWidth: 580, margin: "0 auto", padding: "60px 24px" }} className="fade-in">
      <Card style={{ textAlign: "center", padding: 44 }} accent="var(--grass)">
        <div style={{ color: "var(--grass)", marginBottom: 16 }}><Ic.Check s={48} /></div>
        <h2 style={{ fontSize: 30, marginBottom: 10 }}>You're in.</h2>
        <p style={{ fontSize: 17, color: "var(--stone)", lineHeight: 1.7, maxWidth: 360, margin: "0 auto 28px" }}>
          We got your info. We'll reach out to lock in your first visit. In the meantime, check your account.
        </p>
        <button className="btn btn-green" onClick={() => onNav("account")} style={{ padding: "13px 28px" }}>
          Go to My Account <Ic.Arrow />
        </button>
      </Card>
    </div>
  );

  const lot = getLot(form.lot);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 60px" }} className="fade-in page-pad">
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--grass)", marginBottom: 8, fontWeight: 700 }}>HoneyDew Lawn Services</div>
        <h2 style={{ fontSize: "clamp(26px,4vw,34px)", marginBottom: 8 }}>{user ? "Update Your Info" : "Get on the Schedule"}</h2>
        <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", lineHeight: 1.65 }}>
          Takes about two minutes. No contracts, no nonsense.
        </p>
      </div>
      <Card>
        <FieldRow>
          <Field label="First Name"><input value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="Jane" /></Field>
          <Field label="Last Name"><input value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="Doe" /></Field>
        </FieldRow>
        <Field label="Street Address — We need to know where to show up">
          <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Your Street" />
        </Field>
        <Field label="How Big's Your Lot?">
          <select value={form.lot} onChange={e => set("lot", e.target.value)}>
            {LOT_OPTIONS.map(l => (
              <option key={l.value} value={l.value}>
                {l.label}{l.priceVisit ? ` — $${l.priceVisit}/visit or $${l.priceMonth}/mo` : " — We'll get you a quote"}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Pick Your Plan">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="grid-2">
            {[
              { value: "per-visit", label: "Per Visit", desc: `$${lot.priceVisit ?? "?"} each time · schedule when you want`, badge: "Flexible" },
              { value: "monthly",   label: "Monthly",   desc: `$${lot.priceMonth ?? "?"}/mo · 4 visits, same day every week`, badge: "Best Value" },
            ].map(opt => (
              <div key={opt.value} onClick={() => set("billing", opt.value)}
                style={{ border: `2px solid ${form.billing === opt.value ? "var(--grass)" : "var(--border)"}`, background: form.billing === opt.value ? "rgba(46,90,24,0.06)" : "var(--parchment)", padding: "14px 16px", cursor: "pointer", transition: "all 0.15s", position: "relative" }}>
                {form.billing === opt.value && (
                  <div style={{ position: "absolute", top: 8, right: 8, color: "var(--grass)" }}><Ic.Check s={12} /></div>
                )}
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, marginBottom: 3 }}>{opt.label}</div>
                <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 9, color: "var(--rust)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>{opt.badge}</div>
                <div style={{ fontSize: 13, color: "var(--stone)", lineHeight: 1.45 }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </Field>

        <Field label="Services — Pick What You Need">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="grid-2">
            {SERVICE_OPTIONS.map(s => (
              <div key={s.id} onClick={() => setServices(p => ({ ...p, [s.id]: !p[s.id] }))}
                style={{ border: `2px solid ${services[s.id] ? "var(--grass)" : "var(--border)"}`, background: services[s.id] ? "rgba(46,90,24,0.06)" : "var(--card)", padding: "14px 16px", cursor: "pointer", transition: "all 0.15s", position: "relative" }}>
                {services[s.id] && <div style={{ position: "absolute", top: 8, right: 8, color: "var(--grass)" }}><Ic.Check s={12} /></div>}
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 9, color: "var(--rust)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>{s.priceNote}</div>
                <div style={{ fontSize: 13, color: "var(--stone)", lineHeight: 1.45 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Field>

        <Field label="Best Day for Your Mow">
          <select value={form.preferred_day} onChange={e => set("preferred_day", e.target.value)}>
            <option value="">No preference — whatever works</option>
            {DAYS.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>

        <Field label="Anything We Should Know (optional)">
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Gate code, dog in yard, areas to skip — whatever's useful." style={{ minHeight: 70 }} />
        </Field>

        <SectionRule label="How You Want to Pay" />
        {PAYMENT_OPTIONS.map(po => (
          <div key={po.value} onClick={() => set("payment_method", po.value)}
            style={{ background: form.payment_method === po.value ? "rgba(46,90,24,0.05)" : "var(--parchment)", border: `2px solid ${form.payment_method === po.value ? "var(--grass)" : "var(--border)"}`, padding: "13px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, marginBottom: 10, transition: "all 0.15s" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{po.label}</div>
              <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", letterSpacing: "0.05em" }}>{po.desc}</div>
            </div>
            <div style={{ width: 18, height: 18, border: "2px solid var(--border)", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderColor: form.payment_method === po.value ? "var(--grass)" : "var(--border)" }}>
              {form.payment_method === po.value && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--grass)" }} />}
            </div>
          </div>
        ))}

        <ErrMsg msg={err} />
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}
          style={{ width: "100%", marginTop: 14, padding: 14, justifyContent: "center", fontSize: 12 }}>
          {saving ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</> : <>{user ? "Save Changes" : "Get on the Schedule"} <Ic.Arrow /></>}
        </button>
        {!user && <p style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", textAlign: "center", marginTop: 10, letterSpacing: "0.05em" }}>We'll ask you to sign in when you submit. Takes 30 seconds.</p>}
      </Card>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} redirectTo="?page=signup" />}
    </div>
  );
}

// ─── Page: Account ────────────────────────────────────────────────────────────
function AccountPage({ user, onNav, showToast, onSignupLoaded }) {
  const [signup, setSignup]       = useState(null);
  const [visits, setVisits]       = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAuth, setShowAuth]   = useState(false);
  const [visitReqDate, setVRDate] = useState("");
  const [visitReqNote, setVRNote] = useState("");
  const [visitReqSent, setVRSent] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([fetchLawnSignup(user.id), fetchVisits(user.id), fetchMySchedules(user.id)])
      .then(([s, v, sch]) => {
        setSignup(s); setVisits(v); setSchedules(sch);
        if (s) onSignupLoaded?.();
      })
      .catch(e => console.warn("Account load:", e.message))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const toggleSvc = async (svc) => {
    if (!signup) return;
    const current = signup.services ?? [];
    const next = current.includes(svc) ? current.filter(s => s !== svc) : [...current, svc];
    try {
      const updated = await saveLawnSignup({ ...signup, services: next });
      setSignup(updated);
      showToast(next.includes(svc) ? `${svc} service added` : `${svc} service removed`);
    } catch (e) { showToast("Update failed: " + e.message, "error"); }
  };

  const handleVisitRequest = async () => {
    if (!visitReqDate) { showToast("Pick a date first.", "error"); return; }
    try {
      await saveContactMessage({
        name: `${signup.first_name} ${signup.last_name}`,
        email: signup.email ?? user.email ?? "",
        address: signup.address,
        topic: "Visit Request",
        message: `Requesting a visit on ${visitReqDate}.${visitReqNote ? " Notes: " + visitReqNote : ""}`,
      });
      setVRSent(true);
      showToast("Visit request sent. We'll confirm shortly.");
    } catch (e) { showToast("Request failed: " + e.message, "error"); }
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><span className="spinner" style={{ width: 30, height: 30 }} /></div>;

  if (!user) return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "60px 24px", textAlign: "center" }} className="fade-in">
      <div style={{ color: "var(--grass)", marginBottom: 16 }}><Ic.User s={48} /></div>
      <h2 style={{ fontSize: 28, marginBottom: 10 }}>Your HoneyDew Account</h2>
      <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", maxWidth: 360, margin: "0 auto 28px", lineHeight: 1.7 }}>
        Sign in to manage your lawn services, check your schedule, and track visits.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => onNav("signup")} style={{ padding: "12px 24px" }}>Get Signed Up <Ic.Arrow /></button>
        <button className="btn btn-ghost" onClick={() => setShowAuth(true)} style={{ padding: "12px 24px" }}>Sign In</button>
      </div>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );

  if (!signup) return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "60px 24px", textAlign: "center" }} className="fade-in">
      <div style={{ color: "var(--rust)", marginBottom: 16 }}><Ic.Clip s={44} /></div>
      <h2 style={{ fontSize: 24, marginBottom: 10 }}>Not signed up yet</h2>
      <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", marginBottom: 24, lineHeight: 1.7 }}>
        You're signed in but haven't filled out the form. Takes two minutes.
      </p>
      <button className="btn btn-primary" onClick={() => onNav("signup")} style={{ padding: "13px 28px" }}>
        Get on the Schedule <Ic.Arrow />
      </button>
    </div>
  );

  const lot     = getLot(signup.lot);
  const hasBoth = signup.services?.includes("lawn") && signup.services?.includes("flowers");
  const today   = new Date().toISOString().slice(0, 10);
  const upcoming = schedules
    .filter(s => s.status === "scheduled" && s.scheduled_date >= today)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const nextVisit = upcoming[0];
  const monthTotal = visits
    .filter(v => { const d = new Date(v.visit_date); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); })
    .reduce((a, v) => a + (v.cost ?? 0), 0);
  const cpv = signup.billing === "monthly"
    ? `$${(lot.priceMonth ?? 0) + (hasBoth ? 25 : 0)}/mo`
    : `$${(lot.priceVisit ?? "?") + (hasBoth ? 25 : 0)}/visit`;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px" }} className="fade-in page-pad">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--grass)", marginBottom: 5, fontWeight: 700 }}>HoneyDew Account</div>
          <h2 style={{ fontSize: 30, marginBottom: 3 }}>Hey, {signup.first_name}.</h2>
          <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--stone)", letterSpacing: "0.05em" }}>{signup.address} · {user.email}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => onNav("signup")}>Edit Info</button>
          <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => signOut()}>Sign Out</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <StatBox label="Your Plan"    value={signup.billing === "monthly" ? "Monthly" : "Per Visit"} note={signup.billing === "monthly" ? "4 visits/month" : "schedule as needed"} />
        <StatBox label="Est. Cost"    value={lot.priceVisit ? cpv : "Custom"} note={hasBoth ? "lawn + flowers" : undefined} />
        <StatBox label="Next Visit"   value={nextVisit ? fmtDate(nextVisit.scheduled_date) : "TBD"} note={nextVisit ? nextVisit.service_type : "we'll reach out soon"} />
      </div>

      {/* Pending first visit */}
      {upcoming.length === 0 && (
        <Parchment style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24, borderLeft: "4px solid var(--gold)" }}>
          <span style={{ color: "var(--gold)", flexShrink: 0 }}><Ic.Clock s={22} /></span>
          <div>
            <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 4, fontWeight: 700 }}>First Visit Pending</div>
            <p style={{ fontSize: 15, color: "var(--stone)", lineHeight: 1.65 }}>You're all signed up. We're working on getting you on the schedule and will reach out to confirm your first visit.</p>
          </div>
        </Parchment>
      )}

      {/* Upcoming schedule */}
      {upcoming.length > 0 && (
        <>
          <SectionRule label={`Upcoming (${upcoming.length})`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
            {upcoming.map(s => (
              <div key={s.id} style={{ background: "var(--card)", border: "2px solid var(--border)", borderLeft: "4px solid var(--grass)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, marginBottom: 2 }}>{fmtDate(s.scheduled_date)}</div>
                  <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.service_type}</div>
                  {s.notes && <div style={{ fontSize: 13, color: "var(--stone)", marginTop: 4, fontStyle: "italic" }}>{s.notes}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {s.cost && <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 13, color: "var(--grass)", fontWeight: 700 }}>${parseFloat(s.cost).toFixed(2)}</div>}
                  <StatusPill status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Request a visit (per-visit billing users) */}
      {signup.billing === "per-visit" && (
        <>
          <SectionRule label="Request a Visit" />
          <Card style={{ maxWidth: 460 }}>
            {visitReqSent ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{ color: "var(--grass)", marginBottom: 10 }}><Ic.Check s={32} /></div>
                <p style={{ fontSize: 16, color: "var(--stone)" }}>Request received. We'll confirm your date shortly.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 14, color: "var(--stone)", marginBottom: 16, lineHeight: 1.6 }}>On a per-visit plan? Request your next cut below and we'll get you on the calendar.</p>
                <Field label="Preferred Date"><input type="date" value={visitReqDate} min={today} onChange={e => setVRDate(e.target.value)} /></Field>
                <Field label="Notes (optional)"><textarea value={visitReqNote} onChange={e => setVRNote(e.target.value)} placeholder="Anything we should know for this visit" style={{ minHeight: 60 }} /></Field>
                <button className="btn btn-primary" onClick={handleVisitRequest}><Ic.Calendar /> Request Visit</button>
              </>
            )}
          </Card>
        </>
      )}

      {/* My Services */}
      <SectionRule label="My Services" />
      <div style={{ marginBottom: 24 }}>
        {[
          { id: "lawn",    name: "Full Lawn Service", price: () => signup.billing === "monthly" ? `$${lot.priceMonth}/mo` : `$${lot.priceVisit}/visit` },
          { id: "flowers", name: "Bucket O' Flowers",   price: () => "$25/mo" },
        ].map(s => {
          const active = signup.services?.includes(s.id);
          return (
            <div key={s.id} style={{ background: "var(--card)", border: "2px solid var(--border)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", letterSpacing: "0.05em" }}>{s.price()} · {active ? "Active" : "Not active"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`tag ${active ? "" : "tag-off"}`}>{active ? "Active" : "Off"}</span>
                <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 9 }} onClick={() => toggleSvc(s.id)}>{active ? "Remove" : "Add"}</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visit History */}
      <SectionRule label="Visit History" />
      {visits.length === 0 ? (
        <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", padding: "16px 0" }}>No visits logged yet. Your first one's coming up.</p>
      ) : (
        <table className="data-table" style={{ width: "100%" }}>
          <thead><tr>{["Date","Service","Status","Amount"].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {visits.map(v => (
              <tr key={v.id}>
                <td>{fmtDate(v.visit_date)}</td>
                <td style={{ textTransform: "capitalize" }}>{v.service_type}</td>
                <td><StatusPill status={v.status} /></td>
                <td style={{ fontFamily: "'Courier Prime',monospace", fontSize: 13, fontWeight: 700 }}>${(v.cost ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Payment */}
      <SectionRule label="Payment Method" />
      <Parchment style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 15, fontFamily: "'Playfair Display',serif", fontWeight: 700 }}>
          {PAYMENT_OPTIONS.find(p => p.value === signup.payment_method)?.label ?? "—"}
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => onNav("signup")}>Change</button>
      </Parchment>
    </div>
  );
}

// ─── Page: Contact ────────────────────────────────────────────────────────────
function ContactPage({ user, showToast }) {
  const [form, setForm]     = useState({ name: "", email: user?.email ?? "", address: "", topic: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [sent, setSent]     = useState(false);
  const [err, setErr]       = useState("");
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    setErr("");
    if (!form.name) return setErr("Need your name.");
    if (!form.email || !form.email.includes("@")) return setErr("Need a valid email.");
    if (!form.message) return setErr("Need a message — don't be shy.");
    setSaving(true);
    try {
      await saveContactMessage({ name: form.name, email: form.email, address: form.address, topic: form.topic || "General", message: form.message });
      setSent(true); showToast("Message sent. We'll get back to you.");
    } catch (e) { setErr("Send failed: " + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px" }} className="fade-in page-pad">
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--grass)", marginBottom: 8, fontWeight: 700 }}>HoneyDew</div>
        <h2 style={{ fontSize: "clamp(26px,4vw,34px)", marginBottom: 8 }}>Holler at Us</h2>
        <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", lineHeight: 1.65 }}>Questions, pricing, your specific yard situation — we're easy to talk to.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }} className="grid-2">
        <div>
          {sent ? (
            <Card style={{ textAlign: "center", padding: 36 }} accent="var(--grass)">
              <div style={{ color: "var(--grass)", marginBottom: 14 }}><Ic.Mail s={36} /></div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>Got it.</h3>
              <p style={{ fontSize: 15, color: "var(--stone)", lineHeight: 1.65 }}>We typically get back to folks within 24 hours. Sometimes sooner if we're not on a mower.</p>
            </Card>
          ) : (
            <Card>
              <Field label="Your Name"><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Jane Doe" /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@email.com" /></Field>
              <Field label="Address (optional)"><input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Your street address" /></Field>
              <Field label="What's It About?">
                <select value={form.topic} onChange={e => set("topic", e.target.value)}>
                  <option value="">Pick a topic…</option>
                  {["Pricing question","New service inquiry","Schedule change","Service feedback","Billing question","Something else"].map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Your Message"><textarea value={form.message} onChange={e => set("message", e.target.value)} placeholder="Don't overthink it. Just tell us what's up." style={{ minHeight: 100 }} /></Field>
              <ErrMsg msg={err} />
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ width: "100%", padding: 13, justifyContent: "center" }}>
                {saving ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Sending…</> : <><Ic.Send /> Send It</>}
              </button>
            </Card>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Parchment style={{ borderLeft: "4px solid var(--grass)" }}>
            <label style={{ marginBottom: 10 }}>We're Around</label>
            <p style={{ fontSize: 14, color: "var(--stone)", lineHeight: 1.9 }}>
              Mon – Fri: 8am – 6pm<br />Saturday: 9am – 3pm<br />Sunday: We rest. The lawn does too.
            </p>
          </Parchment>
          <Parchment style={{ borderLeft: "4px solid var(--rust)" }}>
            <label style={{ marginBottom: 10 }}>Response Time</label>
            <p style={{ fontSize: 14, color: "var(--stone)", lineHeight: 1.65 }}>
              We get back to most folks within 24 hours. If it's urgent, say so in your message.
            </p>
          </Parchment>
        </div>
      </div>
    </div>
  );
}

// ─── Page: Admin ──────────────────────────────────────────────────────────────
function AdminPage({ user, showToast }) {
  const [signups, setSignups]           = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [visits, setVisits]             = useState([]);
  const [messages, setMessages]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState("customers");
  const [scheduleModal, setScheduleModal] = useState(null);
  const [visitModal, setVisitModal]       = useState(null);
  const [editSignup, setEditSignup]       = useState(null);
  const [invoiceModal, setInvoiceModal]   = useState(null);
  const [msgModal, setMsgModal]           = useState(null);
  const [saving, setSaving]               = useState(false);

  const blankSched = { scheduled_date: "", service_type: "lawn", status: "scheduled", cost: "", notes: "" };
  const blankVisit = { visit_date: "", service_type: "lawn", status: "completed", cost: "", notes: "" };
  const [schedForm, setSchedForm] = useState(blankSched);
  const [visitForm, setVisitForm] = useState(blankVisit);
  const [msgText, setMsgText]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sch, v, m] = await Promise.all([fetchAllSignups(), fetchAllSchedules(), fetchAllVisits(), fetchContactMessages()]);
      setSignups(s); setAllSchedules(sch); setVisits(v); setMessages(m);
    } catch (e) { showToast("Load failed: " + e.message, "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Schedule handlers ──────────────────────────────────────────────────────
  const openAddSchedule = (signup) => {
    setSchedForm({ ...blankSched, service_type: signup.services?.includes("lawn") ? "lawn" : "flowers", cost: getLot(signup.lot).priceVisit ?? "" });
    setScheduleModal({ signup, editing: null });
  };
  const openEditSchedule = (sched, signup) => {
    setSchedForm({ scheduled_date: sched.scheduled_date, service_type: sched.service_type, status: sched.status, cost: sched.cost ?? "", notes: sched.notes ?? "" });
    setScheduleModal({ signup, editing: sched });
  };
  const handleSaveSchedule = async () => {
    if (!scheduleModal || !schedForm.scheduled_date) { showToast("Pick a date.", "error"); return; }
    setSaving(true);
    try {
      const payload = { ...(scheduleModal.editing ? { id: scheduleModal.editing.id } : {}), user_id: scheduleModal.signup.user_id, ...schedForm, cost: schedForm.cost !== "" ? parseFloat(schedForm.cost) : null };
      const saved = await upsertSchedule(payload);
      if (scheduleModal.editing) {
        setAllSchedules(prev => prev.map(s => s.id === saved.id ? { ...s, ...saved } : s));
        showToast("Schedule updated");
      } else {
        setAllSchedules(prev => [saved, ...prev]);
        showToast(`Scheduled for ${scheduleModal.signup.first_name}`);
      }
      setScheduleModal(null);
    } catch (e) { showToast("Failed: " + e.message, "error"); }
    finally { setSaving(false); }
  };
  const handleDeleteSchedule = async (id) => {
    if (!confirm("Delete this scheduled visit?")) return;
    try { await deleteSchedule(id); setAllSchedules(prev => prev.filter(s => s.id !== id)); showToast("Deleted"); }
    catch (e) { showToast("Delete failed: " + e.message, "error"); }
  };
  const handleMarkSched = async (id, status) => {
    try {
      const updated = await upsertSchedule({ id, status });
      setAllSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
      showToast(`Marked ${status}`);
    } catch (e) { showToast("Update failed: " + e.message, "error"); }
  };

  // ── Visit handlers ─────────────────────────────────────────────────────────
  const handleAddVisit = async () => {
    if (!visitModal || !visitForm.visit_date) { showToast("Pick a date.", "error"); return; }
    setSaving(true);
    try {
      const saved = await upsertVisit({ user_id: visitModal.user_id, ...visitForm, cost: visitForm.cost !== "" ? parseFloat(visitForm.cost) : null });
      setVisits(prev => [saved, ...prev]);
      setVisitModal(null); setVisitForm(blankVisit);
      showToast("Visit logged");
    } catch (e) { showToast("Failed: " + e.message, "error"); }
    finally { setSaving(false); }
  };
  const handleMarkVisit  = async (id, status) => {
    try { await updateVisitStatus(id, status); setVisits(prev => prev.map(v => v.id === id ? { ...v, status } : v)); showToast(`Marked ${status}`); }
    catch (e) { showToast("Update failed: " + e.message, "error"); }
  };
  const handleDeleteVisit = async (id) => {
    if (!confirm("Delete this visit?")) return;
    try { await deleteVisit(id); setVisits(prev => prev.filter(v => v.id !== id)); showToast("Deleted"); }
    catch (e) { showToast("Delete failed: " + e.message, "error"); }
  };

  // ── Customer edit ──────────────────────────────────────────────────────────
  const handleUpdateSignup = async () => {
    if (!editSignup) return;
    setSaving(true);
    try {
      const updated = await updateSignup(editSignup.id, { notes: editSignup.notes, services: editSignup.services, billing: editSignup.billing });
      setSignups(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
      setEditSignup(null); showToast("Customer updated");
    } catch (e) { showToast("Update failed: " + e.message, "error"); }
    finally { setSaving(false); }
  };

  // ── Email helpers ──────────────────────────────────────────────────────────
  const buildCompletionMailto = (signup, sched) => {
    const subj = encodeURIComponent(`HoneyDew — Your lawn service is done (${fmtDate(sched?.scheduled_date ?? "")})`);
    const body = encodeURIComponent(
      `Hi ${signup.first_name},\n\nJust wrapped up your lawn service${sched?.scheduled_date ? ` on ${fmtDate(sched.scheduled_date)}` : " today"}. Everything's looking sharp.\n\n${sched?.notes ? `Notes: ${sched.notes}\n\n` : ""}${sched?.cost ? `Amount due: $${parseFloat(sched.cost).toFixed(2)} via ${PAYMENT_OPTIONS.find(p => p.value === signup.payment_method)?.label ?? "your usual method"}.\n\n` : ""}We'll see you on the next one.\n\n— HoneyDew Lawn Services`
    );
    return `mailto:${signup.email ?? ""}?subject=${subj}&body=${body}`;
  };

  const openInvoice = (signup) => {
    const customerVisits = visits.filter(v => v.user_id === signup.user_id);
    setInvoiceModal({ signup, text: generateInvoice(signup, customerVisits) });
  };

  const totalRev = signups.reduce((a, s) => {
    const lot = getLot(s.lot);
    if (s.billing === "monthly") { if (s.services?.includes("lawn")) a += lot.priceMonth ?? 0; if (s.services?.includes("flowers")) a += 25; }
    return a;
  }, 0);

  const adminTabs = [
    { key: "customers", label: `Customers (${signups.length})` },
    { key: "schedules", label: `Schedules (${allSchedules.length})` },
    { key: "visits",    label: `Visits (${visits.length})` },
    { key: "messages",  label: `Messages (${messages.length})` },
  ];

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><span className="spinner" style={{ width: 30, height: 30 }} /></div>;

  return (
    <div className="fade-in">
      {/* Admin header */}
      <div style={{ background: "var(--header-bg)", color: "var(--bg)", padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "4px solid var(--grass)" }}>
        <div>
          <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.5, marginBottom: 4 }}>HoneyDew · Owner View</div>
          <h2 style={{ color: "var(--bg)", fontSize: 24, fontWeight: 900 }}>Admin Dashboard</h2>
        </div>
        <button className="btn btn-ghost" style={{ color: "rgba(240,232,208,0.7)", borderColor: "rgba(240,232,208,0.2)", fontSize: 10 }} onClick={load}>Refresh</button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ padding: "20px 24px 0" }}>
        <StatBox label="Customers"        value={signups.length} />
        <StatBox label="Est. Monthly Rev." value={`$${totalRev}`} note="monthly subscribers" />
        <StatBox label="Pending Visits"   value={allSchedules.filter(s => s.status === "scheduled").length} />
        <StatBox label="Flower Subs"      value={signups.filter(s => s.services?.includes("flowers")).length} />
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 24px" }}>
        <div style={{ display: "flex", borderBottom: "2px solid var(--border)", marginTop: 24, overflowX: "auto" }}>
          {adminTabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ background: "transparent", border: "none", borderBottom: `3px solid ${activeTab === t.key ? "var(--grass)" : "transparent"}`, marginBottom: -2, padding: "10px 18px", cursor: "pointer", fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: activeTab === t.key ? "var(--grass)" : "var(--stone)", transition: "all 0.15s", fontWeight: 700, whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px 60px" }}>

        {/* Customers */}
        {activeTab === "customers" && (
          <div style={{ overflowX: "auto" }}>
            {signups.length === 0 ? (
              <Parchment style={{ textAlign: "center", padding: 32 }}><p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic" }}>No customers yet. They'll come.</p></Parchment>
            ) : (
              <table className="admin-table">
                <thead><tr>{["Customer","Address","Lot","Services","Plan","Actions"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {signups.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontFamily: "'Playfair Display',serif", fontSize: 15 }}>{s.first_name} {s.last_name}</div>
                        {s.email && <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)" }}>{s.email}</div>}
                      </td>
                      <td style={{ fontSize: 13, color: "var(--stone)" }}>{s.address}</td>
                      <td style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--stone)" }}>{getLot(s.lot).label}</td>
                      <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{(s.services ?? []).map(sv => <span key={sv} className="tag" style={{ fontSize: 9 }}>{sv}</span>)}</div></td>
                      <td style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--stone)", textTransform: "capitalize" }}>{s.billing}</td>
                      <td>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          <button className="btn btn-primary"  style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => openAddSchedule(s)}>+ Schedule</button>
                          <button className="btn btn-ghost"    style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => { setVisitForm({ ...blankVisit, cost: getLot(s.lot).priceVisit ?? "" }); setVisitModal(s); }}>+ Visit</button>
                          <button className="btn btn-ghost"    style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => setEditSignup({ ...s })}>Edit</button>
                          <button className="btn btn-ghost"    style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => openInvoice(s)}><Ic.File s={10} /> Invoice</button>
                          {s.email && (
                            <a href={`mailto:${s.email}`} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 9, textDecoration: "none" }}><Ic.Mail s={10} /> Message</a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Schedules */}
        {activeTab === "schedules" && (
          <div style={{ overflowX: "auto" }}>
            {allSchedules.length === 0 ? (
              <Parchment style={{ textAlign: "center", padding: 32 }}><p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic" }}>No schedules yet. Use + Schedule on a customer.</p></Parchment>
            ) : (
              <table className="admin-table">
                <thead><tr>{["Date","Customer","Service","Status","Cost","Notes","Actions"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {[...allSchedules].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)).map(s => {
                    const sg = s.lawn_signups;
                    return (
                      <tr key={s.id}>
                        <td style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, whiteSpace: "nowrap" }}>{fmtDate(s.scheduled_date)}</td>
                        <td style={{ fontFamily: "'Playfair Display',serif", fontSize: 14 }}>{sg ? `${sg.first_name} ${sg.last_name}` : "—"}</td>
                        <td style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, textTransform: "uppercase", color: "var(--stone)" }}>{s.service_type}</td>
                        <td><StatusPill status={s.status} /></td>
                        <td style={{ fontFamily: "'Courier Prime',monospace", fontSize: 12 }}>{s.cost ? `$${parseFloat(s.cost).toFixed(2)}` : "—"}</td>
                        <td style={{ fontSize: 13, color: "var(--stone)", maxWidth: 160 }}>{s.notes || "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {s.status === "scheduled" && <button className="btn btn-green"  style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => handleMarkSched(s.id, "completed")}><Ic.Check s={9} /> Done</button>}
                            {s.status === "completed" && (
                              <>
                                <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => handleMarkSched(s.id, "scheduled")}>Undo</button>
                                {sg?.email && (
                                  <a href={buildCompletionMailto(sg, s)} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 9, textDecoration: "none" }}><Ic.Send s={9} /> Email</a>
                                )}
                              </>
                            )}
                            <button className="btn btn-ghost"  style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => { const signup = signups.find(sg => sg.user_id === s.user_id); if (signup) openEditSchedule(s, signup); }}>Edit</button>
                            <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => handleDeleteSchedule(s.id)}><Ic.X s={9} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Visits */}
        {activeTab === "visits" && (
          <div style={{ overflowX: "auto" }}>
            {visits.length === 0 ? (
              <Parchment style={{ textAlign: "center", padding: 32 }}><p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic" }}>No visits logged. Use + Visit on a customer.</p></Parchment>
            ) : (
              <table className="admin-table">
                <thead><tr>{["Date","Customer","Service","Status","Cost","Actions"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {visits.map(v => {
                    const s = v.lawn_signups;
                    return (
                      <tr key={v.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDate(v.visit_date)}</td>
                        <td>
                          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14 }}>{s ? `${s.first_name} ${s.last_name}` : "—"}</div>
                          {s?.address && <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)" }}>{s.address}</div>}
                        </td>
                        <td style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, textTransform: "capitalize" }}>{v.service_type}</td>
                        <td><StatusPill status={v.status} /></td>
                        <td style={{ fontFamily: "'Courier Prime',monospace", fontSize: 12, fontWeight: 700 }}>{v.cost ? `$${parseFloat(v.cost).toFixed(2)}` : "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 5 }}>
                            {v.status !== "completed" && <button className="btn btn-green" style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => handleMarkVisit(v.id, "completed")}><Ic.Check s={9} /> Done</button>}
                            {v.status === "completed"  && <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => handleMarkVisit(v.id, "scheduled")}>Undo</button>}
                            <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => handleDeleteVisit(v.id)}><Ic.X s={9} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Messages */}
        {activeTab === "messages" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.length === 0 ? (
              <Parchment style={{ textAlign: "center", padding: 32 }}><p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic" }}>No messages yet.</p></Parchment>
            ) : messages.map(m => (
              <Card key={m.id} accent={m.topic === "Visit Request" ? "var(--rust)" : "var(--grass)"}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700 }}>{m.name}</div>
                  <span className={`tag ${m.topic === "Visit Request" ? "tag-rust" : "tag-gold"}`}>{m.topic}</span>
                  <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", marginLeft: "auto" }}>{new Date(m.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--stone)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Ic.Mail s={10} /> {m.email}{m.address ? ` · ${m.address}` : ""}
                </div>
                <p style={{ fontSize: 15, color: "var(--bark)", lineHeight: 1.65, marginBottom: 12 }}>{m.message}</p>
                {m.email && (
                  <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: Your HoneyDew inquiry")}`} className="btn btn-ghost" style={{ fontSize: 9, padding: "4px 12px", textDecoration: "none" }}>
                    <Ic.Send s={9} /> Reply
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {scheduleModal && (
        <Modal title={scheduleModal.editing ? "Edit Schedule" : "Schedule a Visit"} subtitle={`${scheduleModal.signup.first_name} ${scheduleModal.signup.last_name} · ${scheduleModal.signup.address}`} onClose={() => setScheduleModal(null)}>
          <FieldRow>
            <Field label="Visit Date"><input type="date" value={schedForm.scheduled_date} onChange={e => setSchedForm(p => ({ ...p, scheduled_date: e.target.value }))} /></Field>
            <Field label="Service Type">
              <select value={schedForm.service_type} onChange={e => setSchedForm(p => ({ ...p, service_type: e.target.value }))}>
                <option value="lawn">Lawn</option><option value="flowers">Flowers</option><option value="both">Both</option>
              </select>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Status">
              <select value={schedForm.status} onChange={e => setSchedForm(p => ({ ...p, status: e.target.value }))}>
                <option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Cost ($)">
              <input type="number" value={schedForm.cost} onChange={e => setSchedForm(p => ({ ...p, cost: e.target.value }))} placeholder={getLot(scheduleModal.signup.lot).priceVisit ?? "0"} />
            </Field>
          </FieldRow>
          <Field label="Notes">
            <textarea value={schedForm.notes} onChange={e => setSchedForm(p => ({ ...p, notes: e.target.value }))} style={{ minHeight: 60 }} placeholder="Anything to note for this visit…" />
          </Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => setScheduleModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveSchedule} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</> : scheduleModal.editing ? "Save Changes" : "Add to Schedule"}
            </button>
          </div>
        </Modal>
      )}

      {/* Visit Modal */}
      {visitModal && (
        <Modal title="Log a Visit" subtitle={`${visitModal.first_name} ${visitModal.last_name} · ${visitModal.address}`} onClose={() => setVisitModal(null)}>
          <FieldRow>
            <Field label="Visit Date"><input type="date" value={visitForm.visit_date} onChange={e => setVisitForm(p => ({ ...p, visit_date: e.target.value }))} /></Field>
            <Field label="Service Type">
              <select value={visitForm.service_type} onChange={e => setVisitForm(p => ({ ...p, service_type: e.target.value }))}>
                <option value="lawn">Lawn</option><option value="flowers">Flowers</option><option value="both">Both</option>
              </select>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Status">
              <select value={visitForm.status} onChange={e => setVisitForm(p => ({ ...p, status: e.target.value }))}>
                <option value="completed">Completed</option><option value="scheduled">Scheduled</option>
              </select>
            </Field>
            <Field label="Cost ($)">
              <input type="number" value={visitForm.cost} onChange={e => setVisitForm(p => ({ ...p, cost: e.target.value }))} placeholder={getLot(visitModal.lot).priceVisit ?? "0"} />
            </Field>
          </FieldRow>
          <Field label="Notes (optional)">
            <textarea value={visitForm.notes} onChange={e => setVisitForm(p => ({ ...p, notes: e.target.value }))} style={{ minHeight: 60 }} />
          </Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => setVisitModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddVisit} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</> : "Log Visit"}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Customer Modal */}
      {editSignup && (
        <Modal title={`${editSignup.first_name} ${editSignup.last_name}`} subtitle="Edit Customer" onClose={() => setEditSignup(null)}>
          <Field label="Services">
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              {["lawn","flowers"].map(sv => (
                <label key={sv} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'EB Garamond',serif", fontSize: 15, textTransform: "none", letterSpacing: 0, color: "var(--bark)", cursor: "pointer" }}>
                  <input type="checkbox" checked={(editSignup.services ?? []).includes(sv)}
                    onChange={e => setEditSignup(p => ({ ...p, services: e.target.checked ? [...(p.services ?? []), sv] : (p.services ?? []).filter(s => s !== sv) }))}
                    style={{ width: "auto" }} />
                  {sv.charAt(0).toUpperCase() + sv.slice(1)}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Billing">
            <select value={editSignup.billing ?? "monthly"} onChange={e => setEditSignup(p => ({ ...p, billing: e.target.value }))}>
              <option value="monthly">Monthly (4 visits/mo)</option><option value="per-visit">Per Visit</option>
            </select>
          </Field>
          <Field label="Internal Notes">
            <textarea value={editSignup.notes ?? ""} onChange={e => setEditSignup(p => ({ ...p, notes: e.target.value }))} style={{ minHeight: 60 }} placeholder="Gate code, dog in yard, etc." />
          </Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => setEditSignup(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpdateSignup} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</> : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      {/* Invoice Modal */}
      {invoiceModal && (
        <Modal title="Invoice" subtitle={`${invoiceModal.signup.first_name} ${invoiceModal.signup.last_name}`} onClose={() => setInvoiceModal(null)}>
          <p style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--stone)", marginBottom: 12 }}>Copy this text into Canva or your invoice template.</p>
          <textarea
            readOnly
            value={invoiceModal.text}
            style={{ fontFamily: "'Courier Prime',monospace", fontSize: 12, minHeight: 320, lineHeight: 1.7, background: "var(--parchment)", border: "2px solid var(--border)", width: "100%", padding: 12 }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button className="btn btn-green" onClick={() => { navigator.clipboard.writeText(invoiceModal.text); showToast("Invoice text copied."); }}>
              <Ic.Clip s={11} /> Copy to Clipboard
            </button>
            <button className="btn btn-ghost" onClick={() => setInvoiceModal(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Main LawnPage ────────────────────────────────────────────────────────────
const BASE_TABS = [
  { key: "home",    label: "Home" },
  { key: "about",   label: "About" },
  { key: "signup",  label: "Sign Up", hideWhenSignup: true },
  { key: "account", label: "My Account" },
  { key: "contact", label: "Contact" },
];

export default function LawnPage({ user, profile, onSignOut, onProfileUpdate }) {
  const [tab, setTab]             = useState("home");
  const [showAuth, setShowAuth]   = useState(false);
  const [toast, setToast]         = useState(null);
  const [signupKey, setSignupKey] = useState(0);
  const [hasSignup, setHasSignup] = useState(false);

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);
  const isAdmin   = profile?.role === "admin";

  // Check if user has signup (to hide the Sign Up tab)
  useEffect(() => {
    if (!user) { setHasSignup(false); return; }
    fetchLawnSignup(user.id).then(s => setHasSignup(!!s)).catch(() => {});
  }, [user?.id, signupKey]);

  // Handle ?page= redirect from magic link
  const [pendingPage] = useState(() => new URLSearchParams(window.location.search).get('page'));
  useEffect(() => {
    if (!user || !pendingPage) return;
    const valid = ["home", "about", "signup", "account", "contact"];
    if (valid.includes(pendingPage)) {
      setTab(pendingPage);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user, pendingPage]);

  const navTabs = BASE_TABS
    .filter(t => !(t.hideWhenSignup && hasSignup))
    .concat(isAdmin ? [{ key: "admin", label: "Admin" }] : []);

  return (
    <>
      <GlobalStyle />

      {/* Header */}
      <header style={{ background: "var(--header-bg)", color: "var(--bg)", padding: "26px 24px 16px", textAlign: "center", borderBottom: "4px solid var(--grass)" }}>
        <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--grass-light)", marginBottom: 8, fontWeight: 700 }}>Est. 2024 · Lawn Care Done Right</div>
        <h1 onClick={() => setTab("home")} style={{ fontSize: "clamp(36px,7vw,64px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 6, cursor: "pointer", color: "#fff" }}>
          HoneyDew
        </h1>
        <p style={{ fontFamily: "'EB Garamond',serif", fontSize: 16, fontStyle: "italic", color: "rgba(240,232,208,0.6)" }}>
          Lawn Services &amp; The Glasshouse
        </p>
      </header>

      {/* Nav */}
      <nav style={{ background: "var(--nav-bg)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", borderBottom: "3px solid var(--grass)", flexWrap: "wrap", gap: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap" }} className="nav-inner">
          {navTabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ background: tab === t.key ? "var(--grass)" : "transparent", color: tab === t.key ? "#fff" : "rgba(240,232,208,0.65)", border: "none", borderBottom: `3px solid ${tab === t.key ? "var(--grass-light)" : "transparent"}`, padding: "12px 16px", cursor: "pointer", fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
          {user ? (
            <>
              <span style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,232,208,0.55)" }}>
                {profile?.full_name?.split(" ")[0] ?? user.email.split("@")[0]}
                {isAdmin && <span style={{ color: "var(--grass-light)", marginLeft: 4 }}> · Admin</span>}
              </span>
              <button className="btn btn-ghost" style={{ color: "rgba(240,232,208,0.6)", borderColor: "rgba(240,232,208,0.2)", padding: "6px 14px" }} onClick={onSignOut}>Sign Out</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" style={{ color: "rgba(240,232,208,0.7)", borderColor: "rgba(240,232,208,0.25)", padding: "6px 14px" }} onClick={() => setTab("signup")}>Sign Up</button>
              <button className="btn btn-ghost" style={{ color: "rgba(240,232,208,0.6)", borderColor: "rgba(240,232,208,0.2)", padding: "6px 14px" }} onClick={() => setShowAuth(true)}>Sign In</button>
            </>
          )}
        </div>
      </nav>

      {/* Page content */}
      <div key={tab}>
        {tab === "home"    && <HomePage onNav={setTab} />}
        {tab === "about"   && <AboutPage />}
        {tab === "signup"  && <SignupPage user={user} onNav={setTab} onSignupComplete={() => { setSignupKey(k => k + 1); setHasSignup(true); }} showToast={showToast} />}
        {tab === "account" && <AccountPage key={signupKey} user={user} onNav={setTab} showToast={showToast} onSignupLoaded={() => setHasSignup(true)} />}
        {tab === "contact" && <ContactPage user={user} showToast={showToast} />}
        {tab === "admin"   && isAdmin && <AdminPage user={user} showToast={showToast} />}
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {toast && <Toast key={Date.now()} message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </>
  );
}
