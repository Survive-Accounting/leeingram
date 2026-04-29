import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Send, Eye, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BetaEmailDetailDrawer } from "./BetaEmailDetailDrawer";

const NAVY = "#14213D";
const RED = "#CE1126";

type Template = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  subject: string;
  preheader: string | null;
  html_body: string;
  text_body: string | null;
  from_name: string;
  from_email: string;
  reply_to: string;
  enabled: boolean;
  is_managed: boolean;
  sort_order: number;
};

type Stats = Record<string, { sent7d: number; tests7d: number; lastSentAt: string | null }>;

export function BetaSystemEmailsSection({ candidateRecipients }: { candidateRecipients?: { email: string; label?: string }[] }) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("beta-emails-list", { body: {} });
      if (error) throw error;
      setTemplates(((data as any)?.templates ?? []) as Template[]);
      setStats(((data as any)?.stats ?? {}) as Stats);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleEnabled(t: Template, next: boolean) {
    // Optimistic
    setTemplates((cur) => cur?.map((x) => x.slug === t.slug ? { ...x, enabled: next } : x) ?? cur);
    const { error } = await supabase
      .from("beta_email_templates" as any)
      .update({ enabled: next })
      .eq("slug", t.slug);
    if (error) {
      toast.error(`Could not update ${t.name}`);
      setTemplates((cur) => cur?.map((x) => x.slug === t.slug ? { ...x, enabled: !next } : x) ?? cur);
    } else {
      toast.success(`${t.name} ${next ? "enabled" : "disabled"}`);
    }
  }

  return (
    <Card className="border-2" style={{ borderColor: NAVY }}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" style={{ color: NAVY }} />
            <h2 className="text-lg font-bold" style={{ color: NAVY }}>System Emails</h2>
            <Badge variant="outline">Beta</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Preview, test, and send transactional/nurture beta emails. Real sends require the template to be enabled and dedupe per recipient.
        </p>

        {loading && !templates && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {error && (
          <div className="rounded border border-red-300 bg-red-50 text-red-800 p-3 text-sm">
            {error}
          </div>
        )}

        {templates && templates.length === 0 && !loading && (
          <div className="text-sm text-muted-foreground text-center py-6">No templates configured.</div>
        )}

        <div className="divide-y rounded border">
          {(templates ?? []).map((t) => {
            const s = stats[t.slug] ?? { sent7d: 0, tests7d: 0, lastSentAt: null };
            return (
              <div key={t.slug} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: NAVY }}>{t.name}</span>
                    {t.is_managed && <Badge variant="secondary" className="text-[10px]">Managed by login flow</Badge>}
                    {t.enabled
                      ? <Badge style={{ background: RED, color: "white" }} className="text-[10px]">Enabled</Badge>
                      : <Badge variant="outline" className="text-[10px]">Disabled</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.subject}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Sent (7d): <b>{s.sent7d}</b> · Tests (7d): {s.tests7d}
                    {s.lastSentAt && <> · Last sent: {new Date(s.lastSentAt).toLocaleString()}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={t.enabled}
                    onCheckedChange={(v) => toggleEnabled(t, v)}
                    disabled={t.is_managed}
                    aria-label="Enable template"
                  />
                  <Button size="sm" variant="outline" onClick={() => setOpenSlug(t.slug)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {openSlug && (
        <BetaEmailDetailDrawer
          slug={openSlug}
          onClose={() => { setOpenSlug(null); load(); }}
          candidateRecipients={candidateRecipients}
        />
      )}
    </Card>
  );
}
