const NAVY = "#14213D";
const RED = "#CE1126";

export default function WelcomeVideoSection() {
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
          Watch the welcome.
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
          <iframe
            src="https://player.vimeo.com/video/1187869081?h=e85670e031&title=0&byline=0&portrait=0&dnt=1"
            title="Welcome from Lee Ingram"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            style={{ border: 0 }}
          />
        </div>
      </div>
    </section>
  );
}
