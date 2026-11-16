import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getInitialTheme, toggleTheme, type Theme } from "@/lib/theme";

type Props = {
  className?: string;
  /** Match the topbar ghost-button styling used across internal shells. */
  variant?: "topbar" | "default";
};

export function ThemeToggle({ className, variant = "topbar" }: Props) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(getInitialTheme());
  }, []);

  const handleToggle = () => {
    setThemeState((current) => toggleTheme(current));
  };

  const isDark = theme === "dark";

  if (variant === "topbar") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
        title={isDark ? "Modo claro" : "Modo escuro"}
        className={`size-9 text-white hover:bg-white/10 hover:text-brand-gold focus-visible:ring-brand-gold ${className ?? ""}`}
        onClick={handleToggle}
      >
        {isDark ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      className={className}
      onClick={handleToggle}
    >
      {isDark ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}
      <span className="ml-2">{isDark ? "Claro" : "Escuro"}</span>
    </Button>
  );
}
