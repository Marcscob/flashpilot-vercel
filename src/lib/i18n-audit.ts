import { useLang, useOverlayD, type Lang } from "./i18n";
import { applyDictOverlay } from "./app-ext-langs";

/**
 * Traduções dos elementos apontados na auditoria manual (PDF).
 * Base pt-BR; cada idioma sobrescreve as chaves.
 */
export type AuditCopy = {
  common: {
    cancel: string; save: string; saving: string; delete: string; edit: string;
    loading: string; rename: string; create: string; remove: string; none: string;
    uncategorized: string; categories: string; new: string; download: string;
    error: string; search: string;
  };
  nb: {
    title: string; subtitle: string; create: string; empty: string; createFirst: string;
    cardsOf: (a: number, b: number) => string; lastStudied: (d: string) => string;
    continue: string; reset: string; tipBefore: string; tipLink: string; tipAfter: string;
    editTitle: string; newTitle: string; name: string; namePlaceholder: string;
    mode: string; modeAll: string; modeDue: string; modeFav: string;
    order: string; orderAlpha: string; orderShuffle: string;
    content: string; contentHint: string;
    resetTitle: string; resetDesc: string; resetOnlySession: string; resetSchedule: string;
    deleteTitle: string; deleteDesc: string;
    openFail: string; nameRequired: string; updated: string; created: string;
    saveFail: string; deleted: string; deleteFail: string;
    progressReset: string; scheduleReset: string; resetFail: string;
  };
  mm: {
    title: string; searchPlaceholder: string; empty: string;
    renameTitle: string; deleteTitle: string; deleteDesc: string;
    download: string; rename: string; delete: string;
  };
  chat: {
    voiceOn: string; voiceOff: string; voiceOnHint: string; voiceOffHint: string;
    noSubject: string; convLanguage: string; defaultLanguage: string; languageHint: string;
    cardTopic: string; deleteChat: string; messagePlaceholder: string;
  };
};

const pt: AuditCopy = {
  common: {
    cancel: "Cancelar", save: "Salvar", saving: "Salvando…", delete: "Excluir", edit: "Editar",
    loading: "Carregando…", rename: "Renomear", create: "Criar", remove: "Remover", none: "Nenhum",
    uncategorized: "Sem categoria", categories: "Categorias", new: "Nova", download: "Baixar imagem",
    error: "Erro", search: "Buscar",
  },
  nb: {
    title: "Flash Session",
    subtitle: "Monte uma seleção de matérias e assuntos e retome a revisão em qualquer aparelho.",
    create: "Nova Flash Session",
    empty: "Você ainda não tem Flash Session.",
    createFirst: "Criar a primeira Flash Session",
    cardsOf: (a, b) => `${a} de ${b} cards`,
    lastStudied: (d) => ` · último estudo em ${d}`,
    continue: "Continuar", reset: "Zerar",
    tipBefore: "Dica: na tela de ", tipLink: "Flashcards",
    tipAfter: " você pode selecionar cards e adicioná-los a uma Flash Session já existente.",
    editTitle: "Editar Flash Session", newTitle: "Nova Flash Session",
    name: "Nome", namePlaceholder: "ex.: Reta final TJ",
    mode: "Modo", modeAll: "Todos os cards", modeDue: "Só os vencidos hoje", modeFav: "Só favoritos",
    order: "Ordem", orderAlpha: "A–Z (assunto)", orderShuffle: "Embaralhado",
    content: "Conteúdo da Flash Session",
    contentHint: "Marcar a matéria inclui todos os assuntos e subtópicos dela.",
    resetTitle: "Zerar esta Flash Session",
    resetDesc: "“Só a sessão” volta ao primeiro card e limpa a contagem de revisados, sem mexer no agendamento. “Agendamento dos cards” faz todos os cards da Flash Session vencerem hoje e apaga o histórico deles.",
    resetOnlySession: "Só a sessão", resetSchedule: "Agendamento dos cards",
    deleteTitle: "Excluir Flash Session?",
    deleteDesc: "A Flash Session e o progresso dela são apagados. Os flashcards continuam existindo normalmente.",
    openFail: "Falha ao abrir a Flash Session", nameRequired: "Dê um nome à Flash Session",
    updated: "Flash Session atualizada", created: "Flash Session criada", saveFail: "Falha ao salvar",
    deleted: "Flash Session excluída", deleteFail: "Falha ao excluir",
    progressReset: "Progresso da Flash Session zerado",
    scheduleReset: "Agendamento dos cards da Flash Session zerado", resetFail: "Falha ao zerar",
  },
  mm: {
    title: "Mapas mentais",
    searchPlaceholder: "Buscar por título, categoria ou data",
    empty: "Nenhum mapa mental ainda. Gere um a partir de uma anotação ou de flashcards selecionados.",
    renameTitle: "Renomear mapa mental", deleteTitle: "Excluir este mapa mental?",
    deleteDesc: "A imagem será apagada definitivamente.",
    download: "Baixar imagem", rename: "Renomear", delete: "Excluir",
  },
  chat: {
    voiceOn: "Voz ligada", voiceOff: "Voz desligada",
    voiceOnHint: "Silenciar a leitura automática das respostas",
    voiceOffHint: "Ativar a leitura automática das respostas",
    noSubject: "Sem matéria", convLanguage: "Idioma da conversa",
    defaultLanguage: "Português (Brasil)", languageHint: "O PilotAI responde no idioma escolhido.",
    cardTopic: "Assunto do flashcard", deleteChat: "Excluir conversa",
    messagePlaceholder: "Escreva sua mensagem…",
  },
};

const ptPT: AuditCopy = {
  ...pt,
  common: { ...pt.common, delete: "Eliminar", loading: "A carregar…", saving: "A guardar…", save: "Guardar", search: "Procurar", download: "Descarregar imagem" },
  nb: {
    ...pt.nb,
    subtitle: "Monte uma selecção de disciplinas e temas e retome a revisão em qualquer dispositivo.",
    empty: "Ainda não tem nenhuma Flash Session.",
    cardsOf: (a, b) => `${a} de ${b} cartões`,
    lastStudied: (d) => ` · último estudo em ${d}`,
    reset: "Reiniciar",
    tipBefore: "Dica: no ecrã de ",
    tipAfter: " pode selecionar cartões e adicioná-los a uma Flash Session existente.",
    namePlaceholder: "ex.: Reta final",
    modeAll: "Todos os cartões", modeDue: "Apenas os vencidos hoje", modeFav: "Apenas favoritos",
    order: "Ordenação", orderAlpha: "A–Z (tema)", orderShuffle: "Aleatório",
    contentHint: "Marcar a disciplina inclui todos os temas e subtemas.",
    resetTitle: "Reiniciar esta Flash Session",
    resetDesc: "“Apenas a sessão” volta ao primeiro cartão e limpa a contagem de revistos, sem alterar o agendamento. “Agendamento dos cartões” faz todos os cartões vencerem hoje e apaga o histórico.",
    resetOnlySession: "Apenas a sessão", resetSchedule: "Agendamento dos cartões",
    deleteTitle: "Eliminar Flash Session?",
    deleteDesc: "A Flash Session e o respetivo progresso são eliminados. Os cartões continuam a existir.",
    openFail: "Falha ao abrir a Flash Session", nameRequired: "Indique um nome para a Flash Session",
    updated: "Flash Session atualizada", created: "Flash Session criada", saveFail: "Falha ao guardar",
    deleted: "Flash Session eliminada", deleteFail: "Falha ao eliminar",
    progressReset: "Progresso da Flash Session reiniciado",
    scheduleReset: "Agendamento dos cartões reiniciado", resetFail: "Falha ao reiniciar",
  },
  mm: {
    ...pt.mm,
    searchPlaceholder: "Procurar por título, categoria ou data",
    empty: "Ainda não existe nenhum mapa mental. Gere um a partir de uma nota ou de cartões selecionados.",
    deleteTitle: "Eliminar este mapa mental?", deleteDesc: "A imagem será eliminada definitivamente.",
    download: "Descarregar imagem", delete: "Eliminar",
  },
  chat: {
    ...pt.chat,
    noSubject: "Sem disciplina", convLanguage: "Idioma da conversa",
    defaultLanguage: "Português (Portugal)", languageHint: "O PilotAI responde no idioma escolhido.",
    cardTopic: "Tema do cartão", deleteChat: "Eliminar conversa",
    messagePlaceholder: "Escreva a sua mensagem…",
  },
};

const en: AuditCopy = {
  common: {
    cancel: "Cancel", save: "Save", saving: "Saving…", delete: "Delete", edit: "Edit",
    loading: "Loading…", rename: "Rename", create: "Create", remove: "Remove", none: "None",
    uncategorized: "No category", categories: "Categories", new: "New", download: "Download image",
    error: "Error", search: "Search",
  },
  nb: {
    title: "Flash Session",
    subtitle: "Pick subjects and topics and resume your review on any device.",
    create: "New Flash Session",
    empty: "You don't have a Flash Session yet.",
    createFirst: "Create your first Flash Session",
    cardsOf: (a, b) => `${a} of ${b} cards`,
    lastStudied: (d) => ` · last studied on ${d}`,
    continue: "Continue", reset: "Reset",
    tipBefore: "Tip: on the ", tipLink: "Flashcards",
    tipAfter: " screen you can select cards and add them to an existing Flash Session.",
    editTitle: "Edit Flash Session", newTitle: "New Flash Session",
    name: "Name", namePlaceholder: "e.g. Final sprint",
    mode: "Mode", modeAll: "All cards", modeDue: "Only due today", modeFav: "Favorites only",
    order: "Order", orderAlpha: "A–Z (topic)", orderShuffle: "Shuffled",
    content: "Flash Session content",
    contentHint: "Selecting a subject includes all of its topics and subtopics.",
    resetTitle: "Reset this Flash Session",
    resetDesc: "“Session only” returns to the first card and clears the reviewed count without touching scheduling. “Card scheduling” makes every card in the Flash Session due today and erases their history.",
    resetOnlySession: "Session only", resetSchedule: "Card scheduling",
    deleteTitle: "Delete Flash Session?",
    deleteDesc: "The Flash Session and its progress are deleted. Your flashcards remain untouched.",
    openFail: "Could not open the Flash Session", nameRequired: "Give the Flash Session a name",
    updated: "Flash Session updated", created: "Flash Session created", saveFail: "Could not save",
    deleted: "Flash Session deleted", deleteFail: "Could not delete",
    progressReset: "Flash Session progress reset",
    scheduleReset: "Flash Session card scheduling reset", resetFail: "Could not reset",
  },
  mm: {
    title: "Mind maps",
    searchPlaceholder: "Search by title, category or date",
    empty: "No mind maps yet. Generate one from a note or from selected flashcards.",
    renameTitle: "Rename mind map", deleteTitle: "Delete this mind map?",
    deleteDesc: "The image will be permanently deleted.",
    download: "Download image", rename: "Rename", delete: "Delete",
  },
  chat: {
    voiceOn: "Voice on", voiceOff: "Voice off",
    voiceOnHint: "Mute automatic reading of replies",
    voiceOffHint: "Enable automatic reading of replies",
    noSubject: "No subject", convLanguage: "Conversation language",
    defaultLanguage: "English", languageHint: "The PilotAI replies in the chosen language.",
    cardTopic: "Flashcard topic", deleteChat: "Delete conversation",
    messagePlaceholder: "Write your message…",
  },
};

const es: AuditCopy = {
  common: {
    cancel: "Cancelar", save: "Guardar", saving: "Guardando…", delete: "Eliminar", edit: "Editar",
    loading: "Cargando…", rename: "Renombrar", create: "Crear", remove: "Quitar", none: "Ninguno",
    uncategorized: "Sin categoría", categories: "Categorías", new: "Nueva", download: "Descargar imagen",
    error: "Error", search: "Buscar",
  },
  nb: {
    title: "Flash Session",
    subtitle: "Elige materias y temas y retoma el repaso en cualquier dispositivo.",
    create: "Nueva Flash Session",
    empty: "Todavía no tienes ninguna Flash Session.",
    createFirst: "Crear la primera Flash Session",
    cardsOf: (a, b) => `${a} de ${b} tarjetas`,
    lastStudied: (d) => ` · último estudio el ${d}`,
    continue: "Continuar", reset: "Reiniciar",
    tipBefore: "Consejo: en la pantalla de ", tipLink: "Tarjetas",
    tipAfter: " puedes seleccionar tarjetas y añadirlas a una Flash Session existente.",
    editTitle: "Editar Flash Session", newTitle: "Nueva Flash Session",
    name: "Nombre", namePlaceholder: "p. ej.: Recta final",
    mode: "Modo", modeAll: "Todas las tarjetas", modeDue: "Solo las vencidas hoy", modeFav: "Solo favoritas",
    order: "Orden", orderAlpha: "A–Z (tema)", orderShuffle: "Aleatorio",
    content: "Contenido de la Flash Session",
    contentHint: "Marcar la materia incluye todos sus temas y subtemas.",
    resetTitle: "Reiniciar esta Flash Session",
    resetDesc: "“Solo la sesión” vuelve a la primera tarjeta y borra el conteo de repasadas, sin tocar la programación. “Programación de las tarjetas” hace que todas venzan hoy y borra su historial.",
    resetOnlySession: "Solo la sesión", resetSchedule: "Programación de las tarjetas",
    deleteTitle: "¿Eliminar la Flash Session?",
    deleteDesc: "La Flash Session y su progreso se eliminan. Las tarjetas siguen existiendo.",
    openFail: "No se pudo abrir la Flash Session", nameRequired: "Ponle un nombre a la Flash Session",
    updated: "Flash Session actualizada", created: "Flash Session creada", saveFail: "No se pudo guardar",
    deleted: "Flash Session eliminada", deleteFail: "No se pudo eliminar",
    progressReset: "Progreso de la Flash Session reiniciado",
    scheduleReset: "Programación de las tarjetas reiniciada", resetFail: "No se pudo reiniciar",
  },
  mm: {
    title: "Mapas mentales",
    searchPlaceholder: "Buscar por título, categoría o fecha",
    empty: "Aún no hay mapas mentales. Genera uno a partir de una nota o de tarjetas seleccionadas.",
    renameTitle: "Renombrar mapa mental", deleteTitle: "¿Eliminar este mapa mental?",
    deleteDesc: "La imagen se eliminará definitivamente.",
    download: "Descargar imagen", rename: "Renombrar", delete: "Eliminar",
  },
  chat: {
    voiceOn: "Voz activada", voiceOff: "Voz desactivada",
    voiceOnHint: "Silenciar la lectura automática de las respuestas",
    voiceOffHint: "Activar la lectura automática de las respuestas",
    noSubject: "Sin materia", convLanguage: "Idioma de la conversación",
    defaultLanguage: "Español", languageHint: "La PilotAI responde en el idioma elegido.",
    cardTopic: "Tema de la tarjeta", deleteChat: "Eliminar conversación",
    messagePlaceholder: "Escribe tu mensaje…",
  },
};

const fr: AuditCopy = {
  common: {
    cancel: "Annuler", save: "Enregistrer", saving: "Enregistrement…", delete: "Supprimer", edit: "Modifier",
    loading: "Chargement…", rename: "Renommer", create: "Créer", remove: "Retirer", none: "Aucun",
    uncategorized: "Sans catégorie", categories: "Catégories", new: "Nouvelle", download: "Télécharger l'image",
    error: "Erreur", search: "Rechercher",
  },
  nb: {
    title: "Flash Session",
    subtitle: "Choisissez des matières et des thèmes et reprenez la révision sur n'importe quel appareil.",
    create: "Nouvelle Flash Session",
    empty: "Vous n'avez encore aucune Flash Session.",
    createFirst: "Créer la première Flash Session",
    cardsOf: (a, b) => `${a} sur ${b} cartes`,
    lastStudied: (d) => ` · dernière étude le ${d}`,
    continue: "Continuer", reset: "Réinitialiser",
    tipBefore: "Astuce : sur l'écran ", tipLink: "Cartes mémoire",
    tipAfter: " vous pouvez sélectionner des cartes et les ajouter à une Flash Session existante.",
    editTitle: "Modifier la Flash Session", newTitle: "Nouvelle Flash Session",
    name: "Nom", namePlaceholder: "ex. : Dernière ligne droite",
    mode: "Mode", modeAll: "Toutes les cartes", modeDue: "Uniquement à réviser aujourd'hui", modeFav: "Favoris uniquement",
    order: "Ordre", orderAlpha: "A–Z (thème)", orderShuffle: "Aléatoire",
    content: "Contenu de la Flash Session",
    contentHint: "Cocher la matière inclut tous ses thèmes et sous-thèmes.",
    resetTitle: "Réinitialiser cette Flash Session",
    resetDesc: "« Session uniquement » revient à la première carte et efface le compteur de cartes révisées sans toucher à la planification. « Planification des cartes » rend toutes les cartes à réviser aujourd'hui et efface leur historique.",
    resetOnlySession: "Session uniquement", resetSchedule: "Planification des cartes",
    deleteTitle: "Supprimer la Flash Session ?",
    deleteDesc: "La Flash Session et sa progression sont supprimées. Les cartes restent intactes.",
    openFail: "Impossible d'ouvrir la Flash Session", nameRequired: "Donnez un nom à la Flash Session",
    updated: "Flash Session mise à jour", created: "Flash Session créée", saveFail: "Échec de l'enregistrement",
    deleted: "Flash Session supprimée", deleteFail: "Échec de la suppression",
    progressReset: "Progression de la Flash Session réinitialisée",
    scheduleReset: "Planification des cartes réinitialisée", resetFail: "Échec de la réinitialisation",
  },
  mm: {
    title: "Cartes mentales",
    searchPlaceholder: "Rechercher par titre, catégorie ou date",
    empty: "Aucune carte mentale pour le moment. Générez-en une depuis une note ou des cartes sélectionnées.",
    renameTitle: "Renommer la carte mentale", deleteTitle: "Supprimer cette carte mentale ?",
    deleteDesc: "L'image sera définitivement supprimée.",
    download: "Télécharger l'image", rename: "Renommer", delete: "Supprimer",
  },
  chat: {
    voiceOn: "Voix activée", voiceOff: "Voix désactivée",
    voiceOnHint: "Couper la lecture automatique des réponses",
    voiceOffHint: "Activer la lecture automatique des réponses",
    noSubject: "Sans matière", convLanguage: "Langue de la conversation",
    defaultLanguage: "Français", languageHint: "L'PilotAI répond dans la langue choisie.",
    cardTopic: "Thème de la carte", deleteChat: "Supprimer la conversation",
    messagePlaceholder: "Écrivez votre message…",
  },
};

const it: AuditCopy = {
  common: {
    cancel: "Annulla", save: "Salva", saving: "Salvataggio…", delete: "Elimina", edit: "Modifica",
    loading: "Caricamento…", rename: "Rinomina", create: "Crea", remove: "Rimuovi", none: "Nessuno",
    uncategorized: "Senza categoria", categories: "Categorie", new: "Nuova", download: "Scarica immagine",
    error: "Errore", search: "Cerca",
  },
  nb: {
    title: "Flash Session",
    subtitle: "Scegli materie e argomenti e riprendi la revisione su qualsiasi dispositivo.",
    create: "Nuova Flash Session",
    empty: "Non hai ancora nessuna Flash Session.",
    createFirst: "Crea la prima Flash Session",
    cardsOf: (a, b) => `${a} di ${b} carte`,
    lastStudied: (d) => ` · ultimo studio il ${d}`,
    continue: "Continua", reset: "Azzera",
    tipBefore: "Suggerimento: nella schermata ", tipLink: "Flashcard",
    tipAfter: " puoi selezionare le carte e aggiungerle a una Flash Session esistente.",
    editTitle: "Modifica Flash Session", newTitle: "Nuova Flash Session",
    name: "Nome", namePlaceholder: "es.: Volata finale",
    mode: "Modalità", modeAll: "Tutte le carte", modeDue: "Solo quelle in scadenza oggi", modeFav: "Solo preferite",
    order: "Ordine", orderAlpha: "A–Z (argomento)", orderShuffle: "Casuale",
    content: "Contenuto della Flash Session",
    contentHint: "Selezionare la materia include tutti i suoi argomenti e sotto-argomenti.",
    resetTitle: "Azzerare questa Flash Session",
    resetDesc: "“Solo la sessione” torna alla prima carta e azzera il conteggio delle carte riviste senza toccare la pianificazione. “Pianificazione delle carte” fa scadere oggi tutte le carte e cancella la loro cronologia.",
    resetOnlySession: "Solo la sessione", resetSchedule: "Pianificazione delle carte",
    deleteTitle: "Eliminare la Flash Session?",
    deleteDesc: "La Flash Session e i suoi progressi vengono eliminati. Le flashcard restano invariate.",
    openFail: "Impossibile aprire la Flash Session", nameRequired: "Assegna un nome alla Flash Session",
    updated: "Flash Session aggiornata", created: "Flash Session creata", saveFail: "Salvataggio non riuscito",
    deleted: "Flash Session eliminata", deleteFail: "Eliminazione non riuscita",
    progressReset: "Progressi della Flash Session azzerati",
    scheduleReset: "Pianificazione delle carte azzerata", resetFail: "Azzeramento non riuscito",
  },
  mm: {
    title: "Mappe mentali",
    searchPlaceholder: "Cerca per titolo, categoria o data",
    empty: "Nessuna mappa mentale. Generane una da una nota o dalle flashcard selezionate.",
    renameTitle: "Rinomina mappa mentale", deleteTitle: "Eliminare questa mappa mentale?",
    deleteDesc: "L'immagine verrà eliminata definitivamente.",
    download: "Scarica immagine", rename: "Rinomina", delete: "Elimina",
  },
  chat: {
    voiceOn: "Voce attiva", voiceOff: "Voce disattivata",
    voiceOnHint: "Disattiva la lettura automatica delle risposte",
    voiceOffHint: "Attiva la lettura automatica delle risposte",
    noSubject: "Nessuna materia", convLanguage: "Lingua della conversazione",
    defaultLanguage: "Italiano", languageHint: "L'PilotAI risponde nella lingua scelta.",
    cardTopic: "Argomento della carta", deleteChat: "Elimina conversazione",
    messagePlaceholder: "Scrivi il tuo messaggio…",
  },
};

const de: AuditCopy = {
  common: {
    cancel: "Abbrechen", save: "Speichern", saving: "Speichern…", delete: "Löschen", edit: "Bearbeiten",
    loading: "Wird geladen…", rename: "Umbenennen", create: "Erstellen", remove: "Entfernen", none: "Keine",
    uncategorized: "Ohne Kategorie", categories: "Kategorien", new: "Neu", download: "Bild herunterladen",
    error: "Fehler", search: "Suchen",
  },
  nb: {
    title: "Flash Session",
    subtitle: "Wähle Fächer und Themen und setze die Wiederholung auf jedem Gerät fort.",
    create: "Neue Flash Session",
    empty: "Du hast noch keine Flash Session.",
    createFirst: "Erste Flash Session erstellen",
    cardsOf: (a, b) => `${a} von ${b} Karten`,
    lastStudied: (d) => ` · letztes Lernen am ${d}`,
    continue: "Fortsetzen", reset: "Zurücksetzen",
    tipBefore: "Tipp: Im Bereich ", tipLink: "Lernkarten",
    tipAfter: " kannst du Karten auswählen und zu einer bestehenden Flash Session hinzufügen.",
    editTitle: "Flash Session bearbeiten", newTitle: "Neue Flash Session",
    name: "Name", namePlaceholder: "z. B.: Endspurt",
    mode: "Modus", modeAll: "Alle Karten", modeDue: "Nur heute fällige", modeFav: "Nur Favoriten",
    order: "Reihenfolge", orderAlpha: "A–Z (Thema)", orderShuffle: "Zufällig",
    content: "Inhalt der Flash Session",
    contentHint: "Ein ausgewähltes Fach umfasst alle Themen und Unterthemen.",
    resetTitle: "Diese Flash Session zurücksetzen",
    resetDesc: "„Nur die Sitzung“ springt zur ersten Karte und löscht die Zählung der wiederholten Karten, ohne die Planung zu ändern. „Kartenplanung“ setzt alle Karten auf heute fällig und löscht ihren Verlauf.",
    resetOnlySession: "Nur die Sitzung", resetSchedule: "Kartenplanung",
    deleteTitle: "Flash Session löschen?",
    deleteDesc: "Die Flash Session und ihr Fortschritt werden gelöscht. Die Lernkarten bleiben erhalten.",
    openFail: "Flash Session konnte nicht geöffnet werden", nameRequired: "Gib der Flash Session einen Namen",
    updated: "Flash Session aktualisiert", created: "Flash Session erstellt", saveFail: "Speichern fehlgeschlagen",
    deleted: "Flash Session gelöscht", deleteFail: "Löschen fehlgeschlagen",
    progressReset: "Fortschritt der Flash Session zurückgesetzt",
    scheduleReset: "Kartenplanung zurückgesetzt", resetFail: "Zurücksetzen fehlgeschlagen",
  },
  mm: {
    title: "Mindmaps",
    searchPlaceholder: "Nach Titel, Kategorie oder Datum suchen",
    empty: "Noch keine Mindmap. Erzeuge eine aus einer Notiz oder aus ausgewählten Lernkarten.",
    renameTitle: "Mindmap umbenennen", deleteTitle: "Diese Mindmap löschen?",
    deleteDesc: "Das Bild wird endgültig gelöscht.",
    download: "Bild herunterladen", rename: "Umbenennen", delete: "Löschen",
  },
  chat: {
    voiceOn: "Stimme an", voiceOff: "Stimme aus",
    voiceOnHint: "Automatisches Vorlesen der Antworten stummschalten",
    voiceOffHint: "Automatisches Vorlesen der Antworten aktivieren",
    noSubject: "Kein Fach", convLanguage: "Sprache des Gesprächs",
    defaultLanguage: "Deutsch", languageHint: "PilotAI antwortet in der gewählten Sprache.",
    cardTopic: "Thema der Karte", deleteChat: "Gespräch löschen",
    messagePlaceholder: "Schreibe deine Nachricht…",
  },
};

const TABLE: Record<string, AuditCopy> = {
  pt, "pt-BR": pt, "pt-PT": ptPT, en, es, fr, it, de,
};

export function auditCopy(lang: Lang | string): AuditCopy {
  return TABLE[lang as string] ?? en;
}

/** Base em inglês para o overlay dos idiomas extras e para o tradutor automático. */
export const AUDIT_EN: AuditCopy = en;

export function useAuditT(): AuditCopy {
  const { lang, extLang } = useLang();
  const od = useOverlayD();
  if (extLang && od) return applyDictOverlay(en, od, "audit");
  return auditCopy(lang);
}

/* ---------- Revisão / narração (itens do PDF) ---------- */

export type StudyCopy = {
  myAnswer: string;
  narrate: string;
  narrateQuestion: string;
  narrateAnswer: string;
  narrateNote: string;
  autoOn: string;
  autoOff: string;
  autoOnTitle: string;
  autoOffTitle: string;
  rateLabel: string;
  rateTitle: (r: number) => string;
  speed: string;
  nextCard: string;
  gotoLabel: string;
  gotoTitle: string;
  alphaTitle: string;
  alphaContinueToast: string;
  alphaRestartToast: string;
  narrateFail: string;
  narrateUnsupported: string;
};

const STUDY: Record<string, StudyCopy> = {
  pt: {
    myAnswer: "Minha resposta",
    narrate: "Narrar",
    narrateQuestion: "Narrar pergunta",
    narrateAnswer: "Narrar resposta",
    narrateNote: "Narrar anotação",
    autoOn: "Ligar narração automática",
    autoOff: "Desligar narração automática",
    autoOnTitle: "Auto-narração: ligada",
    autoOffTitle: "Auto-narração: desligada",
    rateLabel: "Velocidade da narração",
    rateTitle: (r) => `Velocidade da narração: ${r}x`,
    speed: "Velocidade:",
    nextCard: "Próximo card",
    gotoLabel: "Ir para o flashcard número",
    gotoTitle: "Digite o número do flashcard e pressione Enter",
    alphaTitle: "Ordem alfabética dos assuntos",
    alphaContinueToast: "Ordem dos assuntos (A–Z) — continuando de onde você está",
    alphaRestartToast: "Ordem dos assuntos (A–Z) — começando pelo primeiro assunto",
    narrateFail: "Não foi possível narrar",
    narrateUnsupported: "Narração não suportada neste navegador",
  },
  "pt-PT": {
    myAnswer: "A minha resposta",
    narrate: "Ouvir",
    narrateQuestion: "Ouvir a pergunta",
    narrateAnswer: "Ouvir a resposta",
    narrateNote: "Ouvir a nota",
    autoOn: "Ativar leitura automática",
    autoOff: "Desativar leitura automática",
    autoOnTitle: "Leitura automática: ativada",
    autoOffTitle: "Leitura automática: desativada",
    rateLabel: "Velocidade da leitura",
    rateTitle: (r) => `Velocidade da leitura: ${r}x`,
    speed: "Velocidade:",
    nextCard: "Cartão seguinte",
    gotoLabel: "Ir para o cartão número",
    gotoTitle: "Escreva o número do cartão e prima Enter",
    alphaTitle: "Ordem alfabética dos temas",
    alphaContinueToast: "Ordem dos temas (A–Z) — a continuar de onde está",
    alphaRestartToast: "Ordem dos temas (A–Z) — a começar pelo primeiro tema",
    narrateFail: "Não foi possível ler em voz alta",
    narrateUnsupported: "Leitura em voz alta não suportada neste navegador",
  },
  en: {
    myAnswer: "My answer",
    narrate: "Read aloud",
    narrateQuestion: "Read the question aloud",
    narrateAnswer: "Read the answer aloud",
    narrateNote: "Read the note aloud",
    autoOn: "Turn on automatic narration",
    autoOff: "Turn off automatic narration",
    autoOnTitle: "Auto narration: on",
    autoOffTitle: "Auto narration: off",
    rateLabel: "Narration speed",
    rateTitle: (r) => `Narration speed: ${r}x`,
    speed: "Speed:",
    nextCard: "Next card",
    gotoLabel: "Go to flashcard number",
    gotoTitle: "Type the flashcard number and press Enter",
    alphaTitle: "Alphabetical order of topics",
    alphaContinueToast: "Topic order (A–Z) — continuing where you left off",
    alphaRestartToast: "Topic order (A–Z) — starting from the first topic",
    narrateFail: "Could not read it aloud",
    narrateUnsupported: "Narration is not supported in this browser",
  },
  es: {
    myAnswer: "Mi respuesta",
    narrate: "Escuchar",
    narrateQuestion: "Escuchar la pregunta",
    narrateAnswer: "Escuchar la respuesta",
    narrateNote: "Escuchar la nota",
    autoOn: "Activar la narración automática",
    autoOff: "Desactivar la narración automática",
    autoOnTitle: "Narración automática: activada",
    autoOffTitle: "Narración automática: desactivada",
    rateLabel: "Velocidad de la narración",
    rateTitle: (r) => `Velocidad de la narración: ${r}x`,
    speed: "Velocidad:",
    nextCard: "Tarjeta siguiente",
    gotoLabel: "Ir a la tarjeta número",
    gotoTitle: "Escribe el número de la tarjeta y pulsa Enter",
    alphaTitle: "Orden alfabético de los temas",
    alphaContinueToast: "Orden de los temas (A–Z) — continuando donde estabas",
    alphaRestartToast: "Orden de los temas (A–Z) — empezando por el primer tema",
    narrateFail: "No se pudo narrar",
    narrateUnsupported: "La narración no es compatible con este navegador",
  },
  fr: {
    myAnswer: "Ma réponse",
    narrate: "Écouter",
    narrateQuestion: "Écouter la question",
    narrateAnswer: "Écouter la réponse",
    narrateNote: "Écouter la note",
    autoOn: "Activer la narration automatique",
    autoOff: "Désactiver la narration automatique",
    autoOnTitle: "Narration automatique : activée",
    autoOffTitle: "Narration automatique : désactivée",
    rateLabel: "Vitesse de la narration",
    rateTitle: (r) => `Vitesse de la narration : ${r}x`,
    speed: "Vitesse :",
    nextCard: "Carte suivante",
    gotoLabel: "Aller à la carte numéro",
    gotoTitle: "Saisissez le numéro de la carte et appuyez sur Entrée",
    alphaTitle: "Ordre alphabétique des thèmes",
    alphaContinueToast: "Ordre des thèmes (A–Z) — reprise là où vous en étiez",
    alphaRestartToast: "Ordre des thèmes (A–Z) — reprise au premier thème",
    narrateFail: "Lecture audio impossible",
    narrateUnsupported: "La narration n'est pas prise en charge par ce navigateur",
  },
  it: {
    myAnswer: "La mia risposta",
    narrate: "Ascolta",
    narrateQuestion: "Ascolta la domanda",
    narrateAnswer: "Ascolta la risposta",
    narrateNote: "Ascolta la nota",
    autoOn: "Attiva la narrazione automatica",
    autoOff: "Disattiva la narrazione automatica",
    autoOnTitle: "Narrazione automatica: attiva",
    autoOffTitle: "Narrazione automatica: disattivata",
    rateLabel: "Velocità della narrazione",
    rateTitle: (r) => `Velocità della narrazione: ${r}x`,
    speed: "Velocità:",
    nextCard: "Carta successiva",
    gotoLabel: "Vai alla carta numero",
    gotoTitle: "Digita il numero della carta e premi Invio",
    alphaTitle: "Ordine alfabetico degli argomenti",
    alphaContinueToast: "Ordine degli argomenti (A–Z) — si riprende da dove eri",
    alphaRestartToast: "Ordine degli argomenti (A–Z) — si riparte dal primo argomento",
    narrateFail: "Impossibile leggere ad alta voce",
    narrateUnsupported: "La narrazione non è supportata da questo browser",
  },
  de: {
    myAnswer: "Meine Antwort",
    narrate: "Vorlesen",
    narrateQuestion: "Frage vorlesen",
    narrateAnswer: "Antwort vorlesen",
    narrateNote: "Notiz vorlesen",
    autoOn: "Automatisches Vorlesen einschalten",
    autoOff: "Automatisches Vorlesen ausschalten",
    autoOnTitle: "Automatisches Vorlesen: ein",
    autoOffTitle: "Automatisches Vorlesen: aus",
    rateLabel: "Vorlesegeschwindigkeit",
    rateTitle: (r) => `Vorlesegeschwindigkeit: ${r}x`,
    speed: "Geschwindigkeit:",
    nextCard: "Nächste Karte",
    gotoLabel: "Zur Karte mit der Nummer",
    gotoTitle: "Kartennummer eingeben und Enter drücken",
    alphaTitle: "Alphabetische Reihenfolge der Themen",
    alphaContinueToast: "Themenreihenfolge (A–Z) — weiter an der aktuellen Stelle",
    alphaRestartToast: "Themenreihenfolge (A–Z) — Start beim ersten Thema",
    narrateFail: "Vorlesen nicht möglich",
    narrateUnsupported: "Vorlesen wird von diesem Browser nicht unterstützt",
  },
};
STUDY["pt-BR"] = STUDY["pt"]!;

export function studyCopy(lang: Lang | string): StudyCopy {
  return STUDY[lang as string] ?? STUDY["en"]!;
}

export function useStudyT(): StudyCopy {
  const { lang, extLang } = useLang();
  const od = useOverlayD();
  if (extLang && od) return applyDictOverlay(STUDY["en"]!, od, "study");
  return studyCopy(lang);
}
