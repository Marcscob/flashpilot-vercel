import { applyDeepDictOverlay } from "@/lib/app-ext-langs";
import { isLang, type Lang } from "@/lib/lang-match";
type LandingCopy = {
  headlineStart: string;
  headlineAccent: string;
  headlineEnd: string;
  intro: string;
  telegram: string;
  freeCoins: string;
  freeTrial: string;
  noCard: string;
  uploadTab: string;
  pasteTab: string;
  dropTitle: string;
  dropHint: string;
  chooseFiles: string;
  pasteImageHint: string;
  takePhoto: string;
  cameraTitle: string;
  switchCamera: string;
  cancel: string;
  capture: string;
  cameraUnavailable: string;
  guidanceLabel: string;
  guidancePlaceholder: string;
  nameLabel: string;
  namePlaceholder: string;
  invalidName: string;
  pasteHint: string;
  emailLabel: string;
  emailPlaceholder: string;
  submit: string;
  privacy: string;
  sampleBadge: string;
  sampleTitle: string;
  sampleText: string;
  emailSent: string;
  emailWait: string;
  emailSendFailed: string;
  processing: string;
  saving: string;
  completed: string;
  goHome: string;
  retry: string;
  fileTooLarge: string;
  tooManyFiles: string;
  fileReadFailed: string;
  stepsTitle: string;
  stepsIntro: string;
  steps: { title: string; text: string }[];
  bottomTitle: string;
  bottomCta: string;
  login: string;
  footer: string;
  emptyInput: string;
  invalidEmail: string;
};

export const LANDING_COPY: Record<Lang, LandingCopy> = {
  pt: {
    headlineStart: "Livro, caderno, PDF, foto, texto...",
    headlineAccent: "Viram centenas de flashcards inteligentes",
    headlineEnd: "Teste agora grátis!",
    intro:
      "Biologia, medicina, direito, idiomas, física, história... O PilotAI transforma o conteúdo em flashcards inteligentes prontos para estudar.",
    telegram:
      "Revisões programadas pelo algoritmo de esquecimento SM-2, com notificações pelo Telegram",
    freeCoins: "40 FlashCoins para novos cadastros",
    freeTrial: "15 dias de teste",
    noCard: "Sem cartão de crédito",
    uploadTab: "Enviar páginas",
    pasteTab: "Colar texto",
    dropTitle: "Arraste seu PDF ou suas fotos para cá",
    dropHint: "ou escolha arquivos do seu dispositivo",
    chooseFiles: "Escolher arquivos",
    pasteImageHint: "Clique aqui e use Ctrl+V ou o botão direito > Colar",
    takePhoto: "Usar câmera",
    cameraTitle: "Capturar imagem",
    switchCamera: "Trocar câmera",
    cancel: "Cancelar",
    capture: "Capturar",
    cameraUnavailable: "Não foi possível acessar a câmera. Verifique a permissão do navegador.",
    guidanceLabel: "Você quer abordar algum trecho ou conteúdo específico? Senão, deixe em branco",
    guidancePlaceholder: "Ex.: dê mais atenção aos artigos 5º a 10º...",
    nameLabel: "Seu nome",
    namePlaceholder: "Como podemos chamar você?",
    invalidName: "Informe seu nome.",
    pasteHint: "Cole um trecho do livro, da apostila ou das suas anotações...",
    emailLabel: "Seu melhor e-mail",
    emailPlaceholder: "voce@email.com",
    submit: "Criar flashcards agora",
    privacy: "Seu material fica no navegador até você confirmar o acesso pelo próprio e-mail.",
    sampleBadge: "SEU MATERIAL, EM FLASHCARDS.",
    sampleTitle: "Seu material ganha vida",
    sampleText: "Envie agora mesmo",
    emailSent: "Enviamos um link seguro para confirmar seu acesso.",
    emailWait:
      "Abra o e-mail neste dispositivo. Depois da confirmação, o PilotAI criará seus flashcards e abrirá a Home.",
    emailSendFailed: "Não foi possível enviar o e-mail agora. Tente novamente em instantes.",
    processing: "Lendo o material e criando seus flashcards…",
    saving: "Salvando seus flashcards…",
    completed: "Seus flashcards foram criados. Vamos abrir a Home.",
    goHome: "Abrir minha Home",
    retry: "Tentar novamente",
    fileTooLarge: "Até 5 MB por arquivo; áudio até 6 MB.",
    tooManyFiles: "Envie um arquivo por vez.",
    fileReadFailed: "Não foi possível ler este arquivo. Tente outro arquivo.",
    stepsTitle: "Menos transcrição. Mais aprendizado.",
    stepsIntro: "Transforme o conteúdo que você já tem em uma rotina de estudos que funciona.",
    steps: [
      {
        title: "Envie ou cole",
        text: "Use fotos, páginas em PDF ou um texto copiado do seu material.",
      },
      {
        title: "Revise com o PilotAI",
        text: "Seu conteúdo vira flashcards claros, organizados para fixar melhor.",
      },
      {
        title: "Aprenda no seu ritmo",
        text: "Revise no app e receba lembretes pelo Telegram no momento certo.",
      },
    ],
    bottomTitle: "Seu próximo capítulo começa com uma página.",
    bottomCta: "Começar a estudar",
    login: "Já tem conta? Entrar",
    footer: "FlashPilot · Aprenda e nunca esqueça.",
    emptyInput: "Envie ao menos um arquivo ou cole algum texto para continuar.",
    invalidEmail: "Informe um e-mail válido.",
  },
  "pt-PT": {
    headlineStart: "Livro, caderno, PDF, fotografia, texto...",
    headlineAccent: "Tudo se transforma em flashcards inteligentes",
    headlineEnd: "Experimente já grátis!",
    intro:
      "Biologia, medicina, direito, idiomas, física, história... O PilotAI transforma o conteúdo em flashcards inteligentes prontos para estudar.",
    telegram:
      "Revisões programadas pelo algoritmo de esquecimento SM-2, com notificações pelo Telegram",
    freeCoins: "40 FlashCoins para novas contas",
    freeTrial: "15 dias de teste",
    noCard: "Sem cartão de crédito",
    uploadTab: "Enviar páginas",
    pasteTab: "Colar texto",
    dropTitle: "Arraste o PDF ou as fotografias para aqui",
    dropHint: "ou escolha ficheiros no seu dispositivo",
    chooseFiles: "Escolher ficheiros",
    pasteImageHint: "Clique aqui e use Ctrl+V ou o botão direito > Colar",
    takePhoto: "Usar câmara",
    cameraTitle: "Capturar imagem",
    switchCamera: "Trocar câmara",
    cancel: "Cancelar",
    capture: "Capturar",
    cameraUnavailable: "Não foi possível aceder à câmara. Verifique a permissão do navegador.",
    guidanceLabel:
      "Quer abordar algum excerto ou conteúdo específico? Caso contrário, deixe em branco",
    guidancePlaceholder: "Ex.: dê mais atenção aos artigos 5.º a 10.º...",
    nameLabel: "O seu nome",
    namePlaceholder: "Como podemos chamar-lhe?",
    invalidName: "Introduza o seu nome.",
    pasteHint: "Cole um excerto do livro, dos apontamentos ou da sebenta...",
    emailLabel: "O seu melhor e-mail",
    emailPlaceholder: "voce@email.com",
    submit: "Criar flashcards agora",
    privacy: "O seu material fica no navegador até confirmar o acesso pelo próprio e-mail.",
    sampleBadge: "O SEU MATERIAL, EM FLASHCARDS.",
    sampleTitle: "O seu material ganha vida",
    sampleText: "Envie agora mesmo",
    emailSent: "Enviámos uma ligação segura para confirmar o seu acesso.",
    emailWait:
      "Abra o e-mail neste dispositivo. Depois da confirmação, o PilotAI criará os seus flashcards e abrirá a Home.",
    emailSendFailed: "Não foi possível enviar o e-mail agora. Tente novamente dentro de instantes.",
    processing: "A ler o material e a criar os seus flashcards…",
    saving: "A guardar os seus flashcards…",
    completed: "Os seus flashcards foram criados. Vamos abrir a Home.",
    goHome: "Abrir a minha Home",
    retry: "Tentar novamente",
    fileTooLarge: "Até 5 MB por ficheiro; áudio até 6 MB.",
    tooManyFiles: "Envie um ficheiro de cada vez.",
    fileReadFailed: "Não foi possível ler este ficheiro. Tente outro ficheiro.",
    stepsTitle: "Menos transcrição. Mais aprendizagem.",
    stepsIntro: "Transforme o conteúdo que já tem numa rotina de estudo que funciona.",
    steps: [
      {
        title: "Envie ou cole",
        text: "Use fotografias, páginas em PDF ou texto copiado do seu material.",
      },
      {
        title: "Reveja com o PilotAI",
        text: "O seu conteúdo transforma-se em flashcards claros, organizados para fixar melhor.",
      },
      {
        title: "Aprenda ao seu ritmo",
        text: "Reveja na aplicação e receba lembretes pelo Telegram no momento certo.",
      },
    ],
    bottomTitle: "O seu próximo capítulo começa com uma página.",
    bottomCta: "Começar a estudar",
    login: "Já tem conta? Entrar",
    footer: "FlashPilot · Aprenda e nunca esqueça.",
    emptyInput: "Envie pelo menos um ficheiro ou cole algum texto para continuar.",
    invalidEmail: "Introduza um e-mail válido.",
  },
  en: {
    headlineStart: "Book, notebook, PDF, photo, text...",
    headlineAccent: "Everything becomes smart flashcards",
    headlineEnd: "Try it free now!",
    intro:
      "Biology, medicine, law, languages, physics, history... PilotAI turns your content into smart flashcards, ready to study.",
    telegram: "Review at the right time with Telegram reminders",
    freeCoins: "40 FlashCoins for new accounts",
    freeTrial: "15-day trial",
    noCard: "No credit card",
    uploadTab: "Upload pages",
    pasteTab: "Paste text",
    dropTitle: "Drop your PDF or photos here",
    dropHint: "or choose files from your device",
    chooseFiles: "Choose files",
    pasteImageHint: "Click here and use Ctrl+V or right-click > Paste",
    takePhoto: "Use camera",
    cameraTitle: "Capture image",
    switchCamera: "Switch camera",
    cancel: "Cancel",
    capture: "Capture",
    cameraUnavailable: "Could not access the camera. Check your browser permission.",
    guidanceLabel:
      "Do you want to focus on any specific passage or content? Otherwise, leave blank",
    guidancePlaceholder: "E.g. focus on articles 5 to 10...",
    nameLabel: "Your name",
    namePlaceholder: "What should we call you?",
    invalidName: "Enter your name.",
    pasteHint: "Paste a passage from a book, handout, or your notes...",
    emailLabel: "Your email address",
    emailPlaceholder: "you@email.com",
    submit: "Create flashcards now",
    privacy: "Your material stays in this browser until you confirm access from your own email.",
    sampleBadge: "YOUR MATERIAL, AS FLASHCARDS.",
    sampleTitle: "Your material comes to life",
    sampleText: "Upload it now",
    emailSent: "We sent a secure link to confirm your access.",
    emailWait:
      "Open the email on this device. After confirmation, PilotAI will create your flashcards and open Home.",
    emailSendFailed: "We could not send the email right now. Please try again in a moment.",
    processing: "Reading your material and creating your flashcards…",
    saving: "Saving your flashcards…",
    completed: "Your flashcards are ready. We are opening Home.",
    goHome: "Open my Home",
    retry: "Try again",
    fileTooLarge: "Up to 5 MB per file; audio up to 6 MB.",
    tooManyFiles: "Upload one file at a time.",
    fileReadFailed: "This file could not be read. Try another file.",
    stepsTitle: "Less transcription. More learning.",
    stepsIntro: "Turn the material you already have into a study routine that works.",
    steps: [
      {
        title: "Upload or paste",
        text: "Use photos, PDF pages, or text copied from your study material.",
      },
      {
        title: "Review with PilotAI",
        text: "Turn your material into clear flashcards designed to help you remember.",
      },
      {
        title: "Learn at your pace",
        text: "Review in the app and get Telegram reminders at the right time.",
      },
    ],
    bottomTitle: "Your next chapter starts with one page.",
    bottomCta: "Start studying",
    login: "Already have an account? Sign in",
    footer: "FlashPilot · Learn and never forget.",
    emptyInput: "Upload at least one file or paste some text to continue.",
    invalidEmail: "Enter a valid email address.",
  },
  es: {
    headlineStart: "Libro, cuaderno, PDF, foto, texto...",
    headlineAccent: "Todo se convierte en flashcards inteligentes",
    headlineEnd: "¡Pruébalo gratis ahora!",
    intro:
      "Biología, medicina, derecho, idiomas, física, historia... PilotAI transforma tu contenido en flashcards inteligentes, listas para estudiar.",
    telegram: "Repasa en el momento justo con notificaciones por Telegram",
    freeCoins: "40 FlashCoins para nuevas cuentas",
    freeTrial: "15 días de prueba",
    noCard: "Sin tarjeta de crédito",
    uploadTab: "Subir páginas",
    pasteTab: "Pegar texto",
    dropTitle: "Arrastra aquí tu PDF o tus fotos",
    dropHint: "o elige archivos de tu dispositivo",
    chooseFiles: "Elegir archivos",
    pasteImageHint: "Haz clic aquí y usa Ctrl+V o clic derecho > Pegar",
    takePhoto: "Usar cámara",
    cameraTitle: "Capturar imagen",
    switchCamera: "Cambiar cámara",
    cancel: "Cancelar",
    capture: "Capturar",
    cameraUnavailable: "No se pudo acceder a la cámara. Comprueba el permiso del navegador.",
    guidanceLabel:
      "¿Quieres abordar algún fragmento o contenido específico? Si no, déjalo en blanco",
    guidancePlaceholder: "Ej.: céntrate en los artículos 5 a 10...",
    nameLabel: "Tu nombre",
    namePlaceholder: "¿Cómo podemos llamarte?",
    invalidName: "Introduce tu nombre.",
    pasteHint: "Pega un fragmento del libro, del temario o de tus apuntes...",
    emailLabel: "Tu mejor correo electrónico",
    emailPlaceholder: "tu@email.com",
    submit: "Crear flashcards ahora",
    privacy:
      "Tu material permanece en este navegador hasta que confirmes el acceso desde tu propio correo.",
    sampleBadge: "TU MATERIAL, EN FLASHCARDS.",
    sampleTitle: "Tu material cobra vida",
    sampleText: "Envíalo ahora mismo",
    emailSent: "Enviamos un enlace seguro para confirmar tu acceso.",
    emailWait:
      "Abre el correo en este dispositivo. Después de confirmar, PilotAI creará tus flashcards y abrirá la Home.",
    emailSendFailed: "No pudimos enviar el correo ahora. Inténtalo de nuevo en unos instantes.",
    processing: "Leyendo tu material y creando tus flashcards…",
    saving: "Guardando tus flashcards…",
    completed: "Tus flashcards están listas. Abriremos la Home.",
    goHome: "Abrir mi Home",
    retry: "Intentar de nuevo",
    fileTooLarge: "Hasta 5 MB por archivo; audio hasta 6 MB.",
    tooManyFiles: "Sube un archivo cada vez.",
    fileReadFailed: "No se pudo leer este archivo. Prueba con otro.",
    stepsTitle: "Menos transcripción. Más aprendizaje.",
    stepsIntro: "Convierte el material que ya tienes en una rutina de estudio eficaz.",
    steps: [
      { title: "Sube o pega", text: "Usa fotos, páginas en PDF o texto copiado de tu material." },
      {
        title: "Repasa con PilotAI",
        text: "Tu contenido se convierte en flashcards claros para recordar mejor.",
      },
      {
        title: "Aprende a tu ritmo",
        text: "Repasa en la app y recibe recordatorios por Telegram en el momento justo.",
      },
    ],
    bottomTitle: "Tu próximo capítulo empieza con una página.",
    bottomCta: "Empezar a estudiar",
    login: "¿Ya tienes cuenta? Inicia sesión",
    footer: "FlashPilot · Aprende y nunca olvides.",
    emptyInput: "Sube al menos un archivo o pega texto para continuar.",
    invalidEmail: "Introduce un correo electrónico válido.",
  },
  fr: {
    headlineStart: "Livre, cahier, PDF, photo, texte...",
    headlineAccent: "Tout devient des flashcards intelligentes",
    headlineEnd: "Essayez gratuitement maintenant !",
    intro:
      "Biologie, médecine, droit, langues, physique, histoire... PilotAI transforme votre contenu en cartes mémoire intelligentes, prêtes à réviser.",
    telegram: "Révisez au bon moment grâce aux notifications Telegram",
    freeCoins: "40 FlashCoins pour les nouveaux comptes",
    freeTrial: "15 jours d’essai",
    noCard: "Sans carte bancaire",
    uploadTab: "Importer des pages",
    pasteTab: "Coller du texte",
    dropTitle: "Déposez votre PDF ou vos photos ici",
    dropHint: "ou choisissez des fichiers sur votre appareil",
    chooseFiles: "Choisir des fichiers",
    pasteImageHint: "Cliquez ici et utilisez Ctrl+V ou clic droit > Coller",
    takePhoto: "Utiliser la caméra",
    cameraTitle: "Capturer une image",
    switchCamera: "Changer de caméra",
    cancel: "Annuler",
    capture: "Capturer",
    cameraUnavailable: "Impossible d’accéder à la caméra. Vérifiez l’autorisation du navigateur.",
    guidanceLabel:
      "Souhaitez-vous aborder un passage ou un contenu spécifique ? Sinon, laissez vide",
    guidancePlaceholder: "Ex. : concentrez-vous sur les articles 5 à 10...",
    nameLabel: "Votre nom",
    namePlaceholder: "Comment pouvons-nous vous appeler ?",
    invalidName: "Saisissez votre nom.",
    pasteHint: "Collez un extrait de livre, de cours ou de vos notes...",
    emailLabel: "Votre adresse e-mail",
    emailPlaceholder: "vous@email.com",
    submit: "Créer des flashcards maintenant",
    privacy:
      "Votre contenu reste dans ce navigateur jusqu’à la confirmation de l’accès depuis votre propre e-mail.",
    sampleBadge: "VOTRE CONTENU, EN FLASHCARDS.",
    sampleTitle: "Votre contenu prend vie",
    sampleText: "Envoyez-le dès maintenant",
    emailSent: "Nous avons envoyé un lien sécurisé pour confirmer votre accès.",
    emailWait:
      "Ouvrez l’e-mail sur cet appareil. Après la confirmation, PilotAI créera vos flashcards et ouvrira l’accueil.",
    emailSendFailed: "Impossible d’envoyer l’e-mail pour le moment. Réessayez dans un instant.",
    processing: "Lecture du contenu et création de vos flashcards…",
    saving: "Enregistrement de vos flashcards…",
    completed: "Vos flashcards sont prêtes. Nous ouvrons l’accueil.",
    goHome: "Ouvrir mon accueil",
    retry: "Réessayer",
    fileTooLarge: "5 Mo maximum par fichier ; audio jusqu’à 6 Mo.",
    tooManyFiles: "Envoyez un fichier à la fois.",
    fileReadFailed: "Impossible de lire ce fichier. Essayez-en un autre.",
    stepsTitle: "Moins de transcription. Plus d’apprentissage.",
    stepsIntro: "Transformez vos supports en une routine d’étude qui vous correspond.",
    steps: [
      {
        title: "Importez ou collez",
        text: "Utilisez des photos, des pages PDF ou du texte de vos supports.",
      },
      {
        title: "Révisez avec PilotAI",
        text: "Votre contenu devient des flashcards claires pour mieux mémoriser.",
      },
      {
        title: "Apprenez à votre rythme",
        text: "Révisez dans l’application et recevez des rappels Telegram au bon moment.",
      },
    ],
    bottomTitle: "Votre prochain chapitre commence par une page.",
    bottomCta: "Commencer à étudier",
    login: "Vous avez déjà un compte ? Connexion",
    footer: "FlashPilot · Apprenez et n’oubliez jamais.",
    emptyInput: "Importez au moins un fichier ou collez du texte pour continuer.",
    invalidEmail: "Saisissez une adresse e-mail valide.",
  },
  it: {
    headlineStart: "Libro, quaderno, PDF, foto, testo...",
    headlineAccent: "Tutto diventa flashcard intelligenti",
    headlineEnd: "Provalo ora gratis!",
    intro:
      "Biologia, medicina, diritto, lingue, fisica, storia... PilotAI trasforma i tuoi contenuti in flashcard intelligenti, pronte da studiare.",
    telegram: "Ripassa al momento giusto con le notifiche Telegram",
    freeCoins: "40 FlashCoins per i nuovi account",
    freeTrial: "15 giorni di prova",
    noCard: "Nessuna carta di credito",
    uploadTab: "Carica pagine",
    pasteTab: "Incolla testo",
    dropTitle: "Trascina qui il PDF o le foto",
    dropHint: "oppure scegli i file dal tuo dispositivo",
    chooseFiles: "Scegli file",
    pasteImageHint: "Fai clic qui e usa Ctrl+V o clic destro > Incolla",
    takePhoto: "Usa fotocamera",
    cameraTitle: "Cattura immagine",
    switchCamera: "Cambia fotocamera",
    cancel: "Annulla",
    capture: "Acquisisci",
    cameraUnavailable: "Impossibile accedere alla fotocamera. Verifica il permesso del browser.",
    guidanceLabel:
      "Vuoi approfondire un passaggio o un contenuto specifico? Altrimenti, lascia vuoto",
    guidancePlaceholder: "Es.: concentrati sugli articoli 5-10...",
    nameLabel: "Il tuo nome",
    namePlaceholder: "Come possiamo chiamarti?",
    invalidName: "Inserisci il tuo nome.",
    pasteHint: "Incolla un passaggio del libro, delle dispense o dei tuoi appunti...",
    emailLabel: "Il tuo indirizzo e-mail",
    emailPlaceholder: "tu@email.com",
    submit: "Crea flashcard ora",
    privacy:
      "Il materiale resta in questo browser finché non confermi l’accesso dal tuo indirizzo e-mail.",
    sampleBadge: "IL TUO MATERIALE, IN FLASHCARD.",
    sampleTitle: "Il tuo materiale prende vita",
    sampleText: "Invialo subito",
    emailSent: "Abbiamo inviato un link sicuro per confermare il tuo accesso.",
    emailWait:
      "Apri l’e-mail su questo dispositivo. Dopo la conferma, PilotAI creerà le tue flashcard e aprirà la Home.",
    emailSendFailed: "Non è stato possibile inviare l’e-mail. Riprova tra poco.",
    processing: "Lettura del materiale e creazione delle flashcard…",
    saving: "Salvataggio delle flashcard…",
    completed: "Le tue flashcard sono pronte. Apriremo la Home.",
    goHome: "Apri la mia Home",
    retry: "Riprova",
    fileTooLarge: "Fino a 5 MB per file; audio fino a 6 MB.",
    tooManyFiles: "Carica un file alla volta.",
    fileReadFailed: "Non è stato possibile leggere questo file. Provane un altro.",
    stepsTitle: "Meno trascrizione. Più apprendimento.",
    stepsIntro: "Trasforma il materiale che hai già in una routine di studio efficace.",
    steps: [
      {
        title: "Carica o incolla",
        text: "Usa foto, pagine PDF o testo copiato dal tuo materiale.",
      },
      {
        title: "Ripassa con PilotAI",
        text: "I tuoi contenuti diventano flashcard chiari per ricordare meglio.",
      },
      {
        title: "Impara al tuo ritmo",
        text: "Ripassa nell’app e ricevi promemoria Telegram al momento giusto.",
      },
    ],
    bottomTitle: "Il tuo prossimo capitolo inizia da una pagina.",
    bottomCta: "Inizia a studiare",
    login: "Hai già un account? Accedi",
    footer: "FlashPilot · Impara e non dimenticare.",
    emptyInput: "Carica almeno un file o incolla del testo per continuare.",
    invalidEmail: "Inserisci un indirizzo e-mail valido.",
  },
  de: {
    headlineStart: "Buch, Heft, PDF, Foto, Text...",
    headlineAccent: "Alles wird zu smarten Karteikarten",
    headlineEnd: "Jetzt kostenlos testen!",
    intro:
      "Biologie, Medizin, Recht, Sprachen, Physik, Geschichte... PilotAI verwandelt deine Inhalte in intelligente Karteikarten, die sofort lernbereit sind.",
    telegram: "Wiederhole zum richtigen Zeitpunkt mit Telegram-Erinnerungen",
    freeCoins: "40 FlashCoins für neue Konten",
    freeTrial: "15 Tage testen",
    noCard: "Keine Kreditkarte",
    uploadTab: "Seiten hochladen",
    pasteTab: "Text einfügen",
    dropTitle: "Ziehe dein PDF oder deine Fotos hierher",
    dropHint: "oder wähle Dateien von deinem Gerät",
    chooseFiles: "Dateien auswählen",
    pasteImageHint: "Klicke hier und nutze Strg+V oder Rechtsklick > Einfügen",
    takePhoto: "Kamera verwenden",
    cameraTitle: "Bild aufnehmen",
    switchCamera: "Kamera wechseln",
    cancel: "Abbrechen",
    capture: "Aufnehmen",
    cameraUnavailable: "Die Kamera konnte nicht geöffnet werden. Prüfe die Browser-Berechtigung.",
    guidanceLabel:
      "Möchtest du einen bestimmten Abschnitt oder Inhalt behandeln? Sonst leer lassen",
    guidancePlaceholder: "Z. B. konzentriere dich auf die Artikel 5–10...",
    nameLabel: "Dein Name",
    namePlaceholder: "Wie dürfen wir dich nennen?",
    invalidName: "Gib deinen Namen ein.",
    pasteHint: "Füge einen Abschnitt aus einem Buch, Skript oder deinen Notizen ein...",
    emailLabel: "Deine E-Mail-Adresse",
    emailPlaceholder: "du@email.com",
    submit: "Jetzt Karteikarten erstellen",
    privacy:
      "Dein Material bleibt in diesem Browser, bis du den Zugang über deine eigene E-Mail bestätigst.",
    sampleBadge: "DEIN MATERIAL, ALS KARTEIKARTEN.",
    sampleTitle: "Dein Lernstoff wird lebendig",
    sampleText: "Jetzt hochladen",
    emailSent: "Wir haben einen sicheren Link zur Bestätigung deines Zugangs gesendet.",
    emailWait:
      "Öffne die E-Mail auf diesem Gerät. Nach der Bestätigung erstellt PilotAI deine Karteikarten und öffnet die Startseite.",
    emailSendFailed:
      "Die E-Mail konnte gerade nicht gesendet werden. Versuche es gleich noch einmal.",
    processing: "Material wird gelesen und Karteikarten werden erstellt…",
    saving: "Karteikarten werden gespeichert…",
    completed: "Deine Karteikarten sind fertig. Wir öffnen die Startseite.",
    goHome: "Meine Startseite öffnen",
    retry: "Erneut versuchen",
    fileTooLarge: "Bis zu 5 MB pro Datei; Audio bis zu 6 MB.",
    tooManyFiles: "Lade eine Datei nach der anderen hoch.",
    fileReadFailed: "Diese Datei konnte nicht gelesen werden. Versuche eine andere.",
    stepsTitle: "Weniger Abschreiben. Mehr Lernen.",
    stepsIntro: "Mach aus deinem Lernmaterial eine Lernroutine, die funktioniert.",
    steps: [
      {
        title: "Hochladen oder einfügen",
        text: "Nutze Fotos, PDF-Seiten oder kopierten Text aus deinem Lernmaterial.",
      },
      {
        title: "Mit PilotAI wiederholen",
        text: "Dein Inhalt wird zu klaren Karteikarten, die das Erinnern erleichtern.",
      },
      {
        title: "In deinem Tempo lernen",
        text: "Wiederhole in der App und erhalte Telegram-Erinnerungen zum richtigen Zeitpunkt.",
      },
    ],
    bottomTitle: "Dein nächstes Kapitel beginnt mit einer Seite.",
    bottomCta: "Jetzt lernen",
    login: "Schon ein Konto? Anmelden",
    footer: "FlashPilot · Lerne und vergiss nie.",
    emptyInput: "Lade mindestens eine Datei hoch oder füge Text ein, um fortzufahren.",
    invalidEmail: "Gib eine gültige E-Mail-Adresse ein.",
  },
};

export function landingLegacyCopy(lang: string, overlay?: Record<string, string>): LandingCopy {
  if (isLang(lang)) return LANDING_COPY[lang];
  return overlay
    ? applyDeepDictOverlay(LANDING_COPY.en, overlay, "landingCapture")
    : LANDING_COPY.en;
}
