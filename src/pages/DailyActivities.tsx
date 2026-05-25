import { useEffect, useState } from "react";
import {
  Camera,
  Mic,
  Star,
  CheckCircle2,
  Cloud,
  Send,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  usePPDailyActivities,
  type DailySlot,
} from "@/hooks/usePPDailyActivities";

/* ═══════════════════════════════════════════════════════════════════════
   PRE-PRIMARY TEACHER · DAILY ACTIVITIES
   Storybook-sherbet slot timeline + parent-report publisher.
   Status-keyed sherbet surface, animated progress, mint publish CTA.
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

type SlotStatus = DailySlot["status"];

const STATUS_TONE: Record<
  SlotStatus,
  { tone: string; surface: string; emoji: string; label: string }
> = {
  done: {
    tone: MINT,
    surface: "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)",
    emoji: "✅",
    label: "Done",
  },
  in_progress: {
    tone: BUTTER,
    surface: "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)",
    emoji: "⏳",
    label: "In progress",
  },
  pending: {
    tone: SKY,
    surface: "linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)",
    emoji: "⌛",
    label: "Pending",
  },
  skipped: {
    tone: "#94A3B8",
    surface: "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)",
    emoji: "☁️",
    label: "Skipped",
  },
};

export default function DailyActivities() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { data, loading, updateSlot, publishReport } = usePPDailyActivities(
    primaryClass?.id
  );
  const isDesktop = useIsDesktop();
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingSlotId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editingSlotId]);

  if (classLoading || loading) return <CenteredLoader label="Loading today's activities…" />;

  if (!primaryClass || !data) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          🌱 No class assigned
        </p>
      </div>
    );
  }

  const slots = data.slots;
  const total = slots.length || 1;
  const completed = slots.filter((s) => s.status === "done").length;
  const pending = slots.filter((s) => s.status === "pending").length;
  const skipped = slots.filter((s) => s.status === "skipped").length;
  const totalPhotos = slots.reduce(
    (acc, s) => acc + (s.photoURLs?.length || 0),
    0
  );
  const progressPct = (completed / total) * 100;
  const reportPublished =
    data.reportStatus === "published" || data.reportStatus === "auto_published";

  const startEdit = (slot: DailySlot) => {
    setEditingSlotId(slot.id);
    setDraftNote(slot.note ?? "");
  };

  const saveSlot = async () => {
    if (!editingSlotId) return;
    setSaving(true);
    try {
      await updateSlot(editingSlotId, {
        status: "done",
        note: draftNote || undefined,
        completedAt: new Date().toISOString(),
      });
      setEditingSlotId(null);
      setDraftNote("");
      toast.success("Slot completed ✓");
    } catch (err) {
      console.error("[DailyActivities] save slot failed:", err);
      toast.error("Could not save. Check permissions & try again.");
    } finally {
      setSaving(false);
    }
  };

  const skipSlot = async (slotId: string, reason: string) => {
    setSaving(true);
    try {
      await updateSlot(slotId, { status: "skipped", skipReason: reason });
      toast.message(`Skipped — ${reason}`);
    } catch (err) {
      console.error("[DailyActivities] skip failed:", err);
      toast.error("Could not save skip.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      await publishReport();
      toast.success("Daily report sent to all parents 🎉");
    } catch (err) {
      console.error("[DailyActivities] publish failed:", err);
      toast.error("Could not publish. Check permissions & try again.");
    } finally {
      setSaving(false);
    }
  };

  const editing = editingSlotId ? slots.find((s) => s.id === editingSlotId) : null;

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
              🎨
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
                Today's flow
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
                Daily Activities{" "}
                <span
                  aria-hidden
                  style={{ display: "inline-block", transform: "rotate(6deg)" }}
                >
                  ✨
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
                any slot to log + add a photo
              </p>
            </div>
          </div>
        </div>

        {/* Progress hero card */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 22,
            padding: 18,
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
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: MINT,
                  opacity: 0.85,
                }}
              >
                Today's progress
              </p>
              <p
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: "-1px",
                  color: NAVY,
                  marginTop: 4,
                  lineHeight: 1,
                }}
              >
                {completed}/{slots.length}{" "}
                <span style={{ fontSize: 14, fontWeight: 700, color: "#64748B" }}>
                  slots done
                </span>
              </p>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#64748B",
                  marginTop: 4,
                }}
              >
                📸 {totalPhotos} {totalPhotos === 1 ? "photo" : "photos"} captured today
              </p>
            </div>
            <span
              aria-hidden
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${BUTTER}, ${PEACH})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                boxShadow: `0 10px 22px ${BUTTER}55`,
                transform: "rotate(-8deg)",
                flexShrink: 0,
              }}
            >
              ✨
            </span>
          </div>
          {/* Progress bar */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              marginTop: 14,
              height: 12,
              borderRadius: 999,
              background: "rgba(15,23,42,0.06)",
              overflow: "hidden",
              boxShadow: "inset 0 1px 2px rgba(15,23,42,0.08)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${MINT}, #059669)`,
                borderRadius: 999,
                transition: "width 500ms cubic-bezier(.34,1.56,.64,1)",
                boxShadow: `0 0 12px ${MINT}66`,
              }}
            />
          </div>
        </div>

        {/* 4-stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <CounterCard
            label="Done"
            value={completed}
            emoji="✅"
            tone={MINT}
            surface="linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
          />
          <CounterCard
            label="Pending"
            value={pending}
            emoji="⌛"
            tone={pending > 0 ? SKY : "#94A3B8"}
            surface={
              pending > 0
                ? "linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
                : "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)"
            }
          />
          <CounterCard
            label="Skipped"
            value={skipped}
            emoji="☁️"
            tone={skipped > 0 ? "#94A3B8" : MINT}
            surface={
              skipped > 0
                ? "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)"
                : "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
            }
          />
          <CounterCard
            label="Photos"
            value={totalPhotos}
            emoji="📸"
            tone={totalPhotos > 0 ? BLUSH : "#94A3B8"}
            surface={
              totalPhotos > 0
                ? "linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)"
                : "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)"
            }
          />
        </div>

        {/* Slot timeline */}
        <ol
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 0,
            margin: 0,
            listStyle: "none",
          }}
        >
          {/* Vertical line */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 22,
              top: 14,
              bottom: 14,
              width: 2,
              background:
                "linear-gradient(to bottom, rgba(15,23,42,0.10) 0%, rgba(15,23,42,0.04) 100%)",
              borderRadius: 999,
              pointerEvents: "none",
            }}
          />
          {slots.map((slot) => (
            <li
              key={slot.id}
              style={{ position: "relative", paddingLeft: 56 }}
            >
              {/* Status node */}
              <StatusNode status={slot.status} />
              <SlotCard
                slot={slot}
                onTap={() => slot.status !== "skipped" && startEdit(slot)}
                isDesktop={isDesktop}
              />
            </li>
          ))}
        </ol>

        {/* Publish report */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 22,
            padding: 16,
            background: reportPublished
              ? "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
              : completed >= 3
              ? "linear-gradient(135deg, #FFEBC8 0%, #FFF7E5 100%)"
              : "linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)",
            boxShadow: PILLOW,
          }}
        >
          <DotScribbles
            color={reportPublished ? MINT : completed >= 3 ? BUTTER : "#94A3B8"}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            {reportPublished ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: `linear-gradient(135deg, ${MINT}, #059669)`,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 8px 18px ${MINT}55`,
                    transform: "rotate(-6deg)",
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  <CheckCircle2 size={22} strokeWidth={2.4} />
                </span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#047857" }}>
                    Report published 🎉
                  </p>
                  <p style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    Parents will receive a push notification.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
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
                    📨
                  </span>
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: completed >= 3 ? BUTTER : "#94A3B8",
                    }}
                  >
                    Today's Parent Report
                  </p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>
                  {completed} completed slot{completed === 1 ? "" : "s"} +{" "}
                  {totalPhotos} photo{totalPhotos === 1 ? "" : "s"} ready to ship
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "#64748B",
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  Cloud Function publishes a PDF asynchronously. Parents get a
                  push immediately.
                </p>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={completed < 3 || saving}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: "12px 16px",
                    borderRadius: 16,
                    background:
                      completed < 3 || saving
                        ? "#CBD5E1"
                        : `linear-gradient(135deg, ${MINT}, #059669)`,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: "-0.1px",
                    border: "none",
                    cursor: completed < 3 || saving ? "default" : "pointer",
                    boxShadow:
                      completed < 3 || saving
                        ? "none"
                        : `0 10px 24px -6px ${MINT}88`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                  className="active:scale-95 hover:-translate-y-0.5 transition"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} strokeWidth={2.4} />
                  )}
                  {completed < 3
                    ? `Need at least 3 slots done (${completed}/3)`
                    : "Publish to parents"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EditSheet
          slot={editing}
          draftNote={draftNote}
          setDraftNote={setDraftNote}
          saving={saving}
          onClose={() => !saving && setEditingSlotId(null)}
          onSave={saveSlot}
          onSkip={(reason) => {
            skipSlot(editing.id, reason);
            setEditingSlotId(null);
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
  emoji,
  tone,
  surface,
}: {
  label: string;
  value: number;
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
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "-1.2px",
            color: tone,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
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

function StatusNode({ status }: { status: SlotStatus }) {
  const st = STATUS_TONE[status];
  return (
    <span
      style={{
        position: "absolute",
        left: 0,
        top: 14,
        width: 44,
        height: 44,
        borderRadius: 999,
        background:
          status === "done"
            ? `linear-gradient(135deg, ${MINT}, #059669)`
            : status === "in_progress"
            ? `linear-gradient(135deg, ${BUTTER}, ${PEACH})`
            : "#fff",
        boxShadow:
          status === "done"
            ? `0 8px 18px -4px ${MINT}66`
            : status === "in_progress"
            ? `0 8px 18px -4px ${BUTTER}66`
            : `inset 0 0 0 2px ${st.tone}44, 0 4px 10px rgba(15,23,42,0.06)`,
        color: status === "done" || status === "in_progress" ? "#fff" : st.tone,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2,
        transform:
          status === "done" || status === "in_progress" ? "rotate(-6deg)" : "none",
      }}
      aria-hidden
    >
      {status === "done" && <CheckCircle2 size={20} strokeWidth={2.6} />}
      {status === "in_progress" && (
        <span
          style={{
            width: 10,
            height: 10,
            background: "#fff",
            borderRadius: 999,
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        />
      )}
      {status === "pending" && (
        <span
          style={{
            width: 8,
            height: 8,
            background: st.tone,
            opacity: 0.6,
            borderRadius: 999,
          }}
        />
      )}
      {status === "skipped" && <Cloud size={18} strokeWidth={2.4} />}
    </span>
  );
}

function SlotCard({
  slot,
  onTap,
  isDesktop,
}: {
  slot: DailySlot;
  onTap: () => void;
  isDesktop: boolean;
}) {
  const st = STATUS_TONE[slot.status];
  const photos = slot.photoURLs?.length || 0;

  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        width: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: 14,
        background: st.surface,
        boxShadow: PILLOW,
        borderLeft: `5px solid ${st.tone}`,
        textAlign: "left",
        border: "none",
        cursor: slot.status === "skipped" ? "default" : "pointer",
        opacity: slot.status === "skipped" ? 0.65 : 1,
        transition: "transform 140ms ease",
      }}
      className={
        slot.status === "skipped" ? "" : "active:scale-[0.99] hover:-translate-y-0.5"
      }
    >
      <DotScribbles color={st.tone} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: isDesktop ? 15 : 14,
                fontWeight: 800,
                color: NAVY,
                letterSpacing: "-0.2px",
                lineHeight: 1.2,
              }}
            >
              {slot.title}
            </p>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748B",
                marginTop: 3,
              }}
            >
              ⏰ {slot.plannedStart}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {photos > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  color: BLUSH,
                  background: "#fff",
                  padding: "3px 9px",
                  borderRadius: 999,
                  boxShadow: `inset 0 0 0 1px ${BLUSH}33`,
                }}
              >
                <Camera size={11} strokeWidth={2.6} />
                {photos}
              </span>
            )}
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                background: `linear-gradient(135deg, ${st.tone}, ${st.tone}cc)`,
                padding: "3px 8px",
                borderRadius: 999,
                boxShadow: `0 3px 8px ${st.tone}44`,
              }}
            >
              {st.emoji} {st.label}
            </span>
          </div>
        </div>

        {/* Note */}
        {slot.note && (
          <p
            style={{
              fontSize: 12,
              fontStyle: "italic",
              color: "#0F172A",
              opacity: 0.85,
              lineHeight: 1.5,
              marginTop: 8,
            }}
          >
            "{slot.note}"
          </p>
        )}

        {/* Highlighted kids */}
        {slot.highlightedKids && slot.highlightedKids.length > 0 && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 800,
              color: BUTTER,
              background: "#fff",
              padding: "4px 10px",
              borderRadius: 999,
              marginTop: 8,
              boxShadow: `inset 0 0 0 1px ${BUTTER}55`,
            }}
          >
            <Star size={11} strokeWidth={2.6} fill={BUTTER} />
            {slot.highlightedKids.join(", ")}
          </div>
        )}

        {/* Skip reason */}
        {slot.skipReason && (
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748B",
              marginTop: 6,
              fontStyle: "italic",
            }}
          >
            ☁️ Skipped: {slot.skipReason}
          </p>
        )}
      </div>
    </button>
  );
}

/* ═══════════════════════ Edit sheet ═══════════════════════ */

function EditSheet({
  slot,
  draftNote,
  setDraftNote,
  saving,
  onClose,
  onSave,
  onSkip,
}: {
  slot: DailySlot;
  draftNote: string;
  setDraftNote: (v: string) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onSkip: (reason: string) => void;
}) {
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
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: SKY,
                  opacity: 0.85,
                }}
              >
                Slot · ⏰ {slot.plannedStart}
              </p>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: "-0.3px",
                  color: NAVY,
                  marginTop: 2,
                }}
              >
                {slot.title}{" "}
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    transform: "rotate(-6deg)",
                    fontSize: 15,
                  }}
                >
                  🎨
                </span>
              </h3>
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
          {/* Note */}
          <div>
            <FieldLabel emoji="📝">Note</FieldLabel>
            <div style={{ position: "relative" }}>
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                rows={3}
                placeholder="What happened in this slot?"
                style={{
                  width: "100%",
                  padding: "12px 50px 12px 14px",
                  borderRadius: 16,
                  background: "#fff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#0F172A",
                  outline: "none",
                  resize: "none",
                  boxShadow: PILLOW,
                  fontFamily: "inherit",
                  lineHeight: 1.55,
                }}
              />
              <button
                type="button"
                onClick={() => toast.message("Voice input — coming in Phase 3")}
                title="Voice note (Phase 3)"
                style={{
                  position: "absolute",
                  right: 8,
                  bottom: 8,
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: `linear-gradient(135deg, ${MINT}, #059669)`,
                  color: "#fff",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: `0 6px 14px ${MINT}55`,
                  transform: "rotate(-6deg)",
                }}
              >
                <Mic size={15} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {/* Photo + Highlight placeholders */}
          <div style={{ display: "flex", gap: 8 }}>
            <SecondaryPillow
              icon={<Camera size={14} strokeWidth={2.6} />}
              label="Photo"
              tone={BLUSH}
              onClick={() => toast.message("Photo capture — coming in Phase 3")}
            />
            <SecondaryPillow
              icon={<Star size={14} strokeWidth={2.6} />}
              label="Highlight"
              tone={BUTTER}
              onClick={() => toast.message("Highlight — coming in Phase 3")}
            />
          </div>

          {/* Save + Skip */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              style={{
                padding: "12px 16px",
                borderRadius: 16,
                background: saving
                  ? "#CBD5E1"
                  : `linear-gradient(135deg, ${MINT}, #059669)`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                border: "none",
                cursor: saving ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                boxShadow: saving ? "none" : `0 10px 24px -6px ${MINT}88`,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} strokeWidth={2.6} />
              )}
              Mark Done
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                const reason = prompt(
                  "Skip reason (e.g., 'rain', 'substitute')"
                );
                if (reason !== null) {
                  onSkip(reason || "skipped");
                }
              }}
              style={{
                padding: "12px 16px",
                borderRadius: 16,
                background: "#fff",
                color: "#64748B",
                fontSize: 12,
                fontWeight: 800,
                border: "none",
                cursor: saving ? "default" : "pointer",
                boxShadow: PILLOW,
                opacity: saving ? 0.6 : 1,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              ☁️ Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryPillow({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 12px",
        borderRadius: 14,
        background: "#fff",
        color: tone,
        fontSize: 12,
        fontWeight: 800,
        border: "none",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        boxShadow: `inset 0 0 0 1px ${tone}55, 0 4px 10px ${tone}1f`,
      }}
      className="active:scale-95 hover:-translate-y-0.5 transition"
    >
      {icon}
      {label}
    </button>
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

// Palette constants reserved for future variants.
void LAV;
void RED;
