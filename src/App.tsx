import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AMProvider, useAM } from "@/context/AMContext";
import { Layout } from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import Accounts from "@/pages/Accounts";
import AIAdoption from "@/pages/AIAdoption";
import OrgIntelligence from "@/pages/OrgIntelligence";
import OutreachPlanner from "@/pages/OutreachPlanner";
import MIARecovery from "@/pages/MIARecovery";
import WeeklyBrief from "@/pages/WeeklyBrief";
import Commission from "@/pages/Commission";
import Login from "@/pages/Login";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAM();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="w-6 h-6 border-2 border-v-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading your book…</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AMProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="ai-adoption" element={<AIAdoption />} />
          <Route path="intel" element={<OrgIntelligence />} />
          <Route path="outreach" element={<OutreachPlanner />} />
          <Route path="mia" element={<MIARecovery />} />
          <Route path="brief" element={<WeeklyBrief />} />
          <Route path="commission" element={<Commission />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </AMProvider>
  );
}
