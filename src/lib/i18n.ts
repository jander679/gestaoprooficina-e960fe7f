import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  "pt-BR": {
    translation: {
      app: { name: "OficinaPro", tagline: "Gestão completa para oficinas mecânicas" },
      nav: {
        dashboard: "Painel",
        customers: "Clientes",
        vehicles: "Veículos",
        services: "Serviços",
        parts: "Peças",
        orders: "Ordens de Serviço",
        staff: "Colaboradores",
        finance: "Financeiro",
        settings: "Configurações",
        superAdmin: "Admin Geral",
        accounts: "Contas",
        companies: "Empresas",
        audit: "Auditoria",
      },
      auth: {
        signIn: "Entrar",
        signUp: "Criar conta",
        signOut: "Sair",
        email: "E-mail",
        password: "Senha",
        fullName: "Nome completo",
        continueWithGoogle: "Continuar com Google",
        haveAccount: "Já tem conta?",
        noAccount: "Não tem conta?",
        signupSuccess: "Conta criada! Aguarde aprovação do administrador.",
        signupHint: "Ao se cadastrar, sua conta ficará pendente de aprovação pelo administrador geral.",
      },
      common: {
        save: "Salvar", cancel: "Cancelar", delete: "Excluir", edit: "Editar",
        new: "Novo", create: "Criar", search: "Buscar", loading: "Carregando...",
        empty: "Nenhum registro encontrado.", back: "Voltar", confirm: "Confirmar",
        actions: "Ações", name: "Nome", email: "E-mail", phone: "Telefone",
        address: "Endereço", createdAt: "Criado em", status: "Status", price: "Preço",
        quantity: "Qtd", total: "Total", description: "Descrição", type: "Tipo",
        yes: "Sim", no: "Não", none: "Nenhum",
        saved: "Salvo com sucesso", deleted: "Excluído com sucesso",
        confirmDelete: "Tem certeza que deseja excluir este registro?",
        selectUnit: "Selecione uma unidade", selectCustomer: "Selecionar cliente",
        all: "Todos", updated: "Atualizado com sucesso", close: "Fechar",
        add: "Adicionar", remove: "Remover", details: "Detalhes", print: "Imprimir",
        from: "De", to: "Até", export: "Exportar",
      },
      errors: {
        generic: "Ocorreu um erro inesperado. Tente novamente.",
        permission: "Você não tem permissão para realizar esta ação.",
        session: "Sessão expirada. Faça login novamente.",
      },
      customer: { title: "Clientes", cpfCnpj: "CPF/CNPJ", notes: "Observações" },
      vehicle: {
        title: "Veículos", plate: "Placa", brand: "Marca", model: "Modelo",
        year: "Ano", color: "Cor", km: "KM", chassis: "Chassi",
        useCatalog: "Usar catálogo FIPE (Brasil)", manualEntry: "Digitar manualmente",
        vehicleType: "Tipo", cars: "Carros", motorcycles: "Motos", trucks: "Caminhões",
      },
      service: { title: "Catálogo de Serviços", defaultPrice: "Preço padrão", estimatedTime: "Tempo estimado (min)", active: "Ativo" },
      part: {
        title: "Peças", sku: "SKU", defaultPrice: "Preço venda",
        batches: "Lotes", batch: "Lote", cost: "Custo", validity: "Validade",
        supplier: "Fornecedor", noBatches: "Sem lotes cadastrados.",
        batchesFor: "Lotes de", stock: "Estoque",
      },
      os: {
        title: "Ordens de Serviço", number: "OS #", customer: "Cliente", vehicle: "Veículo",
        mechanic: "Mecânico", diagnosis: "Diagnóstico", internalNotes: "Observações internas",
        customerNotes: "Observações ao cliente", items: "Itens", payments: "Pagamentos",
        addItem: "Adicionar item", addPayment: "Registrar pagamento",
        new: "Nova OS", openedAt: "Aberta em", kmIn: "KM na entrada",
        selectVehicle: "Selecione o veículo", selectMechanic: "Selecionar mecânico",
        paid: "Pago", balance: "Saldo", subtotal: "Subtotal", discount: "Desconto",
        catalogRef: "Referência do catálogo", freeDescription: "Descrição",
        confirmCancel: "Cancelar esta OS?",
        status: { aberta: "Aberta", em_andamento: "Em andamento", aguardando_peca: "Aguardando peça", aguardando_aprovacao: "Aguardando aprovação", concluida: "Concluída", cancelada: "Cancelada" },
        method: { dinheiro: "Dinheiro", pix: "Pix", credito: "Crédito", debito: "Débito", boleto: "Boleto", transferencia: "Transferência", outro: "Outro" },
        itemType: { servico: "Serviço", peca: "Peça", descricao_livre: "Descrição livre" },
      },
      staff: {
        title: "Colaboradores", invite: "Convidar colaborador", role: "Função",
        active: "Ativos", pendingInvites: "Convites pendentes", copyLink: "Copiar link",
        deactivate: "Desativar", activate: "Ativar", inviteEmail: "E-mail do convidado",
        inviteSent: "Convite gerado. Copie e envie o link.",
        inviteLinkCopied: "Link copiado.", resend: "Reenviar", cancel: "Cancelar convite",
        empty: "Nenhum colaborador cadastrado.",
        roles: { oficina_admin: "Admin da Oficina", mecanico: "Mecânico", recepcionista: "Recepcionista", financeiro: "Financeiro" },
      },
      finance: {
        title: "Financeiro", receipts: "Recebimentos", period: "Período",
        method: "Método", noPayments: "Nenhum pagamento no período.",
        received: "Recebido no período", receivable: "A receber (aberto)",
        ticket: "Ticket médio", byDay: "Recebimentos por dia",
        byMethod: "Por forma de pagamento", os: "OS",
      },
      settings: { title: "Configurações", company: "Empresa", units: "Unidades", newUnit: "Nova unidade", cnpj: "CNPJ", razaoSocial: "Razão social", nomeFantasia: "Nome fantasia" },
      super: {
        accounts: "Contas de usuários",
        approve: "Aprovar", reject: "Rejeitar", pause: "Pausar", resume: "Retomar",
        setValidity: "Definir validade", validUntil: "Válido até",
        pending: "Pendente", approved: "Aprovado", paused: "Pausado", expired: "Expirado", rejected: "Rejeitado",
        remove: "Remover validade",
      },
      account: {
        pending: "Sua conta está pendente de aprovação",
        pendingDesc: "O administrador geral do sistema precisa aprovar seu cadastro. Aguarde ou entre em contato.",
        blocked: "Acesso bloqueado",
        blockedDesc: "Seu acesso ao sistema foi pausado ou expirou. Fale com o administrador geral.",
      },
      landing: {
        heroTitle: "Sua oficina no controle, em um só sistema",
        heroSub: "Ordens de serviço, cadastro de peças com lotes, clientes, veículos e financeiro — tudo integrado, para uma ou várias oficinas.",
        cta: "Começar agora",
        features: {
          multi: { title: "Multi-oficina", desc: "Uma conta gerencia várias unidades sob o mesmo CNPJ, com dados totalmente separados." },
          os: { title: "Ordem de Serviço completa", desc: "Serviços, peças, descrições livres, múltiplos pagamentos e histórico do veículo." },
          parts: { title: "Peças e lotes", desc: "Cadastre peças; lote, custo e preço são opcionais para não travar sua rotina." },
          team: { title: "Equipe organizada", desc: "Convide mecânicos, recepcionistas e financeiro com permissões próprias." },
        },
      },
    },
  },
};

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: "pt-BR",
      fallbackLng: "pt-BR",
      supportedLngs: ["pt-BR"],
      interpolation: { escapeValue: false },
    });
}

export default i18n;
