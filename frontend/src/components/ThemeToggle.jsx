import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../theme";

const OPTIONS = [
  { id: "system", label: "Sistema", Icon: Monitor },
  { id: "light", label: "Claro", Icon: Sun },
  { id: "dark", label: "Escuro", Icon: Moon },
];

export const ThemeToggle = () => {
  const { mode, resolved, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="theme-toggle" ref={ref}>
      <button
        className="theme-toggle-button"
        onClick={() => setOpen(!open)}
        aria-label="Alterar tema"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="theme-toggle-button"
      >
        <span className="theme-icon-swap" aria-hidden="true">
          {resolved === "dark" ? <Moon size={17}/> : <Sun size={17}/>}
        </span>
      </button>
      {open && (
        <div className="theme-menu" role="menu" data-testid="theme-menu">
          <span className="theme-menu-title">Aparência</span>
          {OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="menuitemradio"
              aria-checked={mode === id}
              className={mode === id ? "active" : ""}
              onClick={() => { setMode(id); setOpen(false); }}
              data-testid={`theme-option-${id}`}
            >
              <Icon size={15}/> {label}
              {mode === id && <Check size={14}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
