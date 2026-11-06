"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "dark" | "light";
type ThemeContextValue = { theme: Theme; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);
const storageKey = "codebloom-theme";
const subscribers = new Set<() => void>();
let memoryPreference: Theme | null = null;

function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    if (memoryPreference) return memoryPreference;
  }
  if (memoryPreference) return memoryPreference;
  return "dark";
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", listener);
  window.addEventListener("storage", listener);
  return () => {
    subscribers.delete(listener);
    media.removeEventListener("change", listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot() {
  return readTheme();
}
function getServerSnapshot(): Theme {
  return "dark";
}
function announceThemeChange() {
  subscribers.forEach((listener) => listener());
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme() {
        const next: Theme = theme === "dark" ? "light" : "dark";

        try {
          window.localStorage.setItem(storageKey, next);
          memoryPreference = null;
        } catch {
          memoryPreference = next;
        }
        document.documentElement.dataset.theme = next;
        announceThemeChange();
      },
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
