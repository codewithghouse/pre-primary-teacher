import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30">
      <Loader2 className="w-7 h-7 animate-spin text-edu-navy" />
    </div>
  );
}

export function AuthLoader() {
  return (
    <div className="min-h-screen bg-edu-navy flex flex-col items-center justify-center gap-4 text-white">
      <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center text-3xl animate-bounce">
        🌱
      </div>
      <div className="flex flex-col items-center gap-1">
        <Loader2 className="w-6 h-6 animate-spin text-edu-blue" />
        <p className="text-xs font-bold uppercase tracking-widest mt-2 text-white/80">
          Checking access
        </p>
      </div>
    </div>
  );
}
