import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ShieldCheck, Users, Link2, Sparkles, Search } from "lucide-react";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const StagingTestimonialsSection = lazy(
  () => import("@/components/landing/StagingTestimonialsSection"),
);

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";

// Volume tiers — keep in sync with greek-portal-architecture.md
const TIERS = [
  { seats: 10, total: 1500 },
  { seats: 20, total: 2600, recommended: true },
  { seats: 30, total: 3600 },
  { seats: 40, total: 4400 },
  { seats: 50, total: 5000 },
];

type GreekOrg = {
  id: string;
  org_name: string;
  council: string | null;
  org_type: string | null;
  aliases: string[] | null;
};

export default function GetOrgAccess() {
  const navigate = useNavigate();

  // --- Org picker state ---
  const [orgs, setOrgs] = useState<GreekOrg[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [manualOrgName, setManualOrgName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // --- Tier selection ---
  const [selectedTierIdx, setSelectedTierIdx] = useState(1); // 20-seat default
  const tier = TIERS[selectedTierIdx];
  const perSeat = Math.round(tier.total / tier.seats);

  // --- Submit state ---
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("greek_orgs")
        .select("id, org_name, council, org_type, aliases")
        .order("org_name", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[get-org-access] greek_orgs", error);
      } else {
        setOrgs((data as GreekOrg[]) || []);
      }
      setOrgsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) => {
      if (o.org_name.toLowerCase().includes(q)) return true;
      if ((o.aliases || []).some((a) => a.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [orgs, search]);

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === selectedOrgId) || null,
    [orgs, selectedOrgId],
  );

  const canSubmit =
    !!contactEmail.trim() &&
    (!!selectedOrg || !!manualOrgName.trim()) &&
    !submitting;

  const handleCheckout = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Placeholder: Stripe checkout for org licensing not wired yet.
      // For now, just store the intent so admin can follow up.
      toast.success(
        "Got it — we'll be in touch shortly to finalize your chapter's passes.",
      );
      console.info("[get-org-access intent]", {
        org_id: selectedOrg?.id || null,
        org_name_manual: selectedOrg ? null : manualOrgName.trim(),
        contact_email: contactEmail.trim().toLowerCase(),
        seats: tier.seats,
        total: tier.total,
      });
    } catch (err) {
      console.error("[get-org-access checkout]", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
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

      {/* Main + secondary cards */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-[1100px] mx-auto grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
          {/* MAIN CARD — Org setup + seat checkout */}
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

              {/* Price badge */}
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
                  ${tier.total.toLocaleString()}
                </div>
                <div
                  className="mt-1.5 text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                >
                  ${perSeat}/seat
                </div>
              </div>
            </div>

            {/* Step 1 — Pick your org */}
            <div className="mt-6">
              <div
                className="text-[13px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                1. Find your chapter
              </div>

              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#94A3B8" }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedOrgId(null);
                  }}
                  placeholder="Search by name or letters (e.g. KD, Pike, AOPi)…"
                  className="w-full rounded-lg pl-9 pr-3 py-2.5 text-[14px] outline-none transition-colors"
                  style={{
                    border: "1px solid #E0E7F0",
                    fontFamily: "Inter, sans-serif",
                    color: NAVY,
                  }}
                />
              </div>

              {/* Results */}
              <div
                className="mt-2 rounded-lg max-h-[220px] overflow-y-auto"
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
                  filteredOrgs.slice(0, 60).map((o) => {
                    const selected = o.id === selectedOrgId;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setSelectedOrgId(o.id);
                          setManualOrgName("");
                        }}
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
                          </div>
                          <div
                            className="text-[11px] truncate"
                            style={{ color: "#94A3B8" }}
                          >
                            {o.council || "Greek"}{o.org_type ? ` · ${o.org_type}` : ""}
                          </div>
                        </div>
                        {selected && <Check size={16} style={{ color: NAVY }} />}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Manual fallback */}
              <div className="mt-3">
                <label
                  className="block text-[12px] mb-1"
                  style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                >
                  Don't see your chapter? Type the name:
                </label>
                <input
                  type="text"
                  value={manualOrgName}
                  onChange={(e) => {
                    setManualOrgName(e.target.value);
                    if (e.target.value) setSelectedOrgId(null);
                  }}
                  placeholder="e.g. Theta Chi"
                  className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                  style={{
                    border: "1px solid #E0E7F0",
                    fontFamily: "Inter, sans-serif",
                    color: NAVY,
                  }}
                />
              </div>
            </div>

            {/* Step 2 — Seat tier */}
            <div className="mt-7">
              <div
                className="text-[13px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                2. Choose your pack
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {TIERS.map((t, i) => {
                  const selected = i === selectedTierIdx;
                  return (
                    <button
                      key={t.seats}
                      type="button"
                      onClick={() => setSelectedTierIdx(i)}
                      className="relative rounded-xl p-3 text-left transition-all"
                      style={{
                        background: selected ? "#F0F6FF" : "#fff",
                        border: `1.5px solid ${selected ? NAVY : "#E0E7F0"}`,
                        boxShadow: selected
                          ? "0 4px 12px rgba(20,33,61,0.08)"
                          : "none",
                      }}
                    >
                      {t.recommended && (
                        <span
                          className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                          style={{
                            background: RED,
                            color: "#fff",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Popular
                        </span>
                      )}
                      <div
                        className="text-[20px] font-bold leading-none"
                        style={{
                          color: NAVY,
                          fontFamily: "Inter, sans-serif",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {t.seats}
                      </div>
                      <div
                        className="text-[11px] mt-0.5"
                        style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                      >
                        passes
                      </div>
                      <div
                        className="text-[13px] font-semibold mt-2"
                        style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                      >
                        ${t.total.toLocaleString()}
                      </div>
                      <div
                        className="text-[10px]"
                        style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                      >
                        ${Math.round(t.total / t.seats)}/seat
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3 — Contact */}
            <div className="mt-7">
              <div
                className="text-[13px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                3. Your email
              </div>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@chapter.org"
                className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                style={{
                  border: "1px solid #E0E7F0",
                  fontFamily: "Inter, sans-serif",
                  color: NAVY,
                }}
              />
              <p
                className="mt-1.5 text-[12px]"
                style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
              >
                We'll send the receipt and your shareable signup link here.
              </p>
            </div>

            {/* Submit */}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleCheckout}
              className="mt-6 w-full rounded-xl px-5 py-3.5 text-[15px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:scale-[1.01] active:enabled:scale-[0.99]"
              style={{
                background: RED,
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 6px 16px rgba(206,17,38,0.25)",
              }}
            >
              {submitting
                ? "Working…"
                : `Continue → ${tier.seats} passes · $${tier.total.toLocaleString()}`}
            </button>

            <div
              className="mt-3 flex items-center justify-center gap-1.5 text-[12px]"
              style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
            >
              <ShieldCheck size={14} />
              Secure checkout · No upfront commitment from members
            </div>
          </div>

          {/* SECONDARY CARD — What's included */}
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
