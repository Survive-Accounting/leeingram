import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import ChapterPage from "./pages/ChapterPage";
import CreateLesson from "./pages/CreateLesson";
import LessonDetail from "./pages/LessonDetail";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const AppRoutes = () => {
  const { session, loading } = useAuth();

  return (
    <Routes>
      <Route path="/auth" element={!loading && session ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/chapter/:chapterId" element={<ProtectedRoute><ChapterPage /></ProtectedRoute>} />
      <Route path="/create-lesson" element={<ProtectedRoute><CreateLesson /></ProtectedRoute>} />
      <Route path="/lesson/:lessonId" element={<ProtectedRoute><LessonDetail /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
