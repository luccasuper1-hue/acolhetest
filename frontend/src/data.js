export const categories = [
  { id: "conversar", label: "Quero apenas conversar", icon: "◐", color: "mint" },
  { id: "nao-sei", label: "Não sei por onde começar", icon: "…", color: "lilac" },
  { id: "ansiedade", label: "Ansiedade", icon: "~", color: "lilac" },
  { id: "estresse", label: "Estresse", icon: "↗", color: "mint" },
  { id: "pressao", label: "Pressão escolar", icon: "◎", color: "peach" },
  { id: "relacoes", label: "Relacionamentos", icon: "◇", color: "blue" },
  { id: "familia", label: "Família", icon: "⌂", color: "lilac" },
  { id: "autoestima", label: "Autoestima", icon: "✦", color: "mint" },
  { id: "solidao", label: "Solidão", icon: "○", color: "peach" },
  { id: "estudos", label: "Estudos", icon: "□", color: "blue" },
  { id: "futuro", label: "Futuro", icon: "→", color: "lilac" },
  { id: "outros", label: "Outros", icon: "＋", color: "mint" },
];

export const professionals = [
  { id: "1", name: "Marina Alves", initials: "MA", color: "#8d75c7", areas: ["Ansiedade", "Estudos", "Autoestima"], description: "Perfil demonstrativo com foco em estudos, rotina e primeiros passos.", approach: "Abordagem demonstrativa e acolhedora", approachName: "Escuta acolhedora", experience: "Experiência demonstrativa com adolescentes", audience: "Estudantes do ensino médio", languages: ["Português"], format: "Vídeo ou áudio", availability: "Hoje · 18:30", slots: 4, duration: "20 ou 30 min", durations: ["20", "30"], price: "R$ 15–22", crp: "00/00000 — demonstrativo" },
  { id: "2", name: "Rafael Martins", initials: "RM", color: "#71b8a8", areas: ["Pressão escolar", "Futuro", "Estresse"], description: "Perfil demonstrativo para momentos de escolha, rotina e pressão acadêmica.", approach: "Escuta demonstrativa focada em objetivos", approachName: "Foco em objetivos", experience: "Experiência demonstrativa com transições", audience: "Estudantes e pré-universitários", languages: ["Português", "Inglês"], format: "Vídeo ou áudio", availability: "Amanhã · 10:30", slots: 6, duration: "15 ou 20 min", durations: ["15", "20"], price: "R$ 12–15", crp: "00/00000 — demonstrativo" },
  { id: "3", name: "Camila Rocha", initials: "CR", color: "#df9b82", areas: ["Relacionamentos", "Família", "Autoestima"], description: "Perfil demonstrativo para relações, identidade e momentos de mudança.", approach: "Abordagem demonstrativa centrada na pessoa", approachName: "Centrada na pessoa", experience: "Experiência demonstrativa com relações", audience: "Adolescentes e jovens adultos", languages: ["Português", "Espanhol"], format: "Somente vídeo", availability: "Quinta · 14:00", slots: 2, duration: "30 min", durations: ["30"], price: "R$ 22", crp: "00/00000 — demonstrativo" },
  { id: "4", name: "Lucas Mendes", initials: "LM", color: "#9b8bd0", areas: ["Estudos", "Estresse", "Organização"], description: "Perfil demonstrativo para estudos, organização e sensação de sobrecarga.", approach: "Organização demonstrativa de temas", approachName: "Organização e rotina", experience: "Experiência demonstrativa em rotina", audience: "Estudantes do ensino médio", languages: ["Português"], format: "Vídeo ou áudio", availability: "Sexta · 09:00", slots: 5, duration: "15, 20 ou 30 min", durations: ["15", "20", "30"], price: "R$ 12–22", crp: "00/00000 — demonstrativo" },
  { id: "5", name: "Beatriz Costa", initials: "BC", color: "#73a9c8", areas: ["Solidão", "Relacionamentos", "Mudanças"], description: "Perfil demonstrativo para solidão, vínculos e fases de mudança.", approach: "Escuta demonstrativa e cuidadosa", approachName: "Escuta cuidadosa", experience: "Experiência demonstrativa com mudanças", audience: "Adolescentes e jovens adultos", languages: ["Português", "Inglês"], format: "Vídeo ou áudio", availability: "Sábado · 16:00", slots: 3, duration: "20 ou 30 min", durations: ["20", "30"], price: "R$ 15–22", crp: "00/00000 — demonstrativo" },
];

export const demoTimes = ["09:00", "10:30", "14:00", "16:00", "18:30"];
export const unavailableTimes = { 0: ["09:00"], 1: ["14:00", "18:30"], 2: ["10:30"], 3: ["16:00"], 4: ["09:00", "14:00"] };
export const demoDays = ["Hoje", "Amanhã", "Quinta", "Sexta", "Sábado"];
export const demoDurations = [{ label: "15 minutos", price: "R$ 12", note: "Formato experimental — sujeito à validação profissional." }, { label: "20 minutos", price: "R$ 15" }, { label: "30 minutos", price: "R$ 22" }];

export const resources = [
  { id: "pressao", tag: "Rotina escolar", title: "Quando a escola ocupa espaço demais", text: "Provas, entregas e cobrança podem se acumular até parecer que não há espaço para nada além disso. Nomear o que pesa — o volume, o medo de errar, a comparação — costuma ser o primeiro movimento para separar o que é urgente do que apenas parece urgente. Conversar sobre isso não resolve o calendário, mas ajuda a decidir por onde começar." },
  { id: "vestibular", tag: "Vestibular", title: "Escolher um futuro sem carregar o mundo", text: "A pergunta “o que você vai ser?” chega antes de qualquer resposta possível. Vale lembrar que uma decisão tomada agora não fecha todas as portas depois. Falar sobre expectativas — as suas e as dos outros — costuma reduzir o tamanho da escolha." },
  { id: "relacoes", tag: "Relacionamentos", title: "Vínculos que ajudam e vínculos que cansam", text: "Amizades, famílias e relações mudam ao longo do tempo. Perceber como você se sente depois de estar com alguém é uma informação valiosa. Conversar sobre relações ajuda a enxergar padrões que, de dentro, ficam invisíveis." },
  { id: "solidao", tag: "Solidão", title: "Estar cercado de gente e ainda sentir falta", text: "Solidão não é só estar sozinho: é sentir que ninguém sabe exatamente como você está. Dar nome a isso, com alguém que escuta sem julgar, muda a experiência de carregar sozinho." },
  { id: "rotina", tag: "Autocuidado", title: "Pequenas rotinas contam mais do que grandes planos", text: "Sono, alimentação, movimento e pausas influenciam diretamente como um dia difícil é atravessado. Não existe rotina perfeita — existe a rotina possível para esta semana." },
  { id: "ajuda", tag: "Procurar ajuda", title: "Pedir ajuda não é sinal de que algo deu errado", text: "Procurar apoio profissional é uma decisão de cuidado, não um último recurso. Uma conversa breve pode ser suficiente para organizar os próximos passos — e, se fizer sentido, para buscar um acompanhamento contínuo." },
];
