import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AM } from "@/data/mock";
import {
  LayoutDashboard, Users, BrainCircuit, Bell, Send, UserX, FileText, Settings, Zap
} from "lucide-react";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/accounts", icon: Users, label: "Book of Business" },
  { to: "/ai-adoption", icon: BrainCircuit, label: "AI Adoption" },
  { to: "/intel", icon: Bell, label: "Org Intelligence" },
  { to: "/outreach", icon: Send, label: "Outreach Planner" },
  { to: "/mia", icon: UserX, label: "MIA Recovery" },
  { to: "/brief", icon: FileText, label: "Weekly Brief" },
];

export function Sidebar() {
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
        {NAV.map(({ to, icon: Icon, label }) => (
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

      {/* AM Profile */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {AM.avatar}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">{AM.name}</p>
            <p className="text-white/40 text-[10px] truncate">{AM.title}</p>
          </div>
          <Settings className="w-3.5 h-3.5 text-white/30 ml-auto shrink-0" />
        </div>
      </div>
    </aside>
  );
}
