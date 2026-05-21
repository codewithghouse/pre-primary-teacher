import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, ChevronRight, Bell, Globe, Mic, Wifi } from "lucide-react";

export default function Profile() {
  const { teacherData, logout } = useAuth();

  return (
    <div className="px-4 py-4 space-y-4 animate-fade-in">
      <h1 className="text-xl font-black text-edu-navy">Profile</h1>

      <Card>
        <CardContent className="p-5 text-center">
          <div className="w-20 h-20 rounded-3xl bg-edu-navy text-white mx-auto flex items-center justify-center text-2xl font-black">
            {(teacherData?.name || "T")
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <h2 className="text-base font-bold text-edu-navy mt-3">
            {teacherData?.name || teacherData?.displayName || "Teacher"}
          </h2>
          <p className="text-xs text-muted-foreground">{teacherData?.email}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {teacherData?.assignedClass} · {teacherData?.schoolName}
          </p>
        </CardContent>
      </Card>

      <section>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 mb-2">
          Preferences
        </p>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            <Setting icon={Bell} label="Notifications" stub />
            <Setting icon={Globe} label="Language" subline="English" stub />
            <Setting icon={Mic} label="Voice input" subline="Enabled" stub />
            <Setting icon={Wifi} label="Photos: Wi-Fi only" stub />
          </CardContent>
        </Card>
      </section>

      <Button
        variant="destructive"
        size="lg"
        className="w-full"
        onClick={logout}
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </Button>

      <p className="text-[10px] text-center text-muted-foreground pt-2">
        Edullent · Pre-Primary Teacher · v0.1
      </p>
    </div>
  );
}

function Setting({
  icon: Icon,
  label,
  subline,
  stub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  subline?: string;
  stub?: boolean;
}) {
  return (
    <button
      type="button"
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/50 active:bg-secondary"
    >
      <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
        <Icon className="w-4 h-4 text-edu-navy" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {subline && (
          <p className="text-[11px] text-muted-foreground">{subline}</p>
        )}
      </div>
      {stub && (
        <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
          Soon
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}
