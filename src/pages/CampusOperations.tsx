import { Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NAVY = "#14213D";

export default function CampusOperations() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#F8F8FA" }}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/domains")}
        className="absolute top-4 left-4 text-muted-foreground"
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
      </Button>

      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "rgba(20,33,61,0.08)" }}
      >
        <Building2 className="h-7 w-7" style={{ color: NAVY }} />
      </div>
      <h1 className="text-xl font-semibold mb-2" style={{ color: NAVY }}>
        Campus Operations
      </h1>
      <p className="text-sm text-muted-foreground">Coming soon</p>
    </div>
  );
}
