import { useEffect, useRef, useState } from "react";

const NAVY = "#14213D";
const RED = "#CE1126";
const EMBED_ID = "484dc267-e1b2-425c-b5c6-49d9525cec9f";
const TARGET_COUNT = 1200;
const FINALS_DATE = new Date(2026, 4, 4); // May 4, 2026 (local)

/** Returns the countdown line text, or null if exam date has passed. */
function getFinalsCountdownText(): string | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(FINALS_DATE.getFullYear(), FINALS_DATE.getMonth(), FINALS_DATE.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((target.getTime() - today.getTime()) / msPerDay);
  if (days <= 0) return null;
  const weeks = Math.floor(days / 7);
  if (weeks < 1) return "Final exams are almost here.";
  return `Final exams are ${weeks} weeks away.`;
}

interface StagingTestimonialsSectionProps {
  onCtaClick: () => void;
}

/** Counter that animates from 0 to target with ease-out. */
function Counter({ target, active }: { target: number; active: boolean }) {
  const [value, setValue] = useState(0);
  const lockedRef = useRef(false);

  useEffect(() => {
    if (!active || lockedRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setValue(target);
      lockedRef.current = true;
      return;
    }
    const startAt = performance.now();
    const duration = 1800;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startAt;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.floor(eased * target);
      setValue(current);
      if (t >= 1) {
        setValue(target);
        lockedRef.current = true;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);

  return <span>{value.toLocaleString()}</span>;
}

export default function StagingTestimonialsSection({ onCtaClick }: StagingTestimonialsSectionProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const scriptId = "testimonialto-resizer";
    if (document.getElementById(scriptId)) {
      if ((window as any).iFrameResize && iframeRef.current) {
        (window as any).iFrameResize({ log: false, checkOrigin: false }, `#testimonialto-${EMBED_ID}`);
      }
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://testimonial.to/js/iframeResizer.min.js";
    script.async = true;
    script.onload = () => {
      if ((window as any).iFrameResize && iframeRef.current) {
        (window as any).iFrameResize({ log: false, checkOrigin: false }, `#testimonialto-${EMBED_ID}`);
      }
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!counterRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setAnimate(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    obs.observe(counterRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      style={{
        background: "#FFFFFF",
      }}
      className="pt-12 sm:pt-16 pb-24 sm:pb-28 px-4 sm:px-6 relative"
    >
      {/* Subtle separator */}
      <div
        aria-hidden="true"
        className="mx-auto"
        style={{
          width: 120,
          height: 4,
          marginBottom: 32,
          background: "linear-gradient(to right, transparent, #E5E7EB, transparent)",
        }}
      />
      <div className="mx-auto max-w-[800px]" style={{ paddingTop: 16 }}>
        <p
          className="text-center mb-8 text-[22px] sm:text-[28px] md:text-[34px] leading-tight"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Trusted by{" "}
          <span
            ref={counterRef}
            className="inline-block align-baseline"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 700 }}
          >
            <Counter target={TARGET_COUNT} active={animate} />
            <span>+</span>
          </span>
          {" "}accounting students preparing for exams.
        </p>

        <iframe
          ref={iframeRef}
          id={`testimonialto-${EMBED_ID}`}
          src={`https://embed-v2.testimonial.to/w/survive-accounting-with-lee-ingram?id=${EMBED_ID}`}
          frameBorder="0"
          scrolling="no"
          style={{ width: "100%", border: "none", minHeight: 300 }}
        />
      </div>
    </section>
  );
}
