import { setUiLang, setUiOverlay } from "./i18n-ui";
import {
  APP_EXT_LANGS,
  EXT_LANG_COOKIE,
  EXT_LANG_KEY,
  applyDictOverlay,
  isExtLang,
  loadExtOverlay,
  matchAppLocale,
  resolveManualAppLocale,
  type AppLocale,
  type ExtOverlay,
} from "./app-ext-langs";
import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ptBR, pt, es, enUS, fr, it, de } from "date-fns/locale";
import type { Locale } from "date-fns";
import { deepMergeDict, ptPTOverlay, frOverlay, itOverlay, deOverlay } from "./i18n-locales";
import { EXTRA_DICTS, type ExtraDict } from "./i18n-extra";
import { COMMERCE_DICTS, type CommerceDict } from "./i18n-commerce";
import { PROFILE_DICTS, type ProfileDict } from "./i18n-profile";
import { HOME_HUB_DICTS, type HomeHubTexts } from "./i18n-home-hub";
import {
  ALL_LANGS,
  FALLBACK_LANG,
  LANG_COOKIE,
  LANG_MANUAL_COOKIE,
  isLang,
  matchBrowserLang,
  type Lang,
} from "./lang-match";

export type { Lang };
export { matchBrowserLang };

const STORAGE_KEY = "app-lang";

const dict = {
  pt: {
    langName: "Português",
    common: {
      loading: "Carregando…",
      save: "Salvar",
      saving: "Salvando…",
      cancel: "Cancelar",
      create: "Criar",
      remove: "Remover",
      back: "Voltar",
      backHome: "Voltar ao início",
      language: "Idioma",
      or: "OU",
      error: "Erro",
      notAuth: "Não autenticado",
    },
    nav: {
      home: "Início",
      settings: "Configurações",
      signOut: "Sair",
      bulk: "Criação de flashcards",
      reports: "Relatório",
    },
    pomodoro: {
      label: "Pomodoro",
      work: "Sessão de estudo",
      break: "Pausa",
      start: "Iniciar",
      pause: "Pausar",
      reset: "Resetar",
      studyMin: "Estudo (min)",
      breakMin: "Pausa (min)",
      toastBreakTitle: "⏸ Pausa nos estudos",
      toastBreakDesc: (m: number) => `Descanse ${m} min. O timer já começou.`,
      toastWorkTitle: "📚 Está na hora de voltar aos estudos!",
      toastWorkDesc: (m: number) => `Nova sessão de ${m} min iniciada.`,
    },
    reports: {
      title: "Relatório de revisões",
      subtitle: "Situação atual de cada flashcard e histórico completo das revisões feitas.",
      metaTitle: "Relatório de revisões · FlashPilot",
      metaDesc: "Acompanhe a situação atual e o histórico de revisões dos seus flashcards.",
      searchPh: "Buscar pergunta",
      allSubjects: "Todas as matérias",
      allSubjectsGlobal: "Todas as matérias (global)",
      tabCurrent: "Situação atual",
      tabHistory: "Histórico",
      colFlashcard: "Flashcard",
      colSubjectTopic: "Matéria / Tópico",
      colLastReview: "Última revisão",
      colClassification: "Classificação",
      colNextReview: "Próxima revisão",
      colReviewsDone: "Revisões feitas",
      colReviewDate: "Data da revisão",
      colPrevDue: "Vencimento anterior",
      colInterval: "Intervalo",
      empty: "Nenhum flashcard encontrado.",
      emptyHistory: "Nenhuma revisão registrada ainda.",
      reviewOne: "revisão",
      reviewMany: "revisões",
      qForgot: "Errei",
      qHard: "Difícil",
      qGood: "Lembrei",
      qEasy: "Muito fácil",
      reviewedAll: "Revisados: todos",
      reviewedOnly: "Somente revisados",
      notReviewedOnly: "Somente não revisados",
      reviewed: "Revisado",
      yes: "Sim",
      no: "Não",
    },
    chart: {
      title: "Evolução da performance",
      subtitle: "% de acertos por dia (nota ≥ Difícil). Linha grossa = média móvel de 7 dias.",
      periodAccuracy: "Acerto no período",
      rangeAll: "Tudo",
      dayShort: "d",
      revShort: "rev.",
      empty: "Ainda sem revisões no período.",
      reviews: "Revisões",
      dailyAccuracy: "Acerto diário",
      ma7: "Média 7d",
    },
    subjectPage: {
      renameSubject: "Renomear matéria",
      deleteSubject: "Excluir matéria",
      renameTopic: "Renomear tópico",
      deleteTopic: "Excluir tópico",
      searchPh: "Buscar tópicos ou flashcards nesta matéria…",
      reviewSubject: "Revisar matéria",
      renamePrompt: "Novo nome:",
      nameUpdated: "Nome atualizado",
      topicUpdated: "Tópico atualizado",
      nothingFound: (q: string) => `Nada encontrado para "${q}".`,
    },
    errors: {
      notFoundTitle: "404",
      notFoundBody: "Página não encontrada.",
      somethingWrong: "Algo deu errado",
      retryHint: "Tente novamente ou volte ao início.",
      retry: "Tentar de novo",
      home: "Início",
    },
    auth: {
      tagline: "Flashcards com revisão espaçada e ditado por voz",
      signIn: "Entrar",
      signUp: "Criar conta",
      email: "E-mail",
      password: "Senha",
      emailPh: "voce@exemplo.com",
      passwordPh: "Mínimo 6 caracteres",
      loading: "Carregando…",
      google: "Continuar com Google",
      googleError: "Não foi possível entrar com Google",
      microsoft: "Continuar com Microsoft",
      microsoftError: "Não foi possível entrar com Microsoft",
      apple: "Continuar com Apple",
      appleError: "Não foi possível entrar com Apple",
      authError: "Erro na autenticação",
      accountCreated: "Conta criada! Você já pode entrar.",
    },
    home: {
      hello: "Olá — hora de estudar",
      title: "Minhas matérias",
      subjects: "Matérias",
      newSubject: "Nova matéria",
      createSubject: "Criar matéria",
      subjectName: "Nome da matéria",
      subjectNamePh: "Ex: Direito Constitucional",
      color: "Cor",
      emptyTitle: "Comece pela primeira matéria",
      emptyHint: "Você pode ditar o nome pelo microfone.",
      created: "Matéria criada",
      topicsOne: "assunto",
      topicsMany: "assuntos",
      subtopicsOne: "subtópico",
      subtopicsMany: "subtópicos",
      reviewTag: "Curva de esquecimento",
      reviewNone: "Nada para revisar hoje",
      reviewSome: (n: number) => `${n} para revisar hoje`,
      reviewNoneHint: "Volte amanhã ou crie novos flashcards agora.",
      reviewSomeHint: "",
      start: "Começar revisão",
      reviewNow: "Revisar agora",
      activeSessions: "Ver Flash Sessions em andamento",
      favorites: "Favoritos",
      favoritesCount: (n: number) =>
        `${n} ${n === 1 ? "card marcado" : "cards marcados"} para revisão dedicada`,
      reviewFavorites: "Revisar",
      missingAnswerTitle: "Sem resposta",
      missingAnswerEmpty: "Nenhum flashcard sem resposta.",
      missingAnswerCount: (n: number) => `${n} flashcard(s) sem resposta`,
      notifTitle: "Ativar notificações do navegador",
      notifBody: "Avisa quando você tiver flashcards para revisar.",
      enable: "Ativar",
      later: "Depois",
      notifEnabled: "Notificações ativadas",
      notifHead: "FlashPilot — hora de revisar",
      notifText: (n: number) => `Você tem ${n} flashcard(s) para revisar hoje.`,
    },
    subject: {
      all: "Todas as matérias",
      label: "Matéria",
      topics: "Assuntos",
      newTopic: "Novo assunto",
      createTopic: "Criar assunto",
      topicName: "Nome do assunto",
      topicNamePh: "Ex: Princípios fundamentais",
      articleRange: "Artigos (opcional)",
      articleRangePh: "Ex.: arts. 15 a 29",
      language: "Idioma (opcional)",
      languageNone: "Sem idioma definido",
      languageHint: "Use apenas em matérias de idiomas. Sem idioma, nada muda.",
      cardLanguage: "Idioma do card (opcional)",
      cardLanguageInherit: "Herdar da matéria",
      setLanguage: "Definir idioma",
      editTopic: "Editar",
      emptyTitle: "Adicione o primeiro assunto",
      emptyHint: "Dentro dele você criará os flashcards.",
      created: "Assunto criado",
      confirmRemove: "Remover matéria e todos os assuntos/flashcards?",
      removed: "Matéria removida",
      cardsOne: "flashcard",
      cardsMany: "flashcards",
      subtopicOne: "subtópico",
      subtopicMany: "subtópicos",
      subitemOne: "subitem",
      subitemMany: "subitens",
    },
    topic: {
      label: "Assunto",
      cardsInfo: (n: number, due: number) => `${n} flashcards · ${due} para revisar hoje`,
      review: (n: number) => `Revisar (${n})`,
      reviewNow: "Revisar agora",
      newCard: "Flashcard",
      createCard: "Novo flashcard",
      question: "Pergunta",
      answer: "Resposta",
      questionPh: "Escreva ou dite a pergunta…",
      answerPh: "Escreva ou dite a resposta…",
      created: "Flashcard criado",
      autoReview: "Revisões automáticas",
      autoReviewOn:
        "Este assunto reaparece pelo menos uma vez por semana. Desligue quando já estiver memorizado na memória de longo prazo.",
      autoReviewOff:
        "As revisões deste assunto estão pausadas. Os flashcards continuam salvos — reative quando quiser voltar a receber avisos.",
      reactivated: "Revisões reativadas",
      paused: "Revisões pausadas — você não receberá mais avisos deste assunto",
      emptyTitle: "Adicione o primeiro flashcard",
      emptyHint: "Você pode ditar pergunta e resposta por voz.",
      reviewToday: "Revisar hoje",
      reviewOn: (d: string) => `Revisar em ${d}`,
      reviewsCount: (n: number) => `${n} revisões`,
      confirmRemoveCard: "Remover flashcard?",
      removed: "Removido",
      subtopics: "Subtópicos",
      newSubtopic: "Novo subtópico",
      createSubtopic: "Criar subtópico",
      subtopicName: "Nome do subtópico",
      subtopicNamePh: "Ex: Tutela de urgência",
      subtopicCreated: "Subtópico criado",
      emptySubtopics: "Nenhum subtópico ainda. Crie um para organizar em mais níveis.",
      backToParent: "Voltar ao tópico pai",
      confirmRemoveTopic: "Remover este tópico e todos os subtópicos/flashcards?",
      topicRemoved: "Tópico removido",
      removeTopic: "Remover tópico",
      clearAnswer: "Limpar resposta",
      confirmClearAnswer: "Tem certeza que deseja apagar a resposta atual?",
      answerCleared: "Resposta apagada",
    },
    study: {
      exit: "Sair",
      allDone: "Tudo em dia!",
      reviewedCount: (n: number) => `Você revisou ${n} flashcard(s).`,
      nothingToday: "Nada agendado para hoje.",
      howWas: "Como foi lembrar?",
      completed: "Revisão concluída! 🎉",
      errorRecord: "Erro ao registrar",
      cardFront: "Pergunta",
      cardBack: "Resposta",
      cardFrontHint: "Toque para ver a resposta",
      cardBackHint: "Toque para voltar",
      q: {
        forgot: { label: "Errei", hint: "Errou — reaparece amanhã e zera a sequência de acertos." },
        hard: { label: "Difícil", hint: "Acertou com esforço — intervalo curto, facilidade cai." },
        good: { label: "Lembrei", hint: "Lembrou sem esforço — progressão padrão do intervalo." },
        easy: {
          label: "Muito fácil",
          hint: "Acertou com folga — intervalo maior, facilidade sobe.",
        },
      },
    },
    settings: {
      title: "Configurações",
      subtitle: "Notificações e preferências",
      language: "Idioma",
      languageHint: "Escolha o idioma da interface.",
      theme: "Tema",
      themeLabel: "Escolha o tema do aplicativo.",
      browserNotif: "Notificações no navegador",
      browserNotifDesc:
        "Recebe um alerta quando houver flashcards para revisar (funciona mesmo com a aba aberta em segundo plano).",
      active: "Ativas",
      blocked: "Bloqueadas pelo navegador. Ative nas permissões do site.",
      unsupported: "Não suportadas neste navegador.",
      enable: "Ativar notificações",
      permDenied: "Permissão negada",
      panelTitle: 'Painel "Para revisar hoje"',
      panelHint: "Mostra a contagem na tela inicial",
      telegramTitle: "Lembretes por Telegram",
      telegramDesc:
        "Receba mensagens automáticas no Telegram quando houver assuntos para revisar. Como configurar:",
      tgStep1: "Abra o Telegram e procure por",
      tgStep2: "e copie o número do seu ID",
      tgStep3: "Cole abaixo e salve",
      tgStep4a: "Depois, procure pelo bot que você criou no",
      tgStep4b: "para autorizá-lo a te enviar mensagens",
      tgSend: "Envie",
      tgAndCopy: "e copie o número do seu ID",
      tgLabel: "Seu chat ID do Telegram",
      tgPh: "Ex: 123456789",
      sendTest: "Enviar teste",
      testSent: "Mensagem enviada! Confira seu Telegram.",
      testFail: "Falha no envio",
      saved: "Salvo",
      saveChanges: "Salvar alterações",
      footer:
        "As lembranças automáticas por Telegram serão enviadas todo dia às 8h (horário do seu servidor) para os assuntos que estiverem no prazo de revisão.",
    },
    voice: {
      recording: "Gravando… toque no quadrado para parar.",
      transcribing: "Transcrevendo…",
      startAria: "Ditar por voz",
      stopAria: "Parar gravação",
      tooShort: "Gravação muito curta — tente falar por mais tempo.",
      cantUnderstand: "Não consegui entender o áudio. Tente novamente.",
      transcribeErr: "Erro ao transcrever",
      micError: "Não foi possível acessar o microfone. Verifique as permissões.",
    },
    notes: {
      title: "Anotações",
      new: "Nova",
      empty: "Nenhuma anotação ainda.",
      selectOrCreate: "Selecione ou crie uma anotação",
      hint: "Suas anotações ficam salvas com segurança na sua conta.",
      untitled: "Sem título",
      titlePh: "Título da anotação",
      saved: "Salvo",
      savedAt: "Salvo às",
      unsaved: "Alterações não salvas…",
      removed: "Anotação removida",
      confirmRemove: "Remover esta anotação?",
      categories: "Categorias",
      allNotes: "Todas as anotações",
      uncategorized: "Sem categoria",
      newCategory: "Nova categoria",
      newSubcategory: "Nova subcategoria",
      categoryName: "Nome da categoria",
      categoryNamePh: "Ex: Direito Constitucional",
      subcategoryOf: (parent: string) => `Subcategoria de ${parent}`,
      rootCategoryOption: "— Categoria principal (sem pai) —",
      manageCategories: "Gerenciar categorias",
      confirmRemoveCategory:
        "Remover esta categoria e suas subcategorias? As anotações ficarão sem categoria.",
      categoryRemoved: "Categoria removida",
      categoryCreated: "Categoria criada",
      categoryRenamed: "Categoria renomeada",
      renameCategoryPrompt: "Novo nome da categoria:",
      rename: "Renomear",
      moveToCategory: "Categoria",
      noCategory: "Sem categoria",
    },
    flashLink: {
      linkAnswer: "Vincular resposta a uma anotação",
      linkedTo: "Vinculado a",
      viewNote: "Ver anotação",
      none: "Nenhuma",
      pickNote: "Escolher anotação…",
      editCard: "Editar flashcard",
      cardUpdated: "Flashcard atualizado",
    },
    flashcardsList: {
      label: "Todos os flashcards",
      title: "Flashcards",
      countInfo: (n: number) => `${n} flashcard(s)`,
      subject: "Matéria",
      topic: "Assunto",
      allTopics: "Todos os assuntos",
      searchLabel: "Buscar",
      searchPh: "Pergunta ou resposta…",
      rowsPerPage: "Linhas por página",
      pageOf: (p: number, tot: number) => `Página ${p} de ${tot}`,
      prev: "Anterior",
      next: "Próxima",
      exportExcel: "Excel",
      exportPdf: "PDF",
      emptyTitle: "Nenhum flashcard encontrado",
      emptyHint: "Ajuste os filtros ou crie novos flashcards.",
      noAnswer: "(sem resposta)",
      colSubject: "Matéria",
      colTopic: "Assunto",
      colQuestion: "Pergunta",
      colAnswer: "Resposta",
      colDue: "Revisar em",
      colReps: "Revisões",
    },
  },
  es: {
    langName: "Español",
    common: {
      loading: "Cargando…",
      save: "Guardar",
      saving: "Guardando…",
      cancel: "Cancelar",
      create: "Crear",
      remove: "Eliminar",
      back: "Volver",
      backHome: "Volver al inicio",
      language: "Idioma",
      or: "O",
      error: "Error",
      notAuth: "No autenticado",
    },
    nav: {
      home: "Inicio",
      settings: "Ajustes",
      signOut: "Salir",
      bulk: "Creación de flashcards",
      reports: "Informe",
    },
    pomodoro: {
      label: "Pomodoro",
      work: "Sesión de estudio",
      break: "Pausa",
      start: "Iniciar",
      pause: "Pausar",
      reset: "Reiniciar",
      studyMin: "Estudio (min)",
      breakMin: "Pausa (min)",
      toastBreakTitle: "⏸ Pausa en el estudio",
      toastBreakDesc: (m: number) => `Descansa ${m} min. El temporizador ya empezó.`,
      toastWorkTitle: "📚 ¡Hora de volver al estudio!",
      toastWorkDesc: (m: number) => `Nueva sesión de ${m} min iniciada.`,
    },
    reports: {
      title: "Informe de repasos",
      subtitle: "Situación actual de cada tarjeta e historial completo de los repasos realizados.",
      metaTitle: "Informe de repasos · FlashPilot",
      metaDesc: "Sigue la situación actual y el historial de repasos de tus tarjetas.",
      searchPh: "Buscar pregunta",
      allSubjects: "Todas las materias",
      allSubjectsGlobal: "Todas las materias (global)",
      tabCurrent: "Situación actual",
      tabHistory: "Historial",
      colFlashcard: "Tarjeta",
      colSubjectTopic: "Materia / Tema",
      colLastReview: "Último repaso",
      colClassification: "Clasificación",
      colNextReview: "Próximo repaso",
      colReviewsDone: "Repasos realizados",
      colReviewDate: "Fecha del repaso",
      colPrevDue: "Vencimiento anterior",
      colInterval: "Intervalo",
      empty: "No se encontró ninguna tarjeta.",
      emptyHistory: "Aún no hay repasos registrados.",
      reviewOne: "repaso",
      reviewMany: "repasos",
      qForgot: "Fallé",
      qHard: "Difícil",
      qGood: "Recordé",
      qEasy: "Muy fácil",
      reviewedAll: "Revisados: todos",
      reviewedOnly: "Solo revisados",
      notReviewedOnly: "Solo no revisados",
      reviewed: "Revisado",
      yes: "Sí",
      no: "No",
    },
    chart: {
      title: "Evolución del rendimiento",
      subtitle: "% de aciertos por día (nota ≥ Difícil). Línea gruesa = media móvil de 7 días.",
      periodAccuracy: "Acierto en el período",
      rangeAll: "Todo",
      dayShort: "d",
      revShort: "rep.",
      empty: "Aún no hay repasos en el período.",
      reviews: "Repasos",
      dailyAccuracy: "Acierto diario",
      ma7: "Media 7d",
    },
    subjectPage: {
      renameSubject: "Renombrar materia",
      deleteSubject: "Eliminar materia",
      renameTopic: "Renombrar tema",
      deleteTopic: "Eliminar tema",
      searchPh: "Buscar temas o tarjetas en esta materia…",
      reviewSubject: "Repasar materia",
      renamePrompt: "Nuevo nombre:",
      nameUpdated: "Nombre actualizado",
      topicUpdated: "Tema actualizado",
      nothingFound: (q: string) => `Nada encontrado para "${q}".`,
    },
    errors: {
      notFoundTitle: "404",
      notFoundBody: "Página no encontrada.",
      somethingWrong: "Algo salió mal",
      retryHint: "Inténtalo de nuevo o vuelve al inicio.",
      retry: "Reintentar",
      home: "Inicio",
    },
    auth: {
      tagline: "Flashcards con repaso espaciado y dictado por voz",
      signIn: "Entrar",
      signUp: "Crear cuenta",
      email: "Correo",
      password: "Contraseña",
      emailPh: "tu@ejemplo.com",
      passwordPh: "Mínimo 6 caracteres",
      loading: "Cargando…",
      google: "Continuar con Google",
      googleError: "No se pudo iniciar sesión con Google",
      microsoft: "Continuar con Microsoft",
      microsoftError: "No se pudo iniciar sesión con Microsoft",
      apple: "Continuar con Apple",
      appleError: "No se pudo iniciar sesión con Apple",
      authError: "Error de autenticación",
      accountCreated: "¡Cuenta creada! Ya puedes entrar.",
    },
    home: {
      hello: "Hola — hora de estudiar",
      title: "Mis materias",
      subjects: "Materias",
      newSubject: "Nueva materia",
      createSubject: "Crear materia",
      subjectName: "Nombre de la materia",
      subjectNamePh: "Ej: Derecho Constitucional",
      color: "Color",
      emptyTitle: "Empieza con la primera materia",
      emptyHint: "Puedes dictar el nombre por micrófono.",
      created: "Materia creada",
      topicsOne: "tema",
      topicsMany: "temas",
      subtopicsOne: "subtema",
      subtopicsMany: "subtemas",
      reviewTag: "Curva del olvido",
      reviewNone: "Nada para repasar hoy",
      reviewSome: (n: number) => `${n} para repasar hoy`,
      reviewNoneHint: "Vuelve mañana o crea nuevas tarjetas ahora.",
      reviewSomeHint: "",
      start: "Empezar repaso",
      reviewNow: "Repasar ahora",
      activeSessions: "Ver Flash Sessions en curso",
      favorites: "Favoritos",
      favoritesCount: (n: number) =>
        `${n} ${n === 1 ? "tarjeta marcada" : "tarjetas marcadas"} para repaso dedicado`,
      reviewFavorites: "Repasar",
      missingAnswerTitle: "Sin respuesta",
      missingAnswerEmpty: "Ninguna tarjeta sin respuesta.",
      missingAnswerCount: (n: number) => `${n} tarjeta(s) sin respuesta`,
      notifTitle: "Activar notificaciones del navegador",
      notifBody: "Te avisa cuando tengas tarjetas para repasar.",
      enable: "Activar",
      later: "Después",
      notifEnabled: "Notificaciones activadas",
      notifHead: "FlashPilot — hora de repasar",
      notifText: (n: number) => `Tienes ${n} tarjeta(s) para repasar hoy.`,
    },
    subject: {
      all: "Todas las materias",
      label: "Materia",
      topics: "Temas",
      newTopic: "Nuevo tema",
      createTopic: "Crear tema",
      topicName: "Nombre del tema",
      topicNamePh: "Ej: Principios fundamentales",
      articleRange: "Artículos (opcional)",
      articleRangePh: "Ej.: arts. 15 a 29",
      language: "Idioma (opcional)",
      languageNone: "Sin idioma definido",
      languageHint: "Úsalo solo en materias de idiomas. Sin idioma, nada cambia.",
      cardLanguage: "Idioma de la tarjeta (opcional)",
      cardLanguageInherit: "Heredar de la materia",
      setLanguage: "Definir idioma",
      editTopic: "Editar",
      emptyTitle: "Añade el primer tema",
      emptyHint: "Dentro crearás las tarjetas.",
      created: "Tema creado",
      confirmRemove: "¿Eliminar la materia y todos los temas/tarjetas?",
      removed: "Materia eliminada",
      cardsOne: "tarjeta",
      cardsMany: "tarjetas",
      subtopicOne: "subtema",
      subtopicMany: "subtemas",
      subitemOne: "subelemento",
      subitemMany: "subelementos",
    },
    topic: {
      label: "Tema",
      cardsInfo: (n: number, due: number) => `${n} tarjetas · ${due} para repasar hoy`,
      review: (n: number) => `Repasar (${n})`,
      reviewNow: "Repasar ahora",
      newCard: "Tarjeta",
      createCard: "Nueva tarjeta",
      question: "Pregunta",
      answer: "Respuesta",
      questionPh: "Escribe o dicta la pregunta…",
      answerPh: "Escribe o dicta la respuesta…",
      created: "Tarjeta creada",
      autoReview: "Repasos automáticos",
      autoReviewOn:
        "Este tema reaparece al menos una vez por semana. Desactívalo cuando ya lo tengas memorizado a largo plazo.",
      autoReviewOff:
        "Los repasos de este tema están pausados. Las tarjetas siguen guardadas — reactiva cuando quieras volver a recibir avisos.",
      reactivated: "Repasos reactivados",
      paused: "Repasos pausados — ya no recibirás avisos de este tema",
      emptyTitle: "Añade la primera tarjeta",
      emptyHint: "Puedes dictar pregunta y respuesta por voz.",
      reviewToday: "Repasar hoy",
      reviewOn: (d: string) => `Repasar el ${d}`,
      reviewsCount: (n: number) => `${n} repasos`,
      confirmRemoveCard: "¿Eliminar la tarjeta?",
      removed: "Eliminada",
      subtopics: "Subtemas",
      newSubtopic: "Nuevo subtema",
      createSubtopic: "Crear subtema",
      subtopicName: "Nombre del subtema",
      subtopicNamePh: "Ej: Tutela de urgencia",
      subtopicCreated: "Subtema creado",
      emptySubtopics: "Aún no hay subtemas. Crea uno para organizar en más niveles.",
      backToParent: "Volver al tema padre",
      confirmRemoveTopic: "¿Eliminar este tema y todos los subtemas/tarjetas?",
      topicRemoved: "Tema eliminado",
      removeTopic: "Eliminar tema",
      clearAnswer: "Limpiar respuesta",
      confirmClearAnswer: "¿Estás seguro de que deseas borrar la respuesta actual?",
      answerCleared: "Respuesta borrada",
    },
    study: {
      exit: "Salir",
      allDone: "¡Todo al día!",
      reviewedCount: (n: number) => `Repasaste ${n} tarjeta(s).`,
      nothingToday: "Nada programado para hoy.",
      howWas: "¿Qué tal el recuerdo?",
      completed: "¡Repaso completado! 🎉",
      errorRecord: "Error al registrar",
      cardFront: "Pregunta",
      cardBack: "Respuesta",
      cardFrontHint: "Toca para ver la respuesta",
      cardBackHint: "Toca para volver",
      q: {
        forgot: { label: "Fallé", hint: "Fallo — reaparece mañana y reinicia la racha." },
        hard: { label: "Difícil", hint: "Acertaste con esfuerzo — intervalo corto." },
        good: { label: "Recordé", hint: "Recordaste sin esfuerzo — progresión estándar." },
        easy: { label: "Muy fácil", hint: "Acertaste con holgura — intervalo mayor." },
      },
    },
    settings: {
      title: "Ajustes",
      subtitle: "Notificaciones y preferencias",
      language: "Idioma",
      languageHint: "Elige el idioma de la interfaz.",
      theme: "Tema",
      themeLabel: "Elige el tema de la aplicación.",
      browserNotif: "Notificaciones del navegador",
      browserNotifDesc:
        "Recibe una alerta cuando haya tarjetas para repasar (funciona incluso con la pestaña en segundo plano).",
      active: "Activas",
      blocked: "Bloqueadas por el navegador. Actívalas en los permisos del sitio.",
      unsupported: "No compatibles con este navegador.",
      enable: "Activar notificaciones",
      permDenied: "Permiso denegado",
      panelTitle: 'Panel "Para repasar hoy"',
      panelHint: "Muestra el conteo en la pantalla de inicio",
      telegramTitle: "Recordatorios por Telegram",
      telegramDesc:
        "Recibe mensajes automáticos en Telegram cuando haya temas para repasar. Cómo configurar:",
      tgStep1: "Abre Telegram y busca",
      tgStep2: "y copia el número de tu ID",
      tgStep3: "Pégalo abajo y guarda",
      tgStep4a: "Luego busca el bot que creaste en",
      tgStep4b: "para autorizarlo a enviarte mensajes",
      tgSend: "Envía",
      tgAndCopy: "y copia el número de tu ID",
      tgLabel: "Tu chat ID de Telegram",
      tgPh: "Ej: 123456789",
      sendTest: "Enviar prueba",
      testSent: "¡Mensaje enviado! Revisa tu Telegram.",
      testFail: "Fallo al enviar",
      saved: "Guardado",
      saveChanges: "Guardar cambios",
      footer:
        "Los recordatorios automáticos por Telegram se enviarán todos los días a las 8h (hora del servidor) para los temas que estén en plazo de repaso.",
    },
    voice: {
      recording: "Grabando… toca el cuadrado para detener.",
      transcribing: "Transcribiendo…",
      startAria: "Dictar por voz",
      stopAria: "Detener grabación",
      tooShort: "Grabación demasiado corta — intenta hablar más tiempo.",
      cantUnderstand: "No pude entender el audio. Inténtalo de nuevo.",
      transcribeErr: "Error al transcribir",
      micError: "No se pudo acceder al micrófono. Revisa los permisos.",
    },
    notes: {
      title: "Notas",
      new: "Nueva",
      empty: "Todavía no hay notas.",
      selectOrCreate: "Selecciona o crea una nota",
      hint: "Tus notas se guardan de forma segura en tu cuenta.",
      untitled: "Sin título",
      titlePh: "Título de la nota",
      saved: "Guardado",
      savedAt: "Guardado a las",
      unsaved: "Cambios sin guardar…",
      removed: "Nota eliminada",
      confirmRemove: "¿Eliminar esta nota?",
      categories: "Categorías",
      allNotes: "Todas las notas",
      uncategorized: "Sin categoría",
      newCategory: "Nueva categoría",
      newSubcategory: "Nueva subcategoría",
      categoryName: "Nombre de la categoría",
      categoryNamePh: "Ej: Derecho Constitucional",
      subcategoryOf: (parent: string) => `Subcategoría de ${parent}`,
      rootCategoryOption: "— Categoría principal (sin padre) —",
      manageCategories: "Administrar categorías",
      confirmRemoveCategory:
        "¿Eliminar esta categoría y sus subcategorías? Las notas quedarán sin categoría.",
      categoryRemoved: "Categoría eliminada",
      categoryCreated: "Categoría creada",
      categoryRenamed: "Categoría renombrada",
      renameCategoryPrompt: "Nuevo nombre de la categoría:",
      rename: "Renombrar",
      moveToCategory: "Categoría",
      noCategory: "Sin categoría",
    },
    flashLink: {
      linkAnswer: "Vincular respuesta a una nota",
      linkedTo: "Vinculado a",
      viewNote: "Ver nota",
      none: "Ninguna",
      pickNote: "Elegir nota…",
      editCard: "Editar tarjeta",
      cardUpdated: "Tarjeta actualizada",
    },
    flashcardsList: {
      label: "Todas las tarjetas",
      title: "Tarjetas",
      countInfo: (n: number) => `${n} tarjeta(s)`,
      subject: "Materia",
      topic: "Tema",
      allTopics: "Todos los temas",
      searchLabel: "Buscar",
      searchPh: "Pregunta o respuesta…",
      rowsPerPage: "Filas por página",
      pageOf: (p: number, tot: number) => `Página ${p} de ${tot}`,
      prev: "Anterior",
      next: "Siguiente",
      exportExcel: "Excel",
      exportPdf: "PDF",
      emptyTitle: "No se encontraron tarjetas",
      emptyHint: "Ajusta los filtros o crea nuevas tarjetas.",
      noAnswer: "(sin respuesta)",
      colSubject: "Materia",
      colTopic: "Tema",
      colQuestion: "Pregunta",
      colAnswer: "Respuesta",
      colDue: "Repasar el",
      colReps: "Repasos",
    },
  },
  en: {
    langName: "English",
    common: {
      loading: "Loading…",
      save: "Save",
      saving: "Saving…",
      cancel: "Cancel",
      create: "Create",
      remove: "Delete",
      back: "Back",
      backHome: "Back home",
      language: "Language",
      or: "OR",
      error: "Error",
      notAuth: "Not authenticated",
    },
    nav: {
      home: "Home",
      settings: "Settings",
      signOut: "Sign out",
      bulk: "Create flashcards",
      reports: "Report",
    },
    pomodoro: {
      label: "Pomodoro",
      work: "Study session",
      break: "Break",
      start: "Start",
      pause: "Pause",
      reset: "Reset",
      studyMin: "Study (min)",
      breakMin: "Break (min)",
      toastBreakTitle: "⏸ Study break",
      toastBreakDesc: (m: number) => `Rest ${m} min. The timer already started.`,
      toastWorkTitle: "📚 Time to get back to studying!",
      toastWorkDesc: (m: number) => `New ${m} min session started.`,
    },
    reports: {
      title: "Review report",
      subtitle: "Current status of every flashcard and the full history of reviews.",
      metaTitle: "Review report · FlashPilot",
      metaDesc: "Track the current status and full review history of your flashcards.",
      searchPh: "Search question",
      allSubjects: "All subjects",
      allSubjectsGlobal: "All subjects (global)",
      tabCurrent: "Current status",
      tabHistory: "History",
      colFlashcard: "Flashcard",
      colSubjectTopic: "Subject / Topic",
      colLastReview: "Last review",
      colClassification: "Classification",
      colNextReview: "Next review",
      colReviewsDone: "Reviews done",
      colReviewDate: "Review date",
      colPrevDue: "Previous due",
      colInterval: "Interval",
      empty: "No flashcards found.",
      emptyHistory: "No reviews recorded yet.",
      reviewOne: "review",
      reviewMany: "reviews",
      qForgot: "Missed",
      qHard: "Hard",
      qGood: "Remembered",
      qEasy: "Very easy",
      reviewedAll: "Reviewed: all",
      reviewedOnly: "Reviewed only",
      notReviewedOnly: "Not reviewed only",
      reviewed: "Reviewed",
      yes: "Yes",
      no: "No",
    },
    chart: {
      title: "Performance evolution",
      subtitle: "% correct per day (grade ≥ Hard). Thick line = 7-day moving average.",
      periodAccuracy: "Accuracy in period",
      rangeAll: "All",
      dayShort: "d",
      revShort: "rev.",
      empty: "No reviews in this period yet.",
      reviews: "Reviews",
      dailyAccuracy: "Daily accuracy",
      ma7: "7d average",
    },
    subjectPage: {
      renameSubject: "Rename subject",
      deleteSubject: "Delete subject",
      renameTopic: "Rename topic",
      deleteTopic: "Delete topic",
      searchPh: "Search topics or flashcards in this subject…",
      reviewSubject: "Review subject",
      renamePrompt: "New name:",
      nameUpdated: "Name updated",
      topicUpdated: "Topic updated",
      nothingFound: (q: string) => `Nothing found for "${q}".`,
    },
    errors: {
      notFoundTitle: "404",
      notFoundBody: "Page not found.",
      somethingWrong: "Something went wrong",
      retryHint: "Try again or go back home.",
      retry: "Retry",
      home: "Home",
    },
    auth: {
      tagline: "Flashcards with spaced repetition and voice dictation",
      signIn: "Sign in",
      signUp: "Sign up",
      email: "Email",
      password: "Password",
      emailPh: "you@example.com",
      passwordPh: "At least 6 characters",
      loading: "Loading…",
      google: "Continue with Google",
      googleError: "Could not sign in with Google",
      microsoft: "Continue with Microsoft",
      microsoftError: "Could not sign in with Microsoft",
      apple: "Continue with Apple",
      appleError: "Could not sign in with Apple",
      authError: "Authentication error",
      accountCreated: "Account created! You can sign in now.",
    },
    home: {
      hello: "Hi — time to study",
      title: "My subjects",
      subjects: "Subjects",
      newSubject: "New subject",
      createSubject: "Create subject",
      subjectName: "Subject name",
      subjectNamePh: "e.g. Constitutional Law",
      color: "Color",
      emptyTitle: "Start with your first subject",
      emptyHint: "You can dictate the name with your microphone.",
      created: "Subject created",
      topicsOne: "topic",
      topicsMany: "topics",
      subtopicsOne: "subtopic",
      subtopicsMany: "subtopics",
      reviewTag: "Forgetting curve",
      reviewNone: "Nothing to review today",
      reviewSome: (n: number) => `${n} to review today`,
      reviewNoneHint: "Come back tomorrow or create new flashcards now.",
      reviewSomeHint: "",
      start: "Start review",
      reviewNow: "Review now",
      activeSessions: "View active Flash Sessions",
      favorites: "Favorites",
      favoritesCount: (n: number) =>
        `${n} ${n === 1 ? "marked card" : "marked cards"} for focused review`,
      reviewFavorites: "Review",
      missingAnswerTitle: "Missing answers",
      missingAnswerEmpty: "No flashcards missing answers.",
      missingAnswerCount: (n: number) => `${n} missing answer(s)`,
      notifTitle: "Enable browser notifications",
      notifBody: "We'll alert you when you have flashcards to review.",
      enable: "Enable",
      later: "Later",
      notifEnabled: "Notifications enabled",
      notifHead: "FlashPilot — time to review",
      notifText: (n: number) => `You have ${n} flashcard(s) to review today.`,
    },
    subject: {
      all: "All subjects",
      label: "Subject",
      topics: "Topics",
      newTopic: "New topic",
      createTopic: "Create topic",
      topicName: "Topic name",
      topicNamePh: "e.g. Fundamental principles",
      articleRange: "Articles (optional)",
      articleRangePh: "e.g. arts. 15 to 29",
      language: "Language (optional)",
      languageNone: "No language set",
      languageHint: "Use only for language subjects. With no language, nothing changes.",
      cardLanguage: "Card language (optional)",
      cardLanguageInherit: "Inherit from subject",
      setLanguage: "Set language",
      editTopic: "Edit",
      emptyTitle: "Add your first topic",
      emptyHint: "Inside a topic you'll create the flashcards.",
      created: "Topic created",
      confirmRemove: "Delete subject and all topics/flashcards?",
      removed: "Subject deleted",
      cardsOne: "flashcard",
      cardsMany: "flashcards",
      subtopicOne: "subtopic",
      subtopicMany: "subtopics",
      subitemOne: "subitem",
      subitemMany: "subitems",
    },
    topic: {
      label: "Topic",
      cardsInfo: (n: number, due: number) => `${n} flashcards · ${due} to review today`,
      review: (n: number) => `Review (${n})`,
      reviewNow: "Review now",
      newCard: "Flashcard",
      createCard: "New flashcard",
      question: "Question",
      answer: "Answer",
      questionPh: "Write or dictate the question…",
      answerPh: "Write or dictate the answer…",
      created: "Flashcard created",
      autoReview: "Automatic reviews",
      autoReviewOn:
        "This topic will reappear at least once a week. Turn it off once you've memorized it long-term.",
      autoReviewOff:
        "Reviews for this topic are paused. The flashcards are still saved — reactivate whenever you want reminders again.",
      reactivated: "Reviews reactivated",
      paused: "Reviews paused — you won't get more reminders for this topic",
      emptyTitle: "Add your first flashcard",
      emptyHint: "You can dictate question and answer by voice.",
      reviewToday: "Review today",
      reviewOn: (d: string) => `Review on ${d}`,
      reviewsCount: (n: number) => `${n} reviews`,
      confirmRemoveCard: "Delete flashcard?",
      removed: "Deleted",
      subtopics: "Subtopics",
      newSubtopic: "New subtopic",
      createSubtopic: "Create subtopic",
      subtopicName: "Subtopic name",
      subtopicNamePh: "e.g. Urgent injunctions",
      subtopicCreated: "Subtopic created",
      emptySubtopics: "No subtopics yet. Create one to organize into more levels.",
      backToParent: "Back to parent topic",
      confirmRemoveTopic: "Delete this topic and all subtopics/flashcards?",
      topicRemoved: "Topic deleted",
      removeTopic: "Delete topic",
      clearAnswer: "Clear answer",
      confirmClearAnswer: "Are you sure you want to delete the current answer?",
      answerCleared: "Answer cleared",
    },
    study: {
      exit: "Exit",
      allDone: "All caught up!",
      reviewedCount: (n: number) => `You reviewed ${n} flashcard(s).`,
      nothingToday: "Nothing scheduled for today.",
      howWas: "How well did you remember?",
      completed: "Review complete! 🎉",
      errorRecord: "Error saving",
      cardFront: "Question",
      cardBack: "Answer",
      cardFrontHint: "Tap to see the answer",
      cardBackHint: "Tap to go back",
      q: {
        forgot: { label: "Missed", hint: "Wrong — reappears tomorrow and resets the streak." },
        hard: { label: "Hard", hint: "Right with effort — short interval, ease drops." },
        good: { label: "Remembered", hint: "You remembered — standard interval progression." },
        easy: { label: "Very easy", hint: "Right easily — longer interval, ease rises." },
      },
    },
    settings: {
      title: "Settings",
      subtitle: "Notifications and preferences",
      language: "Language",
      languageHint: "Choose your interface language.",
      theme: "Theme",
      themeLabel: "Choose your app theme.",
      browserNotif: "Browser notifications",
      browserNotifDesc:
        "Get an alert when there are flashcards to review (works even with the tab in the background).",
      active: "Active",
      blocked: "Blocked by the browser. Enable them in the site permissions.",
      unsupported: "Not supported in this browser.",
      enable: "Enable notifications",
      permDenied: "Permission denied",
      panelTitle: '"To review today" panel',
      panelHint: "Shows the count on the home screen",
      telegramTitle: "Telegram reminders",
      telegramDesc:
        "Get automatic Telegram messages when you have topics to review. How to set it up:",
      tgStep1: "Open Telegram and search for",
      tgStep2: "and copy your ID number",
      tgStep3: "Paste below and save",
      tgStep4a: "Then find the bot you created via",
      tgStep4b: "to authorize it to send you messages",
      tgSend: "Send",
      tgAndCopy: "and copy your ID number",
      tgLabel: "Your Telegram chat ID",
      tgPh: "e.g. 123456789",
      sendTest: "Send test",
      testSent: "Message sent! Check your Telegram.",
      testFail: "Failed to send",
      saved: "Saved",
      saveChanges: "Save changes",
      footer:
        "Automatic Telegram reminders are sent every day at 8am (server time) for topics that are due for review.",
    },
    voice: {
      recording: "Recording… tap the square to stop.",
      transcribing: "Transcribing…",
      startAria: "Dictate by voice",
      stopAria: "Stop recording",
      tooShort: "Recording too short — try speaking longer.",
      cantUnderstand: "Couldn't understand the audio. Please try again.",
      transcribeErr: "Transcription error",
      micError: "Could not access the microphone. Check permissions.",
    },
    notes: {
      title: "Notes",
      new: "New",
      empty: "No notes yet.",
      selectOrCreate: "Select or create a note",
      hint: "Your notes are saved securely in your account.",
      untitled: "Untitled",
      titlePh: "Note title",
      saved: "Saved",
      savedAt: "Saved at",
      unsaved: "Unsaved changes…",
      removed: "Note deleted",
      confirmRemove: "Delete this note?",
      categories: "Categories",
      allNotes: "All notes",
      uncategorized: "Uncategorized",
      newCategory: "New category",
      newSubcategory: "New subcategory",
      categoryName: "Category name",
      categoryNamePh: "e.g. Constitutional Law",
      subcategoryOf: (parent: string) => `Subcategory of ${parent}`,
      rootCategoryOption: "— Top-level category (no parent) —",
      manageCategories: "Manage categories",
      confirmRemoveCategory:
        "Remove this category and its subcategories? Notes will become uncategorized.",
      categoryRemoved: "Category removed",
      categoryCreated: "Category created",
      categoryRenamed: "Category renamed",
      renameCategoryPrompt: "New category name:",
      rename: "Rename",
      moveToCategory: "Category",
      noCategory: "No category",
    },
    flashLink: {
      linkAnswer: "Link answer to a note",
      linkedTo: "Linked to",
      viewNote: "View note",
      none: "None",
      pickNote: "Pick a note…",
      editCard: "Edit flashcard",
      cardUpdated: "Flashcard updated",
    },
    flashcardsList: {
      label: "All flashcards",
      title: "Flashcards",
      countInfo: (n: number) => `${n} flashcard(s)`,
      subject: "Subject",
      topic: "Topic",
      allTopics: "All topics",
      searchLabel: "Search",
      searchPh: "Question or answer…",
      rowsPerPage: "Rows per page",
      pageOf: (p: number, tot: number) => `Page ${p} of ${tot}`,
      prev: "Previous",
      next: "Next",
      exportExcel: "Excel",
      exportPdf: "PDF",
      emptyTitle: "No flashcards found",
      emptyHint: "Adjust filters or create new flashcards.",
      noAnswer: "(no answer)",
      colSubject: "Subject",
      colTopic: "Topic",
      colQuestion: "Question",
      colAnswer: "Answer",
      colDue: "Review on",
      colReps: "Reviews",
    },
  },
} as const;

export type Dict = typeof dict.pt &
  ExtraDict &
  CommerceDict &
  ProfileDict & { homeHub: HomeHubTexts };

/** Dicionários completos: os 3 originais + os novos idiomas por overlay + textos extra. */
const BASE_DICTS: Record<Lang, unknown> = {
  pt: dict.pt,
  es: dict.es,
  en: dict.en,
  "pt-PT": deepMergeDict(dict.pt, ptPTOverlay),
  fr: deepMergeDict(dict.en, frOverlay),
  it: deepMergeDict(dict.en, itOverlay),
  de: deepMergeDict(dict.en, deOverlay),
};

const build = (l: Lang): Dict =>
  deepMergeDict(
    deepMergeDict(
      deepMergeDict(deepMergeDict(BASE_DICTS[l], EXTRA_DICTS[l]), COMMERCE_DICTS[l]),
      PROFILE_DICTS[l],
    ),
    HOME_HUB_DICTS[l],
  ) as Dict;

export const DICTS: Record<Lang, Dict> = {
  pt: build("pt"),
  es: build("es"),
  en: build("en"),
  "pt-PT": build("pt-PT"),
  fr: build("fr"),
  it: build("it"),
  de: build("de"),
};

const LangCtx = createContext<{
  lang: Lang;
  setLang: (l: Lang, keepExt?: boolean) => void;
  applyAccountLang: (l: Lang) => void;
  t: Dict;
  locale: Locale;
  extLang: string | null;
  setExtLang: (code: string) => void;
  overlayD: Record<string, string> | null;
}>({
  lang: "pt",
  extLang: null,
  overlayD: null,
  setExtLang: () => {},
  setLang: () => {},
  applyAccountLang: () => {},
  t: DICTS.pt,
  locale: ptBR,
});

const LOCALES: Record<Lang, Locale> = { pt: ptBR, es, en: enUS, "pt-PT": pt, fr, it, de };

const HTML_LANG: Record<Lang, string> = {
  pt: "pt-BR",
  "pt-PT": "pt-PT",
  es: "es",
  en: "en",
  fr: "fr",
  it: "it",
  de: "de",
};

/** Marca no aparelho que a pessoa escolheu o idioma manualmente. */
const MANUAL_KEY = "app-lang-manual";

export function detectLang(): Lang {
  return detectAppLocale().lang;
}

export function detectAppLocale(): AppLocale {
  if (typeof window === "undefined") return { lang: FALLBACK_LANG, extLang: null };
  let manualLocale: AppLocale | null = null;
  try {
    manualLocale = resolveManualAppLocale(
      window.localStorage.getItem(MANUAL_KEY) === "1",
      window.localStorage.getItem(STORAGE_KEY),
      window.localStorage.getItem(EXT_LANG_KEY),
    );
  } catch {
    /* modo privado pode bloquear */
  }
  if (manualLocale) return manualLocale;

  const tags = [
    ...(Array.isArray(window.navigator.languages) ? window.navigator.languages : []),
    window.navigator.language ?? "",
  ].filter(Boolean);
  return matchAppLocale(tags);
}

function persistLang(l: Lang, manual = false) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, l);
    if (manual) window.localStorage.setItem(MANUAL_KEY, "1");
  } catch {
    /* modo privado pode bloquear */
  }
  if (typeof document !== "undefined") {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = manual
      ? `${LANG_MANUAL_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`
      : `${LANG_MANUAL_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function LanguageProvider({
  children,
  initialLang,
  initialExtLang,
}: {
  children: ReactNode;
  initialLang?: Lang;
  initialExtLang?: string | null;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? FALLBACK_LANG);
  const [extLang, setExtLangState] = useState<string | null>(initialExtLang ?? null);
  const [overlay, setOverlay] = useState<ExtOverlay | null>(null);

  useEffect(() => {
    if (!extLang) {
      setOverlay(null);
      return;
    }
    let alive = true;
    void loadExtOverlay(extLang).then((o) => {
      if (alive) setOverlay(o);
    });
    return () => {
      alive = false;
    };
  }, [extLang]);

  /** Idioma extra (japonês, árabe…): base em inglês + traduções carregadas sob demanda. */
  const setExtLang = (code: string) => {
    if (!isExtLang(code)) throw new Error(`Unsupported app language: ${code}`);
    try {
      window.localStorage.setItem(EXT_LANG_KEY, code);
    } catch {
      /* ignore */
    }
    document.cookie = `${EXT_LANG_COOKIE}=${code}; path=/; max-age=31536000; SameSite=Lax`;
    setExtLangState(code);
    setLang("en", true);
  };

  useEffect(() => {
    // O servidor já resolveu o idioma (cookie/Accept-Language). Aqui apenas
    // honramos uma escolha manual salva no aparelho e gravamos o cookie na 1ª visita.
    let manual = false;
    try {
      manual = window.localStorage.getItem(MANUAL_KEY) === "1";
    } catch {
      /* modo privado pode bloquear */
    }
    const requested =
      window.location.pathname === "/"
        ? new URLSearchParams(window.location.search).get("lang")
        : null;
    const clientLocale: AppLocale = isLang(requested)
      ? { lang: requested, extLang: null }
      : isExtLang(requested)
        ? { lang: "en", extLang: requested }
        : detectAppLocale();
    if (clientLocale.lang !== lang) setLangState(clientLocale.lang);
    if (clientLocale.extLang !== extLang) setExtLangState(clientLocale.extLang);
    persistLang(clientLocale.lang, manual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const info = extLang ? APP_EXT_LANGS.find((l) => l.code === extLang) : undefined;
      document.documentElement.lang = info?.code ?? HTML_LANG[lang] ?? "en";
      document.documentElement.dir = info?.dir === "rtl" ? "rtl" : "ltr";
    }
  }, [lang, extLang, overlay]);

  /** Escolha explícita no menu: vale no aparelho e é salva no perfil. */
  const setLang = (l: Lang, keepExt = false) => {
    if (!keepExt) {
      try {
        window.localStorage.removeItem(EXT_LANG_KEY);
      } catch {
        /* ignore */
      }
      document.cookie = `${EXT_LANG_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
      setExtLangState(null);
    }
    setLangState(l);
    persistLang(l, true);
    // Escolha feita pela própria pessoa no seletor (o blog respeita só esta).
    try {
      window.localStorage.setItem("app-lang-picked", "1");
    } catch {
      /* ignore */
    }
    document.cookie = `fp_lang_picked=1; path=/; max-age=31536000; SameSite=Lax`;
    void (async () => {
      try {
        const { updateMyProfile } = await import("@/lib/profile.functions");
        await updateMyProfile({ data: { uiLang: l } } as any);
      } catch {
        /* visitante sem sessão: só vale no aparelho */
      }
    })();
  };

  /** Idioma que veio do perfil da conta: aplica sem regravar no servidor. */
  const applyAccountLang = (l: Lang) => {
    setLangState(l);
    persistLang(l, true);
  };

  setUiLang(lang);
  const activeOverlay = extLang && lang === "en" ? overlay : null;
  setUiOverlay(activeOverlay?.u ?? null);
  const t = useMemo(
    () => (activeOverlay ? applyDictOverlay(DICTS.en, activeOverlay.d) : (DICTS[lang] ?? DICTS.pt)),
    [activeOverlay, lang],
  );

  return (
    <LangCtx.Provider
      value={{
        lang,
        setLang,
        applyAccountLang,
        t,
        locale: LOCALES[lang] ?? ptBR,
        extLang: activeOverlay ? extLang : null,
        setExtLang,
        overlayD: activeOverlay?.d ?? null,
      }}
    >
      <Fragment key={`${lang}-${activeOverlay ? extLang : ""}`}>{children}</Fragment>
    </LangCtx.Provider>
  );
}

export function useT() {
  return useContext(LangCtx).t;
}

export function useLang() {
  const { lang, setLang, applyAccountLang, locale, extLang, setExtLang } = useContext(LangCtx);
  return { lang, setLang: (l: Lang) => setLang(l), applyAccountLang, locale, extLang, setExtLang };
}

/** Mapa de traduções do idioma extra ativo (null nos 7 idiomas nativos). */
export function useOverlayD(): Record<string, string> | null {
  return useContext(LangCtx).overlayD;
}

export const LANG_OPTIONS: { value: Lang; label: string; flag: string }[] = [
  { value: "pt", label: "Português (Brasil)", flag: "🇧🇷" },
  { value: "pt-PT", label: "Português (Portugal)", flag: "🇵🇹" },
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "it", label: "Italiano", flag: "🇮🇹" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
];
