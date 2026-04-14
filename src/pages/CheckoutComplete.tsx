import { CheckCircle } from "lucide-react";

export default function CheckoutComplete() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F8F9FA" }}>
      <div className="max-w-md w-full text-center space-y-4">
        <CheckCircle className="h-12 w-12 mx-auto" style={{ color: "#22C55E" }} />
        <h1 className="text-2xl font-bold" style={{ color: "#14213D" }}>
          Payment received!
        </h1>
        <p className="text-[15px]" style={{ color: "#14213D" }}>
          Check your email for your login link.
        </p>
        <p className="text-[13px]" style={{ color: "#666666" }}>
          It may take a minute to arrive.
        </p>
      </div>
    </div>
  );
}
