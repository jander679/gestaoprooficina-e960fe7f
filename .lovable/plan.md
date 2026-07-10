## Objetivo

Provisionar o e-mail **thedinjoaopedro@gmail.com** como **Administrador Geral (super_admin)** do sistema, com poderes completos sobre contas de clientes (oficinas), e construir a tela de administração onde ele exerce esses poderes.

## 1. Criação do usuário Super Admin

O trigger `handle_new_user` só promove a `super_admin` o **primeiro** usuário que se cadastrar. Como o banco pode já ter outros usuários, farei a promoção de forma explícita e idempotente via migration:

1. Criar o usuário em `auth.users` com a senha `Jander00*` (via `auth.admin` na migration, e-mail já confirmado) — se já existir, apenas reaproveita o `id`.
2. Garantir `profiles` para esse usuário.
3. Inserir em `public.user_roles` o papel `super_admin` (ON CONFLICT DO NOTHING).
4. Inserir/atualizar `public.account_access` para `status = 'approved'`, `valid_until = NULL`.
5. Registrar em `audit_log` a promoção (actor = próprio usuário do seed).

Assim, no primeiro login com `thedinjoaopedro@gmail.com` / `Jander00*`, ele entra direto como Super Admin, sem passar pela fila de aprovação.

## 2. Página do Administrador Geral — `/app/admin/contas`

Rota protegida que exige `is_super_admin(auth.uid()) = true` (checado via hook `useActiveUnit().isSuperAdmin`; usuários comuns são redirecionados).

**Listagem de contas** (todas as `account_access` + join com `profiles` + empresa/unidades vinculadas):

- Busca por nome/e-mail.
- Filtros por status: `pending`, `approved`, `paused`, `expired`, `rejected`.
- Colunas: usuário, empresa/CNPJ, status atual, `valid_until`, última alteração.

**Ações por conta (card/linha):**

| Ação | Efeito |
|---|---|
| **Aprovar** | status → `approved` |
| **Rejeitar** | status → `rejected` + motivo opcional |
| **Play/Pause** (toggle) | alterna entre `approved` ↔ `paused`, grava `paused_em` e `motivo` |
| **Definir "Liberado até DD/MM/AAAA"** | `valid_until = <data>`; gate marca como expirado automaticamente após a data |
| **Remover validade** | `valid_until = NULL` (acesso indefinido) |
| **Editar dados do cliente** | abre diálogo para editar `profiles.full_name`, `profiles.email` e, se necessário, `profiles.phone` |
| **Redefinir senha** | dispara `supabase.auth.admin.updateUserById` com nova senha via server function `resetUserPassword` (exige `super_admin` no middleware) |
| **Revogar acesso** | status → `rejected` + desativa todas as `memberships` do usuário |

Cada ação grava em `audit_log` (actor = super_admin, ação, entidade, payload com antes/depois).

## 3. Server functions necessárias (TanStack `createServerFn` + `requireSupabaseAuth`)

Todas verificam `has_role(userId, 'super_admin')` antes de executar; caso contrário, `403`. Carregam `supabaseAdmin` dentro do handler (`await import('@/integrations/supabase/client.server')`) — nunca no topo.

- `listAccounts()` → lista contas + profiles + empresas.
- `setAccountStatus({ userId, status, motivo? })` → aprovar / rejeitar / pausar / retomar.
- `setAccountValidity({ userId, validUntil | null })` → define ou remove data-limite.
- `updateUserProfile({ userId, fullName?, email?, phone? })` → atualiza `profiles` e (se e-mail mudar) `auth.admin.updateUserById`.
- `resetUserPassword({ userId, newPassword })` → `auth.admin.updateUserById({ password })`. Validação Zod (mínimo 8 caracteres).
- `revokeUserAccess({ userId })` → status `rejected` + `memberships.ativo = false`.

## 4. Gate de acesso (já existe, apenas confirmar)

O layout `/app` já usa `access_active()` + `account_access` para mandar para `/pendente` ou `/bloqueado`. Ao pausar ou definir `valid_until` no passado, o próximo carregamento do cliente cai no `/bloqueado` automaticamente — nada a mudar aí.

## 5. Navegação

Adicionar item **"Admin Geral"** no sidebar (`src/components/app-shell.tsx`), visível apenas quando `isSuperAdmin === true`, apontando para `/app/admin/contas`.

## 6. Fora do escopo desta etapa

Módulos ainda pendentes do plano geral (Peças, Ordens de Serviço, Colaboradores, Financeiro) seguem para as próximas etapas — este plano cobre apenas: (a) promover o e-mail informado a Super Admin, (b) entregar a página de administração com todos os controles descritos.

## Confirmação sobre a senha

Você colou a senha `Jander00*` no chat. Vou usá-la exatamente para criar/atualizar o usuário via migration (server-side, com service role). Recomendo trocá-la após o primeiro login em uma futura tela de "Meu perfil" — quer que eu já inclua essa tela nesta etapa também?
