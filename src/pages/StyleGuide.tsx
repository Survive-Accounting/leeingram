import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function StyleGuide() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [guide, setGuide] = useState("");

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

      <Card className="max-w-2xl">
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
    </AppLayout>
  );
}
