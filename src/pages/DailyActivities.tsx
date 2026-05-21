import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Mic,
  Star,
  CheckCircle2,
  Cloud,
  Send,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import {
  usePPDailyActivities,
  type DailySlot,
} from "@/hooks/usePPDailyActivities";

export default function DailyActivities() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { data, loading, updateSlot, publishReport } = usePPDailyActivities(
    primaryClass?.id
  );
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (classLoading || loading) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading today's activities…</p>
      </div>
    );
  }

  if (!primaryClass || !data) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm font-bold text-edu-navy">No class assigned</p>
      </div>
    );
  }

  const slots = data.slots;
  const completed = slots.filter((s) => s.status === "done").length;
  const totalPhotos = slots.reduce(
    (acc, s) => acc + (s.photoURLs?.length || 0),
    0
  );
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
      toast.success("Slot completed");
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
    <div className="px-4 py-4 space-y-4 animate-fade-in pb-4">
      <div>
        <h1 className="text-xl font-black text-edu-navy">Daily Activities</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {primaryClass.name} · Tap any slot to log + add a photo.
        </p>
      </div>

      <Card className="bg-gradient-to-br from-edu-blue to-edu-navy text-white border-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/70 font-bold">
                Today's Progress
              </p>
              <p className="text-2xl font-black mt-0.5">
                {completed}/{slots.length}{" "}
                <span className="text-sm font-bold text-white/80">slots done</span>
              </p>
              <p className="text-[11px] text-white/70 mt-0.5">
                {totalPhotos} photos · ready for parent report
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-edu-yellow" />
            </div>
          </div>
          <div className="mt-3 h-2 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-edu-yellow transition-all duration-500"
              style={{ width: `${(completed / slots.length) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <ol className="relative space-y-2">
        <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-border" aria-hidden />
        {slots.map((slot) => (
          <li key={slot.id} className="relative pl-10">
            <span
              className={cn(
                "absolute left-0 top-2 w-9 h-9 rounded-full border-2 flex items-center justify-center bg-white z-10",
                slot.status === "done" && "border-edu-green",
                slot.status === "in_progress" && "border-edu-yellow",
                slot.status === "pending" && "border-border",
                slot.status === "skipped" && "border-border opacity-50"
              )}
            >
              {slot.status === "done" && <CheckCircle2 className="w-5 h-5 text-edu-green" />}
              {slot.status === "in_progress" && (
                <div className="w-2.5 h-2.5 bg-edu-yellow rounded-full animate-pulse" />
              )}
              {slot.status === "pending" && (
                <div className="w-2 h-2 bg-border rounded-full" />
              )}
              {slot.status === "skipped" && (
                <Cloud className="w-4 h-4 text-muted-foreground" />
              )}
            </span>
            <SlotCard
              slot={slot}
              onTap={() => slot.status !== "skipped" && startEdit(slot)}
            />
          </li>
        ))}
      </ol>

      <Card
        className={cn(
          "border-2",
          reportPublished
            ? "border-edu-green bg-edu-light-green/30"
            : completed >= 3
            ? "border-edu-yellow bg-edu-light-yellow/40"
            : "border-border bg-secondary/30"
        )}
      >
        <CardContent className="p-4">
          {reportPublished ? (
            <div className="flex items-center gap-3 text-edu-green">
              <CheckCircle2 className="w-6 h-6" />
              <div>
                <p className="text-sm font-bold">Report published 🎉</p>
                <p className="text-xs text-foreground/70">
                  Parents will receive a push notification.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-edu-navy">Today's Parent Report</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compiles {completed} completed slots + {totalPhotos} photos into a
                push for parents. (Cloud Function publishes a PDF asynchronously.)
              </p>
              <Button
                onClick={handlePublish}
                className="w-full mt-3"
                disabled={completed < 3 || saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {completed < 3
                  ? `Need at least 3 slots done (${completed}/3)`
                  : "Publish to parents"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end animate-fade-in"
          onClick={() => !saving && setEditingSlotId(null)}
        >
          <div
            className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-3" />
            <h3 className="text-base font-black text-edu-navy">{editing.title}</h3>
            <p className="text-[11px] text-muted-foreground mb-4">
              Planned {editing.plannedStart}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                  Note
                </label>
                <div className="relative mt-1">
                  <textarea
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    rows={3}
                    placeholder="What happened in this slot?"
                    className="w-full rounded-xl border border-input p-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-edu-navy resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => toast.message("Voice input — Phase 3")}
                    className="absolute right-2 bottom-2 w-9 h-9 rounded-full bg-edu-green text-white flex items-center justify-center"
                    title="Voice note (Phase 3)"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => toast.message("Photo capture — Phase 3")}
                >
                  <Camera className="w-4 h-4" />
                  Photo
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => toast.message("Highlight — Phase 3")}
                >
                  <Star className="w-4 h-4" />
                  Highlight
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="success" onClick={saveSlot} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Mark Done
                </Button>
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => {
                    const reason = prompt("Skip reason (e.g., 'rain', 'substitute')");
                    if (reason !== null) {
                      skipSlot(editing.id, reason || "skipped");
                      setEditingSlotId(null);
                    }
                  }}
                >
                  Skip slot
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SlotCard({ slot, onTap }: { slot: DailySlot; onTap: () => void }) {
  const photos = slot.photoURLs?.length || 0;
  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "w-full text-left rounded-2xl border bg-white p-3 shadow-sm active:scale-[0.98] transition-all",
        slot.status === "done" && "opacity-90",
        slot.status === "in_progress" && "ring-2 ring-edu-yellow ring-offset-1",
        slot.status === "skipped" && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">
            {slot.title}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{slot.plannedStart}</p>
        </div>
        {photos > 0 && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-edu-blue bg-edu-light-blue px-2 py-1 rounded-full shrink-0">
            <Camera className="w-3 h-3" />
            {photos}
          </div>
        )}
      </div>
      {slot.note && (
        <p className="text-[11px] text-foreground/70 mt-1.5 line-clamp-2 italic">
          "{slot.note}"
        </p>
      )}
      {slot.highlightedKids && slot.highlightedKids.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-edu-yellow font-bold">
          <Star className="w-3 h-3 fill-edu-yellow" />
          {slot.highlightedKids.join(", ")}
        </div>
      )}
      {slot.skipReason && (
        <p className="text-[10px] text-muted-foreground mt-1">Skipped: {slot.skipReason}</p>
      )}
    </button>
  );
}
