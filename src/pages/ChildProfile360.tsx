import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Mail,
  ShieldAlert,
  Heart,
  Loader2,
  Utensils,
  Moon,
  Droplet,
  Camera,
  Sticker,
  Sprout,
  Users,
  CalendarDays,
  Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { useTodayAttendance, type MoodKey } from "@/hooks/useTodayAttendance";
import { usePPMealsNaps, MEAL_TYPE_EMOJI, MEAL_TYPE_LABEL, PORTION_LABEL } from "@/hooks/usePPMealsNaps";
import { usePPDiaperLogs, DIAPER_TYPE_EMOJI, DIAPER_TYPE_LABEL } from "@/hooks/usePPDiaperLogs";
import {
  usePPBehaviorNotes,
  BEHAVIOR_TYPE_COLOR,
  BEHAVIOR_TYPE_LABEL,
  type BehaviorNote,
} from "@/hooks/usePPBehaviorNotes";
import {
  usePPMilestones,
  ALL_DOMAINS,
  ALL_LEVELS,
  DOMAIN_COLOR,
  DOMAIN_EMOJI,
  DOMAIN_LABEL,
  LEVEL_COLOR,
  LEVEL_LABEL,
  type Domain,
  type Milestone,
  type RubricLevel,
} from "@/hooks/usePPMilestones";
import { usePPPhotos } from "@/hooks/usePPPhotos";
import { useChildHistory, type ChildAttendanceDay } from "@/hooks/useChildHistory";
import { useIsDesktop } from "@/hooks/useIsDesktop";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const MOOD_EMOJI: Record<MoodKey, string> = {
  happy: "😊",
  ok: "🙂",
  sleepy: "😴",
  crying: "😢",
  unwell: "🤒",
};

const MOOD_LABEL: Record<MoodKey, string> = {
  happy: "Happy",
  ok: "Okay",
  sleepy: "Sleepy",
  crying: "Crying",
  unwell: "Unwell",
};

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  present: { label: "Present", cls: "bg-edu-light-green text-edu-green border-edu-green/30" },
  absent: { label: "Absent", cls: "bg-edu-light-red text-edu-red border-edu-red/30" },
  late: { label: "Late", cls: "bg-edu-light-yellow text-edu-yellow border-edu-yellow/40" },
  "half-day": { label: "Half day", cls: "bg-edu-light-blue text-edu-blue border-edu-blue/30" },
  holiday: { label: "Holiday", cls: "bg-secondary text-muted-foreground border-border" },
  none: { label: "Not marked", cls: "bg-secondary text-muted-foreground border-border" },
};

const LEVEL_SCORE: Record<RubricLevel, number> = {
  beginning: 1,
  developing: 2,
  achieving: 3,
  excelling: 4,
};

// Returns "+91XXXXXXXXXX" or "" — same shape as ParentDirectory's normaliser
// but inlined here to keep dependencies minimal.
const cleanPhone = (raw?: string): string => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
};

const shortDate = (isoDay: string): { dd: string; ddd: string } => {
  const d = new Date(`${isoDay}T00:00:00`);
  return {
    dd: String(d.getDate()),
    ddd: d.toLocaleDateString("en-IN", { weekday: "short" }),
  };
};

const initials = (name: string): string =>
  name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function ChildProfile360() {
  const { childId = "" } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const { primaryClass, loading: classLoading } = useTeacherClass();
  const classId = primaryClass?.id;
  const { roster, loading: rosterLoading } = useClassRoster(classId);
  const { records: attendanceToday } = useTodayAttendance(classId);
  const { data: mealsNapsToday } = usePPMealsNaps(classId);
  const { data: diaperToday } = usePPDiaperLogs(classId);
  const { notes: allNotes } = usePPBehaviorNotes(classId);
  const { milestones: allMilestones } = usePPMilestones(classId);
  const { photos: photosToday } = usePPPhotos(classId);
  const { history } = useChildHistory(childId, classId);

  const child = useMemo(
    () => roster.find((c) => c.id === childId) || null,
    [roster, childId]
  );

  const childNotes = useMemo(
    () => allNotes.filter((n) => n.studentId === childId),
    [allNotes, childId]
  );
  const childMilestones = useMemo(
    () => allMilestones.filter((m) => m.studentId === childId),
    [allMilestones, childId]
  );
  const childPhotosToday = useMemo(
    () => photosToday.filter((p) => p.taggedStudentIds.includes(childId)),
    [photosToday, childId]
  );

  const todayMeals = useMemo(
    () => (mealsNapsToday?.meals || []).filter((m) => m.studentId === childId),
    [mealsNapsToday, childId]
  );
  const todayNaps = useMemo(
    () => (mealsNapsToday?.naps || []).filter((n) => n.studentId === childId),
    [mealsNapsToday, childId]
  );
  const todayDiaper = useMemo(
    () => (diaperToday?.entries || []).filter((e) => e.studentId === childId),
    [diaperToday, childId]
  );

  const todayAttendance = childId ? attendanceToday[childId] : undefined;

  // ─── Empty / loading states ──────────────────────────────
  if (classLoading || rosterLoading) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading profile…</p>
      </div>
    );
  }

  if (!primaryClass) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm font-bold text-edu-navy">No class assigned</p>
        <p className="text-xs text-muted-foreground mt-1">
          Contact your principal to be added to a class.
        </p>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="px-4 py-12 text-center space-y-3">
        <p className="text-sm font-bold text-edu-navy">Child not found in your class</p>
        <p className="text-xs text-muted-foreground">
          This child may belong to a different class or has been archived.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/roster")}>
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to roster
        </Button>
      </div>
    );
  }

  // ─── Sub-renderers (used in both layouts) ───────────────

  const IdentityCard = (
    <Card className="overflow-hidden">
      <CardContent className="p-4 flex items-center gap-4">
        {child.photoURL ? (
          <img
            src={child.photoURL}
            alt={child.name}
            className="w-20 h-20 rounded-full object-cover border-2 border-edu-navy/10 shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-edu-navy text-white flex items-center justify-center text-2xl font-black shrink-0">
            {initials(child.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg lg:text-xl font-black text-edu-navy truncate">
            {child.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Roll {child.rollNo}
            {child.ageMonths != null
              ? ` · ${Math.floor(child.ageMonths / 12)}y ${child.ageMonths % 12}m`
              : ""}
            {child.diet ? ` · ${child.diet}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <StatusPill status={todayAttendance?.status || "none"} />
            {todayAttendance?.mood && <MoodPill mood={todayAttendance.mood} />}
            {todayAttendance?.arrivalTime && (
              <span className="text-[10px] text-muted-foreground">
                Arrived{" "}
                {new Date(todayAttendance.arrivalTime).toLocaleTimeString(
                  "en-IN",
                  { hour: "2-digit", minute: "2-digit" }
                )}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const SafetyCard = ((child.allergies && child.allergies.length > 0) ||
    child.medical ||
    child.bloodGroup) && (
    <Card className="bg-edu-light-red/30 border-edu-red/30">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-4 h-4 text-edu-red" />
          <p className="text-[10px] font-black uppercase tracking-widest text-edu-red">
            Safety alerts
          </p>
        </div>
        {child.allergies && child.allergies.length > 0 && (
          <p className="text-xs">
            <span className="font-bold">Allergies:</span>{" "}
            {child.allergies.join(", ")}
          </p>
        )}
        {child.medical && (
          <p className="text-xs">
            <span className="font-bold">Medical:</span> {child.medical}
          </p>
        )}
        {child.bloodGroup && (
          <p className="text-xs">
            <span className="font-bold">Blood group:</span> {child.bloodGroup}
          </p>
        )}
      </CardContent>
    </Card>
  );

  const TodaySnapshot = (
    <Section title="Today" icon={<Activity className="w-3.5 h-3.5" />}>
      <div className="grid grid-cols-2 gap-2">
        <TodayTile
          icon={<Utensils className="w-4 h-4" />}
          label="Meals"
          count={todayMeals.length}
          sub={
            todayMeals.length > 0
              ? `Last: ${MEAL_TYPE_LABEL[todayMeals[todayMeals.length - 1].mealType]} (${PORTION_LABEL[todayMeals[todayMeals.length - 1].portion]})`
              : "No meals logged"
          }
          accent="bg-edu-light-orange text-edu-orange"
        />
        <TodayTile
          icon={<Moon className="w-4 h-4" />}
          label="Nap"
          count={todayNaps.length}
          sub={
            todayNaps.length > 0
              ? (() => {
                  const n = todayNaps[todayNaps.length - 1];
                  return n.endTime
                    ? `${n.durationMin ?? "-"} min`
                    : `Ongoing · ${n.startTime}`;
                })()
              : "No nap yet"
          }
          accent="bg-edu-light-blue text-edu-blue"
        />
        <TodayTile
          icon={<Droplet className="w-4 h-4" />}
          label="Care"
          count={todayDiaper.length}
          sub={
            todayDiaper.length > 0
              ? `Last: ${DIAPER_TYPE_EMOJI[todayDiaper[todayDiaper.length - 1].type]} ${todayDiaper[todayDiaper.length - 1].time}`
              : "Nothing logged"
          }
          accent="bg-edu-light-green text-edu-green"
        />
        <TodayTile
          icon={<Camera className="w-4 h-4" />}
          label="Photos"
          count={childPhotosToday.length}
          sub={
            childPhotosToday.length > 0
              ? `${childPhotosToday.length} today`
              : "None yet"
          }
          accent="bg-edu-pink/20 text-edu-pink"
        />
      </div>
    </Section>
  );

  const AttendanceStrip = (
    <Section
      title="Attendance · last 14 days"
      icon={<CalendarDays className="w-3.5 h-3.5" />}
    >
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {history.attendance.map((d) => (
          <AttendancePill key={d.date} day={d} />
        ))}
      </div>
      <AttendanceSummary days={history.attendance} />
    </Section>
  );

  const GrowthSection = (
    <Section title="Growth · NEP 2020 domains" icon={<Sprout className="w-3.5 h-3.5" />}>
      <div className="space-y-2">
        {ALL_DOMAINS.map((dom) => (
          <DomainProgress key={dom} domain={dom} milestones={childMilestones} />
        ))}
      </div>
    </Section>
  );

  const NotesSection = childNotes.length > 0 && (
    <Section title="Recent notes" icon={<Sticker className="w-3.5 h-3.5" />}>
      <div className="space-y-2">
        {childNotes.slice(0, 5).map((n) => (
          <NoteCard key={n.id} note={n} />
        ))}
      </div>
      {childNotes.length > 5 && (
        <Link
          to="/behavior"
          className="text-[11px] text-edu-blue font-semibold inline-block mt-2"
        >
          View all {childNotes.length} notes →
        </Link>
      )}
    </Section>
  );

  const MilestonesSection = childMilestones.length > 0 && (
    <Section title="Recent milestones" icon={<Sprout className="w-3.5 h-3.5" />}>
      <div className="space-y-2">
        {childMilestones.slice(0, 5).map((m) => (
          <MilestoneCard key={m.id} milestone={m} />
        ))}
      </div>
      {childMilestones.length > 5 && (
        <Link
          to="/milestones"
          className="text-[11px] text-edu-blue font-semibold inline-block mt-2"
        >
          View all {childMilestones.length} milestones →
        </Link>
      )}
    </Section>
  );

  const PhotosSection = childPhotosToday.length > 0 && (
    <Section title="Today's photos" icon={<Camera className="w-3.5 h-3.5" />}>
      <div className="grid grid-cols-3 gap-1.5">
        {childPhotosToday.slice(0, 6).map((p) => (
          <img
            key={p.id}
            src={p.storageUrl}
            alt={p.caption || child.name}
            className="aspect-square w-full object-cover rounded-lg border border-border"
            loading="lazy"
          />
        ))}
      </div>
      <Link
        to="/photos"
        className="text-[11px] text-edu-blue font-semibold inline-block mt-2"
      >
        Open Photo Studio →
      </Link>
    </Section>
  );

  const ParentCard = (
    <Section title="Parent" icon={<Phone className="w-3.5 h-3.5" />}>
      <Card>
        <CardContent className="p-3 space-y-2">
          <div>
            <p className="text-sm font-bold text-edu-navy">
              {child.parentName || "Parent"}
            </p>
            <p className="text-[11px] text-muted-foreground break-all">
              {child.parentEmail || child.email || "—"}
            </p>
            {child.parentPhone && (
              <p className="text-[11px] text-muted-foreground">
                {child.parentPhone}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {child.parentPhone && (
              <>
                <a
                  href={`tel:${cleanPhone(child.parentPhone).replace("+", "")}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-edu-blue text-white"
                >
                  <Phone className="w-3 h-3" /> Call
                </a>
                <a
                  href={`https://wa.me/${cleanPhone(child.parentPhone).replace("+", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-edu-green text-white"
                >
                  <MessageCircle className="w-3 h-3" /> WhatsApp
                </a>
              </>
            )}
            {(child.parentEmail || child.email) && (
              <a
                href={`mailto:${child.parentEmail || child.email}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-edu-navy text-white"
              >
                <Mail className="w-3 h-3" /> Email
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </Section>
  );

  const PickupCard = child.authorizedPickup && child.authorizedPickup.length > 0 && (
    <Section title="Authorized pickup" icon={<Users className="w-3.5 h-3.5" />}>
      <Card>
        <CardContent className="p-3">
          <ul className="space-y-2">
            {child.authorizedPickup.map((p) => (
              <li key={p.name} className="flex items-center gap-2">
                {p.photoURL ? (
                  <img
                    src={p.photoURL}
                    alt={p.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-edu-navy/10 text-edu-navy flex items-center justify-center text-[10px] font-bold">
                    {initials(p.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.relation}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </Section>
  );

  const ComfortCard = child.comfortCue && (
    <Section title="Comfort cue" icon={<Heart className="w-3.5 h-3.5" />}>
      <Card className="bg-edu-pink/10 border-edu-pink/30">
        <CardContent className="p-3">
          <p className="text-xs italic text-foreground/80 leading-relaxed">
            "{child.comfortCue}"
          </p>
        </CardContent>
      </Card>
    </Section>
  );

  // ─── Layouts ──────────────────────────────────────────────

  if (isDesktop) {
    return (
      <div className="px-8 py-6 animate-fade-in">
        <BackBar onBack={() => navigate(-1)} className="mb-4" />
        <div className="grid grid-cols-[340px_minmax(0,1fr)] gap-6 max-w-6xl">
          {/* Sticky left rail */}
          <aside className="space-y-3 self-start sticky top-4">
            {IdentityCard}
            {SafetyCard}
            {ParentCard}
            {PickupCard}
            {ComfortCard}
          </aside>

          {/* Scrollable right column */}
          <div className="space-y-4 min-w-0">
            {TodaySnapshot}
            {AttendanceStrip}
            {GrowthSection}
            <div className="grid grid-cols-2 gap-4">
              <div>{NotesSection}</div>
              <div>{MilestonesSection}</div>
            </div>
            {PhotosSection}
          </div>
        </div>
      </div>
    );
  }

  // Mobile
  return (
    <div className="px-4 py-3 space-y-3 animate-fade-in">
      <BackBar onBack={() => navigate(-1)} />
      {IdentityCard}
      {SafetyCard}
      {TodaySnapshot}
      {AttendanceStrip}
      {GrowthSection}
      {NotesSection}
      {MilestonesSection}
      {PhotosSection}
      {ParentCard}
      {PickupCard}
      {ComfortCard}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function BackBar({
  onBack,
  className,
}: {
  onBack: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-edu-navy transition",
        className
      )}
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Back
    </button>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {icon}
        {title}
      </div>
      <div>{children}</div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_PILL[status] || STATUS_PILL.none;
  return (
    <span
      className={cn(
        "text-[10px] font-bold px-2 py-0.5 rounded-full border",
        meta.cls
      )}
    >
      {meta.label}
    </span>
  );
}

function MoodPill({ mood }: { mood: MoodKey }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-foreground border border-border inline-flex items-center gap-1">
      <span className="text-sm leading-none">{MOOD_EMOJI[mood]}</span>
      {MOOD_LABEL[mood]}
    </span>
  );
}

function TodayTile({
  icon,
  label,
  count,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  sub: string;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center",
              accent
            )}
          >
            {icon}
          </span>
          <span className="text-xl font-black text-edu-navy">{count}</span>
        </div>
        <p className="text-[11px] font-bold text-edu-navy mt-1.5">{label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
      </CardContent>
    </Card>
  );
}

function AttendancePill({ day }: { day: ChildAttendanceDay }) {
  const { dd, ddd } = shortDate(day.date);
  const cls =
    day.status === "present"
      ? "bg-edu-light-green text-edu-green border-edu-green/30"
      : day.status === "absent"
      ? "bg-edu-light-red text-edu-red border-edu-red/30"
      : day.status === "late"
      ? "bg-edu-light-yellow text-edu-yellow border-edu-yellow/40"
      : day.status === "half-day"
      ? "bg-edu-light-blue text-edu-blue border-edu-blue/30"
      : day.status === "holiday"
      ? "bg-secondary text-muted-foreground border-border"
      : "bg-white text-muted-foreground/60 border-dashed border-border";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-w-[36px] h-12 rounded-lg border text-[10px] shrink-0",
        cls
      )}
      title={`${day.date} · ${STATUS_PILL[day.status]?.label || day.status}`}
    >
      <span className="font-black">{dd}</span>
      <span className="opacity-60">{ddd}</span>
    </div>
  );
}

function AttendanceSummary({ days }: { days: ChildAttendanceDay[] }) {
  const counts = days.reduce(
    (acc, d) => {
      if (d.status === "present") acc.present += 1;
      else if (d.status === "absent") acc.absent += 1;
      else if (d.status === "late") acc.late += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0 }
  );
  const marked = counts.present + counts.absent + counts.late;
  if (marked === 0) {
    return (
      <p className="text-[10px] text-muted-foreground mt-2">
        No attendance recorded in the last 14 days.
      </p>
    );
  }
  const pct = Math.round((counts.present / marked) * 100);
  return (
    <p className="text-[10px] text-muted-foreground mt-2">
      <span className="text-edu-green font-bold">{counts.present}P</span> ·{" "}
      <span className="text-edu-red font-bold">{counts.absent}A</span> ·{" "}
      <span className="text-edu-yellow font-bold">{counts.late}L</span> ·{" "}
      <span className="font-bold text-edu-navy">{pct}%</span> attendance
    </p>
  );
}

function DomainProgress({
  domain,
  milestones,
}: {
  domain: Domain;
  milestones: Milestone[];
}) {
  const domainMs = milestones.filter((m) => m.domain === domain);
  const highest = domainMs.reduce<RubricLevel | null>((acc, m) => {
    if (!acc) return m.level;
    return LEVEL_SCORE[m.level] > LEVEL_SCORE[acc] ? m.level : acc;
  }, null);
  const reachedIdx = highest ? LEVEL_SCORE[highest] : 0;
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 border",
          DOMAIN_COLOR[domain]
        )}
      >
        {DOMAIN_EMOJI[domain]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-bold text-edu-navy">
            {DOMAIN_LABEL[domain]}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {domainMs.length} observation{domainMs.length === 1 ? "" : "s"}
            {highest && (
              <>
                {" · "}
                <span className={cn("font-bold", LEVEL_COLOR[highest])}>
                  {LEVEL_LABEL[highest]}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          {ALL_LEVELS.map((lvl, i) => {
            const filled = i < reachedIdx;
            return (
              <div
                key={lvl}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  filled ? "bg-edu-navy" : "bg-border"
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: BehaviorNote }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span
            className={cn(
              "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
              BEHAVIOR_TYPE_COLOR[note.type]
            )}
          >
            {BEHAVIOR_TYPE_LABEL[note.type]}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(note.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        <p className="text-xs text-foreground/90 leading-relaxed">
          {note.content}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          — {note.createdByName}
        </p>
      </CardContent>
    </Card>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span
            className={cn(
              "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
              DOMAIN_COLOR[milestone.domain]
            )}
          >
            {DOMAIN_EMOJI[milestone.domain]} {DOMAIN_LABEL[milestone.domain]}
          </span>
          <span
            className={cn(
              "text-[10px] font-bold",
              LEVEL_COLOR[milestone.level]
            )}
          >
            {LEVEL_LABEL[milestone.level]}
          </span>
        </div>
        <p className="text-xs text-foreground/90 leading-relaxed">
          {milestone.observation}
        </p>
        {milestone.evidence && (
          <p className="text-[10px] text-muted-foreground mt-1 italic">
            Evidence: {milestone.evidence}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {new Date(milestone.recordedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
          {milestone.term ? ` · ${milestone.term}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
