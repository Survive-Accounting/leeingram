export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen" style={{ background: "#F8F8FA" }}>
      <div className="mx-auto max-w-[700px] px-4 py-16">
        <h1 className="text-[28px] mb-6" style={{ fontFamily: "'DM Serif Display', serif", color: "#14213D" }}>
          Privacy Policy
        </h1>
        <p className="text-[14px] leading-relaxed" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>
          This page is a placeholder. A full privacy policy will be published here soon.
        </p>
        <p className="text-[14px] mt-4" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>
          Questions? Email{" "}
          <a href="mailto:lee@surviveaccounting.com" className="underline" style={{ color: "#3B82F6" }}>
            lee@surviveaccounting.com
          </a>
        </p>
        <a href="/" className="inline-block mt-8 text-[13px] font-medium hover:underline" style={{ color: "#14213D" }}>
          ← Back to home
        </a>
      </div>
    </div>
  );
}
