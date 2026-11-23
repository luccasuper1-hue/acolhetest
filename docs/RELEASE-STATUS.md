# Estado do release

## Referência atual — 23/11/2026

- Commit/tag reproduzível: atualização do modelo Workers AI após a publicação de 22/11/2026.
- Produção: `b2b313f3-65da-4e8c-ac21-35d7eaf69351` — `APP_ENV=production`.
- Staging: `5402ef6a-759a-46ca-9b5c-b81a3134db6d` — `APP_ENV=staging`.
- Origens: `https://acolhetest.luccasuper1.workers.dev` e `https://acolhetest-staging.luccasuper1.workers.dev`.
- Health GET: HTTP 200 e `database: ok` nos dois ambientes.
- Gates locais: Worker 89/89; frontend 314/314; TypeScript, lint, build e bundle budget aprovados.
- O staging continua na versão anterior; esta correção foi promovida somente para produção, conforme a autorização de publicação.
- A correção publicada remove a renderização duplicada do resultado do Insights, evitando que a versão legada sobrescreva a leitura operacional com “Leitura limitada”.
- Esta publicação adiciona perguntas livres, classificação natural de intenções, clarificação de perguntas ambíguas e aprofundamento contextualizado sem memória persistente.
- A interface do resultado foi simplificada: a resposta aparece em texto contínuo; os blocos separados ficam removidos e fontes/limitações permanecem recolhíveis.
- O parser do provedor agora extrai respostas humanas quando o modelo aninha JSON dentro de `answer`, evitando exibir chaves e estrutura técnica no painel.
- Saudações simples, erros de digitação e perguntas gerais sobre o projeto agora são reconhecidos antes do fallback de escopo; perguntas naturais não precisam repetir frases pré-programadas.
- Probes anônimas de `/api/live`, `/api/ready` e `/api/health` agora usam deduplicação no isolate e cache curto no edge; o liveness não consulta o banco.
- O shell autenticado limita refresh disparado por troca de aba a uma janela de 15 segundos, evitando bursts de chamadas duplicadas.
- O dashboard profissional passou a buscar relações auxiliares no mesmo RPC agregado do `MongoGateway`, reduzindo round-trips sem alterar o contrato público.
- O dashboard estudantil passou a reutilizar profissionais e horários do plano agregado, evitando leituras duplicadas ao abrir o painel.
- As dez agregações das métricas institucionais agora atravessam o gateway em um único batch limitado e allowlisted.
- Esta publicação adiciona a base de conhecimento segura do produto e o escopo operacional do profissional.
- O painel agora deixa visível que o Insights é um assistente do projeto: as sugestões cobrem fluxo do piloto, privacidade, métricas, demanda e gargalos, e cada resposta identifica seu escopo (Produto, Privacidade, Métricas, Piloto ou Operação).
- A base de conhecimento agora responde tópicos específicos dos painéis, como a finalidade das notificações do estudante, sem mostrar amostra fictícia para respostas documentais.
- O Insights institucional foi movido para um launcher flutuante com o ícone oficial: o painel principal fica compacto e o chat abre sob demanda com atalhos e pergunta livre.
- O launcher agora reutiliza exatamente o componente visual `corner-logo` já usado nas subpáginas, incluindo moldura, glow, animação e tooltip.
- O launcher do Insights recebeu uma estrela de quatro pontas amarela no canto superior direito, preservando o `corner-logo` original.
- O chat do Insights agora reutiliza o shell autenticado dos outros painéis, com bolhas, composer inferior, rolagem e chips compactos.
- A resposta do Insights foi refinada para uma bolha compacta, com detalhes e fontes sob demanda, evitando relatório grande dentro do chat.
- O parser do Workers AI agora normaliza JSON textual aninhado antes da validação, impedindo que chaves técnicas apareçam na conversa.
- O Acolhe Insights usa `@cf/meta/llama-3.1-8b-instruct-fast`; a variante AWQ anterior estava depreciada e causava fallback seguro.
- E2E autenticado e carga não foram executados nesta promoção; permanecem validações separadas, não inventadas.

- Última publicação autorizada: ciclo 678 — preenchimento integral do card de pedido em 22/11/2026.
- Versão do Worker: `57c02561-a44a-487d-9b39-2a6eaf3b42af`.
- Origem pública: `https://acolhetest.luccasuper1.workers.dev`.
- Smoke pós-publicação: aprovado para home, liveness/readiness/health GET/HEAD, arquivos de descoberta e headers de segurança em 2026-11-22 UTC.
- Staging validado antes da promoção: `ead148a0-80ef-4a8a-86e9-2f233440d576`; smoke, E2E autenticado, restore separado e carga controlada aprovados.
- Smoke pós-promoção em produção: aprovado para home, liveness/readiness GET/HEAD, arquivos de descoberta e headers de segurança.
- Esta publicação inclui a divisão de gráficos, animações e componentes Radix em chunks de fornecedor; o chunk inicial caiu para aproximadamente 159 kB.
- O ciclo 674 inclui os refinamentos dos ciclos 672–674: launcher de mensagens com etiqueta e contagem estáveis e proteção contra overflow no mobile, com gates completos e smoke público pós-deploy aprovado.
- Próximo marco de publicação: próximo lote de três ciclos, condicionado ao gate de testes, build e smoke.

O ciclo 250 incluiu os refinamentos locais dos ciclos 201–249, build de produção, pacote verificado e smoke público aprovado. Este registro deve ser atualizado junto com cada publicação autorizada. Alterações locais posteriores não são consideradas parte desta versão até passarem pelo gate de deploy e por um novo smoke test.
- Esta publicação inclui a leitura paralelizada dos painéis autenticados, o healthcheck sem contagem da coleção de usuários, a projeção mínima na validação pública de certificados, a deduplicação de consultas compartilhadas e o pool MongoDB limitado a 4 conexões por Durable Object, com `maxIdleTimeMS` de 30 segundos.
- Esta promoção inclui a separação liveness/readiness, isolamento do Durable Object por ambiente, telemetria segura de requisições/consultas lentas e o E2E autenticado controlado validado no staging.
- Esta promoção inclui os documentos de governança/retensão/incidentes, o mapa de modularização, os módulos compartilhados de privacidade/operações e a sanitização centralizada de logs.
- Tentativa autorizada em 21/11/2026: versão `77d922f6-261c-4d08-aade-e8b5552ada0e` foi enviada, mas o smoke GET/HEAD `/api/health` retornou HTTP 503 por indisponibilidade do banco associada ao bloqueio diário de Durable Objects. Ela não substitui a versão de referência até a repetição do smoke após o reset da cota.
