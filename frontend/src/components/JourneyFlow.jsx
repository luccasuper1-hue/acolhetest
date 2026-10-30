import { Check } from "lucide-react";

const STEPS = [
  { n: "01", label: "Como você está?", note: "Um ponto de partida, sem diagnóstico." },
  { n: "02", label: "Sobre o que conversar?", note: "Escolha o assunto mais presente hoje." },
  { n: "03", label: "Encontre um profissional", note: "Perfis e disponibilidade demonstrativos." },
  { n: "04", label: "Escolha quando conversar", note: "Dia, horário e duração." },
  { n: "05", label: "Confirme", note: "Revisão simples antes de seguir." },
  { n: "06", label: "Converse", note: "Uma sala virtual demonstrativa." },
];

export const JourneyFlow = ({ compact = false, progress = null }) => (
  <ol className={compact ? "journey-track compact" : "journey-track"} data-testid="journey-track">
    {STEPS.map((step, i) => {
      const done = progress !== null && i < progress;
      const current = progress !== null && i === progress;
      return (
        <li className={`journey-node ${done ? "done" : ""} ${current ? "current" : ""}`} key={step.n} data-testid={`journey-node-${step.n}`}>
          <span className="journey-index">{done ? <Check size={13}/> : step.n}</span>
          <div>
            <strong>{step.label}</strong>
            {!compact && <p>{step.note}</p>}
          </div>
          <span className="journey-line" aria-hidden="true"/>
        </li>
      );
    })}
  </ol>
);

export default JourneyFlow;
