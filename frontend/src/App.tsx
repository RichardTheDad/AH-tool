import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppErrorBoundary } from "./components/common/AppErrorBoundary";
import { AppShell } from "./components/layout/AppShell";
import { ItemDetail } from "./pages/ItemDetail";
import { Login } from "./pages/Login";
import { Presets } from "./pages/Presets";
import { Realms } from "./pages/Realms";
import { ResetPassword } from "./pages/ResetPassword";
import { Scanner } from "./pages/Scanner";
import { SuggestedRealms } from "./pages/SuggestedRealms";
import { Homepage } from "./pages/Homepage";
import { PublicDocs } from "./pages/PublicDocs";
import { useDocumentTitle } from "./hooks/useDocumentTitle";

/**
 * RootRedirect: If user is logged in, go to /app; otherwise go to public homepage
 */
function RootRedirect() {
  const { session } = useAuth();
  return <Navigate to={session ? "/app" : "/home"} replace />;
}

function ProtectedAppRoutes() {
  const location = useLocation();

  return (
    <ProtectedRoute>
      <AppErrorBoundary resetKey={location.pathname}>
        <AppShell>
          <Routes>
            <Route path="/" element={<Scanner />} />
            <Route path="/scanner" element={<Navigate to="/" replace />} />
            <Route path="/suggested-realms" element={<SuggestedRealms />} />
            <Route path="/realms" element={<Realms />} />
            <Route path="/presets" element={<Presets />} />
            <Route path="/items/:itemId" element={<ItemDetail />} />
          </Routes>
        </AppShell>
      </AppErrorBoundary>
    </ProtectedRoute>
  );
}

export default function App() {
  const location = useLocation();
  
  // Update document metadata based on current route
  useDocumentTitle(location.pathname);
  
  return (
    <Routes>
      {/* Root routes to home or app based on auth status */}
      <Route path="/" element={<RootRedirect />} />
      
      {/* Public pages */}
      <Route path="/home" element={<Homepage />} />
      <Route path="/public/docs" element={<PublicDocs />} />
      
      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Protected app routes */}
      <Route path="/app/*" element={<ProtectedAppRoutes />} />

      {/* Legacy deep-link compatibility */}
      <Route path="/items/:itemId" element={<ProtectedAppRoutes />} />
    </Routes>
  );
}
