## Objetivo

Separar permissões por perfil e corrigir a base FIPE nos veículos.

## 1. Perfis e permissões

Papéis já existem no enum (`super_admin`, `oficina_admin`, `mecanico`, `recepcionista`, `financeiro`). Falta aplicar as regras de acesso na UI e no backend.

Matriz de acesso (por unidade):

| Módulo | super_admin | oficina_admin | mecanico | recepcionista | financeiro |
|---|---|---|---|---|---|
| Admin de contas (aprovar clientes do SaaS) | ✓ | — | — | — | — |
| Configurações da oficina (empresa/unidades) | — | ✓ | — | — | — |
| Colaboradores (convidar/editar) | — | ✓ | — | criar/convidar | — |
| Clientes | — | ✓ | ✓ | ✓ | ver |
| Veículos | — | ✓ | ✓ | ✓ | ver |
| Serviços (catálogo) | — | ✓ | ver | ver | ver |
| Peças / lotes | — | ✓ | ✓ | ver | ver |
| Ordens de Serviço (abrir/fechar) | — | ✓ | ✓ | ✓ | ver |
| Financeiro (pagamentos, relatórios) | — | ✓ | — | emitir nota da OS | ✓ |
| Dashboard | — | ✓ | resumido | resumido | financeiro |

Observação: `super_admin` **não** vê dados de oficina — a sidebar dele mostra só "Admin de contas" e o próprio perfil.

### O que vai mudar

- **Sidebar (`src/components/app-shell.tsx`)**: filtrar itens por `activeMembership.role` e esconder tudo que for de oficina quando for `super_admin`.
- **Guardas de rota**: cada `app.*.tsx` valida o papel no topo do componente; se não autorizado, mostra tela "Sem permissão".
- **Helper novo** `src/lib/permissions.ts`: `can(role, action)` centralizando a matriz acima, usado por sidebar e páginas.
- **RLS no banco**: hoje `memberships` autoriza qualquer papel a fazer tudo na unidade. Vou refinar as policies para:
  - `services_catalog`, `parts`, `part_batches`: INSERT/UPDATE/DELETE só para `oficina_admin`; SELECT para qualquer membro.
  - `os_payments`, relatórios financeiros: INSERT/UPDATE/DELETE só para `oficina_admin` e `financeiro`; `recepcionista` pode INSERT de pagamento vinculado à OS que ele fechou.
  - `memberships`/convites: INSERT por `oficina_admin` e `recepcionista`; UPDATE/DELETE só `oficina_admin`.
  - `service_orders` + `os_items`: todos os papéis operacionais podem criar/editar; apenas `oficina_admin` pode excluir.
  - `companies`/`units`: INSERT/UPDATE só `oficina_admin`.
- Função auxiliar `public.has_unit_role(_uid, _unit, _role[])` (SECURITY DEFINER) para evitar recursão nas policies.

## 2. Financeiro para recepcionista (nota da OS)

Recepcionista não entra no módulo Financeiro completo, mas ganha o botão "Emitir nota / recibo" dentro da própria OS (usa o print atual). Nada muda em BD.

## 3. FIPE não funciona

Causa: as tabelas FIPE existem mas estão vazias — o endpoint `/api/public/hooks/fipe-sync` nunca foi chamado, então os `<Select>` de marca/modelo/ano aparecem sem opções.

Correções:

- Adicionar botão **"Sincronizar base FIPE agora"** em `Configurações` (visível só para `oficina_admin` e `super_admin`), que faz `fetch("/api/public/hooks/fipe-sync", { method: "POST" })` e mostra progresso/toast. Sincroniza carros, motos e caminhões (leva alguns minutos na 1ª vez).
- Endpoint atual só sincroniza marcas+modelos; adicionar também **anos** (`fipe_years`) por modelo, senão o 3º select fica vazio.
- Tornar o endpoint **incremental e idempotente** (já usa upsert) e adicionar um parâmetro `?type=cars|motorcycles|trucks` para permitir sincronizar um tipo por vez sem timeout do worker.
- Agendar `pg_cron` mensal chamando o hook (uma tarefa por tipo).
- Fallback imediato: se a base ainda estiver vazia quando o usuário abrir o form de veículo, mostrar aviso "Base FIPE ainda não sincronizada — use cadastro manual" e alternar o switch automaticamente.

## 4. Verificação

- Login como `oficina_admin`, `mecanico`, `recepcionista`, `financeiro` (contas de teste) — validar que sidebar e ações batem com a matriz.
- Login como `super_admin` (thedinjoaopedro@gmail.com) — só vê Admin de contas.
- Testar RLS por `curl`/console tentando POST proibido (ex.: mecânico criando peça) e confirmar 403.
- Rodar sync FIPE, abrir cadastro de veículo, confirmar 3 selects populados (carros/motos/caminhões).

## Detalhes técnicos

- Nova migração para: função `has_unit_role`, DROP + CREATE das policies afetadas, tabela `fipe_years` já existe (só usar).
- `src/lib/permissions.ts` exporta `type Action` e `can(role, action)`.
- Hook `useCan(action)` em cima de `useActiveUnit` para uso em componentes.
- `app-shell.tsx` monta `items` filtrando por `can`.
- Cada página protegida usa `<RequirePermission action="parts:write">…</RequirePermission>` para botões e um early-return para a página inteira quando o papel nem lê.
