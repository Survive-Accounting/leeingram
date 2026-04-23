import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

/**
 * Plain light-themed wrapper for the combined
 * "Final exams + feature cards + courses + contact" section.
 * No animated geometry — animation is reserved exclusively
 * for the bottom contact section.
 */
export default function StagingFinalExamSection({ children }: Props) {
  return (
    <section className="relative" style={{ background: "#F8FAFC" }}>
      {children}
    </section>
  );
}
