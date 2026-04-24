import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Check,
  Copy,
  Link2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Users,
  Building2,
  AlertTriangle,
} from "lucide-react";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboardFallback";

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";

type VerifyResponse = {
  verified: boolean;
  status: string;
  stripe_status?: string | null;
  payment_status?: string | null;
  org_account_id: string;
  account: {
    id: string;
    contact_email: string;
    org_name: string;
    campus_name: string | null;
    campus_slug: string | null;
    council: string | null;
    payment_method: "ach" | "card" | "manual";
    auto_reup_enabled: boolean;
    weekly_seat_limit: number;
  };
  seats: { purchased: number; used: number; remaining: number };
  purchases: Array<{
    id: string;
    seats_purchased: number;
    seats_used: number;
    payment_status: string;
    created_at: string;
  }>;
  invite_token: string | null;
  error?: string;
};

const SectionCard: React.FC<
  React.PropsWithChildren<{ title: string; icon?: React.ReactNode; subtitle?: string }>
> = ({ title, icon, subtitle, children }) => (
  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
    <div className="mb-4 flex items-start gap-3">
      {icon && (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${NAVY}10`, color: NAVY }}
        >
          {icon}
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
          {title}
        </h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: string | number; tone?: "default" | "red" | "green" }> = ({
  label,
  value,
  tone = "default",
}) => {
  const color = tone === "red" ? RED : tone === "green" ? "#15803D" : NAVY;
  return (
    <div className="rounded-xl bg-slate-50 p-4 text-center">
      <div className="text-3xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
};

const OrgDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");
  const orgAccountId = searchParams.get("org_account_id");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);

  const signupLink = useMemo(() => {
    if (!data?.invite_token) return null;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://learn.surviveaccounting.com";
    return `${origin}/join/${data.invite_token}`;
  }, [data?.invite_token]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: resp, error: invokeErr } = await supabase.functions.invoke(
        "verify-org-access-checkout",
        { body: { session_id: sessionId, org_account_id: orgAccountId } },
      );
      if (invokeErr) throw invokeErr;
      const r = resp as VerifyResponse;
      if (r?.error) throw new Error(r.error);
      setData(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to verify checkout";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId && !orgAccountId) {
      setError("Missing session_id or org_account_id");
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, orgAccountId]);

  async function copySignupLink() {
    if (!signupLink) return;
    const ok = await copyToClipboard(signupLink);
    if (ok) toast.success("Signup link copied");
    else toast.error("Could not copy link");
  }

  async function handleInviteExec(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.org_account_id) return;
    if (!inviteEmail || !inviteEmail.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setInviting(true);
    try {
      const { error: insertErr } = await supabase.from("org_admins").insert({
        org_account_id: data.org_account_id,
        user_email: inviteEmail.trim().toLowerCase(),
        role: "admin",
      });
      if (insertErr) throw insertErr;
      toast.success(`${inviteEmail} added as exec admin`);
      setInviteEmail("");
      setInviteName("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add admin";
      toast.error(msg);
    } finally {
      setInviting(false);
    }
  }

  // ---- Render states ----
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: BG_GRADIENT }}>
        <StagingNavbar />
        <div className="mx-auto max-w-3xl px-6 pt-32 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-4 text-slate-600">Verifying your purchase…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen" style={{ background: BG_GRADIENT }}>
        <StagingNavbar />
        <div className="mx-auto max-w-2xl px-6 pt-32">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-rose-200">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
            <h1 className="mt-4 text-xl font-bold" style={{ color: NAVY }}>
              We couldn't load your dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">{error ?? "Unknown error"}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => load()}>
                Try again
              </Button>
              <Button onClick={() => navigate("/get-org-access")}>Back to setup</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isPendingManual = data.account.payment_method === "manual" && data.status !== "active";
  const isActive = data.status === "active";

  return (
    <div className="min-h-screen pb-24" style={{ background: BG_GRADIENT }}>
      <StagingNavbar />

      <div className="mx-auto max-w-5xl px-6 pt-28">
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-500">Chapter Dashboard</span>
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl" style={{ color: NAVY }}>
              {data.account.org_name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {data.account.campus_name ?? "—"}
              {data.account.council ? ` • ${data.account.council}` : ""}
            </p>
          </div>

          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
              isActive
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : isPendingManual
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-slate-50 text-slate-600 ring-slate-200"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {isActive
              ? "Chapter Access Active"
              : isPendingManual
                ? "Pending Manual Payment"
                : "Pending Payment"}
          </div>
        </div>

        {/* ── Pending manual notice ─────────────────────────── */}
        {isPendingManual && (
          <div className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            We're waiting on your invoice/check payment. Manual payments take up to 5 business days
            to activate. Your signup link will appear here once payment is received.
          </div>
        )}

        {/* ── Seat stats ─────────────────────────────────────── */}
        <SectionCard
          title="Seats"
          icon={<Users className="h-5 w-5" />}
          subtitle="Track how many of your purchased passes have been claimed."
        >
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Purchased" value={data.seats.purchased} />
            <Stat label="Used" value={data.seats.used} tone="red" />
            <Stat label="Remaining" value={data.seats.remaining} tone="green" />
          </div>
        </SectionCard>

        {/* ── Signup link ──────────────────────────────────── */}
        <div className="mt-6">
          <SectionCard
            title="Member Signup Link"
            icon={<Link2 className="h-5 w-5" />}
            subtitle="Share this link with your members. Each signup uses one seat."
          >
            {isActive && signupLink ? (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                  <code className="flex-1 truncate text-sm text-slate-700">{signupLink}</code>
                  <Button size="sm" variant="outline" onClick={copySignupLink}>
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
                <Button
                  className="mt-3 w-full sm:w-auto"
                  style={{ background: RED }}
                  onClick={copySignupLink}
                >
                  <Copy className="h-4 w-4" />
                  Copy member signup link
                </Button>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Your signup link will appear here once payment is confirmed.
              </p>
            )}
          </SectionCard>
        </div>

        {/* ── Auto re-up settings ────────────────────────────── */}
        <div className="mt-6">
          <SectionCard
            title="Auto Re-up Settings"
            icon={<RefreshCw className="h-5 w-5" />}
            subtitle="We'll summarize new seats weekly before billing."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Auto-add seats
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>
                  {data.account.auto_reup_enabled ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" /> Enabled
                    </>
                  ) : (
                    "Disabled"
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Weekly seat limit
                </div>
                <div className="mt-1 text-sm font-semibold" style={{ color: NAVY }}>
                  {data.account.weekly_seat_limit} seats / week
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Settings can be changed by contacting Lee. Automatic billing is not yet active.
            </p>
          </SectionCard>
        </div>

        {/* ── Invite exec team ─────────────────────────────── */}
        <div className="mt-6">
          <SectionCard
            title="Invite Exec Team"
            icon={<Mail className="h-5 w-5" />}
            subtitle="Add your president, academic chair, or treasurer as a co-admin."
          >
            <form onSubmit={handleInviteExec} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <Label htmlFor="exec-name" className="text-xs">
                  Name (optional)
                </Label>
                <Input
                  id="exec-name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <Label htmlFor="exec-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="exec-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="exec@chapter.org"
                  required
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={inviting || !isActive}
                  style={{ background: NAVY }}
                  className="w-full sm:w-auto"
                >
                  {inviting ? "Adding…" : "Add admin"}
                </Button>
              </div>
            </form>
            {!isActive && (
              <p className="mt-2 text-xs text-slate-500">
                You'll be able to invite execs once your chapter is active.
              </p>
            )}
          </SectionCard>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
};

export default OrgDashboard;
