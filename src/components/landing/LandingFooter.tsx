import { useState } from "react";
import { AboutLeeModal } from "@/components/AboutLeeModal";

const NAVY = "#14213D";
const FOOTER_BG = "#0B1120";

interface LandingFooterProps {
  onScrollToCourses?: () => void;
  onScrollToContact?: () => void;
}

export default function LandingFooter({ onScrollToCourses, onScrollToContact }: LandingFooterProps) {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <footer style={{ background: FOOTER_BG }}>
        <div className="mx-auto max-w-[900px] px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            {/* Column 1: Brand */}
            <div>
              <span className="text-[16px] text-white" style={{ fontFamily: "Inter, sans-serif" }}>
                <span className="font-bold">Survive</span>{" "}
                <span className="font-normal">Accounting</span>
                <sup className="text-[8px] font-normal ml-0.5 opacity-50">™</sup>
              </span>
              <p className="text-[13px] mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "Inter, sans-serif" }}>
                Exam prep that helps you do more than survive.
              </p>
            </div>

            {/* Column 2: Links */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                Links
              </p>
              {[
                { label: "Courses", onClick: onScrollToCourses },
                { label: "About Lee", onClick: () => setAboutOpen(true) },
                { label: "Contact", onClick: onScrollToContact },
                { label: "Student Login", href: "/login" },
              ].map((item) => (
                <div key={item.label}>
                  {item.href ? (
                    <a
                      href={item.href}
                      className="block text-[13px] text-white/50 hover:text-white transition-colors"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <button
                      onClick={item.onClick}
                      className="block text-[13px] text-white/50 hover:text-white transition-colors"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {item.label}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Column 3: Legal */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                Legal
              </p>
              <a href="/privacy" className="block text-[13px] text-white/50 hover:text-white transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
                Privacy Policy
              </a>
              <a href="/terms" className="block text-[13px] text-white/50 hover:text-white transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
                Terms of Service
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="mx-auto max-w-[900px] px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Inter, sans-serif" }}>
              © 2026 Earned Wisdom, LLC · Created by Lee Ingram
            </p>
            <p className="text-[11px] italic" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Inter, sans-serif" }}>
              In memory of Ben Ingram 🤍
            </p>
          </div>
        </div>
      </footer>

      <AboutLeeModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
