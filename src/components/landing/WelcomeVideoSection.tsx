import { useState } from "react";
import { Play } from "lucide-react";
import welcomeThumbnail from "@/assets/welcome-video-thumbnail.jpeg";

const NAVY = "#14213D";
const RED = "#CE1126";

export default function WelcomeVideoSection() {
  const [playing, setPlaying] = useState(false);

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
          Watch the demo.
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
          {playing ? (
            <iframe
              src="https://player.vimeo.com/video/1187869081?h=e85670e031&title=0&byline=0&portrait=0&dnt=1&autoplay=1"
              title="Welcome from Lee Ingram"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              style={{ border: 0 }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Play welcome video"
              className="absolute inset-0 w-full h-full group cursor-pointer"
              style={{ border: 0, padding: 0 }}
            >
              <img
                src={welcomeThumbnail}
                alt="Lee Ingram at sunrise"
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(20,33,61,0.18)" }}
              >
                <span
                  className="flex items-center justify-center rounded-full transition-transform group-hover:scale-105"
                  style={{
                    width: 78,
                    height: 78,
                    background: RED,
                    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                  }}
                >
                  <Play
                    className="w-8 h-8"
                    fill="#FFFFFF"
                    color="#FFFFFF"
                    style={{ marginLeft: 4 }}
                  />
                </span>
              </div>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
