import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, FileText, ArrowLeft, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { FILE_TYPES } from "@/lib/constants";
import type { LessonStatus } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

type FileType = Database["public"]["Enums"]["file_type"];

export default function ChapterPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileType, setSelectedFileType] = useState<FileType>("textbook");

  const { data: chapter } = useQuery({
    queryKey: ["chapter", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*, courses(*)")
        .eq("id", chapterId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  const { data: resources } = useQuery({
    queryKey: ["chapter-resources", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_resources")
        .select("*")
        .eq("chapter_id", chapterId!)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  const { data: lessons } = useQuery({
    queryKey: ["chapter-lessons", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("chapter_id", chapterId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const filePath = `${chapterId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("chapter-resources")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("chapter-resources")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("chapter_resources").insert({
        chapter_id: chapterId!,
        course_id: chapter!.course_id,
        file_name: file.name,
        file_type: selectedFileType,
        file_url: urlData.publicUrl,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapter-resources", chapterId] });
      toast.success("File uploaded successfully");
    },
    onError: (e) => toast.error("Upload failed: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const { error } = await supabase.from("chapter_resources").delete().eq("id", resourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapter-resources", chapterId] });
      toast.success("Resource deleted");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  };

  if (!chapter) {
    return (
      <AppLayout>
        <div className="text-foreground/80">Loading...</div>
      </AppLayout>
    );
  }

  const course = chapter.courses as { course_name: string; id: string };

  return (
    <AppLayout>
      <div className="mb-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>
      </div>

      <div className="mb-6">
        <p className="text-sm text-muted-foreground">{course.course_name}</p>
        <h1 className="text-2xl font-bold text-foreground">
          Ch {chapter.chapter_number} — {chapter.chapter_name}
        </h1>
      </div>

      {/* Resources */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Chapter Resources</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedFileType} onValueChange={(v) => setSelectedFileType(v as FileType)}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="mr-1 h-3.5 w-3.5" />
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {!resources?.length ? (
            <p className="text-sm text-muted-foreground">No resources uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {resources.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <a href={r.file_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                      {r.file_name}
                    </a>
                    <Badge variant="outline" className="text-xs">{r.file_type}</Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => deleteMutation.mutate(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lessons */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Lessons</CardTitle>
          <Button size="sm" asChild>
            <Link to={`/create-lesson?courseId=${course.id}&chapterId=${chapterId}`}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Create Lesson
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {!lessons?.length ? (
            <p className="text-sm text-muted-foreground">No lessons yet. Create your first lesson!</p>
          ) : (
            <div className="space-y-2">
              {lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  to={`/lesson/${lesson.id}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 transition-colors hover:bg-accent"
                >
                  <span className="text-sm text-foreground">{lesson.lesson_title}</span>
                  <StatusBadge status={lesson.lesson_status as LessonStatus} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
