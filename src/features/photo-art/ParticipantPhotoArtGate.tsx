import { LoaderCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  checkAccess: () => Promise<{ status: string }>;
  onMissingAccess: () => void;
};

type Gate = "checking" | "authorized" | "redirecting" | "error";

export function ParticipantPhotoArtGate({ children, checkAccess, onMissingAccess }: Props) {
  const [gate, setGate] = useState<Gate>("checking");

  useEffect(() => {
    let cancelled = false;
    void checkAccess()
      .then((access) => {
        if (cancelled) return;
        if (access.status === "authorized") {
          setGate("authorized");
          return;
        }
        setGate("redirecting");
        onMissingAccess();
      })
      .catch(() => {
        if (!cancelled) setGate("error");
      });
    return () => {
      cancelled = true;
    };
  }, [checkAccess, onMissingAccess]);

  if (gate === "authorized") return children;
  if (gate === "error") {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center text-sm font-semibold text-red-700">
        Não foi possível validar seu acesso. Volte ao portal e tente novamente.
      </div>
    );
  }
  return (
    <div className="grid min-h-[60vh] place-items-center text-sm font-semibold text-zinc-600">
      <span className="flex items-center gap-2">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        Validando seu acesso…
      </span>
    </div>
  );
}
