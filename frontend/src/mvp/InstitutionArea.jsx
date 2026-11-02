import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, UserPlus } from "lucide-react";
import { MvpShell, MvpCard, MvpEmpty, MvpKpi } from "./MvpShell";
import { api, apiError, formatDate } from "./api";

export default function InstitutionArea() {
  const [metrics, setMetrics] = useState(null);
  const [students, setStudents] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [institution, setInstitution] = useState(null);
  const [invite, setInvite] = useState({ name: "", email: "", link_type: "institution", specialty: "" });
  const [inviteLink, setInviteLink] = useState(null);
  const [profile, setProfile] = useState({ name: "", contact_email: "", support_note: "" });

  const load = useCallback(async () => {
    const [m, s, p, i] = await Promise.all([
      api.get("/institutions/me/metrics"),
      api.get("/institutions/me/students"),
      api.get("/institutions/me/professionals"),
      api.get("/institutions/me"),
    ]);
    setMetrics(m.data); setStudents(s.data); setProfessionals(p.data); setInstitution(i.data);
    setProfile({ name: i.data.name || "", contact_email: i.data.contact_email || "", support_note: i.data.support_note || "" });
  }, []);

  useEffect(() => { load().catch(e => toast.error(apiError(e))); }, [load]);

  const submitInvite = async e => {
    e.preventDefault();
    try {
      const { data } = await api.post("/institutions/me/professionals", { ...invite, specialty: invite.specialty || null });
      setInviteLink(`${window.location.origin}${data.invite_path}`);
      toast.success("Convite criado.", { description: "O profissional define a própria senha ao abrir o link." });
      setInvite({ name: "", email: "", link_type: "institution", specialty: "" });
      await load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const saveProfile = async e => {
    e.preventDefault();
    try {
      await api.put("/institutions/me", { ...profile, contact_email: profile.contact_email || null, support_note: profile.support_note || null });
      toast.success("Informações atualizadas.");
      await load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const noData = metrics && !metrics.has_data;

  return (
    <MvpShell
      testid="institution-area"
      kicker="Painel institucional · piloto"
      title={<>Utilização agregada, <em>nunca individual.</em></>}
      lead="Indicadores reais do piloto. A instituição não acessa o conteúdo das conversas nem quem conversou sobre o quê."
    >
      <div className="mvp-kpis">
        <MvpKpi label="Estudantes cadastrados" value={metrics?.students_registered} testid="inst-kpi-students" />
        <MvpKpi label="Estudantes que acessaram" value={metrics?.students_accessed} note="login efetivo" testid="inst-kpi-accessed" />
        <MvpKpi label="Ativos (30 dias)" value={metrics?.students_active_30d} testid="inst-kpi-active" />
        <MvpKpi label="Estudantes que solicitaram" value={metrics?.students_requested} testid="inst-kpi-requesting" />
        <MvpKpi label="Solicitações" value={metrics?.requests_total} testid="inst-kpi-requests" />
        <MvpKpi label="Conversas realizadas" value={metrics?.sessions_completed} testid="inst-kpi-sessions" />
        <MvpKpi label="Profissionais vinculados" value={metrics?.professionals_linked} note={`${metrics?.professionals_accessed ?? 0} já acessaram`} testid="inst-kpi-professionals" />
        <MvpKpi label="Encaminhamentos" value={metrics?.referrals_total} testid="inst-kpi-referrals" />
      </div>
      {noData && <MvpEmpty testid="inst-no-data">Sem dados suficientes ainda. Os indicadores aparecem conforme o piloto é utilizado.</MvpEmpty>}

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
              <div className="mvp-row"><div className="mvp-row-main"><strong>Confirmadas</strong></div><span className="mvp-tag ok">{metrics.requests_scheduled}</span></div>
              <div className="mvp-row"><div className="mvp-row-main"><strong>Canceladas pelo estudante</strong></div><span className="mvp-tag off">{metrics.requests_cancelled}</span></div>
              <div className="mvp-row"><div className="mvp-row-main"><strong>Recusadas pelo profissional</strong></div><span className="mvp-tag off">{metrics.requests_declined}</span></div>
              <div className="mvp-row"><div className="mvp-row-main"><strong>Horários abertos</strong></div><span className="mvp-tag">{metrics.open_slots}</span></div>
              <div className="mvp-row"><div className="mvp-row-main"><strong>Satisfação média (feedback)</strong><span>{metrics.feedback_count} respostas</span></div><span className="mvp-tag">{metrics.feedback_average ?? "—"}</span></div>
            </>
          ) : <MvpEmpty />}
        </MvpCard>
      </div>

      <MvpCard title="Vincular profissional" subtitle="Você informa o e-mail e o profissional cria a própria senha pelo link do convite. Tipo 1: profissional da instituição (prioritário no piloto). Tipo 2: profissional parceiro da rede Acolhe (futuro)."
        testid="inst-invite-card">
        <form className="mvp-inline-form" onSubmit={submitInvite}>
          <label>Nome<input required value={invite.name} onChange={e => setInvite({ ...invite, name: e.target.value })} data-testid="invite-name-input" /></label>
          <label>E-mail<input type="email" required value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} data-testid="invite-email-input" /></label>
          <label>Vínculo
            <select value={invite.link_type} onChange={e => setInvite({ ...invite, link_type: e.target.value })} data-testid="invite-link-type-select">
              <option value="institution">Profissional da instituição</option>
              <option value="partner">Profissional parceiro Acolhe</option>
            </select>
          </label>
          <label>Atuação (opcional)<input value={invite.specialty} onChange={e => setInvite({ ...invite, specialty: e.target.value })} data-testid="invite-specialty-input" /></label>
          <button className="button primary" data-testid="invite-submit-button">Criar convite <UserPlus size={15} /></button>
        </form>
        {inviteLink && (
          <p className="mvp-ok" style={{ marginTop: 14, wordBreak: "break-all" }} data-testid="invite-link-result">
            Link do convite (válido por 14 dias): {inviteLink}
          </p>
        )}
      </MvpCard>

      <div className="mvp-grid">
        <MvpCard title="Profissionais vinculados" testid="inst-professionals-card">
          {!professionals.length && <MvpEmpty testid="inst-professionals-empty">Nenhum profissional vinculado ainda.</MvpEmpty>}
          {professionals.map(p => (
            <div className="mvp-row" key={p.id} data-testid={`inst-professional-${p.id}`}>
              <div className="mvp-row-main">
                <strong>{p.name}</strong>
                <span>{p.link_type === "institution" ? "Da instituição" : "Parceiro Acolhe"} · {p.open_slots} horários abertos · {p.completed_sessions} conversas</span>
                {p.invite_pending && <span data-testid={`inst-invite-pending-${p.id}`}>Convite pendente: {window.location.origin}{p.invite_path}</span>}
              </div>
              <span className={`mvp-tag ${p.invite_pending ? "wait" : p.active ? "ok" : "off"}`}>
                {p.invite_pending ? "Convite pendente" : p.active ? "Ativo" : "Inativo"}
              </span>
            </div>
          ))}
        </MvpCard>

        <MvpCard title="Estudantes vinculados" subtitle="Apenas informação administrativa: nunca motivos ou conteúdo." testid="inst-students-card">
          {!students.length && <MvpEmpty testid="inst-students-empty">Nenhum estudante vinculado ainda.</MvpEmpty>}
          {students.map(s => (
            <div className="mvp-row" key={s.id} data-testid={`inst-student-${s.id}`}>
              <div className="mvp-row-main">
                <strong>{s.name}</strong>
                <span>Último acesso: {s.last_access ? formatDate(s.last_access) : "—"}</span>
              </div>
              <span className={`mvp-tag ${s.active ? "ok" : "off"}`}>{s.active ? "Ativo" : "Inativo"}</span>
            </div>
          ))}
          <p className="mvp-foot-note"><Lock size={14} /> Não exibimos se um estudante específico solicitou apoio nem o motivo.</p>
        </MvpCard>
      </div>

      <MvpCard title="Informações da instituição" subtitle={`Código de vínculo dos estudantes: ${institution?.code || "—"} · Plano: piloto (sem cobrança)`} testid="inst-profile-card">
        <form className="mvp-inline-form" onSubmit={saveProfile}>
          <label>Nome<input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} data-testid="inst-name-input" /></label>
          <label>E-mail de contato<input type="email" value={profile.contact_email} onChange={e => setProfile({ ...profile, contact_email: e.target.value })} data-testid="inst-email-input" /></label>
          <label>Observação de apoio<input value={profile.support_note} onChange={e => setProfile({ ...profile, support_note: e.target.value })} data-testid="inst-note-input" /></label>
          <button className="button secondary" data-testid="inst-save-button">Salvar</button>
        </form>
        <p className="mvp-foot-note">Modelo institucional <strong>em validação</strong>: o piloto não tem cobrança e formas de contratação serão definidas depois das evidências.</p>
      </MvpCard>
    </MvpShell>
  );
}
