import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

/**
 * /about-solutions — public transparency page explaining how
 * AI-assisted solutions are created and reviewed.
 */
export default function AboutSolutions() {
  return (
    <>
      <Helmet>
        <title>How We Create Our Solutions — Survive Accounting</title>
        <meta
          name="description"
          content="How Survive Accounting uses AI to create accounting solutions, what we check for accuracy, and how to report issues."
        />
        <link rel="canonical" href="https://learn.surviveaccounting.com/about-solutions" />
      </Helmet>

      <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
        {/* Header band — matches site navy */}
        <header style={{ background: "#14213D", padding: "20px 24px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <Link
              to="/"
              style={{
                color: "rgba(255,255,255,0.85)",
                textDecoration: "none",
                fontFamily: "Inter, sans-serif",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              ← Survive Accounting
            </Link>
          </div>
        </header>

        <main
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: "48px 24px 64px",
            color: "#1A1A1A",
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.65,
          }}
        >
          <h1
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 40,
              fontWeight: 400,
              color: "#14213D",
              marginBottom: 32,
              lineHeight: 1.15,
            }}
          >
            How we create our solutions
          </h1>

          <Section title="Why we use AI">
            Accounting solutions require precision, step-by-step clarity, and consistent
            formatting across thousands of practice problems. We use AI to generate
            high-quality explanations at the level of a patient, knowledgeable tutor —
            then review them for accuracy before they reach you.
          </Section>

          <Section title="What we check">
            Every AI-enabled solution is reviewed to ensure:
            <ul style={{ marginTop: 12, paddingLeft: 20 }}>
              <li>All calculations are correct</li>
              <li>Journal entries balance</li>
              <li>US GAAP rules are applied properly</li>
              <li>The explanation matches the specific problem</li>
              <li>The voice is clear and student-friendly</li>
            </ul>
          </Section>

          <Section title="How to report an issue">
            If you spot something that doesn't look right, use the "Suggest a fix"
            link on any solution page. We review every submission and fix issues
            within 2 business days.
          </Section>

          <Section title="Our commitment">
            We believe in being transparent about how our content is made. AI helps
            us build better study tools faster — but accuracy and your trust come
            first. If something is wrong, we want to know.
          </Section>

          <footer
            style={{
              marginTop: 48,
              paddingTop: 24,
              borderTop: "1px solid #E0E0E0",
              fontSize: 13,
              color: "#666666",
            }}
          >
            Questions?{" "}
            <a
              href="mailto:lee@surviveaccounting.com"
              style={{ color: "#CE1126", textDecoration: "underline" }}
            >
              Get in touch
            </a>
          </footer>
        </main>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 22,
          fontWeight: 400,
          color: "#14213D",
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 16, color: "#1A1A1A" }}>{children}</div>
    </section>
  );
}
