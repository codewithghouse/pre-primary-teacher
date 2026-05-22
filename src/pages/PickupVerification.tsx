import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Clock,
  UserCheck,
  ShieldCheck,
  Search,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { usePPPickups, type PickupRecord } from "@/hooks/usePPPickups";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useAuth } from "@/lib/AuthContext";

export default function PickupVerification() {
  const { teacherData } = useAuth();
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const {
    data,
    loading: pickupLoading,
    verifyPickup,
  } = usePPPickups(primaryClass?.id);
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState("");
  const [verifyingFor, setVerifyingFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Body scroll lock when sheet is open (mobile)
  useEffect(() => {
    if (!verifyingFor) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [verifyingFor]);

  // Esc key closes
  useEffect(() => {
    if (!verifyingFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setVerifyingFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [verifyingFor, saving]);

  const records = data?.records || {};

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((c) => c.name.toLowerCase().includes(q));
  }, [roster, search]);

  const stats = useMemo(() => {
    const values = Object.values(records);
    return {
      verified: values.filter((r) => r.status === "verified").length,
      mismatch: values.filter((r) => r.status === "mismatch").length,
      pending:
        roster.length -
        values.filter((r) =>
          ["verified", "mismatch"].includes(r.status as string)
        ).length,
    };
  }, [records, roster.length]);

  const verifyChild = useMemo(
    () => roster.find((c) => c.id === verifyingFor) || null,
    [roster, verifyingFor]
  );

  // Diagnostic logs — helps surface schoolId/classId mismatches in DevTools.
  useEffect(() => {
    if (!primaryClass || !teacherData?.schoolId) return;
    console.log("[Pickup] class context", {
      classId: primaryClass.id,
      className: primaryClass.name,
      schoolId: teacherData.schoolId,
      teacherId: teacherData.id,
      teacherEmail: teacherData.email,
      rosterCount: roster.length,
      recordsCount: Object.keys(records).length,
    });
  }, [primaryClass, teacherData, roster.length, records]);

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

  if ((rosterLoading || pickupLoading) && roster.length === 0) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading pickup queue…</p>
      </div>
    );
  }

  const handleVerify = async (
    child: RosterChild,
    person: { name: string; relation: string }
  ) => {
    if (!teacherData?.id) return;
    setSaving(true);
    console.log("[Pickup] verifying", {
      child: child.name,
      person,
      classId: primaryClass.id,
    });
    try {
      const record: PickupRecord = {
        studentId: child.id,
        studentName: child.name,
        status: "verified",
        actualPickupPersonName: person.name,
        actualPickupPersonRelation: person.relation,
        verifiedAt: new Date().toISOString(),
        verifiedBy: teacherData.id,
      };
      await verifyPickup(record);
      setVerifyingFor(null);
      toast.success(
        `${child.name.split(" ")[0]} picked up by ${person.name} ✓`
      );
    } catch (err) {
      console.error("[Pickup] verify failed:", err);
      toast.error(
        "Could not save. " +
          ((err as Error)?.message || "Check permissions & try again.")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleMismatch = async (child: RosterChild, reason?: string) => {
    if (!teacherData?.id) return;
    if (
      !window.confirm(
        `🚨 ESCALATE? An unauthorized person attempting to pick up ${child.name}. This will alert the principal and block release.`
      )
    )
      return;
    setSaving(true);
    try {
      const record: PickupRecord = {
        studentId: child.id,
        studentName: child.name,
        status: "mismatch",
        mismatchReason: reason || "Unauthorized person attempted pickup",
        verifiedAt: new Date().toISOString(),
        verifiedBy: teacherData.id,
      };
      await verifyPickup(record);
      setVerifyingFor(null);
      toast.error(`🚨 ESCALATED for ${child.name}. Principal notified.`);
    } catch (err) {
      console.error("[Pickup] mismatch failed:", err);
      toast.error(
        "Could not escalate. " +
          ((err as Error)?.message || "Phone the principal directly!")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async (child: RosterChild) => {
    if (!teacherData?.id) return;
    if (
      !window.confirm(
        `Undo pickup verification for ${child.name}? This sets them back to pending.`
      )
    )
      return;
    try {
      const record: PickupRecord = {
        studentId: child.id,
        studentName: child.name,
        status: "pending",
      };
      await verifyPickup(record);
      toast.message(`Pickup reset for ${child.name.split(" ")[0]}`);
    } catch (err) {
      console.error("[Pickup] undo failed:", err);
      toast.error("Could not undo.");
    }
  };

  const header = (
    <div>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "rounded-xl bg-edu-light-green text-edu-green flex items-center justify-center",
            isDesktop ? "w-10 h-10" : "w-9 h-9"
          )}
        >
          <ShieldCheck className={isDesktop ? "w-5 h-5" : "w-4 h-4"} />
        </div>
        <div>
          <h1
            className={cn(
              "font-black text-edu-navy leading-none",
              isDesktop ? "text-2xl" : "text-xl"
            )}
          >
            Pickup Verification
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1 font-semibold">
            {primaryClass.name} · {format(new Date(), "EEEE, d MMM")}
          </p>
        </div>
      </div>
    </div>
  );

  const statsRow = (
    <div className="grid grid-cols-3 gap-2">
      <Counter
        label="Verified"
        value={stats.verified}
        color="text-edu-green"
        bg="bg-edu-light-green/40"
        icon={<CheckCircle2 className="w-3 h-3" />}
      />
      <Counter
        label="Pending"
        value={Math.max(0, stats.pending)}
        color="text-muted-foreground"
        bg="bg-secondary"
        icon={<Clock className="w-3 h-3" />}
      />
      <Counter
        label="Escalated"
        value={stats.mismatch}
        color="text-edu-red"
        bg="bg-edu-light-red/30"
        icon={<AlertTriangle className="w-3 h-3" />}
      />
    </div>
  );

  const searchBar = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder="Search a child…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-9"
      />
    </div>
  );

  const mismatchBanner = stats.mismatch > 0 && (
    <Card className="bg-edu-light-red border-edu-red animate-pulse">
      <CardContent className="p-3 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-edu-red shrink-0" />
        <p className="text-xs font-bold text-edu-red">
          {stats.mismatch} pickup mismatch{stats.mismatch > 1 ? "es" : ""} —
          principal alerted, children in safe area.
        </p>
      </CardContent>
    </Card>
  );

  const queue = filteredRoster.length === 0 ? (
    <Card>
      <CardContent className="p-6 text-center text-xs text-muted-foreground">
        {roster.length === 0 ? "No children in this class yet." : "No children match."}
      </CardContent>
    </Card>
  ) : (
    <div
      className={cn(
        "gap-2",
        isDesktop ? "grid grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-2"
      )}
    >
      {filteredRoster.map((c) => (
        <PickupCard
          key={c.id}
          child={c}
          record={records[c.id]}
          onTap={() => {
            console.log("[Pickup] tap", { childId: c.id, childName: c.name });
            setVerifyingFor(c.id);
          }}
          onUndo={() => handleUndo(c)}
        />
      ))}
    </div>
  );

  const body = isDesktop ? (
    <div className="px-6 lg:px-10 py-6 max-w-7xl mx-auto animate-fade-in space-y-5">
      {header}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">{statsRow}</div>
        <div>{searchBar}</div>
      </div>
      {mismatchBanner}
      {queue}
    </div>
  ) : (
    <div className="px-4 py-4 space-y-4 animate-fade-in">
      {header}
      {statsRow}
      {searchBar}
      {mismatchBanner}
      {queue}
    </div>
  );

  return (
    <>
      {body}
      {verifyChild && (
        <VerifySheet
          child={verifyChild}
          existingRecord={records[verifyChild.id]}
          onClose={() => !saving && setVerifyingFor(null)}
          onVerify={(person) => handleVerify(verifyChild, person)}
          onMismatch={(reason) => handleMismatch(verifyChild, reason)}
          saving={saving}
          isDesktop={isDesktop}
        />
      )}
    </>
  );
}

// ─── Pickup card (queue item) ──────────────────────────────────────────────
function PickupCard({
  child,
  record,
  onTap,
  onUndo,
}: {
  child: RosterChild;
  record: PickupRecord | undefined;
  onTap: () => void;
  onUndo: () => void;
}) {
  const status = record?.status || "pending";
  return (
    <div
      className={cn(
        "rounded-2xl border p-3 flex items-center gap-3 bg-white shadow-sm transition",
        status === "verified" && "border-edu-green bg-edu-light-green/30",
        status === "mismatch" && "border-edu-red bg-edu-light-red/30",
        status === "pending" && "border-border"
      )}
    >
      <button
        type="button"
        onClick={onTap}
        className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99] transition-transform"
      >
        {child.photoURL ? (
          <img
            src={child.photoURL}
            alt={child.name}
            className="w-12 h-12 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-edu-navy text-white flex items-center justify-center font-black shrink-0">
            {child.name
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{child.name}</p>
          {status === "verified" && record?.actualPickupPersonName ? (
            <p className="text-[11px] text-edu-green truncate">
              ✓ Picked up by {record.actualPickupPersonName}
              {record.actualPickupPersonRelation
                ? ` (${record.actualPickupPersonRelation})`
                : ""}
            </p>
          ) : status === "mismatch" ? (
            <p className="text-[11px] text-edu-red font-bold truncate">
              🚨 ESCALATED — principal alerted
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Tap to verify pickup
            </p>
          )}
        </div>
      </button>

      {status === "verified" && (
        <button
          type="button"
          onClick={onUndo}
          title="Undo verification"
          className="text-[10px] font-bold text-edu-blue hover:underline shrink-0 px-2"
        >
          Undo
        </button>
      )}
      {status === "verified" && (
        <CheckCircle2 className="w-5 h-5 text-edu-green shrink-0" />
      )}
      {status === "mismatch" && (
        <AlertTriangle className="w-5 h-5 text-edu-red shrink-0" />
      )}
    </div>
  );
}

// ─── Verify sheet (mobile bottom-sheet / desktop centred modal) ─────────────
function VerifySheet({
  child,
  existingRecord,
  onClose,
  onVerify,
  onMismatch,
  saving,
  isDesktop,
}: {
  child: RosterChild;
  existingRecord?: PickupRecord;
  onClose: () => void;
  onVerify: (person: { name: string; relation: string }) => void;
  onMismatch: (reason: string) => void;
  saving: boolean;
  isDesktop: boolean;
}) {
  const [mode, setMode] = useState<"verify" | "manual">("verify");
  const [manualName, setManualName] = useState("");
  const [manualRelation, setManualRelation] = useState("");
  const [mismatchReason, setMismatchReason] = useState("");

  const authorized = child.authorizedPickup || [];
  const alreadyVerified = existingRecord?.status === "verified";

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "bg-white shadow-2xl overflow-y-auto",
          "w-full max-w-md max-h-[92vh]",
          "rounded-t-3xl lg:rounded-2xl lg:max-w-lg",
          "animate-slide-up lg:animate-fade-in"
        )}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle (mobile) */}
        <div className="lg:hidden w-12 h-1.5 bg-border rounded-full mx-auto mt-2.5 mb-1" />

        {/* Header */}
        <div className="px-5 pt-3 pb-2 flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {child.photoURL ? (
              <img
                src={child.photoURL}
                alt={child.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-edu-navy text-white flex items-center justify-center font-black">
                {child.name
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-lg font-black text-edu-navy truncate">
                {child.name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Who is picking up?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {alreadyVerified && existingRecord && (
          <div className="mx-5 mt-2 rounded-xl bg-edu-light-green/40 border border-edu-green/40 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-edu-green" />
              <p className="text-xs font-bold text-edu-green">
                Already verified — {existingRecord.actualPickupPersonName}
                {existingRecord.actualPickupPersonRelation
                  ? ` (${existingRecord.actualPickupPersonRelation})`
                  : ""}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Re-verify only if pickup person has changed.
            </p>
          </div>
        )}

        {/* Mode toggle */}
        <div className="px-5 mt-4 flex bg-secondary rounded-xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setMode("verify")}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-bold transition",
              mode === "verify"
                ? "bg-white text-edu-navy shadow-sm"
                : "text-muted-foreground"
            )}
          >
            <UserCheck className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            Authorized
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-bold transition",
              mode === "manual"
                ? "bg-white text-edu-navy shadow-sm"
                : "text-muted-foreground"
            )}
          >
            <UserPlus className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            Manual Entry
          </button>
        </div>

        {/* AUTHORIZED LIST */}
        {mode === "verify" && (
          <div className="px-5 mt-3">
            {authorized.length > 0 ? (
              <div className="space-y-2">
                {authorized.map((p) => (
                  <button
                    key={`${p.name}-${p.relation}`}
                    type="button"
                    onClick={() => onVerify(p)}
                    disabled={saving}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-edu-green/30 hover:bg-edu-light-green/30 active:scale-[0.98] transition disabled:opacity-50"
                  >
                    {p.photoURL ? (
                      <img
                        src={p.photoURL}
                        alt={p.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-edu-green/20 flex items-center justify-center text-edu-green font-black">
                        {p.name
                          .split(" ")
                          .map((s) => s[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.relation}
                      </p>
                    </div>
                    {saving ? (
                      <Loader2 className="w-5 h-5 text-edu-green animate-spin" />
                    ) : (
                      <UserCheck className="w-5 h-5 text-edu-green" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <Card className="bg-edu-light-yellow border-edu-yellow">
                <CardContent className="p-3 text-xs">
                  <strong>No authorized pickup persons on file.</strong> Use
                  Manual Entry to record who picked up, or escalate if uncertain.
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* MANUAL ENTRY */}
        {mode === "manual" && (
          <div className="px-5 mt-3 space-y-3">
            <Card className="bg-edu-light-orange/30 border-edu-orange/30">
              <CardContent className="p-3 text-[11px] text-foreground/80">
                Use this only when the authorized list is missing or someone new
                is on the parent's verbal approval. <strong>Always escalate</strong>{" "}
                if uncertain.
              </CardContent>
            </Card>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1 block">
                Pickup person name
              </label>
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g. Anita Sharma"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1 block">
                Relation
              </label>
              <Input
                value={manualRelation}
                onChange={(e) => setManualRelation(e.target.value)}
                placeholder="e.g. Aunt, Driver, Family friend"
              />
            </div>
            <Button
              className="w-full"
              disabled={saving || !manualName.trim() || !manualRelation.trim()}
              onClick={() =>
                onVerify({
                  name: manualName.trim(),
                  relation: manualRelation.trim(),
                })
              }
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              )}
              Save pickup
            </Button>
          </div>
        )}

        {/* Escalate */}
        <div className="border-t border-border mt-5 px-5 pt-4 pb-5">
          <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
            Unauthorized person attempting pickup?
          </p>
          <Input
            placeholder="Optional: brief reason (e.g. unknown person, refused ID)"
            value={mismatchReason}
            onChange={(e) => setMismatchReason(e.target.value)}
            className="mb-2 text-xs"
          />
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => onMismatch(mismatchReason.trim())}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <ShieldAlert className="w-4 h-4 mr-1.5" />
            )}
            Escalate — block release & alert principal
          </Button>
        </div>
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  color,
  bg,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className={cn("p-3 text-center rounded-xl", bg)}>
        <p className={cn("text-2xl font-black leading-none", color)}>{value}</p>
        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1 flex items-center justify-center gap-1">
          {icon}
          {label}
        </p>
      </CardContent>
    </Card>
  );
}
