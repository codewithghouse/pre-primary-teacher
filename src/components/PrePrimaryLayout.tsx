import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { TopBar } from "./TopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { DesktopSidebar } from "./DesktopSidebar";

export function PrePrimaryLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Auto-close drawer on route change (covers NavLink onClick + back/forward).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Esc key closes drawer.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-[#EEF4FF] flex">
      {/* Sidebar: slide-in drawer on mobile, sticky on desktop */}
      <DesktopSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile backdrop — only when drawer is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile: TopBar (hamburger + brand). Hidden on desktop where the
            sidebar carries the same brand info. */}
        <div className="lg:hidden">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
        </div>

        <main className="flex-1 pb-20 lg:pb-6 w-full max-w-md lg:max-w-none mx-auto lg:mx-0">
          <Outlet />
        </main>

        <div className="lg:hidden">
          <MobileBottomNav />
        </div>
      </div>
    </div>
  );
}
