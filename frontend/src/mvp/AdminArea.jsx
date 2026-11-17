import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Archive, Ban, Building2, Check, Mail, RotateCcw, Trash2 } from "lucide-react";
import { MvpShell, MvpCard, MvpEmpty, MvpKpi } from "./MvpShell";
import { api, apiError, formatDate, formatDateTime, STATUS_LABELS } from "./api";

export default function AdminArea() {
  const [users, setUsers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [archivedInstitutions, setArchivedInstitutions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leads, setLeads] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [leadFilter, setLeadFilter] = useState("active");
  const [userQuery, setUserQuery] = useState("");
  const [certificateQuery, setCertificateQuery] = useState("");
  const [userRole, setUserRole] = useState("all");
  const [userState, setUserState] = useState("all");
  const [form, setForm] = useState({ name: "", code: "", admin_name: "", admin_email: "", admin_password: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const busyActionRef = useRef(false);
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    try {
      const { data } = await api.get("/admin/dashboard");
      if (requestId !== loadRequestRef.current) return;
      setUsers(data.users || []); setInstitutions(data.institutions || []); setArchivedInstitutions(data.archived_institutions || []); setRequests(data.requests || []); setLeads(data.leads || []); setCertificates(data.certificates || []); setMetrics(data.metrics || null);
      setLoadError("");
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setLoadError(apiError(error));
      throw error;
    } finally { if (requestId === loadRequestRef.current) setLoading(false); }
  }, []);

  useEffect(() => { load().catch(e => toast.error(apiError(e))); }, [load]);

  const runAction = async (key, action, successMessage) => {
    if (busyActionRef.current) return;
    busyActionRef.current = true;
    setBusyAction(key);
    try { await action(); if (successMessage) toast.success(successMessage); await load(); }
    catch (e) { toast.error(apiError(e)); }
    finally { busyActionRef.current = false; setBusyAction(""); }
  };

  const toggle = async id => {
    await runAction(`user:${id}`, () => api.post(`/admin/users/${id}/toggle-active`), "Acesso atualizado.");
  };

  const removeUser = async user => {
    if (!window.confirm(`Excluir permanentemente a conta de ${user.name}? Esta ação remove o acesso e os registros operacionais vinculados e não pode ser desfeita.`)) return;
    await runAction(`delete-user:${user.id}`, () => api.delete(`/admin/users/${user.id}`, { data: {}, headers: { "content-type": "application/json" } }), "Conta excluída.");
  };

  const updateLead = async (id, status) => {
    await runAction(`lead:${id}:${status}`, async () => {
      const { data } = await api.post(`/admin/leads/${id}/status`, { status });
      const success = status === "approved" && data.account_created ? "Instituição aprovada e acesso do gestor criado." : status === "contacted" ? "Interesse marcado como contatado." : "Interesse atualizado.";
      toast.success(success);
    });
  };

  const removeLead = async lead => {
    const label = lead.kind === "institution" ? lead.institution || lead.name : lead.name;
    if (!window.confirm(`Excluir permanentemente o interesse de ${label}? Esta ação não pode ser desfeita.`)) return;
    await runAction(`delete-lead:${lead.id}`, () => api.delete(`/admin/leads/${lead.id}`, { data: {}, headers: { "content-type": "application/json" } }), "Interesse excluído.");
  };

  const createInstitution = async e => {
    e.preventDefault();
    await runAction("create-institution", async () => {
      await api.post("/admin/institutions", {
          name: form.name, code: form.code.toUpperCase(),
          admin_name: form.admin_name || null,
          admin_email: form.admin_email || null,
          admin_password: form.admin_password || null,
        });
        toast.success("Instituição criada.");
        setForm({ name: "", code: "", admin_name: "", admin_email: "", admin_password: "" });
    });
  };

  const archiveInstitution = async institution => {
    if (!window.confirm(`Arquivar ${institution.name}? Ela sairá da lista ativa e os acessos vinculados serão bloqueados. O histórico será preservado e a instituição poderá ser reativada depois.`)) return;
    await runAction(`archive-institution:${institution.id}`, () => api.delete(`/admin/institutions/${institution.id}`, { data: {}, headers: { "content-type": "application/json" } }), "Instituição arquivada.");
  };

  const restoreInstitution = async institution => {
    if (!window.confirm(`Reativar ${institution.name}? Os acessos vinculados voltarão a funcionar.`)) return;
    await runAction(`restore-institution:${institution.id}`, () => api.post(`/admin/institutions/${institution.id}/restore`, {}), "Instituição reativada.");
  };

  const revokeCertificate = async certificate => {
    if (!window.confirm(`Revogar o certificado ${certificate.code}? O QR Code deixará de validar publicamente.`)) return;
    await runAction(`revoke-certificate:${certificate.id}`, () => api.post(`/admin/certificates/${certificate.id}/revoke`, {}), "Certificado revogado.");
  };

  const visibleLeads = leads.filter(lead => leadFilter === "all" ? true : leadFilter === "active" ? ["approved", "contacted"].includes(lead.status) : lead.status === leadFilter);
  const roleLabel = { admin: "Administrador", institution: "Instituição", professional: "Profissional", student: "Estudante" };
  const pendingLeads = leads.filter(lead => lead.status === "pending");
  const studentsRegistered = metrics?.students_registered || 0;
  const studentsAccessed = metrics?.students_accessed || 0;
  const visibleUsers = users.filter(user => {
    const query = userQuery.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery = !query || [user.name, user.email, user.institution_name].filter(Boolean).some(value => value.toLocaleLowerCase("pt-BR").includes(query));
    return matchesQuery && (userRole === "all" || user.role === userRole) && (userState === "all" || (userState === "active" ? user.active : !user.active));
  });
  const visibleCertificates = certificates.filter(certificate => certificateQuery.trim() === "" || [certificate.code, certificate.professional_name, certificate.institution_name].filter(Boolean).some(value => value.toLocaleLowerCase("pt-BR").includes(certificateQuery.trim().toLocaleLowerCase("pt-BR"))));

  return (
    <MvpShell
      testid="admin-area"
      kicker="Administração do piloto"
      title={<>Operação do <em>piloto Acolhe.</em></>}
      lead="Revise pendências, acompanhe a ativação do piloto e administre acessos em um só lugar."
      collapsePassword
      hideIdentity
      loading={loading}
      error={loadError}
      onRetry={() => { setLoading(true); return load(); }}
      onRefresh={load}
    >
      <MvpCard title="Situação operacional" subtitle={pendingLeads.length ? `${pendingLeads.length} pendência(s) aguardando revisão.` : "Nenhuma pendência crítica aguardando revisão."} testid="admin-operations-card" className="admin-operations-card" aria-live="polite">
        <div className="admin-operations-grid">
          <div><span className={pendingLeads.length ? "pending" : "ready"}>{pendingLeads.length ? "Revisar agora" : "Em dia"}</span><strong>Interesses recebidos</strong><small>{pendingLeads.length ? `${pendingLeads.length} interesse(s) pendente(s) de decisão.` : "Nenhum interesse pendente."}</small></div>
          <div><span className={studentsRegistered && studentsAccessed < studentsRegistered ? "pending" : "ready"}>{studentsRegistered ? `${studentsAccessed}/${studentsRegistered}` : "—"}</span><strong>Acesso dos estudantes</strong><small>{studentsRegistered ? "Estudantes que já entraram na plataforma." : "Aguardando os primeiros cadastros."}</small></div>
          <div><span className={(metrics?.professionals || 0) ? "ready" : "pending"}>{metrics?.professionals || 0}</span><strong>Profissionais cadastrados</strong><small>{metrics?.pending_invites || 0} convite(s) ainda pendente(s).</small></div>
        </div>
      </MvpCard>

      <MvpCard title="Pendências para revisar" subtitle="Interesses recentes que precisam de uma decisão administrativa." testid="admin-pending-leads-card" className="admin-leads-card admin-pending-leads-card">
        {!pendingLeads.length && <MvpEmpty>Está tudo em dia. Novos interesses aparecerão aqui para decisão.</MvpEmpty>}
        {pendingLeads.map(lead => (
          <div className="mvp-row" key={lead.id} data-testid={`admin-pending-lead-${lead.id}`}>
            <div className="mvp-row-main"><strong>{lead.kind === "institution" ? lead.institution : lead.name}</strong><span>{lead.kind === "institution" ? `${lead.name} · ${lead.email}` : `${lead.profession} · ${lead.email}`}</span></div>
            <div className="mvp-row-actions">
              {lead.kind === "institution" && <button type="button" className="button small secondary" disabled={Boolean(busyAction)} onClick={() => updateLead(lead.id, "approved")}><Check size={14}/> Aprovar instituição</button>}
              {lead.kind === "professional" && <button type="button" className="button small secondary" disabled={Boolean(busyAction)} onClick={() => updateLead(lead.id, "contacted")}><Mail size={14}/> Marcar contatado</button>}
              <button type="button" className="button small quiet" disabled={Boolean(busyAction)} onClick={() => updateLead(lead.id, "rejected")}><Ban size={14}/> Rejeitar</button>
            </div>
          </div>
        ))}
      </MvpCard>

      <details className="mvp-security-details admin-metrics-details" data-testid="admin-metrics-card">
        <summary>Indicadores do piloto <span>Ver métricas gerais</span></summary>
        <div className="mvp-kpis">
        <MvpKpi label="Instituições" value={metrics?.institutions} testid="admin-kpi-institutions" />
        <MvpKpi label="Usuários" value={metrics?.users} testid="admin-kpi-users" />
        <MvpKpi label="Estudantes cadastrados" value={metrics?.students_registered} testid="admin-kpi-students" />
        <MvpKpi label="Estudantes que acessaram" value={metrics?.students_accessed} testid="admin-kpi-accessed" />
        <MvpKpi label="Profissionais" value={metrics?.professionals} note={`${metrics?.pending_invites ?? 0} convites pendentes`} testid="admin-kpi-professionals" />
        <MvpKpi label="Solicitações" value={metrics?.requests} testid="admin-kpi-requests" />
        <MvpKpi label="Conversas realizadas" value={metrics?.sessions_completed} testid="admin-kpi-sessions" />
        </div>
      </details>

      <MvpCard title="Certificados emitidos" subtitle="Consulte os certificados públicos e revogue registros quando necessário." testid="admin-certificates-card" className="admin-certificates-card">
        <div className="admin-user-filters" aria-label="Buscar certificados">
          <label className="admin-user-search">Buscar por código, profissional ou instituição<input type="search" value={certificateQuery} onChange={e => setCertificateQuery(e.target.value)} placeholder="Buscar certificados" data-testid="admin-certificate-search-input" /></label>
        </div>
        {!visibleCertificates.length && <MvpEmpty>Nenhum certificado encontrado.</MvpEmpty>}
        {visibleCertificates.map(certificate => (
          <div className="mvp-row" key={certificate.id} data-testid={`admin-certificate-${certificate.id}`}>
            <div className="mvp-row-main">
              <strong>{certificate.professional_name}</strong>
              <span>{certificate.code} · {certificate.institution_name}</span>
              <small>{certificate.completed_count} conversas concluídas · Emitido em {formatDate(certificate.issued_at)}</small>
            </div>
            <div className="mvp-row-actions">
              <span className={`mvp-tag ${certificate.status === "valid" ? "ok" : "off"}`}>{certificate.status === "valid" ? "Válido" : "Revogado"}</span>
              {certificate.status === "valid" && <button type="button" className="button small quiet danger" disabled={Boolean(busyAction)} onClick={() => revokeCertificate(certificate)} data-testid={`admin-revoke-certificate-${certificate.id}`}><Ban size={14}/> Revogar</button>}
            </div>
          </div>
        ))}
      </MvpCard>

      <details className="mvp-security-details admin-manual-institution" data-testid="admin-institution-form">
        <summary>Criar instituição manualmente <span>Uso excepcional</span></summary>
        <p>Use apenas quando o cadastro não vier pelo fluxo de interesse institucional aprovado.</p>
        <form className="mvp-inline-form" onSubmit={createInstitution}>
          <label>Nome<input required autoComplete="off" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="admin-inst-name-input" /></label>
          <label>Código<input required autoComplete="off" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} data-testid="admin-inst-code-input" /></label>
          <label>Gestor (nome)<input autoComplete="off" value={form.admin_name} onChange={e => setForm({ ...form, admin_name: e.target.value })} data-testid="admin-inst-manager-input" /></label>
          <label>Gestor (e-mail)<input type="email" autoComplete="off" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} data-testid="admin-inst-manager-email-input" /></label>
          <label>Gestor (senha)<input type="password" autoComplete="new-password" minLength={8} value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} data-testid="admin-inst-manager-password-input" /></label>
          <button type="submit" className="button primary" disabled={busyAction === "create-institution"} data-testid="admin-create-institution-button">{busyAction === "create-institution" ? "Criando…" : "Criar"} <Building2 size={15} /></button>
        </form>
      </details>

      <MvpCard title="Histórico de interesses" subtitle="A fila de pendências fica acima; use os filtros para consultar aprovados, arquivados ou rejeitados." testid="admin-leads-card" className="admin-leads-card">
        <div className="admin-filter-bar" aria-label="Filtrar interesses">
          {[['all', 'Todos'], ['pending', 'Pendentes'], ['active', 'Aprovados/contatados'], ['archived', 'Arquivados'], ['rejected', 'Rejeitados']].map(([value, label]) => (
            <button type="button" key={value} className={leadFilter === value ? "active" : ""} aria-pressed={leadFilter === value} onClick={() => setLeadFilter(value)}>{label}{value === "pending" && leads.filter(l => l.status === "pending").length ? ` · ${leads.filter(l => l.status === "pending").length}` : ""}</button>
          ))}
        </div>
        {!visibleLeads.length && <MvpEmpty>Não há interesses nesta categoria. Tente outro filtro ou aguarde novas entradas.</MvpEmpty>}
        {visibleLeads.map(lead => (
          <div className="mvp-row" key={lead.id} data-testid={`admin-lead-${lead.id}`}>
            <div className="mvp-row-main">
              <strong>{lead.kind === "institution" ? lead.institution : lead.name}</strong>
              <span>{lead.kind === "institution" ? `Contato: ${lead.name} · ${lead.email}` : `${lead.profession} · ${lead.email}`}</span>
              <small>{lead.kind === "institution"
                ? `Instituição · ${lead.cargo || "cargo não informado"} · ${lead.students || "número de estudantes não informado"} estudantes`
                : `Profissional · ${lead.area || "área não informada"} · ${lead.region || "região não informada"}`}</small>
              <small>{formatDateTime(lead.created_at)}</small>
            </div>
            <div className="mvp-row-actions">
              <span className="mvp-tag">{lead.kind === "institution" ? "Instituição" : "Profissional"}</span>
              <span className={`mvp-tag ${lead.status === "approved" || lead.status === "contacted" ? "ok" : lead.status === "archived" || lead.status === "rejected" ? "off" : ""}`}>
                {(lead.kind === "professional" && lead.status === "pending") ? "Interessado" : ({ pending: "Pendente", approved: "Aprovado", contacted: "Contatado", rejected: "Rejeitado", archived: "Arquivado" })[lead.status] || lead.status}
              </span>
              {lead.status === "pending" && lead.kind === "institution" && <button type="button" className="button small quiet" onClick={() => updateLead(lead.id, "approved")}><Check size={14}/> Aprovar instituição</button>}
              {lead.status === "pending" && lead.kind === "professional" && <button type="button" className="button small quiet" onClick={() => updateLead(lead.id, "contacted")}><Mail size={14}/> Marcar como contatado</button>}
              {lead.status === "approved" && <button type="button" className="button small quiet" onClick={() => updateLead(lead.id, "contacted")}><Mail size={14}/> Marcar como contatado</button>}
              {(lead.status === "archived" || lead.status === "rejected") && <button type="button" className="button small quiet" onClick={() => updateLead(lead.id, "pending")}><RotateCcw size={14}/> Reativar</button>}
              {lead.status === "pending" && <button type="button" className="button small quiet" onClick={() => updateLead(lead.id, "rejected")}><Ban size={14}/> Rejeitar</button>}
              {lead.status !== "archived" && lead.status !== "rejected" && <button type="button" className="button small quiet" onClick={() => updateLead(lead.id, "archived")}><Archive size={14}/> Arquivar</button>}
              <button type="button" className="button small quiet danger" onClick={() => removeLead(lead)}><Trash2 size={14}/> Excluir</button>
            </div>
          </div>
        ))}
      </MvpCard>

      <div className="mvp-grid">
        <MvpCard title="Instituições" subtitle="Arquivar remove da lista ativa sem apagar o histórico." testid="admin-institutions-card" className="admin-secondary-card">
          {!institutions.length && <MvpEmpty>Nenhuma instituição ativa no momento.</MvpEmpty>}
          {institutions.map(i => (
            <div className="mvp-row" key={i.id} data-testid={`admin-institution-${i.id}`}>
              <div className="mvp-row-main"><strong>{i.name}</strong><span>Código {i.code} · {i.students} estudantes · {i.professionals} profissionais</span></div>
              <div className="mvp-row-actions">
                <span className="mvp-tag">{i.plan || "piloto"}</span>
                <button type="button" className="button small quiet danger" onClick={() => archiveInstitution(i)} data-testid={`admin-archive-institution-${i.id}`}><Archive size={14}/> Arquivar</button>
              </div>
            </div>
          ))}
        </MvpCard>

        {archivedInstitutions.length > 0 && <details className="mvp-security-details admin-archived-details" data-testid="admin-archived-institutions-card">
          <summary>Instituições arquivadas <span>{archivedInstitutions.length} arquivada(s)</span></summary>
          <p>Arquivadas não aparecem na lista ativa e podem ser reativadas.</p>
          {archivedInstitutions.map(i => (
            <div className="mvp-row" key={i.id} data-testid={`admin-archived-institution-${i.id}`}>
              <div className="mvp-row-main"><strong>{i.name}</strong><span>Código {i.code} · {i.students} estudantes · {i.professionals} profissionais</span></div>
              <div className="mvp-row-actions">
                <span className="mvp-tag off">Arquivada</span>
                <button type="button" className="button small quiet" onClick={() => restoreInstitution(i)} data-testid={`admin-restore-institution-${i.id}`}><RotateCcw size={14}/> Reativar</button>
              </div>
            </div>
          ))}
        </details>}

        <MvpCard title="Pedidos e conversas (agregado)" subtitle="Acompanhe pedidos, horários e status sem motivo detalhado nem conteúdo de conversa." testid="admin-requests-card" className="admin-secondary-card">
          {!requests.length && <MvpEmpty>Sem solicitações ainda. Os primeiros pedidos aparecerão aqui de forma agregada.</MvpEmpty>}
          {requests.slice(0, 20).map(r => (
            <div className="mvp-row" key={r.id} data-testid={`admin-request-${r.id}`}>
              <div className="mvp-row-main"><strong>{r.request_kind === "direct" ? "Pedido direto · " : "Solicitação · "}{formatDate(r.date)}{r.time ? ` · ${r.time}` : ""}</strong><span>{r.institution_name}</span></div>
              <span className="mvp-tag">{STATUS_LABELS[r.status] || r.status}</span>
            </div>
          ))}
        </MvpCard>
      </div>

      <MvpCard title="Usuários" subtitle={`${visibleUsers.length} de ${users.length} contas exibidas. Desative para bloquear o acesso; exclusão é permanente.`} testid="admin-users-card" className="admin-users-card">
        <div className="admin-user-filters" aria-label="Buscar e filtrar usuários">
          <label className="admin-user-search">Buscar por nome, e-mail ou instituição<input type="search" value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder="Buscar usuários" data-testid="admin-user-search-input" /></label>
          <label>Papel<select value={userRole} onChange={e => setUserRole(e.target.value)} data-testid="admin-user-role-filter"><option value="all">Todos</option><option value="student">Estudantes</option><option value="professional">Profissionais</option><option value="institution">Instituições</option><option value="admin">Administradores</option></select></label>
          <label>Status<select value={userState} onChange={e => setUserState(e.target.value)} data-testid="admin-user-state-filter"><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Desativados</option></select></label>
        </div>
        {!visibleUsers.length && <MvpEmpty>Nenhuma conta corresponde aos filtros. Limpe a busca ou ajuste os critérios.</MvpEmpty>}
        {visibleUsers.map(u => (
          <div className="mvp-row" key={u.id} data-testid={`admin-user-${u.id}`}>
            <div className="mvp-row-main">
              <strong>{u.name}</strong>
              <span>{u.email} · {roleLabel[u.role] || u.role} · {u.institution_name || "sem instituição"}</span>
            </div>
            <div className="mvp-row-actions">
              <span className={`mvp-tag ${u.active ? "ok" : "off"}`}>{u.active ? "Ativo" : "Inativo"}</span>
              {u.role !== "admin" && (
                <>
                  <button type="button" className="button small quiet" onClick={() => toggle(u.id)} data-testid={`admin-toggle-${u.id}`}>
                    {u.active ? "Desativar" : "Reativar"}
                  </button>
                  <button type="button" className="button small quiet danger" onClick={() => removeUser(u)} data-testid={`admin-delete-${u.id}`}>
                    <Trash2 size={14}/> Excluir permanentemente
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </MvpCard>
    </MvpShell>
  );
}
