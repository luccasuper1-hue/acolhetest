import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import BrandMark from "../components/BrandMark";
import { api, apiError } from "./api";

export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(() => params.get("email") || "");
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
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [invalidLink, setInvalidLink] = useState(!token);

  const submit = async e => {
    e.preventDefault();
    setError("");
    if (!token) {
      setInvalidLink(true);
      return;
    }
    try {
      await api.post("/auth/reset-password", { token, password });
      navigate("/entrar", { replace: true });
    } catch (err) {
      const message = apiError(err);
      if (message === "Link inválido ou expirado") setInvalidLink(true);
      else setError(message);
    }
  };

  return (
    <div className="mvp-auth">
      <section className="mvp-auth-card" data-testid="reset-card">
        <BrandMark size={30} />
        <div className="section-kicker" style={{ marginTop: 14 }}>Acesso ao piloto</div>
        <h1>{invalidLink ? <>Link de recuperação <em>inválido.</em></> : <>Definir nova <em>senha.</em></>}</h1>
        {invalidLink ? (
          <div className="mvp-auth-foot" data-testid="reset-invalid-link">
            <p className="mvp-error">Este link de redefinição é inválido ou expirou.</p>
            <p>Solicite uma nova recuperação para receber outro link.</p>
            <Link className="button primary full" to="/recuperar-senha" data-testid="reset-request-new-link">Solicitar nova recuperação <ArrowRight size={16} /></Link>
            <Link className="back-link" to="/entrar" data-testid="reset-to-login">Voltar para o login</Link>
          </div>
        ) : (
          <form className="mvp-form" onSubmit={submit}>
            <label>Nova senha (mínimo 8 caracteres)
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} data-testid="reset-password-input" />
            </label>
            {error && <div className="mvp-error" data-testid="reset-error">{error}</div>}
            <button className="button primary full" data-testid="reset-submit-button">Salvar senha <ArrowRight size={16} /></button>
          </form>
        )}
      </section>
    </div>
  );
}
