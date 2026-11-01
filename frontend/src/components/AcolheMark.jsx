import { useEffect, useRef } from "react";

export default function AcolheMark({ size = "large", parallax = false, label = "Símbolo Acolhe: duas formas orgânicas com um pequeno espaço entre elas" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!parallax || !ref.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const el = ref.current;
    const onMove = e => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      el.style.setProperty("--px", `${dx * 8}px`);
      el.style.setProperty("--py", `${dy * 8}px`);
      el.style.setProperty("--rx", `${-dy * 4}deg`);
      el.style.setProperty("--ry", `${dx * 4}deg`);
    };
    const onLeave = () => {
      el.style.setProperty("--px", "0px");
      el.style.setProperty("--py", "0px");
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseleave", onLeave); };
  }, [parallax]);
  return (
    <div ref={ref} className={`acolhe-mark acolhe-mark-${size}`} role="img" aria-label={label} data-testid="acolhe-3d-mark">
      <div className="mark-halo" aria-hidden="true"/>
      <div className="mark-scene" aria-hidden="true">
        <div className="blob blob-a"/>
        <div className="blob blob-b"/>
        <div className="mark-spark"/>
        <div className="mark-shadow"/>
      </div>
    </div>
  );
}
