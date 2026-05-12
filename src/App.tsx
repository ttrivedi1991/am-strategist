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
import Login from "@/pages/Login";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAM();
  if (!isAuthenticated) {
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
        </Route>
      </Routes>
    </BrowserRouter>
    </AMProvider>
  );
}
