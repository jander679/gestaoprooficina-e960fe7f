
# Plano: Peças, Colaboradores, Financeiro, OS + Base FIPE de veículos

## 1. Diagnóstico do "não está funcionando"

Os itens Peças, Colaboradores e Financeiro aparecem na barra lateral (`src/components/app-shell.tsx`) mas os arquivos de rota **não existem** em `src/routes/`. Ao clicar, o TanStack Router não acha o match e a página fica vazia — não é bug de banco, é módulo faltando. Vou criar tudo agora, junto com Ordens de Serviço (que sustenta o Financeiro).

## 2. Módulos a criar (frontend)

Cada tela segue o padrão já usado em Clientes/Veículos/Serviços: `useQuery` para listar, `useMutation` + `traduzirErro` para salvar/excluir, filtro por `activeUnitId`, textos em pt-BR via `t(...)`.

- **`app.pecas.tsx`** — CRUD de peças (nome, SKU, unidade, preço padrão opcional, estoque mínimo). Botão "Ver lotes" abre diálogo com CRUD de `part_batches` (lote, quantidade, custo, preço de venda — todos opcionais exceto quantidade).
- **`app.colaboradores.tsx`** — lista `memberships` da unidade ativa com nome/email vindos de `profiles`. Ações: **Convidar** (cria linha em `invitations` com role e envia link `/auth?invite=<token>`), **Ativar/Desativar** (toggle `ativo`), **Alterar cargo** (role: `oficina_admin | mecanico | recepcionista | financeiro`), **Remover**. Também lista convites pendentes com "Reenviar" e "Cancelar".
- **`app.ordens.tsx`** — lista de OS da unidade (filtros: status, período, cliente). Botão "Nova OS" abre wizard/dialog: seleciona cliente → veículo do cliente → adiciona itens (`os_items`: tipo serviço/peça, referência ao catálogo, quantidade, valor unit., desconto) → status inicial `aberta`. Ao salvar chama `next_os_number(unit)` para numerar. Trigger `recalc_os_total` já cuida do total.
- **`app.ordens.$id.tsx`** — detalhe/edição da OS: dados do cliente/veículo, itens (adicionar/editar/remover), pagamentos (`os_payments`: forma — dinheiro, PIX, débito, crédito, boleto — valor, data), mudança de status (aberta → em_execucao → aguardando_pagamento → concluida / cancelada), impressão.
- **`app.financeiro.tsx`** — dashboard financeiro da unidade: cards de recebido no mês, a receber, ticket médio; gráfico simples de receita por dia (últimos 30d); tabela de pagamentos (`os_payments` join `service_orders`) com filtros de período e forma; exportar CSV.

## 3. Ajustes de banco (uma migração)

Só o necessário para os módulos acima:

- Revisar policies de INSERT em `parts`, `part_batches`, `memberships`, `invitations`, `service_orders`, `os_items`, `os_payments` — garantir `WITH CHECK` permitindo membros ativos da `unit_id` (via `is_member(auth.uid(), unit_id)`), e `oficina_admin` para criar convites/colaboradores. Adicionar GRANTs faltantes se houver.
- Coluna `forma_pagamento` em `os_payments` como enum `metodo_pagamento` (`dinheiro`, `pix`, `debito`, `credito`, `boleto`, `transferencia`) — se ainda não existir com esse tipo.
- Índices em `os_payments(unit_id, paid_at)` e `service_orders(unit_id, status, created_at)` para o financeiro.

## 4. Base de veículos (FIPE Brasil)

Vou implementar como **FIPE (Brasil)** com espaço para expandir depois. Motivo em bom português: não existe base mundial única, gratuita e atualizada de marca/modelo/ano. FIPE cobre 100% do mercado brasileiro (carros, motos, caminhões), é oficial e é atualizada uma vez por mês.

**Arquitetura:**

- Tabelas novas (public, read-only para `authenticated` e `anon`):
  - `fipe_brands (id, tipo, codigo, nome)` — tipo ∈ carros/motos/caminhoes
  - `fipe_models (id, brand_id, codigo, nome)`
  - `fipe_years (id, model_id, codigo, nome, combustivel)`
  - `fipe_sync_log (id, started_at, finished_at, status, notas)`
- **Sincronização automática**: server route `/api/public/hooks/fipe-sync` (protegido por apikey do Supabase, padrão dos cron jobs) que consome a API pública `parallelum.com.br/fipe/api/v2` (sem chave) e faz upsert. `pg_cron` agenda **dia 5 de cada mês às 03:00** (`0 3 5 * *`) — a FIPE atualiza no início do mês.
- **Bootstrap**: a mesma rota aceita `?full=1` para popular a base na primeira execução; disparo automático logo após a migração via `pg_net`.
- **UI em `app.veiculos.tsx`** (mantendo o cadastro atual): no diálogo de novo/editar veículo, adicionar seletores encadeados **Tipo → Marca → Modelo → Ano** que preenchem `marca`, `modelo` e `ano` do veículo. Campo texto livre continua disponível para casos não listados (importados, veículos antigos etc.), então a base FIPE é assistiva, não obrigatória — o cadastro por parte da empresa segue igual.

## 5. i18n

Novas chaves em `src/lib/i18n.ts` para: `parts.*`, `batches.*`, `staff.*` (roles, convite, status), `orders.*` (status, itens, pagamentos), `finance.*` (cards, filtros, formas de pagamento), `fipe.*` (tipo, marca, modelo, ano, "usar catálogo FIPE", "não encontrei meu veículo").

## 6. Verificação

Após implementar: navegar pelos 5 módulos criados, criar 1 peça + lote, convidar colaborador, abrir OS com serviço + peça, registrar pagamento, conferir financeiro. Rodar `/api/public/hooks/fipe-sync?full=1` uma vez e cadastrar um veículo pelo seletor FIPE.

## Fora de escopo desta rodada

- Base **mundial** de veículos: só FIPE (Brasil) agora. Se quiser cobrir mercado externo depois, integramos NHTSA vPIC (EUA, por VIN) ou uma base paga — te aviso o custo antes.
- Emissão de NFS-e, integração bancária, comissão de mecânico por OS, kanban visual de OS — deixo para depois se você pedir.
- Páginas `admin/empresas` e `admin/auditoria` (também estão na sidebar sem arquivo) — foco desta rodada é o que travou pra você.
