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
  technical: string;
  halfTechy: string;
  laymans: string;
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
    technical:
      "Signups are gated by a regex match on /\\.edu$/ and a domain MX-record lookup to confirm the school is real. The domain is then resolved against the campuses table to bind the account to a specific campus_id. Non-.edu signups are routed through the email_campus_overrides table for manual approval.",
    halfTechy:
      "Sign-up only accepts a .edu email, and we double-check the domain is a real school (not just a string ending in .edu). Then we look up the domain in our campuses table and tag the account to that school. If someone signs up with gmail.com, it lands in a manual-approval queue instead.",
    laymans:
      "You can't sign up without a real school email. That alone stops most casual sharing — students don't want to hand out their university login. And it ties every account to a specific school so we know who belongs where.",
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
    technical:
      "On render, the Solutions Viewer injects a low-opacity (alpha 0.04) repeating diagonal watermark containing SHA-256(email + asset_code + day) truncated to 12 chars. Screenshots leaked to forums can be reverse-mapped to the originating student via a lookup table. Detection is performed via OCR on inbound abuse reports.",
    halfTechy:
      "Every solutions page renders with a faint diagonal watermark in the background. It's a hashed code (so the email isn't sitting there in plain text) tied to the student + asset + date. We keep a lookup table on our side, so if a screenshot lands on Chegg or Reddit, we run it through OCR and trace it back to the original account.",
    laymans:
      "Every solutions page has the student's encrypted email lightly stamped across the background — too faint to notice while studying, but very visible if a screenshot ends up on Chegg or a group chat. We can trace it back to whoever leaked it.",
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
    technical:
      "Per-IP and per-account token-bucket throttles on /solutions/:assetCode renders, sized at 60 req/min and 600 req/hour respectively. Burst patterns inconsistent with human reading speed (e.g., 30 unique assets opened in < 2 min) trigger a CAPTCHA challenge served via Cloudflare Turnstile.",
    halfTechy:
      "We put rate limits on the solutions API — both per IP address and per account. If someone opens 30 different problems in two minutes, that's not a student studying, that's a script or a group download. We slow them down or pop a CAPTCHA (we'd use Cloudflare Turnstile) before serving the next page.",
    laymans:
      "A real student reads one problem at a time. A scraper or someone speed-downloading the whole library to share opens fifty pages in a minute. We notice that and slow them way down — or make them prove they're human.",
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
    technical:
      "Composite hash of canvas/WebGL renderer signatures, audio context output, installed font enumeration, screen dimensions, timezone, language, and hardware concurrency. Persisted as a 256-bit identifier per session and joined to student_purchases.user_id. A divergence threshold > 0.4 over a 7-day rolling window triggers a soft-lock event.",
    halfTechy:
      "Browsers leak a bunch of small signals — installed fonts, screen size, timezone, GPU info — that combine into a near-unique 'fingerprint.' We hash those into one ID and store it next to the account in our database. If the same login suddenly shows up under 4 totally different fingerprints in a week, that's a strong sharing signal and we soft-lock the account.",
    laymans:
      "Every browser leaves a unique 'thumbprint' — like a fingerprint at a crime scene. We quietly capture it the first time a student logs in. If the same account suddenly shows up on three or four very different thumbprints in the same week, we know the password is being passed around.",
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
    technical:
      "Supabase JWT refresh tokens are tracked in a sessions table with last_seen_at heartbeats every 60s. When N > 2 active sessions overlap by > 5 minutes, the oldest session is invalidated server-side and a re-auth challenge is pushed. We exempt LearnWorlds iframe sessions matched by their referrer-validated parent token.",
    halfTechy:
      "Supabase auth gives every login a refresh token. We log each one in a sessions table and ping it every minute so we know what's actually active. If more than 2 sessions overlap on the same account, we kill the oldest one from the server side and force a re-login. LearnWorlds iframes get a pass since those are the same student inside the course.",
    laymans:
      "You can have your laptop and phone open at the same time — that's normal. But if four devices are 'active' on one account at the same moment, somebody's sharing. We just sign the oldest one out automatically.",
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
    technical:
      "Embedded viewer URLs include {{USER_ID}}, {{USER_EMAIL}}, and {{COURSE_ID}} injected by LearnWorlds at render time. We validate document.referrer against an LW domain whitelist and persist the bound identity in sessionStorage['sa-lw-verified']. Mismatches between the embed identity and the active Supabase session trigger a binding_violation event.",
    halfTechy:
      "LearnWorlds is the platform our courses run on. When a student opens a problem inside their course, LW passes us their user ID and email through the embed URL. We check that the request actually came from a LearnWorlds domain (via referrer) and compare it to whoever's logged into our app. If the IDs don't match, we flag it — that usually means a borrowed login.",
    laymans:
      "When a student opens a problem from inside their course, LearnWorlds tells us exactly who they are. If that ID doesn't match the email on the account, we know someone is logged into the wrong place — usually a sign of a borrowed login.",
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
    technical:
      "Each viewer event in asset_events is enriched with IP→ASN→geo (city, region, country) at ingest. We compute the great-circle distance between consecutive sessions and divide by elapsed time. Velocities exceeding ~900 km/h ('impossible travel') flag the account. We also score IP entropy: H = -Σp(i)·log₂p(i) over the trailing 30 days.",
    halfTechy:
      "We log the IP address on every page view and run it through a geo-IP lookup (city, state, country). For each account, we compare back-to-back sessions: if you went from Mississippi to Texas in 30 minutes, that's physically impossible. We also count how many different IPs an account uses — one student should be 1–3, not 12.",
    laymans:
      "If your account is logged in from Mississippi at 2pm and Texas at 2:30pm, that's not possible — unless you're in a teleporter. We track those 'impossible trips.' We also notice if one account is suddenly being used from 12 different cities in a month.",
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
    technical:
      "We model each account's typical access cadence: hour-of-day distribution, average session length, scroll depth percentiles, and accordion-open sequence. A per-account isolation forest scores deviation; anomaly score > 0.85 over a 5-event window opens an internal review ticket. Features are recomputed nightly.",
    halfTechy:
      "For each account, we build a behavior profile from the event log — what hours they log in, how long sessions last, how fast they scroll, which sections they open first. A nightly job (basic anomaly-detection model) compares new activity against that profile. If the pattern flips overnight — like a 2am studier suddenly active at 8am, opening every section in 30 seconds — it gets queued for human review.",
    laymans:
      "Every student has a study rhythm — when they log in, how fast they click, what sections they open first. If an account's behavior suddenly changes overnight (a night-owl becomes an early bird, a slow scroller starts speed-clicking), it usually means a different person is using it.",
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
  const [view, setView] = useState<ModalView>("laymans");

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
            {tabBtn("technical", "Technical")}
            {tabBtn("dashboard", "Preview Dashboard")}
          </div>

          {view === "laymans" && (
            <p className="text-white/85 text-sm leading-relaxed">{category.laymans}</p>
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
