import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Sprout, AlertCircle, Loader2 } from "lucide-react";

interface LoginProps {
  authError?: string | null;
}

export default function Login({ authError }: LoginProps) {
  const { loginWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      // AuthContext surfaces the error via the error banner above the
      // button — we just log here for debug. Common causes:
      //   • Popup blocked by browser → check address-bar icon
      //   • Domain not in Firebase Auth Authorized Domains list
      //   • User closed the popup
      console.error("[Login] sign-in failed:", err);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-edu-navy flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur flex items-center justify-center mb-5 shadow-2xl">
              <Sprout className="w-10 h-10 text-edu-green" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Edullent
            </h1>
            <p className="text-sm text-white/60 font-semibold uppercase tracking-widest mt-1">
              Pre-Primary Teacher
            </p>
            <p className="text-xs text-white/50 mt-4 max-w-xs leading-relaxed">
              Daily moments, milestones, and trust — for Playgroup, Nursery, LKG, UKG teachers.
            </p>
          </div>

          {/* Error banner */}
          {authError && (
            <div className="mb-5 flex items-start gap-2 bg-edu-red/10 border border-edu-red/30 text-white text-xs rounded-xl p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-edu-red" />
              <span className="leading-relaxed">{authError}</span>
            </div>
          )}

          {/* Sign-in CTA */}
          <Button
            onClick={handleSignIn}
            disabled={signingIn}
            size="lg"
            className="w-full bg-white text-edu-navy hover:bg-white/95 shadow-xl"
          >
            {signingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <GoogleIcon />
                Sign in with Google
              </>
            )}
          </Button>

          <p className="text-[11px] text-white/40 text-center mt-5 leading-relaxed">
            Use the Google account registered by your principal.
            <br />
            Need access? Contact your school principal.
          </p>
        </div>
      </div>

      <div className="text-center pb-6">
        <a
          href="/setup"
          className="text-[10px] text-white/50 underline hover:text-white/80"
        >
          Principal? Set up a pre-primary teacher →
        </a>
        <div className="text-[10px] text-white/30 uppercase tracking-widest mt-2">
          Powered by Edullent · v0.1
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
