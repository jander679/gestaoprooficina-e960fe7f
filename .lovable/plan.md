## Objetivo

Refinar os 5 perfis conforme especificação, resolver o bloqueio de login por verificação de e-mail, e permitir reintegrar/excluir definitivamente acessos revogados. Adicionar relatórios financeiros do SaaS para o Administrador Geral do Sistema e módulo financeiro completo para a oficina.

---

## 1. Corrigir login (verificação de e-mail)

**Causa**: o projeto está com "Confirm email" ligado no Supabase Auth. O usuário se cadastra, recebe e-mail, mas mesmo confirmando não entra porque a `account_access` fica `pending` — a tela de "pendente" parece "não logou".

**Correção**:
- Chamar `configure_auth` com `auto_confirm_email: true` (dispensa clique no e-mail). O gate de acesso passa a ser **exclusivamente** a aprovação do Administrador Geral do Sistema, como pedido.
- Mensagem no cadastro: "Cadastro enviado. Aguarde aprovação do administrador geral do sistema."
- Login continua funcionando; se `account_access.status != approved`, redireciona para `/pendente` ou `/bloqueado` com o motivo correto (hoje já existe, só ajustar texto).

---

## 2. Perfis (matriz definitiva)

| Ação | super_admin | oficina_admin | recepcionista | mecânico | financeiro |
|---|---|---|---|---|---|
| Aprovar/pausar/revogar contas do SaaS | ✓ | — | — | — | — |
| Editar QUALQUER dado de QUALQUER unidade/perfil | ✓ | — | — | — | — |
| Relatórios financeiros do SaaS (MRR, mensalidades, inadimplência) | ✓ | — | — | — | — |
| Ninguém abaixo pode alterar dados do super_admin | (protegido) | — | — | — | — |
| Cadastrar empresa/unidades | — | ✓ | — | — | — |
| CRUD clientes/veículos/serviços/peças/colaboradores/unidades da própria oficina | — | ✓ | criar clientes/veículos/peças/serviços | criar clientes/veículos/peças/serviços | ver |
| Alterar dados de perfis criados por ele (na sua oficina) | — | ✓ | — | — | — |
| Abrir/fechar/**reabrir** OS + imprimir/enviar | — | ✓ | ✓ | ✓ | ver |
| Histórico de manutenções por veículo/cliente | — | ✓ | ✓ | ✓ | ✓ |
| Módulo Financeiro completo da oficina (pagamentos, boletos, contas a vencer, alterações auditadas) | — | ✓ | — | — | ✓ |

Ajustes no código:
- `src/lib/permissions.ts`: adicionar `orders:reopen`, `os:print`, `history:read`, `finance:edit`, `saas:finance`, `superadmin:edit_any`. Remover `parts:write` do mecânico (spec diz peças/serviços = cadastrar; mantém). Recepcionista ganha `parts:write` e `services:write` (cadastrar). Financeiro ganha `history:read` e `finance:edit`.
- `useCan`/sidebar já filtram — só refletir a matriz nova.

---

## 3. Proteger o super_admin

- Migração: RLS em `profiles`, `user_roles`, `account_access` — **bloquear UPDATE/DELETE** onde o alvo é super_admin, exceto se quem edita também é super_admin. Helper `is_super_admin(uid)` já existe.
- Server fns admin (`updateUserProfile`, `resetUserPassword`, `revokeUserAccess`, `setAccountStatus`) validam: se alvo é super_admin e ator não é super_admin → 403 (defesa em profundidade).

---

## 4. Super Admin — poder total sobre oficinas

Nova página `src/routes/app.admin.oficinas.tsx`:
- Lista todas as empresas/unidades do sistema.
- Drill-down por unidade: ver e **editar** colaboradores (nome, email, telefone, papel), resetar senha, ativar/desativar, trocar papel.
- Server fns novas em `admin.functions.ts`: `listAllUnits`, `listUnitStaff(unitId)`, `updateMembership(userId, unitId, {role, ativo})`, `updateAnyProfile` (já existe `updateUserProfile`, generalizar).
- Toda alteração grava em `audit_log` (já existe) com `actor_id`, `acao`, `entidade`, `entidade_id`, `payload`, timestamp.

---

## 5. Super Admin — Financeiro do SaaS (mensalidades)

Nova tabela `saas_subscriptions` (por `unit_id`): `plano`, `valor_mensal`, `dia_vencimento`, `status` (`ativa`|`suspensa`|`cancelada`), `inicio`, `fim`.
Nova tabela `saas_invoices`: `unit_id`, `competencia` (YYYY-MM), `valor`, `vencimento`, `pago_em`, `status` (`aberta`|`paga`|`atrasada`|`cancelada`), `metodo`.
Job mensal (`pg_cron` chamando `/api/public/hooks/saas-billing`) gera faturas do mês para unidades ativas.

Página `src/routes/app.admin.financeiro.tsx` (só super_admin):
- Cards: MRR, ARR, receita do mês, inadimplência, unidades ativas/suspensas.
- Lista de faturas com filtro por status e busca por unidade/empresa; marcar como paga, cancelar, gerar cobrança avulsa.
- Gráfico de receita mensal (12 meses) — usa `recharts` já instalado.
- Export CSV.

Ligação com o gate: se `saas_invoices` tem fatura atrasada > X dias, `account_access` da unidade vira `paused` automaticamente via trigger (configurável). Super admin pode `retomar` a qualquer momento.

---

## 6. Módulo Financeiro da oficina (perfil financeiro + oficina_admin)

Expandir `app.financeiro.tsx` e criar sub-rotas:
- **Recebimentos**: pagamentos de OS (já existe) + filtros por período/método/status.
- **Contas a receber**: OS fechadas com saldo pendente + boletos (nova tabela `os_boletos`: `os_id`, `valor`, `vencimento`, `linha_digitavel`, `status`).
- **Contas a pagar**: nova tabela `contas_pagar` (fornecedores, aluguel, folha) — CRUD simples com vencimento e status.
- **Fluxo de caixa**: entradas − saídas por dia/semana/mês.
- **Métodos de pagamento**: tabela `payment_methods` (dinheiro, pix, débito, crédito, boleto) por unidade — editável por oficina_admin.
- **Auditoria**: toda alteração em pagamento/boleto/conta grava `audit_log` (quem, quando, valor antes/depois). Aba "Histórico de alterações" na página financeira.

RLS: `financeiro` e `oficina_admin` leem/escrevem tudo da própria unidade; `recepcionista` só INSERT de pagamento vinculado a OS que ela abriu (mantém).

---

## 7. Reintegrar / excluir definitivamente contas revogadas

Hoje `revokeUserAccess` marca status = `rejected` e desativa memberships — não há volta nem exclusão.

- Novo status `revoked` distinto de `rejected` (pending inicial). Adicionar ao enum `access_status`.
- `setAccountStatus` aceita `approved` para reintegrar (reativa memberships desativados na revogação — guardar snapshot no `audit_log.payload`).
- Nova server fn `deleteUserAccount(userId)`: apaga via `supabaseAdmin.auth.admin.deleteUser` (cascata em `profiles`, `memberships`, `account_access` por FK). Só super_admin. Registra em `audit_log` antes de apagar.
- UI em `app.admin.contas.tsx`: filtro "Revogados" com botões **Reintegrar** e **Excluir definitivamente** (com confirmação dupla).

---

## 8. OS: reabrir + imprimir + histórico

- `service_orders.status` já tem enum; adicionar transição `fechada → aberta` (reabrir) — botão em `app.ordens.$id.tsx` visível para quem tem `orders:reopen`. Registra em `audit_log`.
- Botão "Imprimir/Enviar" já existe; garantir que aparece para recepcionista e mecânico.
- Nova página `app.veiculos.$id.tsx` e `app.clientes.$id.tsx` com aba "Histórico de OS" (lista de OS antigas com filtros). Link a partir da lista.

---

## 9. Verificação

- Cadastrar novo usuário → **não** pede confirmação de e-mail; login imediato leva para `/pendente`.
- Super admin aprova → usuário entra e vê apenas o que a matriz permite.
- Super admin edita colaborador de outra unidade → funciona; tenta editar outro super admin → 403.
- Super admin revoga → aparece em "Revogados"; reintegra → volta ativo com memberships; exclui → sumiu do banco.
- Financeiro/oficina_admin altera pagamento → aba de auditoria mostra quem/quando/antes/depois.
- Super admin abre `/app/admin/financeiro` → vê MRR, faturas, marca como paga.

---

## Detalhes técnicos

- Migrações: enum `access_status` add `revoked`; tabelas `saas_subscriptions`, `saas_invoices`, `os_boletos`, `contas_pagar`, `payment_methods`; RLS + GRANTs; triggers de auditoria financeira; trigger `protect_super_admin` em `profiles`/`user_roles`/`account_access`.
- `configure_auth`: `auto_confirm_email: true`, `disable_signup: false`, `external_anonymous_users_enabled: false`, `password_hibp_enabled: true`.
- Server fns novas em `src/lib/admin.functions.ts` e novo `src/lib/finance.functions.ts`.
- Novas rotas: `app.admin.oficinas.tsx`, `app.admin.financeiro.tsx`, `app.financeiro.contas-pagar.tsx`, `app.financeiro.fluxo.tsx`, `app.veiculos.$id.tsx`, `app.clientes.$id.tsx`.
- Cron mensal via `/api/public/hooks/saas-billing` (pg_cron + pg_net, autenticação por `apikey` anon).
