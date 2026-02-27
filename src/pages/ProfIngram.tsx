import { DomainLayout } from "@/components/DomainLayout";
import { BookOpen, Calculator } from "lucide-react";

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
  return (
    <DomainLayout title="Prof Ingram" tagline="Arts Entrepreneurship & Quickbooks">
      <div className="max-w-xl mx-auto pt-4">
        <div className="grid gap-4">
          {COURSES.map((course) => (
            <div
              key={course.key}
              className="relative p-6 rounded-lg"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-md" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <course.icon className="h-5 w-5 text-white/60" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{course.label}</h3>
                  <p className="text-sm text-white/70 mt-1">{course.description}</p>
                  <span className="inline-block mt-3 text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 text-white/60">
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DomainLayout>
  );
}
