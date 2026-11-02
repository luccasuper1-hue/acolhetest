import { Link } from "react-router-dom";
import {
  Activity, ArrowRight, BadgeCheck, BarChart3, BookOpen, Building2, CalendarDays, Check, ClipboardList,
  FolderLock, Heart, History, Inbox, LayoutDashboard, Lock, MessageCircle, Route, School, Search,
  ShieldCheck, Sparkles, UserRound, Users, X,
} from "lucide-react";
import {
  accessLevels, aiUses, audiences, futureVision, howByAudience, impactIndicators,
  institutionCapabilities, marketSegments, mvpToday, noReplaceCases, plans, proCapabilities,
  referralSteps, studentCan,
} from "../data-institutional";

const ICONS = {
  activity: Activity, badge: BadgeCheck, book: BookOpen, calendar: CalendarDays, chart: BarChart3,
  check: Check, folder: FolderLock, heart: Heart, history: History, inbox: Inbox,
  layout: LayoutDashboard, message: MessageCircle, route: Route, school: School, search: Search,
  user: UserRound, users: Users,
};

const Icon = ({ name, size = 18 }) => {
  const Cmp = ICONS[name] || Sparkles;
  return <Cmp size={size}/>;
};

/* ------------------------------------------------------------------
   Home — três públicos + fluxo B2B2C (adição discreta, não substitui)
   ------------------------------------------------------------------ */
export const AudienceBand = () => (
  <section className="audience-band" data-testid="audience-band">
    <div className="section">
      <div className="section-kicker">Cada pessoa tem um próximo passo</div>
      <h2>O estudante encontra apoio, a instituição <em>organiza.</em></h2>
      <p className="section-intro">
        A instituição disponibiliza a estrutura, o profissional participa dela e o estudante acessa o apoio.
        Cada papel é claro, sem transformar cuidado em uma vitrine.
      </p>
      <div className="audience-grid">
        {audiences.map(a => (
          <article className="inst-card audience-card" key={a.id} data-testid={`audience-card-${a.id}`}>
            <span className="inst-tag">{a.tag}</span>
            <span className="audience-role">{a.role}</span>
            <h3>{a.title}</h3>
            <p>{a.text}</p>
            <Link to={a.to} className="text-link" data-testid={`audience-link-${a.id}`}>{a.cta} <ArrowRight size={15}/></Link>
          </article>
        ))}
      </div>
      <p className="disclaimer-inline" style={{ marginTop: 26 }}>
        A Acolhe organiza o acesso e o encaminhamento; não substitui psicólogos, psicólogos escolares ou serviços especializados.
      </p>
    </div>
  </section>
);

/* Faixa de chamada institucional — usada na home e em páginas internas */
export const InstitutionStrip = ({ compact = false }) => (
  <section className="section" data-testid="institution-strip">
    <div className="inst-strip">
      <div>
        <span className="inst-tag"><Building2 size={12}/> Para instituições</span>
        <h2>Leve uma estrutura de apoio estudantil para a sua <em>instituição.</em></h2>
        <p>
          Escolas, redes de ensino e universidades poderiam disponibilizar a Acolhe aos seus estudantes,
          acompanhando a utilização por indicadores agregados — sem acesso ao conteúdo das conversas.
        </p>
      </div>
      <div className="inst-strip-actions">
        <Link to="/instituicoes" className="button primary" data-testid="strip-institution-button">
          Conhecer a solução <ArrowRight size={17}/>
        </Link>
        {!compact && (
          <Link to="/instituicoes/painel" className="button quiet" data-testid="strip-dashboard-button">
            Ver painel demonstrativo
          </Link>
        )}
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------------------
   Como funciona — por público
   ------------------------------------------------------------------ */
export const HowByAudience = () => (
  <section className="section" data-testid="how-by-audience">
    <div className="section-kicker">Como funciona</div>
    <h2>Um caminho claro para <em>cada lugar.</em></h2>
    <p className="section-intro">A mesma plataforma, explicada do ponto de vista de quem usa, de quem atende e de quem oferece a estrutura.</p>
    <div className="how-audiences">
      {howByAudience.map(col => (
        <article className="inst-card how-column" key={col.id} data-testid={`how-column-${col.id}`}>
          <header>
            <span className="inst-tag">{col.tag}</span>
            <h3>{col.title}</h3>
          </header>
          <p>{col.text}</p>
          <ol className="how-steps">
            {col.steps.map(s => <li key={s}>{s}</li>)}
          </ol>
        </article>
      ))}
    </div>
  </section>
);

/* ------------------------------------------------------------------
   Estudantes — o que dá para fazer + reforço acolhedor
   ------------------------------------------------------------------ */
export const StudentPossibilities = () => (
  <section className="section" data-testid="student-possibilities">
    <div className="section-kicker">Na prática</div>
    <h2>O que você pode fazer <em>por aqui.</em></h2>
    <p className="section-intro">Nada disso é diagnóstico e nada disso é obrigatório. São caminhos possíveis, no seu ritmo.</p>
    <div className="student-can">
      {studentCan.map((s, i) => (
        <div className="student-can-item" key={s.title} data-testid={`student-can-${i}`}>
          <Check size={17}/>
          <div>
            <strong>{s.title}</strong>
            <span>{s.text}</span>
          </div>
        </div>
      ))}
    </div>
    <div className="student-reassure" data-testid="student-reassure">
      <blockquote>Você não precisa saber exatamente o que fazer. A Acolhe ajuda a encontrar o próximo passo.</blockquote>
      <span>Sem diagnóstico, sem promessa de tratamento, sem pressa.</span>
    </div>
  </section>
);

/* ------------------------------------------------------------------
   Fluxo de encaminhamento responsável (rede de profissionais)
   ------------------------------------------------------------------ */
export const ReferralFlow = () => (
  <section className="section" data-testid="referral-flow">
    <div className="section-kicker">Encaminhamento responsável</div>
    <h2>Da chegada até o <em>serviço adequado.</em></h2>
    <p className="section-intro">
      A Acolhe não pretende ser um marketplace de psicólogos. A ideia é qualidade, adequação profissional
      e um direcionamento que respeite o que cada pessoa precisa.
    </p>
    <div className="referral-flow">
      {referralSteps.map(step => (
        <div className={step.focus ? "referral-step referral-focus" : "referral-step"} key={step.title} data-testid={`referral-step-${step.icon}`}>
          <i><Icon name={step.icon}/></i>
          <div>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
);

/* ------------------------------------------------------------------
   Capacidades — instituição e profissional
   ------------------------------------------------------------------ */
export const CapabilitiesSection = ({ variant }) => {
  const isInstitution = variant === "institution";
  const items = isInstitution ? institutionCapabilities : proCapabilities;
  return (
    <section className="section" data-testid={`capabilities-${variant}`}>
      <div className="section-kicker">{isInstitution ? "Painel administrativo" : "Painel profissional"}</div>
      <h2>{isInstitution ? <>O que a instituição poderia <em>gerenciar.</em></> : <>O que o profissional poderia <em>organizar.</em></>}</h2>
      <p className="section-intro">
        {isInstitution
          ? "Uma visão administrativa da operação — nunca do conteúdo privado de quem buscou apoio."
          : "Ferramentas de organização do trabalho, sem transformar a Acolhe em sistema clínico."}
      </p>
      <div className="capability-grid">
        {items.map(c => (
          <article className="inst-card capability-card" key={c.title}>
            <span className="capability-icon"><Icon name={c.icon}/></span>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
          </article>
        ))}
      </div>
      <p className="inst-note" style={{ marginTop: 24 }}>
        <ShieldCheck size={15}/>
        {isInstitution
          ? "Conjunto de funcionalidades conceituais, apresentadas como proposta de produto. Nada disso está em operação comercial."
          : "Funcionalidades conceituais. A Acolhe não pretende ser um sistema clínico nem substituir registros profissionais oficiais."}
      </p>
    </section>
  );
};

/* Prévia visual do painel do profissional */
export const ProPanelPreview = () => (
  <section className="section" data-testid="pro-panel-preview">
    <div className="section-kicker">Prévia conceitual</div>
    <h2>Como seria o <em>dia a dia.</em></h2>
    <div className="pro-preview">
      <div className="pro-preview-top">
        <strong style={{ fontSize: 15 }}>Área do profissional</strong>
        <span className="demo-label">DEMONSTRATIVO</span>
      </div>
      <div className="pro-preview-grid">
        <div className="pro-preview-tile">
          <Inbox size={18}/>
          <strong>Solicitações</strong>
          <span>Pedidos direcionados a você, com o contexto mínimo necessário.</span>
        </div>
        <div className="pro-preview-tile">
          <CalendarDays size={18}/>
          <strong>Disponibilidade</strong>
          <span>Você publica os horários em que pode receber conversas.</span>
        </div>
        <div className="pro-preview-tile">
          <Route size={18}/>
          <strong>Encaminhamentos</strong>
          <span>Direcionamento para o serviço mais adequado ao caso.</span>
        </div>
      </div>
      <div className="pro-confidential">
        <Lock size={17}/>
        <span>
          A instituição não acessa o conteúdo das conversas, os motivos detalhados ou as solicitações específicas dos estudantes.
          A confidencialidade profissional é um princípio do produto, não uma configuração opcional.
        </span>
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------------------
   Níveis de acesso (privacidade)
   ------------------------------------------------------------------ */
export const AccessLevelsSection = () => (
  <section className="section" data-testid="access-levels">
    <div className="section-kicker">Níveis de acesso</div>
    <h2>Cada pessoa vê apenas o que <em>lhe cabe.</em></h2>
    <p className="section-intro">
      Privacidade não é uma página de termos: é a forma como o produto é desenhado. Estes são os limites
      que a Acolhe pretende manter entre os três públicos.
    </p>
    <div className="access-grid">
      {accessLevels.map(level => (
        <article className="inst-card access-card" key={level.id} data-testid={`access-card-${level.id}`}>
          <header>
            <span className="inst-tag">{level.tag}</span>
            <h3>{level.title}</h3>
          </header>
          <ul className="access-list">
            {level.can.map(c => <li className="access-yes" key={c}><Check size={15}/><span>{c}</span></li>)}
            {level.cannot.map(c => <li className="access-no" key={c}><X size={15}/><span>{c}</span></li>)}
          </ul>
          <p className="access-scope">{level.scope}</p>
        </article>
      ))}
    </div>
    <p className="inst-note" style={{ marginTop: 26 }}>
      <ShieldCheck size={15}/>
      Uma versão real precisaria estruturar consentimento, proteção de dados, atendimento de menores e
      confidencialidade profissional com apoio jurídico. Não afirmamos conformidades ou certificações que ainda não existem.
    </p>
  </section>
);

/* ------------------------------------------------------------------
   Planos conceituais
   ------------------------------------------------------------------ */
export const PlansSection = () => (
  <section className="section" data-testid="plans-section">
    <div className="section-kicker">Modelo institucional em validação</div>
    <h2>Começamos por um <em>piloto institucional.</em></h2>
    <p className="section-intro">
      Não existe tabela comercial, plano à venda ou preço definido. A fase atual é um piloto acompanhado com
      uma instituição parceira, para medir utilização e entender o valor percebido antes de definir contratação.
    </p>
    <div className="plans-grid">
      {plans.map(plan => (
        <article className={plan.featured ? "inst-card plan-card featured" : "inst-card plan-card"} key={plan.id} data-testid={`plans-card-${plan.id}`}>
          {plan.featured && <span className="plan-flag">Fase atual</span>}
          <div className="plan-head">
            <h3>{plan.name}</h3>
            <p>{plan.idea}</p>
          </div>
          <div className="plan-price">
            <strong>Sem cobrança no piloto</strong>
            <span>{plan.basis}</span>
          </div>
          <ul className="plan-features">
            {plan.features.map(f => <li key={f}><Check size={14}/><span>{f}</span></li>)}
          </ul>
        </article>
      ))}
    </div>
    <span className="status-chip" data-testid="plans-status">Modelos de contratação futuros serão definidos após validação</span>
  </section>
);

/* Você não precisa substituir a estrutura atual */
export const NoReplaceSection = () => (
  <section className="section" data-testid="no-replace-section">
    <div className="section-kicker">Complementar, não substituir</div>
    <h2>Você não precisa substituir o que <em>já existe.</em></h2>
    <p className="section-intro">
      O Acolhe é infraestrutura: organiza o acesso, a agenda, as solicitações e os indicadores. Quem cuida
      continua sendo a estrutura de apoio da própria instituição.
    </p>
    <div className="capability-grid">
      {noReplaceCases.map(c => (
        <article className="inst-card capability-card" key={c.title} data-testid={`no-replace-${c.title.length}`}>
          <span className="capability-icon"><Building2 size={18}/></span>
          <h3>{c.title}</h3>
          <p>{c.text}</p>
        </article>
      ))}
    </div>
  </section>
);

/* MVP de hoje x visão futura */
export const MvpVsFuture = () => (
  <section className="section mvp-vs-future-section" data-testid="mvp-vs-future">
    <div className="section-kicker">Hoje e depois</div>
    <h2>O que funciona <em>hoje</em> e o que é <em>visão futura.</em></h2>
    <p className="section-intro">
      Separamos as duas coisas de propósito: o site mostra o que o Acolhe está construindo, o MVP mostra o que
      já é possível testar em um piloto pequeno.
    </p>
    <div className="how-audiences">
      <article className="inst-card how-column" data-testid="mvp-today-column">
        <header>
          <span className="inst-tag">MVP · em uso no piloto</span>
          <h3>Como funciona hoje</h3>
        </header>
        <ol className="how-steps">{mvpToday.map(s => <li key={s}>{s}</li>)}</ol>
      </article>
      <article className="inst-card how-column" data-testid="future-column">
        <header>
          <span className="inst-tag">Roadmap · ainda não existe</span>
          <h3>Visão futura</h3>
        </header>
        <ol className="how-steps">{futureVision.map(s => <li key={s}>{s}</li>)}</ol>
      </article>
    </div>
    <p className="inst-note" style={{ marginTop: 22 }}>
      <ShieldCheck size={15}/>
      Nada da coluna de visão futura está implementado. Pagamentos, rede ampliada e escala dependem das
      evidências do piloto.
    </p>
  </section>
);

/* ------------------------------------------------------------------
   Expansão de mercado
   ------------------------------------------------------------------ */
export const MarketSection = () => (
  <section className="section" data-testid="market-section">
    <div className="section-kicker">Potencial de escala</div>
    <h2>Começa no ensino médio, mas <em>não termina ali.</em></h2>
    <p className="section-intro">
      A primeira aplicação continua sendo estudantes e instituições de ensino. Estes são mercados que a
      Acolhe poderia alcançar no futuro — não mercados que ela já atende.
    </p>
    <div className="market-grid">
      {marketSegments.map(m => (
        <span className={m.first ? "market-chip market-first" : "market-chip"} key={m.label}>
          {m.first ? <BadgeCheck size={14}/> : <Sparkles size={14}/>}
          {m.label}{m.first ? " · foco atual" : ""}
        </span>
      ))}
    </div>
  </section>
);

/* ------------------------------------------------------------------
   Impacto (indicadores possíveis) e IA
   ------------------------------------------------------------------ */
export const ImpactSection = () => (
  <section className="section" data-testid="impact-section">
    <div className="section-kicker">Impacto</div>
    <h2>Indicadores que a Acolhe <em>poderá acompanhar.</em></h2>
    <p className="section-intro">
      Ainda não existem resultados medidos. Esta é a régua que pretendemos usar quando a plataforma
      estiver em operação — nenhum número foi inventado aqui.
    </p>
    <div className="impact-grid">
      {impactIndicators.map(ind => (
        <div className="impact-item" key={ind.title} data-testid={`impact-${ind.icon}`}>
          <Icon name={ind.icon} size={17}/>
          <strong>{ind.title}</strong>
          <span>{ind.text}</span>
        </div>
      ))}
    </div>
  </section>
);

export const AiSection = () => (
  <section className="section" data-testid="ai-section">
    <div className="section-kicker">Tecnologia</div>
    <h2>Inteligência artificial como <em>infraestrutura,</em> não como terapeuta.</h2>
    <p className="section-intro">
      A IA pode organizar, orientar caminhos e reduzir trabalho operacional. Ela não avalia pessoas,
      não conduz atendimento e não substitui profissionais.
    </p>
    <div className="ai-grid">
      {aiUses.map(use => (
        <div className="ai-item" key={use.title}>
          <Sparkles size={17}/>
          <div>
            <strong>{use.title}</strong>
            <span>{use.text}</span>
          </div>
        </div>
      ))}
    </div>
    <div className="ai-limit" data-testid="ai-limit">
      <ShieldCheck size={17}/>
      <span>
        A versão atual não usa nenhuma IA ativa: esta seção é apenas uma visão conceitual do futuro.
        A Acolhe não pretende oferecer “IA terapeuta”; o cuidado continua sendo responsabilidade de
        pessoas habilitadas.
      </span>
    </div>
  </section>
);

/* ------------------------------------------------------------------
   Estágio de validação
   ------------------------------------------------------------------ */
export const ValidationSection = () => (
  <section className="validation-band" data-testid="validation-section">
    <div className="section">
      <div className="validation-inner">
        <div>
          <div className="section-kicker">Estágio atual</div>
          <h2>Estamos construindo, testando e <em>validando.</em></h2>
          <p className="section-intro" style={{ marginBottom: 0 }}>
            A Acolhe é um protótipo em validação. Não há operação comercial, contratos, instituições
            parceiras, profissionais cadastrados ou resultados medidos. Preferimos dizer isso com clareza.
          </p>
        </div>
        <div className="validation-steps">
          {[
            "Protótipo navegável da experiência do estudante",
            "Proposta institucional e painel demonstrativo",
            "Conversas de validação com escolas e profissionais",
            "Definição de modelo comercial e requisitos legais",
            "Piloto acompanhado, com consentimento e escopo claros",
          ].map((step, i) => (
            <div className="validation-step" key={step}>
              <i>{String(i + 1).padStart(2, "0")}</i>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="inst-note" style={{ marginTop: 30 }}>
        <ClipboardList size={15}/>
        Tudo que aparece como número, gráfico, profissional, horário ou valor nesta plataforma é
        demonstrativo e está identificado como DEMO ou protótipo.
      </p>
    </div>
  </section>
);
