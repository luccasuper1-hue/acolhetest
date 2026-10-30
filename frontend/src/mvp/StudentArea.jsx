import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, ExternalLink } from "lucide-react";
import { MvpShell, MvpCard, MvpEmpty } from "./MvpShell";
import { api, apiError, formatDate, REASONS, REFERRAL_LABELS, STATUS_LABELS } from "./api";

const TAG_TONE = { pending: "wait", accepted: "ok", completed: "ok", cancelled: "off", declined: "off" };

export default function StudentArea() {
  const [professionals, setProfessionals] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reason, setReason] = useState(REASONS[0].code);
  const [note, setNote] = useState("");
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({});

  const load = useCallback(async () => {
    const [pros, reqs] = await Promise.all([
      api.get("/students/me/professionals"),
      api.get("/students/me/requests"),
    ]);
    setProfessionals(pros.data);
    setRequests(reqs.data);
  }, []);

  useEffect(() => { load().catch(e => toast.error(apiError(e))); }, [load]);

  const submitRequest = async () => {
    if (!slot) return;
    setBusy(true);
    try {
      await api.post("/students/me/requests", { availability_id: slot, reason_code: reason, reason_note: note || null });
      toast.success("Solicitação enviada.", { description: "O profissional confirmará seu horário." });
      setSlot(null); setNote("");
      await load();
    } catch (e) {
      toast.error(apiError(e));
      await load();
    } finally { setBusy(false); }
  };

  const cancel = async id => {
    try {
      await api.post(`/students/me/requests/${id}/cancel`);
      toast("Conversa cancelada. O horário voltou a ficar disponível.");
      await load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const sendFeedback = async sessionId => {
    const entry = feedback[sessionId] || {};
    if (!entry.score) return;
    try {
      await api.post(`/students/me/sessions/${sessionId}/feedback`, { score: entry.score, comment: entry.comment || null });
      toast.success("Obrigado pelo retorno.");
      await load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const upcoming = requests.filter(r => ["pending", "accepted"].includes(r.status));
  const history = requests.filter(r => !["pending", "accepted"].includes(r.status));

  return (
    <MvpShell
      testid="student-area"
      kicker="Área do estudante"
      title={<>Um primeiro passo, <em>quando você quiser.</em></>}
      lead="Acesse o Acolhe pela sua instituição. Escolha um horário disponível e conte, se quiser, o motivo geral. O Acolhe não faz diagnóstico."
    >
      <MvpCard title="Solicitar uma conversa" subtitle="Motivo geral + horário disponível dos profissionais da sua instituição." testid="student-request-card">
        <div className="mvp-form">
          <label>Por que você gostaria de conversar?
            <select value={reason} onChange={e => setReason(e.target.value)} data-testid="reason-select">
              {REASONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </label>
          <label>Quer acrescentar algo? (opcional)
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Pode ser do seu jeito." data-testid="reason-note-input" />
            <small style={{ opacity: .68, fontSize: 12 }}>
              Escreva apenas o necessário para organizar a conversa. Evite dados sensíveis, endereços ou informações de
              outras pessoas — você poderá falar com o profissional diretamente.
            </small>
          </label>
        </div>
        <div style={{ marginTop: 18 }}>
          {!professionals.length && <MvpEmpty testid="student-no-professionals">Sem horários disponíveis ainda. Sua instituição precisa vincular um profissional.</MvpEmpty>}
          {professionals.map(p => (
            <div key={p.id} className="mvp-row" style={{ display: "block" }} data-testid={`student-professional-${p.id}`}>
              <div className="mvp-row-main">
                <strong>{p.name}</strong>
                <span>{p.specialty || "Escuta inicial"} · {p.link_type === "institution" ? "Profissional da instituição" : "Profissional parceiro Acolhe"}</span>
              </div>
              {p.slots.length ? (
                <div className="mvp-slots">
                  {p.slots.map(s => (
                    <button key={s.id} className={slot === s.id ? "mvp-slot selected" : "mvp-slot"}
                      onClick={() => setSlot(s.id)} data-testid={`slot-${s.id}`}>
                      {formatDate(s.date)} · {s.time}
                    </button>
                  ))}
                </div>
              ) : <MvpEmpty testid={`no-slots-${p.id}`}>Sem horários abertos no momento.</MvpEmpty>}
            </div>
          ))}
        </div>
        <button className="button primary" style={{ marginTop: 16 }} disabled={!slot || busy}
          onClick={submitRequest} data-testid="submit-request-button">
          {busy ? "Enviando…" : "Confirmar solicitação"} <Check size={16} />
        </button>
      </MvpCard>

      <MvpCard title="Suas próximas conversas" subtitle="Você pode cancelar e escolher outro horário." testid="student-upcoming-card">
        {!upcoming.length && <MvpEmpty testid="student-upcoming-empty">Nenhuma conversa agendada ainda.</MvpEmpty>}
        {upcoming.map(r => (
          <div className="mvp-row" key={r.id} data-testid={`student-request-${r.id}`}>
            <div className="mvp-row-main">
              <strong>{r.professional_name}</strong>
              <span><CalendarDays size={13} /> {formatDate(r.date)} · {r.time}</span>
            </div>
            <div className="mvp-row-actions">
              <span className={`mvp-tag ${TAG_TONE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
              {r.room_link && (
                <a className="button small secondary" href={r.room_link} target="_blank" rel="noreferrer" data-testid={`room-link-${r.id}`}>
                  Entrar na sala <ExternalLink size={14} />
                </a>
              )}
              <button className="button small quiet" onClick={() => cancel(r.id)} data-testid={`cancel-request-${r.id}`}>Cancelar</button>
            </div>
          </div>
        ))}
      </MvpCard>

      <MvpCard title="Histórico e orientações" subtitle="Depois da conversa, o profissional pode registrar uma orientação." testid="student-history-card">
        {!history.length && <MvpEmpty testid="student-history-empty">Sem conversas concluídas ainda.</MvpEmpty>}
        {history.map(r => (
          <div className="mvp-row" key={r.id} style={{ display: "block" }} data-testid={`student-history-${r.id}`}>
            <div className="mvp-row" style={{ borderTop: 0, padding: 0 }}>
              <div className="mvp-row-main">
                <strong>{r.professional_name}</strong>
                <span>{formatDate(r.date)} · {r.time}</span>
                {r.referral && <span data-testid={`student-referral-${r.id}`}>Orientação: {REFERRAL_LABELS[r.referral.status]}{r.referral.note ? ` — ${r.referral.note}` : ""}</span>}
              </div>
              <span className={`mvp-tag ${TAG_TONE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
            </div>
            {r.status === "completed" && r.session && !r.feedback && (
              <div style={{ marginTop: 12 }} data-testid={`feedback-form-${r.session.id}`}>
                <p style={{ fontSize: 13, opacity: .75, marginBottom: 8 }}>Como foi sua experiência com o Acolhe?</p>
                <div className="mvp-scale">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n}
                      className={(feedback[r.session.id]?.score === n) ? "selected" : ""}
                      onClick={() => setFeedback(f => ({ ...f, [r.session.id]: { ...f[r.session.id], score: n } }))}
                      data-testid={`feedback-score-${r.session.id}-${n}`}>{n}</button>
                  ))}
                </div>
                <div className="mvp-form" style={{ marginTop: 10 }}>
                  <textarea placeholder="Quer comentar algo? (opcional)" value={feedback[r.session.id]?.comment || ""}
                    onChange={e => setFeedback(f => ({ ...f, [r.session.id]: { ...f[r.session.id], comment: e.target.value } }))}
                    data-testid={`feedback-comment-${r.session.id}`} />
                  <button className="button secondary" disabled={!feedback[r.session.id]?.score}
                    onClick={() => sendFeedback(r.session.id)} data-testid={`feedback-submit-${r.session.id}`}>Enviar feedback</button>
                </div>
              </div>
            )}
            {r.feedback && <p className="mvp-ok" style={{ marginTop: 10 }} data-testid={`feedback-sent-${r.id}`}>Feedback enviado ({r.feedback.score}/5).</p>}
          </div>
        ))}
      </MvpCard>
    </MvpShell>
  );
}
