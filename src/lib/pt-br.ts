export const COMMON = {
  save: "Salvar",
  saved: "Salvo com sucesso",
  deleted: "Excluído com sucesso",
  updated: "Atualizado com sucesso",
  cancel: "Cancelar",
  delete: "Excluir",
  edit: "Editar",
  new: "Novo",
  create: "Criar",
  add: "Adicionar",
  search: "Buscar",
  loading: "Carregando...",
  empty: "Nenhum registro encontrado.",
  back: "Voltar",
  actions: "Ações",
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  address: "Endereço",
  createdAt: "Criado em",
  status: "Status",
  price: "Preço",
  quantity: "Qtd",
  total: "Total",
  description: "Descrição",
  type: "Tipo",
  selectUnit: "Selecione uma unidade",
  selectCustomer: "Selecionar cliente",
  all: "Todos",
  confirmDelete: "Tem certeza que deseja excluir este registro?",
};

export const OS_STATUS: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  aguardando_peca: "Aguardando peça",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const PAYMENT_METHOD: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
  outro: "Outro",
};

export const OS_ITEM_TYPE: Record<string, string> = {
  servico: "Serviço",
  peca: "Peça",
  descricao_livre: "Descrição livre",
};

export const STAFF_ROLE: Record<string, string> = {
  oficina_admin: "Administrador da Oficina",
  mecanico: "Mecânico",
  recepcionista: "Recepcionista",
  financeiro: "Financeiro",
  super_admin: "Administrador Geral do Sistema",
};

export const VEHICLE_TYPE: Record<string, string> = {
  cars: "Carros",
  motorcycles: "Motos",
  trucks: "Caminhões",
};

export function safeLabel(map: Record<string, string>, value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  return map[value] ?? value.replaceAll("_", " ");
}