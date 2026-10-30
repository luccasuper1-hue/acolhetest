import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import BrandMark from "../components/BrandMark";
import { api, apiError } from "./api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const submit = async e => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setResult(data);
    } catch (err) { setError(apiError(err)); }
  };

  return (
    <div className="mvp-auth">
      <section className="mvp-auth-card" data-testid="forgot-card">
        <BrandMark size={30} />
        <div className="section-kicker" style={{ marginTop: 14 }}>Acesso ao piloto</div>
        <h1>Recuperar <em>acesso.</em></h1>
        <p>Informe seu e-mail para receber instruções de redefinição de senha.</p>
        <form className="mvp-form" onSubmit={submit}>
          <label>E-mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)} data-testid="forgot-email-input" /></label>
          {error && <div className="mvp-error" data-testid="forgot-error">{error}</div>}
          <button className="button primary full" data-testid="forgot-submit-button">Enviar instruções <ArrowRight size={16} /></button>
        </form>
        {result && (
          <div className="mvp-auth-foot" data-testid="forgot-result">
            <p className="mvp-ok">{result.message}</p>
            {result.reset_token && (
              <Link to={`/redefinir-senha?token=${result.reset_token}`} data-testid="forgot-reset-link">Abrir link de redefinição</Link>
            )}
          </div>
        )}
        <div className="mvp-auth-foot"><Link to="/entrar" data-testid="forgot-to-login">Voltar para o login</Link></div>
      </section>
    </div>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async e => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/auth/reset-password", { token: params.get("token"), password });
      navigate("/entrar", { replace: true });
    } catch (err) { setError(apiError(err)); }
  };

  return (
    <div className="mvp-auth">
      <section className="mvp-auth-card" data-testid="reset-card">
        <BrandMark size={30} />
        <div className="section-kicker" style={{ marginTop: 14 }}>Acesso ao piloto</div>
        <h1>Definir nova <em>senha.</em></h1>
        <form className="mvp-form" onSubmit={submit}>
          <label>Nova senha (mínimo 8 caracteres)
            <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} data-testid="reset-password-input" />
          </label>
          {error && <div className="mvp-error" data-testid="reset-error">{error}</div>}
          <button className="button primary full" data-testid="reset-submit-button">Salvar senha <ArrowRight size={16} /></button>
        </form>
      </section>
    </div>
  );
}
