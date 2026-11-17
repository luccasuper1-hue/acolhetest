import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { professionals } from "../data";

const PAGES = [
  ["Quero conversar", "/entrar"],
  ["Como funciona", "/como-funciona"],
  ["Para estudantes", "/para-estudantes"],
  ["Para profissionais", "/profissionais"],
  ["Para instituições", "/instituicoes"],
  ["Recursos e conteúdo", "/recursos"],
  ["Central de ajuda", "/ajuda"],
  ["Privacidade", "/privacidade"],
  ["Termos de uso do Acolhe", "/termos"],
  ["Preciso de ajuda agora", "/preciso-ajuda"],
];

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panelRef = useRef(null);
  const openRef = useRef(false);
  const returnFocusRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!openRef.current) returnFocusRef.current = document.activeElement;
        const nextOpen = !openRef.current;
        openRef.current = nextOpen;
        setQuery("");
        setOpen(nextOpen);
      }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    openRef.current = open;
    if (!open && returnFocusRef.current && document.contains(returnFocusRef.current)) {
      returnFocusRef.current.focus({ preventScroll: true });
      returnFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    const handleKeyDown = event => {
      if (event.key !== "Tab") return;
      const items = [...panel.querySelectorAll("input, button:not([disabled])")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    panel.addEventListener("keydown", handleKeyDown);
    return () => panel.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const results = useMemo(() => {
    const items = [
      ...PAGES.map(([label, to]) => ({ label, to, group: "Navegar" })),
      ...professionals.map(p => ({ label: `${p.name} · perfil de referência`, to: `/app/profissional/${p.id}`, group: "Profissionais" })),
    ];
    const q = query.trim().toLowerCase();
    return (q ? items.filter(i => i.label.toLowerCase().includes(q)) : items).slice(0, 7);
  }, [query]);

  if (!open) return null;

  const go = to => { returnFocusRef.current = null; setOpen(false); navigate(to); };

  return (
    <div className="command-overlay" onClick={() => setOpen(false)} data-testid="command-palette">
      <div ref={panelRef} className="command-panel" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Busca rápida">
        <div className="command-input">
          <Search size={17}/>
          <input
            aria-label="Buscar páginas e profissionais"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && results[0]) go(results[0].to); }}
            placeholder="Buscar páginas, profissionais, ajuda..."
            data-testid="command-input"
          />
          <span className="command-hint">esc</span>
        </div>
        <div className="command-list">
          {results.map(item => (
            <button type="button" key={item.to + item.label} onClick={() => go(item.to)} data-testid={`command-result-${item.to}`}>
              <span className="command-group">{item.group}</span>
              <span className="command-label">{item.label}</span>
              <ArrowRight size={15}/>
            </button>
          ))}
          {!results.length && <p className="command-empty">Nada encontrado. Tente “agenda”, “ajuda” ou um nome.</p>}
        </div>
        <div className="command-foot"><CornerDownLeft size={13}/> Enter abre o primeiro resultado · busca no catálogo</div>
      </div>
    </div>
  );
};

export default CommandPalette;
