import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronLeft } from "lucide-react";
import BrandMark from "../components/BrandMark";
import { HOME_BY_ROLE, useMvpAuth } from "./AuthMvp";
import { apiError } from "./api";

const PROFILE_CONTEXT = {
  institution: { label: "instituição", description: "Use a conta de gestão criada para a sua instituição." },
  professional: { label: "profissional", description: "Use a conta ativada pelo convite da sua instituição." },
  student: { label: "estudante", description: "Use sua conta ou crie um acesso com o código da instituição." },
};

export default function LoginPage() {
  const { signIn, user, checking } = useMvpAuth();
  const [params] = useSearchParams();
  const profile = PROFILE_CONTEXT[params.get("perfil")] || null;
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!checking && user) return <Navigate to={params.get("next") || HOME_BY_ROLE[user.role]} replace />;

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const logged = await signIn(email, password);
      navigate(params.get("next") || HOME_BY_ROLE[logged.role] || "/", { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mvp-auth">
      <section className="mvp-auth-card" data-testid="mvp-login-card">
        <BrandMark size={30} />
        <div className="section-kicker" style={{ marginTop: 14 }}>{profile ? `Acesso para ${profile.label}` : "Acesso ao piloto"}</div>
        <h1>Entrar no <em>Acolhe.</em></h1>
        <p>{profile?.description || "Use a conta criada pela sua instituição. Estudantes podem criar conta com o código da instituição."}</p>
        {profile && <div className="mvp-login-context" role="status">Você poderá acessar somente a área correspondente ao papel da sua conta.</div>}
        <form className="mvp-form" onSubmit={submit}>
          <label>E-mail
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              data-testid="login-email-input" autoComplete="email" />
          </label>
          <label>Senha
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              data-testid="login-password-input" autoComplete="current-password" />
          </label>
          {error && <div className="mvp-error" data-testid="login-error">{error}</div>}
          <button className="button primary full" disabled={busy} data-testid="login-submit-button">
            {busy ? "Entrando…" : "Entrar"} <ArrowRight size={16} />
          </button>
        </form>
        <div className="mvp-auth-foot">
          <Link to="/recuperar-senha" data-testid="login-to-forgot">Esqueci minha senha</Link>
          <Link to="/cadastro" data-testid="login-to-register">Sou estudante e quero criar minha conta</Link>
          <Link to="/" className="back-link" data-testid="login-back-home"><ChevronLeft size={15} /> Voltar para a Home</Link>
        </div>
      </section>
    </div>
  );
}
