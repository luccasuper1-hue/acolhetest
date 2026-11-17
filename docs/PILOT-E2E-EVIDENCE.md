# Evidências do piloto ponta a ponta

Este registro deve ser preenchido durante um teste controlado com contas de teste e sem conteúdo clínico real. Nenhuma etapa abaixo é considerada concluída apenas por existir no código.

## Execução

- Instituição:
- Ambiente/base URL:
- Data e hora (UTC):
- Versão do Worker:
- Responsável pelo teste:
- Contas usadas (IDs, nunca senhas):
- Resultado geral: `pendente` (o código e o roteiro estão prontos; a execução com contas de staging ainda precisa ser registrada)

## Regra de resposta do piloto

O prazo começa em `created_at` e corresponde a 48 horas corridas, inclusive fins de semana e feriados. O relógio fica ativo enquanto o pedido está `pending` e termina quando há aceite, recusa ou proposta de horário. O prazo é uma meta operacional do piloto, não uma garantia de atendimento clínico, disponibilidade profissional ou resultado terapêutico.

## Evidências por etapa

| Etapa | Resultado | Evidência/link | Observação |
| --- | --- | --- | --- |
| Cadastro e código da instituição | pendente |  |  |
| Convite e ativação do profissional | pendente |  |  |
| Cadastro do estudante, consentimento `pilot-v1` e regra de idade | pendente |  | Criança bloqueada até validação; adolescente segue fluxo normal |
| Pedido, proposta e confirmação | pendente |  |  |
| Atualização dos dois painéis/notificações | pendente |  |  |
| Mensagem realtime ou fallback | pendente |  |  |
| Link da sala | pendente |  |  |
| Encerramento/ausência no horário correto | pendente |  |  |
| Encaminhamento operacional | pendente |  |  |
| Feedback | pendente |  |  |
| Certificado emitido e validado | pendente |  |  |
| Visibilidade institucional agregada | pendente |  |  |

## Exercício de incidentes

| Cenário | Resultado | Evidência |
| --- | --- | --- |
| Banco indisponível | validado por contrato; falta teste controlado em staging | `docs/INCIDENT-DRILL-RESULTS.md` |
| Worker indisponível | parcialmente validado; alerta ainda precisa ser observado | `docs/INCIDENT-DRILL-RESULTS.md` |
| E-mail indisponível | validado por contrato | `docs/INCIDENT-DRILL-RESULTS.md` |
| Menor sem consentimento | pendente de regra jurídica e de produto | `docs/INCIDENT-DRILL-RESULTS.md` |
| Restore em banco separado | pendente de credenciais, ferramenta e arquivo de backup | `docs/INCIDENT-DRILL-RESULTS.md` |

Não registrar texto de conversa, senha, token ou dado clínico neste documento.
