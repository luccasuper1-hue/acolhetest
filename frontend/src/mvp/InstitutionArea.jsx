import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, UserPlus } from "lucide-react";
import { MvpShell, MvpCard, MvpEmpty, MvpKpi } from "./MvpShell";
import { api, apiError, formatDate } from "./api";

export default function InstitutionArea() {
  const [metrics, setMetrics] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [institution, setInstitution] = useState(null);
  const [invite, setInvite] = useState({ name: "", email: "", link_type: "institution", specialty: "" });
  const [inviteLink, setInviteLink] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [profile, setProfile] = useState({ name: "", contact_email: "", support_note: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/institutions/me/dashboard");
      setMetrics(data.metrics); setProfessionals(data.professionals || []); setCertificates(data.certificates || []); setInstitution(data.institution);
      setProfile({ name: data.institution?.name || "", contact_email: data.institution?.contact_email || "", support_note: data.institution?.support_note || "" });
      setLoadError("");
    } catch (error) {
      setLoadError(apiError(error));
      throw error;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load().catch(e => toast.error(apiError(e))); }, [load]);

  const submitInvite = async e => {
    e.preventDefault();
    if (inviteBusy) return;
    setInviteBusy(true);
    try {
      const { data } = await api.post("/institutions/me/professionals", { ...invite, specialty: invite.specialty || null });
      setInviteLink(`${window.location.origin}${data.invite_path}`);
      toast.success("Convite criado.", { description: "O profissional define a própria senha ao abrir o link." });
      setInvite({ name: "", email: "", link_type: "institution", specialty: "" });
      await load();
    } catch (err) { toast.error(apiError(err)); }
    finally { setInviteBusy(false); }
  };

  const saveProfile = async e => {
    e.preventDefault();
    if (profileBusy) return;
    setProfileBusy(true);
    try {
      await api.put("/institutions/me", { ...profile, contact_email: profile.contact_email || null, support_note: profile.support_note || null });
      toast.success("Informações atualizadas.");
      await load();
    } catch (err) { toast.error(apiError(err)); }
    finally { setProfileBusy(false); }
  };

  const linkedProfessionals = metrics?.professionals_linked || 0;
  const scheduledRequests = metrics?.sessions_scheduled || 0;
  const hasActivity = Boolean(metrics?.has_data) || (metrics?.requests_total || 0) > 0 || (metrics?.sessions_completed || 0) > 0;
  const nextStep = !linkedProfessionals
    ? "Convide um profissional para começar"
    : "Os estudantes já podem enviar pedidos diretamente aos profissionais";
  const copyStudentCode = async () => {
    try { await navigator.clipboard.writeText(institution?.code || ""); toast.success("Código copiado."); }
    catch { toast.error("Não foi possível copiar o código."); }
  };

  return (
    <MvpShell
      testid="institution-area"
      kicker="Painel institucional · piloto"
      title={<>Seu piloto, <em>em movimento.</em></>}
      lead="Acompanhe a operação sem acessar dados individuais: a instituição nunca vê quem conversou ou o conteúdo das conversas."
      flow={["Vincule profissionais", "Acompanhe indicadores", "Revise o piloto"]}
      collapsePassword
      hideIdentity
      loading={loading}
      error={loadError}
      onRetry={() => { setLoading(true); return load(); }}
      onRefresh={load}
    >
      <MvpCard title="Situação do piloto" subtitle={nextStep} testid="inst-next-step-card" className="institution-next-step">
        <div className="institution-readiness" aria-live="polite">
          <div><span className={linkedProfessionals ? "ready" : "pending"}>{linkedProfessionals ? "Pronto" : "Atenção"}</span><strong>Profissional vinculado</strong><small>{linkedProfessionals ? `${linkedProfessionals} profissional(is) na instituição.` : "Ainda não há profissional vinculado."}</small></div>
          <div><span className={scheduledRequests ? "ready" : "waiting"}>{scheduledRequests ? "Ativo" : "Aguardando"}</span><strong>Conversas agendadas</strong><small>{scheduledRequests ? `${scheduledRequests} conversa(s) agendada(s).` : "Ainda não há conversas agendadas."}</small></div>
          <div><span className={linkedProfessionals ? "ready" : "pending"}>{linkedProfessionals ? "Ativo" : "Atenção"}</span><strong>Pedidos de estudantes</strong><small>{linkedProfessionals ? "Estudantes podem escolher um profissional e enviar um pedido." : "Vincule um profissional para liberar os pedidos."}</small></div>
        </div>
      </MvpCard>

      <MvpCard title="Guia rápido do piloto" subtitle="Veja o passo a passo da configuração, privacidade e operação." testid="inst-onboarding-card" className="institution-onboarding-card">
        <p>Use este roteiro para preparar a equipe sem depender de suporte a cada ação.</p>
        <a className="button secondary small" href="/ajuda/instituicoes" data-testid="inst-onboarding-link">Abrir guia institucional <ExternalLink size={14} /></a>
      </MvpCard>

      <MvpCard title={linkedProfessionals ? "Adicionar outro profissional" : "Vincular profissional"} subtitle="Crie um convite. O profissional define a própria senha ao abrir o link; depois, compartilhe-o diretamente." testid="inst-invite-card" className="institution-primary-action">
        <form className="mvp-inline-form" onSubmit={submitInvite}>
          <label>Nome<input required maxLength={120} autoComplete="name" value={invite.name} onChange={e => setInvite({ ...invite, name: e.target.value })} data-testid="invite-name-input" /></label>
          <label>E-mail<input type="email" required maxLength={160} autoComplete="email" value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} data-testid="invite-email-input" /></label>
          <label>Vínculo
            <select value={invite.link_type} onChange={e => setInvite({ ...invite, link_type: e.target.value })} data-testid="invite-link-type-select">
              <option value="institution">Profissional da instituição</option>
              <option value="partner">Profissional parceiro Acolhe</option>
            </select>
          </label>
          <label>Atuação (opcional)<input maxLength={120} value={invite.specialty} onChange={e => setInvite({ ...invite, specialty: e.target.value })} data-testid="invite-specialty-input" /></label>
          <button type="submit" className="button primary" disabled={inviteBusy} aria-busy={inviteBusy} data-testid="invite-submit-button">{inviteBusy ? "Criando…" : "Criar convite"} {!inviteBusy && <UserPlus size={15} />}</button>
        </form>
        {inviteLink && (
          <div className="mvp-invite-result" data-testid="invite-link-result">
            <p className="mvp-ok">Convite criado. Link válido por 14 dias:</p>
            <code>{inviteLink}</code>
            <button className="button secondary small" type="button" aria-label="Copiar link do convite" onClick={async () => { try { await navigator.clipboard.writeText(inviteLink); toast.success("Link copiado."); } catch { toast.error("Não foi possível copiar o link."); } }} data-testid="invite-copy-button">Copiar link</button>
          </div>
        )}
      </MvpCard>

      <MvpCard title="Acesso dos estudantes" subtitle="Compartilhe este código com os estudantes da sua instituição." testid="inst-student-access-card" className="institution-student-access">
        <div className="institution-code"><code aria-label="Código da instituição">{institution?.code || "—"}</code><button className="button small secondary" type="button" aria-label="Copiar código da instituição" onClick={copyStudentCode} disabled={!institution?.code} data-testid="inst-copy-code-button">Copiar código <Copy size={14} /></button></div>
      </MvpCard>

      {hasActivity && <><details className="mvp-security-details institution-metrics-details" open data-testid="inst-metrics-card">
        <summary>Indicadores do piloto <span>Ver métricas gerais</span></summary>
        <div className="mvp-kpis institution-kpis">
        <MvpKpi label="Estudantes cadastrados" value={metrics?.students_registered} testid="inst-kpi-students" />
        <MvpKpi label="Estudantes que acessaram" value={metrics?.students_accessed} note="login efetivo" testid="inst-kpi-accessed" />
        <MvpKpi label="Ativos (30 dias)" value={metrics?.students_active_30d} testid="inst-kpi-active" />
        <MvpKpi label="Estudantes que solicitaram" value={metrics?.students_requested} testid="inst-kpi-requesting" />
        <MvpKpi label="Solicitações" value={metrics?.requests_total} testid="inst-kpi-requests" />
        <MvpKpi label="Conversas realizadas" value={metrics?.sessions_completed} testid="inst-kpi-sessions" />
        <MvpKpi label="Tempo médio até resposta" value={metrics?.response_time_minutes_avg == null ? "—" : `${Math.round(metrics.response_time_minutes_avg)} min`} note={metrics?.responses_within_48h == null ? "aguardando dados" : `${metrics.responses_within_48h}% em até 48h`} testid="inst-kpi-response-time" />
        <MvpKpi label="Comparecimento" value={metrics?.attendance_rate == null ? "—" : `${metrics.attendance_rate}%`} note={metrics?.sessions_no_show ? `${metrics.sessions_no_show} ausência(s)` : "sem ausências registradas"} testid="inst-kpi-attendance" />
        <MvpKpi label="Profissionais vinculados" value={metrics?.professionals_linked} note={`${metrics?.professionals_accessed ?? 0} já acessaram`} testid="inst-kpi-professionals" />
        <MvpKpi label="Encaminhamentos" value={metrics?.referrals_total} testid="inst-kpi-referrals" />
        </div>
      </details>

      <div className="mvp-grid">
        <MvpCard title="Solicitações por período" subtitle="Solicitações por mês (dados do piloto)." testid="inst-usage-card">
          {metrics?.requests_by_month?.length ? metrics.requests_by_month.map(u => (
            <div className="mvp-row" key={u.month} data-testid={`inst-usage-${u.month}`}>
              <div className="mvp-row-main"><strong>{u.month}</strong><span>{u.requests} solicitações</span></div>
            </div>
          )) : <MvpEmpty testid="inst-usage-empty" />}
        </MvpCard>

        <MvpCard title="Situação das solicitações" subtitle="Contagens administrativas, sem conteúdo." testid="inst-status-card">
          {metrics ? (
            <>
              <div className="mvp-row"><div className="mvp-row-main"><strong>Aguardando profissional</strong></div><span className="mvp-tag wait">{metrics.requests_pending}</span></div>
              {metrics.requests_proposed > 0 && <div className="mvp-row"><div className="mvp-row-main"><strong>Aguardando confirmação do estudante</strong></div><span className="mvp-tag wait">{metrics.requests_proposed}</span></div>}
              <div className="mvp-row"><div className="mvp-row-main"><strong>Confirmadas</strong></div><span className="mvp-tag ok">{metrics.requests_scheduled}</span></div>
              <div className="mvp-row"><div className="mvp-row-main"><strong>Canceladas pelo estudante</strong></div><span className="mvp-tag off">{metrics.requests_cancelled}</span></div>
              <div className="mvp-row"><div className="mvp-row-main"><strong>Recusadas pelo profissional</strong></div><span className="mvp-tag off">{metrics.requests_declined}</span></div>
              <div className="mvp-row"><div className="mvp-row-main"><strong>Satisfação média (feedback)</strong><span>{metrics.feedback_count} respostas</span></div><span className="mvp-tag">{metrics.feedback_average ?? "—"}</span></div>
            </>
          ) : <MvpEmpty />}
        </MvpCard>
      </div></>}

      <div className="mvp-grid">
        <MvpCard title="Profissionais vinculados" testid="inst-professionals-card">
          {!professionals.length && <MvpEmpty testid="inst-professionals-empty">Nenhum profissional vinculado ainda.</MvpEmpty>}
          {professionals.map(p => (
            <div className="mvp-row" key={p.id} data-testid={`inst-professional-${p.id}`}>
              <div className="mvp-row-main">
                <strong>{p.name}</strong>
                <span>{p.link_type === "institution" ? "Da instituição" : "Parceiro Acolhe"} · {p.completed_sessions} conversas realizadas</span>
                <span className={p.active ? "institution-professional-ready" : "institution-professional-pending"}>{p.active ? "Pronto para receber pedidos" : "Aguardando ativação"}</span>
                {p.invite_pending && <span data-testid={`inst-invite-pending-${p.id}`}>Convite pendente: {window.location.origin}{p.invite_path}</span>}
              </div>
              <span className={`mvp-tag ${p.invite_pending ? "wait" : p.active ? "ok" : "off"}`}>
                {p.invite_pending ? "Convite pendente" : p.active ? "Ativo" : "Inativo"}
              </span>
            </div>
          ))}
        </MvpCard>

        <MvpCard title="Certificados dos profissionais" subtitle="Registros de participação vinculados à sua instituição. A administração é responsável por qualquer revogação." testid="inst-certificates-card">
          {!certificates.length && <MvpEmpty>Nenhum certificado emitido ainda.</MvpEmpty>}
          {certificates.map(certificate => (
            <div className="mvp-row" key={certificate.id} data-testid={`inst-certificate-${certificate.id}`}>
              <div className="mvp-row-main">
                <strong>{certificate.professional_name}</strong>
                <span>{certificate.code} · {certificate.completed_count} conversas concluídas</span>
                <small>Emitido em {formatDate(certificate.issued_at)}</small>
              </div>
              <div className="mvp-row-actions">
                <span className={`mvp-tag ${certificate.status === "valid" ? "ok" : "off"}`}>{certificate.status === "valid" ? "Válido" : "Revogado"}</span>
                {certificate.status === "valid" && <a className="button small quiet" href={`/validar-certificado/${encodeURIComponent(certificate.code)}`} target="_blank" rel="noreferrer" data-testid={`inst-validate-certificate-${certificate.id}`}><ExternalLink size={14}/> Validar</a>}
              </div>
            </div>
          ))}
        </MvpCard>

      </div>

      <details className="mvp-security-details institution-settings" data-testid="inst-profile-card">
        <summary>Informações da instituição <span>Editar dados e apoio</span></summary>
        <p>Plano piloto sem cobrança. Atualize apenas dados administrativos e de contato.</p>
        <form className="mvp-inline-form" onSubmit={saveProfile}>
          <label>Nome<input maxLength={160} autoComplete="organization" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} data-testid="inst-name-input" /></label>
          <label>E-mail de contato<input type="email" maxLength={160} autoComplete="email" value={profile.contact_email} onChange={e => setProfile({ ...profile, contact_email: e.target.value })} data-testid="inst-email-input" /></label>
          <label>Observação de apoio<input maxLength={400} value={profile.support_note} onChange={e => setProfile({ ...profile, support_note: e.target.value })} data-testid="inst-note-input" /></label>
          <button className="button secondary" disabled={profileBusy} aria-busy={profileBusy} data-testid="inst-save-button">{profileBusy ? "Salvando…" : "Salvar"}</button>
        </form>
      </details>
    </MvpShell>
  );
}
