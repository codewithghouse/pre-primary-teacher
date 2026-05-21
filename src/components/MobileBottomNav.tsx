import { NavLink } from "react-router-dom";
import { Home, Users, ClipboardCheck, Camera, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/attendance", label: "Attend", icon: ClipboardCheck },
  { to: "/activities", label: "Day", icon: Camera },
  { to: "/roster", label: "Class", icon: Users },
  { to: "/pickup", label: "Pickup", icon: ShieldCheck },
];

export function MobileBottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 max-w-md mx-auto">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors",
                isActive ? "text-edu-navy" : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform",
                    isActive && "scale-110"
                  )}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
