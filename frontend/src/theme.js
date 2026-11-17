import { createContext, useContext, useEffect, useMemo, useState } from "react";

const KEY = "acolhe-theme";
const ThemeContext = createContext(null);
const prefersDark = () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => { try { return localStorage.getItem(KEY) || "system"; } catch { return "system"; } });
  const [systemIsDark, setSystemIsDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = e => setSystemIsDark(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange); else mq.addListener?.(onChange);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", onChange); else mq.removeListener?.(onChange); };
  }, []);

  const resolved = mode === "system" ? (systemIsDark ? "dark" : "light") : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.style.colorScheme = resolved;
  }, [resolved]);

  const value = useMemo(() => ({
    mode,
    resolved,
    setMode: next => {
      if (next === mode) return;
      const root = document.documentElement;
      root.classList.add("theme-anim");
      window.setTimeout(() => root.classList.remove("theme-anim"), 460);
      try { localStorage.setItem(KEY, next); } catch { /* preferência segue em memória */ }
      setMode(next);
    },
  }), [mode, resolved]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
