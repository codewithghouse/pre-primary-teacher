import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { MobileBottomNav } from "./MobileBottomNav";

export function PrePrimaryLayout() {
  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col">
      <TopBar />
      <main className="flex-1 pb-20 max-w-md mx-auto w-full">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}
