# Correção: cadastro de empresa + idioma pt-BR nativo

## Causa raiz do erro

Ao aprovar uma nova conta e o usuário tentar cadastrar sua empresa, o fluxo em `src/routes/app.configuracoes.tsx` faz três inserts em sequência: `companies` → `units` → `memberships`. As policies atuais bloqueiam o terceiro passo:

- `memberships` INSERT exige `is_super_admin(uid)` OU `is_unit_admin(uid, unit_id)`.
- Como o usuário ainda **não é** admin da unidade recém-criada (a membership é justamente o que estava tentando criar), o RLS rejeita — clássico problema ovo-e-galinha.
- O mesmo acontece ao criar uma **nova unidade** dentro de uma empresa existente: o insert em `memberships` para dar acesso ao criador é bloqueado.

Também há uma segunda falha latente: a política de INSERT de `units` só permite quem já é `oficina_admin` da company OU o `criada_por` da company — funciona no primeiro caso, mas travará convidados no futuro.

## Correções

### 1. Banco de dados (migração)

Criar um trigger `AFTER INSERT` em `public.units` (SECURITY DEFINER) que garante uma `memberships` com role `oficina_admin` para o criador quando:

- o usuário é o `criada_por` da company (primeira unidade), ou
- o usuário já é `oficina_admin` de qualquer outra unidade da mesma company (nova unidade em company existente).

Isso remove a necessidade de o cliente inserir a membership manualmente, fecha o buraco de RLS e mantém segurança (o trigger só concede acesso a quem já é dono/admin da company).

### 2. Frontend `src/routes/app.configuracoes.tsx`

- Remover os `insert` manuais em `memberships` (agora feitos pelo trigger).
- Após criar, chamar `refetch()` do `useActiveUnit` para carregar a nova membership.
- Traduzir todas strings hardcoded restantes ("Empresa criada!", "Unidade criada!", "Cadastre uma empresa primeiro.", "Nome da primeira unidade", "Matriz", "Você não tem vínculo nesta unidade") usando `t(...)` com novas chaves em `settings.*`.
- Traduzir mensagens de erro do toast: mapear `error.message` do Supabase (em inglês) para um texto pt-BR amigável (ex.: unique violation em CNPJ → "Já existe uma empresa cadastrada com este CNPJ.").

### 3. i18n global pt-BR nativo

Em `src/lib/i18n.ts`:

- Trocar `fallbackLng` para `"pt-BR"` (já está) e **remover a detecção automática por navegador** para novos usuários: `detection: { order: ["localStorage"], caches: ["localStorage"] }` e definir `lng: "pt-BR"` como padrão inicial quando não houver preferência salva. Assim o sistema abre em pt-BR mesmo em navegadores em inglês.
- Adicionar chaves faltantes usadas em `configuracoes`, mensagens de erro comuns (`errors.generic`, `errors.cnpjDuplicado`, `errors.semPermissao`, `errors.semSessao`), `pendente`, `bloqueado`, `admin.contas`, e mensagens padrão de toast.

### 4. Utilitário de erros

Criar `src/lib/errors.ts` com função `traduzirErro(err)` que reconhece códigos comuns do PostgREST (`23505`, `42501`, `PGRST116`, mensagens "permission denied", "row-level security", "duplicate key") e devolve texto pt-BR. Aplicar em todos os `onError` dos módulos já existentes (`clientes`, `veiculos`, `servicos`, `configuracoes`, `admin.contas`).

### 5. Verificação

Após aplicar: fazer login com uma conta recém-aprovada, cadastrar empresa + primeira unidade, criar segunda unidade, e confirmar que a sidebar carrega o seletor de unidade sem erro. Verificar via console/network que nenhuma requisição retorna 403/42501.

## Fora de escopo

- Não altero módulos ainda não implementados (Peças, OS, Financeiro) — apenas garanto que os textos base já estejam em pt-BR quando forem criados.
- Não mexo em `client.ts`, `types.ts` ou `.env` (auto-gerados).
