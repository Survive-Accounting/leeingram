import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NAVY = "#14213D";
const RED = "#CE1126";
const EMBED_ID = "484dc267-e1b2-425c-b5c6-49d9525cec9f";
const TARGET_COUNT = 597;

interface StagingTestimonialsSectionProps {
  onCtaClick: () => void;
}

/** Slot machine digit — cycles random digits then locks on target. */
function SlotDigit({ target, delay, active }: { target: number; delay: number; active: boolean }) {
  const [digit, setDigit] = useState(0);
  const lockedRef = useRef(false);

  useEffect(() => {
    if (!active || lockedRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDigit(target);
      lockedRef.current = true;
      return;
    }
    const startAt = performance.now() + delay;
    const totalDuration = 1500 - delay;
    let raf = 0;
    const tick = (now: number) => {
      if (now < startAt) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - startAt;
      const t = Math.min(elapsed / totalDuration, 1);
      // ease-out: faster early, slower late
      const eased = 1 - Math.pow(1 - t, 3);
      if (t >= 1) {
        setDigit(target);
        lockedRef.current = true;
        return;
      }
      // Spin frequency decreases as we ease out
      const spinInterval = 40 + eased * 200;
      const phase = Math.floor(elapsed / spinInterval);
      setDigit(phase % 10);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, delay]);

  return <span style={{ display: "inline-block", minWidth: "0.6em", textAlign: "center" }}>{digit}</span>;
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

  // Digits: 5 (delay 0), 9 (delay 150), 7 (delay 300)
  const digits = String(TARGET_COUNT).split("").map(Number);
  const delays = [0, 150, 300];

  return (
    <section style={{ background: "#F8F8F8" }} className="py-16 sm:py-20 px-4 sm:px-6">
      <div className="mx-auto max-w-[800px]">
        <TooltipProvider delayDuration={150}>
          <p
            className="text-center mb-8 text-[20px] sm:text-[24px] md:text-[28px] leading-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            <span
              ref={counterRef}
              className="inline-block text-[36px] sm:text-[44px] md:text-[52px] font-bold align-middle"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
            >
              {digits.map((d, i) => (
                <SlotDigit key={i} target={d} delay={delays[i] ?? 0} active={animate} />
              ))}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <sup className="cursor-help" style={{ color: NAVY, fontSize: "0.5em", marginLeft: 2 }}>*</sup>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                Updated as students join. Placeholder until launch.
              </TooltipContent>
            </Tooltip>
            <span className="block mt-2">Ole Miss students have survived (and thrived) since 2020</span>
          </p>
        </TooltipProvider>

        <iframe
          ref={iframeRef}
          id={`testimonialto-${EMBED_ID}`}
          src={`https://embed-v2.testimonial.to/w/survive-accounting-with-lee-ingram?id=${EMBED_ID}`}
          frameBorder="0"
          scrolling="no"
          style={{ width: "100%", border: "none", minHeight: 300 }}
        />

        <div className="mt-12 flex justify-center">
          <button
            onClick={onCtaClick}
            className="rounded-xl px-8 py-4 text-[16px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: RED,
              boxShadow: "0 4px 16px rgba(206,17,38,0.25)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Start Studying →
          </button>
        </div>
      </div>
    </section>
  );
}
