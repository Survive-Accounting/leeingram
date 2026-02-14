import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, FileText, Upload, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";

export default function Writing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: ideas, isLoading } = useQuery({
    queryKey: ["story-ideas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_ideas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: uploads } = useQuery({
    queryKey: ["story-uploads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_uploads")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("story_ideas").insert({
        user_id: user!.id,
        title: newTitle,
        description: newDesc,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["story-ideas"] });
      toast.success("Story idea created!");
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("story_ideas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["story-ideas"] });
      toast.success("Deleted");
    },
  });

  const handleUpload = async (storyId: string, file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported");
      return;
    }
    setUploading(true);
    try {
      const path = `${user!.id}/${storyId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("story-files")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("story-files")
        .getPublicUrl(path);

      const { error: dbError } = await supabase.from("story_uploads").insert({
        story_idea_id: storyId,
        user_id: user!.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["story-uploads"] });
      toast.success("PDF uploaded!");
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const getUploads = (storyId: string) =>
    uploads?.filter((u) => u.story_idea_id === storyId) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <Link to="/domains" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-semibold text-foreground">Writing [for Ben]</h1>
          <span className="text-xs text-muted-foreground">No destination</span>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New Story Idea
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !ideas?.length ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-4">No story ideas yet.</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create Your First Story Idea
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {ideas.map((idea) => {
              const ideaUploads = getUploads(idea.id);
              const isExpanded = expandedId === idea.id;

              return (
                <Card key={idea.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        className="flex-1 text-left"
                        onClick={() => setExpandedId(isExpanded ? null : idea.id)}
                      >
                        <h3 className="text-sm font-semibold text-foreground">{idea.title}</h3>
                        {idea.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{idea.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {ideaUploads.length} PDF{ideaUploads.length !== 1 ? "s" : ""}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Created {format(new Date(idea.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive/60 hover:text-destructive"
                        onClick={() => deleteMutation.mutate(idea.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-3 border-t pt-3">
                        {/* Upload button */}
                        <div>
                          <Label
                            htmlFor={`upload-${idea.id}`}
                            className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-primary hover:underline"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {uploading ? "Uploading..." : "Upload PDF"}
                          </Label>
                          <input
                            id={`upload-${idea.id}`}
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            disabled={uploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(idea.id, file);
                              e.target.value = "";
                            }}
                          />
                        </div>

                        {/* Upload list */}
                        {ideaUploads.length > 0 ? (
                          <div className="space-y-1.5">
                            {ideaUploads.map((u) => (
                              <div
                                key={u.id}
                                className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs"
                              >
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <a
                                  href={u.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 text-foreground hover:underline truncate"
                                >
                                  {u.file_name}
                                </a>
                                <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                                  <CalendarDays className="h-3 w-3" />
                                  {format(new Date(u.uploaded_at), "MMM d, yyyy")}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No uploads yet.</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Story Idea</DialogTitle>
            <DialogDescription>What are you writing about?</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. The Midnight Librarian" />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} placeholder="Brief notes about this story..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={!newTitle.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
