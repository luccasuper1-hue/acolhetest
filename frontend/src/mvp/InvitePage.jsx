import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import BrandMark from "../components/BrandMark";
import { api, apiError, saveToken } from "./api";
import { useMvpAuth } from "./AuthMvp";

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refresh } = useMvpAuth();
  const [invite, setInvite] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/auth/invite/${token}`).then(r => setInvite(r.data)).catch(e => setError(apiError(e)));
  }, [token]);

  const submit = async e => {
    e.preventDefault();
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    setBusy(true); setError("");
    try {
      const { data } = await api.post(`/auth/invite/${token}/accept`, { password });
      saveToken(data.access_token);
      await refresh();
      navigate("/profissional", { replace: true });
    } catch (err) { setError(apiError(err)); } finally { setBusy(false); }
  };

  return (
    <div className="mvp-auth">
      <section className="mvp-auth-card" data-testid="invite-card">
        <BrandMark size={30} />
        <div className="section-kicker" style={{ marginTop: 14 }}>Convite · piloto</div>
        <h1>{invite ? <>Crie sua <em>senha.</em></> : <>Convite <em>inválido.</em></>}</h1>
        {invite ? (
          <p data-testid="invite-details">
            {invite.name} · {invite.email}<br />
            Vínculo: {invite.institution || "Rede Acolhe"}
          </p>
        ) : <p>{error || "Verificando convite…"}</p>}
        {invite && (
          <form className="mvp-form" onSubmit={submit}>
            <label>Nova senha (mínimo 8 caracteres)
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} data-testid="invite-password-input" />
            </label>
            <label>Confirmar senha
              <input type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} data-testid="invite-confirm-input" />
            </label>
            {error && <div className="mvp-error" data-testid="invite-error">{error}</div>}
            <button className="button primary full" disabled={busy} data-testid="invite-submit-button">
              {busy ? "Ativando…" : "Ativar minha conta"} <ArrowRight size={16} />
            </button>
          </form>
        )}
        <div className="mvp-auth-foot"><Link to="/entrar" data-testid="invite-to-login">Já ativei minha conta</Link></div>
      </section>
    </div>
  );
}
