import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Trash2, Copy, RefreshCw, Globe, GlobeLock, Sparkles } from "lucide-react";
import { toast } from "sonner";

const TYPE_COLORS: Record<string, string> = {
  concept: "bg-blue-600 text-white",
  journal_entry: "bg-green-600 text-white",
  account_classification: "bg-amber-500 text-white",
  formula: "bg-purple-600 text-white",
  analysis: "bg-cyan-500 text-black",
};

const TYPE_LABELS: Record<string, string> = {
  concept: "Concept",
  journal_entry: "Journal Entry",
  account_classification: "Classification",
  formula: "Formula",
  analysis: "Analysis",
};

export default function StudyToolsFlashcards() {
  const { workspace } = useActiveWorkspace();
  const qc = useQueryClient();
  const [confirmRegen, setConfirmRegen] = useState(false);

  const chapterId = workspace?.chapterId;

  // Fetch deck for active chapter
  const { data: deck, isLoading: deckLoading } = useQuery({
    queryKey: ["flashcard-deck", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcard_decks")
        .select("*")
        .eq("chapter_id", chapterId!)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!chapterId,
  });

  // Fetch cards for deck
  const { data: cards } = useQuery({
    queryKey: ["flashcard-cards", deck?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, card_type, front, back, sort_order, source_asset_id, deleted")
        .eq("deck_id", deck!.id)
        .eq("deleted", false)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!deck?.id,
  });

  // Generate deck mutation
  const generateMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-flashcard-deck", {
        body: { chapter_id: chapterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Deck generated — ${data.cards_generated} cards created`);
      qc.invalidateQueries({ queryKey: ["flashcard-deck", chapterId] });
    },
    onError: (e: Error) => toast.error("Generation failed: " + e.message),
  });

  // Regenerate: delete old deck then generate
  const regenerateMut = useMutation({
    mutationFn: async () => {
      if (deck?.id) {
        await supabase.from("flashcard_decks").delete().eq("id", deck.id);
      }
      const { data, error } = await supabase.functions.invoke("generate-flashcard-deck", {
        body: { chapter_id: chapterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Deck regenerated — ${data.cards_generated} cards`);
      setConfirmRegen(false);
      qc.invalidateQueries({ queryKey: ["flashcard-deck", chapterId] });
    },
    onError: (e: Error) => toast.error("Regeneration failed: " + e.message),
  });

  // Publish / unpublish
  const togglePublishMut = useMutation({
    mutationFn: async () => {
      const newStatus = deck?.status === "published" ? "draft" : "published";
      const { error } = await supabase
        .from("flashcard_decks")
        .update({ status: newStatus })
        .eq("id", deck!.id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (status) => {
      toast.success(status === "published" ? "Deck published" : "Deck unpublished");
      qc.invalidateQueries({ queryKey: ["flashcard-deck", chapterId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete card
  const deleteCardMut = useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase
        .from("flashcards")
        .update({ deleted: true })
        .eq("id", cardId);
      if (error) throw error;
      // Update deck total
      if (deck) {
        await supabase
          .from("flashcard_decks")
          .update({ total_cards: (deck.total_cards ?? 0) - 1 })
          .eq("id", deck.id);
      }
    },
    onSuccess: () => {
      toast.success("Card removed");
      qc.invalidateQueries({ queryKey: ["flashcard-cards", deck?.id] });
      qc.invalidateQueries({ queryKey: ["flashcard-deck", chapterId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyEmbed = () => {
    const url = `${window.location.origin}/tools/flashcards?chapter_id=${chapterId}`;
    const html = `<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(html);
    toast.success("Embed HTML copied to clipboard");
  };

  const isGenerating = generateMut.isPending || regenerateMut.isPending;

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground">Flashcard Decks</h1>

        {!chapterId ? (
          <p className="text-muted-foreground text-sm">Select a course and chapter to manage flashcard decks.</p>
        ) : deckLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : !deck ? (
          /* No deck state */
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground text-sm">No deck generated yet for this chapter.</p>
            <Button onClick={() => generateMut.mutate()} disabled={isGenerating}>
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating cards...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate Deck</>
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* Deck summary */}
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={deck.status === "published" ? "default" : "secondary"} className="text-xs">
                {deck.status === "published" ? "Published" : "Draft"}
              </Badge>
              <span className="text-sm text-muted-foreground">{deck.total_cards} cards</span>
              <span className="text-xs text-muted-foreground/60">▶ {deck.plays ?? 0} plays</span>
              <span className="text-xs text-muted-foreground/60">✓ {deck.completions ?? 0} completions</span>

              <div className="flex gap-2 ml-auto flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => togglePublishMut.mutate()}
                  disabled={togglePublishMut.isPending}
                >
                  {deck.status === "published" ? (
                    <><GlobeLock className="h-3.5 w-3.5 mr-1.5" /> Unpublish</>
                  ) : (
                    <><Globe className="h-3.5 w-3.5 mr-1.5" /> Publish</>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={copyEmbed}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Get Embed URL
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmRegen(true)}
                  disabled={isGenerating}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate
                </Button>
              </div>
            </div>

            {/* Card list */}
            {cards && cards.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Type</TableHead>
                      <TableHead>Front</TableHead>
                      <TableHead>Back</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.map((card) => (
                      <TableRow key={card.id}>
                        <TableCell>
                          <Badge className={`${TYPE_COLORS[card.card_type] || "bg-muted"} text-[10px] px-1.5`}>
                            {TYPE_LABELS[card.card_type] || card.card_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{card.front?.slice(0, 60)}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{card.back?.slice(0, 60)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteCardMut.mutate(card.id)}
                            disabled={deleteCardMut.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-6">No active cards in this deck.</p>
            )}
          </>
        )}
      </div>

      {/* Regenerate confirmation */}
      <Dialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Regenerate Deck?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will delete the current deck and all its cards, then generate a fresh deck from chapter assets.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmRegen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => regenerateMut.mutate()}
              disabled={regenerateMut.isPending}
            >
              {regenerateMut.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Regenerating...</>
              ) : (
                "Confirm Regenerate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}
