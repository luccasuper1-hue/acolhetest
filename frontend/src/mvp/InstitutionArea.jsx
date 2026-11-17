import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, UserPlus } from "lucide-react";
import { MvpShell, MvpCard, MvpEmpty, MvpKpi } from "./MvpShell";
import { api, apiError, formatDate } from "./api";

export default function InstitutionArea() {
  const [metrics, setMetrics] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [fallbackRequests, setFallbackRequests] = useState([]);
  const [minorRegistrations, setMinorRegistrations] = useState([]);
  const [impactReport, setImpactReport] = useState(null);
  const [institution, setInstitution] = useState(null);
  const [invite, setInvite] = useState({ name: "", email: "", link_type: "institution", specialty: "" });
  const [inviteLink, setInviteLink] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [profile, setProfile] = useState({ name: "", contact_email: "", support_note: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [fallbackBusy, setFallbackBusy] = useState(null);
  const [baselineBusy, setBaselineBusy] = useState(false);
  const mutationBusyRef = useRef(false);
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    try {
      const { data } = await api.get("/institutions/me/dashboard");
      if (requestId !== loadRequestRef.current) return;
      setMetrics(data.metrics); setImpactReport(data.impact_report || null); setProfessionals(data.professionals || []); setCertificates(data.certificates || []); setFallbackRequests(data.fallback_requests || []); setMinorRegistrations(data.minor_registrations || []); setInstitution(data.institution);
      setProfile({ name: data.institution?.name || "", contact_email: data.institution?.contact_email || "", support_note: data.institution?.support_note || "" });
      setLoadError("");
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setLoadError(apiError(error));
      throw error;
    } finally { if (requestId === loadRequestRef.current) setLoading(false); }
  }, []);

  useEffect(() => { load().catch(e => toast.error(apiError(e))); }, [load]);

  const submitInvite = async e => {
    e.preventDefault();
    if (inviteBusy || mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    setInviteBusy(true);
    try {
      const { data } = await api.post("/institutions/me/professionals", { ...invite, specialty: invite.specialty || null });
      setInviteLink(`${window.location.origin}${data.invite_path}`);
      toast.success("Convite criado.", { description: "O profissional define a própria senha ao abrir o link." });
      setInvite({ name: "", email: "", link_type: "institution", specialty: "" });
      await load();
    } catch (err) { toast.error(apiError(err)); }
    finally { mutationBusyRef.current = false; setInviteBusy(false); }
  };

  const saveProfile = async e => {
    e.preventDefault();
    if (profileBusy || mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    setProfileBusy(true);
    try {
      await api.put("/institutions/me", { ...profile, contact_email: profile.contact_email || null, support_note: profile.support_note || null });
      toast.success("Informações atualizadas.");
      await load();
    } catch (err) { toast.error(apiError(err)); }
    finally { mutationBusyRef.current = false; setProfileBusy(false); }
  };

  const onboardingSteps = [
    ["professionals", "Vincular pelo menos um profissional"],
    ["access", "Compartilhar o código com os estudantes"],
    ["privacy", "Revisar privacidade e responsabilidades com a equipe"],
    ["flow", "Testar um pedido até a confirmação"],
    ["support", "Definir quem acompanha pedidos atrasados"],
  ];
  const completedOnboarding = new Set(institution?.onboarding_steps || []);
  const toggleOnboarding = async step => {
    if (mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    const next = new Set(completedOnboarding);
    if (next.has(step)) next.delete(step); else next.add(step);
    try { await api.put("/institutions/me", { onboarding_steps: [...next] }); setInstitution(current => ({ ...current, onboarding_steps: [...next] })); }
    catch (err) { toast.error(apiError(err)); }
    finally { mutationBusyRef.current = false; }
  };
  const reviewFallback = async (requestId, action) => {
    if (fallbackBusy || mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    setFallbackBusy(`${requestId}:${action}`);
    try { await api.post(`/institutions/me/requests/${encodeURIComponent(requestId)}/fallback`, { action }); toast.success("Próximo passo registrado."); await load(); }
    catch (err) { toast.error(apiError(err)); }
    finally { mutationBusyRef.current = false; setFallbackBusy(null); }
  };
  const approveMinor = async userId => {
    if (mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    try { await api.post(`/institutions/me/minor-registrations/${encodeURIComponent(userId)}/approve`, {}); toast.success("Cadastro infantil liberado após validação."); await load(); }
    catch (err) { toast.error(apiError(err)); }
    finally { mutationBusyRef.current = false; }
  };
  const captureBaseline = async () => {
    if (baselineBusy || mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    setBaselineBusy(true);
    try { const { data } = await api.post("/institutions/me/impact/baseline", {}); setImpactReport(data); toast.success("Linha de base registrada."); await load(); }
    catch (err) { toast.error(apiError(err)); }
    finally { mutationBusyRef.current = false; setBaselineBusy(false); }
  };
  const exportImpactReport = () => {
    if (!impactReport?.metrics?.length) return;
    const rows = [["Relatório de impacto Acolhe"], ["Período", `${impactReport.period_start || "—"} a ${impactReport.period_end || "—"}`], ["Aviso", "Dados agregados; sem identificadores; variação observada, sem prova de causalidade."], [], ["Indicador", "Linha de base", "Atual", "Variação observada"], ...impactReport.metrics.map(item => [item.label, item.baseline ?? "—", item.current ?? "—", item.delta == null ? "—" : item.delta])];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "relatorio-impacto-acolhe.csv"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

      {minorRegistrations.length > 0 && <MvpCard title="Cadastros infantis para validar" subtitle="Confirme o responsável legal conforme a política da instituição antes de liberar o acesso." testid="inst-minor-review-card">
        {minorRegistrations.map(item => <div className="mvp-row" key={item.id}><div className="mvp-row-main"><strong>{item.name}</strong><span>Responsável informado: {item.guardian_name} · {item.guardian_email}</span><small>Recebido em {formatDate(item.created_at)}</small></div><button type="button" className="button small primary" onClick={() => approveMinor(item.id)}>Liberar acesso</button></div>)}
      </MvpCard>}

      <MvpCard title="Guia rápido do piloto" subtitle="Veja o passo a passo da configuração, privacidade e operação." testid="inst-onboarding-card" className="institution-onboarding-card">
        <p>Use este roteiro para preparar a equipe em um dia, sem depender de suporte a cada ação.</p>
        <div className="institution-onboarding-checklist" aria-label="Checklist de implantação">
          {onboardingSteps.map(([step, label]) => <label key={step} className="institution-check-item"><input type="checkbox" checked={completedOnboarding.has(step)} onChange={() => toggleOnboarding(step)} /><span>{label}</span></label>)}
        </div>
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
        <MvpKpi label="Tempo médio até resposta" value={metrics?.response_time_minutes_avg == null ? "—" : `${Math.round(metrics.response_time_minutes_avg)} min`} note={metrics?.response_time_minutes_avg == null ? `aguardando ${metrics?.minimum_sample_size ?? 5} casos` : `${metrics.responses_within_48h}% em até 48h`} testid="inst-kpi-response-time" />
        <MvpKpi label="Comparecimento" value={metrics?.attendance_rate == null ? "—" : `${metrics.attendance_rate}%`} note={metrics?.attendance_rate == null ? `aguardando ${metrics?.minimum_sample_size ?? 5} encontros` : (metrics?.sessions_no_show ? `${metrics.sessions_no_show} ausência(s)` : "sem ausências registradas")} testid="inst-kpi-attendance" />
        <MvpKpi label="Profissionais vinculados" value={metrics?.professionals_linked} note={`${metrics?.professionals_accessed ?? 0} já acessaram`} testid="inst-kpi-professionals" />
        <MvpKpi label="Encaminhamentos" value={metrics?.referrals_total} testid="inst-kpi-referrals" />
        </div>
      </details>

      <MvpCard title="Relatório do piloto" subtitle="Leitura operacional, sem avaliação clínica ou ranking de profissionais." testid="inst-impact-report-card" aria-live="polite">
        <div className="mvp-row"><div className="mvp-row-main"><strong>Período atual</strong><span>{metrics?.metrics_period_label || "Desde o início do piloto"}</span></div><span className="mvp-tag">{metrics?.requests_total || 0} pedidos</span></div>
        <div className="mvp-row"><div className="mvp-row-main"><strong>Linha de base</strong><span>{metrics?.baseline_available ? "Disponível para comparação" : "Ainda não registrada"}</span></div><span className="mvp-tag wait">{metrics?.baseline_available ? "PRONTA" : "PENDENTE"}</span></div>
        <p className="mvp-note">As métricas de velocidade e comparecimento só aparecem com pelo menos {metrics?.minimum_sample_size ?? 5} casos. O período e a população são registrados em cada comparação. As 48 horas são uma meta operacional do piloto, não uma garantia clínica, de disponibilidade ou de resultado terapêutico.</p>
        <div className="impact-report-actions">
            {!impactReport?.baseline_available ? <><p className="mvp-note">Registre uma linha de base antes de iniciar o uso ampliado para medir a evolução do piloto.</p><button className="button primary small" type="button" onClick={captureBaseline} disabled={baselineBusy} aria-busy={baselineBusy} data-testid="inst-capture-baseline">{baselineBusy ? "Registrando…" : "Registrar linha de base"}</button></> : <><div className="mvp-row"><div className="mvp-row-main"><strong>Variação observada</strong><span>{impactReport.period_start} a {impactReport.period_end} · base registrada em {formatDate(impactReport.captured_at)}</span></div><span className="mvp-tag ok">ATIVA</span></div><p className="mvp-note">{impactReport.interpretation}</p><div className="mvp-row"><div className="mvp-row-main"><strong>População observada</strong><span>Antes: {impactReport.population?.baseline?.requests ?? "—"} pedidos · Agora: {impactReport.population?.current?.requests ?? "—"} pedidos</span></div><span className="mvp-tag">Agregado</span></div><div className="impact-report-table">{impactReport.metrics.map(item => <div className="mvp-row" key={item.key}><div className="mvp-row-main"><strong>{item.label}</strong><span>Antes: {item.baseline ?? "—"} · Agora: {item.current ?? "—"}</span></div><span className={`mvp-tag ${item.delta == null ? "wait" : item.delta > 0 ? "ok" : item.delta < 0 ? "off" : ""}`}>{item.delta == null ? "—" : `${item.delta > 0 ? "+" : ""}${item.delta}`}</span></div>)}</div><button className="button secondary small" type="button" onClick={exportImpactReport} aria-label="Exportar relatório de impacto agregado em CSV" data-testid="inst-export-impact">Exportar CSV agregado</button></>}
        </div>
      </MvpCard>

      <div className="mvp-grid institution-operations-grid">
        <MvpCard title="Capacidade e gargalos" subtitle="Visão agregada dos horários e da fila operacional." testid="inst-capacity-card">
          <div className="mvp-row"><div className="mvp-row-main"><strong>Horários disponíveis</strong><span>{metrics?.capacity_open_slots || 0} livres para novos pedidos</span></div><span className="mvp-tag ok">{metrics?.capacity_open_slots || 0}</span></div>
          <div className="mvp-row"><div className="mvp-row-main"><strong>Capacidade utilizada</strong><span>{metrics?.capacity_utilization_percent == null ? "Sem horários publicados" : `${metrics.capacity_utilization_percent}% dos horários reservados`}</span></div><span className="mvp-tag">{metrics?.capacity_reserved_slots || 0}</span></div>
          <div className="mvp-row"><div className="mvp-row-main"><strong>Gargalos de resposta</strong><span>{metrics?.requests_overdue || 0} pedidos ultrapassaram 48 horas</span></div><span className={`mvp-tag ${(metrics?.requests_overdue || 0) ? "off" : "ok"}`}>{metrics?.requests_overdue || 0}</span></div>
        </MvpCard>

        <MvpCard title="Continuidade do cuidado" subtitle="Registro operacional após a conversa, sem conteúdo clínico." testid="inst-continuity-card">
          {Object.entries(metrics?.referrals_by_status || {}).length ? Object.entries(metrics.referrals_by_status).map(([status, count]) => <div className="mvp-row" key={status}><div className="mvp-row-main"><strong>{({ orientacao: "Orientação registrada", encaminhamento_interno: "Encaminhamento interno", encaminhamento_externo: "Encaminhamento externo", sem_encaminhamento: "Sem encaminhamento" })[status] || status}</strong></div><span className="mvp-tag">{count}</span></div>) : <MvpEmpty testid="inst-continuity-empty">Nenhum desfecho operacional registrado ainda.</MvpEmpty>}
        </MvpCard>
      </div>

      {fallbackRequests.length > 0 && <MvpCard title="Pedidos que precisam de um próximo passo" subtitle="A instituição decide manualmente como apoiar; nada é redistribuído sem consentimento." testid="inst-fallback-card" className="institution-fallback-card">
        {fallbackRequests.map(item => <div className="mvp-row" key={item.id} data-testid={`inst-fallback-${item.id}`}><div className="mvp-row-main"><strong>Pedido sem resposta no prazo</strong><span>Criado em {formatDate(item.created_at)} · {item.kind === "direct" ? "pedido direto" : "horário publicado"}</span><small className="mvp-next-step">Defina um contato, uma alternativa ou a fila de apoio.</small></div><div className="mvp-row-actions"><button type="button" className="button small quiet" disabled={fallbackBusy} onClick={() => reviewFallback(item.id, "contact_student")}>Contatar estudante</button><button type="button" className="button small secondary" disabled={fallbackBusy} onClick={() => reviewFallback(item.id, "offer_other_professional")}>Oferecer alternativa</button><button type="button" className="button small secondary" disabled={fallbackBusy} onClick={() => reviewFallback(item.id, "queue_support")}>Fila de apoio</button></div></div>)}
      </MvpCard>}

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
              {metrics.requests_due_soon > 0 && <div className="mvp-row"><div className="mvp-row-main"><strong>Prazo próximo de vencer</strong><span>Acompanhar resposta do profissional</span></div><span className="mvp-tag wait">{metrics.requests_due_soon}</span></div>}
              {metrics.requests_overdue > 0 && <div className="mvp-row"><div className="mvp-row-main"><strong>Pedidos sem resposta no prazo</strong><span>Definir próximo passo com o estudante</span></div><span className="mvp-tag off">{metrics.requests_overdue}</span></div>}
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
          <button type="submit" className="button secondary" disabled={profileBusy} aria-busy={profileBusy} data-testid="inst-save-button">{profileBusy ? "Salvando…" : "Salvar"}</button>
        </form>
      </details>
    </MvpShell>
  );
}
