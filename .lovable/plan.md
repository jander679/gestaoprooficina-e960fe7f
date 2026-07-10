## Objetivo
Permitir que o administrador da oficina cadastre colaboradores usando apenas **nome de usuário + senha** (sem e-mail). O colaborador entra no sistema por essas credenciais, é reconhecido automaticamente pelo perfil e, se pertencer a mais de uma oficina, escolhe qual acessar no login — já com os dados atualizados da unidade escolhida.

## Mudanças no backend (migração)

1. **Novo campo `username` em `profiles`**
   - `username citext unique` (case-insensitive, sem espaços).
   - Índice único parcial ignorando NULL (usuários antigos por e-mail continuam válidos).

2. **Colaborador sem e-mail real**
   - Ao criar colaborador, geramos internamente um pseudo-e-mail determinístico `usuario+<username>@oficina.local` só para satisfazer o `auth.users` (que exige e-mail). O usuário nunca vê nem digita esse valor.
   - `handle_new_user` passa a preencher `username` a partir de `raw_user_meta_data->>'username'` quando presente e marca `account_access.status = 'approved'` automaticamente para colaboradores criados por um `oficina_admin` (não precisam passar pelo super admin — só o dono da oficina passa).

3. **Função RPC `resolve_username_email(_username text)`**
   - `SECURITY DEFINER`, retorna o e-mail interno correspondente ao username para o cliente conseguir chamar `signInWithPassword`.
   - Sem vazar dados: só devolve o e-mail se o username existir, senão erro genérico "credenciais inválidas".

## Mudanças no fluxo de cadastro de colaborador
Tela **Colaboradores** (`app.colaboradores.tsx`):
- Formulário passa a pedir: **Nome completo**, **Nome de usuário (login)**, **Senha**, **Perfil** (mecânico / recepcionista / financeiro / admin da oficina), **Telefone (opcional)**.
- Server function nova `createStaffAccount` (`admin.functions.ts` estilo, com `requireSupabaseAuth` + verificação de que o chamador é `oficina_admin` da unidade):
  1. valida username único;
  2. cria usuário via `supabaseAdmin.auth.admin.createUser` com o pseudo-e-mail, senha, `email_confirm: true` e `user_metadata: { username, full_name }`;
  3. aprova `account_access`;
  4. cria `membership` com role e `unit_id` selecionados.
- Botão "Redefinir senha" já existente continua funcionando.
- Botão novo "Alterar login (username)".

## Mudanças na tela de login (`/auth`)
- Campo principal passa a ser **"Usuário ou e-mail"** + **Senha**.
- Se o valor contém `@`, entra direto por `signInWithPassword({ email })`.
- Caso contrário, chama `resolve_username_email` e usa o e-mail retornado para logar. Mensagem de erro padronizada em pt-BR ("Usuário ou senha inválidos").
- Cadastro público (dono de oficina) continua exigindo e-mail real — nada muda ali.

## Seleção de oficina no login
- Após login bem-sucedido, `use-active-unit` já busca todas as `memberships` ativas do usuário.
- Alterações:
  - Se `memberships.length > 1` **e** ainda não há unidade ativa salva, o `app.tsx` redireciona para uma nova rota `/app/selecionar-unidade`.
  - Página **Selecionar Unidade** lista cada oficina/unidade (nome fantasia + cidade + papel do colaborador ali) em cartões clicáveis. Ao clicar, salva `activeUnitId` e vai para `/app/dashboard`.
  - O seletor de unidade no topo do `app-shell` continua permitindo troca a qualquer momento; ao trocar, invalidamos as queries (`queryClient.invalidateQueries()`) para recarregar clientes/OS/estoque da nova unidade sem stale data.
- Se `memberships.length === 1`, vai direto para o dashboard (comportamento atual).

## Ajustes finos
- `app-shell`: badge com o nome da oficina ativa + papel do usuário, e botão "Trocar oficina" que volta para `/app/selecionar-unidade`.
- Traduzir novos erros ("username já existe", "credenciais inválidas") em `src/lib/errors.ts`.
- `handle_new_user`: quando `raw_user_meta_data->>'created_by_admin' = 'true'`, pular a lógica de super_admin e marcar `approved`.

## Entregáveis
1. Migração SQL (username, RPC, trigger ajustada).
2. `createStaffAccount` / `updateStaffUsername` em `src/lib/admin.functions.ts`.
3. Refatoração de `src/routes/app.colaboradores.tsx` (formulário nome+senha+perfil).
4. Refatoração de `src/routes/auth.tsx` (login por username).
5. Nova rota `src/routes/app.selecionar-unidade.tsx`.
6. Ajustes em `src/routes/app.tsx`, `src/components/app-shell.tsx`, `src/hooks/use-active-unit.tsx` (invalidar cache ao trocar), `src/lib/errors.ts`.
