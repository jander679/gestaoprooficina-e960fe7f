## O que vou entregar

### 1. Ordem de Serviço (OS) — controle completo
- Adicionar botões de ação no cabeçalho da OS (`app.ordens.$id.tsx`):
  - **Iniciar / Pausar / Concluir / Reabrir / Cancelar** (um clique, sem mexer no dropdown).
  - **Reabrir** já existe, mas ficará mais visível e disponível também para OS canceladas.
- Permitir **acrescentar novos itens e pagamentos mesmo em OS concluídas** (hoje é bloqueado visualmente em alguns lugares) — ao adicionar algo em OS fechada, ela volta para `em_andamento` automaticamente e um toast avisa.
- Botão **"Fechar OS"** grande e destacado, que:
  - Confirma se há saldo em aberto (mostra alerta, mas permite fechar mesmo assim, marcando como "concluída com saldo pendente").
  - Registra `data_conclusao` e quem fechou.
- Campo de **observações adicionais** editável a qualquer momento (já existe) + histórico de alterações de status visível na OS.

### 2. Separar Financeiro de Contas a Pagar
**Contas a Pagar** (`app.financeiro.contas-pagar.tsx`) — vira cadastro de dívidas:
- Manter campos atuais + adicionar:
  - **Recorrência mensal** (checkbox + dia do mês + data final opcional).
  - Ao marcar recorrente, gera automaticamente as próximas 12 parcelas (ou até data final) em uma tabela `contas_pagar_parcelas` ligada à conta-mãe. Cada parcela tem seu próprio vencimento/status/pagamento.
- Filtros: pagas, em aberto, atrasadas, do mês.

**Financeiro** (`app.financeiro.tsx`) — vira painel analítico consolidado:
- 4 cards principais: **A Receber**, **A Pagar**, **Recebido**, **Pago** no período.
- Saldo líquido do período (Recebido − Pago).
- Gráfico por dia: entradas vs saídas.
- Quebra por método de pagamento (entradas).
- Quebra por categoria (saídas — vindas de contas_pagar).
- Lista unificada de lançamentos (receitas de OS + despesas de contas_pagar) com filtro pago/não pago.
- Exportar CSV do período (receitas + despesas).

### 3. Administrador da oficina pode editar Empresa e Unidades
Na página **Configurações** (`app.configuracoes.tsx`):
- Card da empresa vira **editável** (CNPJ, Razão Social, Nome Fantasia) com botão Salvar — restrito a `oficina_admin`/`super_admin` via RLS já existente (`can_manage_company`).
- Cada unidade listada ganha botão **Editar** (nome, endereço, cidade, UF, CEP, telefone) e **Excluir** (com confirmação, só se não houver OS vinculada).

## Detalhes técnicos

- **Migração de banco** necessária:
  - Adicionar colunas em `contas_pagar`: `recorrente boolean default false`, `recorrencia_dia_mes int`, `recorrencia_ate date`, `conta_mae_id uuid` (self-FK para parcelas).
  - Adicionar em `service_orders`: `fechada_por uuid`, `fechada_com_saldo boolean default false`.
  - Policies UPDATE em `companies` e `units` já cobrem edição por `oficina_admin` (via `can_manage_company`), confirmar e ajustar se faltar.
  - Trigger para gerar parcelas recorrentes ao inserir uma conta com `recorrente=true`.
- **Frontend**:
  - `app.ordens.$id.tsx`: barra de ações com botões coloridos por estado + remover bloqueio de edição em OS fechada.
  - `app.financeiro.tsx`: refazer consulta para agregar `os_payments` (receita) + `contas_pagar` / parcelas (despesa).
  - `app.financeiro.contas-pagar.tsx`: dialog ganha bloco "Recorrência mensal".
  - `app.configuracoes.tsx`: `CompanySection` e `UnitsSection` com modo edição.
- Todas as mensagens de erro passam por `traduzirErro` (pt-BR).