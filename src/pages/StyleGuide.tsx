import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Save, Loader2, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function StyleGuide() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [guide, setGuide] = useState("");
  const [useCompanyNames, setUseCompanyNames] = useState(true);
  const [companyNamesOpen, setCompanyNamesOpen] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["style-guide"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!session,
  });

  const { data: companyNames } = useQuery({
    queryKey: ["company-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_names")
        .select("*")
        .order("style")
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    if (existing?.style_guide) setGuide(existing.style_guide);
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (existing) {
        const { error } = await supabase
          .from("user_preferences")
          .update({ style_guide: guide, updated_at: new Date().toISOString() })
          .eq("user_id", session!.user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_preferences")
          .insert({ user_id: session!.user.id, style_guide: guide });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["style-guide"] });
      toast.success("Style guide saved!");
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  return (
    <AppLayout>
      <div className="mb-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-foreground">Teaching Style Guide</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Describe your teaching style, tone, and preferences. This will be included in every AI lesson plan generation so the output matches your voice.
      </p>

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Style Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={guide}
              onChange={(e) => setGuide(e.target.value)}
              rows={12}
              placeholder={`Example:\n- I use a conversational, approachable tone\n- I always reference the "Golden Rubric" (A = L + E) framework\n- I use analogies like "bonds are like splitting a big loan into pieces"\n- I emphasize WHY before HOW\n- I keep exam tips punchy and memorable\n- I like to use humor and real-world comparisons`}
              className="text-sm"
              disabled={isLoading}
            />
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
              {saveMutation.isPending ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Saving...</>
              ) : (
                <><Save className="mr-1 h-3.5 w-3.5" /> Save Style Guide</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Company Names Library */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Fictional Company Names
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              During variant generation, the AI will randomly select company names from this library to create realistic, varied practice problems.
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch id="use-company" checked={useCompanyNames} onCheckedChange={setUseCompanyNames} />
                <Label htmlFor="use-company" className="text-sm cursor-pointer">Use company names in generation</Label>
              </div>
              <Badge variant="outline" className="text-[10px]">{useCompanyNames ? "ON" : "OFF"}</Badge>
            </div>

            <Button variant="outline" size="sm" onClick={() => setCompanyNamesOpen(true)}>
              <Building2 className="h-3.5 w-3.5 mr-1" /> Manage Company Names
            </Button>

            <p className="text-[10px] text-muted-foreground/60 italic">
              Future: company name style preference (realistic vs. playful) will be passed to AI during generation.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Company Names Dialog */}
      <Dialog open={companyNamesOpen} onOpenChange={setCompanyNamesOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Company Names Library</DialogTitle>
            <DialogDescription>These names will be randomly used in generated practice problems.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs w-24">Style</TableHead>
                  <TableHead className="text-xs w-16">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!companyNames?.length ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-4">No company names found</TableCell></TableRow>
                ) : (
                  companyNames.map((cn: any) => (
                    <TableRow key={cn.id}>
                      <TableCell className="text-xs font-medium">{cn.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">{cn.style}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{cn.active ? "✓" : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-[10px] text-muted-foreground/60 italic">
            Full CRUD management coming soon. For now, names can be managed via the backend.
          </p>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
