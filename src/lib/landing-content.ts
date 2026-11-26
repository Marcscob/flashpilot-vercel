import { applyDeepDictOverlay } from "./app-ext-langs";
import { isLang, type Lang } from "./lang-match";
type Content = {
  tagline: string;
  techLabel: string;
  heroNote: string;
  sampleTitle: string;
  sampleIntro: string;
  ecosystem: string;
  ecosystemIntro: string;
  features: [string, string][];
  prices: string;
  monthly: string;
  yearly: string;
  trial: string;
  packs: string;
  economy: string;
  faqTitle: string;
  faq: [string, string][];
  useTitle: string;
  uses: string[];
  gate: string;
  template: string;
  freeSheet: string;
  sheetError: string;
  saveDeck: string;
  audioNote: string;
  micError: string;
  stop: string;
  flip: string;
  question: string;
  answer: string;
  decks: [string, string, string][];
  terms: string;
  privacy: string;
};
const en: Content = {
  tagline:
    "Create smart flashcards to study with technique. An app built on up-to-date, state-of-the-art cognitive science.",
  techLabel: "Built-in technologies: PilotAI · ImagePilot · SM-2",
  heroNote:
    "Photo, book, handout, notebook, audio, video... Anything can become flashcards. You build your own library.",
  sampleTitle: "A little knowledge. An instant start.",
  sampleIntro: "Three sample decks. No upload, no account, no waiting.",
  ecosystem: "One place for your entire study routine.",
  ecosystemIntro: "Capture, understand, practise and revisit. FlashPilot keeps it all connected.",
  features: [
    [
      "Remember with SM-2",
      "Spaced repetition schedules the next review around your progress, with reminders in the app and through Telegram.",
    ],
    [
      "Speak with PilotAI",
      "Practise speaking and writing in other languages, with corrections during your conversation.",
    ],
    [
      "Connect ideas",
      "Create mind maps and formatted notes, organised by subject, topic and subtopic.",
    ],
    [
      "Study your way",
      "Use ImagePilot for visual structures, review on your phone or computer, and follow your progress.",
    ],
  ],
  prices: "Clear plans. No surprises.",
  monthly: "Pro monthly",
  yearly: "Pro yearly",
  trial: "Start free",
  packs: "Need more? Buy a FlashCoin pack in the store.",
  economy:
    "40 welcome FlashCoins · +150 at each monthly payment or +300 at each yearly payment. Purchased FlashCoins are valid for 12 months. Structured spreadsheet imports cost 0 FlashCoins; generated cards cost 1 FlashCoin per saved card. Official subjects are sold separately.",
  faqTitle: "Before your next chapter",
  faq: [
    [
      "How does spaced repetition work?",
      "The SM-2 algorithm adjusts review intervals using your answers, so you revisit content as it becomes harder to recall.",
    ],
    [
      "How do Telegram reminders work?",
      "Connect Telegram in your account to receive scheduled review reminders. You can also review directly in the app.",
    ],
    [
      "When are FlashCoins charged?",
      "Generated flashcards cost 1 FlashCoin each when saved. Two-column question/answer spreadsheets import for free. Notes, mind maps and conversation do not use FlashCoins.",
    ],
    [
      "Can I try without an account?",
      "The three sample decks and spreadsheet previews work immediately. Creating cards with PilotAI and saving your deck require a confirmed account.",
    ],
    [
      "What happens to narrated audio?",
      "Audio is used for transcription and card generation, not saved in your library. Your temporary material is cleared after the process finishes.",
    ],
  ],
  useTitle: "Built around what you study",
  uses: ["Medicine & biology", "Law & public exams", "Languages", "School & university"],
  gate: "Try the examples below instantly. Confirm your account to create up to 10 sample cards with PilotAI and receive 40 welcome FlashCoins. Charges apply only to generated cards you save.",
  template: "Download template",
  freeSheet: "Question + answer: free import · 0 FlashCoins",
  sheetError:
    "Use two question/answer columns, with up to 500 cards. Download the template and organise your sheet before importing.",
  saveDeck: "Create flashcards",
  audioNote:
    "Read slowly the passage you want to turn into flashcards. Up to 3 minutes. Audio is not saved after processing; confirm your account before transcription.",
  micError: "Microphone unavailable or blocked. Check permission or upload an audio file.",
  stop: "Stop recording",
  flip: "Flip card",
  question: "Question",
  answer: "Answer",
  decks: [
    [
      "Law",
      "What is the purpose of a constitution?",
      "To define the structure of the state and fundamental rights.",
    ],
    [
      "Biology",
      "What is the role of mitochondria?",
      "To produce most of the cell’s ATP through cellular respiration.",
    ],
    ["Languages", "What does ‘to learn’ mean in Portuguese?", "Aprender."],
  ],
  terms: "Terms",
  privacy: "Privacy",
};
const pt: Content = {
  tagline:
    "Crie flashcards inteligentes para estudar com técnica. App construído com ciência cognitiva atualizada de última geração.",
  techLabel: "Tecnologias embarcadas: PilotAI · ImagePilot · SM-2",
  heroNote:
    "Seja foto, livro, apostila, caderno, áudio, vídeo... Tudo pode virar flashcards. Você cria o seu próprio acervo.",
  sampleTitle: "Um pouco de conhecimento. Um começo imediato.",
  sampleIntro: "Três baralhos de exemplo. Sem arquivo, sem cadastro, sem espera.",
  ecosystem: "Sua rotina de estudos inteira, no mesmo lugar.",
  ecosystemIntro: "Capture, entenda, pratique e revise. O FlashPilot conecta cada etapa.",
  features: [
    [
      "Lembre com o SM-2",
      "A repetição espaçada programa a próxima revisão conforme seu progresso, com lembretes no app e pelo Telegram.",
    ],
    [
      "Converse com o PilotAI",
      "Pratique fala e escrita em outros idiomas, com correções durante a conversação.",
    ],
    [
      "Conecte suas ideias",
      "Crie mapas mentais e anotações formatadas, organizados por matéria, assunto e tópico.",
    ],
    [
      "Estude do seu jeito",
      "Use o ImagePilot para estruturas visuais, revise no celular ou computador e acompanhe sua evolução.",
    ],
  ],
  prices: "Planos claros. Sem surpresas.",
  monthly: "Pro mensal",
  yearly: "Pro anual",
  trial: "Comece grátis",
  packs: "Precisa de mais? Compre um lote de FlashCoins na Loja.",
  economy:
    "40 FlashCoins de boas-vindas · +150 a cada pagamento mensal ou +300 a cada pagamento anual. FlashCoins compradas valem 12 meses. Importação estruturada de planilhas custa 0 FlashCoins; cards gerados custam 1 FlashCoin por card salvo. Matérias oficiais são vendidas separadamente.",
  faqTitle: "Antes do seu próximo capítulo",
  faq: [
    [
      "Como funciona a repetição espaçada?",
      "O algoritmo SM-2 ajusta os intervalos conforme suas respostas, para revisar quando o conteúdo começa a ficar mais difícil de lembrar.",
    ],
    [
      "Como recebo lembretes no Telegram?",
      "Conecte o Telegram na sua conta para receber lembretes de revisão programados. Você também pode revisar diretamente no app.",
    ],
    [
      "Quando são cobradas as FlashCoins?",
      "Flashcards gerados custam 1 FlashCoin cada, no salvamento. Planilhas de duas colunas pergunta/resposta são importadas gratuitamente. Anotações, mapas e conversação não usam FlashCoins.",
    ],
    [
      "Posso experimentar sem criar conta?",
      "Os três baralhos de exemplo e as prévias de planilhas funcionam imediatamente. Criar cards com o PilotAI e salvar seu baralho exige uma conta confirmada.",
    ],
    [
      "O que acontece com o áudio narrado?",
      "O áudio é usado para transcrição e criação dos cards, sem ficar salvo na sua biblioteca. O material temporário é limpo ao concluir o processo.",
    ],
  ],
  useTitle: "Feito para o que você estuda",
  uses: ["Medicina e biologia", "Direito e concursos", "Idiomas", "Escola e universidade"],
  gate: "Experimente os exemplos abaixo agora. Confirme sua conta para criar até 10 cards demonstrativos com o PilotAI e receber 40 FlashCoins de boas-vindas. Só cards gerados e salvos são cobrados.",
  template: "Baixar modelo",
  freeSheet: "Pergunta + resposta: importação gratuita · 0 FlashCoins",
  sheetError:
    "Use duas colunas pergunta/resposta, com até 500 cards. Baixe o modelo e organize sua planilha antes de importar.",
  saveDeck: "Criar Flashcards",
  audioNote:
    "Leia pausadamente o trecho que deseja transformar em flashcards. Até 3 minutos. O áudio não é salvo após o processamento; confirme sua conta antes da transcrição.",
  micError: "Microfone ausente ou bloqueado. Verifique a permissão ou envie um arquivo de áudio.",
  stop: "Parar gravação",
  flip: "Virar card",
  question: "Pergunta",
  answer: "Resposta",
  decks: [
    [
      "Legislação",
      "Qual é a função de uma Constituição?",
      "Definir a estrutura do Estado e os direitos fundamentais.",
    ],
    [
      "Biologia",
      "Qual é a função das mitocôndrias?",
      "Produzir a maior parte do ATP da célula pela respiração celular.",
    ],
    ["Idiomas", "O que significa ‘to learn’ em português?", "Aprender."],
  ],
  terms: "Termos",
  privacy: "Privacidade",
};
const es: Content = {
  ...en,
  tagline:
    "Crea flashcards inteligentes para estudiar con técnica. App construida con ciencia cognitiva actualizada de última generación.",
  techLabel: "Tecnologías integradas: PilotAI · ImagePilot · SM-2",
  heroNote:
    "Foto, libro, apuntes, cuaderno, audio, vídeo... Todo puede convertirse en flashcards. Tú creas tu propia biblioteca.",
  sampleTitle: "Un poco de conocimiento. Un comienzo inmediato.",
  sampleIntro: "Tres barajas de ejemplo. Sin archivos, sin cuenta, sin espera.",
  ecosystem: "Toda tu rutina de estudio en un solo lugar.",
  ecosystemIntro: "Captura, comprende, practica y repasa con FlashPilot.",
  features: [
    [
      "Recuerda con SM-2",
      "La repetición espaciada programa repasos según tu progreso, con avisos en la app y Telegram.",
    ],
    [
      "Conversa con PilotAI",
      "Practica expresión oral y escrita en otros idiomas con correcciones durante la conversación.",
    ],
    ["Conecta ideas", "Crea mapas mentales y apuntes organizados por materia, tema y subtema."],
    [
      "Estudia a tu manera",
      "Usa ImagePilot para estructuras visuales y repasa en móvil u ordenador.",
    ],
  ],
  prices: "Planes claros. Sin sorpresas.",
  monthly: "Pro mensual",
  yearly: "Pro anual",
  trial: "Empieza gratis",
  packs: "Compra más FlashCoins en la tienda.",
  economy:
    "40 FlashCoins de bienvenida · +150 por pago mensual o +300 por pago anual. Validez de compra: 12 meses. Importación estructurada: 0 FlashCoins; 1 por tarjeta generada guardada. Materias oficiales se venden por separado.",
  faqTitle: "Antes de tu próximo capítulo",
  faq: [
    ["¿Cómo funciona SM-2?", "Ajusta los intervalos de repaso según tus respuestas."],
    [
      "¿Cómo recibo avisos por Telegram?",
      "Conecta Telegram en tu cuenta para recibir recordatorios.",
    ],
    [
      "¿Cuándo se cobran FlashCoins?",
      "1 por tarjeta generada guardada. Hojas de dos columnas gratis. Apuntes, mapas y conversación no usan FlashCoins.",
    ],
    [
      "¿Puedo probar sin cuenta?",
      "Los ejemplos y las vistas previas funcionan sin cuenta; PilotAI y guardar requieren una cuenta confirmada.",
    ],
    [
      "¿Se guarda el audio?",
      "Solo se utiliza para transcribir y generar tarjetas. El material temporal se elimina al finalizar.",
    ],
  ],
  useTitle: "Para lo que estudias",
  uses: ["Medicina y biología", "Derecho y oposiciones", "Idiomas", "Escuela y universidad"],
  gate: "Prueba los ejemplos ahora. Confirma tu cuenta para crear hasta 10 tarjetas con PilotAI y recibir 40 FlashCoins. Solo se cobran tarjetas generadas guardadas.",
  template: "Descargar modelo",
  freeSheet: "Pregunta + respuesta: importación gratis · 0 FlashCoins",
  sheetError: "Usa dos columnas pregunta/respuesta y hasta 500 tarjetas. Descarga el modelo.",
  saveDeck: "Crear flashcards",
  audioNote:
    "Lee pausadamente el fragmento que deseas convertir en tarjetas. Máximo 3 minutos. El audio no se guarda; confirma tu cuenta antes de transcribir.",
  micError: "Micrófono no disponible o bloqueado. Comprueba el permiso o sube un audio.",
  stop: "Detener grabación",
  flip: "Girar tarjeta",
  question: "Pregunta",
  answer: "Respuesta",
  decks: [
    [
      "Derecho",
      "¿Para qué sirve una constitución?",
      "Define la estructura del Estado y los derechos fundamentales.",
    ],
    [
      "Biología",
      "¿Qué hacen las mitocondrias?",
      "Producen la mayor parte del ATP mediante respiración celular.",
    ],
    ["Idiomas", "¿Qué significa ‘to learn’?", "Aprender."],
  ],
  terms: "Términos",
  privacy: "Privacidad",
};
const fr: Content = {
  ...en,
  tagline:
    "Créez des flashcards intelligentes pour étudier avec méthode. Une application conçue avec une science cognitive actualisée de dernière génération.",
  techLabel: "Technologies embarquées : PilotAI · ImagePilot · SM-2",
  heroNote:
    "Photo, livre, polycopié, cahier, audio, vidéo... Tout peut devenir des flashcards. Vous créez votre propre collection.",
  sampleTitle: "Un peu de savoir. Un départ immédiat.",
  sampleIntro: "Trois jeux d’exemple. Sans fichier, sans compte, sans attente.",
  ecosystem: "Toute votre routine d’étude au même endroit.",
  ecosystemIntro: "Capturez, comprenez, pratiquez et révisez avec FlashPilot.",
  features: [
    [
      "Mémorisez avec SM-2",
      "La répétition espacée planifie les révisions selon vos progrès, avec rappels dans l’app et Telegram.",
    ],
    [
      "Parlez avec PilotAI",
      "Pratiquez l’oral et l’écrit avec des corrections pendant la conversation.",
    ],
    ["Reliez les idées", "Créez cartes mentales et notes classées par matière et sujet."],
    [
      "Étudiez à votre façon",
      "ImagePilot identifie les structures visuelles. Révisez sur téléphone ou ordinateur.",
    ],
  ],
  prices: "Des offres claires. Sans surprises.",
  monthly: "Pro mensuel",
  yearly: "Pro annuel",
  trial: "Commencez gratuitement",
  packs: "Achetez davantage de FlashCoins dans la boutique.",
  economy:
    "40 FlashCoins de bienvenue · +150 par paiement mensuel ou +300 par paiement annuel. Validité après achat : 12 mois. Import structuré : 0 FlashCoins ; 1 par carte générée enregistrée. Les matières officielles sont vendues séparément.",
  faqTitle: "Avant votre prochain chapitre",
  faq: [
    ["Comment fonctionne SM-2 ?", "Les intervalles de révision s’adaptent à vos réponses."],
    ["Comment recevoir les rappels Telegram ?", "Connectez Telegram dans votre compte."],
    [
      "Quand les FlashCoins sont-elles facturées ?",
      "1 par carte générée enregistrée. Import de deux colonnes gratuit. Notes, cartes mentales et conversation n’en utilisent pas.",
    ],
    [
      "Puis-je essayer sans compte ?",
      "Les exemples et aperçus sont accessibles immédiatement ; PilotAI et l’enregistrement nécessitent un compte confirmé.",
    ],
    [
      "L’audio est-il enregistré ?",
      "Il sert à la transcription et à la génération. Les supports temporaires sont effacés à la fin.",
    ],
  ],
  useTitle: "Pour vos études",
  uses: ["Médecine et biologie", "Droit et concours", "Langues", "École et université"],
  gate: "Essayez les exemples. Confirmez votre compte pour créer jusqu’à 10 cartes avec PilotAI et recevoir 40 FlashCoins. Seules les cartes générées enregistrées sont facturées.",
  template: "Télécharger le modèle",
  freeSheet: "Question + réponse : import gratuit · 0 FlashCoins",
  sheetError:
    "Utilisez deux colonnes question/réponse et 500 cartes maximum. Téléchargez le modèle.",
  saveDeck: "Créer des flashcards",
  audioNote:
    "Lisez lentement le passage à transformer en cartes. Maximum 3 minutes. L’audio n’est pas conservé ; confirmez votre compte avant la transcription.",
  micError: "Microphone absent ou bloqué. Vérifiez l’autorisation ou importez un audio.",
  stop: "Arrêter",
  flip: "Retourner",
  question: "Question",
  answer: "Réponse",
  decks: [
    [
      "Droit",
      "À quoi sert une constitution ?",
      "À définir l’organisation de l’État et les droits fondamentaux.",
    ],
    [
      "Biologie",
      "Quel est le rôle des mitochondries ?",
      "Produire la majeure partie de l’ATP par respiration cellulaire.",
    ],
    ["Langues", "Que signifie ‘to learn’ ?", "Apprendre."],
  ],
  terms: "Conditions",
  privacy: "Confidentialité",
};
const it: Content = {
  ...en,
  tagline:
    "Crea flashcard intelligenti per studiare con tecnica. Un'app costruita con scienza cognitiva aggiornata di ultima generazione.",
  techLabel: "Tecnologie integrate: PilotAI · ImagePilot · SM-2",
  heroNote:
    "Foto, libro, dispensa, quaderno, audio, video... Tutto può diventare flashcard. Sei tu a creare il tuo archivio.",
  sampleTitle: "Un po’ di sapere. Un inizio immediato.",
  sampleIntro: "Tre mazzi di esempio. Senza file, account o attesa.",
  ecosystem: "Tutta la tua routine di studio in un solo luogo.",
  ecosystemIntro: "Acquisisci, comprendi, pratica e ripassa con FlashPilot.",
  features: [
    [
      "Ricorda con SM-2",
      "La ripetizione dilazionata pianifica i ripassi con promemoria nell’app e Telegram.",
    ],
    [
      "Parla con PilotAI",
      "Pratica lingue scritte e parlate con correzioni durante la conversazione.",
    ],
    ["Collega le idee", "Crea mappe mentali e appunti organizzati per materia e argomento."],
    ["Studia a modo tuo", "Usa ImagePilot per strutture visive e ripassa su telefono o computer."],
  ],
  prices: "Piani chiari. Nessuna sorpresa.",
  monthly: "Pro mensile",
  yearly: "Pro annuale",
  trial: "Inizia gratis",
  packs: "Acquista altre FlashCoins nel negozio.",
  economy:
    "40 FlashCoins di benvenuto · +150 per pagamento mensile o +300 per pagamento annuale. Validità: 12 mesi dall’acquisto. Importazione strutturata: 0 FlashCoins; 1 per carta generata salvata. Materie ufficiali vendute separatamente.",
  faqTitle: "Prima del prossimo capitolo",
  faq: [
    ["Come funziona SM-2?", "Adatta gli intervalli di ripasso alle tue risposte."],
    ["Come ricevo promemoria Telegram?", "Collega Telegram nel tuo account."],
    [
      "Quando si pagano FlashCoins?",
      "1 per carta generata salvata. Fogli di due colonne gratis. Appunti, mappe e conversazione non usano FlashCoins.",
    ],
    [
      "Posso provare senza account?",
      "Esempi e anteprime subito disponibili; PilotAI e salvataggio richiedono un account confermato.",
    ],
    [
      "L’audio viene salvato?",
      "Serve solo a trascrivere e generare carte. Il materiale temporaneo viene eliminato alla fine.",
    ],
  ],
  useTitle: "Per ciò che studi",
  uses: ["Medicina e biologia", "Diritto e concorsi", "Lingue", "Scuola e università"],
  gate: "Prova gli esempi. Conferma l’account per creare fino a 10 carte con PilotAI e ricevere 40 FlashCoins. Si pagano solo carte generate salvate.",
  template: "Scarica modello",
  freeSheet: "Domanda + risposta: importazione gratis · 0 FlashCoins",
  sheetError: "Usa due colonne domanda/risposta e fino a 500 carte. Scarica il modello.",
  saveDeck: "Crea flashcard",
  audioNote:
    "Leggi lentamente il brano da trasformare in carte. Massimo 3 minuti. L’audio non viene salvato; conferma l’account prima della trascrizione.",
  micError: "Microfono assente o bloccato. Controlla i permessi o carica un audio.",
  stop: "Ferma registrazione",
  flip: "Gira carta",
  question: "Domanda",
  answer: "Risposta",
  decks: [
    [
      "Diritto",
      "A cosa serve una costituzione?",
      "Definisce l’organizzazione dello Stato e i diritti fondamentali.",
    ],
    [
      "Biologia",
      "Qual è il ruolo dei mitocondri?",
      "Produrre gran parte dell’ATP mediante respirazione cellulare.",
    ],
    ["Lingue", "Cosa significa ‘to learn’?", "Imparare."],
  ],
  terms: "Termini",
  privacy: "Privacy",
};
const de: Content = {
  ...en,
  tagline:
    "Erstelle intelligente Flashcards, um mit Technik zu lernen. Eine App, gebaut mit aktueller Kognitionswissenschaft der neuesten Generation.",
  techLabel: "Integrierte Technologien: PilotAI · ImagePilot · SM-2",
  heroNote:
    "Foto, Buch, Skript, Heft, Audio, Video... Alles kann zu Flashcards werden. Du baust dein eigenes Archiv auf.",
  sampleTitle: "Etwas Wissen. Ein sofortiger Start.",
  sampleIntro: "Drei Beispielstapel. Ohne Datei, Konto oder Wartezeit.",
  ecosystem: "Deine gesamte Lernroutine an einem Ort.",
  ecosystemIntro: "Erfassen, verstehen, üben und wiederholen mit FlashPilot.",
  features: [
    [
      "Erinnern mit SM-2",
      "Verteilte Wiederholung plant nach deinem Fortschritt, mit Erinnerungen in der App und über Telegram.",
    ],
    [
      "Mit PilotAI sprechen",
      "Übe Sprechen und Schreiben in anderen Sprachen mit Korrekturen im Gespräch.",
    ],
    ["Ideen verbinden", "Erstelle Mindmaps und Notizen, geordnet nach Fach und Thema."],
    [
      "Auf deine Art lernen",
      "Nutze ImagePilot für visuelle Strukturen und lerne am Handy oder Computer.",
    ],
  ],
  prices: "Klare Tarife. Keine Überraschungen.",
  monthly: "Pro monatlich",
  yearly: "Pro jährlich",
  trial: "Kostenlos starten",
  packs: "Weitere FlashCoins im Shop kaufen.",
  economy:
    "40 Willkommens-FlashCoins · +150 pro Monatszahlung oder +300 pro Jahreszahlung. Gültigkeit ab Kauf: 12 Monate. Strukturierter Import: 0 FlashCoins; 1 pro gespeicherter generierter Karte. Offizielle Fächer separat erhältlich.",
  faqTitle: "Vor deinem nächsten Kapitel",
  faq: [
    ["Wie funktioniert SM-2?", "Die Wiederholungsabstände passen sich deinen Antworten an."],
    ["Wie erhalte ich Telegram-Erinnerungen?", "Verbinde Telegram in deinem Konto."],
    [
      "Wann werden FlashCoins berechnet?",
      "1 pro gespeicherter generierter Karte. Zwei-Spalten-Import kostenlos. Notizen, Mindmaps und Gespräche verwenden keine FlashCoins.",
    ],
    [
      "Kann ich ohne Konto testen?",
      "Beispiele und Vorschauen sind sofort verfügbar; PilotAI und Speichern erfordern ein bestätigtes Konto.",
    ],
    [
      "Wird Audio gespeichert?",
      "Es dient der Transkription und Kartenerstellung. Temporäres Material wird anschließend gelöscht.",
    ],
  ],
  useTitle: "Für deinen Lernstoff",
  uses: ["Medizin und Biologie", "Recht und Prüfungen", "Sprachen", "Schule und Universität"],
  gate: "Teste die Beispiele. Bestätige dein Konto für bis zu 10 PilotAI-Karten und 40 FlashCoins. Nur gespeicherte generierte Karten werden berechnet.",
  template: "Vorlage herunterladen",
  freeSheet: "Frage + Antwort: kostenloser Import · 0 FlashCoins",
  sheetError:
    "Verwende zwei Frage/Antwort-Spalten mit bis zu 500 Karten. Lade die Vorlage herunter.",
  saveDeck: "Flashcards erstellen",
  audioNote:
    "Lies den Abschnitt langsam vor. Maximal 3 Minuten. Audio wird nicht gespeichert; bestätige dein Konto vor der Transkription.",
  micError: "Mikrofon fehlt oder ist blockiert. Prüfe die Berechtigung oder lade Audio hoch.",
  stop: "Aufnahme stoppen",
  flip: "Karte umdrehen",
  question: "Frage",
  answer: "Antwort",
  decks: [
    ["Recht", "Was ist der Zweck einer Verfassung?", "Staatsaufbau und Grundrechte festlegen."],
    [
      "Biologie",
      "Welche Aufgabe haben Mitochondrien?",
      "Den Großteil des ATP durch Zellatmung erzeugen.",
    ],
    ["Sprachen", "Was bedeutet ‘to learn’ auf Deutsch?", "Lernen."],
  ],
  terms: "Nutzungsbedingungen",
  privacy: "Datenschutz",
};
const ptPT: Content = {
  ...pt,
  tagline:
    "Crie flashcards inteligentes para estudar com técnica. App construído com ciência cognitiva atualizada de última geração.",
  heroNote:
    "Fotografia, livro, sebenta, caderno, áudio, vídeo... Tudo se pode transformar em flashcards. É o utilizador que cria o seu próprio acervo.",
};
const content: Record<Lang, Content> = { en, pt, "pt-PT": ptPT, es, fr, it, de };
export function landingCopy(lang: string, overlay?: Record<string, string>): Content {
  if (isLang(lang)) return content[lang];
  return overlay ? applyDeepDictOverlay(en, overlay, "landing") : en;
}
