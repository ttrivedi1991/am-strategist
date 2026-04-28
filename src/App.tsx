import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import Accounts from "@/pages/Accounts";
import AIAdoption from "@/pages/AIAdoption";
import OrgIntelligence from "@/pages/OrgIntelligence";
import OutreachPlanner from "@/pages/OutreachPlanner";
import MIARecovery from "@/pages/MIARecovery";
import WeeklyBrief from "@/pages/WeeklyBrief";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
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
  );
}
