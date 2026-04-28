import { useState, useEffect, useCallback } from "react";
import {
  signInWithEmail, signOut,
  fetchLawnSignup, saveLawnSignup,
  fetchVisits, fetchAllVisits, upsertVisit, updateVisitStatus, deleteVisit,
  saveContactMessage, fetchContactMessages,
  fetchAllSignups, updateSignup,
} from "./supabase.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const LOT_OPTIONS = [
  { value: "small",  label: "Up to ¼ acre",  priceVisit: 35,  priceMonth: 120 },
  { value: "medium", label: "¼ – ½ acre",    priceVisit: 55,  priceMonth: 190 },
  { value: "large",  label: "½ – 1 acre",    priceVisit: 85,  priceMonth: 300 },
  { value: "xlarge", label: "1 – 2 acres",   priceVisit: 130, priceMonth: 460 },
  { value: "custom", label: "2+ acres",       priceVisit: null, priceMonth: null },
];
const getLot = (v) => LOT_OPTIONS.find(l => l.value === v) ?? LOT_OPTIONS[0];

const PAYMENT_OPTIONS = [
  { value: "venmo",   icon: "💸", label: "Venmo",          desc: "Pay after each visit or monthly" },
  { value: "cash",    icon: "💵", label: "Cash / Check",   desc: "Leave in mailbox or hand to crew" },
  { value: "invoice", icon: "📬", label: "Monthly Invoice",desc: "Email invoice on the 1st — pay by the 5th" },
];

const SERVICE_OPTIONS = [
  { id: "lawn",    name: "Full Lawn Service", priceNote: "Pricing by lot size", desc: "Mow, edge, trim & clean" },
  { id: "flowers", name: "Monthly Flowers",   priceNote: "$90/mo · $25 add-on", desc: "Fresh seasonal flowers brought in & planted monthly" },
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ─── Global styles ────────────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --cream: #f5f0e6; --parchment: #ece5d3; --bark: #2b1b11;
      --moss: #4a6741; --moss-light: #6a8f5f; --stone: #7a6e5e;
      --tan: #c8bea8; --warm-white: #faf8f2; --header-bg: #2b1b11;
      --nav-bg: #1e1209; --card-bg: #faf8f2; --page-bg: #f5f0e6;
      --input-bg: #faf8f2; --border: #c8bea8; --danger: #b04040;
      --gold: #8a6a20;
    }
    body { background: var(--page-bg); font-family: 'EB Garamond', Georgia, serif; color: var(--bark); }
    h1,h2,h3,h4 { font-family: 'Playfair Display', Georgia, serif; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin   { to { transform: rotate(360deg); } }
    .fade-in { animation: fadeIn 0.3s ease; }
    .spinner {
      display: inline-block; width: 18px; height: 18px;
      border: 2px solid var(--tan); border-top-color: var(--moss);
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    .btn {
      border: none; cursor: pointer; font-family: 'Courier Prime', monospace;
      font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase;
      transition: all 0.18s ease; padding: 9px 20px; display: inline-flex;
      align-items: center; gap: 6px;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: var(--moss); color: var(--cream); }
    .btn-primary:hover:not(:disabled) { background: var(--moss-light); }
    .btn-ghost { background: transparent; color: var(--stone); border: 1px solid var(--border); }
    .btn-ghost:hover:not(:disabled) { border-color: var(--stone); color: var(--bark); }
    .btn-danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); }
    .btn-danger:hover:not(:disabled) { background: var(--danger); color: #fff; }
    .btn-dark { background: var(--bark); color: var(--cream); }
    .btn-dark:hover:not(:disabled) { background: #3d2a1a; }
    .tag {
      display: inline-block; background: rgba(74,103,65,0.12); color: var(--moss);
      border: 1px solid rgba(74,103,65,0.28); padding: 2px 8px;
      font-family: 'Courier Prime', monospace; font-size: 10px;
      letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700;
    }
    .tag-gold { background: rgba(138,106,32,0.12); color: var(--gold); border-color: rgba(138,106,32,0.3); }
    .tag-off  { background: rgba(0,0,0,0.04); color: var(--stone); border-color: var(--border); }
    input, select, textarea {
      width: 100%; background: var(--input-bg); border: 1px solid var(--border);
      padding: 9px 12px; font-size: 15px; color: var(--bark);
      font-family: 'EB Garamond', Georgia, serif; outline: none;
      transition: border-color 0.15s;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--moss); }
    textarea { resize: vertical; min-height: 80px; line-height: 1.6; }
    label {
      font-family: 'Courier Prime', monospace; font-size: 10px;
      letter-spacing: 0.15em; text-transform: uppercase;
      color: var(--moss); font-weight: 700; display: block; margin-bottom: 5px;
    }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: var(--parchment); }
    ::-webkit-scrollbar-thumb { background: var(--tan); }
    ::-webkit-scrollbar-thumb:hover { background: var(--stone); }
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      backdrop-filter: blur(3px); z-index: 200;
      display: flex; align-items: flex-start; justify-content: center;
      overflow-y: auto; padding: 24px 16px;
    }
    .modal {
      background: var(--cream); border: 1px solid var(--border);
      width: 100%; max-width: 520px; margin: auto;
      animation: fadeIn 0.25s ease;
    }
  `}</style>
);

// ─── Tiny shared components ───────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}

function FieldRow({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{children}</div>;
}

function Card({ children, style }) {
  return <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", padding: 24, ...style }}>{children}</div>;
}

function Parchment({ children, style }) {
  return <div style={{ background: "var(--parchment)", border: "1px solid var(--border)", padding: "16px 20px", ...style }}>{children}</div>;
}

function SectionRule({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 18px" }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--moss)", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function StatBox({ label, value, note }) {
  return (
    <Parchment>
      <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--moss)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: "var(--bark)" }}>{value}</div>
      {note && <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", marginTop: 2 }}>{note}</div>}
    </Parchment>
  );
}

function ErrMsg({ msg }) {
  if (!msg) return null;
  return <p style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--danger)", margin: "8px 0" }}>{msg}</p>;
}

function Toast({ message, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 300,
      background: "var(--bark)", color: "var(--cream)",
      padding: "12px 20px", fontFamily: "'Courier Prime',monospace",
      fontSize: 12, letterSpacing: "0.05em", animation: "fadeIn 0.2s ease",
      maxWidth: 320, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      borderLeft: `3px solid ${type === "error" ? "var(--danger)" : "var(--moss)"}`,
    }}>{message}</div>
  );
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({ onClose }) {
  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");

  const handleSubmit = async () => {
    setErr("");
    if (!email || !email.includes("@")) { setErr("Please enter a valid email."); return; }
    setLoading(true);
    try {
      await signInWithEmail(email);
      setSent(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ background: "var(--header-bg)", color: "var(--cream)", padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.5, marginBottom: 2 }}>HoneyDew</div>
            <h3 style={{ color: "var(--cream)", fontSize: 22 }}>Sign In</h3>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--cream)", fontSize: 24, cursor: "pointer", opacity: 0.7 }}>×</button>
        </div>
        <div style={{ padding: 28 }}>
          {sent ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>✉️</div>
              <h3 style={{ fontSize: 22, marginBottom: 10 }}>Check your inbox</h3>
              <p style={{ fontSize: 16, color: "var(--stone)", lineHeight: 1.65 }}>
                We sent a magic link to <strong>{email}</strong>.<br />
                Click it to sign in — no password needed.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", lineHeight: 1.65, marginBottom: 20 }}>
                Enter your email and we'll send you a magic link. Same account works for The Glasshouse.
              </p>
              <Field label="Email Address">
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder="you@email.com"
                  autoFocus
                />
              </Field>
              <ErrMsg msg={err} />
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: 12, marginTop: 4, justifyContent: "center" }}>
                {loading ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Sending…</> : "Send Magic Link →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page: Home ───────────────────────────────────────────────────────────────
function HomePage({ onNav }) {
  return (
    <div className="fade-in">
      {/* Hero */}
      <div style={{ background: "var(--parchment)", borderBottom: "3px double var(--border)", padding: "44px 32px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--moss)" }}>HoneyDew Lawn Services</span>
              <div style={{ flex: 1, height: 1, background: "rgba(74,103,65,0.3)" }} />
            </div>
            <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 900, lineHeight: 1.1, color: "var(--bark)", marginBottom: 14 }}>
              Fresh lawns.<br />Happy neighbors.
            </h2>
            <p style={{ fontSize: 17, fontStyle: "italic", color: "var(--stone)", lineHeight: 1.7, marginBottom: 26 }}>
              Reliable, botanical-minded lawn care right on your block. Simple sign-up, flexible plans, cancel anytime.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-dark" onClick={() => onNav("signup")}>Sign Up Today</button>
              <button className="btn btn-ghost" onClick={() => onNav("contact")}>Get in Touch</button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { n: "I.",   label: "Sign Up",  desc: "Choose your services online in 2 minutes" },
              { n: "II.",  label: "We Visit", desc: "Scheduled weekly or monthly at your convenience" },
              { n: "III.", label: "Enjoy",    desc: "Track visits & manage services in your account" },
            ].map(s => (
              <div key={s.n} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "var(--moss)", flexShrink: 0, lineHeight: 1 }}>{s.n}</div>
                <div>
                  <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--moss)", marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 14, color: "var(--stone)", lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px" }}>
        <SectionRule label="Our Services" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 36 }}>
          {/* Lawn */}
          <Card style={{ borderLeft: "3px solid var(--moss)" }}>
            <span className="tag" style={{ marginBottom: 12, display: "inline-block" }}>Most Popular</span>
            <h3 style={{ fontSize: 20, marginBottom: 4 }}>Full Lawn Service</h3>
            <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--moss)", letterSpacing: "0.05em", marginBottom: 10 }}>Pricing by lot size</div>
            <p style={{ fontSize: 15, color: "var(--stone)", lineHeight: 1.6, marginBottom: 16 }}>Complete mow, edge, trim, and cleanup every visit.</p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["Lot Size","Per Visit","Monthly"].map(h => (
                  <th key={h} style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--moss)", padding: "0 0 8px", textAlign: "left", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {LOT_OPTIONS.map(l => (
                  <tr key={l.value}>
                    <td style={{ fontSize: 13, padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.04)", color: "var(--bark)" }}>{l.label}</td>
                    <td style={{ fontSize: 12, padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.04)", color: "var(--moss)", fontFamily: "'Courier Prime',monospace" }}>{l.priceVisit ? `$${l.priceVisit}` : "—"}</td>
                    <td style={{ fontSize: 12, padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.04)", color: "var(--moss)", fontFamily: "'Courier Prime',monospace" }}>{l.priceMonth ? `$${l.priceMonth}` : <em style={{ color: "var(--stone)" }}>Quote</em>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {/* Flowers */}
          <Card>
            <span className="tag tag-gold" style={{ marginBottom: 12, display: "inline-block" }}>Add-On</span>
            <h3 style={{ fontSize: 20, marginBottom: 4 }}>Monthly Flowers</h3>
            <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--moss)", letterSpacing: "0.05em", marginBottom: 10 }}>$90 / month · $25 per visit add-on</div>
            <p style={{ fontSize: 15, color: "var(--stone)", lineHeight: 1.6, marginBottom: 14 }}>
              We source and bring in fresh seasonal flowers each month — planted, arranged, and refreshed in your beds so there's always something in bloom.
            </p>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
              {["Hand-selected seasonal varieties", "Delivered & planted by us each month", "Bed prep, soil & mulch touch-up", "Removed & replaced as seasons turn"].map(f => (
                <li key={f} style={{ fontSize: 13, color: "var(--stone)", display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--moss)", flexShrink: 0, marginTop: 6, display: "inline-block" }} />{f}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* CTA */}
        <div style={{ background: "var(--bark)", color: "var(--cream)", padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, borderTop: "3px double rgba(245,240,230,0.25)" }}>
          <div>
            <h3 style={{ color: "var(--cream)", fontSize: 22, marginBottom: 4 }}>Ready to sign up?</h3>
            <p style={{ fontFamily: "'EB Garamond',serif", fontSize: 15, opacity: 0.7, fontStyle: "italic" }}>Takes 2 minutes. Your neighbors already have.</p>
          </div>
          <button className="btn" style={{ background: "var(--cream)", color: "var(--bark)", padding: "12px 24px" }} onClick={() => onNav("signup")}>Get Started →</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page: Sign Up ────────────────────────────────────────────────────────────
function SignupPage({ user, onNav, onSignupComplete, showToast }) {
  const [form, setForm]       = useState({ first_name: "", last_name: "", address: "", lot: "small", billing: "monthly", preferred_day: "", notes: "", payment_method: "venmo" });
  const [services, setServices] = useState({ lawn: true, flowers: false });
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const [success, setSuccess] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // Pre-fill if already signed up
  useEffect(() => {
    if (!user) return;
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
    if (!form.first_name || !form.last_name) return setErr("Please enter your full name.");
    if (!form.address) return setErr("Please enter your address.");
    if (!services.lawn && !services.flowers) return setErr("Please select at least one service.");
    if (!user) { setShowAuth(true); return; }
    setSaving(true);
    try {
      const svcList = Object.entries(services).filter(([, v]) => v).map(([k]) => k);
      await saveLawnSignup({ user_id: user.id, ...form, services: svcList });
      setSuccess(true);
      onSignupComplete?.();
      showToast("You're signed up for HoneyDew! 🌿");
    } catch (e) {
      setErr("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (success) return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px" }} className="fade-in">
      <Card style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
        <h2 style={{ fontSize: 28, marginBottom: 10 }}>Welcome to HoneyDew.</h2>
        <p style={{ fontSize: 17, color: "var(--stone)", lineHeight: 1.7, maxWidth: 380, margin: "0 auto 24px" }}>
          You're all set. We'll be in touch to confirm your first visit.
        </p>
        <button className="btn btn-primary" onClick={() => onNav("account")} style={{ padding: "12px 28px" }}>Go to My Account →</button>
      </Card>
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 60px" }} className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--moss)", marginBottom: 6 }}>HoneyDew Lawn Services</div>
        <h2 style={{ fontSize: 32, marginBottom: 8 }}>{user ? "Update Your Signup" : "Join the Collection"}</h2>
        <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", lineHeight: 1.65 }}>
          One account for HoneyDew Lawn Services and The Glasshouse. Sign up once — access both.
        </p>
      </div>
      <Card>
        <FieldRow>
          <Field label="First Name"><input value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="Jane" /></Field>
          <Field label="Last Name"><input value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="Doe" /></Field>
        </FieldRow>
        <Field label="Your Address"><input value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Your Street" /></Field>

        <Field label="Approximate Lot Size">
          <select value={form.lot} onChange={e => set("lot", e.target.value)}>
            {LOT_OPTIONS.map(l => (
              <option key={l.value} value={l.value}>
                {l.label}{l.priceVisit ? ` — $${l.priceVisit}/visit or $${l.priceMonth}/mo` : " — Custom quote"}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Choose Your Services">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 6 }}>
            {SERVICE_OPTIONS.map(s => (
              <div key={s.id} onClick={() => setServices(p => ({ ...p, [s.id]: !p[s.id] }))}
                style={{ background: services[s.id] ? "rgba(74,103,65,0.06)" : "var(--card-bg)", border: `${services[s.id] ? 2 : 1}px solid ${services[s.id] ? "var(--moss)" : "var(--border)"}`, padding: "14px 16px", cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
                {services[s.id] && <div style={{ position: "absolute", top: 10, right: 10, width: 18, height: 18, borderRadius: "50%", background: "var(--moss)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--cream)" }}>✓</div>}
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: "var(--bark)", marginBottom: 3 }}>{s.name}</div>
                <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--moss)", letterSpacing: "0.05em", marginBottom: 4 }}>{s.priceNote}</div>
                <div style={{ fontSize: 13, color: "var(--stone)", lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Field>

        <FieldRow>
          <Field label="Preferred Billing">
            <select value={form.billing} onChange={e => set("billing", e.target.value)}>
              <option value="monthly">Monthly — best value</option>
              <option value="per-visit">Per visit</option>
            </select>
          </Field>
          <Field label="Preferred Mow Day">
            <select value={form.preferred_day} onChange={e => set("preferred_day", e.target.value)}>
              <option value="">No preference</option>
              {DAYS.map(d => <option key={d}>{d}</option>)}
            </select>
          </Field>
        </FieldRow>

        <Field label="Notes for Us (optional)">
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Gate code, dog in yard, areas to avoid…" style={{ minHeight: 70 }} />
        </Field>

        <SectionRule label="Payment Setup" />
        {PAYMENT_OPTIONS.map(po => (
          <div key={po.value} onClick={() => set("payment_method", po.value)}
            style={{ background: form.payment_method === po.value ? "rgba(74,103,65,0.05)" : "var(--parchment)", border: `${form.payment_method === po.value ? 2 : 1}px solid ${form.payment_method === po.value ? "var(--moss)" : "var(--border)"}`, padding: "13px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, marginBottom: 10, transition: "all 0.2s" }}>
            <div style={{ fontSize: 22 }}>{po.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: "var(--bark)", marginBottom: 2 }}>{po.label}</div>
              <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", letterSpacing: "0.05em" }}>{po.desc}</div>
            </div>
            <div style={{ width: 16, height: 16, border: "2px solid var(--border)", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {form.payment_method === po.value && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--moss)" }} />}
            </div>
          </div>
        ))}

        <ErrMsg msg={err} />
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ width: "100%", marginTop: 14, padding: 13, justifyContent: "center" }}>
          {saving ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</> : `${user ? "Update" : "Complete"} Sign Up →`}
        </button>
        {!user && <p style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", textAlign: "center", marginTop: 10, letterSpacing: "0.05em" }}>You'll be prompted to sign in when you submit.</p>}
      </Card>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}

// ─── Page: Account ────────────────────────────────────────────────────────────
function AccountPage({ user, onNav, showToast }) {
  const [signup, setSignup]   = useState(null);
  const [visits, setVisits]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([fetchLawnSignup(user.id), fetchVisits(user.id)])
      .then(([s, v]) => { setSignup(s); setVisits(v); })
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

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div>;

  if (!user) return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "60px 24px", textAlign: "center" }} className="fade-in">
      <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
      <h2 style={{ fontSize: 28, marginBottom: 10 }}>Your HoneyDew Account</h2>
      <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", maxWidth: 360, margin: "0 auto 24px", lineHeight: 1.7 }}>
        Sign in to manage your lawn services, track visits, and update your plan.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => onNav("signup")} style={{ padding: "12px 24px" }}>Create Account</button>
        <button className="btn btn-ghost" onClick={() => setShowAuth(true)} style={{ padding: "12px 24px" }}>Sign In</button>
      </div>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );

  if (!signup) return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "60px 24px", textAlign: "center" }} className="fade-in">
      <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
      <h2 style={{ fontSize: 24, marginBottom: 10 }}>No signup yet</h2>
      <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", marginBottom: 20, lineHeight: 1.7 }}>You're signed in but haven't signed up for lawn service yet.</p>
      <button className="btn btn-primary" onClick={() => onNav("signup")} style={{ padding: "12px 28px" }}>Sign Up for Service →</button>
    </div>
  );

  const lot = getLot(signup.lot);
  const hasBoth = signup.services?.includes("lawn") && signup.services?.includes("flowers");
  const cpv = signup.billing === "monthly"
    ? `$${(lot.priceMonth ?? 0) + (hasBoth ? 90 : 0)}/mo`
    : `$${(lot.priceVisit ?? "?") + (hasBoth ? 25 : 0)}/visit`;
  const monthTotal = visits.filter(v => {
    const d = new Date(v.visit_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((a, v) => a + (v.cost ?? 0), 0);
  const payIcon = PAYMENT_OPTIONS.find(p => p.value === signup.payment_method)?.icon ?? "—";
  const payLabel = PAYMENT_OPTIONS.find(p => p.value === signup.payment_method)?.label ?? "—";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px" }} className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--moss)", marginBottom: 4 }}>HoneyDew Account</div>
          <h2 style={{ fontSize: 30, marginBottom: 3 }}>Hello, {signup.first_name}.</h2>
          <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--stone)", letterSpacing: "0.05em" }}>{signup.address} · {user.email}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => onNav("signup")}>Edit Signup</button>
          <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => signOut()}>Sign Out</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
        <StatBox label="Monthly Cost" value={lot.priceVisit ? cpv : "Custom"} note={signup.billing === "monthly" ? "monthly plan" : "per visit"} />
        <StatBox label="This Month" value={`$${monthTotal.toFixed(0)}`} note={`${visits.length} total visit${visits.length !== 1 ? "s" : ""}`} />
        <StatBox label="Lot Size" value={lot.label} note={`${signup.services?.length ?? 0} active service${signup.services?.length !== 1 ? "s" : ""}`} />
      </div>

      <SectionRule label="My Services" />
      <div style={{ marginBottom: 24 }}>
        {[
          { id: "lawn",    name: "Full Lawn Service", price: () => signup.billing === "monthly" ? `$${lot.priceMonth}/mo` : `$${lot.priceVisit}/visit` },
          { id: "flowers", name: "Monthly Flowers",   price: () => signup.billing === "monthly" ? "$90/mo" : "$25/visit add-on" },
        ].map(s => {
          const active = signup.services?.includes(s.id);
          return (
            <div key={s.id} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: "var(--bark)", marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", letterSpacing: "0.05em" }}>{s.price()} · {active ? "Active" : "Not subscribed"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`tag ${active ? "" : "tag-off"}`}>{active ? "Active" : "Off"}</span>
                <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 9 }} onClick={() => toggleSvc(s.id)}>{active ? "Remove" : "Add"}</button>
              </div>
            </div>
          );
        })}
      </div>

      <SectionRule label="Visit History" />
      {visits.length === 0 ? (
        <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", padding: "16px 0" }}>No visits yet — your first is coming soon.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            {["Date","Service","Status","Amount"].map(h => (
              <th key={h} style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--moss)", padding: "0 0 8px", textAlign: "left", borderBottom: "1px solid var(--border)" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {visits.map(v => (
              <tr key={v.id}>
                <td style={{ padding: "10px 0", fontSize: 14, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>{v.visit_date}</td>
                <td style={{ padding: "10px 0", fontSize: 14, borderBottom: "1px solid rgba(0,0,0,0.05)", textTransform: "capitalize" }}>{v.service_type}</td>
                <td style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <span style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.08em", padding: "2px 8px", textTransform: "uppercase", background: v.status === "completed" ? "rgba(74,103,65,0.15)" : "rgba(138,106,32,0.15)", color: v.status === "completed" ? "var(--moss)" : "var(--gold)" }}>
                    {v.status === "completed" ? "Completed" : "Scheduled"}
                  </span>
                </td>
                <td style={{ padding: "10px 0", fontSize: 14, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>${(v.cost ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SectionRule label="Payment Method" />
      <Parchment style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 15 }}>{payIcon} {payLabel}</div>
        <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => onNav("signup")}>Change</button>
      </Parchment>
    </div>
  );
}

// ─── Page: Schedule ───────────────────────────────────────────────────────────
function SchedulePage({ user, showToast }) {
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [signup, setSignup] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetchLawnSignup(user.id).then(setSignup).catch(() => {});
  }, [user?.id]);

  const visitDays = [2, 5, 9, 12, 16, 19, 23, 26];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const startDow = 3; // May 1 2025 = Thursday

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= 31; d++) cells.push(d);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px" }} className="fade-in">
      <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--moss)", marginBottom: 6 }}>HoneyDew</div>
      <h2 style={{ fontSize: 30, marginBottom: 8 }}>Service Schedule</h2>
      <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", lineHeight: 1.65, marginBottom: 28 }}>
        View upcoming visits. Signed-in customers see their personal schedule below.
      </p>

      <SectionRule label="May 2025" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 28 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ background: "var(--parchment)", border: "1px solid var(--border)", minHeight: 70, opacity: 0.3 }} />;
          const dow = (startDow + d - 1) % 7;
          const hasVisit = visitDays.includes(d);
          return (
            <div key={i} onClick={() => showToast(hasVisit ? `Visit scheduled May ${d}` : `No visit on May ${d}`)}
              style={{ background: hasVisit ? "rgba(74,103,65,0.08)" : "var(--parchment)", border: `1px solid ${hasVisit ? "var(--moss)" : "var(--border)"}`, padding: "10px 6px", textAlign: "center", cursor: "pointer", minHeight: 70, transition: "all 0.2s" }}>
              <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--stone)", marginBottom: 4 }}>{dayNames[dow]}</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: "var(--bark)" }}>{d}</div>
              {hasVisit && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--moss)", margin: "4px auto 0" }} />}
            </div>
          );
        })}
      </div>

      <SectionRule label="Upcoming Visits" />
      {[
        { date: "May 2, 2025",  day: "Friday",  note: user && signup ? `You (${signup.address})` : "Service day" },
        { date: "May 9, 2025",  day: "Friday",  note: "Service day" },
        { date: "May 16, 2025", day: "Friday",  note: "Service day" },
        { date: "May 23, 2025", day: "Friday",  note: "Service day" },
      ].map(u => (
        <div key={u.date} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", padding: "14px 18px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: "var(--bark)" }}>{u.date}</div>
            <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{u.day}</div>
          </div>
          <div style={{ fontSize: 14, color: "var(--stone)" }}>{u.note}</div>
        </div>
      ))}

      <SectionRule label="Request a Reschedule" />
      <Card style={{ maxWidth: 500 }}>
        {submitted ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <p style={{ fontSize: 16, color: "var(--stone)" }}>Reschedule request submitted. We'll confirm shortly.</p>
          </div>
        ) : (
          <>
            <Field label="Preferred New Date">
              <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
            </Field>
            <Field label="Reason (optional)">
              <textarea placeholder="Travel, event, etc." style={{ minHeight: 60 }} />
            </Field>
            <button className="btn btn-primary" onClick={() => {
              if (!rescheduleDate) { showToast("Please select a date", "error"); return; }
              setSubmitted(true);
              showToast("Reschedule request submitted");
            }}>Submit Request</button>
          </>
        )}
      </Card>
    </div>
  );
}

// ─── Page: Contact ────────────────────────────────────────────────────────────
function ContactPage({ user, showToast }) {
  const [form, setForm] = useState({ name: "", email: user?.email ?? "", address: "", topic: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    setErr("");
    if (!form.name) return setErr("Please enter your name.");
    if (!form.email || !form.email.includes("@")) return setErr("Please enter a valid email.");
    if (!form.message) return setErr("Please enter a message.");
    setSaving(true);
    try {
      await saveContactMessage({ name: form.name, email: form.email, address: form.address, topic: form.topic || "General", message: form.message });
      setSent(true);
      showToast("Message sent!");
    } catch (e) {
      setErr("Send failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px" }} className="fade-in">
      <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--moss)", marginBottom: 6 }}>HoneyDew</div>
      <h2 style={{ fontSize: 30, marginBottom: 8 }}>Get in Touch</h2>
      <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic", lineHeight: 1.65, marginBottom: 28 }}>
        Questions about services, pricing, or your yard? We're right in the neighborhood.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
        <div>
          {sent ? (
            <Card style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✉️</div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>Message Sent</h3>
              <p style={{ fontSize: 15, color: "var(--stone)", lineHeight: 1.65 }}>Thanks! We typically respond within 24 hours.</p>
            </Card>
          ) : (
            <Card>
              <Field label="Your Name"><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Jane Doe" /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@email.com" /></Field>
              <Field label="Address (optional)"><input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Your street address" /></Field>
              <Field label="Topic">
                <select value={form.topic} onChange={e => set("topic", e.target.value)}>
                  <option value="">Select a topic…</option>
                  {["New service inquiry","Pricing question","Schedule change","Service feedback","Billing question","Other"].map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Message"><textarea value={form.message} onChange={e => set("message", e.target.value)} placeholder="How can we help?" style={{ minHeight: 100 }} /></Field>
              <ErrMsg msg={err} />
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ width: "100%", padding: 12, justifyContent: "center" }}>
                {saving ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Sending…</> : "Send Message →"}
              </button>
            </Card>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Parchment>
            <label style={{ marginBottom: 10, display: "block" }}>Service Hours</label>
            <p style={{ fontSize: 14, color: "var(--stone)", lineHeight: 1.8 }}>Mon – Fri: 8am – 6pm<br />Saturday: 9am – 3pm<br />Sunday: Rest day 🌿</p>
          </Parchment>
          <Parchment>
            <label style={{ marginBottom: 10, display: "block" }}>Quick Links</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[["→ Sign up for service","signup"],["→ View schedule","schedule"]].map(([l, p]) => (
                <button key={p} className="btn btn-ghost" style={{ textAlign: "left", padding: "8px 14px", width: "100%" }} onClick={() => {}}>
                  {l}
                </button>
              ))}
            </div>
          </Parchment>
        </div>
      </div>
    </div>
  );
}

// ─── Page: Admin ──────────────────────────────────────────────────────────────
function AdminPage({ user, showToast }) {
  const [signups, setSignups]     = useState([]);
  const [visits, setVisits]       = useState([]);
  const [messages, setMessages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("customers");
  const [showVisitModal, setShowVisitModal] = useState(null); // signup row
  const [visitForm, setVisitForm] = useState({ visit_date: "", service_type: "lawn", status: "scheduled", cost: "", notes: "" });
  const [saving, setSaving]       = useState(false);
  const [editSignup, setEditSignup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, v, m] = await Promise.all([fetchAllSignups(), fetchAllVisits(), fetchContactMessages()]);
      setSignups(s);
      setVisits(v);
      setMessages(m);
    } catch (e) {
      showToast("Load failed: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkVisit = async (visitId, status) => {
    try {
      await updateVisitStatus(visitId, status);
      setVisits(prev => prev.map(v => v.id === visitId ? { ...v, status } : v));
      showToast(`Visit marked ${status}`);
    } catch (e) { showToast("Update failed: " + e.message, "error"); }
  };

  const handleDeleteVisit = async (visitId) => {
    if (!confirm("Delete this visit?")) return;
    try {
      await deleteVisit(visitId);
      setVisits(prev => prev.filter(v => v.id !== visitId));
      showToast("Visit deleted");
    } catch (e) { showToast("Delete failed: " + e.message, "error"); }
  };

  const handleAddVisit = async () => {
    if (!showVisitModal) return;
    if (!visitForm.visit_date) { showToast("Please select a date", "error"); return; }
    setSaving(true);
    try {
      const saved = await upsertVisit({ user_id: showVisitModal.user_id, ...visitForm, cost: parseFloat(visitForm.cost) || null });
      setVisits(prev => [saved, ...prev]);
      setShowVisitModal(null);
      setVisitForm({ visit_date: "", service_type: "lawn", status: "scheduled", cost: "", notes: "" });
      showToast("Visit added");
    } catch (e) { showToast("Failed: " + e.message, "error"); } finally { setSaving(false); }
  };

  const handleUpdateSignup = async () => {
    if (!editSignup) return;
    setSaving(true);
    try {
      const updated = await updateSignup(editSignup.id, { next_visit: editSignup.next_visit, notes: editSignup.notes, services: editSignup.services, billing: editSignup.billing });
      setSignups(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
      setEditSignup(null);
      showToast("Customer updated");
    } catch (e) { showToast("Update failed: " + e.message, "error"); } finally { setSaving(false); }
  };

  // Stats
  const totalRev = signups.reduce((a, s) => {
    const lot = getLot(s.lot);
    if (s.billing === "monthly") {
      if (s.services?.includes("lawn")) a += lot.priceMonth ?? 0;
      if (s.services?.includes("flowers")) a += 90;
    }
    return a;
  }, 0);
  const flowerCount = signups.filter(s => s.services?.includes("flowers")).length;
  const pendingVisits = visits.filter(v => v.status === "scheduled").length;

  const adminTabs = [
    { key: "customers", label: `Customers (${signups.length})` },
    { key: "visits",    label: `Visits (${visits.length})` },
    { key: "messages",  label: `Messages (${messages.length})` },
  ];

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div>;

  return (
    <div className="fade-in">
      <div style={{ background: "var(--bark)", color: "var(--cream)", padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid var(--moss)" }}>
        <div>
          <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.5, marginBottom: 4 }}>HoneyDew · Owner View</div>
          <h2 style={{ color: "var(--cream)", fontSize: 24, fontWeight: 700 }}>Admin Dashboard</h2>
        </div>
        <button className="btn btn-ghost" style={{ color: "rgba(245,240,230,0.7)", borderColor: "rgba(245,240,230,0.2)", fontSize: 10 }} onClick={load}>↻ Refresh</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: "20px 24px 0" }}>
        <StatBox label="Total Customers" value={signups.length} />
        <StatBox label="Est. Monthly Rev." value={`$${totalRev}`} note="monthly plan subscribers" />
        <StatBox label="Flower Subscribers" value={flowerCount} />
        <StatBox label="Pending Visits" value={pendingVisits} note="scheduled but not done" />
      </div>

      {/* Sub-tabs */}
      <div style={{ padding: "0 24px" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginTop: 24 }}>
          {adminTabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ background: "transparent", border: "none", borderBottom: `2px solid ${activeTab === t.key ? "var(--moss)" : "transparent"}`, padding: "10px 18px", cursor: "pointer", fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: activeTab === t.key ? "var(--moss)" : "var(--stone)", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px 60px" }}>

        {/* ── Customers tab ── */}
        {activeTab === "customers" && (
          <div style={{ overflowX: "auto" }}>
            {signups.length === 0 ? (
              <Parchment style={{ textAlign: "center", padding: 32 }}>
                <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic" }}>No customers yet. Share your signup link!</p>
              </Parchment>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                <thead><tr>
                  {["Customer","Address","Lot","Services","Billing","Payment","Next Visit","Actions"].map(h => (
                    <th key={h} style={{ background: "var(--parchment)", fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--moss)", padding: "10px 14px", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {signups.map(s => (
                    <tr key={s.id} style={{ transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(74,103,65,0.04)"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                        <div style={{ fontWeight: 700, fontFamily: "'Playfair Display',serif", fontSize: 15 }}>{s.first_name} {s.last_name}</div>
                        <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)" }}>{s.profiles?.full_name ?? ""}</div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, borderBottom: "1px solid rgba(0,0,0,0.05)", color: "var(--stone)" }}>{s.address}</td>
                      <td style={{ padding: "12px 14px", fontSize: 12, borderBottom: "1px solid rgba(0,0,0,0.05)", fontFamily: "'Courier Prime',monospace", color: "var(--stone)" }}>{getLot(s.lot).label}</td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {(s.services ?? []).map(sv => <span key={sv} className="tag" style={{ fontSize: 9 }}>{sv}</span>)}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, borderBottom: "1px solid rgba(0,0,0,0.05)", fontFamily: "'Courier Prime',monospace", color: "var(--stone)", textTransform: "capitalize" }}>{s.billing}</td>
                      <td style={{ padding: "12px 14px", fontSize: 12, borderBottom: "1px solid rgba(0,0,0,0.05)", fontFamily: "'Courier Prime',monospace", color: "var(--stone)" }}>
                        {PAYMENT_OPTIONS.find(p => p.value === s.payment_method)?.label ?? "—"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, borderBottom: "1px solid rgba(0,0,0,0.05)", color: s.next_visit ? "var(--bark)" : "var(--stone)", fontStyle: s.next_visit ? "normal" : "italic" }}>
                        {s.next_visit || "Not set"}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => setShowVisitModal(s)}>+ Visit</button>
                          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => setEditSignup({ ...s })}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Visits tab ── */}
        {activeTab === "visits" && (
          <div style={{ overflowX: "auto" }}>
            {visits.length === 0 ? (
              <Parchment style={{ textAlign: "center", padding: 32 }}>
                <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic" }}>No visits recorded yet. Add one from the Customers tab.</p>
              </Parchment>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                <thead><tr>
                  {["Date","Customer","Service","Status","Cost","Notes","Actions"].map(h => (
                    <th key={h} style={{ background: "var(--parchment)", fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--moss)", padding: "10px 14px", textAlign: "left", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {visits.map(v => {
                    const s = v.lawn_signups;
                    const name = s ? `${s.first_name} ${s.last_name}` : "—";
                    return (
                      <tr key={v.id} onMouseEnter={e => e.currentTarget.style.background = "rgba(74,103,65,0.04)"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                        <td style={{ padding: "11px 14px", fontSize: 14, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>{v.visit_date}</td>
                        <td style={{ padding: "11px 14px", fontSize: 14, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14 }}>{name}</div>
                          {s?.address && <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)" }}>{s.address}</div>}
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: 13, borderBottom: "1px solid rgba(0,0,0,0.05)", textTransform: "capitalize" }}>{v.service_type}</td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                          <span style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, padding: "2px 8px", textTransform: "uppercase", background: v.status === "completed" ? "rgba(74,103,65,0.15)" : "rgba(138,106,32,0.15)", color: v.status === "completed" ? "var(--moss)" : "var(--gold)" }}>
                            {v.status}
                          </span>
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: 13, borderBottom: "1px solid rgba(0,0,0,0.05)", fontFamily: "'Courier Prime',monospace" }}>{v.cost ? `$${parseFloat(v.cost).toFixed(2)}` : "—"}</td>
                        <td style={{ padding: "11px 14px", fontSize: 13, borderBottom: "1px solid rgba(0,0,0,0.05)", color: "var(--stone)" }}>{v.notes || "—"}</td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            {v.status !== "completed" && (
                              <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => handleMarkVisit(v.id, "completed")}>✓ Done</button>
                            )}
                            {v.status === "completed" && (
                              <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => handleMarkVisit(v.id, "scheduled")}>Undo</button>
                            )}
                            <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => handleDeleteVisit(v.id)}>✕</button>
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

        {/* ── Messages tab ── */}
        {activeTab === "messages" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.length === 0 ? (
              <Parchment style={{ textAlign: "center", padding: 32 }}>
                <p style={{ fontSize: 16, color: "var(--stone)", fontStyle: "italic" }}>No messages yet.</p>
              </Parchment>
            ) : messages.map(m => (
              <Card key={m.id}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18 }}>{m.name}</div>
                  <span className="tag tag-gold">{m.topic}</span>
                  <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, color: "var(--stone)", marginLeft: "auto" }}>{new Date(m.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 11, color: "var(--stone)", marginBottom: 10 }}>
                  {m.email}{m.address ? ` · ${m.address}` : ""}
                </div>
                <p style={{ fontSize: 15, color: "var(--bark)", lineHeight: 1.65 }}>{m.message}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Visit Modal ── */}
      {showVisitModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowVisitModal(null)}>
          <div className="modal">
            <div style={{ background: "var(--header-bg)", color: "var(--cream)", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.5, marginBottom: 2 }}>Add Visit</div>
                <h3 style={{ color: "var(--cream)", fontSize: 20 }}>{showVisitModal.first_name} {showVisitModal.last_name}</h3>
              </div>
              <button onClick={() => setShowVisitModal(null)} style={{ background: "transparent", border: "none", color: "var(--cream)", fontSize: 24, cursor: "pointer", opacity: 0.7 }}>×</button>
            </div>
            <div style={{ padding: 24 }}>
              <FieldRow>
                <Field label="Visit Date"><input type="date" value={visitForm.visit_date} onChange={e => setVisitForm(p => ({ ...p, visit_date: e.target.value }))} /></Field>
                <Field label="Service Type">
                  <select value={visitForm.service_type} onChange={e => setVisitForm(p => ({ ...p, service_type: e.target.value }))}>
                    <option value="lawn">Lawn</option>
                    <option value="flowers">Flowers</option>
                    <option value="both">Both</option>
                  </select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Status">
                  <select value={visitForm.status} onChange={e => setVisitForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                  </select>
                </Field>
                <Field label="Cost ($)"><input type="number" value={visitForm.cost} onChange={e => setVisitForm(p => ({ ...p, cost: e.target.value }))} placeholder={getLot(showVisitModal.lot).priceVisit ?? ""} /></Field>
              </FieldRow>
              <Field label="Notes (optional)"><textarea value={visitForm.notes} onChange={e => setVisitForm(p => ({ ...p, notes: e.target.value }))} style={{ minHeight: 60 }} placeholder="Any notes about this visit…" /></Field>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={() => setShowVisitModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddVisit} disabled={saving}>
                  {saving ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</> : "Add Visit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Customer Modal ── */}
      {editSignup && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditSignup(null)}>
          <div className="modal">
            <div style={{ background: "var(--header-bg)", color: "var(--cream)", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.5, marginBottom: 2 }}>Edit Customer</div>
                <h3 style={{ color: "var(--cream)", fontSize: 20 }}>{editSignup.first_name} {editSignup.last_name}</h3>
              </div>
              <button onClick={() => setEditSignup(null)} style={{ background: "transparent", border: "none", color: "var(--cream)", fontSize: 24, cursor: "pointer", opacity: 0.7 }}>×</button>
            </div>
            <div style={{ padding: 24 }}>
              <Field label="Next Visit Date / Note">
                <input value={editSignup.next_visit ?? ""} onChange={e => setEditSignup(p => ({ ...p, next_visit: e.target.value }))} placeholder="e.g. May 2" />
              </Field>
              <Field label="Services">
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  {["lawn","flowers"].map(sv => (
                    <label key={sv} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'EB Garamond',serif", fontSize: 15, textTransform: "none", letterSpacing: 0, color: "var(--bark)", cursor: "pointer" }}>
                      <input type="checkbox" checked={(editSignup.services ?? []).includes(sv)}
                        onChange={e => setEditSignup(p => ({ ...p, services: e.target.checked ? [...(p.services ?? []), sv] : (p.services ?? []).filter(s => s !== sv) }))}
                        style={{ width: "auto", marginRight: 4 }} />
                      {sv.charAt(0).toUpperCase() + sv.slice(1)}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Billing">
                <select value={editSignup.billing ?? "monthly"} onChange={e => setEditSignup(p => ({ ...p, billing: e.target.value }))}>
                  <option value="monthly">Monthly</option>
                  <option value="per-visit">Per visit</option>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main LawnPage ────────────────────────────────────────────────────────────
const TABS = [
  { key: "home",     label: "Home" },
  { key: "signup",   label: "Sign Up" },
  { key: "account",  label: "My Account" },
  { key: "schedule", label: "Schedule" },
  { key: "contact",  label: "Contact" },
];

export default function LawnPage({ user, profile, onSignOut, onProfileUpdate }) {
  const [tab, setTab]           = useState("home");
  const [showAuth, setShowAuth] = useState(false);
  const [toast, setToast]       = useState(null);
  const [signupKey, setSignupKey] = useState(0); // force account refresh after signup

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);
  const isAdmin = profile?.role === "admin";

  const navTabs = isAdmin ? [...TABS, { key: "admin", label: "⚙ Admin" }] : TABS;

  return (
    <>
      <GlobalStyle />

      {/* Header */}
      <header style={{ background: "var(--header-bg)", color: "var(--cream)", padding: "28px 24px 18px", textAlign: "center", borderBottom: "5px double rgba(74,103,65,0.5)" }}>
        <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", opacity: 0.5, marginBottom: 8 }}>
          Est. 2024 · Lawn Care & Botanical Services
        </div>
        <h1 onClick={() => setTab("home")} style={{ fontSize: "clamp(32px,7vw,60px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 4, cursor: "pointer", color: "var(--cream)" }}>
          HoneyDew
        </h1>
        <p style={{ fontFamily: "'EB Garamond',serif", fontSize: 16, fontStyle: "italic", opacity: 0.65 }}>
          Lawn Services & The Glasshouse · A Botanical Record of the Neighborhood
        </p>
      </header>

      {/* Nav */}
      <nav style={{ background: "var(--nav-bg)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", borderBottom: "3px solid var(--moss)", flexWrap: "wrap", gap: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {navTabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: tab === t.key ? "var(--moss)" : "transparent",
              color: tab === t.key ? "var(--cream)" : "rgba(245,240,230,0.7)",
              border: "none", borderBottom: `2px solid ${tab === t.key ? "var(--moss-light)" : "transparent"}`,
              padding: "11px 14px", cursor: "pointer",
              fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.15em",
              textTransform: "uppercase", transition: "all 0.2s", whiteSpace: "nowrap",
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
          {user ? (
            <>
              <span style={{ fontFamily: "'Courier Prime',monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(245,240,230,0.6)" }}>
                {profile?.full_name?.split(" ")[0] ?? user.email.split("@")[0]}
                {isAdmin && <span style={{ color: "var(--moss-light)", marginLeft: 4 }}>· Admin</span>}
              </span>
              <button className="btn btn-ghost" style={{ color: "rgba(245,240,230,0.6)", borderColor: "rgba(245,240,230,0.2)", padding: "6px 14px" }} onClick={onSignOut}>Sign Out</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" style={{ color: "rgba(245,240,230,0.7)", borderColor: "rgba(245,240,230,0.25)", padding: "6px 14px" }} onClick={() => setTab("signup")}>Sign Up</button>
              <button className="btn btn-ghost" style={{ color: "rgba(245,240,230,0.6)", borderColor: "rgba(245,240,230,0.2)", padding: "6px 14px" }} onClick={() => setShowAuth(true)}>Sign In</button>
            </>
          )}
        </div>
      </nav>

      {/* Pages */}
      <div key={tab}>
        {tab === "home"     && <HomePage onNav={setTab} />}
        {tab === "signup"   && <SignupPage user={user} onNav={setTab} onSignupComplete={() => setSignupKey(k => k + 1)} showToast={showToast} />}
        {tab === "account"  && <AccountPage key={signupKey} user={user} onNav={setTab} showToast={showToast} />}
        {tab === "schedule" && <SchedulePage user={user} showToast={showToast} />}
        {tab === "contact"  && <ContactPage user={user} showToast={showToast} />}
        {tab === "admin"    && isAdmin && <AdminPage user={user} showToast={showToast} />}
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {toast && <Toast key={Date.now()} message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </>
  );
}