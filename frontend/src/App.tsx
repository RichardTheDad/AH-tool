import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Imports } from "./pages/Imports";
import { ItemDetail } from "./pages/ItemDetail";
import { Login } from "./pages/Login";
import { Presets } from "./pages/Presets";
import { Realms } from "./pages/Realms";
import { ResetPassword } from "./pages/ResetPassword";
import { Scanner } from "./pages/Scanner";
import { Settings } from "./pages/Settings";
import { SuggestedRealms } from "./pages/SuggestedRealms";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/scanner" element={<Scanner />} />
                <Route path="/suggested-realms" element={<SuggestedRealms />} />
                <Route path="/realms" element={<Realms />} />
                <Route path="/imports" element={<Imports />} />
                <Route path="/presets" element={<Presets />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/items/:itemId" element={<ItemDetail />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
