import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Phone,
  AlertTriangle,
  Heart,
  Search,
  X,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";

export default function Roster() {
  const [query, setQuery] = useState("");
  const [openChildId, setOpenChildId] = useState<string | null>(null);
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);

  const loading = classLoading || rosterLoading;
  const filtered = roster.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  const open = openChildId ? roster.find((c) => c.id === openChildId) : null;

  if (loading && roster.length === 0) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading roster…</p>
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

  return (
    <div className="px-4 py-4 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-black text-edu-navy">My Class</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {primaryClass.name} · {roster.length} children
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {roster.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm font-bold text-edu-navy">No students enrolled yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Principal can add students from the Principal Dashboard.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((c) => (
            <ChildCard key={c.id} child={c} onTap={() => setOpenChildId(c.id)} />
          ))}
        </div>
      )}

      {open && <ChildSheet child={open} onClose={() => setOpenChildId(null)} />}
    </div>
  );
}

function ChildCard({
  child,
  onTap,
}: {
  child: RosterChild;
  onTap: () => void;
}) {
  const initials = child.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hasAlert = (child.allergies?.length || 0) > 0 || !!child.medical;
  const ageYears = child.ageMonths ? Math.floor(child.ageMonths / 12) : null;
  const ageMonths = child.ageMonths ? child.ageMonths % 12 : null;

  return (
    <button
      type="button"
      onClick={onTap}
      className="relative bg-white rounded-2xl border border-border p-3 flex flex-col items-center text-center active:scale-95 transition shadow-sm"
    >
      <div className="relative">
        {child.photoURL ? (
          <img
            src={child.photoURL}
            alt={child.name}
            className="w-16 h-16 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-edu-navy text-white flex items-center justify-center text-xl font-black">
            {initials}
          </div>
        )}
        {hasAlert && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-edu-yellow text-white flex items-center justify-center border-2 border-white">
            <AlertTriangle className="w-3 h-3" />
          </div>
        )}
      </div>
      <p className="text-sm font-bold text-foreground mt-2 truncate w-full">
        {child.name}
      </p>
      <p className="text-[10px] text-muted-foreground">
        Roll {child.rollNo}
        {ageYears !== null && ` · ${ageYears}y ${ageMonths}m`}
      </p>
    </button>
  );
}

function ChildSheet({ child, onClose }: { child: RosterChild; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-4 pt-3 pb-2 border-b border-border z-10">
          <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-3" />
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-black text-edu-navy">{child.name}</h2>
              <p className="text-xs text-muted-foreground">
                Roll {child.rollNo}
                {child.ageMonths != null
                  ? ` · ${Math.floor(child.ageMonths / 12)}y ${child.ageMonths % 12}m`
                  : ""}
                {child.diet ? ` · ${child.diet}` : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          {((child.allergies && child.allergies.length > 0) || child.medical) && (
            <Card className="bg-edu-light-red/30 border-edu-red/30">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-4 h-4 text-edu-red" />
                  <p className="text-xs font-black uppercase tracking-wider text-edu-red">
                    Safety alerts
                  </p>
                </div>
                {child.allergies && child.allergies.length > 0 && (
                  <p className="text-xs">
                    <span className="font-bold">Allergies:</span>{" "}
                    {child.allergies.join(", ")}
                  </p>
                )}
                {child.medical && (
                  <p className="text-xs mt-1">
                    <span className="font-bold">Medical:</span> {child.medical}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Section title="Parent" icon={<Phone className="w-3.5 h-3.5" />}>
            <p className="text-sm font-semibold">{child.parentName || "—"}</p>
            <p className="text-xs text-muted-foreground">
              {child.parentPhone || child.parentEmail || "—"}
            </p>
            {child.parentPhone && (
              <a
                href={`tel:${child.parentPhone.replace(/\s/g, "")}`}
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-edu-blue text-white"
                )}
              >
                <Phone className="w-3 h-3" />
                Call
              </a>
            )}
          </Section>

          {child.authorizedPickup && child.authorizedPickup.length > 0 && (
            <Section
              title="Authorized Pickup"
              icon={<ShieldAlert className="w-3.5 h-3.5" />}
            >
              <ul className="space-y-1.5">
                {child.authorizedPickup.map((p) => (
                  <li key={p.name} className="flex items-center gap-2 text-xs">
                    <div className="w-7 h-7 rounded-full bg-edu-navy/10 flex items-center justify-center text-edu-navy font-bold text-[10px]">
                      {p.name
                        .split(" ")
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-muted-foreground text-[10px]">{p.relation}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {child.comfortCue && (
            <Section
              title="Comfort cue (from parent)"
              icon={<Heart className="w-3.5 h-3.5" />}
            >
              <p className="text-xs italic text-foreground/80">{child.comfortCue}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="pl-1">{children}</div>
    </div>
  );
}
