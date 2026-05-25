/**
 * Reports.tsx — Teacher-side daily reports surface.
 * Cartoonified 2026-05-25.
 *
 * Two halves:
 *   1) TODAY card — shows status of today's pp_daily_activities doc
 *      (unpublished / preview / published / auto_published) + a
 *      "Generate & send" CTA that calls publishReport() from
 *      usePPDailyActivities. Needs at least 3 slots done before publish
 *      (matches DailyActivities Publish gate).
 *   2) ARCHIVE — list of past published reports via usePPTeacherReports.
 *      Sherbet ReportCard + detail modal mirroring the parent's pattern.
 *
 * Parent's Reports page reads from the same pp_daily_activities collection —
 * so anything published here lands on parent's archive immediately.
 */
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  X,
  ChevronRight,
  Clock,
  Loader2,
  Cloud,
  Send,
} from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { usePPDailyActivities } from "@/hooks/usePPDailyActivities";
import {
  usePPTeacherReports,
  type TeacherDailyReport,
} from "@/hooks/usePPTeacherReports";

const NAVY = "#1e3272";
const MINT = "#10B981";
const PEACH = "#FB923C";
const BLUSH = "#EC4899";
const SKY = "#0EA5E9";
const LAV = "#A78BFA";
const BUTTER = "#F59E0B";
const RED = "#EF4444";

const PILLOW =
  "0 1px 0 rgba(255,255,255,0.55) inset, 0 14px 32px -10px rgba(30,50,114,0.16), 0 4px 10px rgba(30,50,114,0.06)";

export default function Reports() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { data: todayDoc, publishReport } = usePPDailyActivities(
    primaryClass?.id
  );
  const { items, loading } = usePPTeacherReports(primaryClass?.id, 45);
  const isDesktop = useIsDesktop();
  const [openReport, setOpenReport] = useState<TeacherDailyReport | null>(null);
  const [publishing, setPublishing] = useState(false);

  const stats = useMemo(() => {
    const last7 = items.slice(0, 7);
    return {
      totalReports: items.length,
      photos: items.reduce((acc, r) => acc + r.photosCount, 0),
      photos7d: last7.reduce((acc, r) => acc + r.photosCount, 0),
      slotsDone: items.reduce((acc, r) => acc + r.slotsDone, 0),
      avgPerDay:
        items.length > 0
          ? Math.round(items.reduce((a, r) => a + r.slotsDone, 0) / items.length)
          : 0,
    };
  }, [items]);

  // Today's report state
  const todaySlots = todayDoc?.slots || [];
  const todayDone = todaySlots.filter((s) => s.status === "done").length;
  const todayTotal = todaySlots.length;
  const todayPhotos = todaySlots.reduce(
    (acc, s) => acc + (s.photoURLs?.length || 0),
    0
  );
  const todayStatus = todayDoc?.reportStatus || "unpublished";
  const todayPublished =
    todayStatus === "published" || todayStatus === "auto_published";
  const canPublish = todayDone >= 3;
  const pendingTodayCount = !todayPublished ? 1 : 0;

  const handlePublish = async () => {
    if (!canPublish || publishing) return;
    setPublishing(true);
    try {
      await publishReport();
      toast.success(
        `Today's report sent to all ${primaryClass?.name || "class"} parents 🎉`
      );
    } catch (err) {
      console.error("[Reports] publish failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not publish: ${msg.slice(0, 140)}`);
    } finally {
      setPublishing(false);
    }
  };

  if (classLoading) {
    return (
      <div
        style={{
          padding: "48px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          color: "#64748B",
        }}
      >
        <Loader2 className="animate-spin" />
        <p style={{ fontSize: 12, fontWeight: 600 }}>Resolving your class…</p>
      </div>
    );
  }

  if (!primaryClass) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          🌱 No class assigned
        </p>
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        padding: isDesktop ? "24px 28px 80px" : "16px 16px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        width: "100%",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      {/* Hero */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 28,
          padding: isDesktop ? "22px 26px" : "18px 18px",
          background:
            "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 55%, #FFFFFF 100%)",
          boxShadow: PILLOW,
        }}
      >
        <DotScribbles color={MINT} dense />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              background: `linear-gradient(135deg, ${MINT}, #059669)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: `0 8px 18px ${MINT}55`,
              transform: "rotate(-8deg)",
              flexShrink: 0,
            }}
            aria-hidden
          >
            📄
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: MINT,
                opacity: 0.9,
              }}
            >
              Daily reports
            </p>
            <h1
              style={{
                fontSize: isDesktop ? 26 : 21,
                fontWeight: 800,
                letterSpacing: "-0.6px",
                color: NAVY,
                marginTop: 2,
              }}
            >
              Reports{" "}
              <span
                aria-hidden
                style={{ display: "inline-block", transform: "rotate(6deg)" }}
              >
                📚
              </span>
            </h1>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#64748B",
                marginTop: 4,
              }}
            >
              {primaryClass.name} · {format(new Date(), "EEEE, d MMM")} · Generate
              & send daily reports to parents
            </p>
          </div>
        </div>
      </div>

      {/* TODAY card */}
      <TodayReportCard
        published={todayPublished}
        autoPublished={todayStatus === "auto_published"}
        publishedAt={todayDoc?.publishedAt}
        slotsDone={todayDone}
        slotsTotal={todayTotal}
        photos={todayPhotos}
        canPublish={canPublish}
        publishing={publishing}
        onPublish={handlePublish}
        themeOfWeek={todayDoc?.themeOfWeek}
      />

      {/* 4-stat KPI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop
            ? "repeat(4, minmax(0, 1fr))"
            : "repeat(2, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <StatTile
          label="Sent"
          value={String(stats.totalReports)}
          sub={`last ${Math.min(items.length, 45)} days`}
          emoji="📨"
          tone={MINT}
          surface="linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
        />
        <StatTile
          label="Photos"
          value={String(stats.photos)}
          sub={`${stats.photos7d} this week`}
          emoji="📸"
          tone={BLUSH}
          surface="linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)"
        />
        <StatTile
          label="Avg slots/day"
          value={String(stats.avgPerDay)}
          sub="across all reports"
          emoji="✨"
          tone={BUTTER}
          surface="linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)"
        />
        <StatTile
          label="Today pending"
          value={String(pendingTodayCount)}
          sub={todayPublished ? "all done ✓" : "not yet sent"}
          emoji="⏳"
          tone={pendingTodayCount > 0 ? PEACH : MINT}
          surface={
            pendingTodayCount > 0
              ? "linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)"
              : "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
          }
        />
      </div>

      {/* Archive section */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          paddingLeft: 4,
        }}
      >
        <span
          aria-hidden
          style={{ fontSize: 14, transform: "rotate(-6deg)", display: "inline-block" }}
        >
          📚
        </span>
        <p
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NAVY,
            opacity: 0.75,
          }}
        >
          Sent reports
        </p>
        {items.length > 0 && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              color: MINT,
              background: `${MINT}1f`,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            {items.length}
          </span>
        )}
      </div>

      {loading ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            color: "#64748B",
          }}
        >
          <Loader2 className="animate-spin" style={{ margin: "0 auto" }} />
          <p style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>
            Loading reports…
          </p>
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 16px",
            borderRadius: 22,
            background: "#fff",
            boxShadow: PILLOW,
          }}
        >
          <p style={{ fontSize: 40, marginBottom: 8 }} aria-hidden>
            📋
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>
            No reports sent yet
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#64748B",
              marginTop: 6,
              maxWidth: 320,
              margin: "6px auto 0",
              lineHeight: 1.55,
            }}
          >
            Once you publish today's report (or it auto-publishes at 6 PM IST),
            it'll show up here so you can see what parents received.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
            gap: 10,
          }}
        >
          {items.map((r) => (
            <ReportCard key={r.id} report={r} onOpen={() => setOpenReport(r)} />
          ))}
        </div>
      )}

      {/* Detail sheet */}
      {openReport && (
        <ReportDetail
          report={openReport}
          onClose={() => setOpenReport(null)}
          isDesktop={isDesktop}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ Today card ═══════════════════════ */

function TodayReportCard({
  published,
  autoPublished,
  publishedAt,
  slotsDone,
  slotsTotal,
  photos,
  canPublish,
  publishing,
  onPublish,
  themeOfWeek,
}: {
  published: boolean;
  autoPublished: boolean;
  publishedAt?: string;
  slotsDone: number;
  slotsTotal: number;
  photos: number;
  canPublish: boolean;
  publishing: boolean;
  onPublish: () => void;
  themeOfWeek?: string;
}) {
  const tone = published ? MINT : canPublish ? BUTTER : "#94A3B8";
  const surface = published
    ? "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
    : canPublish
    ? "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)"
    : "linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)";
  const overline = published
    ? autoPublished
      ? "Auto-published"
      : "Sent ✓"
    : canPublish
    ? "Ready to send"
    : "Today's report";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: 16,
        background: surface,
        boxShadow: PILLOW,
        borderLeft: `5px solid ${tone}`,
      }}
    >
      <DotScribbles color={tone} dense />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: tone,
                opacity: 0.9,
              }}
            >
              📅 {overline}
            </p>
            <p
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: NAVY,
                letterSpacing: "-0.3px",
                marginTop: 4,
              }}
            >
              {format(new Date(), "EEEE, d MMM")}
            </p>
            {themeOfWeek && (
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: BUTTER,
                  marginTop: 4,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                ✨ {themeOfWeek}
              </p>
            )}
            {/* Stats inline chips */}
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <Chip tone={MINT} emoji="✅" text={`${slotsDone}/${slotsTotal || "—"} slots`} />
              <Chip tone={BLUSH} emoji="📸" text={`${photos} ${photos === 1 ? "photo" : "photos"}`} />
              {published && publishedAt && (
                <Chip
                  tone={SKY}
                  emoji="📨"
                  text={`Sent ${format(new Date(publishedAt), "h:mm a")}`}
                />
              )}
            </div>
          </div>
          <span
            aria-hidden
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              background: published
                ? `linear-gradient(135deg, ${MINT}, #059669)`
                : canPublish
                ? `linear-gradient(135deg, ${BUTTER}, ${PEACH})`
                : "#fff",
              color: published || canPublish ? "#fff" : tone,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow:
                published || canPublish
                  ? `0 10px 22px ${tone}55`
                  : `inset 0 0 0 2px ${tone}33`,
              transform: "rotate(-6deg)",
              flexShrink: 0,
            }}
          >
            {published ? "📨" : canPublish ? "✨" : "⏳"}
          </span>
        </div>

        {/* CTA */}
        {published ? (
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#047857",
              marginTop: 12,
              lineHeight: 1.5,
            }}
          >
            🎉 Today's report has been sent to all parents. They'll see the full
            day's activities + photos in their Feed.
          </p>
        ) : (
          <>
            <p
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#64748B",
                marginTop: 12,
                lineHeight: 1.55,
              }}
            >
              {canPublish
                ? `${slotsDone} completed slots + ${photos} photo${photos === 1 ? "" : "s"} ready to send. Cloud Function publishes a PDF asynchronously; parents get a push immediately.`
                : `Need at least 3 slots done to send today's report (${slotsDone}/3). Mark slots done in Daily Activities, then come back.`}
            </p>
            <button
              type="button"
              onClick={onPublish}
              disabled={!canPublish || publishing}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "12px 18px",
                borderRadius: 16,
                background:
                  !canPublish || publishing
                    ? "#CBD5E1"
                    : `linear-gradient(135deg, ${MINT}, #059669)`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "-0.1px",
                border: "none",
                cursor: !canPublish || publishing ? "default" : "pointer",
                boxShadow:
                  !canPublish || publishing ? "none" : `0 10px 24px -6px ${MINT}88`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              {publishing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} strokeWidth={2.4} />
              )}
              {canPublish
                ? "Generate & send to parents"
                : `Need ${3 - slotsDone} more slot${3 - slotsDone === 1 ? "" : "s"} done`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ Stat tile ═══════════════════════ */

function StatTile({
  label,
  value,
  sub,
  emoji,
  tone,
  surface,
}: {
  label: string;
  value: string;
  sub?: string;
  emoji: string;
  tone: string;
  surface: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: "12px 12px 10px",
        background: surface,
        boxShadow: PILLOW,
      }}
    >
      <DotScribbles color={tone} />
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: "-1px",
            color: tone,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span
          aria-hidden
          style={{
            fontSize: 18,
            transform: "rotate(8deg)",
            display: "inline-block",
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.08))",
          }}
        >
          {emoji}
        </span>
      </div>
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: tone,
          opacity: 0.75,
          marginTop: 6,
          position: "relative",
          zIndex: 1,
        }}
      >
        {label}
      </p>
      {sub && (
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#94A3B8",
            marginTop: 2,
            position: "relative",
            zIndex: 1,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════ Report card ═══════════════════════ */

function ReportCard({
  report,
  onOpen,
}: {
  report: TeacherDailyReport;
  onOpen: () => void;
}) {
  const date = parseISO(report.date);
  const dateLabel = isToday(date)
    ? "Today"
    : isYesterday(date)
    ? "Yesterday"
    : format(date, "EEEE");
  const completionPct =
    report.slotsTotal > 0
      ? Math.round((report.slotsDone / report.slotsTotal) * 100)
      : 0;
  const isRecent = isToday(date) || isYesterday(date);
  const isAuto = report.reportStatus === "auto_published";

  return (
    <div
      onClick={onOpen}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: 14,
        background: isRecent
          ? "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
          : "#fff",
        boxShadow: PILLOW,
        borderLeft: `5px solid ${isRecent ? SKY : MINT}`,
        cursor: "pointer",
      }}
      className="hover:-translate-y-0.5 transition"
    >
      <DotScribbles color={isRecent ? SKY : MINT} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        {/* Date block */}
        <div
          style={{
            flexShrink: 0,
            minWidth: 56,
            textAlign: "center",
            borderRadius: 14,
            padding: "8px 6px",
            background: "#fff",
            boxShadow: `inset 0 0 0 1px ${(isRecent ? SKY : MINT)}33`,
          }}
        >
          <p
            style={{
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: isRecent ? SKY : MINT,
            }}
          >
            {format(date, "MMM")}
          </p>
          <p
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: NAVY,
              lineHeight: 1,
              marginTop: 2,
              letterSpacing: "-1px",
            }}
          >
            {format(date, "d")}
          </p>
          <p style={{ fontSize: 9, fontWeight: 800, color: "#64748B", marginTop: 2 }}>
            {format(date, "EEE")}
          </p>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: isRecent ? SKY : MINT,
                  }}
                >
                  {dateLabel}
                </p>
                {isAuto && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: BUTTER,
                      background: `${BUTTER}1f`,
                      padding: "2px 7px",
                      borderRadius: 999,
                    }}
                  >
                    🤖 Auto
                  </span>
                )}
              </div>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: NAVY,
                  letterSpacing: "-0.2px",
                  marginTop: 2,
                  lineHeight: 1.25,
                }}
              >
                {report.themeOfWeek || "Daily Report"}
              </h3>
            </div>
            <ChevronRight
              size={16}
              color="#94A3B8"
              strokeWidth={2.4}
              style={{ flexShrink: 0, marginTop: 4 }}
            />
          </div>

          {/* Quick stats row */}
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 8,
              alignItems: "center",
            }}
          >
            <Chip
              tone={MINT}
              emoji="✅"
              text={`${report.slotsDone}/${report.slotsTotal} slots`}
            />
            {report.photosCount > 0 && (
              <Chip
                tone={BLUSH}
                emoji="📸"
                text={`${report.photosCount} photo${report.photosCount === 1 ? "" : "s"}`}
              />
            )}
            {report.publishedAt && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#94A3B8",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Clock size={10} strokeWidth={2.4} />
                Sent {format(new Date(report.publishedAt), "h:mm a")}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {report.slotsTotal > 0 && (
            <div
              style={{
                marginTop: 10,
                height: 8,
                borderRadius: 999,
                background: "rgba(15,23,42,0.06)",
                overflow: "hidden",
                boxShadow: "inset 0 1px 2px rgba(15,23,42,0.08)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${completionPct}%`,
                  background: `linear-gradient(90deg, ${MINT}, #059669)`,
                  borderRadius: 999,
                  transition: "width 400ms cubic-bezier(.34,1.56,.64,1)",
                  boxShadow: `0 0 8px ${MINT}66`,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({
  tone,
  emoji,
  text,
}: {
  tone: string;
  emoji: string;
  text: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 800,
        color: tone,
        background: `${tone}1f`,
        padding: "3px 8px",
        borderRadius: 999,
      }}
    >
      <span aria-hidden>{emoji}</span>
      {text}
    </span>
  );
}

/* ═══════════════════════ Detail sheet ═══════════════════════ */

function ReportDetail({
  report,
  onClose,
  isDesktop,
}: {
  report: TeacherDailyReport;
  onClose: () => void;
  isDesktop: boolean;
}) {
  const date = parseISO(report.date);
  const sortedSlots = useMemo(
    () =>
      [...report.slots].sort((a, b) =>
        a.plannedStart < b.plannedStart ? -1 : 1
      ),
    [report.slots]
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(15,23,42,0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: isDesktop ? "center" : "flex-end",
        justifyContent: "center",
        animation: "fade-in 200ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: isDesktop ? 640 : 480,
          maxHeight: isDesktop ? "92vh" : "94vh",
          overflowY: "auto",
          background:
            "linear-gradient(180deg, #F1FBF5 0%, #FFFFFF 28%, #FFFFFF 100%)",
          borderRadius: isDesktop ? 28 : "28px 28px 0 0",
          boxShadow: "0 -20px 60px rgba(15,23,42,0.18)",
          animation: "slide-up 240ms cubic-bezier(.34,1.56,.64,1)",
          margin: isDesktop ? "0 16px" : 0,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            background:
              "linear-gradient(180deg, rgba(241,251,245,0.95) 0%, rgba(255,255,255,0.85) 100%)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            padding: isDesktop ? "16px 22px 14px" : "10px 18px 12px",
            borderRadius: isDesktop ? "28px 28px 0 0" : "28px 28px 0 0",
            zIndex: 10,
          }}
        >
          {!isDesktop && (
            <div
              style={{
                width: 48,
                height: 5,
                borderRadius: 999,
                background: "#E2E8F0",
                margin: "0 auto 12px",
              }}
            />
          )}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flex: 1,
                minWidth: 0,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${MINT}, #059669)`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  boxShadow: `0 6px 14px ${MINT}55`,
                  transform: "rotate(-6deg)",
                  flexShrink: 0,
                }}
              >
                📅
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: MINT,
                  }}
                >
                  {isToday(date)
                    ? "Today"
                    : isYesterday(date)
                    ? "Yesterday"
                    : format(date, "EEEE")}
                </p>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: NAVY,
                    letterSpacing: "-0.3px",
                    marginTop: 2,
                  }}
                >
                  {format(date, "d MMMM yyyy")}
                </h2>
                {report.themeOfWeek && (
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: BUTTER,
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    ✨ {report.themeOfWeek}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: "#F1F5F9",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={16} color="#64748B" strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            padding: isDesktop ? "14px 22px 18px" : "12px 18px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            <DetailStat
              label="Done"
              value={`${report.slotsDone}/${report.slotsTotal}`}
              tone={MINT}
              surface="linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
              emoji="✅"
            />
            <DetailStat
              label="Photos"
              value={String(report.photosCount)}
              tone={BLUSH}
              surface="linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)"
              emoji="📸"
            />
            <DetailStat
              label="Status"
              value={
                report.reportStatus === "auto_published" ? "Auto" : "Sent"
              }
              tone={SKY}
              surface="linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
              emoji="📨"
            />
          </div>

          {sortedSlots.length > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 10,
                  paddingLeft: 4,
                }}
              >
                <span
                  aria-hidden
                  style={{ fontSize: 14, transform: "rotate(-6deg)", display: "inline-block" }}
                >
                  🎨
                </span>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: NAVY,
                    opacity: 0.75,
                  }}
                >
                  Activity timeline
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortedSlots.map((slot) => (
                  <SlotItem key={slot.id} slot={slot} />
                ))}
              </div>
            </div>
          )}

          {report.reportHtml && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 10,
                  paddingLeft: 4,
                }}
              >
                <span
                  aria-hidden
                  style={{ fontSize: 14, transform: "rotate(-6deg)", display: "inline-block" }}
                >
                  📄
                </span>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: NAVY,
                    opacity: 0.75,
                  }}
                >
                  Full report (sent to parents)
                </p>
              </div>
              <div
                className="prose prose-sm max-w-none"
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: "#fff",
                  boxShadow: "inset 0 0 0 1px #E2E8F0",
                  fontSize: 13,
                  color: "#0F172A",
                  lineHeight: 1.6,
                }}
                dangerouslySetInnerHTML={{ __html: report.reportHtml }}
              />
            </div>
          )}

          {report.publishedAt && (
            <p
              style={{
                fontSize: 10,
                textAlign: "center",
                color: "#94A3B8",
                fontWeight: 600,
                paddingTop: 4,
              }}
            >
              📨 Sent {format(new Date(report.publishedAt), "d MMM 'at' h:mm a")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailStat({
  label,
  value,
  tone,
  surface,
  emoji,
}: {
  label: string;
  value: string;
  tone: string;
  surface: string;
  emoji: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 16,
        padding: "10px 8px",
        background: surface,
        boxShadow: PILLOW,
        textAlign: "center",
      }}
    >
      <DotScribbles color={tone} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <span aria-hidden style={{ fontSize: 16, transform: "rotate(-6deg)", display: "inline-block" }}>
          {emoji}
        </span>
        <p
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: tone,
            lineHeight: 1,
            marginTop: 4,
            letterSpacing: "-0.3px",
          }}
        >
          {value}
        </p>
        <p
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: tone,
            opacity: 0.75,
            marginTop: 4,
          }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

function SlotItem({
  slot,
}: {
  slot: TeacherDailyReport["slots"][number];
}) {
  const statusTone =
    slot.status === "done"
      ? MINT
      : slot.status === "in_progress"
      ? BUTTER
      : slot.status === "skipped"
      ? "#94A3B8"
      : SKY;
  const surface =
    slot.status === "done"
      ? "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
      : slot.status === "in_progress"
      ? "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)"
      : slot.status === "skipped"
      ? "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)"
      : "linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 16,
        padding: 12,
        background: surface,
        boxShadow: PILLOW,
        borderLeft: `4px solid ${statusTone}`,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        opacity: slot.status === "skipped" ? 0.7 : 1,
      }}
    >
      <DotScribbles color={statusTone} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flexShrink: 0,
          width: 48,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: statusTone,
          }}
        >
          {slot.plannedStart}
        </p>
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 999,
            background:
              slot.status === "done"
                ? `linear-gradient(135deg, ${MINT}, #059669)`
                : slot.status === "in_progress"
                ? `linear-gradient(135deg, ${BUTTER}, ${PEACH})`
                : "#fff",
            color:
              slot.status === "done" || slot.status === "in_progress"
                ? "#fff"
                : statusTone,
            boxShadow:
              slot.status === "done" || slot.status === "in_progress"
                ? `0 4px 10px ${statusTone}55`
                : `inset 0 0 0 2px ${statusTone}44`,
            transform:
              slot.status === "done" || slot.status === "in_progress"
                ? "rotate(-6deg)"
                : "none",
            marginTop: 4,
          }}
        >
          {slot.status === "done" ? (
            <CheckCircle2 size={14} strokeWidth={3} />
          ) : slot.status === "in_progress" ? (
            <span
              style={{
                width: 7,
                height: 7,
                background: "#fff",
                borderRadius: 999,
                animation: "pulse 1.4s ease-in-out infinite",
              }}
            />
          ) : slot.status === "skipped" ? (
            <Cloud size={13} strokeWidth={2.4} />
          ) : (
            <span
              style={{
                width: 5,
                height: 5,
                background: statusTone,
                opacity: 0.6,
                borderRadius: 999,
              }}
            />
          )}
        </span>
      </div>
      <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: NAVY, letterSpacing: "-0.1px" }}>
          {slot.title}
        </p>
        {slot.note && (
          <p
            style={{
              fontSize: 12,
              fontStyle: "italic",
              color: "#0F172A",
              opacity: 0.85,
              lineHeight: 1.5,
              marginTop: 4,
            }}
          >
            "{slot.note}"
          </p>
        )}
        {slot.skipReason && (
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: RED,
              fontStyle: "italic",
              marginTop: 4,
            }}
          >
            ☁️ Skipped: {slot.skipReason}
          </p>
        )}
        {slot.photoURLs && slot.photoURLs.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 8,
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {slot.photoURLs.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${slot.title} ${i + 1}`}
                loading="lazy"
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 12,
                  objectFit: "cover",
                  flexShrink: 0,
                  boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.08)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
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
        opacity: dense ? 0.1 : 0.07,
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

// Palette constants reserved for future variants on this page.
void LAV;
