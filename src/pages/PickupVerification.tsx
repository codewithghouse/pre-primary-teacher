import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Clock,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { usePPPickups, type PickupRecord } from "@/hooks/usePPPickups";
import { useAuth } from "@/lib/AuthContext";

export default function PickupVerification() {
  const { teacherData } = useAuth();
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const { data, loading: pickupLoading, verifyPickup } = usePPPickups(
    primaryClass?.id
  );

  const [verifyingFor, setVerifyingFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loading = classLoading || rosterLoading || pickupLoading;

  if (loading && roster.length === 0) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading pickup queue…</p>
      </div>
    );
  }

  if (!primaryClass) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm font-bold text-edu-navy">No class assigned</p>
      </div>
    );
  }

  const records = data?.records || {};
  const verifiedCount = Object.values(records).filter(
    (r) => r.status === "verified"
  ).length;
  const mismatchCount = Object.values(records).filter(
    (r) => r.status === "mismatch"
  ).length;

  const verifyChild = roster.find((c) => c.id === verifyingFor);

  const handleVerify = async (
    child: RosterChild,
    person: { name: string; relation: string }
  ) => {
    if (!teacherData?.id) return;
    setSaving(true);
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
      toast.success(`${child.name.split(" ")[0]} picked up by ${person.name} ✓`);
    } catch (err) {
      console.error("[Pickup] verify failed:", err);
      toast.error("Could not save. Check permissions & try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleMismatch = async (child: RosterChild) => {
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
        mismatchReason: "Unauthorized person attempted pickup",
        verifiedAt: new Date().toISOString(),
        verifiedBy: teacherData.id,
      };
      await verifyPickup(record);
      setVerifyingFor(null);
      toast.error(`🚨 ESCALATED for ${child.name}. Principal notified.`);
    } catch (err) {
      console.error("[Pickup] mismatch escalation failed:", err);
      toast.error("Could not escalate. Phone the principal directly!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-black text-edu-navy">Pickup Verification</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {primaryClass.name} · Verify authorized person before releasing each child.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Counter
          label="Verified"
          value={verifiedCount}
          color="text-edu-green"
          icon={<CheckCircle2 className="w-3 h-3" />}
        />
        <Counter
          label="Pending"
          value={roster.length - verifiedCount - mismatchCount}
          color="text-muted-foreground"
          icon={<Clock className="w-3 h-3" />}
        />
        <Counter
          label="Escalated"
          value={mismatchCount}
          color="text-edu-red"
          icon={<AlertTriangle className="w-3 h-3" />}
        />
      </div>

      {mismatchCount > 0 && (
        <Card className="bg-edu-light-red border-edu-red animate-pulse">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-edu-red shrink-0" />
            <p className="text-xs font-bold text-edu-red">
              {mismatchCount} pickup mismatch{mismatchCount > 1 ? "es" : ""} —
              principal alerted, children in safe area.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Queue */}
      <div className="space-y-2">
        {roster.map((c) => {
          const rec = records[c.id];
          return (
            <PickupCard
              key={c.id}
              child={c}
              record={rec}
              onTap={() => setVerifyingFor(c.id)}
            />
          );
        })}
      </div>

      {/* Verify bottom-sheet */}
      {verifyChild && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end animate-fade-in"
          onClick={() => !saving && setVerifyingFor(null)}
        >
          <div
            className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-3" />
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-edu-navy">
                  Who is picking up {verifyChild.name.split(" ")[0]}?
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Match the person against the authorized list below.
                </p>
              </div>
              <button
                onClick={() => setVerifyingFor(null)}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Authorized list */}
            {verifyChild.authorizedPickup && verifyChild.authorizedPickup.length > 0 ? (
              <div className="space-y-2">
                {verifyChild.authorizedPickup.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => handleVerify(verifyChild, p)}
                    disabled={saving}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-edu-green/30 hover:bg-edu-light-green/30 active:scale-[0.98] transition disabled:opacity-50"
                  >
                    <div className="w-12 h-12 rounded-full bg-edu-green/20 flex items-center justify-center text-edu-green font-black">
                      {p.name
                        .split(" ")
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.relation}
                      </p>
                    </div>
                    <UserCheck className="w-5 h-5 text-edu-green" />
                  </button>
                ))}
              </div>
            ) : (
              <Card className="bg-edu-light-yellow border-edu-yellow">
                <CardContent className="p-3 text-xs">
                  <strong>No authorized pickup persons on file.</strong> Ask the parent to set
                  authorized persons in the Parent App before next pickup. For today, verify
                  identity manually and contact principal if uncertain.
                </CardContent>
              </Card>
            )}

            <div className="border-t border-border mt-5 pt-4">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                Unauthorized person attempting pickup?
              </p>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => handleMismatch(verifyChild)}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                Escalate — block release & alert principal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className={cn("text-2xl font-black leading-none", color)}>{value}</p>
        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1 flex items-center justify-center gap-1">
          {icon}
          {label}
        </p>
      </CardContent>
    </Card>
  );
}

function PickupCard({
  child,
  record,
  onTap,
}: {
  child: RosterChild;
  record: PickupRecord | undefined;
  onTap: () => void;
}) {
  const status = record?.status || "pending";
  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "w-full rounded-2xl border p-3 flex items-center gap-3 bg-white shadow-sm active:scale-[0.99] transition-all text-left",
        status === "verified" && "border-edu-green bg-edu-light-green/30",
        status === "mismatch" && "border-edu-red bg-edu-light-red/30",
        status === "pending" && "border-border"
      )}
    >
      {child.photoURL ? (
        <img
          src={child.photoURL}
          alt={child.name}
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-edu-navy text-white flex items-center justify-center font-black">
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
          <p className="text-[11px] text-edu-green">
            ✓ Picked up by {record.actualPickupPersonName}
            {record.actualPickupPersonRelation
              ? ` (${record.actualPickupPersonRelation})`
              : ""}
          </p>
        ) : status === "mismatch" ? (
          <p className="text-[11px] text-edu-red font-bold">🚨 ESCALATED — principal alerted</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">Tap to verify pickup</p>
        )}
      </div>
      {status === "verified" && <CheckCircle2 className="w-5 h-5 text-edu-green shrink-0" />}
      {status === "mismatch" && <AlertTriangle className="w-5 h-5 text-edu-red shrink-0" />}
    </button>
  );
}
