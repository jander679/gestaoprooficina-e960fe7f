
# Plano — Sistema para Oficinas Mecânicas (SaaS multi-tenant)

Sistema web bilíngue (PT-BR padrão / EN) para gestão de oficinas mecânicas, com hierarquia:
**Admin Geral do Sistema → Admin da Oficina (por CNPJ) → Unidades (endereços) → Colaboradores (Mecânico, Recepcionista, Financeiro)**.

## 1. Backend (Lovable Cloud)

Habilitar Lovable Cloud. Autenticação por e-mail/senha + Google. Todo dado protegido por RLS.

### Modelo de dados (principais tabelas)

```text
app_role                 enum: super_admin, oficina_admin, mecanico, recepcionista, financeiro
account_status           enum: pending, approved, rejected, paused, expired
os_status                enum: aberta, em_andamento, aguardando_peca, aguardando_aprovacao, concluida, cancelada
payment_method           enum: dinheiro, pix, credito, debito, boleto, transferencia, outro

companies                id, cnpj (unique), razao_social, nome_fantasia, criada_por (user_id)
units (oficinas)         id, company_id, nome, endereco, cidade, uf, cep, telefone, ativa
memberships              id, user_id, unit_id, role (app_role), ativo
                         → controla quem acessa qual unidade e com qual papel
account_access           id, user_id, status (account_status),
                         valido_ate (date, nullable), pausado_em, motivo, atualizado_por
                         → gate global do sistema (Super Admin controla)

customers                id, unit_id, nome, cpf_cnpj, telefone, email, endereco, observacoes
vehicles                 id, unit_id, customer_id, placa, marca, modelo, ano, cor, km_atual, chassi, obs

services_catalog         id, unit_id, nome, descricao, preco_padrao, tempo_estimado_min, ativo
parts                    id, unit_id, nome, sku, preco_venda_padrao, estoque_total, ativo
part_batches             id, part_id, lote (nullable), quantidade, preco_custo (nullable),
                         preco_venda (nullable), validade (nullable), fornecedor (nullable)
                         → lote e preço NÃO obrigatórios

service_orders (OS)      id, unit_id, numero (sequencial por unidade), customer_id, vehicle_id,
                         mecanico_id, status, km_entrada, diagnostico, observacoes_internas,
                         observacoes_cliente, data_abertura, data_conclusao, total
os_items                 id, os_id, tipo (servico|peca|descricao_livre),
                         referencia_id (nullable), descricao, quantidade,
                         preco_unitario, desconto, subtotal
                         → “descricao_livre” cobre serviços/valores extras
os_payments              id, os_id, metodo (payment_method), valor, pago_em, observacao

invitations              id, unit_id, email, role, token, expira_em, aceito_em, convidado_por
audit_log                id, actor_id, acao, entidade, entidade_id, payload, criado_em
```

RLS: toda tabela de dados operacionais filtra por `unit_id` cruzando com `memberships` do usuário atual (via função `security definer`). `super_admin` fica em `user_roles` separada (padrão Lovable) e tem bypass explícito por policies próprias. Trigger de auto-criação de `account_access` (status=`pending`) no signup.

Sequencial de OS por unidade via função Postgres.

### Server functions (TanStack `createServerFn`)

- `auth`: signup (cria pending), aceitar convite (token), trocar unidade ativa (grava em `user_metadata`).
- `super_admin`: listar contas, aprovar/rejeitar, pausar/despausar (toggle), definir `valido_ate`, revogar.
- `gate`: middleware `requireActiveAccount` que valida `account_access` (approved + não pausado + dentro da validade) — bloqueia todas as chamadas autenticadas quando inválido.
- Cadastros CRUD (customers, vehicles, services, parts, batches, colaboradores/convites).
- OS: criar, adicionar/remover itens, registrar pagamento, mudar status, calcular total.
- Financeiro: listagem por período, contas a receber, fechamento de caixa por unidade/dia.
- Convites por e-mail (via Lovable AI/Resend — decidir na build; MVP: link copiável).

## 2. Rotas (TanStack Router, file-based)

```text
/                         landing pública (apresenta o produto)
/auth                     login / cadastro / recuperar senha (público)
/aceitar-convite/$token   aceitar convite (público)
/pendente                 tela “Aguardando aprovação do administrador” (autenticado, sem gate)
/bloqueado                tela “Acesso pausado / expirado” (autenticado, sem gate)

/_authenticated/          layout gate: valida account_access → redireciona
  /app/                   layout com sidebar + seletor de unidade no topo
    /dashboard
    /clientes             lista + /$id (detalhe/edit) + /novo
    /veiculos             idem
    /servicos             catálogo de serviços
    /pecas                peças + aba “Lotes”
    /ordens               lista de OS + /$id (editor com itens/pagamentos) + /nova
    /colaboradores        lista + convidar
    /financeiro           recebimentos, caixa, relatórios
    /configuracoes        empresa, unidades (criar novo endereço no mesmo CNPJ)

  /_super/                layout extra: exige role super_admin
    /admin/contas         aprovar/pausar/definir validade (play/pause + date picker)
    /admin/empresas       visão geral de todas empresas/unidades
    /admin/auditoria      audit_log
```

Cada rota pública/leaf com `head()` próprio (title, description, OG). Home landing explica o produto.

## 3. UI / Design

- Stack shadcn/ui + Tailwind. Tema claro/escuro.
- Paleta profissional: azul-petróleo primário, âmbar como acento (remete a oficina sem virar clichê laranja).
- Tipografia: **Outfit** (títulos) + **Figtree** (corpo) via `@fontsource`.
- Layout app: sidebar fixa com navegação, topbar com **seletor de unidade** (dropdown), avatar, toggle idioma PT/EN, toggle tema.
- Tabelas com busca, filtros, paginação (TanStack Table).
- Editor de OS estilo “nota fiscal”: cabeçalho cliente/veículo, linhas de itens (serviço, peça ou descrição livre), rodapé com totais e pagamentos.
- Super Admin: cards por conta com botão **Play/Pause** grande e campo de data “Liberado até”.

## 4. i18n

`i18next` + `react-i18next`, arquivos `pt-BR.json` e `en.json`. Toggle salvo em `localStorage` + `user_metadata`.

## 5. Fluxos-chave

1. **Signup**: usuário cria conta → cria `company` (com CNPJ) + primeira `unit` → vira `oficina_admin` da unidade → `account_access = pending` → cai em `/pendente`.
2. **Super Admin aprova**: status vira `approved` → usuário entra no `/app/dashboard`.
3. **Pausar / expirar**: Super Admin clica Play/Pause ou define `valido_ate`. Próxima request cai no gate → `/bloqueado`.
4. **Nova unidade mesmo CNPJ**: em `/configuracoes/unidades` o admin adiciona endereço → nova `unit` sob a mesma `company` → aparece no seletor de unidades.
5. **Convite**: admin da oficina convida por e-mail com papel → destinatário aceita em `/aceitar-convite/$token` → cria `membership` para aquela unit.
6. **OS**: recepcionista cria OS → adiciona serviços/peças/itens livres → mecânico atualiza status → financeiro/recepcionista registra pagamento(s) → OS concluída.

## 6. Segurança

- Roles em tabela separada (`user_roles` + `memberships`), nunca no profile.
- Função `has_role` `SECURITY DEFINER` para RLS sem recursão.
- Middleware `requireSupabaseAuth` + `requireActiveAccount` em toda server fn autenticada.
- Validação Zod em todas as entradas.
- Audit log de ações sensíveis (aprovação, pausa, exclusão).

## 7. Entrega faseada dentro do “Tudo”

Para caber em uma primeira build sólida, implemento nesta ordem — tudo entra, mas se algo ficar apertado, financeiro avançado (relatórios/fechamento de caixa detalhado) vira segunda leva:

1. Cloud + schema + RLS + auth + gate de conta + Super Admin (aprovação, play/pause, validade).
2. Empresas/unidades + seletor + colaboradores/convites + i18n + tema.
3. Clientes, veículos, serviços, peças + lotes.
4. Ordens de Serviço completas + pagamentos.
5. Financeiro (recebimentos, caixa, relatórios) + dashboard.

## Confirmações antes de construir

- **Primeiro Super Admin**: crio um script/rota semente onde o primeiro e-mail que você me indicar é promovido automaticamente a `super_admin` na primeira execução. Me diga o e-mail agora ou depois.
- **Convite por e-mail**: MVP entrega link copiável na tela; disparo de e-mail real posso adicionar na sequência (usa Lovable AI/Resend).

Se estiver de acordo, aprovo e sigo para a construção.
