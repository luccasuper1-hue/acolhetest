/* ============================================================
   Dados demonstrativos da camada institucional.
   Todos fictícios e rotulados como DEMO na interface — nenhum
   número aqui representa resultado real da Acolhe.
   ============================================================ */

export const audiences = [
  {
    id: "estudante",
    tag: "Usuário",
    role: "Quem usa e se beneficia",
    title: "O estudante continua no centro",
    text: "Chega sem precisar saber o que fazer, informa um motivo geral e encontra um horário disponível dentro da estrutura da sua instituição.",
    to: "/para-estudantes",
    cta: "Ver a experiência do estudante",
  },
  {
    id: "profissional",
    tag: "Ecossistema",
    role: "Quem oferece apoio",
    title: "O profissional com espaço próprio",
    text: "Faz parte da estrutura de apoio: recebe solicitações sob sua responsabilidade, organiza disponibilidade e faz encaminhamentos em um ambiente adequado à sua atuação.",
    to: "/profissionais",
    cta: "Ver a área do profissional",
  },
  {
    id: "instituicao",
    tag: "Cliente",
    role: "Quem pode contratar",
    title: "A instituição como parceira",
    text: "Amplia sua estrutura de apoio estudantil, acompanha a utilização por indicadores agregados e organiza encaminhamentos — sem acessar conversas.",
    to: "/instituicoes",
    cta: "Ver a proposta institucional",
  },
];

export const b2b2cFlow = [
  { label: "Instituição", title: "Disponibiliza a estrutura", text: "Vincula profissionais e abre o acesso aos estudantes." },
  { label: "Profissional", title: "Participa da estrutura", text: "Publica disponibilidade, atende e encaminha." },
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
  "Profissional define disponibilidade",
  "Estudante solicita apoio e escolhe um horário",
  "Horário é reservado e a solicitação é confirmada",
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
  { icon: "layout", title: "Painel administrativo", text: "Uma visão geral da operação da Acolhe dentro da instituição." },
  { icon: "users", title: "Usuários institucionais", text: "Gestão de acessos de equipe e vínculos institucionais." },
  { icon: "badge", title: "Profissionais vinculados", text: "Organização dos profissionais que atendem a instituição." },
  { icon: "activity", title: "Acompanhamento de utilização", text: "Quanto a plataforma está sendo usada ao longo do tempo." },
  { icon: "route", title: "Gestão de encaminhamentos", text: "Visão administrativa dos encaminhamentos, sem conteúdo privado." },
  { icon: "chart", title: "Indicadores agregados", text: "Alcance, demanda por categoria e utilização — sempre agregados." },
];

export const proCapabilities = [
  { icon: "calendar", title: "Disponibilidade e horários", text: "Definição dos dias e janelas em que pode receber conversas." },
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
  { title: "Navegação e organização", text: "Ajudar a organizar informações e orientar a pessoa até o caminho adequado." },
  { title: "Recomendação de recursos", text: "Sugerir conteúdos de apoio compatíveis com o que a pessoa trouxe." },
  { title: "Automação administrativa", text: "Reduzir trabalho operacional de agendamento, organização e registros." },
  { title: "Organização de encaminhamentos", text: "Apoiar a estruturação do direcionamento feito por profissionais." },
  { title: "Análise de dados agregados", text: "Identificar padrões gerais de utilização, sem expor pessoas." },
  { title: "Apoio operacional aos profissionais", text: "Diminuir tarefas repetitivas para sobrar tempo de atuação." },
];

export const howByAudience = [
  {
    id: "estudante",
    tag: "Estudante",
    title: "Para quem precisa de apoio",
    text: "Sem formulários longos, sem precisar explicar tudo de uma vez.",
    steps: ["Você chega", "Informa um motivo geral", "Escolhe um horário disponível", "Acompanha a solicitação e o encaminhamento"],
  },
  {
    id: "profissional",
    tag: "Profissional",
    title: "Para quem oferece apoio",
    text: "Um ambiente que respeita a natureza do trabalho profissional.",
    steps: ["Recebe solicitações", "Organiza sua disponibilidade", "Realiza seu trabalho", "Faz encaminhamentos quando necessário"],
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
  { title: "Escolher um horário disponível", text: "Quando houver um profissional vinculado à sua instituição." },
  { title: "Ver recursos de apoio", text: "Conteúdos educativos curtos sobre o que aparece na vida escolar." },
  { title: "Descobrir os caminhos disponíveis", text: "O que existe para você agora, de forma clara." },
  { title: "Solicitar ou agendar atendimento", text: "Quando isso fizer sentido e estiver disponível." },
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
  { icon: "badge", value: "9", label: "Profissionais vinculados", trend: "rede demonstrativa" },
  { icon: "chart", value: "47%", label: "Taxa de utilização", trend: "do acesso contratado" },
  { icon: "heart", value: "4,6/5", label: "Satisfação com a experiência", trend: "pesquisa demonstrativa" },
];

export const dashOperations = [
  { title: "Solicitações aguardando profissional", detail: "Fila administrativa — sem conteúdo das conversas", status: "3 abertas", tone: "op-open" },
  { title: "Encaminhamentos concluídos no mês", detail: "Somente contagem agregada", status: "12 concluídos", tone: "op-done" },
  { title: "Profissionais com agenda publicada", detail: "Disponibilidade informada pelos próprios profissionais", status: "7 de 9", tone: "" },
  { title: "Convites de acesso pendentes", detail: "Gestão de usuários institucionais", status: "24 pendentes", tone: "op-open" },
];
