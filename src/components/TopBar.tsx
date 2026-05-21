import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Sprout } from "lucide-react";

export function TopBar() {
  const { teacherData } = useAuth();

  const initials = (teacherData?.name || teacherData?.displayName || "T")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      className="sticky top-0 z-30 bg-edu-navy text-white border-b border-edu-navy-light"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-4 py-3 flex items-center justify-between max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <Sprout className="w-5 h-5 text-edu-green" />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">
              Edullent · Pre-Primary
            </div>
            <div className="text-sm font-bold">
              {teacherData?.assignedClass || "My Class"}
              <span className="text-white/60 font-normal ml-1">
                · {teacherData?.schoolName || "School"}
              </span>
            </div>
          </div>
        </div>

        {/* Avatar → Profile (sign-out, settings) */}
        <Link
          to="/profile"
          className="w-9 h-9 rounded-full bg-edu-blue flex items-center justify-center text-xs font-bold ring-2 ring-white/10 hover:ring-white/30 transition"
          title="Profile & sign out"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
