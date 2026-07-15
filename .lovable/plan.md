## Plano de correção definitivo

Vou corrigir os pontos que ficaram pendentes e tratar o problema de idioma pela raiz, sem depender de tradução assíncrona nas telas principais.

### 1. Eliminar de vez o erro de linguagem (`os.title`, `common.all`, etc.)
- Remover o uso de `useTranslation()`/`t(...)` das telas operacionais onde estão aparecendo chaves, começando por:
  - Ordens de Serviço
  - Detalhe da OS
  - Dashboard
  - Configurações
  - Clientes, Veículos, Serviços e Peças, se ainda houver dependência visível
- Substituir por textos fixos em português pt-BR ou por um mapa local síncrono em português.
- Adicionar uma proteção global no i18n para que, mesmo se alguma chave sobrar no futuro, ela não apareça crua na interface.
- Validar procurando no DOM/texto da tela por padrões como `os.`, `common.`, `nav.`, `app.name`, `settings.` e `finance.`.

### 2. Ordem de Serviço completa e funcional
Na listagem e detalhe da OS, vou garantir:
- Tela de lista 100% em português.
- Criação de OS com:
  - Cliente obrigatório.
  - Veículo selecionável.
  - Funcionário/mecânico responsável.
  - Serviço cadastrado opcional.
  - Campo de descrição livre/observação quando não houver serviço cadastrado.
  - Valor, KM e observações.
- Detalhe da OS com ações claras por botão:
  - **Iniciar**
  - **Fechar OS**
  - **Reabrir OS**
  - **Cancelar OS**
  - **Salvar alterações**
  - **Imprimir / Baixar PDF**
- Permitir adicionar/alterar dados da OS a qualquer momento:
  - Itens/serviços/peças
  - Pagamentos
  - Diagnóstico
  - Observações ao cliente
  - Observações internas
  - Funcionário responsável
  - KM
- Se adicionar item ou pagamento em OS fechada/cancelada, a OS será reaberta automaticamente para `em andamento`.
- Ao fechar OS com saldo pendente, mostrar aviso e registrar como fechada com saldo.
- Ajustar os textos da impressão/PDF para continuar profissional e em pt-BR.

### 3. Financeiro separado de Contas a Pagar
Vou separar claramente os módulos:

**Financeiro** será apenas painel analítico:
- A receber.
- A pagar.
- Recebido.
- Pago.
- Saldo líquido.
- Fluxo por dia.
- Receitas por forma de pagamento.
- Despesas por categoria.
- Lista de receitas e despesas filtrada por período.
- Exportação CSV em pt-BR.

**Contas a Pagar** será cadastro operacional de dívidas:
- Descrição da dívida.
- Fornecedor.
- Categoria.
- Valor.
- Data de vencimento.
- Status: em aberto, paga, atrasada, cancelada.
- Data de pagamento.
- Método/observação.
- Recorrência mensal:
  - Dia do mês.
  - Data final opcional.
  - Geração automática das próximas parcelas.
- Filtros: todas, em aberto, pagas, atrasadas e mês atual.
- Ações: marcar como paga, cancelar, excluir quando permitido.

### 4. Banco de dados necessário
Vou confirmar e corrigir a estrutura do backend para suportar tudo acima:
- `service_orders` com campos de fechamento:
  - quem fechou
  - data de conclusão
  - fechada com saldo pendente
- `contas_pagar` com campos de recorrência:
  - recorrente
  - dia de recorrência
  - repetir até
  - conta mãe/parcela
- Trigger/função para gerar parcelas recorrentes sem duplicar dados.
- Políticas de permissão para permitir que os perfis autorizados da oficina criem, editem, reabram e fechem OS.

### 5. Verificação final obrigatória
Antes de concluir, vou verificar:
- A tela de Ordens de Serviço não mostra nenhuma chave de idioma.
- A tela de detalhe da OS tem os botões de ação e permite alteração/reabertura/fechamento.
- O Financeiro está analítico e separado de Contas a Pagar.
- Contas a Pagar permite cadastrar dívida recorrente.
- Não existe mais texto visível como `os.title`, `common.all`, `common.total`, `nav.dashboard`, `app.name` ou similares.