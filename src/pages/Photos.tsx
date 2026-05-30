/**
 * Photos.tsx — Pre-primary Photo Studio (teacher). Cartoonified 2026-05-25.
 *
 * Teacher captures or uploads photos. Each upload tags selected children
 * from roster, optionally attaches to active slot, streams to Storage with
 * per-file progress, and creates pp_photos docs the parent Gallery
 * subscribes to.
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
  Tag,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { usePPDailyActivities } from "@/hooks/usePPDailyActivities";
import { usePPPhotos, type UploadProgress } from "@/hooks/usePPPhotos";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { CartoonAvatar } from "@/components/CartoonAvatar";

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

  const activeSlot = useMemo(() => {
    const slots = activities?.slots || [];
    return slots.find((s) => s.status === "in_progress") || null;
  }, [activities]);

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

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (classLoading) return <CenteredLoader label="Resolving your class…" />;
  if (!primaryClass) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
          🌱 No class assigned
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

  // Children whose parent turned OFF photo sharing — they cannot be tagged and
  // never surface in the parent gallery. Opt-out model: explicit false denies.
  const noConsentKids = useMemo(
    () => roster.filter((c) => c.photoConsent === false),
    [roster]
  );

  const toggleTag = (id: string) => {
    const child = roster.find((c) => c.id === id);
    if (child?.photoConsent === false) {
      toast.error(
        `${child.name.split(" ")[0]}'s parent turned off photo sharing — can't tag.`
      );
      return;
    }
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
    // Defensive: never persist a tag for a child whose consent is denied, even
    // if the id somehow slipped into the selection.
    const taggedChildren = roster
      .filter((c) => taggedIds.has(c.id) && c.photoConsent !== false)
      .map((c) => ({ id: c.id, name: c.name }));

    try {
      // Capture the final progress array returned by the hook — using the
      // local `progress` state here was a stale-closure bug: it always
      // held the initial (empty) value because the state-setter was
      // batched, so `failed === 0` evaluated true even when the actual
      // Firestore addDoc threw silently. The founder saw "uploaded"
      // toasts for writes that never made it to the collection, which
      // hid the real "permission-denied / index-missing / undefined-field"
      // root causes for days. (2026-05-26 fix.)
      const finalProgress = await uploadPhotos({
        files: previews.map((p) => p.file),
        taggedStudents: taggedChildren,
        slotId: attachToSlot && activeSlot ? activeSlot.id : undefined,
        slotTitle: attachToSlot && activeSlot ? activeSlot.title : undefined,
        caption: caption.trim() || undefined,
        onProgress: (p) => setProgress(p),
      });

      const ok = finalProgress.filter((p) => p.status === "done").length;
      const failed = finalProgress.filter((p) => p.status === "error").length;
      const firstError = finalProgress.find((p) => p.status === "error")?.error;

      if (failed === 0 && ok > 0) {
        toast.success(
          `${ok} photo${ok === 1 ? "" : "s"} uploaded · parents will see them live ✓`
        );
      } else if (ok > 0 && failed > 0) {
        toast.warning(
          `${ok} uploaded, ${failed} failed${firstError ? `: ${firstError.slice(0, 120)}` : "."}`
        );
      } else {
        // All uploads failed — surface the real reason instead of the
        // misleading "uploaded" success toast.
        toast.error(
          firstError
            ? `Upload failed: ${firstError.slice(0, 200)}`
            : `Upload failed — check console for details.`
        );
      }

      // Only reset the form when at least one file landed; otherwise the
      // founder loses their tag selections and would have to redo the
      // tagging UX before retrying.
      if (ok > 0) {
        previews.forEach((p) => URL.revokeObjectURL(p.url));
        setPreviews([]);
        setTaggedIds(new Set());
        setCaption("");
        setProgress([]);
      }
    } catch (err) {
      console.error("[Photos] upload error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Upload failed: ${msg.slice(0, 200)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!window.confirm("Delete this photo? Parents will stop seeing it."))
      return;
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

  const previewCols = isDesktop ? "repeat(6, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))";
  const photoCols = isDesktop ? "repeat(5, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))";

  return (
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
            "linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 55%, #FFFFFF 100%)",
          boxShadow: PILLOW,
        }}
      >
        <DotScribbles color={BLUSH} dense />
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
              background: `linear-gradient(135deg, ${BLUSH}, #DB2777)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: `0 8px 18px ${BLUSH}55`,
              transform: "rotate(-8deg)",
              flexShrink: 0,
            }}
            aria-hidden
          >
            📸
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: BLUSH,
                opacity: 0.9,
              }}
            >
              Moments of the day
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
              Photo Studio{" "}
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
              {primaryClass.name} · {format(new Date(), "EEEE, d MMM")} ·
              Capture + tag — parents see them live
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
          label="Photos"
          value={stats.total}
          emoji="📸"
          tone={BLUSH}
          surface="linear-gradient(135deg, #FFE0EC 0%, #FFF4F8 100%)"
        />
        <CounterCardFraction
          label="Kids in photos"
          value={stats.taggedKids}
          total={stats.rosterSize}
          emoji="👶"
          tone={SKY}
          surface="linear-gradient(135deg, #DCEEFF 0%, #F5FAFF 100%)"
        />
        <CounterCardText
          label="Active slot"
          value={activeSlot ? "🟢 Live" : "—"}
          sub={activeSlot?.title}
          tone={activeSlot ? MINT : "#94A3B8"}
          surface={
            activeSlot
              ? "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
              : "linear-gradient(135deg, #F1F5F9 0%, #FFFFFF 100%)"
          }
        />
      </div>

      {/* Uploader card */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 22,
          padding: 16,
          background: "#fff",
          boxShadow: PILLOW,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
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
          style={{ display: "none" }}
          onChange={(e) => {
            handleFilesPicked(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Big CTA tiles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <CTATile
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            emoji="📷"
            label="Camera"
            tone={BLUSH}
            gradient={`linear-gradient(135deg, ${BLUSH}, #DB2777)`}
          />
          <CTATile
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploading}
            emoji="🖼️"
            label="From Gallery"
            tone={SKY}
            gradient={`linear-gradient(135deg, ${SKY}, #0284C7)`}
          />
        </div>

        {/* Previews + tag + caption + upload */}
        {previews.length > 0 && (
          <>
            <div style={{ borderTop: "1px dashed rgba(15,23,42,0.12)", paddingTop: 14 }}>
              <FieldLabel emoji="🎞️">
                Selected · {previews.length}
              </FieldLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: previewCols,
                  gap: 8,
                }}
              >
                {previews.map((p, i) => (
                  <PreviewTile
                    key={p.url}
                    src={p.url}
                    alt={`Preview ${i + 1}`}
                    canRemove={!uploading}
                    onRemove={() => removePreview(i)}
                    progress={progress[i]}
                  />
                ))}
              </div>
            </div>

            {/* Tag children */}
            <div style={{ borderTop: "1px dashed rgba(15,23,42,0.12)", paddingTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <FieldLabel emoji="🏷️">Tag children in these photos</FieldLabel>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: BLUSH,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: `${BLUSH}1f`,
                  }}
                >
                  {taggedIds.size} selected
                </span>
              </div>
              {noConsentKids.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "linear-gradient(135deg, #FFE4E4 0%, #FFF1F1 100%)",
                    boxShadow: `inset 0 0 0 1px ${RED}33`,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }} aria-hidden>
                    🔒
                  </span>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#B91C1C", lineHeight: 1.5 }}>
                    <strong style={{ fontWeight: 800 }}>
                      No photo consent ({noConsentKids.length}):
                    </strong>{" "}
                    {noConsentKids.map((c) => c.name.split(" ")[0]).join(", ")}. Please
                    avoid photographing them — they can't be tagged or shared.
                  </p>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  maxHeight: 200,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {rosterLoading ? (
                  <p style={{ fontSize: 12, color: "#64748B" }}>Loading roster…</p>
                ) : (
                  roster.map((child) => (
                    <TagChip
                      key={child.id}
                      child={child}
                      selected={taggedIds.has(child.id)}
                      locked={child.photoConsent === false}
                      onToggle={() => toggleTag(child.id)}
                      disabled={uploading}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Attach to slot */}
            {activeSlot && (
              <label
                style={{
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderRadius: 16,
                  background: attachToSlot
                    ? "linear-gradient(135deg, #D6F5E2 0%, #F1FBF5 100%)"
                    : "#F8FAFC",
                  boxShadow: attachToSlot
                    ? `inset 0 0 0 2px ${MINT}, ${PILLOW}`
                    : "inset 0 0 0 1px #E2E8F0",
                  cursor: "pointer",
                }}
              >
                {attachToSlot && <DotScribbles color={MINT} />}
                <input
                  type="checkbox"
                  checked={attachToSlot}
                  onChange={(e) => setAttachToSlot(e.target.checked)}
                  disabled={uploading}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: MINT,
                    cursor: "pointer",
                    position: "relative",
                    zIndex: 1,
                  }}
                />
                <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: attachToSlot ? "#047857" : NAVY,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    🎨 Attach to current activity
                  </p>
                  <p
                    style={{
                      fontSize: 10,
                      color: "#64748B",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {activeSlot.title} · in progress
                  </p>
                </div>
              </label>
            )}

            {/* Caption */}
            <PillowInput
              value={caption}
              onChange={setCaption}
              placeholder="Caption (optional)"
              disabled={uploading}
              maxLength={200}
            />

            {/* Upload pillow */}
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: 18,
                background: uploading
                  ? "#CBD5E1"
                  : `linear-gradient(135deg, ${BLUSH}, #DB2777)`,
                color: "#fff",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "-0.1px",
                border: "none",
                cursor: uploading ? "default" : "pointer",
                boxShadow: uploading ? "none" : `0 12px 28px -8px ${BLUSH}88`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
              className="active:scale-95 hover:-translate-y-0.5 transition"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading {previews.length}…
                </>
              ) : (
                <>
                  <Upload size={16} strokeWidth={2.4} />
                  Upload {previews.length} photo
                  {previews.length === 1 ? "" : "s"}
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Today's photos */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
            paddingLeft: 4,
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
            🎞️
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
            Today's photos
          </p>
        </div>

        {photosLoading ? (
          <CenteredLoader label="" />
        ) : photos.length === 0 ? (
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
              📷
            </p>
            <p style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>
              No photos yet
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#64748B",
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              Capture moments from today — parents will see them in their app live.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: photoCols,
              gap: 8,
            }}
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
          onClick={() => setFullscreenPhoto(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fade-in 200ms ease-out",
          }}
        >
          <button
            type="button"
            onClick={() => setFullscreenPhoto(null)}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 44,
              height: 44,
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <X size={20} />
          </button>
          <img
            src={fullscreenPhoto}
            alt="Full screen"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ building blocks ═══════════════════════ */

function CenteredLoader({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "32px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        color: "#64748B",
      }}
    >
      <Loader2 className="animate-spin" />
      {label && <p style={{ fontSize: 12, fontWeight: 600 }}>{label}</p>}
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

function CounterCardFraction({
  label,
  value,
  total,
  emoji,
  tone,
  surface,
}: {
  label: string;
  value: number;
  total: number;
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
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: tone,
              opacity: 0.55,
            }}
          >
            /{total || "—"}
          </span>
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

function CounterCardText({
  label,
  value,
  sub,
  tone,
  surface,
}: {
  label: string;
  value: string;
  sub?: string;
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
      <p
        style={{
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: "-0.4px",
          color: tone,
          lineHeight: 1.2,
          position: "relative",
          zIndex: 1,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: tone,
          opacity: 0.75,
          marginTop: 4,
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
            color: "#64748B",
            marginTop: 2,
            position: "relative",
            zIndex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function CTATile({
  onClick,
  disabled,
  emoji,
  label,
  tone,
  gradient,
}: {
  onClick: () => void;
  disabled: boolean;
  emoji: string;
  label: string;
  tone: string;
  gradient: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "relative",
        overflow: "hidden",
        height: 72,
        borderRadius: 18,
        background: gradient,
        color: "#fff",
        fontSize: 14,
        fontWeight: 800,
        border: "none",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        boxShadow: `0 12px 28px -8px ${tone}88`,
        transition: "transform 140ms ease",
      }}
      className="active:scale-95 hover:-translate-y-0.5"
    >
      <span
        style={{
          fontSize: 26,
          transform: "rotate(-8deg)",
          display: "inline-block",
          filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.2))",
        }}
        aria-hidden
      >
        {emoji}
      </span>
      {label}
    </button>
  );
}

function PreviewTile({
  src,
  alt,
  canRemove,
  onRemove,
  progress,
}: {
  src: string;
  alt: string;
  canRemove: boolean;
  onRemove: () => void;
  progress?: UploadProgress;
}) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: 14,
        overflow: "hidden",
        background: "#F1F5F9",
        boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.08)",
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${alt}`}
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 24,
            height: 24,
            borderRadius: 999,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X size={12} strokeWidth={2.6} />
        </button>
      )}
      {progress && progress.status !== "pending" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 6,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)",
          }}
        >
          {progress.status === "done" ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                color: "#fff",
                background: MINT,
                padding: "3px 8px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                boxShadow: `0 4px 10px ${MINT}55`,
              }}
            >
              <CheckCircle2 size={11} strokeWidth={3} />
              Done
            </span>
          ) : progress.status === "error" ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                color: "#fff",
                background: RED,
                padding: "3px 8px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <AlertTriangle size={11} strokeWidth={2.6} />
              Failed
            </span>
          ) : (
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                color: "#fff",
                background: "rgba(0,0,0,0.6)",
                padding: "3px 8px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Loader2 size={11} className="animate-spin" />
              {progress.progress}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TagChip({
  child,
  selected,
  locked = false,
  onToggle,
  disabled,
}: {
  child: RosterChild;
  selected: boolean;
  locked?: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  // Locked = parent denied photo consent. Chip still renders (so the teacher
  // knows the child exists) but is visibly struck-through with a lock and
  // cannot be selected.
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={locked ? "Photo sharing turned off by parent" : undefined}
      aria-disabled={locked}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px 3px 3px",
        borderRadius: 999,
        background: locked
          ? "#F1F5F9"
          : selected
          ? `linear-gradient(135deg, ${BLUSH}, #DB2777)`
          : "#fff",
        color: locked ? "#94A3B8" : selected ? "#fff" : NAVY,
        border: "none",
        cursor: disabled ? "default" : locked ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : locked ? 0.7 : 1,
        fontSize: 12,
        fontWeight: 800,
        textDecoration: locked ? "line-through" : "none",
        boxShadow: locked
          ? `inset 0 0 0 1px ${RED}33`
          : selected
          ? `0 6px 14px -4px ${BLUSH}66`
          : "inset 0 0 0 1px #CBD5E1, 0 2px 6px rgba(15,23,42,0.04)",
        transition: "transform 140ms ease",
      }}
      className={locked ? "" : "active:scale-95 hover:-translate-y-0.5"}
    >
      <span style={{ flexShrink: 0, position: "relative" }}>
        <CartoonAvatar
          name={child.name}
          size={26}
          ringColor={locked ? "#CBD5E1" : selected ? "#fff" : BLUSH}
          ringWidth={2}
        />
      </span>
      {child.name.split(" ")[0]}
      {locked ? (
        <span style={{ fontSize: 11 }} aria-hidden>🔒</span>
      ) : (
        selected && <CheckCircle2 size={12} strokeWidth={3} />
      )}
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
    <div
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: 18,
        overflow: "hidden",
        background: "#F1F5F9",
        boxShadow: PILLOW,
      }}
      className="group"
    >
      <img
        src={photo.storageUrl}
        alt={photo.caption || "Photo"}
        loading="lazy"
        onClick={onView}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          cursor: "pointer",
          transition: "transform 240ms ease",
        }}
        className="hover:scale-105"
      />
      {/* Tagged badge */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)",
          display: "flex",
          alignItems: "flex-end",
          padding: 8,
          pointerEvents: "none",
        }}
      >
        {photo.taggedStudentIds.length > 0 ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Tag size={11} strokeWidth={2.6} />
            {photo.taggedStudentIds.length} tagged
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
            Untagged
          </span>
        )}
      </div>
      {/* Delete button */}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete photo"
        title="Delete"
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          width: 30,
          height: 30,
          borderRadius: 999,
          background: "rgba(0,0,0,0.65)",
          color: "#fff",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          opacity: 0,
          transition: "opacity 160ms ease, transform 140ms ease",
        }}
        className="group-hover:opacity-100 active:scale-90"
      >
        <Trash2 size={14} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function PillowInput({
  value,
  onChange,
  placeholder,
  maxLength,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 16,
        background: "#fff",
        border: "none",
        fontSize: 13,
        fontWeight: 600,
        color: "#0F172A",
        outline: "none",
        boxShadow: "inset 0 0 0 1px #E2E8F0",
        opacity: disabled ? 0.6 : 1,
      }}
    />
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
void PEACH;
void LAV;
void BUTTER;
void Camera;
void ImageIcon;
