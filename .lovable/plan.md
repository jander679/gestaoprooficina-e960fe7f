## Problema

Quando o Administrador Geral do Sistema aprova um novo usuário, ele entra em `/app` e não vê **nenhuma opção no menu lateral** — nem "Configurações" para cadastrar sua oficina.

Causa: o menu é filtrado por `can(role, ...)`, onde `role` vem de `activeMembership.role`. Um usuário recém-aprovado ainda **não tem membership** (só ganha `oficina_admin` via trigger *depois* de criar empresa/unidade). Sem membership → `role = null` → `can()` retorna `false` para tudo → sidebar vazio → impossível chegar em `/app/configuracoes` para criar a empresa. Catch-22.

## Correção

### 1. `src/components/app-shell.tsx` — modo "onboarding"
Quando o usuário está aprovado, **não é super admin** e `memberships.length === 0`:
- Mostrar no header a mensagem "Cadastre sua primeira oficina para liberar o sistema".
- Renderizar no sidebar **apenas** o item **Configurações** (com destaque visual), para que ele consiga chegar na tela de cadastro de empresa/unidade.
- Ocultar o seletor de unidade (não há nada para selecionar).

### 2. `src/routes/app.tsx` — redirecionamento inicial
Após os guards existentes (pending / bloqueado / super admin), adicionar:
- Se `!isSuperAdmin && memberships.length === 0` e a rota atual é `/app` ou `/app/dashboard`, redirecionar para `/app/configuracoes`.
- Assim o usuário aprovado cai direto na tela de "Cadastrar empresa".

### 3. `src/lib/permissions.ts` — helper `canOnboard`
Adicionar util `isOnboarding(memberships)` para os componentes decidirem se estão no fluxo pré-cadastro (opcional, só para deixar a intenção explícita e reaproveitável).

### 4. Confirmar fluxo pós-cadastro
Após o usuário cadastrar empresa + unidade em `/app/configuracoes`:
- O trigger `tg_units_grant_creator_membership` já cria membership `oficina_admin`.
- `useActiveUnit.refetch()` (já chamado nas mutations) recarrega memberships.
- `activeUnitId` passa a apontar para a nova unidade → `role = 'oficina_admin'` → sidebar completo (Dashboard, OS, Clientes, Veículos, Serviços, Peças, Colaboradores, Financeiro, Contas a Pagar, Configurações) conforme a matriz em `permissions.ts`, que já está correta para esse perfil.

Nenhuma mudança de banco / RLS / permissões é necessária — o problema é puramente de UI de onboarding.

## Arquivos a editar

- `src/components/app-shell.tsx` — sidebar em modo onboarding + mensagem no header.
- `src/routes/app.tsx` — redirect para `/app/configuracoes` quando sem memberships.
- `src/lib/permissions.ts` — (opcional) helper `isOnboarding`.

## Verificação

1. Logar com usuário recém-aprovado → cai em `/app/configuracoes` com sidebar mostrando apenas "Configurações".
2. Cadastrar empresa + primeira unidade → sidebar expande com todos os módulos do `oficina_admin`; seletor de unidade aparece no header.
3. Cadastrar segunda unidade em "Configurações → Unidades" → aparece no seletor, dados isolados por `unit_id` (RLS já garante).