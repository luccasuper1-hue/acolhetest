const FLOW_STEPS = ["Assunto", "Profissional", "Horário", "Confirmação"];

export const FlowSteps = ({ step }) => (
  <div className="flow-steps" data-testid="flow-steps" aria-label={`Etapa ${step} de 4`}>
    {FLOW_STEPS.map((label, i) => {
      const index = i + 1;
      const state = index < step ? "done" : index === step ? "current" : "";
      return (
        <div className={`flow-step ${state}`} key={label} data-testid={`flow-step-${index}`}>
          <i className="flow-step-bar" aria-hidden="true"><b style={{ width: index <= step ? "100%" : "0%" }}/></i>
          <span className="flow-step-index">{String(index).padStart(2, "0")}</span>
          <span className="flow-step-label">{label}</span>
        </div>
      );
    })}
  </div>
);

export default FlowSteps;
