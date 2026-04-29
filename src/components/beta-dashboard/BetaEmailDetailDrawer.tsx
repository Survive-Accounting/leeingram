import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Send, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

const NAVY = "#14213D";
const RED = "#CE1126";

type Rendered = {
  slug: string;
  subject: string;
  preheader: string | null;
  html: string;
  text: string | null;
  from_name: string;
  from_email: string;
  reply_to: string;
  is_managed: boolean;
  enabled: boolean;
};

type SendRow = {
  id: string;
  recipient_email: string;
  subject: string | null;
  status: string;
  is_test: boolean;
  error: string | null;
  resend_id: string | null;
  created_at: string;
};

export function BetaEmailDetailDrawer({
  slug,
  onClose,
  candidateRecipients = [],
}: {
  slug: string;
  onClose: () => void;
  candidateRecipients?: { email: string; label?: string }[];
}) {
  const [tab, setTab] = useState("preview");
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [sample, setSample] = useState("");
  const [loading, setLoading] = useState(true);
  const [tpl, setTpl] = useState<any>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editPreheader, setEditPreheader] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("lee@surviveaccounting.com");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<SendRow[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [bulkSending, setBulkSending] = useState(false);

  async function loadRender() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("beta-emails-render", {
        body: { slug, sample_recipient_email: sample || undefined },
      });
      if (error) throw error;
      setRendered(data as Rendered);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to render");
    } finally {
      setLoading(false);
    }
  }

  async function loadTpl() {
    const { data } = await supabase
      .from("beta_email_templates" as any)
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    setTpl(data);
    if (data) {
      setEditSubject((data as any).subject ?? "");
      setEditPreheader((data as any).preheader ?? "");
      setEditHtml((data as any).html_body ?? "");
      setEditText((data as any).text_body ?? "");
    }
  }

  async function loadHistory() {
    const { data } = await supabase
      .from("beta_email_sends" as any)
      .select("*")
      .eq("template_slug", slug)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data ?? []) as any);
  }

  useEffect(() => { loadRender(); loadTpl(); loadHistory(); /* eslint-disable-next-line */ }, [slug]);

  async function saveEdits() {
    setSaving(true);
    const { error } = await supabase
      .from("beta_email_templates" as any)
      .update({
        subject: editSubject,
        preheader: editPreheader || null,
        html_body: editHtml,
        text_body: editText || null,
      })
      .eq("slug", slug);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    await loadTpl();
    await loadRender();
  }

  async function sendTest() {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("beta-emails-send-test", {
        body: { slug, to: testTo || undefined },
      });
      if (error) throw error;
      toast.success(`Test sent to ${(data as any)?.recipient}`);
      loadHistory();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send test");
    } finally {
      setSending(false);
    }
  }

  function parseBulkRecipients(): string[] {
    return bulkText.split(/[\s,;\n]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes("@"));
  }

  async function runDryRun() {
    const recipients = parseBulkRecipients();
    if (recipients.length === 0) { toast.error("Add at least one email"); return; }
    setBulkSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("beta-emails-send-real", {
        body: { slug, recipient_emails: recipients, dry_run: true },
      });
      if (error) throw error;
      setDryRunResult(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Dry run failed");
    } finally {
      setBulkSending(false);
    }
  }

  async function runRealSend() {
    if (!dryRunResult) { toast.error("Run dry run first"); return; }
    const recipients = parseBulkRecipients();
    const eligible = (dryRunResult as any).eligible_count;
    if (!confirm(`Send "${rendered?.subject}" to ${eligible} recipient(s)?\n\nThis cannot be undone.`)) return;
    setBulkSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("beta-emails-send-real", {
        body: { slug, recipient_emails: recipients, dry_run: false },
      });
      if (error) throw error;
      const r = data as any;
      toast.success(`Sent ${r.sent}, failed ${r.failed}, skipped ${r.skipped_already_sent}`);
      setDryRunResult(null);
      setBulkText("");
      loadHistory();
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setBulkSending(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle style={{ color: NAVY }}>{tpl?.name ?? slug}</SheetTitle>
        </SheetHeader>

        {tpl?.is_managed && (
          <div className="mt-2 text-xs rounded border border-amber-300 bg-amber-50 text-amber-900 p-2">
            This email is sent automatically by the login flow (resend-login-link). Edits and bulk sends are not available here.
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="edit" disabled={tpl?.is_managed}>Edit</TabsTrigger>
            <TabsTrigger value="send">Send</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-3 mt-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Sample recipient (for personalization)</Label>
                <Input value={sample} onChange={(e) => setSample(e.target.value)} placeholder="someone@olemiss.edu" />
              </div>
              <Button variant="outline" size="sm" onClick={loadRender} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                Render
              </Button>
            </div>
            {loading && <Skeleton className="h-72 w-full" />}
            {rendered && !loading && (
              <div className="space-y-3">
                <div className="text-xs space-y-1 rounded bg-muted p-2">
                  <div><b>From:</b> {rendered.from_name} &lt;{rendered.from_email}&gt;</div>
                  <div><b>Reply-to:</b> {rendered.reply_to}</div>
                  <div><b>Subject:</b> {rendered.subject}</div>
                  {rendered.preheader && <div><b>Preheader:</b> {rendered.preheader}</div>}
                </div>
                <iframe
                  title="Email preview"
                  sandbox=""
                  srcDoc={rendered.html}
                  className="w-full h-[420px] border rounded bg-white"
                />
                {rendered.text && (
                  <details>
                    <summary className="text-xs cursor-pointer text-muted-foreground">Plain text version</summary>
                    <pre className="text-xs whitespace-pre-wrap p-2 bg-muted rounded mt-1">{rendered.text}</pre>
                  </details>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="edit" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Preheader</Label>
              <Input value={editPreheader} onChange={(e) => setEditPreheader(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">HTML body</Label>
              <Textarea value={editHtml} onChange={(e) => setEditHtml(e.target.value)} className="min-h-[260px] font-mono text-xs" />
            </div>
            <div>
              <Label className="text-xs">Plain text fallback</Label>
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-[100px] font-mono text-xs" />
            </div>
            <div className="text-[11px] text-muted-foreground">
              Available variables: <code>{"{{first_name}}"}</code>, <code>{"{{recipient_email}}"}</code>, <code>{"{{magic_link_url}}"}</code>, <code>{"{{beta_number}}"}</code>, <code>{"{{course_name}}"}</code>, <code>{"{{campus_name}}"}</code>, <code>{"{{dashboard_url}}"}</code>
            </div>
            <Button onClick={saveEdits} disabled={saving} style={{ background: NAVY, color: "white" }}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save changes
            </Button>
          </TabsContent>

          <TabsContent value="send" className="space-y-5 mt-3">
            <div className="rounded border p-3 space-y-2">
              <div className="font-semibold text-sm">Send test</div>
              <div className="flex gap-2">
                <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                <Button onClick={sendTest} disabled={sending} style={{ background: NAVY, color: "white" }}>
                  {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  Send test
                </Button>
              </div>
              <div className="text-[11px] text-muted-foreground">Subject is prefixed with [TEST]. Logged separately from real sends.</div>
            </div>

            {!tpl?.is_managed && (
              <div className="rounded border p-3 space-y-2">
                <div className="font-semibold text-sm">Send real (one per recipient)</div>
                {!rendered?.enabled && (
                  <div className="text-xs rounded border border-amber-300 bg-amber-50 text-amber-900 p-2">
                    Template is disabled. Enable it from the list before sending.
                  </div>
                )}
                {candidateRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => setBulkText(candidateRecipients.map((r) => r.email).join("\n"))}>
                      Use {candidateRecipients.length} loaded recipients
                    </Button>
                  </div>
                )}
                <Textarea
                  value={bulkText}
                  onChange={(e) => { setBulkText(e.target.value); setDryRunResult(null); }}
                  placeholder="One email per line, or comma-separated"
                  className="min-h-[100px] font-mono text-xs"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={runDryRun} disabled={bulkSending}>
                    {bulkSending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    Dry run
                  </Button>
                  <Button onClick={runRealSend} disabled={bulkSending || !dryRunResult || !rendered?.enabled} style={{ background: RED, color: "white" }}>
                    <Send className="h-4 w-4 mr-1" />
                    Send for real
                  </Button>
                </div>
                {dryRunResult && (
                  <div className="text-xs rounded bg-muted p-2 space-y-1">
                    <div><b>Eligible:</b> {(dryRunResult as any).eligible_count}</div>
                    <div><b>Skipped (already sent):</b> {(dryRunResult as any).skipped_already_sent}</div>
                    {(dryRunResult as any).eligible_sample?.length > 0 && (
                      <div className="text-[11px] text-muted-foreground">Sample: {(dryRunResult as any).eligible_sample.join(", ")}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">No sends yet.</div>
            ) : (
              <div className="divide-y border rounded">
                {history.map((h) => (
                  <div key={h.id} className="p-2 text-xs flex items-center gap-2">
                    <Badge variant={h.status === "sent" ? "default" : h.status === "failed" ? "destructive" : "outline"} className="text-[10px]">
                      {h.status}
                    </Badge>
                    {h.is_test && <Badge variant="outline" className="text-[10px]">test</Badge>}
                    <span className="font-mono">{h.recipient_email}</span>
                    <span className="text-muted-foreground ml-auto">{new Date(h.created_at).toLocaleString()}</span>
                    {h.error && <span className="text-red-600 ml-2 truncate max-w-[180px]" title={h.error}>{h.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
