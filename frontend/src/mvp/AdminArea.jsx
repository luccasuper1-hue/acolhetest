import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, Ban, Building2, Check, Mail } from "lucide-react";
import { MvpShell, MvpCard, MvpEmpty, MvpKpi } from "./MvpShell";
import { api, apiError, formatDate, STATUS_LABELS } from "./api";

export default function AdminArea() {
  const [users, setUsers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leads, setLeads] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [leadFilter, setLeadFilter] = useState("all");
  const [form, setForm] = useState({ name: "", code: "", admin_name: "", admin_email: "", admin_password: "" });

  const load = useCallback(async () => {
    const [u, i, r, l, m] = await Promise.all([
      api.get("/admin/users"), api.get("/admin/institutions"),
      api.get("/admin/requests"), api.get("/admin/leads"), api.get("/metrics/global"),
    ]);
    setUsers(u.data); setInstitutions(i.data); setRequests(r.data); setLeads(l.data); setMetrics(m.data);
  }, []);

  useEffect(() => { load().catch(e => toast.error(apiError(e))); }, [load]);

  const toggle = async id => {
    try { await api.post(`/admin/users/${id}/toggle-active`); toast.success("Acesso atualizado."); await load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const updateLead = async (id, status) => {
    try { const { data } = await api.post(`/admin/leads/${id}/status`, { status }); toast.success(status === "approved" && data.account_created ? "Instituição aprovada e conta criada com a senha padrão." : status === "contacted" ? "Interesse marcado como contatado." : "Interesse atualizado."); await load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const createInstitution = async e => {
    e.preventDefault();
    try {
      await api.post("/admin/institutions", {
        name: form.name, code: form.code.toUpperCase(),
        admin_name: form.admin_name || null,
        admin_email: form.admin_email || null,
        admin_password: form.admin_password || null,
      });
      toast.success("Instituição criada.");
      setForm({ name: "", code: "", admin_name: "", admin_email: "", admin_password: "" });
      await load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const visibleLeads = leads.filter(lead => leadFilter === "all" ? true : leadFilter === "active" ? ["approved", "contacted"].includes(lead.status) : lead.status === leadFilter);
  const roleLabel = { admin: "Administrador", institution: "Instituição", professional: "Profissional", student: "Estudante" };

  return (
    <MvpShell
      testid="admin-area"
      kicker="Administração do piloto"
      title={<>Operação do <em>piloto Acolhe.</em></>}
      lead="Área mínima para conduzir o primeiro piloto: instituições, usuários, acessos e métricas gerais."
    >
      <div className="mvp-kpis">
        <MvpKpi label="Instituições" value={metrics?.institutions} testid="admin-kpi-institutions" />
        <MvpKpi label="Usuários" value={metrics?.users} testid="admin-kpi-users" />
        <MvpKpi label="Estudantes cadastrados" value={metrics?.students_registered} testid="admin-kpi-students" />
        <MvpKpi label="Estudantes que acessaram" value={metrics?.students_accessed} testid="admin-kpi-accessed" />
        <MvpKpi label="Profissionais" value={metrics?.professionals} note={`${metrics?.pending_invites ?? 0} convites pendentes`} testid="admin-kpi-professionals" />
        <MvpKpi label="Solicitações" value={metrics?.requests} testid="admin-kpi-requests" />
        <MvpKpi label="Conversas realizadas" value={metrics?.sessions_completed} testid="admin-kpi-sessions" />
      </div>

      <MvpCard title="Criar instituição do piloto" subtitle="Opcionalmente cria o acesso do gestor institucional." testid="admin-institution-form" className="admin-institution-card">
        <form className="mvp-inline-form" onSubmit={createInstitution}>
          <label>Nome<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="admin-inst-name-input" /></label>
          <label>Código<input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} data-testid="admin-inst-code-input" /></label>
          <label>Gestor (nome)<input value={form.admin_name} onChange={e => setForm({ ...form, admin_name: e.target.value })} data-testid="admin-inst-manager-input" /></label>
          <label>Gestor (e-mail)<input type="email" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} data-testid="admin-inst-manager-email-input" /></label>
          <label>Gestor (senha)<input type="password" minLength={8} value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} data-testid="admin-inst-manager-password-input" /></label>
          <button className="button primary" data-testid="admin-create-institution-button">Criar <Building2 size={15} /></button>
        </form>
      </MvpCard>

      <MvpCard title="Interesses recebidos" subtitle="Contatos enviados pelos formulários públicos. Instituições podem ser aprovadas aqui; profissionais permanecem apenas como interessados e entram por convite institucional." testid="admin-leads-card" className="admin-leads-card">
        <div className="admin-filter-bar" aria-label="Filtrar interesses">
          {[['all', 'Todos'], ['pending', 'Pendentes'], ['active', 'Aprovados/contatados'], ['archived', 'Arquivados'], ['rejected', 'Rejeitados']].map(([value, label]) => (
            <button type="button" key={value} className={leadFilter === value ? "active" : ""} onClick={() => setLeadFilter(value)}>{label}{value === "pending" && leads.filter(l => l.status === "pending").length ? ` · ${leads.filter(l => l.status === "pending").length}` : ""}</button>
          ))}
        </div>
        {!visibleLeads.length && <MvpEmpty>Não há interesses nesta categoria.</MvpEmpty>}
        {visibleLeads.map(lead => (
          <div className="mvp-row" key={lead.id} data-testid={`admin-lead-${lead.id}`}>
            <div className="mvp-row-main">
              <strong>{lead.kind === "institution" ? lead.institution : lead.name}</strong>
              <span>{lead.kind === "institution" ? `Contato: ${lead.name} · ${lead.email}` : `${lead.profession} · ${lead.email}`}</span>
              <small>{lead.kind === "institution"
                ? `Instituição · ${lead.cargo || "cargo não informado"} · ${lead.students || "número de estudantes não informado"} estudantes`
                : `Profissional · ${lead.area || "área não informada"} · ${lead.region || "região não informada"}`}</small>
              <small>{lead.created_at ? new Date(lead.created_at).toLocaleString("pt-BR") : ""}</small>
            </div>
            <div className="mvp-row-actions">
              <span className="mvp-tag">{lead.kind === "institution" ? "Instituição" : "Profissional"}</span>
              <span className={`mvp-tag ${lead.status === "approved" || lead.status === "contacted" ? "ok" : lead.status === "archived" || lead.status === "rejected" ? "off" : ""}`}>
                {(lead.kind === "professional" && lead.status === "pending") ? "Interessado" : ({ pending: "Pendente", approved: "Aprovado", contacted: "Contatado", rejected: "Rejeitado", archived: "Arquivado" })[lead.status] || lead.status}
              </span>
              {lead.status === "pending" && lead.kind === "institution" && <button className="button small quiet" onClick={() => updateLead(lead.id, "approved")}><Check size={14}/> Aprovar instituição</button>}
              {lead.status === "pending" && lead.kind === "professional" && <button className="button small quiet" onClick={() => updateLead(lead.id, "contacted")}><Mail size={14}/> Marcar como contatado</button>}
              {lead.status === "approved" && <button className="button small quiet" onClick={() => updateLead(lead.id, "contacted")}><Mail size={14}/> Marcar como contatado</button>}
              {lead.status === "pending" && <button className="button small quiet" onClick={() => updateLead(lead.id, "rejected")}><Ban size={14}/> Rejeitar</button>}
              {lead.status !== "archived" && lead.status !== "rejected" && <button className="button small quiet" onClick={() => updateLead(lead.id, "archived")}><Archive size={14}/> Arquivar</button>}
            </div>
          </div>
        ))}
      </MvpCard>

      <div className="mvp-grid">
        <MvpCard title="Instituições" testid="admin-institutions-card" className="admin-secondary-card">
          {!institutions.length && <MvpEmpty />}
          {institutions.map(i => (
            <div className="mvp-row" key={i.id} data-testid={`admin-institution-${i.id}`}>
              <div className="mvp-row-main"><strong>{i.name}</strong><span>Código {i.code} · {i.students} estudantes · {i.professionals} profissionais</span></div>
              <span className="mvp-tag">{i.plan || "piloto"}</span>
            </div>
          ))}
        </MvpCard>

        <MvpCard title="Solicitações (agregado)" subtitle="Sem motivo detalhado nem conteúdo de conversa." testid="admin-requests-card" className="admin-secondary-card">
          {!requests.length && <MvpEmpty>Sem solicitações ainda.</MvpEmpty>}
          {requests.slice(0, 20).map(r => (
            <div className="mvp-row" key={r.id} data-testid={`admin-request-${r.id}`}>
              <div className="mvp-row-main"><strong>{formatDate(r.date)} · {r.time}</strong><span>{r.institution_name}</span></div>
              <span className="mvp-tag">{STATUS_LABELS[r.status] || r.status}</span>
            </div>
          ))}
        </MvpCard>
      </div>

      <MvpCard title="Usuários" subtitle="Ativar ou desativar acesso rapidamente durante o piloto." testid="admin-users-card" className="admin-users-card">
        {users.map(u => (
          <div className="mvp-row" key={u.id} data-testid={`admin-user-${u.id}`}>
            <div className="mvp-row-main">
              <strong>{u.name}</strong>
              <span>{u.email} · {roleLabel[u.role] || u.role} · {u.institution_name || "sem instituição"}</span>
            </div>
            <div className="mvp-row-actions">
              <span className={`mvp-tag ${u.active ? "ok" : "off"}`}>{u.active ? "Ativo" : "Inativo"}</span>
              {u.role !== "admin" && (
                <button className="button small quiet" onClick={() => toggle(u.id)} data-testid={`admin-toggle-${u.id}`}>
                  {u.active ? "Desativar" : "Ativar"}
                </button>
              )}
            </div>
          </div>
        ))}
      </MvpCard>
    </MvpShell>
  );
}
