import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { MvpShell, MvpCard, MvpEmpty, MvpKpi } from "./MvpShell";
import { api, apiError, formatDate, REASONS, REFERRAL_LABELS, STATUS_LABELS } from "./api";

const TIME_OPTIONS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:30"];
const reasonLabel = code => REASONS.find(r => r.code === code)?.label || "Não informado";

export default function ProfessionalArea() {
  const [availability, setAvailability] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [date, setDate] = useState("");
  const [times, setTimes] = useState([]);
  const [links, setLinks] = useState({});
  const [referrals, setReferrals] = useState({});

  const load = useCallback(async () => {
    const [a, r, s] = await Promise.all([
      api.get("/professionals/me/availability"),
      api.get("/professionals/me/requests"),
      api.get("/professionals/me/sessions"),
    ]);
    setAvailability(a.data); setRequests(r.data); setSessions(s.data);
  }, []);

  useEffect(() => { load().catch(e => toast.error(apiError(e))); }, [load]);

  const run = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast.success(okMsg); await load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const addSlots = () => {
    if (!date || !times.length) { toast.error("Escolha uma data e ao menos um horário."); return; }
    run(() => api.post("/professionals/me/availability", { date, times }), "Disponibilidade publicada.")
      .then(() => setTimes([]));
  };

  const pending = requests.filter(r => r.status === "pending");
  const scheduled = sessions.filter(s => s.status === "scheduled");
  const completed = sessions.filter(s => s.status === "completed");

  return (
    <MvpShell
      testid="professional-area"
      kicker="Área do profissional"
      title={<>Sua agenda no <em>piloto.</em></>}
      lead="Publique horários, receba solicitações e registre o desfecho operacional de cada conversa."
    >
      <div className="mvp-kpis">
        <MvpKpi label="Solicitações aguardando" value={pending.length} testid="pro-kpi-pending" />
        <MvpKpi label="Conversas agendadas" value={scheduled.length} testid="pro-kpi-scheduled" />
        <MvpKpi label="Conversas realizadas" value={completed.length} testid="pro-kpi-completed" />
        <MvpKpi label="Horários abertos" value={availability.filter(a => a.status === "open").length} testid="pro-kpi-open-slots" />
      </div>

      <MvpCard title="Definir disponibilidade" subtitle="Horários abertos ficam visíveis apenas para estudantes da sua instituição." testid="pro-availability-card" className="availability-card">
        <div className="availability-builder">
          <div className="availability-date-field">
            <label htmlFor="availability-date-input">Data dos horários</label>
            <input id="availability-date-input" type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="availability-date-input" />
          </div>
          <div className="availability-times-field">
            <div className="availability-times-head"><strong>Escolha os horários</strong><span>{times.length ? `${times.length} selecionado${times.length === 1 ? "" : "s"}` : "Nenhum selecionado"}</span></div>
            <div className="mvp-slots">
              {TIME_OPTIONS.map(t => (
                <button type="button" key={t} className={times.includes(t) ? "mvp-slot selected" : "mvp-slot"}
                  onClick={() => setTimes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                  data-testid={`availability-time-${t.replace(":", "-")}`}>{t}{times.includes(t) && <Check size={13} />}</button>
              ))}
            </div>
          </div>
        </div>
        <button className="button primary availability-publish" onClick={addSlots} data-testid="add-availability-button">
          Publicar horários <Plus size={16} />
        </button>
        <div className="availability-published">
          <div className="availability-published-head"><strong>Horários publicados</strong><span>{availability.length ? `${availability.length} horário${availability.length === 1 ? "" : "s"}` : "Ainda vazio"}</span></div>
          {!availability.length && <MvpEmpty testid="pro-availability-empty">Publique uma data e horários para que estudantes possam solicitar uma conversa.</MvpEmpty>}
          {availability.map(a => (
            <div className="mvp-row" key={a.id} data-testid={`availability-row-${a.id}`}>
              <div className="mvp-row-main">
                <strong>{formatDate(a.date)} · {a.time}</strong>
                <span>{a.status === "open" ? "Disponível" : "Reservado por um estudante"}</span>
              </div>
              <div className="mvp-row-actions">
                <span className={`mvp-tag ${a.status === "open" ? "ok" : "wait"}`}>{a.status === "open" ? "Aberto" : "Reservado"}</span>
                {a.status === "open" && (
                  <button className="button small quiet" onClick={() => run(() => api.delete(`/professionals/me/availability/${a.id}`), "Horário removido.")}
                    data-testid={`remove-availability-${a.id}`}><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </MvpCard>

      <MvpCard title="Solicitações recebidas" subtitle="Motivo geral informado pelo estudante — sem triagem clínica." testid="pro-requests-card" className="compact-empty-card">
        {!pending.length && <MvpEmpty testid="pro-requests-empty">Nenhuma solicitação aguardando.</MvpEmpty>}
        {pending.map(r => (
          <div className="mvp-row" key={r.id} data-testid={`pro-request-${r.id}`}>
            <div className="mvp-row-main">
              <strong>{formatDate(r.date)} · {r.time}</strong>
              <span>{reasonLabel(r.reason_code)}</span>
              {r.reason_note && <span>“{r.reason_note}”</span>}
            </div>
            <div className="mvp-row-actions">
              <button className="button small primary" onClick={() => run(() => api.post(`/professionals/me/requests/${r.id}/accept`), "Solicitação aceita.")}
                data-testid={`accept-request-${r.id}`}>Aceitar</button>
              <button className="button small quiet" onClick={() => run(() => api.post(`/professionals/me/requests/${r.id}/decline`), "Solicitação recusada.")}
                data-testid={`decline-request-${r.id}`}>Recusar</button>
            </div>
          </div>
        ))}
      </MvpCard>

      <MvpCard title="Próximas conversas" subtitle="Cole o link da sala externa (Meet, Zoom) e marque como realizada ao final." testid="pro-sessions-card" className="compact-empty-card">
        {!scheduled.length && <MvpEmpty testid="pro-sessions-empty">Nenhuma conversa agendada.</MvpEmpty>}
        {scheduled.map(s => (
          <div className="mvp-row" key={s.id} style={{ display: "block" }} data-testid={`pro-session-${s.id}`}>
            <div className="mvp-row" style={{ borderTop: 0, padding: 0 }}>
              <div className="mvp-row-main">
                <strong>{formatDate(s.date)} · {s.time}</strong>
                <span>{reasonLabel(s.reason_code)}</span>
              </div>
              <div className="mvp-row-actions">
                <span className="mvp-tag ok">{STATUS_LABELS[s.status]}</span>
                <button className="button small primary" onClick={() => run(() => api.post(`/professionals/me/sessions/${s.id}/complete`), "Conversa marcada como realizada.")}
                  data-testid={`complete-session-${s.id}`}>Marcar como realizada <Check size={14} /></button>
              </div>
            </div>
            <div className="mvp-inline-form" style={{ marginTop: 12 }}>
              <label>Link da sala (externo · provisório no piloto)
                <input placeholder="https://meet.google.com/…" value={links[s.request_id] ?? s.room_link ?? ""}
                  onChange={e => setLinks(l => ({ ...l, [s.request_id]: e.target.value }))}
                  data-testid={`room-link-input-${s.id}`} />
              </label>
              <button className="button secondary small"
                onClick={() => run(() => api.post(`/professionals/me/requests/${s.request_id}/room-link`, { room_link: links[s.request_id] || s.room_link }), "Link salvo.")}
                data-testid={`save-room-link-${s.id}`}>Salvar link</button>
            </div>
          </div>
        ))}
      </MvpCard>

      <MvpCard title="Conversas realizadas e encaminhamentos" subtitle="Registro operacional simples — sem prontuário clínico." testid="pro-completed-card" className="compact-empty-card">
        {!completed.length && <MvpEmpty testid="pro-completed-empty">Nenhuma conversa realizada ainda.</MvpEmpty>}
        {completed.map(s => (
          <div className="mvp-row" key={s.id} style={{ display: "block" }} data-testid={`pro-completed-${s.id}`}>
            <div className="mvp-row" style={{ borderTop: 0, padding: 0 }}>
              <div className="mvp-row-main">
                <strong>{formatDate(s.date)} · {s.time}</strong>
                <span>{s.referral ? REFERRAL_LABELS[s.referral.status] : "Sem encaminhamento registrado"}</span>
              </div>
              <span className="mvp-tag ok">Realizada</span>
            </div>
            <div className="mvp-inline-form" style={{ marginTop: 12 }}>
              <label>Status operacional
                <select value={referrals[s.id]?.status || s.referral?.status || "orientacao"}
                  onChange={e => setReferrals(r => ({ ...r, [s.id]: { ...r[s.id], status: e.target.value } }))}
                  data-testid={`referral-status-${s.id}`}>
                  {Object.entries(REFERRAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label>Observação operacional (opcional)
                <input value={referrals[s.id]?.note || ""} onChange={e => setReferrals(r => ({ ...r, [s.id]: { ...r[s.id], note: e.target.value } }))}
                  data-testid={`referral-note-${s.id}`} />
              </label>
              <button className="button secondary small"
                onClick={() => run(() => api.post(`/professionals/me/sessions/${s.id}/referral`, {
                  status: referrals[s.id]?.status || s.referral?.status || "orientacao",
                  note: referrals[s.id]?.note || null,
                }), "Encaminhamento registrado.")}
                data-testid={`save-referral-${s.id}`}>Registrar</button>
            </div>
          </div>
        ))}
      </MvpCard>
    </MvpShell>
  );
}
