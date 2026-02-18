import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";

const COURSES = [
  {
    key: "arts-entrepreneurship",
    label: "Arts Entrepreneurship",
    description: "Building creative careers and understanding the business of art.",
    icon: BookOpen,
  },
  {
    key: "quickbooks",
    label: "Quickbooks",
    description: "Hands-on accounting software for small business management.",
    icon: Calculator,
  },
];

export default function ProfIngram() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Button variant="ghost" size="sm" onClick={() => navigate("/domains")} className="mb-8 text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Domains
        </Button>

        <h1 className="text-3xl font-bold mb-2">Prof Ingram</h1>
        <p className="text-muted-foreground mb-10">University courses — coming soon.</p>

        <div className="grid gap-4">
          {COURSES.map((course) => (
            <div
              key={course.key}
              className="relative p-6 rounded-lg border bg-card"
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-md bg-muted">
                  <course.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{course.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
                  <span className="inline-block mt-3 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
