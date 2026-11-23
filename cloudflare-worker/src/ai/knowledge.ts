export type KnowledgeScope = "product" | "privacy" | "metrics" | "pilot";
type Entry = { scope: KnowledgeScope; keywords: RegExp; answer: string; source: string };

const entries: Entry[] = [
  { scope: "product", keywords: /como funciona|fluxo|pedido|proposta|confirma|agenda|disponibilidade|painel|notifica|certificado|encaminhamento/i, answer: "O Acolhe organiza o caminho entre estudante, profissional e instituição: o pedido é recebido, um horário pode ser proposto, o estudante confirma e a conversa é registrada operacionalmente. Cada papel vê apenas o painel e as ações autorizadas para sua função.", source: "Guia operacional do piloto Acolhe" },
  { scope: "privacy", keywords: /privacidade|lgpd|cookie|consentimento|menor|adolescente|seguran[cç]a|dados pessoais/i, answer: "O Acolhe coleta somente o necessário para organizar o apoio e o funcionamento da plataforma. Indicadores institucionais são agregados, amostras pequenas ficam ocultas e o Insights não acessa conversas, notas, diagnósticos ou identificadores individuais.", source: "Política de privacidade, cookies e governança do Acolhe" },
  { scope: "metrics", keywords: /m[eé]trica|comparecimento|calcula|48\s*h|tempo de resposta|capacidade|gargalo/i, answer: "As métricas do painel são operacionais: demanda, tempo de resposta, comparecimento e capacidade. Elas descrevem o período observado, usam amostras mínimas e não comprovam causalidade nem resultado clínico.", source: "Definições de métricas operacionais do piloto" },
  { scope: "pilot", keywords: /piloto|roadmap|futuro|emerg[eê]ncia|limite|onboard|institui[cç][aã]o/i, answer: "O Acolhe está em piloto institucional. Recursos documentados como roadmap ou conceito não devem ser tratados como disponíveis. O Acolhe não é serviço de emergência; em risco imediato, procure os serviços de emergência da sua região.", source: "Termos do piloto e documentação operacional" },
];

export function getProductKnowledge(question: string) { return entries.find(entry => entry.scope === "product" && entry.keywords.test(question)) || null; }
export function getPrivacyKnowledge(question: string) { return entries.find(entry => entry.scope === "privacy" && entry.keywords.test(question)) || null; }
export function getMetricDefinition(question: string) { return entries.find(entry => entry.scope === "metrics" && entry.keywords.test(question)) || null; }
export function getPilotStatus(question: string) { return entries.find(entry => entry.scope === "pilot" && entry.keywords.test(question)) || null; }
export function lookupKnowledge(question: string) { return entries.find(entry => entry.keywords.test(question)) || null; }
