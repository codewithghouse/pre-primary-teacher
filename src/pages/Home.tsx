import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  Camera,
  Leaf,
  PencilLine,
  CheckSquare,
  Sparkles,
  Droplet,
  Star,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster } from "@/hooks/useClassRoster";
import { useTodayAttendance, type MoodKey } from "@/hooks/useTodayAttendance";
import { usePPDailyActivities } from "@/hooks/usePPDailyActivities";
import { usePPPickups } from "@/hooks/usePPPickups";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · HOME
   Marketing-keynote inspired: pastel-sherbet greeting hero, 3-stat strip,
   4 primary care quick-actions, horizontal slot timeline, pickup queue +
   highlight card. Real-app readable typography; mobile-first.
   ════════════════════════════════════════════════════════════════════════ */

const NAVY = "#1e3272";
const PEACH = "#FB923C";
const MINT = "#10B981";
const BLUSH = "#EC4899";
const SKY = "#0EA5E9";
const LAV = "#A78BFA";
const BUTTER = "#F59E0B";

export default function Home() {
  const { teacherData } = useAuth();
  const { primaryClass } = useTeacherClass();
  const { roster } = useClassRoster(primaryClass?.id);
  const { records } = useTodayAttendance(primaryClass?.id);
  const { data: activities } = usePPDailyActivities(primaryClass?.id);
  const { data: pickups } = usePPPickups(primaryClass?.id);

  const todayLong = format(new Date(), "EEEE · d MMM · h:mm a");
  const firstName = teacherData?.name?.split(" ")[0] || "Teacher";

  // Live attendance + mood
  const presentCount = Object.values(records).filter(
    (r) => r.status === "present" || r.status === "late" || r.status === "half-day"
  ).length;
  const totalKids = roster.length;
  const moodMix = Object.values(records).reduce(
    (acc, r) => {
      if (r.mood) acc[r.mood] = (acc[r.mood] || 0) + 1;
      return acc;
    },
    {} as Partial<Record<MoodKey, number>>
  );
  const happy = moodMix.happy || 0;
  const quiet = (moodMix.ok || 0) + (moodMix.sleepy || 0);

  const slots = activities?.slots || [];
  const liveSlot = slots.find((s) => s.status === "in_progress");
  const pickupsVerified = pickups
    ? Object.values(pickups.records).filter((r) => r.status === "verified").length
    : 0;
  const pickupsPending = pickups
    ? Object.values(pickups.records).filter((r) => r.status === "pending").length
    : 0;

  return (
    <div className="px-4 py-4 space-y-4 animate-fade-in">
      {/* ───── Greeting hero (pastel sherbet) ───── */}
      <div
        className="relative overflow-hidden rounded-[22px] p-5 shadow-[0_8px_24px_rgba(251,146,60,0.12)]"
        style={{
          background:
            "linear-gradient(135deg, #FFF1E0 0%, #FCE7F3 55%, #DBEAFE 100%)",
        }}
      >
        <span aria-hidden className="absolute right-3 top-2 text-4xl opacity-80 select-none">
          ☀️
        </span>
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.18em]"
          style={{ color: PEACH }}
        >
          {todayLong}
        </p>
        <h1
          className="mt-1 text-2xl font-extrabold leading-tight tracking-tight"
          style={{ color: "#0F172A" }}
        >
          Good morning, {firstName} 🌈
        </h1>
        <p className="mt-1 text-[13px] font-medium text-slate-600 max-w-[320px] leading-snug">
          {primaryClass?.name || "Your class"} is settling in.{" "}
          <strong className="text-slate-900">
            {presentCount} of {totalKids || "—"}
          </strong>{" "}
          {totalKids ? "children are here today." : "children loading…"}
        </p>

        {/* 3-stat strip */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatPill
            value={`${presentCount}/${totalKids || "—"}`}
            label="Present"
            color={MINT}
            emoji="🌤️"
          />
          <StatPill
            value={String(happy)}
            label="Happy"
            color={BLUSH}
            emoji="😊"
          />
          <StatPill
            value={String(quiet)}
            label="Quiet"
            color={SKY}
            emoji="🌙"
          />
        </div>
      </div>

      {/* ───── Care & Routine — primary 4 quick-actions ───── */}
      <section>
        <div className="flex items-baseline justify-between px-1 mb-2">
          <div className="flex items-baseline gap-2">
            <h2
              className="text-[15px] font-extrabold tracking-tight"
              style={{ color: "#0F172A" }}
            >
              Care &amp; Routine
            </h2>
            <span className="text-[11px] font-semibold text-slate-500">
              Tap to log
            </span>
          </div>
          <span
            className="text-[10px] font-extrabold uppercase tracking-[0.18em]"
            style={{ color: PEACH }}
          >
            4 quick actions
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CareCard
            href="/attendance"
            label="Attendance"
            helper={`${presentCount} / ${totalKids || "—"} in`}
            color={NAVY}
            bg="#E0E7FF"
            Icon={CheckSquare}
            emoji="✅"
          />
          <CareCard
            href="/meals-nap"
            label="Log Care"
            helper="Diaper · Meals · Nap"
            color={PEACH}
            bg="#FFEDD5"
            Icon={Leaf}
            emoji="🍃"
          />
          <CareCard
            href="/behavior"
            label="Add Note"
            helper="Behaviour or milestone"
            color={BLUSH}
            bg="#FCE7F3"
            Icon={PencilLine}
            emoji="💌"
          />
          <CareCard
            href="/photos"
            label="Photo Studio"
            helper="Consent-respecting"
            color={SKY}
            bg="#DBEAFE"
            Icon={Camera}
            emoji="📸"
          />
        </div>
      </section>

      {/* ───── Today's slots — horizontal strip ───── */}
      {slots.length > 0 && (
        <section
          className="rounded-2xl bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
        >
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <p
                className="text-[10px] font-extrabold uppercase tracking-[0.18em]"
                style={{ color: PEACH }}
              >
                Today's slots
              </p>
              <p
                className="text-[15px] font-extrabold tracking-tight"
                style={{ color: "#0F172A" }}
              >
                {slots.filter((s) => s.status === "done").length} done ·{" "}
                {liveSlot ? "1 live" : "0 live"} ·{" "}
                {slots.filter((s) => s.status === "pending").length} to come
              </p>
            </div>
            {liveSlot && (
              <span
                className="px-2 py-1 rounded-full text-[10px] font-extrabold tracking-wider"
                style={{ background: `${PEACH}22`, color: PEACH }}
              >
                {liveSlot.title} · live
              </span>
            )}
            <Link
              to="/daily-activities"
              className="text-[11px] font-semibold"
              style={{ color: NAVY }}
            >
              Open →
            </Link>
          </div>

          <ol className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            {slots.slice(0, 6).map((slot) => (
              <SlotPill key={slot.id} slot={slot} />
            ))}
          </ol>
        </section>
      )}

      {/* ───── Pickup queue + Highlight ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr] gap-3">
        <Link
          to="/pickup"
          className="rounded-2xl bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)] border border-emerald-100 hover:shadow-lg transition active:scale-[0.99] block"
        >
          <div className="flex items-baseline justify-between">
            <p
              className="text-[14px] font-extrabold tracking-tight"
              style={{ color: "#0F172A" }}
            >
              Pickup queue
            </p>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              style={{ background: `${MINT}22`, color: MINT }}
            >
              {pickupsVerified} confirmed
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            {pickupsPending > 0
              ? `${pickupsPending} pending verification`
              : "All clear so far"}
          </p>

          <div className="mt-3 space-y-2">
            {pickups
              ? Object.entries(pickups.records)
                  .slice(0, 3)
                  .map(([id, rec]) => {
                    const child = roster.find((r) => r.id === id);
                    const verified = rec.status === "verified";
                    return (
                      <div key={id} className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0"
                          style={{
                            background: verified ? MINT : BUTTER,
                            boxShadow: `0 2px 6px ${(verified ? MINT : BUTTER)}55`,
                          }}
                        >
                          {child?.name?.[0] || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-slate-900 truncate">
                            {child?.name?.split(" ")[0] || "—"}
                          </p>
                          <p className="text-[11px] font-medium text-slate-500 truncate">
                            {rec.pickerRelation || "Picker"} ·{" "}
                            {verified ? "Verified" : "Pending"}
                          </p>
                        </div>
                      </div>
                    );
                  })
              : (
                <p className="text-[12px] font-medium text-slate-500">
                  No pickups logged yet — open queue to set up.
                </p>
              )}
          </div>
        </Link>

        <div
          className="relative overflow-hidden rounded-2xl p-4 shadow-[0_4px_14px_rgba(245,158,11,0.18)]"
          style={{
            background: `linear-gradient(135deg, ${BUTTER}22, ${PEACH}14)`,
          }}
        >
          <span
            aria-hidden
            className="absolute right-2 bottom-0 text-5xl opacity-20 select-none"
          >
            🌟
          </span>
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.18em]"
            style={{ color: BUTTER }}
          >
            Highlight
          </p>
          <p
            className="mt-1 text-[15px] font-extrabold leading-tight tracking-tight"
            style={{ color: "#0F172A" }}
          >
            {slots.length > 0
              ? `${slots.filter((s) => s.status === "done").length} slots logged today`
              : "Plan today's slots →"}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-600 leading-snug">
            {activities?.themeOfWeek
              ? `Theme: ${activities.themeOfWeek}`
              : "Set the week's theme from school dashboard"}
          </p>
        </div>
      </div>

      {/* ───── Secondary quick-row (Diaper / Milestones / Pickup / Incident) ───── */}
      <section className="pt-1">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.18em] px-1 mb-2"
          style={{ color: "#64748B" }}
        >
          More
        </p>
        <div className="grid grid-cols-4 gap-2">
          <MiniAction href="/diaper"     Icon={Droplet}        label="Diaper"     color={SKY} />
          <MiniAction href="/milestones" Icon={Star}            label="Milestones" color={BUTTER} />
          <MiniAction href="/pickup"     Icon={ShieldCheck}    label="Pickup"     color={MINT} />
          <MiniAction href="/incidents"  Icon={AlertTriangle}  label="Incident"   color="#EF4444" />
        </div>
      </section>

      {/* ───── Theme of week (slim, deprioritised vs hero) ───── */}
      {activities?.themeOfWeek && (
        <section
          className="rounded-2xl p-3 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, ${LAV}22, ${BLUSH}10)` }}
        >
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
            style={{ background: `linear-gradient(135deg, ${LAV}, #8B5CF6)` }}
          >
            <Sparkles className="w-4 h-4" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.18em]"
              style={{ color: LAV }}
            >
              This week's theme
            </p>
            <p
              className="text-[13px] font-extrabold leading-tight tracking-tight truncate"
              style={{ color: "#0F172A" }}
            >
              {activities.themeOfWeek}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── building blocks ───────────────────────────────────────────────── */

function StatPill({
  value,
  label,
  color,
  emoji,
}: {
  value: string;
  label: string;
  color: string;
  emoji: string;
}) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2.5 shadow-[0_3px_10px_rgba(15,23,42,0.06)]">
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-xl font-extrabold leading-none tracking-tight"
          style={{ color }}
        >
          {value}
        </span>
        <span className="text-base leading-none">{emoji}</span>
      </div>
      <p
        className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500"
      >
        {label}
      </p>
    </div>
  );
}

function CareCard({
  href,
  label,
  helper,
  color,
  bg,
  Icon,
  emoji,
}: {
  href: string;
  label: string;
  helper: string;
  color: string;
  bg: string;
  Icon: React.ComponentType<{ className?: string }>;
  emoji: string;
}) {
  return (
    <Link
      to={href}
      className="relative overflow-hidden rounded-2xl bg-white p-3.5 shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:shadow-lg active:scale-[0.98] transition block"
      style={{ borderTop: `0.5px solid ${color}22` }}
    >
      <span
        aria-hidden
        className="absolute -right-2 -bottom-3 text-5xl opacity-10 select-none"
      >
        {emoji}
      </span>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: bg, color }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <p
        className="text-[14px] font-extrabold leading-tight tracking-tight"
        style={{ color: "#0F172A" }}
      >
        {label}
      </p>
      <p className="text-[11px] font-semibold text-slate-500 mt-0.5 leading-snug">
        {helper}
      </p>
    </Link>
  );
}

function SlotPill({
  slot,
}: {
  slot: { id: string; title: string; plannedStart?: string; status: string };
}) {
  const isLive = slot.status === "in_progress";
  const isDone = slot.status === "done";
  const tone = isLive ? PEACH : isDone ? MINT : SKY;
  const label = isLive ? "LIVE" : isDone ? "DONE" : slot.status.toUpperCase();
  return (
    <li
      className="snap-start min-w-[110px] rounded-xl px-3 py-2.5"
      style={{
        background: isLive
          ? `linear-gradient(135deg, ${PEACH}1f, ${PEACH}10)`
          : isDone
          ? "#F8FAFC"
          : "#FFFFFF",
        border: isLive ? `0.6px solid ${PEACH}55` : "0.5px solid #E2E8F0",
      }}
    >
      <p className="text-[10px] font-extrabold text-slate-500 tracking-wider">
        {slot.plannedStart || "—"}
      </p>
      <p
        className="text-[13px] font-extrabold leading-tight tracking-tight mt-0.5"
        style={{ color: "#0F172A" }}
      >
        {slot.title}
      </p>
      <div
        className="mt-2 flex items-center gap-1.5 text-[9px] font-extrabold tracking-widest"
        style={{ color: tone }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: tone,
            boxShadow: isLive ? `0 0 6px ${tone}` : "none",
          }}
        />
        {label}
      </div>
    </li>
  );
}

function MiniAction({
  href,
  Icon,
  label,
  color,
}: {
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}) {
  return (
    <Link
      to={href}
      className="rounded-2xl bg-white p-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.05)] hover:shadow-md active:scale-95 transition flex flex-col items-center gap-1.5"
    >
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
        style={{ background: color, boxShadow: `0 2px 6px ${color}55` }}
      >
        <Icon className="w-4 h-4" />
      </span>
      <span className="text-[11px] font-bold text-slate-700">{label}</span>
    </Link>
  );
}
