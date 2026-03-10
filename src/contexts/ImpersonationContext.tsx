import { createContext, useContext, useState, type ReactNode } from "react";
import type { VaAccount } from "@/hooks/useVaAccount";

interface ImpersonationContextType {
  impersonating: VaAccount | null;
  startImpersonating: (va: VaAccount) => void;
  stopImpersonating: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonating: null,
  startImpersonating: () => {},
  stopImpersonating: () => {},
});

export const useImpersonation = () => useContext(ImpersonationContext);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonating, setImpersonating] = useState<VaAccount | null>(null);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonating,
        startImpersonating: setImpersonating,
        stopImpersonating: () => setImpersonating(null),
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}
