// Central permission matrix. Keep in sync with RLS policies.
export type Role =
  | "super_admin"
  | "oficina_admin"
  | "mecanico"
  | "recepcionista"
  | "financeiro";

export type Action =
  // Navegação
  | "nav.dashboard"
  | "nav.orders"
  | "nav.customers"
  | "nav.vehicles"
  | "nav.services"
  | "nav.parts"
  | "nav.staff"
  | "nav.finance"
  | "nav.settings"
  | "nav.accounts"
  | "nav.admin_oficinas"
  | "nav.admin_financeiro"
  // Escrita
  | "customers:write"
  | "vehicles:write"
  | "services:write"
  | "parts:write"
  | "staff:write"
  | "staff:invite"
  | "orders:write"
  | "orders:reopen"
  | "orders:delete"
  | "orders:print"
  | "payments:write"
  | "settings:write"
  | "fipe:sync"
  | "finance:edit"
  | "history:read"
  | "saas:finance";

const MATRIX: Record<Action, Role[]> = {
  // Navegação — super_admin só vê seus próprios módulos
  "nav.dashboard": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.orders": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.customers": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.vehicles": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.services": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.parts": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.staff": ["oficina_admin"],
  "nav.finance": ["oficina_admin", "financeiro"],
  "nav.settings": ["oficina_admin"],
  "nav.accounts": ["super_admin"],
  "nav.admin_oficinas": ["super_admin"],
  "nav.admin_financeiro": ["super_admin"],

  // Recepcionista e mecânico podem cadastrar clientes/veículos/peças/serviços
  "customers:write": ["oficina_admin", "mecanico", "recepcionista"],
  "vehicles:write": ["oficina_admin", "mecanico", "recepcionista"],
  "services:write": ["oficina_admin", "mecanico", "recepcionista"],
  "parts:write": ["oficina_admin", "mecanico", "recepcionista"],

  "staff:write": ["oficina_admin"],
  "staff:invite": ["oficina_admin"],

  // OS: abrir/fechar/reabrir/imprimir
  "orders:write": ["oficina_admin", "mecanico", "recepcionista"],
  "orders:reopen": ["oficina_admin", "mecanico", "recepcionista"],
  "orders:delete": ["oficina_admin"],
  "orders:print": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],

  "payments:write": ["oficina_admin", "financeiro", "recepcionista"],
  "settings:write": ["oficina_admin"],
  "fipe:sync": ["oficina_admin"],
  "finance:edit": ["oficina_admin", "financeiro"],
  "history:read": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "saas:finance": ["super_admin"],
};

export function can(role: Role | null | undefined, action: Action, isSuperAdmin = false): boolean {
  if (isSuperAdmin && MATRIX[action].includes("super_admin")) return true;
  if (!role) return false;
  return MATRIX[action].includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Administrador Geral do Sistema",
  oficina_admin: "Administrador da Oficina",
  mecanico: "Mecânico",
  recepcionista: "Recepcionista",
  financeiro: "Financeiro",
};
