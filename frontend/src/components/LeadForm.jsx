import { useState } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "../mvp/api";

/* ------------------------------------------------------------------
   Formulários de interesse. Eles enviam um contato para a operação,
   mas não criam cadastro nem aprovam ninguém automaticamente.
   ------------------------------------------------------------------ */

const FIELDS = {
  institution: [
    { name: "nome", label: "Seu nome", placeholder: "Como podemos te chamar", half: true, required: true },
    { name: "cargo", label: "Cargo", placeholder: "Ex.: coordenação, direção", half: true, required: true },
    { name: "instituicao", label: "Instituição", placeholder: "Nome da escola, rede ou universidade", required: true },
    { name: "email", label: "E-mail", placeholder: "seu@instituicao.edu.br", type: "email", half: true, required: true },
    { name: "estudantes", label: "Número aproximado de estudantes", placeholder: "Ex.: 400", half: true },
    { name: "senha", label: "Senha do gestor", placeholder: "Defina uma senha para o acesso", type: "password", half: true, required: true },
    { name: "mensagem", label: "Mensagem", placeholder: "Conte o que você gostaria de resolver na sua instituição.", area: true, required: true, minLength: 10 },
  ],
  professional: [
    { name: "nome", label: "Seu nome", placeholder: "Nome completo", half: true, required: true },
    { name: "profissao", label: "Profissão", placeholder: "Ex.: Psicologia", half: true, required: true },
    { name: "registro", label: "Registro profissional", placeholder: "Informação do registro profissional", half: true },
    { name: "email", label: "E-mail", placeholder: "seu@email.com", type: "email", half: true, required: true },
    { name: "area", label: "Área de atuação", placeholder: "Ex.: adolescentes, ansiedade, rotina", half: true },
    { name: "regiao", label: "Cidade / região", placeholder: "Ex.: Curitiba — PR", half: true },
    { name: "mensagem", label: "Mensagem", placeholder: "Conte como você gostaria de participar da rede.", area: true },
  ],
};

const COPY = {
  institution: {
    testid: "institution-lead",
    kicker: "Contato institucional",
    title: "Quero levar a Acolhe para minha instituição",
    intro: "Deixe seus dados e o que você gostaria de resolver. O pedido fica pendente para revisão da administração; só depois da aprovação a instituição e o acesso do gestor são criados.",
    submit: "Enviar interesse institucional",
    success: "Recebemos seu interesse. A operação do Acolhe entrará em contato pelo e-mail informado.",
    toast: "Interesse institucional enviado.",
    note: "A senha fica protegida e só ativa o acesso se o interesse for aprovado pela administração.",
  },
  professional: {
    testid: "professional-lead",
    kicker: "Lista de interesse · futura rede",
    title: "Quero saber quando a rede abrir",
    intro: "Neste momento, o Acolhe não está cadastrando profissionais diretamente. No piloto, profissionais entram somente por convite de uma instituição. Deixe seu contato para ser avisado quando a futura rede Acolhe estiver aberta.",
    submit: "Entrar na lista de interesse",
    success: "Seu interesse foi registrado. A operação do Acolhe avisará pelo e-mail informado quando a rede estiver aberta.",
    toast: "Interesse profissional registrado.",
    note: "Este formulário não cria conta, vínculo, aprovação nem acesso ao piloto. Para participar agora, aguarde um convite da sua instituição.",
  },
};

/* Agrupa campos "half" consecutivos em linhas de dois; o resto ocupa a linha toda. */
const buildRows = fields => {
  const rows = [];
  let i = 0;
  while (i < fields.length) {
    const field = fields[i];
    const next = fields[i + 1];
    if (field.half && next && next.half) { rows.push([field, next]); i += 2; }
    else { rows.push([field]); i += 1; }
  }
  return rows;
};

const renderField = (f, values, set, testid) => (
  <label key={f.name}>
    {f.label}{f.required ? " *" : ""}
    {f.area
      ? <textarea
          value={values[f.name] || ""}
          onChange={e => set(f.name, e.target.value)}
          placeholder={f.placeholder}
          data-testid={`${testid}-${f.name}`}
        />
      : <input
          type={f.type || "text"}
          value={values[f.name] || ""}
          onChange={e => set(f.name, e.target.value)}
          placeholder={f.placeholder}
          autoComplete={f.type === "password" ? "new-password" : "off"}
          data-testid={`${testid}-${f.name}`}
        />}
    {f.minLength && <small className="field-hint">Mínimo de {f.minLength} caracteres.</small>}
  </label>
);

export const LeadForm = ({ variant = "institution", anchorId }) => {
  const fields = FIELDS[variant];
  const copy = COPY[variant];
  const [values, setValues] = useState({});
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (name, value) => setValues(prev => ({ ...prev, [name]: value }));

  const submit = async e => {
    e.preventDefault();
    const missing = fields.filter(f => f.required && !String(values[f.name] || "").trim());
    if (missing.length) {
      setError(`Preencha: ${missing.map(f => f.label.toLowerCase()).join(", ")}.`);
      return;
    }
    const tooShort = fields.find(f => f.minLength && String(values[f.name] || "").trim().length < f.minLength);
    if (tooShort) {
      setError(`${tooShort.label} precisa ter pelo menos ${tooShort.minLength} caracteres.`);
      return;
    }
    setError("");
    try {
      await api.post(`/leads/${variant}`, values);
      setSent(true);
      toast.success(copy.toast, { description: "A operação do Acolhe recebeu seu contato." });
    } catch (submissionError) {
      setError(apiError(submissionError));
    }
  };

  return (
    <section className="section" id={anchorId} data-testid={`${copy.testid}-section`}>
      <div className="lead-section">
        <div className="lead-intro">
          <div className="section-kicker">{copy.kicker}</div>
          <h2>{copy.title}</h2>
          <p>{copy.intro}</p>
          <p className="inst-note"><ShieldCheck size={15}/>{copy.note}</p>
        </div>

        <form className="lead-form" onSubmit={submit} data-testid={`${copy.testid}-form`} noValidate>
          {buildRows(fields).map((row, i) => (
            row.length === 2
              ? <div className="lead-row" key={row[0].name}>{row.map(f => renderField(f, values, set, copy.testid))}</div>
              : <div key={row[0] ? row[0].name : i} style={{ display: "contents" }}>{renderField(row[0], values, set, copy.testid)}</div>
          ))}

          {error && <p className="lead-error" data-testid={`${copy.testid}-error`}>{error}</p>}

          {sent
            ? <div className="lead-success" data-testid={`${copy.testid}-success`}>
                <Check size={17}/>
                <span>{copy.success}</span>
              </div>
            : <div className="lead-foot">
                <small>Campos marcados com * são obrigatórios apenas nesta demonstração.</small>
                <button className="button primary" type="submit" data-testid={`${copy.testid}-submit`}>
                  {copy.submit} <ArrowRight size={16}/>
                </button>
              </div>}
        </form>
      </div>
    </section>
  );
};

export default LeadForm;
