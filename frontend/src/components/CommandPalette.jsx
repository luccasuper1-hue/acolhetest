import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { professionals } from "../data";

const PAGES = [
  ["Quero conversar", "/entrar"],
  ["Escolher um assunto", "/app/assunto"],
  ["Ver profissionais", "/app/profissionais"],
  ["Suas conversas · agenda", "/app/agenda"],
  ["Minha jornada", "/app/jornada"],
  ["Como funciona", "/como-funciona"],
  ["Para estudantes", "/para-estudantes"],
  ["Para profissionais", "/profissionais"],
  ["Para instituições", "/instituicoes"],
  ["Painel institucional demonstrativo", "/instituicoes/painel"],
  ["Recursos e conteúdo", "/recursos"],
  ["Central de ajuda", "/ajuda"],
  ["Privacidade", "/privacidade"],
  ["Termos do protótipo", "/termos"],
  ["Preciso de ajuda agora", "/preciso-ajuda"],
  ["Entrar na demonstração", "/login"],
];

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setQuery(""); setOpen(o => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const items = [
      ...PAGES.map(([label, to]) => ({ label, to, group: "Navegar" })),
      ...professionals.map(p => ({ label: `${p.name} · perfil demonstrativo`, to: `/app/profissional/${p.id}`, group: "Profissionais" })),
    ];
    const q = query.trim().toLowerCase();
    return (q ? items.filter(i => i.label.toLowerCase().includes(q)) : items).slice(0, 7);
  }, [query]);

  if (!open) return null;

  const go = to => { setOpen(false); navigate(to); };

  return (
    <div className="command-overlay" onClick={() => setOpen(false)} data-testid="command-palette">
      <div className="command-panel" onClick={e => e.stopPropagation()} role="dialog" aria-label="Busca rápida">
        <div className="command-input">
          <Search size={17}/>
          <input
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
            <button key={item.to + item.label} onClick={() => go(item.to)} data-testid={`command-result-${item.to}`}>
              <span className="command-group">{item.group}</span>
              <span className="command-label">{item.label}</span>
              <ArrowRight size={15}/>
            </button>
          ))}
          {!results.length && <p className="command-empty">Nada encontrado. Tente “agenda”, “ajuda” ou um nome.</p>}
        </div>
        <div className="command-foot"><CornerDownLeft size={13}/> Enter abre o primeiro resultado · busca demonstrativa</div>
      </div>
    </div>
  );
};

export default CommandPalette;
