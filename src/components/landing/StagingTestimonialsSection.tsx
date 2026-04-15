import { useEffect, useRef } from "react";

const NAVY = "#14213D";
const RED = "#CE1126";
const EMBED_ID = "484dc267-e1b2-425c-b5c6-49d9525cec9f";

interface StagingTestimonialsSectionProps {
  onCtaClick: () => void;
}

export default function StagingTestimonialsSection({ onCtaClick }: StagingTestimonialsSectionProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  return (
    <section style={{ background: NAVY }} className="py-16 sm:py-20 px-4 sm:px-6">
      <div className="mx-auto max-w-[800px]">
        <div className="text-center mb-10">
          <h2
            className="text-[24px] sm:text-[30px] text-white tracking-tight"
            style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            Students are already seeing results
          </h2>
        </div>

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
