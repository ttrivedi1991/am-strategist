import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function Layout() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-56 min-w-0">
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
