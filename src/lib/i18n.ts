import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

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
      },
      customer: { title: "Clientes", cpfCnpj: "CPF/CNPJ", notes: "Observações" },
      vehicle: { title: "Veículos", plate: "Placa", brand: "Marca", model: "Modelo", year: "Ano", color: "Cor", km: "KM", chassis: "Chassi" },
      service: { title: "Catálogo de Serviços", defaultPrice: "Preço padrão", estimatedTime: "Tempo estimado (min)", active: "Ativo" },
      part: { title: "Peças", sku: "SKU", defaultPrice: "Preço venda", batches: "Lotes", batch: "Lote", cost: "Custo", validity: "Validade", supplier: "Fornecedor" },
      os: {
        title: "Ordens de Serviço", number: "OS #", customer: "Cliente", vehicle: "Veículo",
        mechanic: "Mecânico", diagnosis: "Diagnóstico", internalNotes: "Observações internas",
        customerNotes: "Observações ao cliente", items: "Itens", payments: "Pagamentos",
        addItem: "Adicionar item", addPayment: "Registrar pagamento",
        status: { aberta: "Aberta", em_andamento: "Em andamento", aguardando_peca: "Aguardando peça", aguardando_aprovacao: "Aguardando aprovação", concluida: "Concluída", cancelada: "Cancelada" },
        method: { dinheiro: "Dinheiro", pix: "Pix", credito: "Crédito", debito: "Débito", boleto: "Boleto", transferencia: "Transferência", outro: "Outro" },
        itemType: { servico: "Serviço", peca: "Peça", descricao_livre: "Descrição livre" },
      },
      staff: { title: "Colaboradores", invite: "Convidar", role: "Função", roles: { oficina_admin: "Admin da Oficina", mecanico: "Mecânico", recepcionista: "Recepcionista", financeiro: "Financeiro" }, pendingInvites: "Convites pendentes", copyLink: "Copiar link" },
      finance: { title: "Financeiro", receipts: "Recebimentos", period: "Período", method: "Método", noPayments: "Nenhum pagamento no período." },
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
  en: {
    translation: {
      app: { name: "OficinaPro", tagline: "Complete management for auto shops" },
      nav: {
        dashboard: "Dashboard", customers: "Customers", vehicles: "Vehicles",
        services: "Services", parts: "Parts", orders: "Service Orders",
        staff: "Team", finance: "Finance", settings: "Settings",
        superAdmin: "System Admin", accounts: "Accounts", companies: "Companies", audit: "Audit",
      },
      auth: {
        signIn: "Sign in", signUp: "Create account", signOut: "Sign out",
        email: "Email", password: "Password", fullName: "Full name",
        continueWithGoogle: "Continue with Google",
        haveAccount: "Have an account?", noAccount: "No account?",
        signupSuccess: "Account created! Wait for admin approval.",
        signupHint: "After signup, your account is pending approval by the system administrator.",
      },
      common: {
        save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit",
        new: "New", create: "Create", search: "Search", loading: "Loading...",
        empty: "No records found.", back: "Back", confirm: "Confirm",
        actions: "Actions", name: "Name", email: "Email", phone: "Phone",
        address: "Address", createdAt: "Created", status: "Status", price: "Price",
        quantity: "Qty", total: "Total", description: "Description", type: "Type",
        yes: "Yes", no: "No", none: "None",
      },
      customer: { title: "Customers", cpfCnpj: "Tax ID", notes: "Notes" },
      vehicle: { title: "Vehicles", plate: "Plate", brand: "Brand", model: "Model", year: "Year", color: "Color", km: "KM", chassis: "VIN" },
      service: { title: "Service Catalog", defaultPrice: "Default price", estimatedTime: "Estimated time (min)", active: "Active" },
      part: { title: "Parts", sku: "SKU", defaultPrice: "Sale price", batches: "Batches", batch: "Batch", cost: "Cost", validity: "Expiry", supplier: "Supplier" },
      os: {
        title: "Service Orders", number: "SO #", customer: "Customer", vehicle: "Vehicle",
        mechanic: "Mechanic", diagnosis: "Diagnosis", internalNotes: "Internal notes",
        customerNotes: "Customer notes", items: "Items", payments: "Payments",
        addItem: "Add item", addPayment: "Add payment",
        status: { aberta: "Open", em_andamento: "In progress", aguardando_peca: "Waiting parts", aguardando_aprovacao: "Waiting approval", concluida: "Completed", cancelada: "Cancelled" },
        method: { dinheiro: "Cash", pix: "Pix", credito: "Credit", debito: "Debit", boleto: "Boleto", transferencia: "Transfer", outro: "Other" },
        itemType: { servico: "Service", peca: "Part", descricao_livre: "Free text" },
      },
      staff: { title: "Team", invite: "Invite", role: "Role", roles: { oficina_admin: "Shop Admin", mecanico: "Mechanic", recepcionista: "Receptionist", financeiro: "Finance" }, pendingInvites: "Pending invites", copyLink: "Copy link" },
      finance: { title: "Finance", receipts: "Receipts", period: "Period", method: "Method", noPayments: "No payments in period." },
      settings: { title: "Settings", company: "Company", units: "Units", newUnit: "New unit", cnpj: "Tax ID", razaoSocial: "Legal name", nomeFantasia: "Trade name" },
      super: {
        accounts: "User accounts",
        approve: "Approve", reject: "Reject", pause: "Pause", resume: "Resume",
        setValidity: "Set validity", validUntil: "Valid until",
        pending: "Pending", approved: "Approved", paused: "Paused", expired: "Expired", rejected: "Rejected",
        remove: "Remove validity",
      },
      account: {
        pending: "Your account is pending approval",
        pendingDesc: "The system administrator needs to approve your registration. Please wait or reach out.",
        blocked: "Access blocked",
        blockedDesc: "Your access was paused or has expired. Contact the system administrator.",
      },
      landing: {
        heroTitle: "Your shop in control, all in one system",
        heroSub: "Service orders, parts with batches, customers, vehicles and finance — integrated, for one or many shops.",
        cta: "Get started",
        features: {
          multi: { title: "Multi-shop", desc: "One account manages many units under the same tax ID, with data fully isolated." },
          os: { title: "Complete service orders", desc: "Services, parts, free lines, multiple payments and vehicle history." },
          parts: { title: "Parts & batches", desc: "Register parts; batch, cost and price are optional so you're never blocked." },
          team: { title: "Organized team", desc: "Invite mechanics, receptionists and finance with dedicated permissions." },
        },
      },
    },
  },
};

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: "pt-BR",
      supportedLngs: ["pt-BR", "en"],
      interpolation: { escapeValue: false },
      detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
    });
}

export default i18n;
