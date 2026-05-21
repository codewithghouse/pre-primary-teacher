import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Camera,
  Mic,
  AlertTriangle,
  ChevronRight,
  Clock,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster } from "@/hooks/useClassRoster";
import { useTodayAttendance, type MoodKey } from "@/hooks/useTodayAttendance";
import { usePPDailyActivities } from "@/hooks/usePPDailyActivities";
import { usePPPickups } from "@/hooks/usePPPickups";

export default function Home() {
  const { teacherData } = useAuth();
  const { primaryClass } = useTeacherClass();
  const { roster } = useClassRoster(primaryClass?.id);
  const { records } = useTodayAttendance(primaryClass?.id);
  const { data: activities } = usePPDailyActivities(primaryClass?.id);
  const { data: pickups } = usePPPickups(primaryClass?.id);

  const today = format(new Date(), "EEEE, d MMM");

  // Live attendance stats
  const presentCount = Object.values(records).filter(
    (r) => r.status === "present" || r.status === "late" || r.status === "half-day"
  ).length;
  const moodMix = Object.values(records).reduce(
    (acc, r) => {
      if (r.mood) acc[r.mood] = (acc[r.mood] || 0) + 1;
      return acc;
    },
    {} as Partial<Record<MoodKey, number>>
  );

  const slots = activities?.slots || [];
  const completedSlots = slots.filter((s) => s.status === "done").length;
  const nextSlot = slots.find((s) => s.status === "pending" || s.status === "in_progress");

  const pickupsVerified = pickups
    ? Object.values(pickups.records).filter((r) => r.status === "verified").length
    : 0;

  return (
    <div className="px-4 py-4 space-y-4 animate-fade-in">
      <div className="flex items-baseline justify-between pt-1">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">{today}</p>
          <h1 className="text-xl font-black text-edu-navy mt-0.5">
            Namaste, {teacherData?.name?.split(" ")[0] || "Teacher"} 🌱
          </h1>
        </div>
      </div>

      {/* Theme banner — V2: pull from pp_themes/{schoolId} */}
      <div className="rounded-2xl bg-gradient-to-br from-edu-blue to-edu-navy text-white p-4 shadow-md">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/70 font-bold">
          <Sparkles className="w-3 h-3" />
          This Week's Theme
        </div>
        <p className="text-lg font-bold mt-1 leading-tight">
          {activities?.themeOfWeek || "Set this week's theme from school dashboard"}
        </p>
      </div>

      {/* KPI tiles — LIVE data */}
      <div className="grid grid-cols-2 gap-3">
        <KpiTile
          label="Present"
          value={`${presentCount}/${roster.length || "—"}`}
          subline={renderMoodMix(moodMix)}
          href="/attendance"
        />
        <KpiTile
          label="Activities"
          value={`${completedSlots}/${slots.length || 9}`}
          subline={
            activities?.reportStatus === "published" ||
            activities?.reportStatus === "auto_published"
              ? "Report sent ✓"
              : "Slots logged"
          }
          href="/activities"
        />
        <KpiTile
          label="Pickup"
          value={`${pickupsVerified}/${roster.length || "—"}`}
          subline={pickupsVerified > 0 ? "Verified safely" : "Tap to verify"}
          href="/pickup"
        />
        <KpiTile
          label="Class"
          value={primaryClass?.name?.split(/[-\s]/)[0] || "—"}
          subline={primaryClass?.section || "Section"}
          href="/roster"
        />
      </div>

      {/* Next-up */}
      {nextSlot && (
        <Card className="border-edu-yellow/40 bg-edu-light-yellow/40">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="font-bold uppercase tracking-wider text-edu-yellow">
                Next Up · {nextSlot.plannedStart}
              </CardDescription>
              <Clock className="w-4 h-4 text-edu-yellow" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-lg">{nextSlot.title}</CardTitle>
            <Link
              to="/activities"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-edu-blue"
            >
              Open <ChevronRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Today's timeline preview */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-bold text-edu-navy">Today's Activities</h2>
          <Link
            to="/activities"
            className="text-xs font-semibold text-edu-blue flex items-center gap-1"
          >
            Open <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <Card>
          <CardContent className="p-2">
            <ol className="space-y-0.5">
              {slots.slice(0, 6).map((slot) => (
                <li
                  key={slot.id}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-secondary/50"
                >
                  <SlotStatusIcon status={slot.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {slot.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {slot.plannedStart}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-bold text-edu-navy mb-2 px-1">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          <QuickAction icon={Camera} label="Photo" color="bg-edu-blue" />
          <QuickAction icon={Mic} label="Voice" color="bg-edu-green" />
          <QuickAction icon={ShieldCheck} label="Pickup" color="bg-edu-yellow" href="/pickup" />
          <QuickAction
            icon={AlertTriangle}
            label="Incident"
            color="bg-edu-red"
          />
        </div>
      </section>
    </div>
  );
}

function KpiTile({
  label,
  value,
  subline,
  href,
}: {
  label: string;
  value: string;
  subline?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <Card className="hover:shadow-md transition">
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-black text-edu-navy mt-0.5 leading-none">
          {value}
        </p>
        {subline && (
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            {subline}
          </div>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

function renderMoodMix(m: Partial<Record<MoodKey, number>>) {
  const parts: string[] = [];
  if (m.happy) parts.push(`😊${m.happy}`);
  if (m.ok) parts.push(`😐${m.ok}`);
  if (m.crying) parts.push(`😢${m.crying}`);
  if (m.sleepy) parts.push(`😴${m.sleepy}`);
  if (m.unwell) parts.push(`🤒${m.unwell}`);
  return parts.length ? parts.join(" · ") : "Mark moods on Attend";
}

function SlotStatusIcon({ status }: { status: string }) {
  if (status === "done")
    return <CheckCircle2 className="w-5 h-5 text-edu-green shrink-0" />;
  if (status === "in_progress")
    return (
      <div className="w-5 h-5 shrink-0 rounded-full border-2 border-edu-yellow bg-edu-light-yellow flex items-center justify-center">
        <div className="w-1.5 h-1.5 bg-edu-yellow rounded-full animate-pulse" />
      </div>
    );
  if (status === "skipped")
    return <div className="w-5 h-5 shrink-0 rounded-full border-2 border-border opacity-50" />;
  return <div className="w-5 h-5 shrink-0 rounded-full border-2 border-border" />;
}

function QuickAction({
  icon: Icon,
  label,
  color,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  href?: string;
}) {
  const inner = (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-border hover:shadow-md active:scale-95 transition">
      <div
        className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[11px] font-semibold text-foreground">{label}</span>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : <button type="button">{inner}</button>;
}
