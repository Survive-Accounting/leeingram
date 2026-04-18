import { useNavigate } from "react-router-dom";

const NAVY = "#14213D";
const RED = "#CE1126";

export default function CheckoutCancelled() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#F8F9FA" }}
    >
      <div
        className="max-w-md w-full rounded-2xl p-8 text-center space-y-5"
        style={{ background: "#fff", border: "1px solid #E5E7EB" }}
      >
        <h1
          className="text-2xl font-bold"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', Georgia, serif" }}
        >
          No worries — your spot is still here.
        </h1>
        <p className="text-[15px]" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>
          Ready when you are.
        </p>
        <button
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/");
          }}
          className="rounded-lg px-6 text-white text-[15px] font-semibold inline-flex items-center justify-center transition-opacity hover:opacity-90"
          style={{ minHeight: 48, background: RED, fontFamily: "Inter, sans-serif" }}
        >
          ← Back to studying
        </button>
      </div>
    </div>
  );
}
