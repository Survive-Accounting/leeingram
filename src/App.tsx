import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SprintProvider } from "@/contexts/SprintContext";
import Landing from "./pages/Landing";
import SurviveHome from "./pages/SurviveHome";
import ContentFactory from "./pages/ContentFactory";
import ContentRoadmap from "./pages/ContentRoadmap";
import ChapterPage from "./pages/ChapterPage";
import IdeasRoadmap from "./pages/IdeasRoadmap";
import FocusTimer from "./pages/FocusTimer";
import CreateLesson from "./pages/CreateLesson";
import LessonDetail from "./pages/LessonDetail";
import StyleGuide from "./pages/StyleGuide";
import EmailFactory from "./pages/EmailFactory";
import Marketing from "./pages/Marketing";
import DomainSelect from "./pages/DomainSelect";
import Writing from "./pages/Writing";
import Leeingram from "./pages/Leeingram";
import ProfIngram from "./pages/ProfIngram";
import Travel from "./pages/Travel";
import TripPlanning from "./pages/TripPlanning";
import TripExploring from "./pages/TripExploring";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { SprintTimerBar } from "@/components/SprintTimerBar";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!session) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

const AppRoutes = () => {
  const { session, loading } = useAuth();

  return (
    <Routes>
      {/* Survive Accounting — home page */}
      <Route path="/" element={<ProtectedRoute><SurviveHome /></ProtectedRoute>} />
      <Route path="/survive" element={<Navigate to="/" replace />} />
      {/* Public landing */}
      <Route path="/landing" element={<Landing />} />
      {/* Admin auth */}
      <Route path="/admin" element={!loading && session ? <Navigate to="/domains" replace /> : <Auth />} />
      {/* Legacy redirect */}
      <Route path="/auth" element={<Navigate to="/admin" replace />} />
      <Route path="/domains" element={<ProtectedRoute><DomainSelect /></ProtectedRoute>} />
      <Route path="/content" element={<ProtectedRoute><ContentFactory /></ProtectedRoute>} />
      <Route path="/content-roadmap" element={<ProtectedRoute><ContentRoadmap /></ProtectedRoute>} />
      <Route path="/chapter/:chapterId" element={<ProtectedRoute><ChapterPage /></ProtectedRoute>} />
      <Route path="/create-lesson" element={<ProtectedRoute><CreateLesson /></ProtectedRoute>} />
      <Route path="/lesson/:lessonId" element={<ProtectedRoute><LessonDetail /></ProtectedRoute>} />
      <Route path="/style-guide" element={<ProtectedRoute><StyleGuide /></ProtectedRoute>} />
      <Route path="/ideas" element={<ProtectedRoute><IdeasRoadmap /></ProtectedRoute>} />
      <Route path="/roadmap" element={<Navigate to="/ideas" replace />} />
      <Route path="/focus" element={<ProtectedRoute><FocusTimer /></ProtectedRoute>} />
      <Route path="/marketing" element={<ProtectedRoute><Marketing /></ProtectedRoute>} />
      <Route path="/marketing/emails" element={<ProtectedRoute><EmailFactory /></ProtectedRoute>} />
      {/* Writing domain */}
      <Route path="/writing" element={<ProtectedRoute><Writing /></ProtectedRoute>} />
      {/* Leeingram domain */}
      <Route path="/leeingram" element={<ProtectedRoute><Leeingram /></ProtectedRoute>} />
      {/* Prof Ingram domain */}
      <Route path="/prof-ingram" element={<ProtectedRoute><ProfIngram /></ProtectedRoute>} />
      {/* Travel domain */}
      <Route path="/travel" element={<ProtectedRoute><Travel /></ProtectedRoute>} />
      <Route path="/travel/:tripId/planning" element={<ProtectedRoute><TripPlanning /></ProtectedRoute>} />
      <Route path="/travel/:tripId/exploring" element={<ProtectedRoute><TripExploring /></ProtectedRoute>} />
      <Route path="/email-factory" element={<Navigate to="/marketing/emails" replace />} />
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
          <SprintProvider>
            <SprintTimerBar />
            <AppRoutes />
          </SprintProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
