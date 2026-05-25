import { useMemo, useState } from "react";
import {
  Loader2,
  X,
  Undo2,
  Clock,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import {
  usePPDiaperLogs,
  type DiaperType,
  type DiaperEntry,
  DIAPER_TYPE_LABEL,
  DIAPER_TYPE_EMOJI,
} from "@/hooks/usePPDiaperLogs";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · DIAPER & WASHROOM LOG
   Storybook-sherbet quick-log surface. CartoonAvatar in every row,
   sherbet quick-log tiles, distinct mobile bottom-sheet / desktop side.
   ════════════════════════════════════════════════════════════════════════ */

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

const DIAPER_TYPES: DiaperType[] = [
  "wet",
  "soiled",
  "mixed",
  "dry_check",
  "washroom",
];

const TYPE_TONE: Record<
  DiaperType,
  { tone: string; surface: string; bar: string }
> = {
  wet: {
    tone: SKY,
    surface: "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)",
    bar: SKY,
  },
  soiled: {
    tone: PEACH,
    surface: "linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)",
    bar: PEACH,
  },
  mixed: {
    tone: RED,
    surface: "linear-gradient(135deg, #FFD6D6 0%, #FFF1F1 100%)",
    bar: RED,
  },
  dry_check: {
    tone: MINT,
    surface: "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)",
    bar: MINT,
  },
  washroom: {
    tone: BUTTER,
    surface: "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)",
    bar: BUTTER,
  },
};

const minutesSince = (iso: string): number => {
  const t = new Date(iso).getTime();
  return Math.max(0, Math.round((Date.now() - t) / 60000));
};

const sinceLabel = (mins: number): string => {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`;
};

interface ChildSummary {
  child: RosterChild;
  lastEntry: DiaperEntry | null;
  todayCount: number;
  minsSince: number | null;
}

export default function DiaperLog() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const {
    data,
    loading: logsLoading,
    addEntry,
    undoLast,
  } = usePPDiaperLogs(primaryClass?.id);
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyType, setBusyType] = useState<DiaperType | null>(null);

  const loading = classLoading || rosterLoading || logsLoading;

  const summaries: ChildSummary[] = useMemo(() => {
    const entries = data?.entries || [];
    const byChild = new Map<string, DiaperEntry[]>();
    for (const e of entries) {
      const arr = byChild.get(e.studentId) || [];
      arr.push(e);
      byChild.set(e.studentId, arr);
    }
    return roster.map((c) => {
      const arr = (byChild.get(c.id) || []).slice().sort((a, b) =>
        a.recordedAt < b.recordedAt ? 1 : -1
      );
      const last = arr[0] || null;
      return {
        child: c,
        lastEntry: last,
        todayCount: arr.length,
        minsSince: last ? minutesSince(last.recordedAt) : null,
      };
    });
  }, [data?.entries, roster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((s) => s.child.name.toLowerCase().includes(q));
  }, [summaries, search]);

  const stats = useMemo(() => {
    const total = data?.entries.length || 0;
    const uniqueKids = new Set((data?.entries || []).map((e) => e.studentId))
      .size;
    const overdue = summaries.filter(
      (s) => s.minsSince !== null && s.minsSince > 180
    ).length;
    return { total, uniqueKids, overdue };
  }, [data?.entries, summaries]);

  const activeChild = filtered.find((s) => s.child.id === activeChildId);

  if (classLoading)
    return <CenteredLoader label="Resolving your class…" />;
  if (!primaryClass) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          🌱 No class assigned
        </p>
      </div>
    );
  }
  if (loading && roster.length === 0)
    return <CenteredLoader label="Loading diaper log…" />;

  const handleQuickLog = async (
    child: RosterChild,
    type: DiaperType,
    closeSheet?: boolean
  ) => {
    setBusyType(type);
    try {
      await addEntry({
        studentId: child.id,
        studentName: child.name,
        type,
        note: note.trim() || undefined,
      });
      toast.success(
        `${DIAPER_TYPE_EMOJI[type]} ${DIAPER_TYPE_LABEL[type]} logged for ${child.name.split(" ")[0]}`
      );
      setNote("");
      if (closeSheet) setActiveChildId(null);
    } catch (err) {
      console.error("[DiaperLog] addEntry failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save: ${msg.slice(0, 120)}`);
    } finally {
      setBusyType(null);
    }
  };

  const handleUndo = async (child: RosterChild) => {
    try {
      await undoLast(child.id);
      toast.message(`Removed last entry for ${child.name.split(" ")[0]}`);
    } catch (err) {
      console.error("[DiaperLog] undoLast failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not undo: ${msg.slice(0, 120)}`);
    }
  };

  const cardCols = isDesktop ? "repeat(3, minmax(0, 1fr))" : "1fr";
  const allEntries = data?.entries || [];

  return (
    <>
      <div
        className="animate-fade-in"
        style={{
          padding: isDesktop ? "24px 28px 80px" : "16px 16px 80px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
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
              "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 55%, #FFFFFF 100%)",
            boxShadow: PILLOW,
          }}
        >
          <DotScribbles color={SKY} dense />
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
                background: `linear-gradient(135deg, ${SKY}, #0284C7)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                boxShadow: `0 8px 18px ${SKY}55`,
                transform: "rotate(-8deg)",
                flexShrink: 0,
              }}
              aria-hidden
            >
              🚼
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: SKY,
                  opacity: 0.9,
                }}
              >
                Care log
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
                Diaper &amp; Washroom{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(6deg)" }}
                >
                  💧
                </span>
              </h1>
              <p
                style={{
                  fontSize: isDesktop ? 13 : 12,
                  fontWeight: 500,
                  color: "#64748B",
                  marginTop: 4,
                }}
              >
                {primaryClass.name} · {format(new Date(), "EEEE, d MMM")} · Tap
                a child for quick-log
              </p>
            </div>
          </div>
        </div>

        {/* 3-stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <CounterCard
            label="Entries"
            value={stats.total}
            emoji="📋"
            tone={NAVY}
            surface="linear-gradient(135deg, #E1ECFF 0%, #F7FAFF 100%)"
          />
          <CounterCard
            label="Children"
            value={stats.uniqueKids}
            total={roster.length || undefined}
            emoji="👶"
            tone={SKY}
            surface="linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
          />
          <CounterCard
            label="Overdue >3h"
            value={stats.overdue}
            emoji="⏰"
            tone={stats.overdue > 0 ? PEACH : MINT}
            surface={
              stats.overdue > 0
                ? "linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)"
                : "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
            }
          />
        </div>

        {/* Search */}
        <SearchPillow value={search} onChange={setSearch} />

        {/* Main grid + (desktop only) timeline aside */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "2fr 1fr" : "1fr",
            gap: 16,
          }}
        >
          {/* Roster */}
          <div>
            {filtered.length === 0 ? (
              <EmptyState
                emoji="🔍"
                title="No children match"
                subtitle={`Nothing matches "${search}".`}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: cardCols,
                  gap: 12,
                }}
              >
                {filtered.map((s) => (
                  <ChildCard
                    key={s.child.id}
                    summary={s}
                    isDesktop={isDesktop}
                    busyType={busyType}
                    onTap={() => setActiveChildId(s.child.id)}
                    onQuickLog={(t) => handleQuickLog(s.child, t, false)}
                    onUndo={() => handleUndo(s.child)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Desktop-only timeline aside */}
          {isDesktop && (
            <aside
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 22,
                padding: 16,
                background: "#fff",
                boxShadow: PILLOW,
                alignSelf: "start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 14,
                    transform: "rotate(-6deg)",
                    display: "inline-block",
                  }}
                >
                  ⏱️
                </span>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: NAVY,
                  }}
                >
                  Today's Timeline
                </p>
              </div>
              {allEntries.length === 0 ? (
                <p
                  style={{
                    fontSize: 12,
                    color: "#94A3B8",
                    textAlign: "center",
                    padding: "16px 0",
                  }}
                >
                  No entries yet.
                </p>
              ) : (
                <ol
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxHeight: "70vh",
                    overflowY: "auto",
                    padding: 0,
                    margin: 0,
                    listStyle: "none",
                  }}
                >
                  {[...allEntries]
                    .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))
                    .map((e) => {
                      const tt = TYPE_TONE[e.type];
                      return (
                        <li
                          key={e.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 10px",
                            borderRadius: 12,
                            background: tt.surface,
                            borderLeft: `3px solid ${tt.bar}`,
                          }}
                        >
                          <span style={{ fontSize: 18 }} aria-hidden>
                            {DIAPER_TYPE_EMOJI[e.type]}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: NAVY,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {e.studentName}
                            </p>
                            <p
                              style={{
                                fontSize: 10,
                                color: "#64748B",
                              }}
                            >
                              {DIAPER_TYPE_LABEL[e.type]} · {e.time}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                </ol>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* Mobile child action sheet */}
      {!isDesktop && activeChild && (
        <ChildActionSheet
          summary={activeChild}
          note={note}
          onNoteChange={setNote}
          busyType={busyType}
          onLog={(type) => handleQuickLog(activeChild.child, type, true)}
          onUndo={() => handleUndo(activeChild.child)}
          onClose={() => {
            setActiveChildId(null);
            setNote("");
          }}
        />
      )}
    </>
  );
}

/* ═══════════════════════ building blocks ═══════════════════════ */

function CenteredLoader({ label }: { label: string }) {
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
      <p style={{ fontSize: 12, fontWeight: 600 }}>{label}</p>
    </div>
  );
}

function CounterCard({
  label,
  value,
  total,
  emoji,
  tone,
  surface,
}: {
  label: string;
  value: number;
  total?: number;
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
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <span
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: "-1.2px",
              color: tone,
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          {total !== undefined && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: tone,
                opacity: 0.55,
              }}
            >
              /{total}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 20,
            lineHeight: 1,
            transform: "rotate(8deg)",
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.08))",
          }}
          aria-hidden
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
    </div>
  );
}

function SearchPillow({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 22,
        background: "#fff",
        boxShadow: PILLOW,
        padding: "4px 4px 4px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Search size={16} color="#94A3B8" strokeWidth={2.4} />
      <input
        placeholder="Search a child…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: 14,
          fontWeight: 600,
          color: "#0F172A",
          padding: "12px 8px",
          minWidth: 0,
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "#F1F5F9",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            marginRight: 4,
          }}
        >
          <X size={14} color="#64748B" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

function EmptyState({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "32px 16px",
        borderRadius: 22,
        background: "#fff",
        boxShadow: PILLOW,
      }}
    >
      <p style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>
        {emoji}
      </p>
      <p style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{title}</p>
      <p style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{subtitle}</p>
    </div>
  );
}

function ChildCard({
  summary,
  isDesktop,
  busyType,
  onTap,
  onQuickLog,
  onUndo,
}: {
  summary: ChildSummary;
  isDesktop: boolean;
  busyType: DiaperType | null;
  onTap: () => void;
  onQuickLog: (type: DiaperType) => void;
  onUndo: () => void;
}) {
  const { child, lastEntry, todayCount, minsSince } = summary;
  const overdue = minsSince !== null && minsSince > 180;

  const surface = overdue
    ? "linear-gradient(135deg, #FFE0CC 0%, #FFF5EC 100%)"
    : lastEntry
    ? "linear-gradient(135deg, #ECF3FF 0%, #FAFCFF 100%)"
    : "linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)";
  const scribble = overdue ? PEACH : lastEntry ? SKY : NAVY;
  const ring = overdue ? PEACH : lastEntry ? SKY : "#CBD5E1";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        background: surface,
        boxShadow: PILLOW,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <DotScribbles color={scribble} />

      <button
        type="button"
        onClick={onTap}
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "transparent",
          border: "none",
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
        }}
        className="active:scale-[0.99] transition"
      >
        <CartoonAvatar
          name={child.name}
          size={48}
          ringColor={ring}
          ringWidth={3}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {child.name}
          </p>
          {lastEntry ? (
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: overdue ? "#92400E" : "#64748B",
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {DIAPER_TYPE_EMOJI[lastEntry.type]}{" "}
              {DIAPER_TYPE_LABEL[lastEntry.type]} · {sinceLabel(minsSince ?? 0)}
              {todayCount > 1 && ` · ${todayCount}×`}
            </p>
          ) : (
            <p
              style={{
                fontSize: 11,
                fontStyle: "italic",
                color: "#94A3B8",
                marginTop: 2,
              }}
            >
              Not logged yet today
            </p>
          )}
        </div>
        {lastEntry && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUndo();
            }}
            title="Undo last entry"
            aria-label="Undo last entry"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "#fff",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "inset 0 0 0 1px #CBD5E1",
              color: "#64748B",
            }}
            className="hover:text-edu-red"
          >
            <Undo2 size={14} strokeWidth={2.4} />
          </button>
        )}
      </button>

      {/* Desktop-only inline 5-tile quick log; mobile uses bottom-sheet */}
      {isDesktop && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          {DIAPER_TYPES.map((t) => (
            <QuickTile
              key={t}
              type={t}
              busy={busyType === t}
              compact
              onClick={() => onQuickLog(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickTile({
  type,
  busy,
  compact,
  onClick,
}: {
  type: DiaperType;
  busy: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const tt = TYPE_TONE[type];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={DIAPER_TYPE_LABEL[type]}
      style={{
        position: "relative",
        overflow: "hidden",
        height: compact ? 44 : 72,
        borderRadius: compact ? 12 : 18,
        background: tt.surface,
        border: "none",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.7 : 1,
        boxShadow: `inset 0 0 0 2px ${tt.bar}33, 0 4px 10px ${tt.tone}1f`,
        display: "flex",
        flexDirection: compact ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 0 : 4,
        padding: compact ? 4 : 6,
        transition: "transform 140ms ease",
      }}
      className="active:scale-95 hover:-translate-y-0.5"
    >
      {busy ? (
        <Loader2 size={compact ? 14 : 18} className="animate-spin" color={tt.tone} />
      ) : (
        <>
          <span
            style={{
              fontSize: compact ? 18 : 26,
              lineHeight: 1,
              transform: "rotate(-6deg)",
              display: "inline-block",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))",
            }}
            aria-hidden
          >
            {DIAPER_TYPE_EMOJI[type]}
          </span>
          {!compact && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: tt.tone,
                letterSpacing: "-0.1px",
              }}
            >
              {DIAPER_TYPE_LABEL[type]}
            </span>
          )}
        </>
      )}
    </button>
  );
}

function ChildActionSheet({
  summary,
  note,
  onNoteChange,
  busyType,
  onLog,
  onUndo,
  onClose,
}: {
  summary: ChildSummary;
  note: string;
  onNoteChange: (v: string) => void;
  busyType: DiaperType | null;
  onLog: (type: DiaperType) => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const { child, lastEntry, todayCount } = summary;
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
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "fade-in 200ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "92vh",
          overflowY: "auto",
          background:
            "linear-gradient(180deg, #F0F9FF 0%, #FFFFFF 28%, #FFFFFF 100%)",
          borderRadius: "28px 28px 0 0",
          boxShadow: "0 -20px 60px rgba(15,23,42,0.18)",
          animation: "slide-up 240ms cubic-bezier(.34,1.56,.64,1)",
          position: "relative",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Sticky header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background:
              "linear-gradient(180deg, rgba(240,249,255,0.95) 0%, rgba(255,255,255,0.85) 100%)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            padding: "10px 18px 12px",
            borderRadius: "28px 28px 0 0",
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 48,
              height: 5,
              borderRadius: 999,
              background: "#E2E8F0",
              margin: "0 auto 12px",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
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
              <CartoonAvatar name={child.name} size={48} ringColor={SKY} ringWidth={3} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    letterSpacing: "-0.3px",
                    color: NAVY,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {child.name}{" "}
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      transform: "rotate(-6deg)",
                      fontSize: 15,
                    }}
                  >
                    💧
                  </span>
                </h2>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginTop: 2 }}>
                  {todayCount} entries today
                </p>
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

        <div
          style={{
            padding: "12px 18px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {lastEntry && (
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 16,
                padding: "10px 12px",
                background: "#F8FAFC",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Clock size={14} color="#64748B" />
              <p style={{ fontSize: 11, color: "#0F172A", flex: 1, fontWeight: 500 }}>
                Last: {DIAPER_TYPE_EMOJI[lastEntry.type]}{" "}
                {DIAPER_TYPE_LABEL[lastEntry.type]} at {lastEntry.time}
                {lastEntry.note && ` · "${lastEntry.note}"`}
              </p>
              <button
                type="button"
                onClick={onUndo}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: RED,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Undo2 size={12} strokeWidth={2.6} />
                Undo
              </button>
            </div>
          )}

          <div>
            <FieldLabel emoji="⚡">Quick log</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {DIAPER_TYPES.map((t) => (
                <QuickTile
                  key={t}
                  type={t}
                  busy={busyType === t}
                  onClick={() => onLog(t)}
                />
              ))}
            </div>
          </div>

          <div>
            <FieldLabel emoji="📝">Note (optional)</FieldLabel>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Anything to flag for parent? (rash, leakage, discomfort)"
              rows={2}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 16,
                background: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 500,
                color: "#0F172A",
                outline: "none",
                resize: "none",
                boxShadow: PILLOW,
                fontFamily: "inherit",
                lineHeight: 1.55,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({
  emoji,
  children,
}: {
  emoji?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
      }}
    >
      {emoji && (
        <span
          aria-hidden
          style={{
            fontSize: 13,
            transform: "rotate(-6deg)",
            display: "inline-block",
          }}
        >
          {emoji}
        </span>
      )}
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
        {children}
      </p>
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
void BLUSH;
void LAV;
