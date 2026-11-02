import { Link, useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import BrandMark from "../components/BrandMark";
import ThemeToggle from "../components/ThemeToggle";
import { useMvpAuth } from "./AuthMvp";
import { api, apiError } from "./api";
import { toast } from "sonner";
import { useState } from "react";

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
        <PasswordChangeCard />
        <p className="mvp-foot-note">
          <ShieldCheck size={15} /> MVP do piloto Acolhe · a instituição nunca acessa o conteúdo das conversas.
          Revisão jurídica/LGPD necessária antes de uso com dados reais.
        </p>
      </main>
    </div>
  );
};

function PasswordChangeCard() {
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (form.new_password !== form.confirm) { toast.error("As senhas novas não coincidem."); return; }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: form.current_password, new_password: form.new_password });
      toast.success("Senha alterada.");
      setForm({ current_password: "", new_password: "", confirm: "" });
    } catch (error) { toast.error(apiError(error)); }
    finally { setSaving(false); }
  };
  return <MvpCard title="Segurança da conta" subtitle="Troque a senha padrão ou atual a qualquer momento." testid="password-change-card">
    <form className="mvp-inline-form" onSubmit={submit}>
      <label>Senha atual<input type="password" required minLength={8} value={form.current_password} onChange={e => setForm({ ...form, current_password: e.target.value })} autoComplete="current-password" data-testid="change-current-password-input" /></label>
      <label>Nova senha<input type="password" required minLength={8} value={form.new_password} onChange={e => setForm({ ...form, new_password: e.target.value })} autoComplete="new-password" data-testid="change-new-password-input" /></label>
      <label>Confirmar nova senha<input type="password" required minLength={8} value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" data-testid="change-confirm-password-input" /></label>
      <button className="button secondary" disabled={saving} data-testid="change-password-button">{saving ? "Salvando…" : "Trocar senha"}</button>
    </form>
  </MvpCard>;
}

export const MvpCard = ({ title, subtitle, action, children, testid, className = "" }) => (
  <section className={`mvp-card ${className}`.trim()} data-testid={testid}>
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
