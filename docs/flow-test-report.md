# Auditoria de fluxo aluno ↔ profissional

Data: 14/11/2026  
Ambiente: `acolhetest.luccasuper1.workers.dev`

Última revalidação operacional: 17/11/2026 · Worker `3ccc7118-9954-407f-b7ca-a4b5b0ed524d` · suíte frontend: 108 testes aprovados.

## Cobertura executada

- 100 execuções repetidas do contrato frontend: 100 aprovadas, 0 falhas.
- Inspeção dos dois painéis abertos com um encontro direto confirmado.
- Verificação cruzada de estado, data, hora, status e disponibilidade do chat.
- Revisão estática dos caminhos de pedido, proposta individual, confirmação, cancelamento, chat e encerramento.

## Passou

- O estudante exibe o mesmo encontro confirmado que o profissional exibe como agendado.
- Data e hora do encontro são consistentes nos dois painéis.
- O chat aparece para aluno e profissional.
- O histórico do aluno preserva conversas anteriores canceladas.
- O profissional consegue continuar vendo disponibilidade e próximos encontros no mesmo painel.
- Propostas diretas agora geram/reservam um registro de capacidade antes de serem enviadas, mantendo os indicadores alinhados.
- A interface impede novo pedido enquanto o estudante possui atendimento ativo.

## Histórico da auditoria e estado atual

### Histórico da auditoria inicial

1. **Bloquear encerramento antecipado**  
   “Marcar como realizada” e “Registrar ausência” aparecem antes do início do encontro. O backend também aceita essas ações enquanto a sessão ainda está no futuro. Deve existir uma validação pelo horário do encontro.

2. **Link da sala para encontros diretos**  
   O painel profissional salva o link usando `request_id`, mas encontros diretos usam `appointment_request_id`. Nesse fluxo, o botão de link pode não salvar corretamente.

### Média prioridade

3. **Mensagem de situação do profissional**  
   Quando há uma conversa agendada, mas nenhum horário geral aberto, o painel ainda pode sugerir “Publique ao menos um horário”. A conversa marcada deveria ter prioridade na mensagem de próximo passo.

4. **Título do estudante para encontro confirmado**  
   “Seu atendimento está em andamento” aparece mesmo quando o encontro ainda está agendado para o futuro. “Conversa confirmada” seria mais preciso até o horário começar.

### Estado atual

Os quatro pontos acima pertencem à auditoria inicial e foram corrigidos no fluxo atual. A revalidação mais recente cobre os contratos de encerramento, links de sala, mensagens de estado e atualização cruzada dos painéis.

5. **Estado de horário durante a sessão**  
   O estudante vê o encontro confirmado, mas poderia ter uma indicação mais clara de “próximo passo”: abrir chat, acessar sala ou aguardar a data.

6. **Atualização entre abas**  
   O refresh periódico já existe, mas uma atualização imediata após proposta, confirmação, cancelamento ou mensagem reduziria a janela em que os dois painéis podem mostrar estados diferentes.

### Baixa prioridade

7. **Consistência de histórico**  
   Encontros regulares e diretos aparecem em blocos diferentes. O histórico poderia usar uma mesma linguagem para ambos.

8. **Disponibilidade presencial**  
   O fluxo está protegido por instituição, mas vale destacar no resumo do encontro que o presencial ocorre na instituição, sem endereço pessoal.

9. **Mensagens e notificações**  
   O chat está disponível nos dois lados; o próximo refinamento seria diferenciar visualmente mensagem nova de conversa apenas aberta.

## Limitação do teste

Não executei 100 mutações reais em produção (criar/cancelar/encerrar encontros), porque isso alteraria dados reais dos dois painéis abertos. As 100 repetições automatizadas cobriram o contrato frontend; os estados atuais foram inspecionados nos painéis reais e os caminhos de backend foram auditados no código.

## Próximos acompanhamentos

Os itens de código listados na auditoria inicial estão corrigidos no estado atual. O acompanhamento restante é operacional: executar os cenários ponta a ponta em staging com contas de teste e registrar evidências sem dados pessoais.

## Status desta rodada

Esta auditoria inicial foi superada pelas revalidações posteriores. O estado publicado atual é o Worker `3ccc7118-9954-407f-b7ca-a4b5b0ed524d`, com 108 testes frontend aprovados.

## Revalidação posterior

Em 17/11/2026, a revalidação atual passou com 108 testes e o Worker foi publicado na versão `3ccc7118-9954-407f-b7ca-a4b5b0ed524d`. Ela também confirmou o bloqueio de rolagem compartilhado e idempotente nos overlays; os itens externos de staging continuam pendentes conforme a seção de limitações.
