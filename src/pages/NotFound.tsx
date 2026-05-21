import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-edu-navy text-white text-center">
      <div className="text-6xl mb-4">🌱</div>
      <h1 className="text-3xl font-black mb-2">Page not found</h1>
      <p className="text-sm text-white/60 mb-6">
        This page doesn't exist or has moved.
      </p>
      <Button asChild variant="secondary">
        <Link to="/">Back to Home</Link>
      </Button>
    </div>
  );
}
