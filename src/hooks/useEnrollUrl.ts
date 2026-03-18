import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FALLBACK = import.meta.env.VITE_LEARNWORLDS_ENROLL_URL || "https://surviveaccounting.com";

export function useEnrollUrl(): string {
  const { data } = useQuery({
    queryKey: ["app-setting", "learnworlds_enroll_url"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "learnworlds_enroll_url")
        .maybeSingle();
      return data?.value || "";
    },
    staleTime: 5 * 60 * 1000,
  });
  return data || FALLBACK;
}
