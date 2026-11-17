# Exercício de recuperação e incidentes

Data da verificação: 16/11/2026 (UTC)

Este registro separa o que foi simulado no código do que ainda depende de um ambiente externo. Nenhum teste usa dados clínicos reais.

## Resultado resumido

| Cenário | Resultado | Evidência | Próximo passo |
| --- | --- | --- | --- |
| Banco indisponível | validado por contrato | Timeout de seleção do Mongo em 5s; erros de API são convertidos em resposta 500; transições já persistidas não dependem do broadcast realtime | Fazer uma indisponibilidade controlada em staging |
| Worker indisponível | parcialmente validado | Workflow verifica home e `/api/health` a cada 15 min | Confirmar notificações do GitHub e executar um teste controlado de alerta |
| E-mail indisponível | validado por contrato | Integração tem timeout de 8s; falha secundária não desfaz o registro persistido | Confirmar com um endpoint de e-mail de teste |
| Menor sem consentimento | bloqueado para regra de idade | Cadastro sem consentimento ou com versão inválida retorna 422; não há campo/política de menor implementado | Definir juridicamente idade, responsável e fluxo de consentimento antes do piloto |
| Restauração MongoDB | pendente externo | `mongodump`/`mongorestore`, URI, banco separado e arquivo `.archive.gz` não estão disponíveis neste ambiente | Executar restore mensal em staging com credenciais protegidas |

## Evidências técnicas

- Suíte frontend: 105 testes aprovados na revalidação atual.
- Worker publicado na versão `b7967cd7-fd6d-4c19-9954-670aa3c4dc45`.
- Checagem TypeScript do Worker: aprovada.
- Build de produção: aprovado.
- Healthcheck público: HTTP 200.
- O fallback realtime não desfaz uma alteração persistida quando o gateway de broadcast falha.
- O cliente pausa polling de fallback quando a aba está oculta e retoma com backoff.
- O envio de e-mail possui timeout limitado e não transforma falha de notificação secundária em perda do registro principal.

## Limites do exercício

Não desligamos produção, não alteramos o banco real e não usamos dados pessoais para provocar falhas. Para concluir a validação operacional, repetir os cenários em staging com uma conta de teste, registrar horário, versão e resposta observada, e anexar os logs sem tokens ou conteúdo de conversa.
