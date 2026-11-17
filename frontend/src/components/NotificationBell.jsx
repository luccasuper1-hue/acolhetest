import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, Check, Sparkles } from "lucide-react";

const DEMO_NOTIFICATIONS = [
  { id: 1, Icon: Check, text: "Seu horário foi confirmado.", time: "Agora mesmo" },
  { id: 2, Icon: CalendarDays, text: "Sua conversa acontece amanhã, às 10:30.", time: "Ontem" },
  { id: 3, Icon: Sparkles, text: "Você recebeu uma proposta de horário de Marina Alves.", time: "2 dias" },
];

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus();
    wasOpen.current = open;
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="notif" ref={ref}>
      <button ref={buttonRef} type="button" className="notif-button" onClick={() => setOpen(!open)} aria-label={read ? "Notificações" : "Notificações, há itens não lidos"} aria-expanded={open} aria-controls="notifications-panel" data-testid="notifications-button">
        <Bell size={17}/>
        {!read && <i className="notif-dot" aria-hidden="true"/>}
      </button>
      {open && (
        <div id="notifications-panel" className="notif-panel" role="dialog" aria-modal="false" aria-label="Notificações" data-testid="notifications-panel">
          <div className="notif-head">
            <span className="notif-title">Notificações</span>
            <span className="demo-label">DEMO</span>
          </div>
          <div role="list" aria-label="Lista de notificações" aria-live="polite" aria-relevant="additions text">
          {DEMO_NOTIFICATIONS.map(({ id, Icon, text, time }) => (
            <div role="listitem" className={read ? "notif-row" : "notif-row unread"} key={id}>
              <span className="notif-icon"><Icon size={15}/></span>
              <div><p>{text}</p><span>{time}</span></div>
            </div>
          ))}
          </div>
          <button type="button" className="notif-clear" onClick={() => setRead(true)} aria-live="polite" data-testid="notifications-mark-read">
            {read ? "Tudo lido" : "Marcar como lidas"}
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
