import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Imports } from "./pages/Imports";
import { ItemDetail } from "./pages/ItemDetail";
import { Presets } from "./pages/Presets";
import { Realms } from "./pages/Realms";
import { Scanner } from "./pages/Scanner";
import { Settings } from "./pages/Settings";
import { SuggestedRealms } from "./pages/SuggestedRealms";

export default function App() {
  return (
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
  );
}
