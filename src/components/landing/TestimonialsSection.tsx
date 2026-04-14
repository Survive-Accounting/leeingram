import { useEffect, useRef } from "react";

const EMBED_ID = "484dc267-e1b2-425c-b5c6-49d9525cec9f";

export default function TestimonialsSection() {
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
    <section style={{ background: "#14213D" }} className="py-12 px-4">
      <div className="mx-auto max-w-[780px]">
        <h2
          className="text-center text-[22px] sm:text-[26px] text-white mb-8"
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          What Students Are Saying
        </h2>
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
