import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import QuickEmailGateModal from "@/components/landing/QuickEmailGateModal";

interface RequestAccessOpts {
  course?: string | null;
}

interface EmailGateCtx {
  requestAccess: (opts?: RequestAccessOpts) => void;
}

const EmailGateContext = createContext<EmailGateCtx | null>(null);

/**
 * Global provider for the lightweight email-capture step that runs before
 * /get-access. Wrap the app once and call `useEmailGate().requestAccess(...)`
 * from any primary CTA.
 */
export function EmailGateProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState<string | null>(null);

  const requestAccess = useCallback((opts?: RequestAccessOpts) => {
    setCourse(opts?.course ?? null);
    setOpen(true);
  }, []);

  return (
    <EmailGateContext.Provider value={{ requestAccess }}>
      {children}
      <QuickEmailGateModal
        open={open}
        onClose={() => setOpen(false)}
        courseSlug={course}
      />
    </EmailGateContext.Provider>
  );
}

export function useEmailGate(): EmailGateCtx {
  const ctx = useContext(EmailGateContext);
  if (!ctx) {
    // Soft fallback so non-wrapped trees still navigate somewhere sensible.
    return {
      requestAccess: ({ course } = {}) => {
        const qs = course ? `?course=${encodeURIComponent(course)}` : "";
        window.location.href = `/get-access${qs}`;
      },
    };
  }
  return ctx;
}
