/**
 * Traduções das telas de comércio (Planos e Loja) nos sete idiomas da interface.
 * Mantido separado de i18n.tsx para facilitar a manutenção do catálogo.
 */
type Lang = "pt" | "pt-PT" | "es" | "en" | "fr" | "it" | "de";

export type CommerceDict = {
  authExtra: { readAccept: string; and: string; mustAccept: string };
  checkout: { pendingApproval: string; genericFail: string; noticeTitle: string; noticeBody: string; confirming: string; confirmed: string; confirmSlow: string };
  account: {
    title: string;
    subtitle: string;
    loading: string;
    error: string;
    subscription: string;
    ownerBadge: string;
    ownerDesc: string;
    active: string;
    plan: string;
    accessUntil: string;
    renewsOn: string;
    freePlan: string;
    seePlans: string;
    coinsFree: string;
    coinsAvailable: string;
    buyCoins: string;
    usage30d: string;
    noUsage: string;
    usesCoins: (uses: string, coins: string) => string;
    cardsCoins: (cards: string, coins: string) => string;
    packs: string;
    noPacks: string;
    activeUntil: string;
    expiredOn: string;
    ledger: string;
    noLedger: string;
    accountLabel: string;
    since: string;
    actions: Record<string, string>;
  };
  pricing: {
    title: string;
    subtitle: string;
    proActive: string;
    switchBlocked: string;
    monthly: string;
    yearly: string;
    monthly2: string;
    yearly2: string;
    plan2: string;
    aiCycleCards: (n: string) => string;
    pro2Active: string;
    monthlyCards: (n: string) => string;
    batchCards: (n: string) => string;
    monthlyCoins: (n: string) => string;
    yearlyCoins: (n: string) => string;
    perMonth: string;
    perYear: string;
    save33: string;
    fUnlimited: string;
    fSpaced: string;
    fDictation: string;
    fSupport: string;
    fAllMonthly: string;
    fEquals: string;
    fOneCharge: string;
    current: string;
    switchMonthly: string;
    switchYearly: string;
    subMonthly: string;
    subYearly: string;
    singleTitle: string;
    singleDesc: string;
    seeStore: string;
    back: string;
    creditsTitle: string;
    creditsLoading: string;
    creditsError: string;
    remainingLabel: string;
    ofChars: (n: string) => string;
    cloudUse: string;
    chars: string;
    narrations: (n: number) => string;
    chatTitle: string;
    chatUsed: (used: string, limit: string, min: number) => string;
    resetsOn: (d: string) => string;
    catalogFree: string;
    deviceVoiceFree: string;
    proOnly: string;
  };
  store: {
    title: string;
    subtitle: string;
    balance: string;
    coinsWord: string;
    secure: string;
    securedBy: string;
    loading: string;
    error: string;
    coinsTitle: string;
    coinsDesc: string;
    coinCardDesc: string;
    coinsInfoTitle: string;
    coinsInfo: string;
    packsInfoTitle: string;
    packsInfo: (days: string) => string;
    coinsQty: (n: string) => string;
    buy: string;
    packsTitle: string;
    subjectPackDesc: string;
    noPacks: string;
    accessDays: (n: number) => string;
    contentUpdated: (d: string) => string;
    seeClients: string;
    releasedUntil: (d: string) => string;
    fetchUpdates: string;
    changesPreserved: string;
    receiveSubject: string;
    claimFree: string;
    renewYear: string;
    needUnlimited: string;
    plansLink: string;
    renewTitle: string;
    renewDesc: string;
    keepTitle: string;
    keepDesc: string;
    overwriteTitle: string;
    overwriteDesc: string;
    cancel: string;
    continuePayment: string;
    clientsTitle: string;
    clientsDesc: string;
    clientsLoading: string;
    noClients: string;
    thClient: string;
    thPurchase: string;
    thExpire: string;
    thStatus: string;
    active: string;
    expired: string;
    close: string;
    updatedAuthor: string;
    updatedAdded: (n: number) => string;
    upToDate: string;
    updateFail: string;
    claimed: string;
    claimFail: string;
  };
};

const pt: CommerceDict = {
  authExtra: { readAccept: "Li e aceito os", and: "e a", mustAccept: "É preciso aceitar os Termos de Uso e a Política de Privacidade." },
  checkout: { pendingApproval: "Os pagamentos estão em aprovação. Tente novamente em breve.", genericFail: "Não foi possível abrir o pagamento agora. Tente novamente.", noticeTitle: "Pagamentos em aprovação", noticeBody: "A cobrança real ainda está sendo liberada pelo provedor de pagamentos. Enquanto isso, as compras podem falhar — tente novamente mais tarde.", confirming: "Confirmando o pagamento…", confirmed: "Pagamento confirmado! Já liberamos o que você comprou.", confirmSlow: "O pagamento pode levar alguns instantes para ser confirmado. Você receberá o acesso automaticamente." },
  account: {
    title: "Minha conta",
    subtitle: "Sua assinatura, seu saldo de FlashCoins e tudo o que você já liberou.",
    loading: "Carregando sua conta…",
    error: "Não foi possível carregar sua conta agora.",
    subscription: "Assinatura",
    ownerBadge: "Acesso total (AppManager)",
    ownerDesc: "Todos os recursos e pacotes liberados sem cobrança.",
    active: "Ativa",
    plan: "Plano:",
    accessUntil: "Acesso até ",
    renewsOn: "Renova em ",
    freePlan: "Você está no plano gratuito, com até 100 flashcards.",
    seePlans: "Ver planos",
    coinsFree: "FlashCoins grátis",
    coinsAvailable: "As FlashCoins têm validade de 12 meses",
    buyCoins: "Comprar mais FlashCoins",
    usage30d: "Consumo dos últimos 30 dias",
    noUsage: "Nenhuma ação do PilotAI no período.",
    usesCoins: (uses, coins) => `${uses} usos · ${coins} moedas`,
    cardsCoins: (cards, coins) => `${cards} flashcards · ${coins} moedas`,
    packs: "Pacotes liberados",
    noPacks: "Você ainda não liberou nenhum pacote da Loja.",
    activeUntil: "Ativo até ",
    expiredOn: "Expirou em ",
    ledger: "Histórico de FlashCoins",
    noLedger: "Nenhuma movimentação registrada.",
    accountLabel: "Conta:",
    since: "desde",
    actions: {
      chat: "Conversação",
      tts_cloud: "Voz em nuvem",
      translate: "Tradução",
      note_format: "Formatar anotação",
      mindmap: "Mapa mental",
      bulk: "Criação de flashcards",
      stt: "Ditado",
    },
  },
  pricing: {
    title: "Planos e módulos",
    subtitle: "Assine o Pro ou Pro 2 para flashcards ilimitados ou compre módulos avulsos.",
    proActive: "Assinatura Pro ativa",
    switchBlocked: "Sua assinatura está ativa. As opções abaixo mostram os benefícios de cada plano.",
    monthly: "Pro Mensal",
    yearly: "Pro Anual",
    monthly2: "Pro 2 Mensal",
    yearly2: "Pro 2 Anual",
    plan2: "Pro 2",
    pro2Active: "Assinatura Pro 2 ativa",
    monthlyCards: (n) => `${n} flashcards com o PilotAI por mês`,
    batchCards: (n) => `Até ${n} cards por lote`,
    monthlyCoins: (n) => `${n} FlashCoins incluídas por cobrança mensal`,
    yearlyCoins: (n) => `${n} FlashCoins incluídas por cobrança anual`,
    aiCycleCards: (n) => `Cota PilotAI: ${n} cards por ciclo`,
    perMonth: "/mês",
    perYear: "/ano",
    save33: "Economize 33%",
    fUnlimited: "Flashcards ilimitados",
    fSpaced: "Revisão espaçada",
    fDictation: "Ditado por voz",
    fSupport: "Suporte prioritário",
    fAllMonthly: "Tudo do Pro Mensal",
    fEquals: "Equivale a 8 meses pagos",
    fOneCharge: "Cobrança única no ano",
    current: "Plano atual",
    switchMonthly: "Trocar para mensal",
    switchYearly: "Trocar para anual",
    subMonthly: "Assinar mensal",
    subYearly: "Assinar anual",
    singleTitle: "Matérias avulsas",
    singleDesc: "Compre apenas a matéria que você quer estudar, com acesso de 1 ano ao conteúdo oficial.",
    seeStore: "Ver matérias na Loja",
    back: "Voltar",
    creditsTitle: "Créditos do PilotAI",
    creditsLoading: "Carregando saldo…",
    creditsError: "Não foi possível carregar o saldo agora.",
    remainingLabel: "Saldo restante do mês",
    ofChars: (n) => `de ${n} caracteres`,
    cloudUse: "Consumo por voz em nuvem:",
    chars: "caracteres",
    narrations: (n) => (n === 1 ? "narração gerada" : "narrações geradas"),
    chatTitle: "Conversação com o PilotAI",
    chatUsed: (used, limit, min) =>
      `Você usou ${used} de ${limit} — restam cerca de ${min} ${min === 1 ? "minuto" : "minutos"} de conversa neste mês.`,
    resetsOn: (d) => `A contagem zera em ${d}.`,
    catalogFree: "Áudio já existente no catálogo toca de novo sem consumir saldo.",
    deviceVoiceFree: "Quando o aparelho tem a voz do idioma instalada, a narração é gratuita e não usa saldo.",
    proOnly: "A narração em nuvem é um recurso do Pro — assine acima para ativá-la.",
  },
  store: {
    title: "Loja",
    subtitle: "FlashCoins para as ações do PilotAI e pacotes de matérias prontas.",
    balance: "Seu saldo",
    coinsWord: "FlashCoins",
    secure: "Compra Segura",
    securedBy: "· pagamento processado pelo Paddle",
    loading: "Carregando a Loja…",
    error: "Não foi possível abrir a Loja agora.",
    coinsTitle: "FlashCoins",
    coinsInfoTitle: "O que as FlashCoins incluem",
    coinsInfo: "FlashCoins geram e salvam flashcards com o PilotAI: 1 moeda por card. Valem 12 meses a partir da compra. Não compram matérias nem são usadas em mapas mentais, conversação ou formatação de notas.",
    packsInfoTitle: "O que a matéria inclui",
    packsInfo: (days) => `Acesso por ${days} dias ao conteúdo oficial, somente para leitura, com todas as atualizações do autor durante esse período. Não precisa de assinatura; matérias são compradas separadamente dos planos.`,
    coinsDesc:
      "As moedas compradas valem por 12 meses a partir da data da compra e são usadas para gerar e salvar flashcards com o PilotAI (1 moeda por card). Estudar, revisar, criar à mão e importar CSV não consomem moedas.",
    coinCardDesc: "Moedas para usar os recursos do PilotAI",
    coinsQty: (n) => `${n} moedas, válidas por 12 meses`,
    buy: "Comprar",
    packsTitle: "Pacotes de matérias",
    subjectPackDesc: "Acesso completo ao conteúdo oficial desta matéria.",
    noPacks:
      "Nenhum pacote publicado ainda. Os pacotes de matérias aparecem aqui assim que você definir o preço de cada um.",
    accessDays: (n) => `Acesso por ${n} dias`,
    contentUpdated: (d) => `Conteúdo atualizado em ${d}`,
    seeClients: "Ver clientes desta matéria",
    releasedUntil: (d) => `Liberado até ${d}`,
    fetchUpdates: "Buscar atualizações",
    changesPreserved: "Suas alterações em cards, anotações e mapas mentais são sempre preservadas.",
    receiveSubject: "Receber a matéria",
    claimFree: "Liberar grátis (AppManager)",
    renewYear: "Renovar por 1 ano",
    needUnlimited: "Precisa de flashcards ilimitados? Veja os",
    plansLink: "planos de assinatura",
    renewTitle: "Renovar por mais 1 ano",
    renewDesc:
      "Você já estudou nesta matéria. Escolha o que acontece com as suas alterações em flashcards, anotações e mapas mentais.",
    keepTitle: "Manter minhas alterações (recomendado)",
    keepDesc:
      "Tudo que você mudou continua do seu jeito. Você recebe apenas o conteúdo novo do autor, que não conflita com o seu.",
    overwriteTitle: "Receber a matéria atualizada do autor",
    overwriteDesc:
      "A versão do autor substitui as suas alterações nesta matéria. As suas edições serão perdidas e não há como voltar atrás.",
    cancel: "Cancelar",
    continuePayment: "Continuar para o pagamento",
    clientsTitle: "Clientes desta matéria",
    clientsDesc: "data de aquisição e de vencimento de cada acesso.",
    clientsLoading: "Carregando clientes…",
    noClients: "Nenhum cliente adquiriu esta matéria ainda.",
    thClient: "Cliente",
    thPurchase: "Aquisição",
    thExpire: "Vencimento",
    thStatus: "Situação",
    active: "ativo",
    expired: "vencido",
    close: "Fechar",
    updatedAuthor: "Matéria atualizada com a versão do autor.",
    updatedAdded: (n) => `Matéria atualizada: ${n} item(ns) novo(s). Suas alterações foram mantidas.`,
    upToDate: "Matéria em dia. Suas alterações foram mantidas.",
    updateFail: "Não foi possível atualizar a matéria.",
    claimed: "Pacote liberado na sua conta.",
    claimFail: "Não foi possível liberar o pacote.",
  },
};

const ptPT: CommerceDict = {
  authExtra: { ...pt.authExtra },
  checkout: { ...pt.checkout },
  account: { ...pt.account, freePlan: "Está no plano gratuito, com até 100 flashcards." },
  pricing: {
    ...pt.pricing,
    subtitle: "Subscreva o Pro ou Pro 2 para flashcards ilimitados ou compre módulos avulsos.",
    proActive: "Subscrição Pro ativa",
    switchBlocked: "A sua subscrição está ativa. Compare abaixo os benefícios de cada plano.",
    perMonth: "/mês",
    switchMonthly: "Mudar para mensal",
    switchYearly: "Mudar para anual",
    subMonthly: "Subscrever mensal",
    subYearly: "Subscrever anual",
    singleDesc: "Compre apenas a disciplina que quer estudar, com acesso de 1 ano ao conteúdo oficial.",
    seeStore: "Ver disciplinas na Loja",
    remainingLabel: "Saldo restante do mês",
    proOnly: "A narração na nuvem é um recurso do Pro — subscreva acima para a ativar.",
    creditsError: "Não foi possível carregar o saldo agora.",
  },
  store: {
    ...pt.store,
    subtitle: "FlashCoins para as ações do PilotAI e pacotes de disciplinas prontas.",
    coinCardDesc: "Moedas para gerar e guardar flashcards com o PilotAI",
    packsInfo: (days) => `Acesso apenas de leitura ao conteúdo oficial por ${days} dias, com todas as atualizações do autor nesse período. Não precisa de subscrição; as disciplinas são compradas separadamente dos planos.`,
    packsTitle: "Pacotes de disciplinas",
    subjectPackDesc: "Acesso completo ao conteúdo oficial desta disciplina.",
    seeClients: "Ver clientes desta disciplina",
    receiveSubject: "Receber a disciplina",
    clientsTitle: "Clientes desta disciplina",
    noClients: "Nenhum cliente adquiriu esta disciplina ainda.",
    updatedAuthor: "Disciplina atualizada com a versão do autor.",
    upToDate: "Disciplina em dia. As suas alterações foram mantidas.",
    updateFail: "Não foi possível atualizar a disciplina.",
    needUnlimited: "Precisa de flashcards ilimitados? Veja os",
    plansLink: "planos de subscrição",
  },
};

const en: CommerceDict = {
  authExtra: { readAccept: "I have read and accept the", and: "and the", mustAccept: "You must accept the Terms of Use and the Privacy Policy." },
  checkout: { pendingApproval: "Payments are still being approved. Please try again soon.", genericFail: "We couldn't open the payment window. Please try again.", noticeTitle: "Payments pending approval", noticeBody: "Real charges are still being enabled by our payment provider. Purchases may fail until then — please try again later.", confirming: "Confirming your payment…", confirmed: "Payment confirmed! Your purchase has been unlocked.", confirmSlow: "Payment confirmation can take a moment. Your access is released automatically." },
  account: {
    title: "My account",
    subtitle: "Your subscription, your FlashCoins balance and everything you have unlocked.",
    loading: "Loading your account…",
    error: "Could not load your account right now.",
    subscription: "Subscription",
    ownerBadge: "Full access (AppManager)",
    ownerDesc: "All features and packs unlocked at no charge.",
    active: "Active",
    plan: "Plan:",
    accessUntil: "Access until ",
    renewsOn: "Renews on ",
    freePlan: "You are on the free plan, with up to 100 flashcards.",
    seePlans: "See plans",
    coinsFree: "free FlashCoins",
    coinsAvailable: "FlashCoins are valid for 12 months",
    buyCoins: "Buy more FlashCoins",
    usage30d: "Usage in the last 30 days",
    noUsage: "No PilotAI action in this period.",
    usesCoins: (uses, coins) => `${uses} uses · ${coins} coins`,
    cardsCoins: (cards, coins) => `${cards} flashcards · ${coins} coins`,
    packs: "Unlocked packs",
    noPacks: "You have not unlocked any Store pack yet.",
    activeUntil: "Active until ",
    expiredOn: "Expired on ",
    ledger: "FlashCoins history",
    noLedger: "No entry recorded.",
    accountLabel: "Account:",
    since: "since",
    actions: {
      chat: "Conversation",
      tts_cloud: "Cloud voice",
      translate: "Translation",
      note_format: "Format note",
      mindmap: "Mind map",
      bulk: "Create flashcards",
      stt: "Dictation",
    },
  },
  pricing: {
    title: "Plans and modules",
    subtitle: "Subscribe to Pro or Pro 2 for unlimited flashcards or buy single modules.",
    proActive: "Pro subscription active",
    switchBlocked: "Your subscription is active. Compare each plan’s benefits below.",
    monthly: "Pro Monthly",
    yearly: "Pro Yearly",
    monthly2: "Pro 2 Monthly",
    yearly2: "Pro 2 Yearly",
    plan2: "Pro 2",
    pro2Active: "Pro 2 subscription active",
    monthlyCards: (n) => `${n} PilotAI flashcards per month`,
    batchCards: (n) => `Up to ${n} cards per batch`,
    monthlyCoins: (n) => `${n} FlashCoins included per monthly payment`,
    yearlyCoins: (n) => `${n} FlashCoins included per yearly payment`,
    aiCycleCards: (n) => `PilotAI quota: ${n} cards per cycle`,
    perMonth: "/month",
    perYear: "/year",
    save33: "Save 33%",
    fUnlimited: "Unlimited flashcards",
    fSpaced: "Spaced repetition",
    fDictation: "Voice dictation",
    fSupport: "Priority support",
    fAllMonthly: "Everything in Pro Monthly",
    fEquals: "Same as 8 months paid",
    fOneCharge: "Single yearly charge",
    current: "Current plan",
    switchMonthly: "Switch to monthly",
    switchYearly: "Switch to yearly",
    subMonthly: "Subscribe monthly",
    subYearly: "Subscribe yearly",
    singleTitle: "Single subjects",
    singleDesc: "Buy only the subject you want to study, with 1-year access to the official content.",
    seeStore: "See subjects in the Store",
    back: "Back",
    creditsTitle: "PilotAI credits",
    creditsLoading: "Loading balance…",
    creditsError: "Could not load your balance right now.",
    remainingLabel: "Balance left this month",
    ofChars: (n) => `of ${n} characters`,
    cloudUse: "Cloud voice usage:",
    chars: "characters",
    narrations: (n) => (n === 1 ? "narration generated" : "narrations generated"),
    chatTitle: "PilotAI conversation",
    chatUsed: (used, limit, min) =>
      `You used ${used} of ${limit} — about ${min} ${min === 1 ? "minute" : "minutes"} of conversation left this month.`,
    resetsOn: (d) => `The count resets on ${d}.`,
    catalogFree: "Audio already in the catalogue plays again without using your balance.",
    deviceVoiceFree: "When your device has the language voice installed, narration is free and uses no balance.",
    proOnly: "Cloud narration is a Pro feature — subscribe above to enable it.",
  },
  store: {
    title: "Store",
    subtitle: "FlashCoins for PilotAI actions and ready-made subject packs.",
    balance: "Your balance",
    coinsWord: "FlashCoins",
    secure: "Secure purchase",
    securedBy: "· payment processed by Paddle",
    loading: "Loading the Store…",
    error: "Could not open the Store right now.",
    coinsTitle: "FlashCoins",
    coinsInfoTitle: "What FlashCoins include",
    coinsInfo: "FlashCoins generate and save flashcards with PilotAI: 1 coin per card. Valid for 12 months from purchase. They do not buy subjects or pay for mind maps, conversation or note formatting.",
    packsInfoTitle: "What the subject includes",
    packsInfo: (days) => `Read-only access to official content for ${days} days, including all author updates during that period. No subscription required; subjects are purchased separately from plans.`,
    coinsDesc:
      "Purchased coins are valid for 12 months from the purchase date and are used to generate and save flashcards with PilotAI (1 coin per card). Studying, reviewing, manual creation and CSV import use no coins.",
    coinCardDesc: "Coins for using PilotAI features",
    coinsQty: (n) => `${n} coins, valid for 12 months`,
    buy: "Buy",
    packsTitle: "Subject packs",
    subjectPackDesc: "Full access to this subject's official content.",
    noPacks: "No pack published yet. Subject packs appear here as soon as you set a price for each one.",
    accessDays: (n) => `Access for ${n} days`,
    contentUpdated: (d) => `Content updated on ${d}`,
    seeClients: "See customers of this subject",
    releasedUntil: (d) => `Available until ${d}`,
    fetchUpdates: "Check for updates",
    changesPreserved: "Your changes to cards, notes and mind maps are always preserved.",
    receiveSubject: "Get the subject",
    claimFree: "Release for free (AppManager)",
    renewYear: "Renew for 1 year",
    needUnlimited: "Need unlimited flashcards? See the",
    plansLink: "subscription plans",
    renewTitle: "Renew for another year",
    renewDesc:
      "You have already studied this subject. Choose what happens to your changes in flashcards, notes and mind maps.",
    keepTitle: "Keep my changes (recommended)",
    keepDesc:
      "Everything you changed stays your way. You only receive the author's new content that does not conflict with yours.",
    overwriteTitle: "Get the author's updated subject",
    overwriteDesc:
      "The author's version replaces your changes in this subject. Your edits will be lost and cannot be recovered.",
    cancel: "Cancel",
    continuePayment: "Continue to payment",
    clientsTitle: "Customers of this subject",
    clientsDesc: "purchase and expiry date of each access.",
    clientsLoading: "Loading customers…",
    noClients: "No customer has bought this subject yet.",
    thClient: "Customer",
    thPurchase: "Purchased",
    thExpire: "Expires",
    thStatus: "Status",
    active: "active",
    expired: "expired",
    close: "Close",
    updatedAuthor: "Subject updated with the author's version.",
    updatedAdded: (n) => `Subject updated: ${n} new item(s). Your changes were kept.`,
    upToDate: "Subject up to date. Your changes were kept.",
    updateFail: "Could not update the subject.",
    claimed: "Pack released in your account.",
    claimFail: "Could not release the pack.",
  },
};

const es: CommerceDict = {
  authExtra: { readAccept: "Leí y acepto los", and: "y la", mustAccept: "Debes aceptar los Términos de Uso y la Política de Privacidad." },
  checkout: { pendingApproval: "Los pagos están en aprobación. Inténtalo de nuevo pronto.", genericFail: "No se pudo abrir el pago ahora. Inténtalo de nuevo.", noticeTitle: "Pagos en aprobación", noticeBody: "El cobro real aún está siendo habilitado por el proveedor de pagos. Hasta entonces, las compras pueden fallar — inténtalo más tarde.", confirming: "Confirmando el pago…", confirmed: "¡Pago confirmado! Ya liberamos tu compra.", confirmSlow: "La confirmación del pago puede tardar un momento. El acceso se libera automáticamente." },
  account: {
    title: "Mi cuenta",
    subtitle: "Tu suscripción, tu saldo de FlashCoins y todo lo que ya desbloqueaste.",
    loading: "Cargando tu cuenta…",
    error: "No se pudo cargar tu cuenta ahora.",
    subscription: "Suscripción",
    ownerBadge: "Acceso total (AppManager)",
    ownerDesc: "Todas las funciones y paquetes liberados sin cargo.",
    active: "Activa",
    plan: "Plan:",
    accessUntil: "Acceso hasta ",
    renewsOn: "Se renueva el ",
    freePlan: "Estás en el plan gratuito, con hasta 100 flashcards.",
    seePlans: "Ver planes",
    coinsFree: "FlashCoins gratis",
    coinsAvailable: "Las FlashCoins tienen validez de 12 meses",
    buyCoins: "Comprar más FlashCoins",
    usage30d: "Consumo de los últimos 30 días",
    noUsage: "Ninguna acción de PilotAI en el período.",
    usesCoins: (uses, coins) => `${uses} usos · ${coins} monedas`,
    cardsCoins: (cards, coins) => `${cards} flashcards · ${coins} monedas`,
    packs: "Paquetes liberados",
    noPacks: "Todavía no liberaste ningún paquete de la Tienda.",
    activeUntil: "Activo hasta ",
    expiredOn: "Venció el ",
    ledger: "Historial de FlashCoins",
    noLedger: "Ningún movimiento registrado.",
    accountLabel: "Cuenta:",
    since: "desde",
    actions: {
      chat: "Conversación",
      tts_cloud: "Voz en la nube",
      translate: "Traducción",
      note_format: "Formatear nota",
      mindmap: "Mapa mental",
      bulk: "Creación de flashcards",
      stt: "Dictado",
    },
  },
  pricing: {
    title: "Planes y módulos",
    subtitle: "Suscríbete a Pro o Pro 2 para tener flashcards ilimitadas o compra módulos sueltos.",
    proActive: "Suscripción Pro activa",
    switchBlocked: "Tu suscripción está activa. Compara abajo las ventajas de cada plan.",
    monthly: "Pro Mensual",
    yearly: "Pro Anual",
    monthly2: "Pro 2 Mensual",
    yearly2: "Pro 2 Anual",
    plan2: "Pro 2",
    pro2Active: "Suscripción Pro 2 activa",
    monthlyCards: (n) => `${n} flashcards con PilotAI al mes`,
    batchCards: (n) => `Hasta ${n} tarjetas por lote`,
    monthlyCoins: (n) => `${n} FlashCoins incluidas por pago mensual`,
    yearlyCoins: (n) => `${n} FlashCoins incluidas por pago anual`,
    aiCycleCards: (n) => `Cuota PilotAI: ${n} tarjetas por ciclo`,
    perMonth: "/mes",
    perYear: "/año",
    save33: "Ahorra 33%",
    fUnlimited: "Flashcards ilimitadas",
    fSpaced: "Repetición espaciada",
    fDictation: "Dictado por voz",
    fSupport: "Soporte prioritario",
    fAllMonthly: "Todo lo del Pro Mensual",
    fEquals: "Equivale a 8 meses pagados",
    fOneCharge: "Un único cargo al año",
    current: "Plan actual",
    switchMonthly: "Cambiar a mensual",
    switchYearly: "Cambiar a anual",
    subMonthly: "Suscribirse mensual",
    subYearly: "Suscribirse anual",
    singleTitle: "Materias sueltas",
    singleDesc: "Compra solo la materia que quieres estudiar, con acceso de 1 año al contenido oficial.",
    seeStore: "Ver materias en la Tienda",
    back: "Volver",
    creditsTitle: "Créditos do PilotAI",
    creditsLoading: "Cargando saldo…",
    creditsError: "No se pudo cargar el saldo ahora.",
    remainingLabel: "Saldo restante del mes",
    ofChars: (n) => `de ${n} caracteres`,
    cloudUse: "Consumo de voz en la nube:",
    chars: "caracteres",
    narrations: (n) => (n === 1 ? "narración generada" : "narraciones generadas"),
    chatTitle: "Conversación con PilotAI",
    chatUsed: (used, limit, min) =>
      `Usaste ${used} de ${limit} — quedan unos ${min} ${min === 1 ? "minuto" : "minutos"} de conversación este mes.`,
    resetsOn: (d) => `El conteo se reinicia el ${d}.`,
    catalogFree: "El audio que ya está en el catálogo se reproduce de nuevo sin gastar saldo.",
    deviceVoiceFree: "Si el dispositivo tiene la voz del idioma instalada, la narración es gratis y no usa saldo.",
    proOnly: "La narración en la nube es una función Pro — suscríbete arriba para activarla.",
  },
  store: {
    title: "Tienda",
    subtitle: "FlashCoins para las acciones de PilotAI y paquetes de materias listas.",
    balance: "Tu saldo",
    coinsWord: "FlashCoins",
    secure: "Compra segura",
    securedBy: "· pago procesado por Paddle",
    loading: "Cargando la Tienda…",
    error: "No se pudo abrir la Tienda ahora.",
    coinsTitle: "FlashCoins",
    coinsInfoTitle: "Qué incluyen las FlashCoins",
    coinsInfo: "Las FlashCoins generan y guardan flashcards con PilotAI: 1 moneda por tarjeta. Válidas durante 12 meses desde la compra. No compran materias ni se usan para mapas mentales, conversación o formato de notas.",
    packsInfoTitle: "Qué incluye la materia",
    packsInfo: (days) => `Acceso de solo lectura al contenido oficial durante ${days} días, con todas las actualizaciones del autor en ese período. No requiere suscripción; las materias se compran aparte de los planes.`,
    coinsDesc:
      "Las monedas compradas valen 12 meses desde la fecha de compra y se usan para crear y guardar flashcards con PilotAI (1 moneda por card). Estudiar, repasar, crear a mano e importar CSV no gastan monedas.",
    coinCardDesc: "Monedas para usar las funciones de PilotAI",
    coinsQty: (n) => `${n} monedas, válidas por 12 meses`,
    buy: "Comprar",
    packsTitle: "Paquetes de materias",
    subjectPackDesc: "Acceso completo al contenido oficial de esta materia.",
    noPacks:
      "Todavía no hay paquetes publicados. Los paquetes de materias aparecen aquí en cuanto defines el precio de cada uno.",
    accessDays: (n) => `Acceso por ${n} días`,
    contentUpdated: (d) => `Contenido actualizado el ${d}`,
    seeClients: "Ver clientes de esta materia",
    releasedUntil: (d) => `Disponible hasta ${d}`,
    fetchUpdates: "Buscar actualizaciones",
    changesPreserved: "Tus cambios en cards, notas y mapas mentales siempre se conservan.",
    receiveSubject: "Recibir la materia",
    claimFree: "Liberar gratis (AppManager)",
    renewYear: "Renovar por 1 año",
    needUnlimited: "¿Necesitas flashcards ilimitadas? Mira los",
    plansLink: "planes de suscripción",
    renewTitle: "Renovar por otro año",
    renewDesc:
      "Ya estudiaste esta materia. Elige qué pasa con tus cambios en flashcards, notas y mapas mentales.",
    keepTitle: "Mantener mis cambios (recomendado)",
    keepDesc:
      "Todo lo que cambiaste sigue a tu manera. Solo recibes el contenido nuevo del autor que no entra en conflicto con el tuyo.",
    overwriteTitle: "Recibir la materia actualizada del autor",
    overwriteDesc:
      "La versión del autor sustituye tus cambios en esta materia. Tus ediciones se perderán y no se pueden recuperar.",
    cancel: "Cancelar",
    continuePayment: "Continuar al pago",
    clientsTitle: "Clientes de esta materia",
    clientsDesc: "fecha de compra y de vencimiento de cada acceso.",
    clientsLoading: "Cargando clientes…",
    noClients: "Ningún cliente compró esta materia todavía.",
    thClient: "Cliente",
    thPurchase: "Compra",
    thExpire: "Vencimiento",
    thStatus: "Estado",
    active: "activo",
    expired: "vencido",
    close: "Cerrar",
    updatedAuthor: "Materia actualizada con la versión del autor.",
    updatedAdded: (n) => `Materia actualizada: ${n} elemento(s) nuevo(s). Tus cambios se mantuvieron.`,
    upToDate: "Materia al día. Tus cambios se mantuvieron.",
    updateFail: "No se pudo actualizar la materia.",
    claimed: "Paquete liberado en tu cuenta.",
    claimFail: "No se pudo liberar el paquete.",
  },
};

const fr: CommerceDict = {
  authExtra: { readAccept: "J'ai lu et j'accepte les", and: "et la", mustAccept: "Vous devez accepter les Conditions d'utilisation et la Politique de confidentialité." },
  checkout: { pendingApproval: "Les paiements sont en cours d'approbation. Réessayez bientôt.", genericFail: "Impossible d'ouvrir le paiement pour le moment. Réessayez.", noticeTitle: "Paiements en cours d'approbation", noticeBody: "Le paiement réel est encore en cours d'activation par notre prestataire. D'ici là, les achats peuvent échouer — réessayez plus tard.", confirming: "Confirmation du paiement…", confirmed: "Paiement confirmé ! Votre achat est débloqué.", confirmSlow: "La confirmation du paiement peut prendre un instant. L'accès est débloqué automatiquement." },
  account: {
    title: "Mon compte",
    subtitle: "Votre abonnement, votre solde de FlashCoins et tout ce que vous avez débloqué.",
    loading: "Chargement de votre compte…",
    error: "Impossible de charger votre compte pour le moment.",
    subscription: "Abonnement",
    ownerBadge: "Accès total (AppManager)",
    ownerDesc: "Toutes les fonctions et tous les packs débloqués sans frais.",
    active: "Actif",
    plan: "Formule :",
    accessUntil: "Accès jusqu'au ",
    renewsOn: "Renouvellement le ",
    freePlan: "Vous êtes sur la formule gratuite, jusqu'à 100 cartes.",
    seePlans: "Voir les formules",
    coinsFree: "FlashCoins offerts",
    coinsAvailable: "Les FlashCoins sont valables 12 mois",
    buyCoins: "Acheter plus de FlashCoins",
    usage30d: "Consommation des 30 derniers jours",
    noUsage: "Aucune action de PilotAI sur la période.",
    usesCoins: (uses, coins) => `${uses} utilisations · ${coins} pièces`,
    cardsCoins: (cards, coins) => `${cards} flashcards · ${coins} pièces`,
    packs: "Packs débloqués",
    noPacks: "Vous n'avez encore débloqué aucun pack de la Boutique.",
    activeUntil: "Actif jusqu'au ",
    expiredOn: "Expiré le ",
    ledger: "Historique des FlashCoins",
    noLedger: "Aucun mouvement enregistré.",
    accountLabel: "Compte :",
    since: "depuis le",
    actions: {
      chat: "Conversation",
      tts_cloud: "Voix cloud",
      translate: "Traduction",
      note_format: "Mettre en forme la note",
      mindmap: "Carte mentale",
      bulk: "Création de flashcards",
      stt: "Dictée",
    },
  },
  pricing: {
    title: "Formules et modules",
    subtitle: "Abonnez-vous à Pro ou Pro 2 pour des cartes illimitées ou achetez des modules à l'unité.",
    proActive: "Abonnement Pro actif",
    switchBlocked: "Votre abonnement est actif. Comparez les avantages de chaque formule ci-dessous.",
    monthly: "Pro Mensuel",
    yearly: "Pro Annuel",
    monthly2: "Pro 2 Mensuel",
    yearly2: "Pro 2 Annuel",
    plan2: "Pro 2",
    pro2Active: "Abonnement Pro 2 actif",
    monthlyCards: (n) => `${n} flashcards avec PilotAI par mois`,
    batchCards: (n) => `Jusqu’à ${n} cartes par lot`,
    monthlyCoins: (n) => `${n} FlashCoins incluses par paiement mensuel`,
    yearlyCoins: (n) => `${n} FlashCoins incluses par paiement annuel`,
    aiCycleCards: (n) => `Quota PilotAI : ${n} cartes par cycle`,
    perMonth: "/mois",
    perYear: "/an",
    save33: "Économisez 33 %",
    fUnlimited: "Cartes illimitées",
    fSpaced: "Répétition espacée",
    fDictation: "Dictée vocale",
    fSupport: "Assistance prioritaire",
    fAllMonthly: "Tout le Pro Mensuel",
    fEquals: "Équivaut à 8 mois payés",
    fOneCharge: "Un seul paiement par an",
    current: "Formule actuelle",
    switchMonthly: "Passer au mensuel",
    switchYearly: "Passer à l'annuel",
    subMonthly: "S'abonner au mensuel",
    subYearly: "S'abonner à l'annuel",
    singleTitle: "Matières à l'unité",
    singleDesc: "Achetez seulement la matière que vous voulez étudier, avec 1 an d'accès au contenu officiel.",
    seeStore: "Voir les matières dans la Boutique",
    back: "Retour",
    creditsTitle: "Crédits PilotAI",
    creditsLoading: "Chargement du solde…",
    creditsError: "Impossible de charger le solde pour le moment.",
    remainingLabel: "Solde restant du mois",
    ofChars: (n) => `sur ${n} caractères`,
    cloudUse: "Consommation de la voix cloud :",
    chars: "caractères",
    narrations: (n) => (n === 1 ? "narration générée" : "narrations générées"),
    chatTitle: "Conversation avec PilotAI",
    chatUsed: (used, limit, min) =>
      `Vous avez utilisé ${used} sur ${limit} — il reste environ ${min} ${min === 1 ? "minute" : "minutes"} de conversation ce mois-ci.`,
    resetsOn: (d) => `Le compteur est remis à zéro le ${d}.`,
    catalogFree: "Un audio déjà présent dans le catalogue se rejoue sans consommer de solde.",
    deviceVoiceFree: "Si l'appareil a la voix de la langue installée, la narration est gratuite et ne consomme rien.",
    proOnly: "La narration cloud est une fonction Pro — abonnez-vous ci-dessus pour l'activer.",
  },
  store: {
    title: "Boutique",
    subtitle: "Des FlashCoins pour les actions de PilotAI et des packs de matières prêts à l'emploi.",
    balance: "Votre solde",
    coinsWord: "FlashCoins",
    secure: "Achat sécurisé",
    securedBy: "· paiement traité par Paddle",
    loading: "Chargement de la Boutique…",
    error: "Impossible d'ouvrir la Boutique pour le moment.",
    coinsTitle: "FlashCoins",
    coinsInfoTitle: "Ce que les FlashCoins incluent",
    coinsInfo: "Les FlashCoins génèrent et enregistrent des flashcards avec PilotAI : 1 pièce par carte. Valables 12 mois après l’achat. Elles ne servent pas à acheter des matières ni aux cartes mentales, à la conversation ou à la mise en forme des notes.",
    packsInfoTitle: "Ce que la matière inclut",
    packsInfo: (days) => `Accès en lecture seule au contenu officiel pendant ${days} jours, avec toutes les mises à jour de l’auteur durant cette période. Aucun abonnement requis ; les matières sont achetées séparément des formules.`,
    coinsDesc:
      "Les pièces achetées sont valables 12 mois à compter de l'achat et servent à générer et enregistrer des flashcards avec PilotAI (1 pièce par carte). Étudier, réviser, créer à la main et importer un CSV ne consomment aucune pièce.",
    coinCardDesc: "Pièces pour utiliser les fonctions de PilotAI",
    coinsQty: (n) => `${n} pièces, valables 12 mois`,
    buy: "Acheter",
    packsTitle: "Packs de matières",
    subjectPackDesc: "Accès complet au contenu officiel de cette matière.",
    noPacks: "Aucun pack publié pour l'instant. Les packs apparaissent ici dès que vous fixez un prix.",
    accessDays: (n) => `Accès pendant ${n} jours`,
    contentUpdated: (d) => `Contenu mis à jour le ${d}`,
    seeClients: "Voir les clients de cette matière",
    releasedUntil: (d) => `Disponible jusqu'au ${d}`,
    fetchUpdates: "Rechercher des mises à jour",
    changesPreserved: "Vos modifications des cartes, notes et cartes mentales sont toujours conservées.",
    receiveSubject: "Recevoir la matière",
    claimFree: "Débloquer gratuitement (AppManager)",
    renewYear: "Renouveler pour 1 an",
    needUnlimited: "Besoin de cartes illimitées ? Voir les",
    plansLink: "formules d'abonnement",
    renewTitle: "Renouveler pour un an de plus",
    renewDesc:
      "Vous avez déjà étudié cette matière. Choisissez ce qu'il advient de vos modifications de cartes, notes et cartes mentales.",
    keepTitle: "Conserver mes modifications (recommandé)",
    keepDesc:
      "Tout ce que vous avez modifié reste tel quel. Vous recevez seulement le nouveau contenu de l'auteur qui n'entre pas en conflit.",
    overwriteTitle: "Recevoir la matière mise à jour par l'auteur",
    overwriteDesc:
      "La version de l'auteur remplace vos modifications dans cette matière. Vos changements seront perdus sans retour possible.",
    cancel: "Annuler",
    continuePayment: "Continuer vers le paiement",
    clientsTitle: "Clients de cette matière",
    clientsDesc: "date d'achat et d'expiration de chaque accès.",
    clientsLoading: "Chargement des clients…",
    noClients: "Aucun client n'a encore acheté cette matière.",
    thClient: "Client",
    thPurchase: "Achat",
    thExpire: "Expiration",
    thStatus: "Statut",
    active: "actif",
    expired: "expiré",
    close: "Fermer",
    updatedAuthor: "Matière mise à jour avec la version de l'auteur.",
    updatedAdded: (n) => `Matière mise à jour : ${n} nouvel/nouveaux élément(s). Vos modifications ont été conservées.`,
    upToDate: "Matière à jour. Vos modifications ont été conservées.",
    updateFail: "Impossible de mettre à jour la matière.",
    claimed: "Pack débloqué sur votre compte.",
    claimFail: "Impossible de débloquer le pack.",
  },
};

const it: CommerceDict = {
  authExtra: { readAccept: "Ho letto e accetto i", and: "e la", mustAccept: "Devi accettare i Termini di utilizzo e l'Informativa sulla privacy." },
  checkout: { pendingApproval: "I pagamenti sono in approvazione. Riprova a breve.", genericFail: "Non è stato possibile aprire il pagamento. Riprova.", noticeTitle: "Pagamenti in approvazione", noticeBody: "L'addebito reale è ancora in attivazione presso il fornitore di pagamenti. Fino ad allora gli acquisti possono non andare a buon fine — riprova più tardi.", confirming: "Conferma del pagamento…", confirmed: "Pagamento confermato! Il tuo acquisto è stato sbloccato.", confirmSlow: "La conferma del pagamento può richiedere qualche istante. L'accesso viene sbloccato automaticamente." },
  account: {
    title: "Il mio account",
    subtitle: "Il tuo abbonamento, il saldo di FlashCoins e tutto ciò che hai sbloccato.",
    loading: "Caricamento dell'account…",
    error: "Non è stato possibile caricare l'account adesso.",
    subscription: "Abbonamento",
    ownerBadge: "Accesso totale (AppManager)",
    ownerDesc: "Tutte le funzioni e i pacchetti sbloccati senza costi.",
    active: "Attivo",
    plan: "Piano:",
    accessUntil: "Accesso fino al ",
    renewsOn: "Si rinnova il ",
    freePlan: "Sei nel piano gratuito, con un massimo di 100 flashcard.",
    seePlans: "Vedi i piani",
    coinsFree: "FlashCoins gratis",
    coinsAvailable: "Le FlashCoins sono valide 12 mesi",
    buyCoins: "Acquista altre FlashCoins",
    usage30d: "Consumo degli ultimi 30 giorni",
    noUsage: "Nessuna azione di PilotAI nel periodo.",
    usesCoins: (uses, coins) => `${uses} utilizzi · ${coins} monete`,
    cardsCoins: (cards, coins) => `${cards} flashcards · ${coins} monete`,
    packs: "Pacchetti sbloccati",
    noPacks: "Non hai ancora sbloccato nessun pacchetto del Negozio.",
    activeUntil: "Attivo fino al ",
    expiredOn: "Scaduto il ",
    ledger: "Cronologia dei FlashCoins",
    noLedger: "Nessun movimento registrato.",
    accountLabel: "Account:",
    since: "dal",
    actions: {
      chat: "Conversazione",
      tts_cloud: "Voce cloud",
      translate: "Traduzione",
      note_format: "Formatta nota",
      mindmap: "Mappa mentale",
      bulk: "Creazione di flashcard",
      stt: "Dettatura",
    },
  },
  pricing: {
    title: "Piani e moduli",
    subtitle: "Abbonati a Pro o Pro 2 per flashcard illimitate o acquista singoli moduli.",
    proActive: "Abbonamento Pro attivo",
    switchBlocked: "Il tuo abbonamento è attivo. Confronta i vantaggi di ogni piano qui sotto.",
    monthly: "Pro Mensile",
    yearly: "Pro Annuale",
    monthly2: "Pro 2 Mensile",
    yearly2: "Pro 2 Annuale",
    plan2: "Pro 2",
    pro2Active: "Abbonamento Pro 2 attivo",
    monthlyCards: (n) => `${n} flashcard con PilotAI al mese`,
    batchCards: (n) => `Fino a ${n} schede per lotto`,
    monthlyCoins: (n) => `${n} FlashCoins incluse per pagamento mensile`,
    yearlyCoins: (n) => `${n} FlashCoins incluse per pagamento annuale`,
    aiCycleCards: (n) => `Quota PilotAI: ${n} schede per ciclo`,
    perMonth: "/mese",
    perYear: "/anno",
    save33: "Risparmia il 33%",
    fUnlimited: "Flashcard illimitate",
    fSpaced: "Ripetizione dilazionata",
    fDictation: "Dettatura vocale",
    fSupport: "Assistenza prioritaria",
    fAllMonthly: "Tutto del Pro Mensile",
    fEquals: "Equivale a 8 mesi pagati",
    fOneCharge: "Un solo addebito all'anno",
    current: "Piano attuale",
    switchMonthly: "Passa al mensile",
    switchYearly: "Passa all'annuale",
    subMonthly: "Abbonati al mensile",
    subYearly: "Abbonati all'annuale",
    singleTitle: "Materie singole",
    singleDesc: "Acquista solo la materia che vuoi studiare, con accesso di 1 anno al contenuto ufficiale.",
    seeStore: "Vedi le materie nel Negozio",
    back: "Indietro",
    creditsTitle: "Crediti PilotAI",
    creditsLoading: "Caricamento del saldo…",
    creditsError: "Non è stato possibile caricare il saldo adesso.",
    remainingLabel: "Saldo residuo del mese",
    ofChars: (n) => `su ${n} caratteri`,
    cloudUse: "Consumo della voce cloud:",
    chars: "caratteri",
    narrations: (n) => (n === 1 ? "narrazione generata" : "narrazioni generate"),
    chatTitle: "Conversazione con PilotAI",
    chatUsed: (used, limit, min) =>
      `Hai usato ${used} su ${limit} — restano circa ${min} ${min === 1 ? "minuto" : "minuti"} di conversazione questo mese.`,
    resetsOn: (d) => `Il conteggio si azzera il ${d}.`,
    catalogFree: "L'audio già presente nel catalogo si riascolta senza consumare saldo.",
    deviceVoiceFree: "Se il dispositivo ha la voce della lingua installata, la narrazione è gratuita e non consuma saldo.",
    proOnly: "La narrazione cloud è una funzione Pro — abbonati sopra per attivarla.",
  },
  store: {
    title: "Negozio",
    subtitle: "FlashCoins per le azioni di PilotAI e pacchetti di materie pronte.",
    balance: "Il tuo saldo",
    coinsWord: "FlashCoins",
    secure: "Acquisto sicuro",
    securedBy: "· pagamento gestito da Paddle",
    loading: "Caricamento del Negozio…",
    error: "Non è stato possibile aprire il Negozio adesso.",
    coinsTitle: "FlashCoins",
    coinsInfoTitle: "Cosa includono le FlashCoins",
    coinsInfo: "Le FlashCoins generano e salvano flashcard con PilotAI: 1 moneta per scheda. Valide 12 mesi dalla data di acquisto. Non acquistano materie e non si usano per mappe mentali, conversazione o formattazione delle note.",
    packsInfoTitle: "Cosa include la materia",
    packsInfo: (days) => `Accesso in sola lettura ai contenuti ufficiali per ${days} giorni, con tutti gli aggiornamenti dell’autore durante questo periodo. Nessun abbonamento richiesto; le materie si acquistano separatamente dai piani.`,
    coinsDesc:
      "Le monete acquistate valgono 12 mesi dalla data di acquisto e servono a generare e salvare flashcard con PilotAI (1 moneta per card). Studiare, ripassare, creare a mano e importare CSV non consumano monete.",
    coinCardDesc: "Monete per utilizzare le funzioni di PilotAI",
    coinsQty: (n) => `${n} monete, valide 12 mesi`,
    buy: "Acquista",
    packsTitle: "Pacchetti di materie",
    subjectPackDesc: "Accesso completo al contenuto ufficiale di questa materia.",
    noPacks: "Nessun pacchetto pubblicato per ora. I pacchetti appaiono qui appena imposti un prezzo.",
    accessDays: (n) => `Accesso per ${n} giorni`,
    contentUpdated: (d) => `Contenuto aggiornato il ${d}`,
    seeClients: "Vedi i clienti di questa materia",
    releasedUntil: (d) => `Disponibile fino al ${d}`,
    fetchUpdates: "Cerca aggiornamenti",
    changesPreserved: "Le tue modifiche a card, note e mappe mentali sono sempre conservate.",
    receiveSubject: "Ricevi la materia",
    claimFree: "Sblocca gratis (AppManager)",
    renewYear: "Rinnova per 1 anno",
    needUnlimited: "Ti servono flashcard illimitate? Guarda i",
    plansLink: "piani di abbonamento",
    renewTitle: "Rinnova per un altro anno",
    renewDesc:
      "Hai già studiato questa materia. Scegli cosa accade alle tue modifiche di flashcard, note e mappe mentali.",
    keepTitle: "Mantieni le mie modifiche (consigliato)",
    keepDesc:
      "Tutto ciò che hai cambiato resta come lo hai fatto. Ricevi solo il nuovo contenuto dell'autore che non entra in conflitto.",
    overwriteTitle: "Ricevi la materia aggiornata dall'autore",
    overwriteDesc:
      "La versione dell'autore sostituisce le tue modifiche in questa materia. Le tue modifiche andranno perse senza possibilità di recupero.",
    cancel: "Annulla",
    continuePayment: "Continua al pagamento",
    clientsTitle: "Clienti di questa materia",
    clientsDesc: "data di acquisto e di scadenza di ogni accesso.",
    clientsLoading: "Caricamento dei clienti…",
    noClients: "Nessun cliente ha ancora acquistato questa materia.",
    thClient: "Cliente",
    thPurchase: "Acquisto",
    thExpire: "Scadenza",
    thStatus: "Stato",
    active: "attivo",
    expired: "scaduto",
    close: "Chiudi",
    updatedAuthor: "Materia aggiornata con la versione dell'autore.",
    updatedAdded: (n) => `Materia aggiornata: ${n} nuovo/nuovi elemento(i). Le tue modifiche sono state mantenute.`,
    upToDate: "Materia aggiornata. Le tue modifiche sono state mantenute.",
    updateFail: "Non è stato possibile aggiornare la materia.",
    claimed: "Pacchetto sbloccato nel tuo account.",
    claimFail: "Non è stato possibile sbloccare il pacchetto.",
  },
};

const de: CommerceDict = {
  authExtra: { readAccept: "Ich habe die", and: "und die", mustAccept: "Du musst die Nutzungsbedingungen und die Datenschutzerklärung akzeptieren." },
  checkout: { pendingApproval: "Zahlungen werden noch freigegeben. Bitte versuche es bald erneut.", genericFail: "Die Zahlung konnte nicht geöffnet werden. Bitte versuche es erneut.", noticeTitle: "Zahlungen in Freigabe", noticeBody: "Echte Zahlungen werden vom Zahlungsanbieter noch freigeschaltet. Bis dahin können Käufe fehlschlagen — versuche es später erneut.", confirming: "Zahlung wird bestätigt…", confirmed: "Zahlung bestätigt! Dein Kauf ist freigeschaltet.", confirmSlow: "Die Bestätigung kann einen Moment dauern. Der Zugang wird automatisch freigeschaltet." },
  account: {
    title: "Mein Konto",
    subtitle: "Dein Abo, dein FlashCoins-Guthaben und alles, was du freigeschaltet hast.",
    loading: "Konto wird geladen…",
    error: "Das Konto konnte gerade nicht geladen werden.",
    subscription: "Abo",
    ownerBadge: "Vollzugriff (AppManager)",
    ownerDesc: "Alle Funktionen und Pakete kostenlos freigeschaltet.",
    active: "Aktiv",
    plan: "Tarif:",
    accessUntil: "Zugang bis ",
    renewsOn: "Verlängert am ",
    freePlan: "Du bist im kostenlosen Tarif mit bis zu 100 Karten.",
    seePlans: "Tarife ansehen",
    coinsFree: "FlashCoins gratis",
    coinsAvailable: "FlashCoins gelten 12 Monate",
    buyCoins: "Mehr FlashCoins kaufen",
    usage30d: "Verbrauch der letzten 30 Tage",
    noUsage: "Keine PilotAI-Aktion in diesem Zeitraum.",
    usesCoins: (uses, coins) => `${uses} Nutzungen · ${coins} Münzen`,
    cardsCoins: (cards, coins) => `${cards} flashcards · ${coins} Münzen`,
    packs: "Freigeschaltete Pakete",
    noPacks: "Du hast noch kein Paket aus dem Shop freigeschaltet.",
    activeUntil: "Aktiv bis ",
    expiredOn: "Abgelaufen am ",
    ledger: "FlashCoins-Verlauf",
    noLedger: "Keine Bewegung erfasst.",
    accountLabel: "Konto:",
    since: "seit",
    actions: {
      chat: "Gespräch",
      tts_cloud: "Cloud-Stimme",
      translate: "Übersetzung",
      note_format: "Notiz formatieren",
      mindmap: "Mindmap",
      bulk: "Flashcards erstellen",
      stt: "Diktat",
    },
  },
  pricing: {
    title: "Tarife und Module",
    subtitle: "Abonniere Pro oder Pro 2 für unbegrenzte Karten oder kaufe einzelne Module.",
    proActive: "Pro-Abo aktiv",
    switchBlocked: "Dein Abo ist aktiv. Vergleiche unten die Leistungen der Tarife.",
    monthly: "Pro Monatlich",
    yearly: "Pro Jährlich",
    monthly2: "Pro 2 Monatlich",
    yearly2: "Pro 2 Jährlich",
    plan2: "Pro 2",
    pro2Active: "Pro-2-Abo aktiv",
    monthlyCards: (n) => `${n} PilotAI-Lernkarten pro Monat`,
    batchCards: (n) => `Bis zu ${n} Karten pro Stapel`,
    monthlyCoins: (n) => `${n} FlashCoins pro monatlicher Zahlung enthalten`,
    yearlyCoins: (n) => `${n} FlashCoins pro jährlicher Zahlung enthalten`,
    aiCycleCards: (n) => `PilotAI-Kontingent: ${n} Karten pro Zyklus`,
    perMonth: "/Monat",
    perYear: "/Jahr",
    save33: "33 % sparen",
    fUnlimited: "Unbegrenzte Karten",
    fSpaced: "Verteiltes Wiederholen",
    fDictation: "Sprachdiktat",
    fSupport: "Vorrangiger Support",
    fAllMonthly: "Alles aus Pro Monatlich",
    fEquals: "Entspricht 8 bezahlten Monaten",
    fOneCharge: "Einmalige Abbuchung pro Jahr",
    current: "Aktueller Tarif",
    switchMonthly: "Zu monatlich wechseln",
    switchYearly: "Zu jährlich wechseln",
    subMonthly: "Monatlich abonnieren",
    subYearly: "Jährlich abonnieren",
    singleTitle: "Einzelne Fächer",
    singleDesc: "Kaufe nur das Fach, das du lernen willst, mit 1 Jahr Zugang zum offiziellen Inhalt.",
    seeStore: "Fächer im Shop ansehen",
    back: "Zurück",
    creditsTitle: "PilotAI-Guthaben",
    creditsLoading: "Guthaben wird geladen…",
    creditsError: "Das Guthaben konnte gerade nicht geladen werden.",
    remainingLabel: "Restguthaben des Monats",
    ofChars: (n) => `von ${n} Zeichen`,
    cloudUse: "Verbrauch der Cloud-Stimme:",
    chars: "Zeichen",
    narrations: (n) => (n === 1 ? "erzeugte Sprachausgabe" : "erzeugte Sprachausgaben"),
    chatTitle: "Gespräch mit von PilotAI",
    chatUsed: (used, limit, min) =>
      `Du hast ${used} von ${limit} genutzt — es bleiben etwa ${min} ${min === 1 ? "Minute" : "Minuten"} Gespräch in diesem Monat.`,
    resetsOn: (d) => `Die Zählung beginnt am ${d} neu.`,
    catalogFree: "Audio, das bereits im Katalog liegt, wird ohne Guthaben erneut abgespielt.",
    deviceVoiceFree: "Wenn das Gerät die Stimme der Sprache installiert hat, ist die Sprachausgabe kostenlos.",
    proOnly: "Cloud-Sprachausgabe ist eine Pro-Funktion — abonniere oben, um sie zu aktivieren.",
  },
  store: {
    title: "Shop",
    subtitle: "FlashCoins für PilotAI-Aktionen und fertige Fachpakete.",
    balance: "Dein Guthaben",
    coinsWord: "FlashCoins",
    secure: "Sicherer Kauf",
    securedBy: "· Zahlung über Paddle",
    loading: "Shop wird geladen…",
    error: "Der Shop konnte gerade nicht geöffnet werden.",
    coinsTitle: "FlashCoins",
    coinsInfoTitle: "Was FlashCoins enthalten",
    coinsInfo: "FlashCoins erzeugen und speichern Lernkarten mit PilotAI: 1 Münze pro Karte. Ab Kauf 12 Monate gültig. Sie kaufen keine Fächer und werden nicht für Mindmaps, Gespräche oder die Formatierung von Notizen verwendet.",
    packsInfoTitle: "Was das Fach enthält",
    packsInfo: (days) => `Lesezugriff auf offizielle Inhalte für ${days} Tage, inklusive aller Aktualisierungen des Autors in diesem Zeitraum. Kein Abo erforderlich; Fächer werden unabhängig von Tarifen gekauft.`,
    coinsDesc:
      "Gekaufte Münzen sind 12 Monate ab Kaufdatum gültig und werden zum Erzeugen und Speichern von Lernkarten mit PilotAI genutzt (1 Münze pro Karte). Lernen, Wiederholen, manuelles Anlegen und CSV-Import verbrauchen keine Münzen.",
    coinCardDesc: "Münzen zur Nutzung der Funktionen von PilotAI",
    coinsQty: (n) => `${n} Münzen, 12 Monate gültig`,
    buy: "Kaufen",
    packsTitle: "Fachpakete",
    subjectPackDesc: "Vollständiger Zugang zu den offiziellen Inhalten dieses Fachs.",
    noPacks: "Noch kein Paket veröffentlicht. Pakete erscheinen hier, sobald du einen Preis festlegst.",
    accessDays: (n) => `Zugang für ${n} Tage`,
    contentUpdated: (d) => `Inhalt aktualisiert am ${d}`,
    seeClients: "Kunden dieses Fachs ansehen",
    releasedUntil: (d) => `Freigegeben bis ${d}`,
    fetchUpdates: "Nach Aktualisierungen suchen",
    changesPreserved: "Deine Änderungen an Karten, Notizen und Mindmaps bleiben immer erhalten.",
    receiveSubject: "Fach erhalten",
    claimFree: "Kostenlos freigeben (AppManager)",
    renewYear: "Für 1 Jahr verlängern",
    needUnlimited: "Brauchst du unbegrenzte Karten? Sieh die",
    plansLink: "Abo-Tarife",
    renewTitle: "Um ein weiteres Jahr verlängern",
    renewDesc:
      "Du hast dieses Fach schon gelernt. Wähle, was mit deinen Änderungen an Karten, Notizen und Mindmaps passiert.",
    keepTitle: "Meine Änderungen behalten (empfohlen)",
    keepDesc:
      "Alles, was du geändert hast, bleibt so. Du erhältst nur neuen Inhalt des Autors, der nicht mit deinem kollidiert.",
    overwriteTitle: "Aktualisiertes Fach des Autors erhalten",
    overwriteDesc:
      "Die Version des Autors ersetzt deine Änderungen in diesem Fach. Deine Bearbeitungen gehen unwiderruflich verloren.",
    cancel: "Abbrechen",
    continuePayment: "Weiter zur Zahlung",
    clientsTitle: "Kunden dieses Fachs",
    clientsDesc: "Kauf- und Ablaufdatum jedes Zugangs.",
    clientsLoading: "Kunden werden geladen…",
    noClients: "Noch kein Kunde hat dieses Fach gekauft.",
    thClient: "Kunde",
    thPurchase: "Kauf",
    thExpire: "Ablauf",
    thStatus: "Status",
    active: "aktiv",
    expired: "abgelaufen",
    close: "Schließen",
    updatedAuthor: "Fach mit der Version des Autors aktualisiert.",
    updatedAdded: (n) => `Fach aktualisiert: ${n} neue(s) Element(e). Deine Änderungen wurden behalten.`,
    upToDate: "Fach ist aktuell. Deine Änderungen wurden behalten.",
    updateFail: "Das Fach konnte nicht aktualisiert werden.",
    claimed: "Paket in deinem Konto freigegeben.",
    claimFail: "Das Paket konnte nicht freigegeben werden.",
  },
};

export const COMMERCE_DICTS: Record<Lang, CommerceDict> = {
  pt,
  "pt-PT": ptPT,
  es,
  en,
  fr,
  it,
  de,
};
