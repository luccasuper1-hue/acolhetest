import { useEffect, useState } from "react";
import { Check, Cookie, ShieldCheck, X } from "lucide-react";

export const COOKIE_CONSENT_KEY = "acolhe-cookie-consent-v1";
export const COOKIE_CONSENT_VERSION = "v1";

const defaultPreferences = { necessary: true, preferences: false, measurement: false };

function readConsent() {
  try {
    const saved = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) || "null");
    if (saved?.version === COOKIE_CONSENT_VERSION && saved?.preferences) return saved;
  } catch { /* armazenamento indisponível ou inválido */ }
  return null;
}

function saveConsent(preferences) {
  const record = { version: COOKIE_CONSENT_VERSION, preferences: { ...defaultPreferences, ...preferences, necessary: true }, saved_at: new Date().toISOString() };
  try { localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(record)); } catch { /* segue em memória */ }
  window.dispatchEvent(new CustomEvent("acolhe:cookie-consent", { detail: record }));
}

export function openCookieSettings() {
  window.dispatchEvent(new Event("acolhe:open-cookie-settings"));
}

export default function CookieConsent() {
  const [consent, setConsent] = useState(() => readConsent());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => consent?.preferences || defaultPreferences);

  useEffect(() => {
    const openSettings = () => {
      const current = readConsent();
      setDraft(current?.preferences || defaultPreferences);
      setOpen(true);
    };
    window.addEventListener("acolhe:open-cookie-settings", openSettings);
    return () => window.removeEventListener("acolhe:open-cookie-settings", openSettings);
  }, []);

  const close = () => setOpen(false);
  const commit = preferences => { saveConsent(preferences); setConsent({ version: COOKIE_CONSENT_VERSION, preferences }); setOpen(false); };
  const acceptOptional = () => commit({ necessary: true, preferences: true, measurement: true });
  const onlyNecessary = () => commit(defaultPreferences);

  return <>
    {!consent && !open && <aside className="cookie-banner" role="region" aria-label="Preferências de cookies" data-testid="cookie-banner">
      <div className="cookie-banner-icon" aria-hidden="true"><Cookie size={20}/></div>
      <div className="cookie-banner-copy"><strong>Sua privacidade importa</strong><p>Usamos cookies necessários para manter o Acolhe seguro e funcionando. Cookies opcionais lembram preferências e ajudam a melhorar a experiência. Não usamos cookies para publicidade nem para armazenar o conteúdo das conversas. <a href="/politica-de-cookies">Política de Cookies</a></p></div>
      <div className="cookie-banner-actions"><button type="button" className="button cookie-secondary" onClick={onlyNecessary} data-testid="cookie-necessary-button">Usar apenas necessários</button><button type="button" className="button cookie-secondary" onClick={() => setOpen(true)} data-testid="cookie-settings-button">Configurar cookies</button><button type="button" className="button primary" onClick={acceptOptional} data-testid="cookie-accept-button">Aceitar opcionais</button></div>
    </aside>}
    {open && <div className="cookie-overlay" role="presentation"><section className="cookie-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-dialog-title" data-testid="cookie-dialog">
      <div className="cookie-dialog-head"><div><span className="section-kicker">Privacidade</span><h2 id="cookie-dialog-title">Escolha como o Acolhe usa cookies.</h2></div><button type="button" className="icon-button" onClick={close} aria-label="Fechar preferências"><X size={19}/></button></div>
      <p className="cookie-dialog-intro">Você pode alterar sua escolha a qualquer momento. Cookies necessários ficam ativos porque sustentam login, segurança e funcionamento básico.</p>
      <div className="cookie-options">
        <CookieOption title="Cookies necessários" text="Sessão, segurança, autenticação e proteção contra uso indevido." checked disabled />
        <CookieOption title="Preferências" text="Tema, idioma e escolhas de interface para lembrar como você usa o Acolhe." checked={draft.preferences} onChange={value => setDraft(current => ({ ...current, preferences: value }))} />
        <CookieOption title="Medição" text="Métricas agregadas para entender desempenho e melhorar o serviço. Sem publicidade ou conteúdo de conversas." checked={draft.measurement} onChange={value => setDraft(current => ({ ...current, measurement: value }))} />
      </div>
      <div className="cookie-dialog-foot"><a href="/politica-de-cookies" onClick={close}>Ler a Política de Cookies</a><div><button type="button" className="button cookie-secondary" onClick={onlyNecessary}>Usar apenas necessários</button><button type="button" className="button primary" onClick={() => commit(draft)}><Check size={16}/> Salvar escolha</button></div></div>
    </section></div>}
  </>;
}

function CookieOption({ title, text, checked, disabled = false, onChange }) {
  return <label className={`cookie-option ${disabled ? "disabled" : ""}`}><span className="cookie-option-copy"><strong>{title}</strong><small>{text}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange?.(event.target.checked)} /><span className="cookie-switch" aria-hidden="true"><span/></span>{disabled && <span className="cookie-required"><ShieldCheck size={13}/> Sempre ativo</span>}</label>;
}
