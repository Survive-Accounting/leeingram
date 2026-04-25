import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Fingerprint,
  Globe2,
  Mail,
  MonitorSmartphone,
  Shield,
  Sparkles,
  Activity,
  KeyRound,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Share2,
  Check,
  X,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

const NAVY = "#14213D";
const RED = "#CE1126";

type Category = {
  key: string;
  title: string;
  icon: typeof Shield;
  enabled: boolean;
  complexity: number; // 1 = simplest
  technical: string[];
  halfTechy: string[];
  laymans: string[];
  mockup: { metric: string; value: string; hint: string }[];
};

// Ordered least → most complex
const CATEGORIES: Category[] = [
  {
    key: "edu-verify",
    title: ".edu Email Enforcement",
    icon: Mail,
    enabled: true,
    complexity: 1,
    technical: [
      "Signups gated by /\\.edu$/ regex + MX-record lookup to confirm real school.",
      "Domain resolved against `campuses` table → binds account to a `campus_id`.",
      "Non-.edu signups routed through `email_campus_overrides` for manual approval.",
    ],
    halfTechy: [
      "Sign-up only accepts a .edu email — and we verify the domain is a real school.",
      "Domain is matched to our campuses table to tag the account to that school.",
      "Gmail / non-.edu signups land in a manual-approval queue.",
    ],
    laymans: [
      "No real school email = no signup.",
      "Stops casual sharing — students won't hand out their university login.",
      "Every account is tied to a specific school.",
    ],
    mockup: [
      { metric: ".edu signups (lifetime)", value: "—", hint: "Data coming soon" },
      { metric: "Non-.edu attempts blocked", value: "—", hint: "Data coming soon" },
      { metric: "Campuses bound", value: "—", hint: "Data coming soon" },
    ],
  },
  {
    key: "watermark",
    title: "Per-Student Watermarking",
    icon: Eye,
    enabled: true,
    complexity: 2,
    technical: [
      "Repeating diagonal watermark at alpha 0.04 injected on render.",
      "Payload: SHA-256(email + asset_code + day) truncated to 12 chars.",
      "Inbound abuse reports run through OCR and reverse-mapped to originating student.",
    ],
    halfTechy: [
      "Faint diagonal watermark on every solutions page.",
      "Hashed code tied to student + asset + date (email never in plain text).",
      "If a screenshot leaks to Chegg/Reddit, OCR traces it back to the source account.",
    ],
    laymans: [
      "Every page is lightly stamped with the student's encrypted email.",
      "Invisible while studying, obvious in a screenshot.",
      "Lets us trace any leaked screenshot back to whoever shared it.",
    ],
    mockup: [
      { metric: "Pages watermarked", value: "100%", hint: "All paid views" },
      { metric: "Leaks traced (lifetime)", value: "—", hint: "Data coming soon" },
      { metric: "DMCA takedowns issued", value: "—", hint: "Data coming soon" },
    ],
  },
  {
    key: "rate-limit",
    title: "Velocity & Rate Limiting",
    icon: AlertTriangle,
    enabled: false,
    complexity: 3,
    technical: [
      "Per-IP + per-account token-bucket throttles: 60 req/min, 600 req/hour.",
      "Burst pattern (e.g., 30 unique assets in <2 min) flagged as non-human.",
      "Triggers Cloudflare Turnstile CAPTCHA before next render.",
    ],
    halfTechy: [
      "Rate limits on the solutions API — per IP and per account.",
      "30 problems opened in 2 minutes = a script, not a student.",
      "We slow them down or pop a Cloudflare CAPTCHA.",
    ],
    laymans: [
      "Real students read one problem at a time.",
      "Scrapers open 50 pages a minute.",
      "We slow them down or make them prove they're human.",
    ],
    mockup: [
      { metric: "Throttle events (24h)", value: "—", hint: "Data coming soon" },
      { metric: "CAPTCHA challenges", value: "—", hint: "Data coming soon" },
      { metric: "Likely scrapers blocked", value: "—", hint: "Data coming soon" },
    ],
  },
  {
    key: "fingerprint",
    title: "Device Fingerprinting",
    icon: Fingerprint,
    enabled: true,
    complexity: 4,
    technical: [
      "Composite hash: canvas/WebGL, audio context, fonts, screen, timezone, hw concurrency.",
      "256-bit identifier joined to `student_purchases.user_id`.",
      "Divergence > 0.4 over 7-day rolling window → soft-lock event.",
    ],
    halfTechy: [
      "Browsers leak signals (fonts, screen, timezone, GPU) → combined into a unique ID.",
      "We hash and store that ID alongside the account.",
      "Same login on 4 wildly different fingerprints in a week = soft-lock.",
    ],
    laymans: [
      "Every browser leaves a unique 'thumbprint.'",
      "We capture it quietly on first login.",
      "Same account on 3–4 different thumbprints = password being shared.",
    ],
    mockup: [
      { metric: "Unique fingerprints per student (7d)", value: "1.2 avg", hint: "Healthy: < 2.0" },
      { metric: "Accounts flagged for sharing", value: "—", hint: "Data coming soon" },
      { metric: "Soft-locks issued", value: "—", hint: "Data coming soon" },
    ],
  },
  {
    key: "concurrent",
    title: "Concurrent Session Limits",
    icon: MonitorSmartphone,
    enabled: false,
    complexity: 5,
    technical: [
      "Supabase JWT refresh tokens tracked in `sessions` with 60s heartbeats.",
      "N > 2 active sessions overlapping > 5 min → oldest invalidated server-side.",
      "LearnWorlds iframe sessions exempted via referrer-validated parent token.",
    ],
    halfTechy: [
      "Each Supabase login logged in a sessions table, pinged every minute.",
      ">2 sessions overlapping → oldest is killed and re-auth forced.",
      "LearnWorlds iframes get a pass (same student, inside the course).",
    ],
    laymans: [
      "Laptop + phone = fine.",
      "Four devices active at once = sharing.",
      "We auto-sign out the oldest one.",
    ],
    mockup: [
      { metric: "Median concurrent devices", value: "1.4", hint: "Healthy: 1–2" },
      { metric: "Auto-revocations (30d)", value: "—", hint: "Data coming soon" },
      { metric: "Re-auth challenges sent", value: "—", hint: "Data coming soon" },
    ],
  },
  {
    key: "lw-binding",
    title: "LearnWorlds Identity Binding",
    icon: KeyRound,
    enabled: true,
    complexity: 6,
    technical: [
      "Embed URLs include {{USER_ID}}, {{USER_EMAIL}}, {{COURSE_ID}} from LW.",
      "`document.referrer` validated against LW domain whitelist; identity persisted in sessionStorage.",
      "Embed identity ≠ active Supabase session → `binding_violation` event.",
    ],
    halfTechy: [
      "LearnWorlds passes us the student's user ID + email via the embed URL.",
      "We verify the request came from a LW domain (referrer check).",
      "If the LW identity ≠ the logged-in account → flag (likely borrowed login).",
    ],
    laymans: [
      "LearnWorlds tells us exactly who's opening a problem from inside their course.",
      "If that ID doesn't match the logged-in email, the login is borrowed.",
    ],
    mockup: [
      { metric: "Binding violations (7d)", value: "—", hint: "Data coming soon" },
      { metric: "LW-verified sessions", value: "—", hint: "Data coming soon" },
      { metric: "Cross-account embed loads", value: "—", hint: "Data coming soon" },
    ],
  },
  {
    key: "ip-geo",
    title: "IP / Geo Anomaly Detection",
    icon: Globe2,
    enabled: false,
    complexity: 7,
    technical: [
      "`asset_events` enriched with IP→ASN→geo (city/region/country) at ingest.",
      "Great-circle distance ÷ elapsed time → flag if > ~900 km/h ('impossible travel').",
      "IP entropy scored: H = -Σp(i)·log₂p(i) over trailing 30 days.",
    ],
    halfTechy: [
      "Every page view's IP is geo-located (city/state/country).",
      "Back-to-back sessions checked for 'impossible travel' (e.g., MS → TX in 30 min).",
      "Count distinct IPs per account — healthy is 1–3, not 12.",
    ],
    laymans: [
      "Mississippi at 2pm + Texas at 2:30pm = physically impossible.",
      "We catch those 'teleport' events.",
      "12 cities in a month = account being passed around.",
    ],
    mockup: [
      { metric: "Impossible-travel events (30d)", value: "—", hint: "Data coming soon" },
      { metric: "Avg IPs per account", value: "—", hint: "Healthy: 1–3" },
      { metric: "Top flagged accounts", value: "—", hint: "Data coming soon" },
    ],
  },
  {
    key: "behavioral",
    title: "Behavioral Pattern Analysis",
    icon: Activity,
    enabled: false,
    complexity: 8,
    technical: [
      "Per-account features: hour-of-day dist, session length, scroll depth, accordion sequence.",
      "Isolation forest scores deviation; > 0.85 over a 5-event window opens a review ticket.",
      "Features recomputed nightly.",
    ],
    halfTechy: [
      "Per-account behavior profile built from event log (hours, scroll, click cadence).",
      "Nightly anomaly-detection job compares new activity vs. profile.",
      "Sudden flip (2am studier → 8am speed-clicker) → human-review queue.",
    ],
    laymans: [
      "Every student has a study rhythm — when, how fast, what they open first.",
      "Sudden behavior change usually = a different person on the account.",
    ],
    mockup: [
      { metric: "Behavior models trained", value: "—", hint: "Data coming soon" },
      { metric: "Accounts under review", value: "—", hint: "Data coming soon" },
      { metric: "False-positive rate", value: "—", hint: "Target: < 5%" },
    ],
  },
];

type ModalView = "laymans" | "halfTechy" | "technical" | "dashboard";

function CategoryModal({
  category,
  open,
  onClose,
}: {
  category: Category | null;
  open: boolean;
  onClose: () => void;
}) {
  const [view, setView] = useState<ModalView>("halfTechy");

  if (!category) return null;
  const Icon = category.icon;

  const tabBtn = (id: ModalView, label: string) => (
    <button
      type="button"
      onClick={() => setView(id)}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        view === id
          ? "bg-white text-[#14213D]"
          : "text-white/70 hover:text-white hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl p-0 border-0 overflow-hidden"
        style={{ background: NAVY }}
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(206,17,38,0.18)" }}
            >
              <Icon className="h-6 w-6" style={{ color: RED }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-white text-xl font-semibold">{category.title}</h2>
                {category.enabled ? (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded">
                    <Check className="h-3 w-3" /> Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded">
                    <X className="h-3 w-3" /> Not built
                  </span>
                )}
              </div>
              <p className="text-white/50 text-xs">
                Rank {category.complexity} of {CATEGORIES.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10 mb-4 w-fit">
            {tabBtn("laymans", "Plain English")}
            {tabBtn("halfTechy", "Half Tech-y")}
            {tabBtn("technical", "Full Tech-y")}
            {tabBtn("dashboard", "Preview Dashboard")}
          </div>

          {view === "laymans" && (
            <p className="text-white/85 text-sm leading-relaxed">{category.laymans}</p>
          )}

          {view === "halfTechy" && (
            <p className="text-white/85 text-sm leading-relaxed">{category.halfTechy}</p>
          )}

          {view === "technical" && (
            <p className="text-white/85 text-sm leading-relaxed font-mono">
              {category.technical}
            </p>
          )}

          {view === "dashboard" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5" style={{ color: RED }} />
                <p className="text-[11px] uppercase tracking-wider font-semibold text-white/60">
                  Dashboard mockup — data coming soon
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {category.mockup.map((m) => (
                  <div
                    key={m.metric}
                    className="rounded-lg p-3"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px dashed rgba(255,255,255,0.15)",
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">
                      {m.metric}
                    </p>
                    <p className="text-white text-xl font-semibold mb-0.5">{m.value}</p>
                    <p className="text-[10px] text-white/40">{m.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MitigateAccountSharing() {
  const navigate = useNavigate();
  const [active, setActive] = useState<Category | null>(null);

  const handleShare = async () => {
    const url = `${window.location.origin}/mitigate-sharing`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: NAVY }}>
      <div className="max-w-4xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/domains")}
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs uppercase tracking-widest transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </button>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 text-white/85 hover:text-white text-xs font-medium px-3 py-1.5 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4 mb-3">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(206,17,38,0.18)" }}
          >
            <Shield className="h-6 w-6" style={{ color: RED }} />
          </div>
          <div>
            <h1 className="text-white text-3xl font-semibold tracking-tight mb-1">
              How We Mitigate Account Sharing at Survive
            </h1>
            <p className="text-white/60 text-sm">
              Eight layered defenses, ordered from least to most complex. Click for deeper dive.
            </p>
          </div>
        </div>

        {/* Big buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
          {CATEGORIES.map((c) => {
            return (
              <button
                key={c.key}
                onClick={() => setActive(c)}
                className="group text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.09] hover:border-white/25 transition-all p-4 flex items-center gap-3"
              >
                <div
                  className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: c.enabled
                      ? "rgba(16,185,129,0.15)"
                      : "rgba(244,63,94,0.15)",
                  }}
                >
                  {c.enabled ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{c.title}</p>
                  <p className="text-[11px] uppercase tracking-wider text-white/45 mt-0.5">
                    Rank {c.complexity}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

      </div>

      <CategoryModal
        category={active}
        open={!!active}
        onClose={() => setActive(null)}
      />
    </div>
  );
}
