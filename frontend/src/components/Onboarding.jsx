import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { createPortal } from "react-dom";
import AcolheMark from "./AcolheMark";
import JourneyFlow from "./JourneyFlow";
import { useState } from "react";

const STEPS = [
  {
    kicker: "O que é o Acolhe",
    title: "Um primeiro passo para conversar.",
    text: "O Acolhe aproxima estudantes de profissionais de Psicologia para conversas breves, acessíveis e virtuais.",
    visual: "mark",
  },
  {
    kicker: "Sem pressão",
    title: "Você não precisa ter as palavras certas.",
    text: "Escolha o que mais se aproxima do que você está vivendo. Você pode mudar de ideia depois.",
    visual: "topics",
  },
  {
    kicker: "No seu ritmo",
    title: "Você decide o próximo passo.",
    text: "Encontre um profissional, escolha um horário e veja as opções disponíveis.",
    visual: "flow",
  },
  {
    kicker: "Transparência",
    title: "Uma conversa pode ser um começo.",
    text: "O Acolhe não substitui acompanhamento psicológico. A conversa pode ajudar você a entender o que está vivendo e pensar nos próximos caminhos.",
    visual: "quote",
  },
];

const SAMPLE_TOPICS = ["Ansiedade", "Pressão escolar", "Quero apenas conversar", "Não sei por onde começar"];

export const Onboarding = ({ onFinish, onExplore }) => {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  return createPortal(
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="Apresentação do Acolhe" data-testid="onboarding-overlay">
      <div className="onboarding-card" key={index}>
        <div className="onboarding-top">
          <span className="onboarding-badge"><ShieldCheck size={13}/> Protótipo educacional</span>
          <button className="onboarding-skip" onClick={onFinish} data-testid="onboarding-skip">Pular por enquanto</button>
        </div>

        <div className="onboarding-body">
          <div className="onboarding-copy">
            <span className="section-kicker">{String(index + 1).padStart(2, "0")} · {step.kicker}</span>
            <h2 data-testid="onboarding-title">{step.title}</h2>
            <p>{step.text}</p>
          </div>
          <div className="onboarding-visual" aria-hidden="true">
            {step.visual === "mark" && <div className="onboarding-mark"><AcolheMark size="small"/></div>}
            {step.visual === "topics" && <div className="onboarding-topics">{SAMPLE_TOPICS.map((t, i) => <span key={t} className={i === 0 ? "on" : ""}>{t}{i === 0 && <Check size={13}/>}</span>)}</div>}
            {step.visual === "flow" && <JourneyFlow compact/>}
            {step.visual === "quote" && <blockquote className="onboarding-quote">Nem todo momento difícil exige uma terapia completa, mas todo momento difícil <em>merece acolhimento.</em></blockquote>}
          </div>
        </div>

        <div className="onboarding-foot">
          <div className="onboarding-dots" aria-hidden="true">{STEPS.map((s, i) => <i key={s.title} className={i <= index ? "on" : ""}/>)}</div>
          <div className="onboarding-actions">
            {index > 0 && <button className="button quiet" onClick={() => setIndex(index - 1)} data-testid="onboarding-back">Voltar</button>}
            {last
              ? <>
                  <button className="button secondary" onClick={onExplore} data-testid="onboarding-explore">Conhecer o Acolhe</button>
                  <button className="button primary" onClick={onFinish} data-testid="onboarding-start">Começar <ArrowRight size={16}/></button>
                </>
              : <button className="button primary" onClick={() => setIndex(index + 1)} data-testid="onboarding-next">Continuar <ArrowRight size={16}/></button>}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Onboarding;
