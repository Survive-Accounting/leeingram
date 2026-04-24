import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Building2,
  Check,
  Mail,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Clock,
} from "lucide-react";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";

type OrgInfo = {
  org_account_id: string;
  org_name: string;
  campus_name: string | null;
  council: string | null;
  status: string;
  auto_reup_enabled: boolean;
  seats_remaining: number;
};

type ClaimOutcome =
  | "granted"
  | "queued_auto_reup"
  | "out_of_seats"
  | "already_member"
  | "org_inactive";

type ClaimResult = {
  outcome: ClaimOutcome;
  member_status?: string;
  seats_remaining?: number;
};

const JoinOrg: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claim, setClaim] = useState<ClaimResult | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  // ── Lookup org on mount ────────────────────────────────────
  useEffect(() => {
    if (!code) {
      setOrgError("Missing invite code");
      setLoadingOrg(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("resolve-org-invite", {
          body: { code, mode: "lookup" },
        });
        if (error) throw error;
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
        setOrg((data as { org: OrgInfo }).org);
      } catch (err) {
        setOrgError(err instanceof Error ? err.message : "Invite link not found");
      } finally {
        setLoadingOrg(false);
      }
    })();
  }, [code]);

  const lowerSeatsLeft = useMemo(
    () => (org && org.seats_remaining <= 5 ? true : false),
    [org],
  );

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setSubmitting(true);
    setClaim(null);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-org-invite", {
        body: { code, mode: "claim", email: email.trim().toLowerCase() },
      });
      if (error) throw error;
      const payload = data as { error?: string; outcome?: ClaimOutcome } & Record<string, unknown>;
      if (payload?.error) throw new Error(payload.error);

      const result: ClaimResult = {
        outcome: (payload.outcome as ClaimOutcome) ?? "out_of_seats",
        member_status: payload.member_status as string | undefined,
        seats_remaining: payload.seats_remaining as number | undefined,
      };
      setClaim(result);

      // Refresh seats remaining in org card
      if (typeof result.seats_remaining === "number" && org) {
        setOrg({ ...org, seats_remaining: result.seats_remaining });
      }

      // If granted or already_member: send magic link so they can sign in
      if (result.outcome === "granted" || result.outcome === "already_member") {
        try {
          const { error: otpErr } = await supabase.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: { emailRedirectTo: window.location.origin + "/auth/callback" },
          });
          if (!otpErr) setMagicSent(true);
        } catch {
          // Non-fatal — they can request login from /login
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not claim seat");
    } finally {
      setSubmitting(false);
    }
  }

  // ─────────── Render: loading ───────────
  if (loadingOrg) {
    return (
      <div className="min-h-screen" style={{ background: BG_GRADIENT }}>
        <StagingNavbar onCtaClick={() => {}} />
        <div className="mx-auto max-w-md px-6 pt-32 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-3 text-slate-600">Loading invite…</p>
        </div>
      </div>
    );
  }

  // ─────────── Render: invalid invite ───────────
  if (orgError || !org) {
    return (
      <div className="min-h-screen" style={{ background: BG_GRADIENT }}>
        <StagingNavbar onCtaClick={() => {}} />
        <div className="mx-auto max-w-md px-6 pt-32">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-rose-200">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
            <h1 className="mt-3 text-xl font-bold" style={{ color: NAVY }}>
              Invite link not found
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {orgError ?? "This invite link is no longer valid. Ask your chapter exec for a new one."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────── Render: org inactive ───────────
  if (org.status !== "active") {
    return (
      <div className="min-h-screen" style={{ background: BG_GRADIENT }}>
        <StagingNavbar onCtaClick={() => {}} />
        <div className="mx-auto max-w-md px-6 pt-32">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-amber-200">
            <Clock className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="mt-3 text-xl font-bold" style={{ color: NAVY }}>
              {org.org_name} isn't active yet
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Your chapter's purchase is still being processed. Check back once your exec confirms
              activation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────── Render: outcome screens after claim ───────────
  if (claim) {
    if (claim.outcome === "granted" || claim.outcome === "already_member") {
      return (
        <div className="min-h-screen" style={{ background: BG_GRADIENT }}>
          <StagingNavbar onCtaClick={() => {}} />
          <div className="mx-auto max-w-md px-6 pt-32">
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-emerald-200">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <h1 className="mt-4 text-xl font-bold" style={{ color: NAVY }}>
                {claim.outcome === "granted" ? "You're in." : "You're already on the roster."}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {magicSent
                  ? `We sent a sign-in link to ${email}. Open it to access ${org.org_name}'s study materials.`
                  : `Sign in at /login with ${email} to access your chapter materials.`}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (claim.outcome === "queued_auto_reup") {
      return (
        <div className="min-h-screen" style={{ background: BG_GRADIENT }}>
          <StagingNavbar onCtaClick={() => {}} />
          <div className="mx-auto max-w-md px-6 pt-32">
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-blue-200">
              <Clock className="mx-auto h-10 w-10 text-blue-500" />
              <h1 className="mt-3 text-xl font-bold" style={{ color: NAVY }}>
                You're on the auto re-up list
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {org.org_name} is out of seats this week. Your exec team has auto re-up enabled —
                we'll add a seat for you in the next billing cycle and email you when access is
                ready.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // out_of_seats
    return (
      <div className="min-h-screen" style={{ background: BG_GRADIENT }}>
        <StagingNavbar onCtaClick={() => {}} />
        <div className="mx-auto max-w-md px-6 pt-32">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-rose-200">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
            <h1 className="mt-3 text-xl font-bold" style={{ color: NAVY }}>
              Your chapter is out of seats.
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              We'll notify your exec team. Check back once they purchase more seats, or reach out
              to your chapter president.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────── Render: claim form ───────────
  return (
    <div className="min-h-screen pb-24" style={{ background: BG_GRADIENT }}>
      <StagingNavbar onCtaClick={() => {}} />

      <div className="mx-auto max-w-md px-6 pt-28">
        {/* Org card */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${NAVY}10`, color: NAVY }}
            >
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Chapter Invite
              </p>
              <h1 className="text-xl font-bold" style={{ color: NAVY }}>
                {org.org_name}
              </h1>
              <p className="text-sm text-slate-600">
                {org.campus_name ?? "—"}
                {org.council ? ` • ${org.council}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Seats remaining</span>
            </div>
            <span
              className="font-semibold"
              style={{ color: lowerSeatsLeft ? RED : NAVY }}
            >
              {org.seats_remaining}
            </span>
          </div>
        </div>

        {/* Claim form */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-semibold" style={{ color: NAVY }}>
            Claim your seat
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter your school email. We'll send a magic link so you can sign in — no password
            needed.
          </p>

          <form onSubmit={handleClaim} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="member-email">Student email</Label>
              <Input
                id="member-email"
                type="email"
                required
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full"
              style={{ background: RED }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Claim seat & send login link
                </>
              )}
            </Button>
          </form>

          <p className="mt-3 text-xs text-slate-500">
            By joining you'll be added to {org.org_name}'s roster.
          </p>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
};

export default JoinOrg;
