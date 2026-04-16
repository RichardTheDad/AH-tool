import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppErrorBoundary } from "./components/common/AppErrorBoundary";
import { AppShell } from "./components/layout/AppShell";
import { ItemDetail } from "./pages/ItemDetail";
import { Login } from "./pages/Login";
import { Presets } from "./pages/Presets";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { Realms } from "./pages/Realms";
import { ResetPassword } from "./pages/ResetPassword";
import { Scanner } from "./pages/Scanner";
import { SuggestedRealms } from "./pages/SuggestedRealms";
import { Homepage } from "./pages/Homepage";
import { PublicDocs } from "./pages/PublicDocs";
import { useDocumentTitle } from "./hooks/useDocumentTitle";

function RootRedirect() {
  return <Navigate to="/app" replace />;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <AppErrorBoundary resetKey={location.pathname}>
      <AppShell>
        <Routes>
          <Route path="/" element={<ProtectedRoute guestAllowed><Scanner /></ProtectedRoute>} />
          <Route path="/scanner" element={<Navigate to="/" replace />} />
          <Route path="/suggested-realms" element={<ProtectedRoute><SuggestedRealms /></ProtectedRoute>} />
          <Route path="/realms" element={<ProtectedRoute guestAllowed><Realms /></ProtectedRoute>} />
          <Route path="/presets" element={<ProtectedRoute guestAllowed><Presets /></ProtectedRoute>} />
          <Route path="/items/:itemId" element={<ProtectedRoute><ItemDetail /></ProtectedRoute>} />
        </Routes>
      </AppShell>
    </AppErrorBoundary>
  );
}

function LegacyItemDetailRoute() {
  const location = useLocation();

  return (
    <ProtectedRoute>
      <AppErrorBoundary resetKey={location.pathname}>
        <AppShell>
          <ItemDetail />
        </AppShell>
      </AppErrorBoundary>
    </ProtectedRoute>
  );
}

export default function App() {
  const location = useLocation();

  useDocumentTitle(location.pathname);

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/home" element={<Homepage />} />
      <Route path="/public/docs" element={<PublicDocs />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/app/*" element={<AppRoutes />} />
      <Route path="/items/:itemId" element={<LegacyItemDetailRoute />} />
    </Routes>
  );
}
