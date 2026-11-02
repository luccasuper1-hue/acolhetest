import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronLeft, ShieldCheck } from "lucide-react";
import BrandMark from "../components/BrandMark";
import { useMvpAuth } from "./AuthMvp";
import { apiError } from "./api";

export default function RegisterPage() {
  const { signUp } = useMvpAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", institution_code: "" });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await signUp({ ...form, institution_code: form.institution_code.toUpperCase().trim(), consent });
      navigate("/aluno", { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mvp-auth">
      <section className="mvp-auth-card" data-testid="mvp-register-card">
        <BrandMark size={30} />
        <div className="section-kicker" style={{ marginTop: 14 }}>Estudante · piloto</div>
        <h1>Criar sua <em>conta.</em></h1>
        <p>O acesso ao Acolhe é disponibilizado pela sua instituição — use o código que ela informou.</p>
        <form className="mvp-form" onSubmit={submit}>
          <label>Nome
            <input required minLength={2} value={form.name} onChange={set("name")} data-testid="register-name-input" />
          </label>
          <label>E-mail
            <input type="email" required value={form.email} onChange={set("email")} data-testid="register-email-input" />
          </label>
          <label>Senha (mínimo 8 caracteres)
            <input type="password" required minLength={8} value={form.password} onChange={set("password")} data-testid="register-password-input" />
          </label>
          <label>Código da instituição
            <input required value={form.institution_code} onChange={set("institution_code")} placeholder="Ex.: PILOTO2026" data-testid="register-code-input" />
          </label>
          <div className="mvp-consent" data-testid="register-consent-box">
            <p>
              <ShieldCheck size={14} /> Este é um <strong>piloto em validação</strong>. Estudantes podem ser menores de idade e
              informações de apoio são sensíveis: as regras de uso, o consentimento e a participação de responsáveis são
              definidos com a instituição antes do uso real. O Acolhe não realiza diagnóstico automático.
            </p>
            <label className="mvp-check">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} data-testid="register-consent-checkbox" />
              <span>Li e aceito participar do piloto nas condições combinadas com a minha instituição.</span>
            </label>
          </div>
          {error && <div className="mvp-error" data-testid="register-error">
            <div>{error}</div>
            {error.toLowerCase().includes("já possui conta") && (
              <Link to={`/recuperar-senha?email=${encodeURIComponent(form.email)}`} className="mvp-inline-action" data-testid="register-recover-link">
                Recuperar senha deste e-mail
              </Link>
            )}
          </div>}
          <button className="button primary full" disabled={busy || !consent} data-testid="register-submit-button">
            {busy ? "Criando…" : "Criar conta"} <ArrowRight size={16} />
          </button>
        </form>
        <div className="mvp-auth-foot">
          <Link to="/entrar" data-testid="register-to-login">Já tenho conta</Link>
          <Link to="/" className="back-link" data-testid="register-back-home"><ChevronLeft size={15} /> Voltar para a Home</Link>
        </div>
      </section>
    </div>
  );
}
