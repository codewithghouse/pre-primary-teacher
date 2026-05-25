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
import { usePPIncidents } from "@/hooks/usePPIncidents";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { CartoonAvatar } from "@/components/CartoonAvatar";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · HOME
   Storybook-sherbet keynote: greeting hero, live class snapshot, 4 care
   quick-actions, slot timeline, pickup queue with cartoon kids, incident
   badge, theme strip. Distinct mobile + desktop compositions.
   ════════════════════════════════════════════════════════════════════════ */

const NAVY = "#1e3272";
const PEACH = "#FB923C";
const MINT = "#10B981";
const BLUSH = "#EC4899";
const SKY = "#0EA5E9";
const LAV = "#A78BFA";
const BUTTER = "#F59E0B";
const RED = "#EF4444";

// Soft pillow shadow — matches ThemedCard / ChildProfile360 vibe.
const PILLOW =
  "0 1px 0 rgba(255,255,255,0.55) inset, 0 14px 32px -10px rgba(30,50,114,0.16), 0 4px 10px rgba(30,50,114,0.06)";

interface SlotLite {
  id: string;
  title: string;
  plannedStart?: string;
  status: string;
}

export default function Home() {
  const { teacherData } = useAuth();
  const { primaryClass } = useTeacherClass();
  const { roster } = useClassRoster(primaryClass?.id);
  const { records } = useTodayAttendance(primaryClass?.id);
  const { data: activities } = usePPDailyActivities(primaryClass?.id);
  const { data: pickups } = usePPPickups(primaryClass?.id);
  const { incidents } = usePPIncidents(primaryClass?.id);
  const isDesktop = useIsDesktop();

  const now = new Date();
  const hour = now.getHours();
  const greet =
    hour < 12
      ? { label: "Good morning", emoji: "☀️", sticker: "🌈", tint: PEACH }
      : hour < 17
      ? { label: "Good afternoon", emoji: "🌤️", sticker: "🪁", tint: BUTTER }
      : hour < 21
      ? { label: "Good evening", emoji: "🌙", sticker: "✨", tint: LAV }
      : { label: "Good night", emoji: "🌌", sticker: "💤", tint: NAVY };

  const todayLong = format(now, "EEEE · d MMM · h:mm a");
  const firstName = teacherData?.name?.split(" ")[0] || "Teacher";

  // Live attendance + mood
  const presentCount = Object.values(records).filter(
    (r) =>
      r.status === "present" || r.status === "late" || r.status === "half-day"
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

  const slots: SlotLite[] = activities?.slots || [];
  const liveSlot = slots.find((s) => s.status === "in_progress");
  const doneSlots = slots.filter((s) => s.status === "done").length;
  const pendingSlots = slots.filter((s) => s.status === "pending").length;

  const pickupsVerified = pickups
    ? Object.values(pickups.records).filter((r) => r.status === "verified")
        .length
    : 0;
  const pickupsPending = pickups
    ? Object.values(pickups.records).filter((r) => r.status === "pending")
        .length
    : 0;

  const unhandledIncidents = incidents.filter((i) => !i.handled).length;
  const hotIncidents = incidents.filter(
    (i) => !i.handled && (i.severity === "high" || i.severity === "critical")
  ).length;

  const themeOfWeek = activities?.themeOfWeek || null;
  const className = primaryClass?.name || "Your class";

  /* ───────────────────────── DESKTOP ───────────────────────── */
  if (isDesktop) {
    return (
      <div
        className="animate-fade-in"
        style={{
          padding: "24px 32px 80px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <Hero
          greet={greet}
          todayLong={todayLong}
          firstName={firstName}
          className={className}
          presentCount={presentCount}
          totalKids={totalKids}
          happy={happy}
          quiet={quiet}
          isDesktop
        />

        <div style={{ height: 18 }} />

        <SectionHeader title="Care & Routine" hint="Tap to log" rightTag="4 quick actions" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}
        >
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

        <div style={{ height: 22 }} />

        {/* Two-col: slot timeline + pickup card */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: 18,
          }}
        >
          <SlotPanel
            slots={slots}
            liveSlot={liveSlot}
            doneSlots={doneSlots}
            pendingSlots={pendingSlots}
          />
          <PickupPanel
            roster={roster}
            pickups={pickups}
            pickupsVerified={pickupsVerified}
            pickupsPending={pickupsPending}
            limit={4}
          />
        </div>

        <div style={{ height: 18 }} />

        <SectionHeader title="More" hint="Quick logs" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
          }}
        >
          <MiniAction href="/diaper" Icon={Droplet} label="Diaper" color={SKY} />
          <MiniAction
            href="/milestones"
            Icon={Star}
            label="Milestones"
            color={BUTTER}
          />
          <MiniAction
            href="/pickup"
            Icon={ShieldCheck}
            label="Pickup"
            color={MINT}
          />
          <MiniAction
            href="/incidents"
            Icon={AlertTriangle}
            label="Incident"
            color={RED}
            badge={unhandledIncidents}
            urgent={hotIncidents > 0}
          />
        </div>

        {themeOfWeek && (
          <>
            <div style={{ height: 18 }} />
            <ThemeStrip themeOfWeek={themeOfWeek} />
          </>
        )}
      </div>
    );
  }

  /* ────────────────────────── MOBILE ─────────────────────────── */
  return (
    <div className="px-4 py-4 space-y-4 animate-fade-in">
      <Hero
        greet={greet}
        todayLong={todayLong}
        firstName={firstName}
        className={className}
        presentCount={presentCount}
        totalKids={totalKids}
        happy={happy}
        quiet={quiet}
      />

      <section>
        <SectionHeader
          title="Care & Routine"
          hint="Tap to log"
          rightTag="4 quick actions"
        />
        <div className="grid grid-cols-2 gap-3">
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

      {slots.length > 0 && (
        <SlotPanel
          slots={slots}
          liveSlot={liveSlot}
          doneSlots={doneSlots}
          pendingSlots={pendingSlots}
        />
      )}

      <PickupPanel
        roster={roster}
        pickups={pickups}
        pickupsVerified={pickupsVerified}
        pickupsPending={pickupsPending}
        limit={3}
      />

      <section className="pt-1">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.18em] px-1 mb-2"
          style={{ color: "#64748B" }}
        >
          More
        </p>
        <div className="grid grid-cols-4 gap-2">
          <MiniAction href="/diaper" Icon={Droplet} label="Diaper" color={SKY} />
          <MiniAction
            href="/milestones"
            Icon={Star}
            label="Milestones"
            color={BUTTER}
          />
          <MiniAction
            href="/pickup"
            Icon={ShieldCheck}
            label="Pickup"
            color={MINT}
          />
          <MiniAction
            href="/incidents"
            Icon={AlertTriangle}
            label="Incident"
            color={RED}
            badge={unhandledIncidents}
            urgent={hotIncidents > 0}
          />
        </div>
      </section>

      {themeOfWeek && <ThemeStrip themeOfWeek={themeOfWeek} />}
    </div>
  );
}

/* ═══════════════════════ building blocks ═══════════════════════ */

interface GreetMeta {
  label: string;
  emoji: string;
  sticker: string;
  tint: string;
}

function Hero({
  greet,
  todayLong,
  firstName,
  className,
  presentCount,
  totalKids,
  happy,
  quiet,
  isDesktop = false,
}: {
  greet: GreetMeta;
  todayLong: string;
  firstName: string;
  className: string;
  presentCount: number;
  totalKids: number;
  happy: number;
  quiet: number;
  isDesktop?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 28,
        padding: isDesktop ? "26px 32px" : "20px",
        background:
          "linear-gradient(135deg, #FFF1E0 0%, #FCE7F3 55%, #DBEAFE 100%)",
        boxShadow: PILLOW,
      }}
    >
      <DotScribbles color={greet.tint} dense />

      {/* Floating stickers */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: isDesktop ? 32 : 14,
          top: isDesktop ? 18 : 10,
          fontSize: isDesktop ? 52 : 38,
          transform: "rotate(8deg)",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.10))",
          opacity: 0.95,
          pointerEvents: "none",
        }}
      >
        {greet.emoji}
      </span>
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: isDesktop ? 90 : 56,
          top: isDesktop ? 64 : 44,
          fontSize: isDesktop ? 22 : 18,
          transform: "rotate(-12deg)",
          opacity: 0.9,
          pointerEvents: "none",
        }}
      >
        {greet.sticker}
      </span>

      {/* Greeting block */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: isDesktop ? 600 : 320 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: greet.tint,
          }}
        >
          {todayLong}
        </p>
        <h1
          style={{
            marginTop: 4,
            fontSize: isDesktop ? 30 : 24,
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: "-0.6px",
            color: "#0F172A",
          }}
        >
          {greet.label}, {firstName}{" "}
          <span style={{ display: "inline-block", transform: "rotate(-6deg)" }}>
            🌈
          </span>
        </h1>
        <p
          style={{
            marginTop: 6,
            fontSize: isDesktop ? 14 : 13,
            fontWeight: 500,
            color: "#475569",
            lineHeight: 1.45,
          }}
        >
          {className} is settling in.{" "}
          <strong style={{ color: "#0F172A", fontWeight: 700 }}>
            {presentCount} of {totalKids || "—"}
          </strong>{" "}
          {totalKids ? "children are here today." : "children loading…"}
        </p>
      </div>

      {/* Stat strip */}
      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: isDesktop
            ? "repeat(4, minmax(0,1fr))"
            : "repeat(3, minmax(0,1fr))",
          gap: 10,
          position: "relative",
          zIndex: 1,
        }}
      >
        <StatPill
          value={`${presentCount}/${totalKids || "—"}`}
          label="Present"
          color={MINT}
          emoji="🌤️"
        />
        <StatPill value={String(happy)} label="Happy" color={BLUSH} emoji="😊" />
        <StatPill value={String(quiet)} label="Quiet" color={SKY} emoji="🌙" />
        {isDesktop && (
          <StatPill
            value={String(totalKids - presentCount)}
            label="Absent"
            color={NAVY}
            emoji="📭"
          />
        )}
      </div>
    </div>
  );
}

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
    <div
      style={{
        borderRadius: 20,
        background: "rgba(255,255,255,0.78)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: "10px 12px",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.7) inset, 0 6px 14px -6px rgba(15,23,42,0.10)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.8px",
            color,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>
      </div>
      <p
        style={{
          marginTop: 6,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#64748B",
        }}
      >
        {label}
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  hint,
  rightTag,
}: {
  title: string;
  hint?: string;
  rightTag?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "0 4px",
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "-0.3px",
            color: "#0F172A",
          }}
        >
          {title}
        </h2>
        {hint && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>
            {hint}
          </span>
        )}
      </div>
      {rightTag && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: PEACH,
          }}
        >
          {rightTag}
        </span>
      )}
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
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  emoji: string;
}) {
  return (
    <Link
      to={href}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 24,
        background: "#fff",
        padding: 16,
        boxShadow: PILLOW,
        display: "block",
        borderTop: `0.5px solid ${color}22`,
        transition: "transform 160ms ease, box-shadow 160ms ease",
      }}
      className="hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: -10,
          bottom: -14,
          fontSize: 56,
          opacity: 0.12,
          pointerEvents: "none",
          transform: "rotate(-6deg)",
        }}
      >
        {emoji}
      </span>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          background: bg,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
          transform: "rotate(-4deg)",
          boxShadow: `0 4px 10px ${color}22`,
        }}
      >
        <Icon size={20} strokeWidth={2.4} />
      </div>
      <p
        style={{
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "-0.2px",
          color: "#0F172A",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#64748B",
          marginTop: 2,
          lineHeight: 1.35,
        }}
      >
        {helper}
      </p>
    </Link>
  );
}

function SlotPanel({
  slots,
  liveSlot,
  doneSlots,
  pendingSlots,
}: {
  slots: SlotLite[];
  liveSlot: SlotLite | undefined;
  doneSlots: number;
  pendingSlots: number;
}) {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 26,
        background: "#fff",
        padding: 16,
        boxShadow: PILLOW,
      }}
    >
      <DotScribbles color={PEACH} />
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: PEACH,
            }}
          >
            Today's slots
          </p>
          <p
            style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "-0.3px",
              color: "#0F172A",
            }}
          >
            {doneSlots} done · {liveSlot ? "1 live" : "0 live"} · {pendingSlots}{" "}
            to come
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {liveSlot && (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.08em",
                background: `${PEACH}22`,
                color: PEACH,
                transform: "rotate(-2deg)",
              }}
            >
              {liveSlot.title} · live
            </span>
          )}
          <Link
            to="/daily-activities"
            style={{ fontSize: 11, fontWeight: 700, color: NAVY }}
          >
            Open →
          </Link>
        </div>
      </div>

      <ol
        className="snap-x"
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 4,
          margin: "0 -4px",
          paddingLeft: 4,
          paddingRight: 4,
          listStyle: "none",
          position: "relative",
          zIndex: 1,
        }}
      >
        {slots.slice(0, 8).map((slot) => (
          <SlotPill key={slot.id} slot={slot} />
        ))}
      </ol>
    </section>
  );
}

function SlotPill({ slot }: { slot: SlotLite }) {
  const isLive = slot.status === "in_progress";
  const isDone = slot.status === "done";
  const tone = isLive ? PEACH : isDone ? MINT : SKY;
  const label = isLive ? "LIVE" : isDone ? "DONE" : slot.status.toUpperCase();
  return (
    <li
      style={{
        scrollSnapAlign: "start",
        minWidth: 124,
        borderRadius: 18,
        padding: "10px 12px",
        background: isLive
          ? `linear-gradient(135deg, ${PEACH}1f, ${PEACH}10)`
          : isDone
          ? "#F8FAFC"
          : "#FFFFFF",
        border: isLive
          ? `0.6px solid ${PEACH}55`
          : "0.5px solid #E2E8F0",
        boxShadow: isLive ? `0 6px 14px -6px ${PEACH}55` : "none",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.10em",
          color: "#64748B",
        }}
      >
        {slot.plannedStart || "—"}
      </p>
      <p
        style={{
          marginTop: 2,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "-0.2px",
          color: "#0F172A",
          lineHeight: 1.2,
        }}
      >
        {slot.title}
      </p>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.16em",
          color: tone,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: tone,
            boxShadow: isLive ? `0 0 6px ${tone}` : "none",
          }}
        />
        {label}
      </div>
    </li>
  );
}

interface PickupRecord {
  status?: string;
  pickerRelation?: string;
}

interface PickupsDoc {
  records: Record<string, PickupRecord>;
}

interface RosterEntry {
  id: string;
  name?: string;
}

function PickupPanel({
  roster,
  pickups,
  pickupsVerified,
  pickupsPending,
  limit,
}: {
  roster: RosterEntry[];
  pickups: PickupsDoc | null | undefined;
  pickupsVerified: number;
  pickupsPending: number;
  limit: number;
}) {
  const entries: [string, PickupRecord][] = pickups
    ? Object.entries(pickups.records).slice(0, limit)
    : [];
  return (
    <Link
      to="/pickup"
      style={{
        position: "relative",
        overflow: "hidden",
        display: "block",
        borderRadius: 26,
        background: "#fff",
        padding: 16,
        boxShadow: PILLOW,
        border: "1px solid rgba(16,185,129,0.18)",
      }}
      className="active:scale-[0.99] transition"
    >
      <DotScribbles color={MINT} />
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <p
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "-0.2px",
            color: "#0F172A",
          }}
        >
          🚸 Pickup queue
        </p>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            background: `${MINT}22`,
            color: MINT,
            transform: "rotate(-2deg)",
          }}
        >
          {pickupsVerified} confirmed
        </span>
      </div>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#64748B",
          marginTop: 4,
          position: "relative",
          zIndex: 1,
        }}
      >
        {pickupsPending > 0
          ? `${pickupsPending} pending verification`
          : "All clear so far"}
      </p>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          position: "relative",
          zIndex: 1,
        }}
      >
        {entries.length > 0 ? (
          entries.map(([id, rec]) => {
            const child = roster.find((r) => r.id === id);
            const verified = rec.status === "verified";
            return (
              <div
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <CartoonAvatar
                  name={child?.name || "child"}
                  size={36}
                  ringColor={verified ? MINT : BUTTER}
                  ringWidth={2}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#0F172A",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {child?.name?.split(" ")[0] || "—"}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#64748B",
                    }}
                  >
                    {rec.pickerRelation || "Picker"} ·{" "}
                    {verified ? "Verified" : "Pending"}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 16,
                    transform: "rotate(8deg)",
                  }}
                  aria-hidden
                >
                  {verified ? "✅" : "⏳"}
                </span>
              </div>
            );
          })
        ) : (
          <p style={{ fontSize: 12, fontWeight: 500, color: "#64748B" }}>
            No pickups logged yet — open queue to set up.
          </p>
        )}
      </div>
    </Link>
  );
}

function MiniAction({
  href,
  Icon,
  label,
  color,
  badge,
  urgent,
}: {
  href: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string;
  color: string;
  badge?: number;
  urgent?: boolean;
}) {
  return (
    <Link
      to={href}
      style={{
        position: "relative",
        borderRadius: 22,
        background: "#fff",
        padding: "12px 8px",
        boxShadow: PILLOW,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        textAlign: "center",
      }}
      className="active:scale-95 hover:-translate-y-0.5 transition"
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          background: color,
          boxShadow: `0 4px 10px ${color}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          transform: "rotate(-4deg)",
        }}
      >
        <Icon size={18} strokeWidth={2.4} color="#fff" />
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#334155" }}>
        {label}
      </span>
      {badge && badge > 0 ? (
        <span
          style={{
            position: "absolute",
            top: 4,
            right: 6,
            minWidth: 20,
            height: 20,
            padding: "0 6px",
            borderRadius: 999,
            background: urgent ? RED : NAVY,
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: urgent
              ? `0 0 0 3px ${RED}33, 0 0 12px ${RED}66`
              : "0 2px 6px rgba(0,0,0,0.18)",
          }}
          className={urgent ? "animate-pulse" : undefined}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function ThemeStrip({ themeOfWeek }: { themeOfWeek: string }) {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: `linear-gradient(135deg, ${LAV}24, ${BLUSH}12)`,
        boxShadow: PILLOW,
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${LAV}, #8B5CF6)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          flexShrink: 0,
          transform: "rotate(-6deg)",
          boxShadow: `0 6px 14px ${LAV}44`,
        }}
      >
        <Sparkles size={18} strokeWidth={2.4} color="#fff" />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: LAV,
          }}
        >
          This week's theme
        </p>
        <p
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "-0.2px",
            color: "#0F172A",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {themeOfWeek}
        </p>
      </div>
    </section>
  );
}

function DotScribbles({
  color,
  dense = false,
}: {
  color: string;
  dense?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        inset: 0,
        opacity: dense ? 0.10 : 0.07,
        pointerEvents: "none",
      }}
    >
      <circle cx="14%" cy="24%" r="2.5" fill={color} />
      <circle cx="82%" cy="14%" r="1.8" fill={color} />
      <circle cx="68%" cy="62%" r="2" fill={color} />
      <circle cx="22%" cy="80%" r="1.6" fill={color} />
      <circle cx="48%" cy="32%" r="1.4" fill={color} />
      {dense && (
        <>
          <circle cx="90%" cy="80%" r="2.2" fill={color} />
          <circle cx="6%" cy="60%" r="1.4" fill={color} />
          <circle cx="55%" cy="88%" r="1.6" fill={color} />
        </>
      )}
    </svg>
  );
}
