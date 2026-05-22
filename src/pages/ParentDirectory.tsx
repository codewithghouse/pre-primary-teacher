/**
 * ParentDirectory.tsx — Class-scoped parent contact list for the
 * pre-primary teacher. NOT a chat surface — purely a contact directory
 * with one-tap deep-links to WhatsApp / phone / email.
 *
 * For emergencies, picnic announcements, sub-teacher days. Privacy:
 * teacher sees parents of CHILDREN IN THEIR CLASS ONLY. There's no
 * parent-side equivalent of this page.
 */
import { useMemo, useState } from "react";
import {
  Phone,
  MessageCircle,
  Mail,
  Search,
  Users,
  Sparkles,
  AlertTriangle,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useTeacherClass } from "@/hooks/useTeacherClass";
import { useClassRoster, type RosterChild } from "@/hooks/useClassRoster";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function cleanPhone(raw?: string): string {
  if (!raw) return "";
  // Strip everything except digits + leading +
  const digits = raw.replace(/[^\d+]/g, "");
  // If no country code, assume +91 (India default — Edullent's target market)
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export default function ParentDirectory() {
  const { primaryClass, loading: classLoading } = useTeacherClass();
  const { roster, loading: rosterLoading } = useClassRoster(primaryClass?.id);
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [openChild, setOpenChild] = useState<RosterChild | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.parentName || "").toLowerCase().includes(q) ||
        (c.parentPhone || "").includes(q) ||
        (c.parentEmail || "").toLowerCase().includes(q)
    );
  }, [roster, search]);

  const stats = useMemo(() => {
    let withPhone = 0;
    let withEmail = 0;
    let withAny = 0;
    roster.forEach((c) => {
      const hasPhone = !!c.parentPhone;
      const hasEmail = !!c.parentEmail;
      if (hasPhone) withPhone++;
      if (hasEmail) withEmail++;
      if (hasPhone || hasEmail) withAny++;
    });
    return { withPhone, withEmail, withAny, total: roster.length };
  }, [roster]);

  if (classLoading || rosterLoading) {
    return (
      <div className="px-4 py-12 text-center text-xs text-muted-foreground">
        Loading directory…
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

  return (
    <>
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
              "rounded-xl bg-edu-light-blue text-edu-blue flex items-center justify-center",
              isDesktop ? "w-10 h-10" : "w-9 h-9"
            )}
          >
            <Users className={isDesktop ? "w-5 h-5" : "w-4 h-4"} />
          </div>
          <div>
            <h1
              className={cn(
                "font-black text-edu-navy leading-none",
                isDesktop ? "text-2xl" : "text-xl"
              )}
            >
              Parent Directory
            </h1>
            <p className="text-[11px] text-muted-foreground mt-1 font-semibold">
              {primaryClass.name} · {format(new Date(), "EEEE, d MMM")}
            </p>
          </div>
        </div>

        {/* Stats banner */}
        <div className="rounded-2xl bg-gradient-to-br from-edu-blue to-edu-navy text-white p-4 shadow-md">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/70 font-bold">
            <Sparkles className="w-3 h-3" /> Coverage
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <Stat label="Reachable" value={stats.withAny} total={stats.total} />
            <Stat label="Phone" value={stats.withPhone} total={stats.total} />
            <Stat label="Email" value={stats.withEmail} total={stats.total} />
          </div>
        </div>

        {/* Missing-contact warning */}
        {stats.withAny < stats.total && (
          <Card className="bg-edu-light-yellow/40 border-edu-yellow/40">
            <CardContent className="p-3 text-[11px] text-foreground/80 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-edu-yellow shrink-0 mt-0.5" />
              <p>
                <strong>{stats.total - stats.withAny}</strong> child
                {stats.total - stats.withAny === 1 ? "" : "ren"} have no parent
                contact on file. Ask principal to update their PreStudents
                record for emergency access.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by child or parent name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No parents match.
            </CardContent>
          </Card>
        ) : (
          <ul
            className={cn(
              isDesktop ? "grid grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-2"
            )}
          >
            {filtered.map((child) => (
              <ParentRow
                key={child.id}
                child={child}
                onOpen={() => setOpenChild(child)}
              />
            ))}
          </ul>
        )}

        <p className="text-[10px] text-center text-muted-foreground pt-2 leading-relaxed">
          🔒 Privacy — contacts visible only to teachers assigned to this class.
          Use professionally; not a chat surface.
        </p>
      </div>

      {/* Contact actions sheet */}
      {openChild && (
        <ContactSheet child={openChild} onClose={() => setOpenChild(null)} />
      )}
    </>
  );
}

function Stat({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  return (
    <div>
      <p className="text-2xl font-black leading-none">
        {value}
        <span className="text-base text-white/60">/{total}</span>
      </p>
      <p className="text-[10px] uppercase tracking-widest font-bold text-white/70 mt-1">
        {label}
      </p>
    </div>
  );
}

function ParentRow({
  child,
  onOpen,
}: {
  child: RosterChild;
  onOpen: () => void;
}) {
  const hasContact = !!child.parentPhone || !!child.parentEmail;
  const phone = cleanPhone(child.parentPhone);
  const wa = phone ? `https://wa.me/${phone.replace("+", "")}` : null;

  return (
    <li>
      <Card
        className={cn(
          "border-2 transition",
          hasContact ? "border-border" : "border-dashed border-edu-yellow/40"
        )}
      >
        <CardContent className="p-3">
          <button
            type="button"
            onClick={onOpen}
            className="w-full flex items-center gap-3 text-left"
          >
            {child.photoURL ? (
              <img
                src={child.photoURL}
                alt={child.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-edu-navy text-white flex items-center justify-center font-black text-sm">
                {child.name
                  .split(/\s+/)
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-edu-navy truncate">
                {child.name}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {child.parentName || "Parent"}
                {child.parentPhone ? ` · ${child.parentPhone}` : ""}
              </p>
            </div>
          </button>

          {hasContact && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-9 rounded-lg bg-edu-light-green text-edu-green font-bold text-xs flex items-center justify-center gap-1 hover:bg-edu-light-green/70 active:scale-95 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              )}
              {child.parentPhone && (
                <a
                  href={`tel:${cleanPhone(child.parentPhone)}`}
                  className="flex-1 h-9 rounded-lg bg-edu-light-blue text-edu-blue font-bold text-xs flex items-center justify-center gap-1 hover:bg-edu-light-blue/70 active:scale-95 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call
                </a>
              )}
              {child.parentEmail && !child.parentPhone && (
                <a
                  href={`mailto:${child.parentEmail}`}
                  className="flex-1 h-9 rounded-lg bg-secondary text-edu-navy font-bold text-xs flex items-center justify-center gap-1 hover:bg-secondary/70 active:scale-95 transition"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </a>
              )}
            </div>
          )}

          {!hasContact && (
            <p className="text-[10px] text-edu-yellow font-bold mt-2 pt-2 border-t border-border italic flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              No contact on file
            </p>
          )}
        </CardContent>
      </Card>
    </li>
  );
}

function ContactSheet({
  child,
  onClose,
}: {
  child: RosterChild;
  onClose: () => void;
}) {
  const phone = cleanPhone(child.parentPhone);
  const wa = phone ? `https://wa.me/${phone.replace("+", "")}` : null;
  const initials = child.name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl lg:rounded-2xl lg:max-w-lg animate-slide-up lg:animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="lg:hidden w-12 h-1.5 bg-border rounded-full mx-auto mt-2.5 mb-1" />

        {/* Header */}
        <div className="px-5 pt-3 pb-2 flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {child.photoURL ? (
              <img
                src={child.photoURL}
                alt={child.name}
                className="w-14 h-14 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-edu-navy text-white flex items-center justify-center font-black text-lg">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-base font-black text-edu-navy truncate">
                {child.name}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                Roll {child.rollNo}
              </p>
              {child.parentName && (
                <p className="text-xs font-bold text-edu-blue mt-0.5 truncate">
                  Parent: {child.parentName}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 mt-4 space-y-3 pb-5">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-edu-light-green border border-edu-green/30 hover:bg-edu-light-green/70 active:scale-[0.98] transition"
            >
              <div className="w-10 h-10 rounded-xl bg-edu-green text-white flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-edu-navy">WhatsApp</p>
                <p className="text-[11px] text-muted-foreground">{phone}</p>
              </div>
            </a>
          )}
          {child.parentPhone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-edu-light-blue border border-edu-blue/30 hover:bg-edu-light-blue/70 active:scale-[0.98] transition"
            >
              <div className="w-10 h-10 rounded-xl bg-edu-blue text-white flex items-center justify-center">
                <Phone className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-edu-navy">Call</p>
                <p className="text-[11px] text-muted-foreground">
                  {child.parentPhone}
                </p>
              </div>
            </a>
          )}
          {child.parentEmail && (
            <a
              href={`mailto:${child.parentEmail}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border hover:bg-secondary/70 active:scale-[0.98] transition"
            >
              <div className="w-10 h-10 rounded-xl bg-edu-navy text-white flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-edu-navy">Email</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {child.parentEmail}
                </p>
              </div>
            </a>
          )}

          {!child.parentPhone && !child.parentEmail && (
            <Card className="bg-edu-light-yellow/40 border-edu-yellow/40">
              <CardContent className="p-3 text-xs text-foreground/80 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-edu-yellow shrink-0 mt-0.5" />
                <p>
                  No parent contact on file. Ask principal to update{" "}
                  {child.name.split(" ")[0]}'s record in PreStudents.
                </p>
              </CardContent>
            </Card>
          )}

          <p className="text-[10px] text-center text-muted-foreground pt-3 leading-relaxed">
            🔒 Use for emergencies, picnic announcements, or sub-teacher days.
            Not for personal/casual chat.
          </p>
        </div>
      </div>
    </div>
  );
}
