import { useEffect, useId, useRef, useState } from "react";
import { Bell, CalendarDays, Check, Sparkles } from "lucide-react";
import { lockOverlayScroll } from "../overlayScrollLock";

const DEMO_NOTIFICATIONS = [
  { id: 1, Icon: Check, text: "Seu horário foi confirmado.", time: "Agora mesmo" },
  { id: 2, Icon: CalendarDays, text: "Sua conversa acontece amanhã, às 10:30.", time: "Ontem" },
  { id: 3, Icon: Sparkles, text: "Você recebeu uma proposta de horário de Marina Alves.", time: "2 dias" },
];

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const panelId = `notifications-panel-${useId().replace(/:/g, "")}`;
  const titleId = `${panelId}-title`;
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
    if (wasOpen.current && !open) buttonRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const unlockScroll = lockOverlayScroll();
    const panel = panelRef.current;
    if (!panel) return unlockScroll;
    const handleKeyDown = event => {
      if (event.key !== "Tab") return;
      const items = [...panel.querySelectorAll("button:not([disabled]), a[href], input, select, textarea")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    panel.addEventListener("keydown", handleKeyDown);
    return () => { panel.removeEventListener("keydown", handleKeyDown); unlockScroll(); };
  }, [open]);

  return (
    <div className="notif" ref={ref}>
      <button ref={buttonRef} type="button" className="notif-button" onClick={() => setOpen(value => !value)} aria-label={read ? "Notificações" : "Notificações, há itens não lidos"} aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} data-testid="notifications-button">
        <Bell size={17}/>
        {!read && <i className="notif-dot" aria-hidden="true"/>}
      </button>
      {open && (
        <div ref={panelRef} id={panelId} className="notif-panel" role="dialog" aria-modal="false" aria-labelledby={titleId} tabIndex="-1" data-testid="notifications-panel">
          <div className="notif-head">
            <span id={titleId} className="notif-title">Notificações</span>
            <span className="demo-label">DEMO</span>
          </div>
          <span className="sr-only" role="status" aria-live="polite">{read ? "Todas as notificações estão lidas." : "Há notificações não lidas."}</span>
          <div role="list" aria-label="Lista de notificações">
          {DEMO_NOTIFICATIONS.map(({ id, Icon, text, time }) => (
            <div role="listitem" className={read ? "notif-row" : "notif-row unread"} key={id}>
              <span className="notif-icon"><Icon size={15}/></span>
              <div><p>{text}</p><span>{time}</span></div>
            </div>
          ))}
          </div>
          <button type="button" className="notif-clear" onClick={() => setRead(true)} data-testid="notifications-mark-read">
            {read ? "Tudo lido" : "Marcar como lidas"}
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
