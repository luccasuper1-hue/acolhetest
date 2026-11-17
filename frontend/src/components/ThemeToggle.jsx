import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme";

export const ThemeToggle = () => {
  const { resolved, setMode } = useTheme();
  const isDark = resolved === "dark";

  return (
    <div className="theme-toggle">
      <button
        type="button"
        className="theme-toggle-button"
        onClick={() => setMode(isDark ? "light" : "dark")}
        aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
        aria-pressed={isDark}
        data-testid="theme-toggle-button"
      >
        <span className="theme-icon-swap" aria-hidden="true">
          {isDark ? <Moon size={17}/> : <Sun size={17}/>}
        </span>
      </button>
    </div>
  );
};

export default ThemeToggle;
