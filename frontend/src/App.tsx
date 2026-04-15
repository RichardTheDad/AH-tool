import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/*" element={<ProtectedAppRoutes />} />
    </Routes>
  );
}
