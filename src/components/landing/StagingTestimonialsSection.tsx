import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NAVY = "#14213D";
const RED = "#CE1126";
const EMBED_ID = "484dc267-e1b2-425c-b5c6-49d9525cec9f";
const TARGET_COUNT = 1000;

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

  // Digits: 1, 0, 0, 0 + "+" suffix
  const digits = String(TARGET_COUNT).split("").map(Number);
  const delays = [0, 120, 240, 360];

  return (
    <section style={{ background: "#F8F8F8" }} className="py-16 sm:py-20 px-4 sm:px-6">
      <div className="mx-auto max-w-[800px]">
        <TooltipProvider delayDuration={150}>
          <p
            className="text-center mb-8 text-[22px] sm:text-[28px] md:text-[34px] leading-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 700 }}
          >
            <span style={{ fontWeight: 400 }}>I've helped{" "}</span>
            <span
              ref={counterRef}
              className="inline-block align-baseline"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
            >
              {digits.map((d, i) => (
                <SlotDigit key={i} target={d} delay={delays[i] ?? 0} active={animate} />
              ))}
              <span>+</span>
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <sup className="cursor-help" style={{ color: NAVY, fontSize: "0.45em", marginLeft: 2, fontWeight: 400 }}>*</sup>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                Updated as students join.
              </TooltipContent>
            </Tooltip>
            {" "}<span style={{ fontWeight: 400 }}>students{" "}</span>
            <span style={{ color: "#888888", opacity: 0.5, fontStyle: "italic", textDecoration: "line-through", fontWeight: 400 }}>
              survived
            </span>{" "}
            <span style={{ color: RED, fontWeight: 700, fontSize: "1.08em" }}>
              thrived
            </span>{" "}
            <span style={{ fontWeight: 400 }}>in accounting since 2015.</span>
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
