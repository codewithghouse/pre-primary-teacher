import { NavLink } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  Home,
  ClipboardCheck,
  Camera,
  Users,
  ShieldCheck,
  ShieldAlert,
  Droplet,
  Utensils,
  Star,
  BookOpen,
  Megaphone,
  Image as ImageIcon,
  Calendar as CalendarIcon,
  PhoneCall,
  Settings as SettingsIcon,
  User as UserIcon,
  FileText,
  MessageCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { usePPMessageThreads } from "@/hooks/usePPMessages";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Daily",
    items: [
      { to: "/", label: "Home", icon: Home, end: true },
      { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
      { to: "/activities", label: "Daily Activities", icon: Camera },
    ],
  },
  {
    label: "Class",
    items: [
      { to: "/roster", label: "Roster", icon: Users },
      { to: "/pickup", label: "Pickup Verification", icon: ShieldCheck },
      { to: "/safety", label: "Safety Dashboard", icon: ShieldAlert },
      { to: "/incidents", label: "Incidents", icon: ShieldAlert },
      { to: "/parents", label: "Parent Directory", icon: PhoneCall },
    ],
  },
  {
    label: "Care & Routine",
    items: [
      { to: "/diaper", label: "Diaper / Washroom", icon: Droplet },
      { to: "/meals-nap", label: "Meals & Nap", icon: Utensils },
    ],
  },
  {
    label: "Observations",
    items: [
      { to: "/behavior", label: "Behavior Notes", icon: Star },
      { to: "/milestones", label: "Milestones", icon: BookOpen },
    ],
  },
  {
    label: "Communication",
    items: [
      { to: "/messages", label: "Messages", icon: MessageCircle },
      { to: "/notices", label: "Class Notices", icon: Megaphone },
      { to: "/events", label: "Class Events", icon: CalendarIcon },
      { to: "/photos", label: "Photo Studio", icon: ImageIcon },
      { to: "/reports", label: "Daily Reports", icon: FileText },
    ],
  },
  {
    label: "Setup",
    items: [
      { to: "/settings", label: "Class Settings", icon: SettingsIcon },
    ],
  },
];

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Unified sidebar shell — slides in as a drawer on mobile (toggled by the
// hamburger in TopBar), sticky and always visible on desktop. Matches the
// K-12 teacher-dashboard navigation pattern.
export function DesktopSidebar({ isOpen, onClose }: AppSidebarProps) {
  const { teacherData } = useAuth();
  const { primaryClass } = useTeacherClass();
  const { totalUnread } = usePPMessageThreads(primaryClass?.id);
  const initials = (teacherData?.name || teacherData?.displayName || "T")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 xl:w-72 shrink-0 flex flex-col bg-edu-navy text-white transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10 relative">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden p-1">
            <img
              src="/edullent-icon.png"
              alt="Edullent"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">
              Edullent
            </div>
            <div className="text-sm font-bold">Pre-Primary</div>
          </div>
          {/* Close (mobile only) */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden ml-auto w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-white/40">
            Class
          </p>
          <p className="text-base font-bold mt-0.5 truncate">
            {teacherData?.assignedClass || "—"}
          </p>
          <p className="text-[11px] text-white/60 mt-0.5 truncate">
            {teacherData?.schoolName || "School"}
          </p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] uppercase tracking-widest font-bold text-white/40">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end }) => {
                const badge = to === "/messages" ? totalUnread : 0;
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition group",
                          isActive
                            ? "bg-edu-blue text-white shadow-md"
                            : "text-white/70 hover:bg-white/5 hover:text-white"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isActive ? "" : "opacity-70"
                            )}
                          />
                          <span className="truncate flex-1">{label}</span>
                          {badge > 0 && (
                            <span
                              className={cn(
                                "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center leading-none",
                                isActive
                                  ? "bg-white text-edu-blue"
                                  : "bg-edu-pink text-white"
                              )}
                            >
                              {badge > 99 ? "99+" : badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Profile pill at bottom */}
      <div className="px-3 py-4 border-t border-white/10">
        <NavLink
          to="/profile"
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition",
              isActive
                ? "bg-edu-blue text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            )
          }
        >
          <div className="w-8 h-8 rounded-full bg-edu-blue flex items-center justify-center text-[11px] font-bold ring-2 ring-white/10">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">
              {teacherData?.name || teacherData?.displayName || "Teacher"}
            </p>
            <p className="text-[10px] text-white/50 truncate">
              {teacherData?.email || "Profile & sign out"}
            </p>
          </div>
          <UserIcon className="w-4 h-4 opacity-50 shrink-0" />
        </NavLink>
      </div>
    </aside>
  );
}
