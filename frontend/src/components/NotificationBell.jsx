import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, Check, Sparkles } from "lucide-react";

const DEMO_NOTIFICATIONS = [
  { id: 1, Icon: Check, text: "Seu horário foi confirmado.", time: "Agora mesmo" },
  { id: 2, Icon: CalendarDays, text: "Sua conversa acontece amanhã, às 10:30.", time: "Ontem" },
  { id: 3, Icon: Sparkles, text: "Um novo horário ficou disponível com Marina Alves.", time: "2 dias" },
];

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="notif" ref={ref}>
      <button className="notif-button" onClick={() => setOpen(!open)} aria-label="Notificações" aria-expanded={open} data-testid="notifications-button">
        <Bell size={17}/>
        {!read && <i className="notif-dot" aria-hidden="true"/>}
      </button>
      {open && (
        <div className="notif-panel" data-testid="notifications-panel">
          <div className="notif-head">
            <span className="notif-title">Notificações</span>
            <span className="demo-label">DEMO</span>
          </div>
          {DEMO_NOTIFICATIONS.map(({ id, Icon, text, time }) => (
            <div className={read ? "notif-row" : "notif-row unread"} key={id}>
              <span className="notif-icon"><Icon size={15}/></span>
              <div><p>{text}</p><span>{time}</span></div>
            </div>
          ))}
          <button className="notif-clear" onClick={() => setRead(true)} data-testid="notifications-mark-read">
            {read ? "Tudo lido" : "Marcar como lidas"}
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
