import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineBanner } from "./components/OfflineBanner";
import { PrePrimaryLayout } from "./components/PrePrimaryLayout";
import { PageLoader, AuthLoader } from "./components/PageLoader";

// Lazy-load pages with chunk-load retry — handles stale deploys gracefully.
const lazyWithRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) =>
  lazy(async () => {
    const RELOAD_KEY = "pp-teacher:chunk-reload";
    try {
      return await factory();
    } catch (err: any) {
      const isChunkError =
        err?.name === "ChunkLoadError" ||
        /Loading chunk [\d]+ failed/.test(err?.message ?? "") ||
        /Failed to fetch dynamically imported module/.test(err?.message ?? "");
      if (isChunkError && !sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        return { default: (() => null) as unknown as T };
      }
      throw err;
    }
  });

const Login = lazyWithRetry(() => import("./pages/Login"));
const Home = lazyWithRetry(() => import("./pages/Home"));
const Attendance = lazyWithRetry(() => import("./pages/Attendance"));
const Roster = lazyWithRetry(() => import("./pages/Roster"));
const DailyActivities = lazyWithRetry(() => import("./pages/DailyActivities"));
const PickupVerification = lazyWithRetry(() => import("./pages/PickupVerification"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const DiaperLog = lazyWithRetry(() => import("./pages/DiaperLog"));
const MealsNap = lazyWithRetry(() => import("./pages/MealsNap"));
const BehaviorNotes = lazyWithRetry(() => import("./pages/BehaviorNotes"));
const Milestones = lazyWithRetry(() => import("./pages/Milestones"));
const Notices = lazyWithRetry(() => import("./pages/Notices"));
const Photos = lazyWithRetry(() => import("./pages/Photos"));
const Events = lazyWithRetry(() => import("./pages/Events"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
// /setup is a public bootstrap route — bypasses AuthContext stage gate so a
// principal can sign in and seed a class + teacher + students without first
// being a pre-primary teacher themselves.
const Setup = lazyWithRetry(() => import("./pages/Setup"));

const REDIRECT_KEY = "pp-teacher:post-login-redirect";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppRoutes = () => {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  const isSetupRoute = location.pathname === "/setup";

  useEffect(() => {
    // /setup runs its own auth flow — skip the K-12-style redirect persistence.
    if (isSetupRoute) return;
    if (!loading && !user) {
      const target = location.pathname + location.search + location.hash;
      if (target && target !== "/") {
        sessionStorage.setItem(REDIRECT_KEY, target);
      }
    }
    if (user) {
      const target = sessionStorage.getItem(REDIRECT_KEY);
      if (target && location.pathname === "/") {
        sessionStorage.removeItem(REDIRECT_KEY);
        window.history.replaceState(null, "", target);
      }
    }
  }, [loading, user, location, isSetupRoute]);

  // /setup bypasses ALL auth gates — it handles its own principal sign-in
  // so a principal (not a pre-primary teacher) can bootstrap a class +
  // teacher + students without being subject to the pre-primary stage gate.
  if (isSetupRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Setup />
      </Suspense>
    );
  }

  if (loading) return <AuthLoader />;

  if (!user) {
    return (
      <Suspense fallback={<AuthLoader />}>
        <Login authError={error} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PrePrimaryLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/roster" element={<Roster />} />
          <Route path="/activities" element={<DailyActivities />} />
          <Route path="/pickup" element={<PickupVerification />} />
          <Route path="/diaper" element={<DiaperLog />} />
          <Route path="/meals-nap" element={<MealsNap />} />
          <Route path="/behavior" element={<BehaviorNotes />} />
          <Route path="/milestones" element={<Milestones />} />
          <Route path="/notices" element={<Notices />} />
          <Route path="/photos" element={<Photos />} />
          <Route path="/events" element={<Events />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <OfflineBanner />
          <AppRoutes />
          <Toaster
            position="top-center"
            theme="light"
            richColors
            closeButton
            toastOptions={{
              style: { fontFamily: "inherit", borderRadius: "12px" },
            }}
          />
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
