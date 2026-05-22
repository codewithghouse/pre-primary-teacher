/**
 * Photos.tsx — Pre-primary Photo Studio (teacher).
 *
 * Teacher captures or uploads photos throughout the day. Each upload:
 *   1. Lets the teacher pick files (camera OR device gallery, multi-select)
 *   2. Opens a tag dialog — teacher selects which children are in the photo
 *      from the class roster
 *   3. Auto-attaches to the in-progress slot from Daily Activities (so the
 *      photo appears in that slot's photo strip)
 *   4. Streams to Firebase Storage with per-file progress
 *   5. Creates pp_photos Firestore docs that pre-parent-dashboard's Gallery
 *      subscribes to
 *
 * Distinct mobile + desktop layouts per project policy.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Image as ImageIcon,
  Upload,
  X,
  CheckCircle2,
  Loader2,
  Trash2,
  Sparkles,
  Users,
  Tag,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { usePPDailyActivities } from "@/hooks/usePPDailyActivities";
import { usePPPhotos, type UploadProgress } from "@/hooks/usePPPhotos";
import { useIsDesktop } from "@/hooks/useIsDesktop";

interface PreviewItem {
  file: File;
  url: string;
}

export default function Photos() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const { data: activities } = usePPDailyActivities(primaryClass?.id);
  const { photos, loading: photosLoading, uploadPhotos, deletePhoto } =
    usePPPhotos(primaryClass?.id);
  const isDesktop = useIsDesktop();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState("");
  const [attachToSlot, setAttachToSlot] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // Auto-detect in-progress slot for slot-attach default.
  const activeSlot = useMemo(() => {
    const slots = activities?.slots || [];
    return slots.find((s) => s.status === "in_progress") || null;
  }, [activities]);

  // Stats — MUST live above early returns or React throws
  // "Rendered more hooks than during the previous render" when classLoading
  // flips from true → false.
  const stats = useMemo(() => {
    const taggedCount = new Set(
      photos.flatMap((p) => p.taggedStudentIds)
    ).size;
    return {
      total: photos.length,
      taggedKids: taggedCount,
      rosterSize: roster.length,
    };
  }, [photos, roster]);

  // Revoke preview URLs on unmount / change
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (classLoading) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Resolving your class…</p>
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

  const handleFilesPicked = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const items: PreviewItem[] = [];
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      items.push({ file: f, url: URL.createObjectURL(f) });
    });
    if (items.length === 0) {
      toast.error("Only image files allowed");
      return;
    }
    setPreviews((prev) => [...prev, ...items]);
  };

  const removePreview = (idx: number) => {
    setPreviews((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].url);
      next.splice(idx, 1);
      return next;
    });
  };

  const toggleTag = (id: string) => {
    setTaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpload = async () => {
    if (previews.length === 0) {
      toast.error("Pick at least one photo");
      return;
    }
    if (taggedIds.size === 0) {
      if (
        !window.confirm(
          "No children tagged — parents won't be able to filter to their own child's photos. Continue anyway?"
        )
      ) {
        return;
      }
    }
    setUploading(true);
    const taggedChildren = roster
      .filter((c) => taggedIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name }));

    try {
      await uploadPhotos({
        files: previews.map((p) => p.file),
        taggedStudents: taggedChildren,
        slotId: attachToSlot && activeSlot ? activeSlot.id : undefined,
        slotTitle: attachToSlot && activeSlot ? activeSlot.title : undefined,
        caption: caption.trim() || undefined,
        onProgress: (p) => setProgress(p),
      });

      const ok = progress.filter((p) => p.status === "done").length;
      const failed = progress.filter((p) => p.status === "error").length;

      if (failed === 0) {
        toast.success(
          `${previews.length} photo${previews.length === 1 ? "" : "s"} uploaded · parents will see them live ✓`
        );
      } else {
        toast.warning(`${ok} uploaded, ${failed} failed. Check console.`);
      }

      // Reset state
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      setPreviews([]);
      setTaggedIds(new Set());
      setCaption("");
      setProgress([]);
    } catch (err) {
      console.error("[Photos] upload error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Upload failed: ${msg.slice(0, 200)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!window.confirm("Delete this photo? Parents will stop seeing it.")) return;
    try {
      const ph = photos.find((p) => p.id === photoId);
      if (!ph) return;
      await deletePhoto(ph);
      toast.success("Photo deleted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not delete: ${msg.slice(0, 120)}`);
    }
  };

  return (
    <div
      className={cn(
        "py-4 space-y-4 animate-fade-in",
        isDesktop ? "px-6 lg:px-10 max-w-7xl mx-auto" : "px-4"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 pt-1">
        <div
          className={cn(
            "rounded-xl bg-edu-light-pink text-edu-pink flex items-center justify-center",
            isDesktop ? "w-10 h-10" : "w-9 h-9"
          )}
        >
          <Camera className={isDesktop ? "w-5 h-5" : "w-4 h-4"} />
        </div>
        <div>
          <h1
            className={cn(
              "font-black text-edu-navy leading-none",
              isDesktop ? "text-2xl" : "text-xl"
            )}
          >
            Photo Studio
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1 font-semibold flex items-center gap-1">
            <Users className="w-3 h-3" />
            {primaryClass.name} · {format(new Date(), "EEEE, d MMM")}
          </p>
        </div>
      </div>

      {/* Stats banner */}
      <div className="rounded-2xl bg-gradient-to-br from-edu-pink to-edu-navy text-white p-4 shadow-md">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/70 font-bold">
          <Sparkles className="w-3 h-3" /> Today
        </div>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <Stat label="Photos" value={stats.total} />
          <Stat
            label="Kids in photos"
            value={`${stats.taggedKids}/${stats.rosterSize || "—"}`}
          />
          <Stat
            label="Active slot"
            value={activeSlot ? "Live" : "—"}
            sub={activeSlot?.title}
          />
        </div>
      </div>

      {/* Uploader */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Hidden inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              handleFilesPicked(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFilesPicked(e.target.files);
              e.target.value = "";
            }}
          />

          {/* CTA buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="h-14 rounded-2xl bg-edu-navy text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
            >
              <Camera className="w-5 h-5" />
              Camera
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploading}
              className="h-14 rounded-2xl bg-edu-light-blue text-edu-blue font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
            >
              <ImageIcon className="w-5 h-5" />
              From Gallery
            </button>
          </div>

          {/* Previews */}
          {previews.length > 0 && (
            <>
              <div className="border-t border-border pt-3">
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
                  Selected · {previews.length}
                </p>
                <div
                  className={cn(
                    "grid gap-2",
                    isDesktop ? "grid-cols-6" : "grid-cols-3"
                  )}
                >
                  {previews.map((p, i) => (
                    <div
                      key={p.url}
                      className="relative aspect-square rounded-xl overflow-hidden bg-secondary"
                    >
                      <img
                        src={p.url}
                        alt={`Preview ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {!uploading && (
                        <button
                          type="button"
                          onClick={() => removePreview(i)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                          aria-label={`Remove ${p.file.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {progress[i] && progress[i].status !== "pending" && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white px-2 py-1 text-[10px] font-bold">
                          {progress[i].status === "done" ? (
                            <span className="flex items-center gap-1 text-edu-green">
                              <CheckCircle2 className="w-3 h-3" />
                              Done
                            </span>
                          ) : progress[i].status === "error" ? (
                            <span className="flex items-center gap-1 text-edu-red">
                              <AlertTriangle className="w-3 h-3" />
                              Failed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              {progress[i].progress}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tag children */}
              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Tag children in these photos
                  </p>
                  <p className="text-[10px] font-bold text-edu-blue">
                    {taggedIds.size} selected
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {rosterLoading ? (
                    <p className="text-xs text-muted-foreground">Loading roster…</p>
                  ) : (
                    roster.map((child) => (
                      <TagChip
                        key={child.id}
                        child={child}
                        selected={taggedIds.has(child.id)}
                        onToggle={() => toggleTag(child.id)}
                        disabled={uploading}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Auto-attach */}
              {activeSlot && (
                <label className="flex items-center gap-2 rounded-xl border border-edu-blue/30 bg-edu-light-blue/30 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attachToSlot}
                    onChange={(e) => setAttachToSlot(e.target.checked)}
                    disabled={uploading}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-edu-navy">
                      Attach to current activity
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {activeSlot.title} · in progress
                    </p>
                  </div>
                </label>
              )}

              {/* Caption */}
              <div>
                <Input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Caption (optional)"
                  disabled={uploading}
                  maxLength={200}
                />
              </div>

              {/* Upload button */}
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="w-full h-12 rounded-2xl bg-edu-navy text-white font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading {previews.length}…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload {previews.length} photo{previews.length === 1 ? "" : "s"}
                  </>
                )}
              </button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Today's photos */}
      <div>
        <p className="text-sm font-bold text-edu-navy mb-2 px-1">
          Today's photos
        </p>
        {photosLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
            </CardContent>
          </Card>
        ) : photos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-4xl mb-2">📷</p>
              <p className="text-sm font-bold text-edu-navy">No photos yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Capture moments from today — parents will see them in their app live.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div
            className={cn(
              "grid gap-2",
              isDesktop ? "grid-cols-5" : "grid-cols-3"
            )}
          >
            {photos.map((p) => (
              <PhotoCard
                key={p.id}
                photo={p}
                onView={() => setFullscreenPhoto(p.storageUrl)}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen viewer */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={() => setFullscreenPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setFullscreenPhoto(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={fullscreenPhoto}
            alt="Full screen"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-widest font-bold text-white/70 mt-1">
        {label}
      </p>
      {sub && (
        <p className="text-[10px] text-white/60 mt-0.5 truncate">{sub}</p>
      )}
    </div>
  );
}

function TagChip({
  child,
  selected,
  onToggle,
  disabled,
}: {
  child: RosterChild;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const initials = child.name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border-2 text-xs font-bold transition active:scale-95 disabled:opacity-50",
        selected
          ? "border-edu-navy bg-edu-navy text-white"
          : "border-border bg-white text-foreground hover:border-edu-navy/40"
      )}
    >
      <span
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black",
          selected ? "bg-white/20" : "bg-edu-light-blue text-edu-blue"
        )}
      >
        {initials}
      </span>
      {child.name.split(" ")[0]}
      {selected && <CheckCircle2 className="w-3.5 h-3.5" />}
    </button>
  );
}

function PhotoCard({
  photo,
  onView,
  onDelete,
}: {
  photo: ReturnType<typeof usePPPhotos>["photos"][number];
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative group rounded-xl overflow-hidden bg-secondary aspect-square">
      <img
        src={photo.storageUrl}
        alt={photo.caption || "Photo"}
        className="w-full h-full object-cover cursor-pointer"
        onClick={onView}
        loading="lazy"
      />

      {/* Overlay info */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white p-2 text-[10px] font-semibold pointer-events-none">
        {photo.taggedStudentIds.length > 0 ? (
          <span className="flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {photo.taggedStudentIds.length} tagged
          </span>
        ) : (
          <span className="opacity-70">Untagged</span>
        )}
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition flex items-center justify-center hover:bg-edu-red/80"
        aria-label="Delete photo"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
