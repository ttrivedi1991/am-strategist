import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAM } from "@/context/AMContext";
import {
  LayoutDashboard, Users, Send, ShieldAlert, FileText, Zap, ChevronUp, Check, LogOut, TrendingUp, HelpCircle, Sparkles
} from "lucide-react";

// Simplified per Bryan's Jul 16 feedback: partner-centric by default.
// AI Adoption and Org Intelligence live inside each Partner Profile now
// (routes still exist for deep links; they're just not primary nav).
const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/accounts", icon: Users, label: "Accounts" },
  { to: "/mia", icon: ShieldAlert, label: "Top Blockers" },
  { to: "/outreach", icon: Send, label: "Outreach Planner" },
  { to: "/brief", icon: FileText, label: "Weekly Brief" },
  { to: "/strategize", icon: Sparkles, label: "Strategize" },
  { to: "/commission", icon: TrendingUp, label: "Commission", amOnly: true },
  { to: "/guide", icon: HelpCircle, label: "Guide" },
];

const AVATAR_COLORS: Record<string, string> = {
  tanmay: "bg-blue-500",
  desiree: "bg-violet-500",
  adam: "bg-emerald-500",
};

export function Sidebar() {
  const { selectedAM, setSelectedAM, logout, roster, role } = useAM();
  const nav = NAV.filter(item => !item.amOnly || role === "am");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-56 flex flex-col bg-v-navy border-r border-white/10">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white text-sm font-bold leading-none">AM Strategist</p>
          <p className="text-white/40 text-[10px] mt-0.5">by Vendasta</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all group",
                isActive
                  ? "bg-blue-500/20 text-white font-medium"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-blue-400" : "text-white/50 group-hover:text-white/80")} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 py-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-white/60 hover:text-white hover:bg-white/8 group"
        >
          <LogOut className="w-4 h-4 shrink-0 text-white/50 group-hover:text-white/80" />
          <span>Logout</span>
        </button>
      </div>

      {/* AM Switcher */}
      <div className="p-3 border-t border-white/10 relative">
        {/* Dropdown (opens upward) */}
        {open && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#1a2235] border border-white/10 rounded-xl overflow-hidden shadow-xl">
            <p className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-widest">
              Enterprise Team
            </p>
            {roster.map(am => (
              <button
                key={am.id}
                onClick={() => { setSelectedAM(am); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/6 transition-colors text-left"
              >
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0", AVATAR_COLORS[am.id])}>
                  {am.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-xs font-medium truncate">{am.name}</p>
                  <p className="text-white/40 text-[10px] truncate">{am.title}</p>
                </div>
                {selectedAM.id === am.id && (
                  <Check className="w-3 h-3 text-blue-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Current AM card */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
        >
          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0", AVATAR_COLORS[selectedAM.id])}>
            {selectedAM.avatar}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-white text-xs font-medium truncate">{selectedAM.name}</p>
            <p className="text-white/40 text-[10px] truncate">{selectedAM.title}</p>
          </div>
          <ChevronUp className={cn("w-3.5 h-3.5 text-white/30 shrink-0 transition-transform", open ? "" : "rotate-180")} />
        </button>
      </div>
    </aside>
  );
}
