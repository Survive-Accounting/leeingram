import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ImpersonationBanner } from "@/components/va-dashboards/ImpersonationBanner";
import { SprintProvider } from "@/contexts/SprintContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SprintTimerBar } from "@/components/SprintTimerBar";
import { RoleRouteGuard } from "@/components/RoleRouteGuard";

// ── Lazy-loaded pages ────────────────────────────────────────────────
const Landing = lazy(() => import("./pages/Landing"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const SurviveHome = lazy(() => import("./pages/SurviveHome"));
const ContentFactory = lazy(() => import("./pages/ContentFactory"));
const ContentRoadmap = lazy(() => import("./pages/ContentRoadmap"));
const ChapterPage = lazy(() => import("./pages/ChapterPage"));
const ChapterWorkspace = lazy(() => import("./pages/ChapterWorkspace"));
const IdeasRoadmap = lazy(() => import("./pages/IdeasRoadmap"));
const ReviewVariants = lazy(() => import("./pages/ReviewVariants"));
const ProblemBank = lazy(() => import("./pages/ProblemBank"));
const AssetsLibrary = lazy(() => import("./pages/AssetsLibrary"));
const ExportSets = lazy(() => import("./pages/ExportSets"));
const ExportSetDetail = lazy(() => import("./pages/ExportSetDetail"));
const FilmingControlPanel = lazy(() => import("./pages/FilmingControlPanel"));
const QuizzesReady = lazy(() => import("./pages/QuizzesReady"));
const VideoPending = lazy(() => import("./pages/VideoPending"));
const VideosReady = lazy(() => import("./pages/VideosReady"));
const QuizQueue = lazy(() => import("./pages/QuizQueue"));
const VideoQueue = lazy(() => import("./pages/VideoQueue"));
const TutoringControlPanel = lazy(() => import("./pages/TutoringControlPanel"));
const TutoringReview = lazy(() => import("./pages/TutoringReview"));
const TutoringReviewDetail = lazy(() => import("./pages/TutoringReviewDetail"));
const TutoringSourceDetail = lazy(() => import("./pages/TutoringSourceDetail"));
const FocusTimer = lazy(() => import("./pages/FocusTimer"));
const CreateLesson = lazy(() => import("./pages/CreateLesson"));
const LessonDetail = lazy(() => import("./pages/LessonDetail"));
const StyleGuide = lazy(() => import("./pages/StyleGuide"));
const EmailFactory = lazy(() => import("./pages/EmailFactory"));
const Marketing = lazy(() => import("./pages/Marketing"));
const DomainSelect = lazy(() => import("./pages/DomainSelect"));
const Writing = lazy(() => import("./pages/Writing"));
const Leeingram = lazy(() => import("./pages/Leeingram"));
const ProfIngram = lazy(() => import("./pages/ProfIngram"));
const Travel = lazy(() => import("./pages/Travel"));
const TripPlanning = lazy(() => import("./pages/TripPlanning"));
const TripExploring = lazy(() => import("./pages/TripExploring"));
const Auth = lazy(() => import("./pages/Auth"));
const ChartOfAccounts = lazy(() => import("./pages/ChartOfAccounts"));
const SolutionsPdfUpload = lazy(() => import("./pages/SolutionsPdfUpload"));
const ScreenshotCapture = lazy(() => import("./pages/ScreenshotCapture"));
const BatchRunDetail = lazy(() => import("./pages/BatchRunDetail"));
const BankedQuestionReview = lazy(() => import("./pages/BankedQuestionReview"));
const PipelineOverview = lazy(() => import("./pages/PipelineOverview"));
const DeploymentChecklist = lazy(() => import("./pages/DeploymentChecklist"));
const Phase2Review = lazy(() => import("./pages/Phase2Review"));
const VaAdmin = lazy(() => import("./pages/VaAdmin"));
const VaDashboard = lazy(() => import("./pages/VaDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const StudentInboxPage = lazy(() => import("./pages/StudentInboxPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ChapterComplete = lazy(() => import("./pages/ChapterComplete"));
const TemplateManager = lazy(() => import("./pages/TemplateManager"));
const DebugSession = lazy(() => import("./pages/DebugSession"));
const BulkFixTool = lazy(() => import("./pages/BulkFixTool"));
const FlashcardTool = lazy(() => import("./pages/FlashcardTool"));
const StudyToolsFlashcards = lazy(() => import("./pages/StudyToolsFlashcards"));
const SolutionsViewer = lazy(() => import("./pages/SolutionsViewer"));
const PracticeViewer = lazy(() => import("./pages/PracticeViewer"));
const ACCY304Landing = lazy(() => import("./pages/ACCY304Landing"));
const ACCY304Admin = lazy(() => import("./pages/ACCY304Admin"));
const PaymentLinksAdmin = lazy(() => import("./pages/PaymentLinksAdmin"));
const FormulaRecallTool = lazy(() => import("./pages/FormulaRecallTool"));
const StudyToolsFormulaRecall = lazy(() => import("./pages/StudyToolsFormulaRecall"));
const EntryBuilderTool = lazy(() => import("./pages/EntryBuilderTool"));
const StudyToolsEntryBuilder = lazy(() => import("./pages/StudyToolsEntryBuilder"));
const ProblemDissectorTool = lazy(() => import("./pages/ProblemDissectorTool"));
const StudyToolsProblemDissector = lazy(() => import("./pages/StudyToolsProblemDissector"));
const SolutionsQAReview = lazy(() => import("./pages/SolutionsQAReview"));
const SolutionsQAAdmin = lazy(() => import("./pages/SolutionsQAAdmin"));
const QACosts = lazy(() => import("./pages/QACosts"));
const JEDebug = lazy(() => import("./pages/JEDebug"));
const AssetStatsDashboard = lazy(() => import("./pages/AssetStatsDashboard"));
const SolutionsViewerStaging = lazy(() => import("./pages/SolutionsViewerStaging"));
const ChapterCramTool = lazy(() => import("./pages/ChapterCramTool"));
const SurviveChapterAdmin = lazy(() => import("./pages/SurviveChapterAdmin"));
const ChapterJEManager = lazy(() => import("./pages/ChapterJEManager"));
const ChapterFormulasManager = lazy(() => import("./pages/ChapterFormulasManager"));
const LaunchAnalytics = lazy(() => import("./pages/LaunchAnalytics"));
const ContentAnalytics = lazy(() => import("./pages/ContentAnalytics"));
const AdminLandingPages = lazy(() => import("./pages/AdminLandingPages"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const AdminGreek = lazy(() => import("./pages/AdminGreek"));
const LegacyLinks = lazy(() => import("./pages/LegacyLinks"));
const ChapterContentQA = lazy(() => import("./pages/ChapterContentQA"));
const QuizExplanation = lazy(() => import("./pages/QuizExplanation"));
const QuizQuestion = lazy(() => import("./pages/QuizQuestion"));
const QuizChoice = lazy(() => import("./pages/QuizChoice"));
const QuizStart = lazy(() => import("./pages/QuizStart"));
const QuizEnd = lazy(() => import("./pages/QuizEnd"));
const QuizRating = lazy(() => import("./pages/QuizRating"));
const LegacyNotionPage = lazy(() => import("./pages/LegacyNotionPage"));
const Preview = lazy(() => import("./pages/Preview"));
const CheckoutComplete = lazy(() => import("./pages/CheckoutComplete"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const CourseLanding = lazy(() => import("./pages/CourseLanding"));
const CampusOperations = lazy(() => import("./pages/CampusOperations"));
const CampusesPage = lazy(() => import("./pages/campus-ops/CampusesPage"));
const CampusNew = lazy(() => import("./pages/campus-ops/CampusNew"));
const PricingPage = lazy(() => import("./pages/campus-ops/PricingPage"));
const StudentsPage = lazy(() => import("./pages/campus-ops/StudentsPage"));
const PurchasesPage = lazy(() => import("./pages/campus-ops/PurchasesPage"));
const ProfessorsPage = lazy(() => import("./pages/campus-ops/ProfessorsPage"));
const CampusAnalyticsPage = lazy(() => import("./pages/campus-ops/AnalyticsPage"));

// ── Suspense fallback ────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center text-foreground/60 text-sm">
    Loading...
  </div>
);

function RoutedAppBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <ErrorBoundary
      resetKey={`${location.pathname}${location.search}`}
      fullScreen
      title="This view hit a runtime error"
      description="The app stayed online. Try reloading this component before navigating away."
    >
      {children}
    </ErrorBoundary>
  );
}

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-foreground/80">Loading...</div>;
  if (!session) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}


const AppRoutes = () => {
  const { session, loading } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Survive Accounting — default to Asset Factory */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/survive" element={<Navigate to="/content" replace />} />
        <Route path="/survive" element={<Navigate to="/" replace />} />
        {/* Public tools */}
        <Route path="/solutions/:assetCode" element={<SolutionsViewer />} />
        <Route path="/solutions-staging/:assetCode" element={<ProtectedRoute><SolutionsViewerStaging /></ProtectedRoute>} />
        <Route path="/practice/:assetCode" element={<PracticeViewer />} />
        <Route path="/cram/:chapterId" element={<ChapterCramTool />} />
        <Route path="/cram" element={<ChapterCramTool />} />
        <Route path="/quiz-explanation/:questionId" element={<QuizExplanation />} />
        <Route path="/quiz-question/:questionId" element={<QuizQuestion />} />
        <Route path="/quiz-choice/:questionId/:choiceNumber" element={<QuizChoice />} />
        <Route path="/quiz-start/:topicId" element={<QuizStart />} />
        <Route path="/quiz-end/:topicId" element={<QuizEnd />} />
        <Route path="/quiz-rating/:topicId" element={<QuizRating />} />
        <Route path="/legacy/:pageId" element={<LegacyNotionPage />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/checkout/complete" element={<CheckoutComplete />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/my-dashboard" element={<StudentDashboard />} />
        <Route path="/tools/flashcards" element={<FlashcardTool />} />
        <Route path="/tools/formula-recall" element={<FormulaRecallTool />} />
        <Route path="/tools/entry-builder" element={<EntryBuilderTool />} />
        <Route path="/tools/problem-dissector" element={<ProblemDissectorTool />} />
        {/* Public landing */}
        <Route path="/landing" element={<Landing />} />
        <Route path="/accy304" element={<ACCY304Landing />} />
        {/* Admin auth */}
        <Route path="/admin" element={!loading && session ? <Navigate to="/domains" replace /> : <Auth />} />
        {/* Post-login VA auto-redirect handled in DomainSelect */}
        {/* Legacy redirect */}
        <Route path="/auth" element={<Navigate to="/admin" replace />} />
        <Route path="/domains" element={<ProtectedRoute><DomainSelect /></ProtectedRoute>} />
        <Route path="/content" element={<ProtectedRoute><ContentFactory /></ProtectedRoute>} />
        <Route path="/content-roadmap" element={<ProtectedRoute><ContentRoadmap /></ProtectedRoute>} />
        <Route path="/chapter/:chapterId" element={<ProtectedRoute><ChapterPage /></ProtectedRoute>} />
        <Route path="/workspace/:chapterId" element={<ProtectedRoute><ChapterWorkspace /></ProtectedRoute>} />
        <Route path="/create-lesson" element={<ProtectedRoute><CreateLesson /></ProtectedRoute>} />
        <Route path="/lesson/:lessonId" element={<ProtectedRoute><LessonDetail /></ProtectedRoute>} />
        <Route path="/style-guide" element={<ProtectedRoute><StyleGuide /></ProtectedRoute>} />
        <Route path="/ideas" element={<ProtectedRoute><IdeasRoadmap /></ProtectedRoute>} />
        <Route path="/problem-bank" element={<ProtectedRoute><ProblemBank /></ProtectedRoute>} />
        <Route path="/assets-library" element={<ProtectedRoute><AssetsLibrary /></ProtectedRoute>} />
        <Route path="/assets" element={<Navigate to="/assets-library" replace />} />
        <Route path="/export-sets" element={<ProtectedRoute><ExportSets /></ProtectedRoute>} />
        <Route path="/export-sets/:setId" element={<ProtectedRoute><ExportSetDetail /></ProtectedRoute>} />
        <Route path="/review" element={<ProtectedRoute><ReviewVariants /></ProtectedRoute>} />
        <Route path="/filming" element={<Navigate to="/video-pending" replace />} />
        <Route path="/quizzes-ready" element={<ProtectedRoute><QuizzesReady /></ProtectedRoute>} />
        <Route path="/video-pending" element={<ProtectedRoute><VideoPending /></ProtectedRoute>} />
        <Route path="/videos-ready" element={<ProtectedRoute><VideosReady /></ProtectedRoute>} />
        <Route path="/tutoring" element={<ProtectedRoute><TutoringControlPanel /></ProtectedRoute>} />
        <Route path="/tutoring/review" element={<ProtectedRoute><TutoringReview /></ProtectedRoute>} />
        <Route path="/tutoring/review/source/:problemId" element={<ProtectedRoute><TutoringSourceDetail /></ProtectedRoute>} />
        <Route path="/tutoring/review/:problemId" element={<ProtectedRoute><TutoringReviewDetail /></ProtectedRoute>} />
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
        <Route path="/chart-of-accounts" element={<ProtectedRoute><ChartOfAccounts /></ProtectedRoute>} />
        <Route path="/solutions-upload/:chapterId" element={<ProtectedRoute><SolutionsPdfUpload /></ProtectedRoute>} />
        <Route path="/screenshot-capture/:chapterId" element={<ProtectedRoute><ScreenshotCapture /></ProtectedRoute>} />
        <Route path="/batch-run/:batchRunId" element={<ProtectedRoute><BatchRunDetail /></ProtectedRoute>} />
        <Route path="/question-review" element={<ProtectedRoute><BankedQuestionReview /></ProtectedRoute>} />
        <Route path="/pipeline" element={<ProtectedRoute><PipelineOverview /></ProtectedRoute>} />
        <Route path="/deployment" element={<ProtectedRoute><DeploymentChecklist /></ProtectedRoute>} />
        <Route path="/phase2-review" element={<ProtectedRoute><Phase2Review /></ProtectedRoute>} />
        <Route path="/quiz-queue" element={<ProtectedRoute><QuizQueue /></ProtectedRoute>} />
        <Route path="/video-queue" element={<ProtectedRoute><VideoQueue /></ProtectedRoute>} />
        <Route path="/template-manager" element={<ProtectedRoute><TemplateManager /></ProtectedRoute>} />
        <Route path="/debug-session/:chapterId" element={<ProtectedRoute><DebugSession /></ProtectedRoute>} />
        <Route path="/bulk-fix-tool" element={<ProtectedRoute><BulkFixTool /></ProtectedRoute>} />
        <Route path="/va-admin" element={<ProtectedRoute><VaAdmin /></ProtectedRoute>} />
        <Route path="/accy304-admin" element={<ProtectedRoute><ACCY304Admin /></ProtectedRoute>} />
        <Route path="/payment-links-admin" element={<ProtectedRoute><PaymentLinksAdmin /></ProtectedRoute>} />
        <Route path="/va-dashboard" element={<ProtectedRoute><VaDashboard /></ProtectedRoute>} />
        <Route path="/chapter-complete" element={<ProtectedRoute><ChapterComplete /></ProtectedRoute>} />
        <Route path="/survive-chapter" element={<ProtectedRoute><SurviveChapterAdmin /></ProtectedRoute>} />
        <Route path="/chapter-je" element={<ProtectedRoute><ChapterJEManager /></ProtectedRoute>} />
        <Route path="/chapter-formulas" element={<ProtectedRoute><ChapterFormulasManager /></ProtectedRoute>} />
        <Route path="/study-tools/flashcards" element={<ProtectedRoute><StudyToolsFlashcards /></ProtectedRoute>} />
        <Route path="/study-tools/formula-recall" element={<ProtectedRoute><StudyToolsFormulaRecall /></ProtectedRoute>} />
        <Route path="/study-tools/entry-builder" element={<ProtectedRoute><StudyToolsEntryBuilder /></ProtectedRoute>} />
        <Route path="/study-tools/problem-dissector" element={<ProtectedRoute><StudyToolsProblemDissector /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/campus-ops" element={<ProtectedRoute><CampusOperations /></ProtectedRoute>} />
        <Route path="/campus-ops/campuses" element={<ProtectedRoute><CampusOperations><CampusesPage /></CampusOperations></ProtectedRoute>} />
        <Route path="/campus-ops/campuses/new" element={<ProtectedRoute><CampusOperations><CampusNew /></CampusOperations></ProtectedRoute>} />
        <Route path="/campus-ops/pricing" element={<ProtectedRoute><CampusOperations><PricingPage /></CampusOperations></ProtectedRoute>} />
        <Route path="/campus-ops/students" element={<ProtectedRoute><CampusOperations><StudentsPage /></CampusOperations></ProtectedRoute>} />
        <Route path="/campus-ops/purchases" element={<ProtectedRoute><CampusOperations><PurchasesPage /></CampusOperations></ProtectedRoute>} />
        <Route path="/campus-ops/professors" element={<ProtectedRoute><CampusOperations><ProfessorsPage /></CampusOperations></ProtectedRoute>} />
        <Route path="/campus-ops/analytics" element={<ProtectedRoute><CampusOperations><CampusAnalyticsPage /></CampusOperations></ProtectedRoute>} />
        <Route path="/solutions-qa" element={<ProtectedRoute><SolutionsQAReview /></ProtectedRoute>} />
        <Route path="/solutions-qa-admin" element={<ProtectedRoute><SolutionsQAAdmin /></ProtectedRoute>} />
        <Route path="/admin/chapter-qa" element={<ProtectedRoute><ChapterContentQA /></ProtectedRoute>} />
        <Route path="/admin/analytics/launch" element={<ProtectedRoute><LaunchAnalytics /></ProtectedRoute>} />
        <Route path="/admin/analytics/content" element={<ProtectedRoute><ContentAnalytics /></ProtectedRoute>} />
        <Route path="/admin/landing-pages" element={<ProtectedRoute><AdminLandingPages /></ProtectedRoute>} />
        <Route path="/admin/auth" element={<ProtectedRoute><AdminAuth /></ProtectedRoute>} />
        <Route path="/admin/greek" element={<ProtectedRoute><AdminGreek /></ProtectedRoute>} />
        <Route path="/admin/legacy-links" element={<ProtectedRoute><LegacyLinks /></ProtectedRoute>} />
        <Route path="/qa-costs" element={<ProtectedRoute><QACosts /></ProtectedRoute>} />
        <Route path="/inbox" element={<ProtectedRoute><StudentInboxPage /></ProtectedRoute>} />
        <Route path="/je-debug" element={<ProtectedRoute><JEDebug /></ProtectedRoute>} />
        <Route path="/share-leaderboard" element={<Navigate to="/asset-stats" replace />} />
        <Route path="/asset-stats" element={<ProtectedRoute><AssetStatsDashboard /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ImpersonationProvider>
              <SprintProvider>
                <RoutedAppBoundary>
                  <ImpersonationBanner />
                  <SprintTimerBar />
                  <RoleRouteGuard />
                  <AppRoutes />
                </RoutedAppBoundary>
              </SprintProvider>
            </ImpersonationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
