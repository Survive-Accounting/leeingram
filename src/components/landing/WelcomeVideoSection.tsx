import { useState } from "react";
import welcomeVideoThumbnail from "@/assets/welcome-video-thumbnail.png";

const NAVY = "#14213D";
const RED = "#CE1126";

export default function WelcomeVideoSection() {
  const [videoPlaying, setVideoPlaying] = useState(false);

  return (
    <section
      className="px-4 sm:px-6 pt-12 sm:pt-16 pb-2"
      style={{ background: "#FFFFFF" }}
    >
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <p
          className="text-center mb-2 text-[11px] sm:text-[12px] font-semibold tracking-[0.14em] uppercase"
          style={{ color: RED, fontFamily: "Inter, sans-serif" }}
        >
          A quick hello from Lee
        </p>
        <p
          className="text-center mb-6 text-[22px] sm:text-[28px] md:text-[34px] leading-tight"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Watch the welcome — 60 seconds.
        </p>

        <div
          className="relative w-full overflow-hidden rounded-2xl mx-auto"
          style={{
            paddingTop: "56.25%",
            background: "#000",
            border: "1px solid rgba(20,33,61,0.12)",
            boxShadow:
              "0 20px 60px rgba(20,33,61,0.18), 0 0 0 1px rgba(20,33,61,0.04)",
          }}
        >
          {videoPlaying ? (
            <iframe
              src="https://player.vimeo.com/video/1187869081?h=e85670e031&autoplay=1&title=0&byline=0&portrait=0&dnt=1"
              title="Welcome from Lee Ingram"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              style={{ border: 0 }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setVideoPlaying(true)}
              aria-label="Play welcome video"
              className="absolute inset-0 w-full h-full flex items-center justify-center group cursor-pointer"
              style={{
                background:
                  "linear-gradient(135deg, rgba(20,33,61,0.55) 0%, rgba(20,33,61,0.25) 100%)",
              }}
            >
              <img
                src={welcomeVideoThumbnail}
                alt="Lee Ingram welcome"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.9, zIndex: 0 }}
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(20,33,61,0.35) 0%, rgba(20,33,61,0.15) 100%)",
                  zIndex: 1,
                }}
              />
              <div
                className="relative flex items-center justify-center rounded-full"
                style={{
                  width: 76,
                  height: 76,
                  background: "rgba(255,255,255,0.96)",
                  boxShadow:
                    "0 10px 30px rgba(0,0,0,0.35), 0 0 0 8px rgba(255,255,255,0.18)",
                  zIndex: 2,
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 4 }} aria-hidden>
                  <path d="M6 4l14 8-14 8V4z" fill="#14213D" />
                </svg>
              </div>
              <span
                className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px] font-semibold tracking-wide"
                style={{
                  color: "rgba(255,255,255,0.95)",
                  fontFamily: "Inter, sans-serif",
                  textShadow: "0 1px 6px rgba(0,0,0,0.45)",
                  zIndex: 2,
                }}
              >
                Watch the welcome — 60 sec
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
