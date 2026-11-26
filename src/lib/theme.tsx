import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppTheme = "warm" | "dark" | "blue" | "orange" | "pink";

export const THEME_OPTIONS: { value: AppTheme; label: string; class: string }[] = [
  { value: "dark", label: "Dark", class: "dark" },
  { value: "blue", label: "Blue", class: "theme-blue" },
  { value: "orange", label: "Orange", class: "theme-orange" },
  { value: "pink", label: "Pink", class: "theme-pink" },
];

const STORAGE_KEY = "app-theme";

interface ThemeCtx {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("warm");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const saved = typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as AppTheme | null) : null;
      if (saved && THEME_OPTIONS.some((o) => o.value === saved)) {
        setThemeState(saved);
        applyThemeClass(saved);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("user_settings")
          .select("theme")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.theme) {
          const dbTheme = data.theme as AppTheme;
          if (THEME_OPTIONS.some((o) => o.value === dbTheme)) {
            setThemeState(dbTheme);
            applyThemeClass(dbTheme);
            localStorage.setItem(STORAGE_KEY, dbTheme);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, []);

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
    applyThemeClass(t);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, t);
    }
    // Persiste no backend para manter o tema entre dispositivos/sessões
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("user_settings")
        .upsert({ user_id: user.id, theme: t }, { onConflict: "user_id" });
    })();
  };


  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyThemeClass(t: AppTheme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  for (const opt of THEME_OPTIONS) {
    html.classList.remove(opt.class);
  }
  if (t !== "warm") {
    const opt = THEME_OPTIONS.find((o) => o.value === t);
    if (opt) html.classList.add(opt.class);
  }
}
