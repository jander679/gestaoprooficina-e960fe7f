## Diagnóstico

O usuário aprovado (`teste@teste.com`, status=`approved`) recebe erro de permissão ao criar empresa em **Configurações → Empresa**. As policies estão no banco:

- `companies INSERT`: `criada_por = auth.uid() AND access_active(auth.uid())`
- `units INSERT`: exige ser criador da empresa **ou** já ser `oficina_admin` da empresa
- Trigger `tg_units_grant_creator_membership` só cria a membership de `oficina_admin` **se** o usuário for `criada_por` da empresa **ou** já for admin dela

As policies estão corretas em teoria, mas há três causas prováveis do erro na prática:

1. **`access_active` pode falhar em SECURITY INVOKER dentro da policy** — a função é `SECURITY DEFINER` mas está sendo chamada com `auth.uid()` que dentro do contexto da policy funciona; mesmo assim, o padrão mais robusto é reescrever a policy sem depender dela no INSERT (usar apenas `criada_por = auth.uid()`), já que a aprovação já é validada no login/gate.
2. **A mensagem "Sem permissão" vinda do trigger `tg_protect_super_admin`** — esse trigger dispara em INSERT/UPDATE de `profiles`, `user_roles`, `account_access`. Se por algum motivo o handle_new_user inseriu conflito, pode estar bloqueando. Precisa ser verificado.
3. **O usuário está sem `memberships` e o `useActiveUnit` pode não permitir renderizar Configurações** — já foi tratado, mas confirmar redirect.

## Plano de correção

### 1. Reescrever RLS de `companies` e `units` para ser à prova de sessão

- **companies INSERT**: `WITH CHECK (criada_por = auth.uid())` — remover dependência de `access_active` (o gate `/pendente` e `/bloqueado` já bloqueia usuários não-aprovados no frontend, e o super admin controla o status).
- **companies UPDATE/DELETE**: permitir ao criador (`criada_por = auth.uid()`), a qualquer `oficina_admin` de qualquer unit da empresa, e ao `super_admin`.
- **units INSERT**: permitir se o usuário for criador da empresa OU `oficina_admin` de qualquer unit existente da empresa OU `super_admin`. Manter isolamento por unit_id nos dados (customers, vehicles, OS etc.) — a criação de novas unidades não vaza dados entre elas.
- **units UPDATE/DELETE**: idem — criador da empresa, admin da empresa, ou super_admin.

### 2. Garantir permissões completas do perfil `oficina_admin`

Verificar e ajustar (se necessário) as policies das tabelas de escopo por unidade para permitir ao `oficina_admin` **cadastrar e excluir** em toda a empresa:

- `customers`, `vehicles`, `services_catalog`, `parts`, `part_batches`, `service_orders`, `os_items`, `os_payments`, `memberships` — INSERT/UPDATE/DELETE liberados quando o usuário for `oficina_admin` de qualquer unit da mesma empresa (não apenas da unidade específica), preservando `unit_id` para leitura escopada.
- Isolamento de leitura por unidade continua: `SELECT` escopado por `is_member(auth.uid(), unit_id)` — **cada unidade mantém sua base separada** ao consultar.

### 3. Permitir alterar dados de perfil dos colaboradores criados

- Policy em `profiles`: adicionar `UPDATE` permitido quando o alvo é membro de alguma unit onde `auth.uid()` é `oficina_admin`, mas nunca sobre um `super_admin` (trigger `tg_protect_super_admin` já garante isso).
- Já existe server function `updateMembership` — validar que aceita chamadas de `oficina_admin`, não só super_admin.

### 4. Melhorar tradução do erro

No frontend `traduzirErro`, garantir que o código `42501` (permission denied) mostre mensagem clara em pt-BR indicando qual ação não foi permitida, para facilitar diagnóstico futuro.

### 5. Validação

Após migração:
- Fazer login como `teste@teste.com`, criar empresa + unidade em Configurações — deve funcionar sem erro.
- Criar segunda unidade — deve funcionar.
- Cadastrar cliente, veículo, peça, serviço, colaborador — todos devem funcionar.
- Confirmar via query que membership `oficina_admin` foi criada automaticamente pelo trigger em cada unit nova.

## Arquivos afetados

- **Migração SQL** (nova): reescreve policies de `companies`, `units`, `profiles` e amplia policies de `customers/vehicles/services_catalog/parts/part_batches/service_orders/os_items/os_payments/memberships` para o escopo de empresa do `oficina_admin`.
- `src/lib/errors.ts`: mensagem clara para `42501`.
- `src/lib/admin.functions.ts` (se necessário): abrir `updateMembership` para `oficina_admin` da mesma empresa.
