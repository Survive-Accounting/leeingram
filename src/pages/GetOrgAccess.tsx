import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ShieldCheck, Users, Link2, Sparkles, Search, Plus, Crown, UserRound, Copy, Flame } from "lucide-react";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const StagingTestimonialsSection = lazy(
  () => import("@/components/landing/StagingTestimonialsSection"),
);

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";

// Seat tiers come from public.org_seat_pricing (configurable in DB).
type Tier = {
  id: string;
  seats: number;
  total: number;
  label: string | null;
  badge: string | null;
  is_promo: boolean;
  recommended: boolean;
};

type Campus = {
  id: string;
  slug: string;
  name: string;
  email_domain: string | null;
};

type GreekOrg = {
  id: string;
  campus_id: string;
  org_name: string;
  council: string | null;
  org_type: string | null;
  aliases: string[] | null;
  status: string;
};

const emailSchema = z
  .string()
  .trim()
  .email({ message: "Enter a valid email address" })
  .max(255, { message: "Email is too long" });

const manualOrgSchema = z
  .string()
  .trim()
  .min(2, { message: "Org name is too short" })
  .max(120, { message: "Org name is too long" });

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function GetOrgAccess() {
  const navigate = useNavigate();

  // --- Email + campus detection ---
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusesLoading, setCampusesLoading] = useState(true);
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);
  const [campusAutoMatched, setCampusAutoMatched] = useState(false);

  // --- Org search ---
  const [orgs, setOrgs] = useState<GreekOrg[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // --- Manual add ---
  const [showManual, setShowManual] = useState(false);
  const [manualOrgName, setManualOrgName] = useState("");
  const [manualOrgError, setManualOrgError] = useState<string | null>(null);
  const [creatingManual, setCreatingManual] = useState(false);

  // --- Tier (loaded from DB) ---
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const tier = useMemo(
    () => tiers.find((t) => t.id === selectedTierId) || tiers[0] || null,
    [tiers, selectedTierId],
  );
  const perSeat = tier ? Math.round(tier.total / tier.seats) : 0;

  // --- Founding chapter offer (50% off if campus has < 3 active orgs) ---
  const FOUNDING_CAP = 3;
  const FOUNDING_DISCOUNT_PCT = 50;
  const [foundingClaimed, setFoundingClaimed] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedCampusId) {
      setFoundingClaimed(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from("org_accounts")
        .select("id", { count: "exact", head: true })
        .eq("campus_id", selectedCampusId)
        .eq("status", "active");
      if (cancelled) return;
      if (error) {
        console.error("[get-org-access] founding count", error);
        setFoundingClaimed(null);
      } else {
        setFoundingClaimed(count ?? 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCampusId]);
  const foundingEligible =
    foundingClaimed !== null && foundingClaimed < FOUNDING_CAP;

  // --- Auto re-up settings (prototype: stored only, no auto billing) ---
  const WEEKLY_LIMIT_OPTIONS = [10, 20, 30, 50] as const;
  const [autoReupEnabled, setAutoReupEnabled] = useState(true);
  const [autoRenewEnabled, setAutoRenewEnabled] = useState(true);
  const [weeklySeatLimit, setWeeklySeatLimit] = useState<number>(20);
  const AUTO_REUP_DISCOUNT_PCT = 5;
  const AUTO_RENEW_DISCOUNT_PCT = 5;

  // Stack all active percent-off discounts (founding + auto-reup + auto-renew)
  const activeDiscounts: Array<{ key: string; label: string; pct: number }> = [];
  if (foundingEligible) activeDiscounts.push({ key: "founding", label: "Founding chapter", pct: FOUNDING_DISCOUNT_PCT });
  if (autoReupEnabled) activeDiscounts.push({ key: "auto_reup", label: "Auto-add seats", pct: AUTO_REUP_DISCOUNT_PCT });
  if (autoReupEnabled && autoRenewEnabled) activeDiscounts.push({ key: "auto_renew", label: "Auto-renew next semester", pct: AUTO_RENEW_DISCOUNT_PCT });
  const totalDiscountPct = activeDiscounts.reduce((sum, d) => sum + d.pct, 0);
  const applyDiscount = (amount: number) => Math.round(amount * (1 - totalDiscountPct / 100));

  // --- Payment method preference ---
  type PaymentMethod = "ach" | "card" | "manual";
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ach");

  const [submitting, setSubmitting] = useState(false);

  // --- Step 0: Role + chapter intent (gates the rest of the form) ---
  type Role = "member" | "exec";
  const [role, setRole] = useState<Role | null>(null);
  const [intentChapter, setIntentChapter] = useState("");
  const [intentSearchResults, setIntentSearchResults] = useState<GreekOrg[]>([]);
  const [intentSearching, setIntentSearching] = useState(false);
  const [intentSelectedOrg, setIntentSelectedOrg] = useState<GreekOrg | null>(null);
  const [intentLocked, setIntentLocked] = useState(false);
  const [memberWaitlistCount, setMemberWaitlistCount] = useState<number | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/get-org-access`;
  }, []);

  // Search chapters across all campuses (debounced)
  useEffect(() => {
    const q = intentChapter.trim();
    if (!q || intentLocked) {
      setIntentSearchResults([]);
      return;
    }
    let cancelled = false;
    setIntentSearching(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("greek_orgs")
        .select("id, campus_id, org_name, council, org_type, aliases, status")
        .ilike("org_name", `%${q}%`)
        .order("org_name")
        .limit(8);
      if (cancelled) return;
      if (error) {
        console.error("[get-org-access] chapter search", error);
        setIntentSearchResults([]);
      } else {
        setIntentSearchResults((data as GreekOrg[]) || []);
      }
      setIntentSearching(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [intentChapter, intentLocked]);

  // When member commits, fetch waitlist count for that chapter
  useEffect(() => {
    if (role !== "member" || !intentLocked) {
      setMemberWaitlistCount(null);
      return;
    }
    const orgName = intentSelectedOrg?.org_name || intentChapter.trim();
    if (!orgName) return;
    let cancelled = false;
    (async () => {
      let query = supabase.from("greek_waitlist").select("id", { count: "exact", head: true });
      if (intentSelectedOrg) {
        query = query.eq("greek_org_id", intentSelectedOrg.id);
      } else {
        query = query.ilike("org_name", orgName);
      }
      const { count, error } = await query;
      if (cancelled) return;
      if (!error) setMemberWaitlistCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [role, intentLocked, intentSelectedOrg, intentChapter]);

  // When officer commits, prefill the rest of the form
  useEffect(() => {
    if (role === "exec" && intentLocked) {
      if (intentSelectedOrg) {
        setSelectedCampusId(intentSelectedOrg.campus_id);
        setSelectedOrgId(intentSelectedOrg.id);
      } else if (intentChapter.trim()) {
        setShowManual(true);
        setManualOrgName(intentChapter.trim());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, intentLocked]);

  const commitIntent = (org: GreekOrg | null) => {
    if (org) {
      setIntentSelectedOrg(org);
      setIntentChapter(org.org_name);
    } else {
      setIntentSelectedOrg(null);
    }
    setIntentLocked(true);
    setIntentSearchResults([]);
  };

  const resetIntent = () => {
    setIntentLocked(false);
    setIntentSelectedOrg(null);
    setMemberWaitlistCount(null);
    setJoinedWaitlist(false);
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleJoinWaitlist = async () => {
    const parsed = emailSchema.safeParse(waitlistEmail.trim());
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const orgName = intentSelectedOrg?.org_name || intentChapter.trim();
    if (!orgName) {
      toast.error("Tell us your chapter first.");
      return;
    }
    setJoiningWaitlist(true);
    try {
      const { error } = await supabase.from("greek_waitlist").insert({
        email: parsed.data.toLowerCase(),
        org_name: orgName,
        greek_org_id: intentSelectedOrg?.id ?? null,
        campus_id: intentSelectedOrg?.campus_id ?? null,
        source: "get_org_access",
      });
      if (error && !/duplicate key|unique/i.test(error.message)) throw error;
      setJoinedWaitlist(true);
      setMemberWaitlistCount((c) => (c == null ? 1 : c + 1));
      toast.success("You're on the list. We'll email you when your chapter is in.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not join waitlist.";
      toast.error(msg);
    } finally {
      setJoiningWaitlist(false);
    }
  };

  // Load seat-pricing tiers from DB
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("org_seat_pricing")
        .select("id, seats, total_cents, label, badge, is_promo, is_recommended, valid_until")
        .eq("is_active", true)
        .order("sort_order");
      if (cancelled) return;
      if (error) {
        console.error("[get-org-access] org_seat_pricing", error);
        setTiersLoading(false);
        return;
      }
      const now = Date.now();
      const mapped: Tier[] = (data || [])
        .filter((r) => !r.valid_until || new Date(r.valid_until).getTime() > now)
        .map((r) => ({
          id: r.id,
          seats: r.seats,
          total: Math.round(r.total_cents / 100),
          label: r.label,
          badge: r.badge,
          is_promo: r.is_promo,
          recommended: r.is_recommended,
        }));
      setTiers(mapped);
      const defaultTier =
        mapped.find((t) => t.recommended) ||
        mapped.find((t) => !t.is_promo) ||
        mapped[0];
      if (defaultTier) setSelectedTierId(defaultTier.id);
      setTiersLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load campuses once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("campuses")
        .select("id, slug, name, email_domain")
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      if (error) {
        console.error("[get-org-access] campuses", error);
      } else {
        setCampuses((data as Campus[]) || []);
      }
      setCampusesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Email → campus auto-detect (debounced via effect on validated email only)
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    const parsed = emailSchema.safeParse(trimmed);
    if (!parsed.success) {
      setCampusAutoMatched(false);
      return;
    }
    const domain = trimmed.split("@")[1] || "";
    if (!domain || campuses.length === 0) return;
    const match = campuses.find(
      (c) =>
        !!c.email_domain &&
        (domain === c.email_domain.toLowerCase() ||
          domain.endsWith(`.${c.email_domain.toLowerCase()}`)),
    );
    if (match) {
      setSelectedCampusId(match.id);
      setCampusAutoMatched(true);
    } else {
      setCampusAutoMatched(false);
    }
  }, [email, campuses]);

  // Load orgs when campus changes
  useEffect(() => {
    if (!selectedCampusId) {
      setOrgs([]);
      return;
    }
    let cancelled = false;
    setOrgsLoading(true);
    setSelectedOrgId(null);
    (async () => {
      const { data, error } = await supabase
        .from("greek_orgs")
        .select("id, campus_id, org_name, council, org_type, aliases, status")
        .eq("campus_id", selectedCampusId)
        .order("org_name");
      if (cancelled) return;
      if (error) {
        console.error("[get-org-access] greek_orgs", error);
        setOrgs([]);
      } else {
        setOrgs((data as GreekOrg[]) || []);
      }
      setOrgsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCampusId]);

  const filteredOrgs = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) => {
      if (o.org_name.toLowerCase().includes(q)) return true;
      if ((o.aliases || []).some((a) => a.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [orgs, orgSearch]);

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === selectedOrgId) || null,
    [orgs, selectedOrgId],
  );

  const handleEmailBlur = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError(null);
      return;
    }
    const parsed = emailSchema.safeParse(trimmed);
    setEmailError(parsed.success ? null : parsed.error.issues[0].message);
  };

  const handleAddManualOrg = async () => {
    if (!selectedCampusId) {
      toast.error("Pick a campus first.");
      return;
    }
    const parsed = manualOrgSchema.safeParse(manualOrgName);
    if (!parsed.success) {
      setManualOrgError(parsed.error.issues[0].message);
      return;
    }
    setManualOrgError(null);
    setCreatingManual(true);
    try {
      const baseSlug = slugify(parsed.data) || `org-${Date.now()}`;
      // Try insert; if slug collides, append a short suffix.
      let attempt = 0;
      let inserted: GreekOrg | null = null;
      while (attempt < 3 && !inserted) {
        const trySlug =
          attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
        const { data, error } = await supabase
          .from("greek_orgs")
          .insert({
            campus_id: selectedCampusId,
            org_name: parsed.data,
            org_slug: trySlug,
            status: "user_added",
            aliases: [],
          })
          .select("id, campus_id, org_name, council, org_type, aliases, status")
          .single();
        if (!error && data) {
          inserted = data as GreekOrg;
          break;
        }
        // Unique violation → retry with new slug; otherwise bail.
        if (error && !/duplicate key|unique/i.test(error.message)) {
          throw error;
        }
        attempt += 1;
      }
      if (!inserted) throw new Error("Could not create org. Try a different name.");
      setOrgs((prev) =>
        [...prev, inserted!].sort((a, b) => a.org_name.localeCompare(b.org_name)),
      );
      setSelectedOrgId(inserted.id);
      setShowManual(false);
      setManualOrgName("");
      setOrgSearch("");
      toast.success(`Added "${inserted.org_name}" to your campus.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not add org.";
      setManualOrgError(msg);
    } finally {
      setCreatingManual(false);
    }
  };

  const canSubmit =
    !emailError &&
    emailSchema.safeParse(email.trim()).success &&
    !!selectedCampusId &&
    !!selectedOrg &&
    !!tier &&
    !submitting;

  const handleCheckout = async () => {
    if (!canSubmit || !tier) return;
    setSubmitting(true);
    try {
      const orgName =
        (selectedOrg as any)?.org_name?.trim?.() ||
        (selectedOrg as any)?.org_name_manual?.trim?.() ||
        "";

      const baseTotal = tier.total;
      const discountedTotal = applyDiscount(baseTotal);
      const pricePerSeatCents = Math.round((discountedTotal / tier.seats) * 100);
      const totalCents = Math.round(discountedTotal * 100);

      const { data, error } = await supabase.functions.invoke(
        "create-org-access-checkout",
        {
          body: {
            contact_email: email.trim().toLowerCase(),
            campus_id: selectedCampusId,
            greek_org_id: selectedOrg?.id ?? null,
            org_name: orgName,
            seats: tier.seats,
            price_per_seat_cents: pricePerSeatCents,
            total_cents: totalCents,
            is_promo: tier.is_promo || totalDiscountPct > 0,
            tier_id: tier.id,
            payment_method: paymentMethod,
            auto_reup_enabled: autoReupEnabled,
            auto_renew_enabled: autoReupEnabled && autoRenewEnabled,
            weekly_seat_limit: autoReupEnabled ? weeklySeatLimit : null,
            origin: window.location.origin,
            applied_discounts: activeDiscounts,
            base_total_cents: Math.round(baseTotal * 100),
          },
        },
      );

      if (error) throw new Error(error.message || "Checkout failed");
      if (!data) throw new Error("Empty checkout response");

      if (data.outcome === "manual") {
        toast.success(
          "Got it — we'll email you an invoice. Your signup link will activate after payment clears.",
        );
        if (data.redirect_url) navigate(data.redirect_url);
        return;
      }

      if (data.outcome === "checkout" && data.url) {
        window.location.assign(data.url as string);
        return;
      }

      throw new Error("Unexpected checkout response");
    } catch (err) {
      console.error("[get-org-access checkout]", err);
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase =
    "w-full rounded-lg px-3 py-2.5 text-[14px] outline-none transition-colors";
  const inputStyle: React.CSSProperties = {
    border: "1px solid #E0E7F0",
    fontFamily: "Inter, sans-serif",
    color: NAVY,
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG_GRADIENT }}>
      <StagingNavbar onCtaClick={() => navigate("/staging")} onPricingClick={() => {}} />

      {/* Hero */}
      <section className="px-4 sm:px-6 pt-12 md:pt-20 pb-8 text-center">
        <h1
          className="text-[34px] sm:text-[44px] md:text-[54px] leading-tight"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Chapter Access
        </h1>
        <p
          className="mt-4 max-w-[640px] mx-auto text-[16px] sm:text-[18px]"
          style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}
        >
          Buy study passes for your members and share one signup link.
        </p>
      </section>

      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-[1100px] mx-auto grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
          {/* MAIN CARD */}
          <div
            className="rounded-2xl p-5 sm:p-7"
            style={{
              background: "#fff",
              boxShadow:
                "0 24px 60px rgba(20,33,61,0.10), 0 2px 8px rgba(20,33,61,0.04)",
              border: "1px solid #E0E7F0",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  className="text-[24px] sm:text-[28px] leading-tight"
                  style={{
                    color: NAVY,
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                  }}
                >
                  Set up your chapter
                </h2>
                <p
                  className="mt-1 text-[12px] flex items-center gap-1"
                  style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                >
                  Powered by{" "}
                  <span
                    className="font-semibold"
                    style={{
                      color: "#635BFF",
                      fontFamily: "Inter, sans-serif",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Stripe
                  </span>
                </p>
              </div>

              <div
                className="rounded-2xl px-5 py-3.5 flex flex-col items-center justify-center shrink-0"
                style={{
                  background: "#F0F6FF",
                  border: `1px solid ${NAVY}`,
                  boxShadow:
                    "0 12px 28px rgba(20,33,61,0.16), 0 4px 10px rgba(20,33,61,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
                  minWidth: 132,
                  transform: "translateY(-3px)",
                }}
              >
                <div
                  className="font-bold leading-none"
                  style={{
                    fontSize: 36,
                    color: NAVY,
                    letterSpacing: "-0.03em",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  ${(tier?.total ?? 0).toLocaleString()}
                </div>
                <div
                  className="mt-1.5 text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                >
                  ${perSeat}/seat
                </div>
              </div>
            </div>

            {/* Step 0 — Role + Chapter intent */}
            <div className="mt-6">
              <div
                className="text-[13px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                Start your chapter access
              </div>

              {/* Role buttons */}
              <div className="text-[13px] mb-2" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>
                Who are you?
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "member" as const, label: "ΑΒΓΔ Member", Icon: UserRound },
                  { id: "exec" as const, label: "ΑΒΓΔ Officer / Exec", Icon: Crown },
                ]).map(({ id, label, Icon }) => {
                  const selected = role === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setRole(id);
                        if (intentLocked) resetIntent();
                      }}
                      className="rounded-xl px-3 py-3 flex items-center justify-center gap-2 text-[14px] font-semibold transition-all"
                      style={{
                        background: selected ? NAVY : "#fff",
                        color: selected ? "#fff" : NAVY,
                        border: `1.5px solid ${selected ? NAVY : "#E0E7F0"}`,
                        fontFamily: "Inter, sans-serif",
                        boxShadow: selected ? "0 4px 12px rgba(20,33,61,0.10)" : "none",
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Chapter search (only after role chosen) */}
              {role && !intentLocked && (
                <div className="mt-4">
                  <div className="text-[13px] mb-2" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>
                    Your chapter
                  </div>
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: "#94A3B8" }}
                    />
                    <input
                      type="text"
                      value={intentChapter}
                      onChange={(e) => {
                        setIntentChapter(e.target.value);
                        setIntentSelectedOrg(null);
                      }}
                      placeholder="Search your chapter (e.g. Pi Beta Phi, Ole Miss)"
                      className={`${inputBase} pl-9`}
                      style={inputStyle}
                      autoFocus
                    />
                  </div>

                  {/* Live results */}
                  {intentChapter.trim() && (
                    <div
                      className="mt-2 rounded-lg overflow-hidden"
                      style={{ border: "1px solid #E0E7F0", background: "#FAFBFC" }}
                    >
                      {intentSearching ? (
                        <div
                          className="px-3 py-3 text-[13px]"
                          style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                        >
                          Searching…
                        </div>
                      ) : intentSearchResults.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => commitIntent(null)}
                          className="w-full text-left px-3 py-3 text-[13px] hover:bg-white"
                          style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                        >
                          Use "<strong>{intentChapter.trim()}</strong>" anyway →
                        </button>
                      ) : (
                        <>
                          {intentSearchResults.map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => commitIntent(o)}
                              className="w-full text-left px-3 py-2.5 hover:bg-white transition-colors"
                              style={{
                                color: NAVY,
                                fontFamily: "Inter, sans-serif",
                                borderBottom: "1px solid #F1F5F9",
                              }}
                            >
                              <div className="text-[14px] font-medium">{o.org_name}</div>
                              <div className="text-[11px]" style={{ color: "#94A3B8" }}>
                                {o.council || "Greek"}
                                {o.org_type ? ` · ${o.org_type}` : ""}
                              </div>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => commitIntent(null)}
                            className="w-full text-left px-3 py-2.5 text-[13px] hover:bg-white"
                            style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                          >
                            <Plus size={12} className="inline mr-1" />
                            Use "<strong>{intentChapter.trim()}</strong>" — not in list
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Locked summary + branching */}
              {role && intentLocked && (
                <div
                  className="mt-4 rounded-xl p-4"
                  style={{ background: "#F8FAFC", border: "1px solid #E0E7F0" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div
                        className="text-[11px] font-bold uppercase tracking-wider mb-0.5"
                        style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                      >
                        {role === "exec" ? "Officer / Exec" : "Member"}
                      </div>
                      <div
                        className="text-[15px] font-semibold truncate"
                        style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                      >
                        {intentSelectedOrg?.org_name || intentChapter.trim()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetIntent}
                      className="text-[12px] font-medium hover:underline shrink-0"
                      style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                    >
                      Change
                    </button>
                  </div>

                  {/* MEMBER branch */}
                  {role === "member" && (
                    <div className="mt-4">
                      <div
                        className="text-[14px] font-semibold"
                        style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                      >
                        Your chapter doesn't have access yet.
                      </div>
                      <p
                        className="mt-1 text-[13px]"
                        style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                      >
                        Send your treasurer or exec the invite link to get the chapter set up.
                      </p>

                      {memberWaitlistCount != null && memberWaitlistCount > 0 && (
                        <div
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
                          style={{ background: "#FFF1E6", color: "#B45309", fontFamily: "Inter, sans-serif" }}
                        >
                          <Flame size={12} />
                          {memberWaitlistCount} member{memberWaitlistCount === 1 ? "" : "s"} already ready to join
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleCopyInvite}
                          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-bold text-white"
                          style={{ background: RED, fontFamily: "Inter, sans-serif", boxShadow: "0 4px 12px rgba(206,17,38,0.20)" }}
                        >
                          <Copy size={14} />
                          {copied ? "Copied!" : "Copy invite link"}
                        </button>
                      </div>

                      {/* Waitlist join */}
                      <div className="mt-4 pt-4" style={{ borderTop: "1px dashed #E0E7F0" }}>
                        {joinedWaitlist ? (
                          <div
                            className="text-[13px] font-medium"
                            style={{ color: "#15803D", fontFamily: "Inter, sans-serif" }}
                          >
                            ✓ You're on the waitlist. We'll email you the moment your chapter signs up.
                          </div>
                        ) : (
                          <>
                            <div
                              className="text-[12px] font-semibold uppercase tracking-wider mb-1.5"
                              style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                            >
                              Or join the waitlist
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="email"
                                value={waitlistEmail}
                                maxLength={255}
                                onChange={(e) => setWaitlistEmail(e.target.value)}
                                placeholder="you@school.edu"
                                className={inputBase}
                                style={{ ...inputStyle, flex: 1 }}
                                autoComplete="email"
                              />
                              <button
                                type="button"
                                onClick={handleJoinWaitlist}
                                disabled={joiningWaitlist}
                                className="rounded-lg px-4 py-2.5 text-[13px] font-bold disabled:opacity-50"
                                style={{
                                  background: "#fff",
                                  color: NAVY,
                                  border: `1.5px solid ${NAVY}`,
                                  fontFamily: "Inter, sans-serif",
                                }}
                              >
                                {joiningWaitlist ? "Joining…" : "Join waitlist"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {role === "exec" && intentLocked && (
              <>

            {/* Step 1 — Email */}
            <div className="mt-6">
              <div
                className="text-[13px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                1. Your email
              </div>
              <input
                type="email"
                value={email}
                maxLength={255}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                onBlur={handleEmailBlur}
                placeholder="you@chapter.org"
                className={inputBase}
                style={inputStyle}
                autoComplete="email"
              />
              {emailError && (
                <p
                  className="mt-1.5 text-[12px]"
                  style={{ color: RED, fontFamily: "Inter, sans-serif" }}
                >
                  {emailError}
                </p>
              )}
            </div>

            {/* Step 2 — Campus */}
            <div className="mt-6">
              <div
                className="text-[13px] font-semibold uppercase tracking-wider mb-2 flex items-center justify-between gap-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                <span>2. Your campus</span>
                {campusAutoMatched && selectedCampusId && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: "#DCFCE7", color: "#15803D" }}
                  >
                    <Check size={10} /> Auto-detected
                  </span>
                )}
              </div>
              <select
                value={selectedCampusId || ""}
                onChange={(e) => {
                  setSelectedCampusId(e.target.value || null);
                  setCampusAutoMatched(false);
                }}
                disabled={campusesLoading}
                className={inputBase}
                style={{ ...inputStyle, appearance: "auto" }}
              >
                <option value="">
                  {campusesLoading ? "Loading…" : "Select your campus"}
                </option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3 — Greek org */}
            <div className="mt-6">
              <div
                className="text-[13px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                3. Your chapter
              </div>

              {!selectedCampusId ? (
                <div
                  className="rounded-lg px-3 py-4 text-[13px]"
                  style={{
                    border: "1px dashed #E0E7F0",
                    background: "#FAFBFC",
                    color: "#94A3B8",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Pick a campus above to see chapters.
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: "#94A3B8" }}
                    />
                    <input
                      type="text"
                      value={orgSearch}
                      onChange={(e) => {
                        setOrgSearch(e.target.value);
                        setSelectedOrgId(null);
                      }}
                      placeholder="Search by name or letters (e.g. KD, Pike, AOPi)…"
                      className={`${inputBase} pl-9`}
                      style={inputStyle}
                    />
                  </div>

                  <div
                    className="mt-2 rounded-lg max-h-[240px] overflow-y-auto"
                    style={{ border: "1px solid #E0E7F0", background: "#FAFBFC" }}
                  >
                    {orgsLoading ? (
                      <div
                        className="px-3 py-4 text-[13px]"
                        style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                      >
                        Loading chapters…
                      </div>
                    ) : filteredOrgs.length === 0 ? (
                      <div
                        className="px-3 py-4 text-[13px]"
                        style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                      >
                        No matches. Add it manually below.
                      </div>
                    ) : (
                      filteredOrgs.slice(0, 80).map((o) => {
                        const selected = o.id === selectedOrgId;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setSelectedOrgId(o.id)}
                            className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors"
                            style={{
                              background: selected ? "#EFF6FF" : "transparent",
                              borderBottom: "1px solid #F1F5F9",
                              color: NAVY,
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            <div className="min-w-0">
                              <div className="text-[14px] font-medium truncate">
                                {o.org_name}
                                {o.status === "user_added" && (
                                  <span
                                    className="ml-2 text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: "#94A3B8" }}
                                  >
                                    new
                                  </span>
                                )}
                              </div>
                              <div
                                className="text-[11px] truncate"
                                style={{ color: "#94A3B8" }}
                              >
                                {o.council || "Greek"}
                                {o.org_type ? ` · ${o.org_type}` : ""}
                              </div>
                            </div>
                            {selected && <Check size={16} style={{ color: NAVY }} />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Manual add toggle / form */}
                  {!showManual ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowManual(true);
                        setManualOrgName(orgSearch);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
                      style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                    >
                      <Plus size={14} />
                      Can't find your org? Add it manually
                    </button>
                  ) : (
                    <div
                      className="mt-3 rounded-lg p-3"
                      style={{ background: "#F8FAFC", border: "1px solid #E0E7F0" }}
                    >
                      <label
                        className="block text-[12px] mb-1"
                        style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                      >
                        Type your chapter's full name
                      </label>
                      <input
                        type="text"
                        value={manualOrgName}
                        maxLength={120}
                        onChange={(e) => {
                          setManualOrgName(e.target.value);
                          if (manualOrgError) setManualOrgError(null);
                        }}
                        placeholder="e.g. Theta Chi"
                        className={inputBase}
                        style={inputStyle}
                      />
                      {manualOrgError && (
                        <p
                          className="mt-1.5 text-[12px]"
                          style={{ color: RED, fontFamily: "Inter, sans-serif" }}
                        >
                          {manualOrgError}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={creatingManual}
                          onClick={handleAddManualOrg}
                          className="rounded-lg px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                          style={{
                            background: NAVY,
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {creatingManual ? "Adding…" : "Add chapter"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowManual(false);
                            setManualOrgError(null);
                          }}
                          className="text-[13px] font-medium hover:underline"
                          style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Step 4 — Tier (fixed 3-pack presentation) */}
            <div className="mt-7">
              <div
                className="text-[13px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                4. Choose your pack
              </div>

              {foundingEligible && (
                <div
                  className="mb-3 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3"
                  style={{
                    background: "linear-gradient(90deg, #FFF7E6 0%, #FFFBF0 100%)",
                    border: "1px solid #F5C77E",
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="text-[13px] font-bold flex items-center gap-1.5"
                      style={{ color: "#92400E", fontFamily: "Inter, sans-serif" }}
                    >
                      🎉 Founding Chapter Offer
                    </div>
                    <div
                      className="text-[12px] mt-0.5"
                      style={{ color: "#92400E", fontFamily: "Inter, sans-serif" }}
                    >
                      {foundingClaimed} / {FOUNDING_CAP} claimed — {FOUNDING_DISCOUNT_PCT}% off your first purchase
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: "#92400E", color: "#FFF7E6", fontFamily: "Inter, sans-serif" }}
                  >
                    Auto-applied
                  </span>
                </div>
              )}

              {(() => {
                const PRESETS = [
                  { key: "house", name: "House", seats: 10, total: 750, badge: null as string | null, badgeColor: "" },
                  { key: "chapter", name: "Chapter", seats: 20, total: 1250, badge: "MOST POPULAR", badgeColor: RED },
                  { key: "gpa", name: "GPA Booster", seats: 30, total: 1500, badge: "BEST VALUE", badgeColor: "#15803D" },
                ];

                // Map preset to a real tier (by seats) so submission still works
                const findTier = (seats: number) =>
                  tiers.find((t) => t.seats === seats) || null;

                if (tiersLoading) {
                  return (
                    <div
                      className="rounded-lg px-3 py-4 text-[13px]"
                      style={{
                        border: "1px dashed #E0E7F0",
                        background: "#FAFBFC",
                        color: "#94A3B8",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Loading pricing…
                    </div>
                  );
                }

                return (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {PRESETS.map((p) => {
                      const matchedTier = findTier(p.seats);
                      const selected = matchedTier ? matchedTier.id === selectedTierId : false;
                      const discountedTotal = applyDiscount(p.total);
                      const perMember = Math.round(discountedTotal / p.seats);
                      const isPopular = p.key === "chapter";
                      return (
                        <button
                          key={p.key}
                          type="button"
                          disabled={!matchedTier}
                          onClick={() => matchedTier && setSelectedTierId(matchedTier.id)}
                          className="relative rounded-2xl p-5 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            background: "#fff",
                            border: `2px solid ${
                              selected ? NAVY : isPopular ? `${NAVY}33` : "#E0E7F0"
                            }`,
                            boxShadow: selected
                              ? `0 0 0 4px ${NAVY}1A, 0 8px 24px rgba(20,33,61,0.12)`
                              : isPopular
                                ? "0 4px 14px rgba(20,33,61,0.08)"
                                : "0 1px 3px rgba(0,0,0,0.04)",
                            transform: selected ? "translateY(-2px)" : "none",
                          }}
                        >
                          {p.badge && (
                            <span
                              className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                              style={{
                                background: p.badgeColor,
                                color: "#fff",
                                fontFamily: "Inter, sans-serif",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                              }}
                            >
                              {p.badge}
                            </span>
                          )}

                          <div
                            className="text-[14px] font-bold uppercase tracking-wider"
                            style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                          >
                            {p.name}
                          </div>
                          <div
                            className="text-[12px] mt-1"
                            style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                          >
                            {p.seats} members
                          </div>

                          <div
                            className="mt-4 text-[32px] font-bold leading-none flex items-baseline gap-2"
                            style={{
                              color: NAVY,
                              fontFamily: "Inter, sans-serif",
                              letterSpacing: "-0.03em",
                            }}
                          >
                            ${discountedTotal.toLocaleString()}
                            {totalDiscountPct > 0 && (
                              <span
                                className="text-[14px] font-medium line-through"
                                style={{ color: "#94A3B8", letterSpacing: 0 }}
                              >
                                ${p.total.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div
                            className="text-[12px] mt-1.5"
                            style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                          >
                            ${perMember}/member
                          </div>

                          {!matchedTier && (
                            <div
                              className="mt-3 text-[11px] italic"
                              style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                            >
                              Not yet available
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              <div
                className="mt-3 text-[12px]"
                style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
              >
                Used by 2 chapters at Ole Miss
              </div>
            </div>

            {/* Step 5 — Auto re-up */}
            <div className="mt-7">
              <div
                className="text-[13px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                5. Auto re-up <span style={{ color: "#94A3B8", fontWeight: 500 }}>(optional)</span>
              </div>

              <div
                className="rounded-xl p-4"
                style={{ background: "#FAFBFC", border: "1px solid #E0E7F0" }}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReupEnabled}
                    onChange={(e) => setAutoReupEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 cursor-pointer"
                    style={{ accentColor: NAVY }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[14px] font-semibold"
                      style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                    >
                      Auto-add seats when members join
                    </div>
                    <div
                      className="text-[12px] mt-0.5"
                      style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                    >
                      We'll summarize new seats weekly before billing.
                    </div>
                  </div>
                </label>

                <div
                  className={`mt-4 transition-opacity ${autoReupEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}
                >
                  <div
                    className="text-[12px] font-medium mb-1.5"
                    style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                  >
                    Weekly seat limit
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {WEEKLY_LIMIT_OPTIONS.map((n) => {
                      const selected = n === weeklySeatLimit;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setWeeklySeatLimit(n)}
                          disabled={!autoReupEnabled}
                          className="rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all"
                          style={{
                            background: selected ? NAVY : "#fff",
                            color: selected ? "#fff" : NAVY,
                            border: `1.5px solid ${selected ? NAVY : "#E0E7F0"}`,
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {n} seats / wk
                        </button>
                      );
                    })}
                  </div>
                  <div
                    className="text-[11px] mt-2"
                    style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                  >
                    Caps weekly auto-additions so a sudden rush never surprises your treasurer.
                  </div>
                </div>
              </div>
            </div>

            {/* Step 6 — Payment method */}
            <div className="mt-7">
              <div
                className="text-[13px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                6. Payment method
              </div>

              <div className="space-y-2">
                {([
                  {
                    id: "ach" as const,
                    title: "Bank account / ACH",
                    badge: "Recommended",
                    sub: "Bank account is recommended for chapter accounts to avoid card limits or declines.",
                  },
                  {
                    id: "card" as const,
                    title: "Card",
                    badge: null,
                    sub: "Visa, Mastercard, Amex, or Discover.",
                  },
                  {
                    id: "manual" as const,
                    title: "Manual invoice / check",
                    badge: null,
                    sub: "Manual payments can take up to 5 business days to activate.",
                  },
                ]).map((opt) => {
                  const selected = paymentMethod === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className="flex items-start gap-3 cursor-pointer rounded-xl p-3.5 transition-all"
                      style={{
                        background: selected ? "#F5F8FF" : "#fff",
                        border: `1.5px solid ${selected ? NAVY : "#E0E7F0"}`,
                      }}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        value={opt.id}
                        checked={selected}
                        onChange={() => setPaymentMethod(opt.id)}
                        className="mt-1 h-4 w-4 cursor-pointer"
                        style={{ accentColor: NAVY }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div
                            className="text-[14px] font-semibold"
                            style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                          >
                            {opt.title}
                          </div>
                          {opt.badge && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                              style={{
                                background: NAVY,
                                color: "#fff",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <div
                          className="text-[12px] mt-0.5"
                          style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                        >
                          {opt.sub}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {paymentMethod === "manual" && (
                <div
                  className="mt-2 rounded-lg p-3 text-[12px]"
                  style={{
                    background: "#FFF8E6",
                    border: "1px solid #F5D88B",
                    color: "#8A6A1F",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Your signup link will activate once we receive payment. We'll email{" "}
                  <strong>{email || "your contact"}</strong> with invoice details.
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleCheckout}
              className="mt-7 w-full rounded-xl px-5 py-3.5 text-[15px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:scale-[1.01] active:enabled:scale-[0.99]"
              style={{
                background: RED,
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 6px 16px rgba(206,17,38,0.25)",
              }}
            >
              {(() => {
                if (submitting) return "Working…";
                if (!tier) return "Continue";
                const ctaTotal = applyDiscount(tier.total);
                const verb = paymentMethod === "manual" ? "Request invoice" : "Continue";
                return `${verb} → ${tier.seats} passes · $${ctaTotal.toLocaleString()}`;
              })()}
            </button>

            <div
              className="mt-3 flex items-center justify-center gap-1.5 text-[12px]"
              style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
            >
              <ShieldCheck size={14} />
              Secure checkout · No upfront commitment from members
            </div>
              </>
            )}
          </div>

          {/* SECONDARY CARD */}
          <aside
            className="rounded-2xl p-5 sm:p-6 h-fit"
            style={{
              background: "#fff",
              boxShadow:
                "0 24px 60px rgba(20,33,61,0.06), 0 2px 8px rgba(20,33,61,0.04)",
              border: "1px solid #E0E7F0",
            }}
          >
            <h3
              className="text-[20px] leading-tight"
              style={{
                color: NAVY,
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
              }}
            >
              What chapter access includes
            </h3>
            <p
              className="mt-1.5 text-[13px]"
              style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
            >
              Everything members need for their accounting exams — funded once by the chapter.
            </p>

            <ul className="mt-4 space-y-3">
              {[
                {
                  icon: Users,
                  title: "Seats for your members",
                  body: "Each pass unlocks full course access for one member, all semester.",
                },
                {
                  icon: Link2,
                  title: "One shared signup link",
                  body: "Members claim a seat with their school email. No codes to track.",
                },
                {
                  icon: Sparkles,
                  title: "Full Survive Accounting library",
                  body: "Every chapter, every problem, every walkthrough video — Intro & Intermediate.",
                },
                {
                  icon: ShieldCheck,
                  title: "Unused seats roll over",
                  body: "Anything you don't claim becomes a discount on your next semester.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "#F0F6FF", color: NAVY }}
                  >
                    <Icon size={16} />
                  </div>
                  <div>
                    <div
                      className="text-[14px] font-semibold"
                      style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                    >
                      {title}
                    </div>
                    <div
                      className="text-[13px] leading-snug"
                      style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                    >
                      {body}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <Suspense fallback={<div style={{ minHeight: 200 }} />}>
        <StagingTestimonialsSection onCtaClick={() => navigate("/staging")} />
      </Suspense>

      <LandingFooter
        onScrollToCourses={() => navigate("/staging")}
        onScrollToContact={() => navigate("/staging")}
      />
    </div>
  );
}
