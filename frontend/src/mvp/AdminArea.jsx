import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { MvpShell, MvpCard, MvpEmpty, MvpKpi } from "./MvpShell";
import { api, apiError, formatDate, STATUS_LABELS } from "./api";

export default function AdminArea() {
  const [users, setUsers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [form, setForm] = useState({ name: "", code: "", admin_name: "", admin_email: "", admin_password: "" });

  const load = useCallback(async () => {
    const [u, i, r, m] = await Promise.all([
      api.get("/admin/users"), api.get("/admin/institutions"),
      api.get("/admin/requests"), api.get("/metrics/global"),
    ]);
    setUsers(u.data); setInstitutions(i.data); setRequests(r.data); setMetrics(m.data);
  }, []);

  useEffect(() => { load().catch(e => toast.error(apiError(e))); }, [load]);

  const toggle = async id => {
    try { await api.post(`/admin/users/${id}/toggle-active`); toast.success("Acesso atualizado."); await load(); }
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

      <MvpCard title="Criar instituição do piloto" subtitle="Opcionalmente cria o acesso do gestor institucional." testid="admin-institution-form">
        <form className="mvp-inline-form" onSubmit={createInstitution}>
          <label>Nome<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="admin-inst-name-input" /></label>
          <label>Código<input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} data-testid="admin-inst-code-input" /></label>
          <label>Gestor (nome)<input value={form.admin_name} onChange={e => setForm({ ...form, admin_name: e.target.value })} data-testid="admin-inst-manager-input" /></label>
          <label>Gestor (e-mail)<input type="email" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} data-testid="admin-inst-manager-email-input" /></label>
          <label>Gestor (senha)<input type="password" minLength={8} value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} data-testid="admin-inst-manager-password-input" /></label>
          <button className="button primary" data-testid="admin-create-institution-button">Criar <Building2 size={15} /></button>
        </form>
      </MvpCard>

      <div className="mvp-grid">
        <MvpCard title="Instituições" testid="admin-institutions-card">
          {!institutions.length && <MvpEmpty />}
          {institutions.map(i => (
            <div className="mvp-row" key={i.id} data-testid={`admin-institution-${i.id}`}>
              <div className="mvp-row-main"><strong>{i.name}</strong><span>Código {i.code} · {i.students} estudantes · {i.professionals} profissionais</span></div>
              <span className="mvp-tag">{i.plan || "piloto"}</span>
            </div>
          ))}
        </MvpCard>

        <MvpCard title="Solicitações (agregado)" subtitle="Sem motivo detalhado nem conteúdo de conversa." testid="admin-requests-card">
          {!requests.length && <MvpEmpty>Sem solicitações ainda.</MvpEmpty>}
          {requests.slice(0, 20).map(r => (
            <div className="mvp-row" key={r.id} data-testid={`admin-request-${r.id}`}>
              <div className="mvp-row-main"><strong>{formatDate(r.date)} · {r.time}</strong><span>{r.institution_name}</span></div>
              <span className="mvp-tag">{STATUS_LABELS[r.status] || r.status}</span>
            </div>
          ))}
        </MvpCard>
      </div>

      <MvpCard title="Usuários" subtitle="Ativar ou desativar acesso rapidamente durante o piloto." testid="admin-users-card">
        {users.map(u => (
          <div className="mvp-row" key={u.id} data-testid={`admin-user-${u.id}`}>
            <div className="mvp-row-main">
              <strong>{u.name}</strong>
              <span>{u.email} · {u.role} · {u.institution_name || "sem instituição"}</span>
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
