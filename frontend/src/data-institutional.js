/* ============================================================
   Dados de referências da camada institucional.
   Todos fictícios e rotulados como DEMO na interface — nenhum
   número aqui representa resultado real da Acolhe.
   ============================================================ */

export const audiences = [
  {
    id: "estudante",
    tag: "Usuário",
    role: "Quem usa e se beneficia",
    title: "O estudante continua no centro",
    text: "Informa um motivo geral, escolhe um profissional e envia um pedido.",
    to: "/para-estudantes",
    cta: "Ver a experiência do estudante",
  },
  {
    id: "profissional",
    tag: "Ecossistema",
    role: "Quem oferece apoio",
    title: "O profissional com espaço próprio",
    text: "Recebe pedidos, combina horários e registra encaminhamentos.",
    to: "/profissionais",
    cta: "Ver a área do profissional",
  },
  {
    id: "instituicao",
    tag: "Cliente",
    role: "Quem pode contratar",
    title: "A instituição como parceira",
    text: "Acompanha indicadores agregados e organiza encaminhamentos sem acessar conversas.",
    to: "/instituicoes",
    cta: "Ver a proposta institucional",
  },
];

export const b2b2cFlow = [
  { label: "Instituição", title: "Disponibiliza a estrutura", text: "Vincula profissionais e abre o acesso aos estudantes." },
  { label: "Profissional", title: "Organiza os encontros", text: "Recebe pedidos, combina horários, atende e encaminha." },
  { label: "Estudante", title: "Acessa o apoio", text: "Solicita conversa e encontra o próximo passo." },
  { label: "Acolhe", title: "Organiza o fluxo", text: "Agenda, solicitações, encaminhamentos e indicadores." },
];

export const noReplaceCases = [
  { title: "Já tem psicólogo escolar", text: "A equipe atual pode usar o Acolhe para organizar solicitações, agenda e encaminhamentos." },
  { title: "Já tem equipe de apoio", text: "Coordenação e orientação continuam no comando: o Acolhe organiza o acesso dos estudantes." },
  { title: "A capacidade não dá conta", text: "No futuro, uma rede parceira poderá complementar a estrutura — isso ainda não existe hoje." },
];

export const mvpToday = [
  "Instituição cria o ambiente e vincula profissionais",
  "Estudante envia um pedido de apoio",
  "Profissional propõe uma data e horário",
  "Estudante confirma o encontro combinado",
  "Conversa acontece em sala externa (provisório do piloto)",
  "Profissional conclui e registra encaminhamento",
  "Estudante envia feedback",
  "Instituição acompanha indicadores agregados",
];

export const futureVision = [
  "Rede ampliada de profissionais parceiros",
  "Automações e notificações",
  "Integrações com sistemas da instituição",
  "Modelos de contratação e pagamentos",
  "Analytics avançado",
  "Múltiplas instituições e escala regional",
];

export const institutionCapabilities = [
  { icon: "layout", title: "Visão institucional", text: "Uma visão geral dos pedidos, encontros e encaminhamentos da instituição." },
  { icon: "users", title: "Usuários institucionais", text: "Gestão de acessos de equipe e vínculos institucionais." },
  { icon: "badge", title: "Profissionais vinculados", text: "Organização dos profissionais que atendem a instituição." },
  { icon: "activity", title: "Acompanhamento de utilização", text: "Quanto a plataforma está sendo usada ao longo do tempo." },
  { icon: "route", title: "Acompanhamento de encaminhamentos", text: "Visão operacional dos status e próximos passos, sem acesso ao conteúdo privado." },
  { icon: "chart", title: "Indicadores agregados", text: "Alcance, demanda por categoria e utilização — sempre agregados." },
];

export const proCapabilities = [
  { icon: "calendar", title: "Pedidos e horários", text: "Recebimento de pedidos e combinação de datas para as conversas." },
  { icon: "inbox", title: "Solicitações sob sua responsabilidade", text: "Apenas o que pertence à sua atuação, nada além disso." },
  { icon: "history", title: "Conversas e encaminhamentos", text: "Marcação de conversas realizadas e registro operacional do próximo passo." },
];

export const accessLevels = [
  {
    id: "estudante",
    tag: "Estudante",
    title: "Controle e transparência",
    can: ["Ver e gerir suas próprias informações", "Saber quem acessa o quê", "Escolher seguir ou parar quando quiser"],
    cannot: ["Não recebe diagnóstico da plataforma"],
    scope: "O estudante deveria ser sempre o primeiro a saber o que acontece com as informações dele.",
  },
  {
    id: "profissional",
    tag: "Profissional",
    title: "Apenas o necessário",
    can: ["Informações dos casos sob sua atuação", "Registros no ambiente profissional adequado", "Histórico do próprio acompanhamento"],
    cannot: ["Não acessa casos de outros profissionais"],
    scope: "Acesso limitado ao que a atuação exige, com confidencialidade profissional como princípio.",
  },
  {
    id: "instituicao",
    tag: "Instituição",
    title: "Indicadores, não conversas",
    can: ["Indicadores agregados de utilização", "Dados administrativos e operacionais", "Visão geral de alcance e demanda"],
    cannot: ["Não acessa conversas entre estudante e profissional", "Não acessa motivos detalhados nem solicitações específicas"],
    scope: "A instituição enxerga indicadores e dados administrativos da operação, nunca o conteúdo privado de quem buscou apoio.",
  },
];

export const plans = [
  {
    id: "piloto",
    name: "Piloto institucional",
    idea: "Uma instituição parceira testa o Acolhe em pequena escala, sem cobrança.",
    basis: "Escopo combinado com a instituição",
    featured: true,
    features: [
      "Estrutura de apoio organizada (estudantes, profissionais, agenda)",
      "Solicitações, conversas e encaminhamentos registrados",
      "Indicadores agregados de utilização do piloto",
      "Acompanhamento conjunto para medir valor percebido",
    ],
  },
  {
    id: "objetivos",
    name: "O que o piloto mede",
    idea: "O piloto existe para gerar evidência, não para vender uma licença.",
    basis: "Critérios de avaliação",
    features: [
      "Utilização real por estudantes e profissionais",
      "Onde o fluxo quebra e o que gera abandono",
      "Objeções da instituição e valor percebido",
      "Disposição futura para contratar",
    ],
  },
  {
    id: "futuro",
    name: "Contratação futura",
    idea: "Modelos de contratação serão definidos após a validação.",
    basis: "A definir",
    features: [
      "Nenhum preço, plano ou condição comercial definido",
      "Escopo dependerá das evidências do piloto",
      "Rede parceira de profissionais como fase posterior",
      "Pagamentos e automações no roadmap",
    ],
  },
];

export const marketSegments = [
  { label: "Escolas de ensino médio", first: true },
  { label: "Redes de ensino" },
  { label: "Universidades" },
  { label: "Cursos técnicos" },
  { label: "Educação profissional" },
  { label: "Organizações que atendem estudantes" },
];

export const impactIndicators = [
  { icon: "users", title: "Estudantes alcançados", text: "Quantas pessoas encontraram um primeiro passo." },
  { icon: "school", title: "Instituições participantes", text: "Quantas escolas e redes ofereceram o acesso." },
  { icon: "badge", title: "Profissionais participantes", text: "Quem compõe a rede de apoio e encaminhamento." },
  { icon: "message", title: "Solicitações de apoio", text: "Quantos pedidos de conversa foram feitos." },
  { icon: "route", title: "Encaminhamentos", text: "Quantas pessoas chegaram ao serviço adequado." },
  { icon: "check", title: "Atendimentos realizados", text: "Conversas efetivamente acontecidas." },
  { icon: "activity", title: "Taxa de utilização", text: "Quanto do acesso disponível foi aproveitado." },
  { icon: "heart", title: "Satisfação com a experiência", text: "Como as pessoas avaliam o caminho percorrido." },
];

export const aiUses = [
  { title: "Automação assistida", text: "Recursos de automação e inteligência assistida podem ser avaliados em fases futuras." },
  { title: "Indicadores determinísticos", text: "A versão atual usa métricas agregadas e regras operacionais, sem IA ativa." },
  { title: "Privacidade por desenho", text: "Os fluxos atuais não enviam conversas, notas ou dados individuais a modelos." },
  { title: "Radar operacional", text: "Prioridades do painel são calculadas por regras explicáveis e verificáveis." },
  { title: "Roadmap transparente", text: "Qualquer recurso futuro será validado antes de ser apresentado como disponível." },
  { title: "Responsabilidade humana", text: "Decisões e atendimentos continuam sob responsabilidade de pessoas habilitadas." },
];

export const howByAudience = [
  {
    id: "estudante",
    tag: "Estudante",
    title: "Para quem precisa de apoio",
    text: "Sem formulários longos, sem precisar explicar tudo de uma vez.",
    steps: ["Você chega", "Informa um motivo geral", "Envia um pedido ao profissional", "Acompanha a proposta e o encaminhamento"],
  },
  {
    id: "profissional",
    tag: "Profissional",
    title: "Para quem oferece apoio",
    text: "Um ambiente que respeita a natureza do trabalho profissional.",
    steps: ["Recebe pedidos", "Combina uma data e horário", "Realiza seu trabalho", "Faz encaminhamentos quando necessário"],
  },
  {
    id: "instituicao",
    tag: "Instituição",
    title: "Para quem oferece a estrutura",
    text: "Ampliar o apoio estudantil sem invadir a privacidade de ninguém.",
    steps: ["Disponibiliza a estrutura", "Vincula profissionais", "Abre o acesso aos estudantes", "Acompanha a utilização", "Visualiza indicadores agregados"],
  },
];

export const studentCan = [
  { title: "Acessar a Acolhe pela sua instituição", text: "O acesso é disponibilizado pela escola ou rede de ensino." },
  { title: "Dizer como está se sentindo", text: "Com as palavras que você tiver — não precisa ser exato." },
  { title: "Escolher um profissional", text: "Envie um pedido para um profissional vinculado à sua instituição." },
  { title: "Ver recursos de apoio", text: "Conteúdos educativos curtos sobre o que aparece na vida escolar." },
  { title: "Descobrir os caminhos disponíveis", text: "O que existe para você agora, de forma clara." },
  { title: "Enviar um pedido de conversa", text: "O profissional combina a data e o horário com você." },
  { title: "Registrar um encaminhamento", text: "O profissional pode registrar o próximo passo operacional após a conversa." },
  { title: "Acompanhar o que foi combinado", text: "Ver o status da solicitação e os registros disponíveis para você." },
];

export const referralSteps = [
  { icon: "user", title: "O estudante chega", text: "Sem precisar de diagnóstico prévio, vocabulário técnico ou clareza total sobre o que sente." },
  { icon: "search", title: "Organização do pedido", text: "A plataforma registra apenas o motivo geral e os dados necessários para organizar a solicitação." },
  { icon: "book", title: "Recursos disponíveis", text: "Conteúdo educativo pode apoiar o primeiro passo, sem diagnóstico ou orientação clínica automática." },
  { icon: "route", title: "Encaminhamento operacional", focus: true, text: "Após a conversa, o profissional pode registrar um próximo passo ou encaminhamento." },
  { icon: "badge", title: "Apoio da instituição", text: "O fluxo conecta o estudante ao profissional vinculado e aos serviços definidos pela instituição." },
];

/* Séries do painel institucional — fictícias, marcadas como DEMO */
export const dashUsageSeries = [
  { mes: "Fev", acessos: 96, solicitacoes: 24 },
  { mes: "Mar", acessos: 142, solicitacoes: 38 },
  { mes: "Abr", acessos: 168, solicitacoes: 45 },
  { mes: "Mai", acessos: 214, solicitacoes: 61 },
  { mes: "Jun", acessos: 236, solicitacoes: 68 },
  { mes: "Jul", acessos: 198, solicitacoes: 52 },
  { mes: "Ago", acessos: 262, solicitacoes: 74 },
];

export const dashWeekSeries = [
  { dia: "Seg", conversas: 21 },
  { dia: "Ter", conversas: 34 },
  { dia: "Qua", conversas: 28 },
  { dia: "Qui", conversas: 39 },
  { dia: "Sex", conversas: 30 },
  { dia: "Sáb", conversas: 12 },
  { dia: "Dom", conversas: 7 },
];

export const dashDemand = [
  { label: "Pressão escolar e provas", value: 32 },
  { label: "Ansiedade e preocupação", value: 24 },
  { label: "Relações e família", value: 18 },
  { label: "Rotina e organização", value: 14 },
  { label: "Futuro e escolhas", value: 12 },
];

export const dashKpis = [
  { icon: "users", value: "312", label: "Estudantes alcançados", trend: "de 640 com acesso disponível" },
  { icon: "activity", value: "1.316", label: "Acessos à plataforma", trend: "últimos 6 meses (fictício)" },
  { icon: "message", value: "362", label: "Solicitações de apoio", trend: "média de 52 por mês" },
  { icon: "check", value: "148", label: "Atendimentos realizados", trend: "conversas concluídas" },
  { icon: "route", value: "37", label: "Encaminhamentos", trend: "para serviço adequado" },
  { icon: "badge", value: "9", label: "Profissionais vinculados", trend: "rede do piloto" },
  { icon: "chart", value: "47%", label: "Taxa de utilização", trend: "do acesso contratado" },
  { icon: "heart", value: "4,6/5", label: "Satisfação com a experiência", trend: "pesquisa do piloto" },
];

export const dashOperations = [
  { title: "Solicitações aguardando profissional", detail: "Fila administrativa — sem conteúdo das conversas", status: "3 abertas", tone: "op-open" },
  { title: "Encaminhamentos concluídos no mês", detail: "Somente contagem agregada", status: "12 concluídos", tone: "op-done" },
  { title: "Profissionais recebendo pedidos", detail: "Pedidos organizados pelos próprios profissionais", status: "7 de 9", tone: "" },
  { title: "Convites de acesso pendentes", detail: "Gestão de usuários institucionais", status: "24 pendentes", tone: "op-open" },
];
