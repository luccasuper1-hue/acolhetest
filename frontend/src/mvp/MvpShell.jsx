import { Link, useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import BrandMark from "../components/BrandMark";
import ThemeToggle from "../components/ThemeToggle";
import { useMvpAuth } from "./AuthMvp";

const ROLE_LABEL = {
  student: "Estudante",
  professional: "Profissional",
  institution: "Instituição",
  admin: "Administração",
};

export const MvpShell = ({ title, kicker, lead, children, testid }) => {
  const { user, institution, signOut } = useMvpAuth();
  const navigate = useNavigate();
  const exit = async () => { await signOut(); navigate("/"); };

  return (
    <div className="mvp-shell" data-testid={testid}>
      <header className="mvp-topbar">
        <Link to="/" className="mvp-brand" data-testid="mvp-brand-link">
          <BrandMark size={26} /><span>Acolhe</span>
        </Link>
        <div className="mvp-topbar-right">
          <span className="mvp-pill" data-testid="mvp-pilot-badge">Dados do piloto</span>
          <span className="mvp-role" data-testid="mvp-role-badge">{ROLE_LABEL[user?.role]}</span>
          <ThemeToggle />
          <button className="button quiet small" onClick={exit} data-testid="mvp-logout-button">
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>
      <main className="mvp-main">
        <div className="mvp-head">
          <div>
            <span className="section-kicker">{kicker}</span>
            <h1>{title}</h1>
            {lead && <p className="mvp-lead">{lead}</p>}
          </div>
          <div className="mvp-identity" data-testid="mvp-identity">
            <strong>{user?.name}</strong>
            <span>{institution?.name || "Rede Acolhe"}</span>
          </div>
        </div>
        {children}
        <p className="mvp-foot-note">
          <ShieldCheck size={15} /> MVP do piloto Acolhe · a instituição nunca acessa o conteúdo das conversas.
          Revisão jurídica/LGPD necessária antes de uso com dados reais.
        </p>
      </main>
    </div>
  );
};

export const MvpCard = ({ title, subtitle, action, children, testid }) => (
  <section className="mvp-card" data-testid={testid}>
    <div className="mvp-card-head">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </div>
    {children}
  </section>
);

export const MvpEmpty = ({ children = "Sem dados suficientes ainda.", testid }) => (
  <p className="mvp-empty" data-testid={testid}>{children}</p>
);

export const MvpKpi = ({ label, value, note, testid }) => (
  <article className="mvp-kpi" data-testid={testid}>
    <strong>{value === null || value === undefined ? "—" : value}</strong>
    <span className="mvp-kpi-label">{label}</span>
    {note && <span className="mvp-kpi-note">{note}</span>}
  </article>
);

export default MvpShell;
