import { useEffect, useState } from "react";

import eventLogo from "@/assets/logo-coros-branco.png";

const SPLASH_SESSION_KEY = "encontro-coros-mobile-splash-seen";
const SPLASH_DURATION_MS = 1_200;

function shouldShowSplash() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) !== "true";
  } catch {
    return true;
  }
}

export function MobileEventSplash() {
  // Keep the first server and browser render identical. Session storage is
  // consulted only after hydration so the decorative splash cannot cause a
  // mismatch in the login form.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldShowSplash()) return;
    setVisible(true);
    try {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, "true");
    } catch {
      // The splash may still run when session storage is unavailable.
    }
    const timeout = window.setTimeout(() => setVisible(false), SPLASH_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div
      data-testid="mobile-event-splash"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-white px-7 text-zinc-950 md:hidden motion-reduce:hidden"
    >
      <div className="relative w-full max-w-xs text-center animate-in fade-in-0 zoom-in-95 duration-700">
        <div className="overflow-hidden rounded-3xl bg-white px-4 py-3">
          <img src={eventLogo} alt="" className="h-auto w-full" />
        </div>
        <p className="mt-6 text-[0.62rem] font-extrabold uppercase tracking-[0.3em] text-zinc-500">
          Música · Fé · Comunhão
        </p>
        <div className="mx-auto mt-4 h-0.5 w-20 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full w-full origin-left bg-amber animate-in slide-in-from-left-full duration-1000" />
        </div>
      </div>
    </div>
  );
}
