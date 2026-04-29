import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AboutLeeModal } from "@/components/AboutLeeModal";
import StudentLoginModal from "@/components/landing/StudentLoginModal";
import { useIsStaff } from "@/hooks/useIsStaff";

const NAVY = "#14213D";
const RED = "#CC0000";
const FOOTER_BG = "#0f172a";

interface LandingFooterProps {
  onScrollToCourses?: () => void;
  onScrollToContact?: () => void;
  onScrollToTestimonials?: () => void;
  onPricingClick?: () => void;
}

export default function LandingFooter({
  onScrollToCourses,
  onScrollToContact,
  onScrollToTestimonials,
  onPricingClick,
}: LandingFooterProps) {
  const navigate = useNavigate();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const isStaff = useIsStaff();

  const linkClass =
    "block text-[13px] text-left no-underline hover:underline transition-colors";
  const linkStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter, sans-serif",
  };
  const headerStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.5)",
    opacity: 0.85,
    fontFamily: "Inter, sans-serif",
    letterSpacing: "0.14em",
  };

  const goCourse = (slug: string) => {
    if (onScrollToCourses) onScrollToCourses();
    // Optional: could navigate to course landing in future
    void slug;
  };

  const handleTestimonials = () => {
    if (onScrollToTestimonials) {
      onScrollToTestimonials();
      return;
    }
    const el = document.querySelector('[data-section="testimonials"]') as HTMLElement | null;
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <>
      <footer style={{ background: FOOTER_BG }}>
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 sm:gap-12">
            {/* Brand */}
            <div className="sm:col-span-1">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-[18px] tracking-tight text-left hover:opacity-90 transition-opacity"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                <span style={{ color: RED, fontWeight: 800 }}>Survive</span>
                <span style={{ color: "#FFFFFF", fontWeight: 400 }}>
                  {" "}Accounting
                  <sup className="text-[9px] font-normal ml-0.5 opacity-70">™</sup>
                </span>
              </button>
              <p
                className="text-[13px] mt-3 leading-relaxed"
                style={{ color: "rgba(255,255,255,0.55)", fontFamily: "Inter, sans-serif" }}
              >
                Built to help you survive — and thrive.
              </p>
            </div>

            {/* STUDY */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase mb-3" style={headerStyle}>
                Study
              </p>
              <button onClick={() => goCourse("intro-accounting-1")} className={linkClass} style={linkStyle}>
                Intro Accounting 1
              </button>
              <button onClick={() => goCourse("intro-accounting-2")} className={linkClass} style={linkStyle}>
                Intro Accounting 2
              </button>
              <button onClick={() => goCourse("intermediate-accounting-1")} className={linkClass} style={linkStyle}>
                Intermediate Accounting 1
              </button>
              <button onClick={() => goCourse("intermediate-accounting-2")} className={linkClass} style={linkStyle}>
                Intermediate Accounting 2
              </button>
            </div>

            {/* PLATFORM */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase mb-3" style={headerStyle}>
                Platform
              </p>
              <button onClick={() => setAboutOpen(true)} className={linkClass} style={linkStyle}>
                About Lee Ingram
              </button>
              <button
                onClick={() => (onPricingClick ? onPricingClick() : navigate("/get-access"))}
                className={linkClass}
                style={linkStyle}
              >
                Pricing
              </button>
              <button onClick={handleTestimonials} className={linkClass} style={linkStyle}>
                Reviews
              </button>
              <button onClick={onScrollToContact} className={linkClass} style={linkStyle}>
                Contact
              </button>
            </div>

            {/* LEGAL */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase mb-3" style={headerStyle}>
                Legal
              </p>
              <a href="/privacy" className={linkClass} style={linkStyle}>
                Privacy Policy
              </a>
              <a href="/terms" className={linkClass} style={linkStyle}>
                Terms of Service
              </a>
              <button onClick={() => setRefundOpen(true)} className={linkClass} style={linkStyle}>
                Request Refund
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Inter, sans-serif" }}>
              © 2026 Earned Wisdom, LLC · Created by Lee Ingram
            </p>
            <p
              className="text-[12px] sm:text-right"
              style={{ color: "rgba(255,255,255,0.5)", opacity: 0.5, fontFamily: "Inter, sans-serif", fontWeight: 400 }}
            >
              In memory of my twin Ben Ingram (1993–2017)
            </p>
          </div>
        </div>
      </footer>

      <AboutLeeModal open={aboutOpen} onOpenChange={setAboutOpen} />
      <StudentLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />

      {/* Lightweight refund modal */}
      {refundOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setRefundOpen(false)}
        >
          <div
            className="rounded-xl p-6 max-w-[460px] w-full"
            style={{ background: "#FFFFFF" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[20px] mb-2" style={{ fontFamily: "'DM Serif Display', serif", color: NAVY }}>
              Request a Refund
            </h3>
            <p className="text-[14px] leading-relaxed mb-4" style={{ color: NAVY, opacity: 0.8, fontFamily: "Inter, sans-serif" }}>
              We offer a 7-day refund guarantee. Email{" "}
              <a href="mailto:lee@surviveaccounting.com" className="underline" style={{ color: RED }}>
                lee@surviveaccounting.com
              </a>{" "}
              with your order details and we'll process it within 1 business day.
            </p>
            <button
              onClick={() => setRefundOpen(false)}
              className="text-[13px] font-semibold rounded-lg px-4 py-2"
              style={{ background: NAVY, color: "#FFFFFF", fontFamily: "Inter, sans-serif" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
