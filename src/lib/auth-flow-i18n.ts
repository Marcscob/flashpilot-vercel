import { getUiOverlay } from "./i18n-ui";
export type AuthFlowCopy = {
  forgot: string;
  notFoundTitle: string;
  notFoundBody: (email: string) => string;
  createAccount: string;
  tryOther: string;
  confirmTitle: string;
  confirmBody: (email: string) => string;
  confirmSpam: string;
  gotIt: string;
  resetTitle: string;
  resetBody: string;
  sendLink: string;
  resetSent: string;
  newPasswordTitle: string;
  newPassword: string;
  confirmPassword: string;
  savePassword: string;
  mismatch: string;
  passwordUpdated: string;
  invalidLink: string;
  backToLogin: string;
  cancel: string;
};

const pt: AuthFlowCopy = {
  forgot: "Esqueci minha senha",
  notFoundTitle: "Conta não encontrada",
  notFoundBody: (e) => `Não existe nenhuma conta no FlashPilot com o e-mail ${e}. Deseja criar uma conta nova com este e-mail?`,
  createAccount: "Criar minha conta",
  tryOther: "Tentar outro e-mail",
  confirmTitle: "Quase pronto! Ative seu acesso",
  confirmBody: (e) => `Enviamos um link de ativação para ${e}. Abra sua caixa de e-mail e clique no link para ativar seu acesso.`,
  confirmSpam: "Não encontrou? Verifique também a pasta de spam ou lixo eletrônico.",
  gotIt: "Entendi",
  resetTitle: "Recuperar senha",
  resetBody: "Informe seu e-mail. Enviaremos um link para você criar uma nova senha.",
  sendLink: "Enviar link",
  resetSent: "Se houver uma conta com este e-mail, você receberá o link em instantes. Verifique também o spam.",
  newPasswordTitle: "Criar nova senha",
  newPassword: "Nova senha",
  confirmPassword: "Confirmar nova senha",
  savePassword: "Salvar nova senha",
  mismatch: "As senhas não coincidem.",
  passwordUpdated: "Senha atualizada com sucesso!",
  invalidLink: "Link inválido ou expirado. Peça um novo link na tela de login.",
  backToLogin: "Voltar ao login",
  cancel: "Cancelar",
};

const COPY: Record<string, AuthFlowCopy> = {
  pt,
  "pt-PT": {
    ...pt,
    forgot: "Esqueci-me da palavra-passe",
    notFoundBody: (e) => `Não existe nenhuma conta no FlashPilot com o e-mail ${e}. Pretende criar uma conta nova com este e-mail?`,
    confirmTitle: "Quase pronto! Ative o seu acesso",
    confirmBody: (e) => `Enviámos uma ligação de ativação para ${e}. Abra a sua caixa de correio e clique na ligação para ativar o seu acesso.`,
    confirmSpam: "Não encontrou? Verifique também a pasta de spam ou lixo.",
    resetTitle: "Recuperar palavra-passe",
    resetBody: "Indique o seu e-mail. Enviaremos uma ligação para criar uma nova palavra-passe.",
    sendLink: "Enviar ligação",
    resetSent: "Se existir uma conta com este e-mail, receberá a ligação em instantes. Verifique também o spam.",
    newPasswordTitle: "Criar nova palavra-passe",
    newPassword: "Nova palavra-passe",
    confirmPassword: "Confirmar nova palavra-passe",
    savePassword: "Guardar nova palavra-passe",
    mismatch: "As palavras-passe não coincidem.",
    passwordUpdated: "Palavra-passe atualizada com sucesso!",
    invalidLink: "Ligação inválida ou expirada. Peça uma nova no ecrã de início de sessão.",
    backToLogin: "Voltar ao início de sessão",
  },
  en: {
    forgot: "Forgot my password",
    notFoundTitle: "Account not found",
    notFoundBody: (e) => `There is no FlashPilot account with the email ${e}. Would you like to create a new account with this email?`,
    createAccount: "Create my account",
    tryOther: "Try another email",
    confirmTitle: "Almost there! Activate your access",
    confirmBody: (e) => `We sent an activation link to ${e}. Open your inbox and click the link to activate your access.`,
    confirmSpam: "Can't find it? Please also check your spam or junk folder.",
    gotIt: "Got it",
    resetTitle: "Reset password",
    resetBody: "Enter your email. We'll send you a link to create a new password.",
    sendLink: "Send link",
    resetSent: "If an account exists with this email, you'll receive the link shortly. Check your spam too.",
    newPasswordTitle: "Create a new password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    savePassword: "Save new password",
    mismatch: "Passwords don't match.",
    passwordUpdated: "Password updated successfully!",
    invalidLink: "Invalid or expired link. Request a new one from the sign-in screen.",
    backToLogin: "Back to sign in",
    cancel: "Cancel",
  },
  es: {
    forgot: "Olvidé mi contraseña",
    notFoundTitle: "Cuenta no encontrada",
    notFoundBody: (e) => `No existe ninguna cuenta de FlashPilot con el correo ${e}. ¿Quieres crear una cuenta nueva con este correo?`,
    createAccount: "Crear mi cuenta",
    tryOther: "Probar otro correo",
    confirmTitle: "¡Casi listo! Activa tu acceso",
    confirmBody: (e) => `Enviamos un enlace de activación a ${e}. Abre tu bandeja de entrada y haz clic en el enlace para activar tu acceso.`,
    confirmSpam: "¿No lo encuentras? Revisa también la carpeta de spam o correo no deseado.",
    gotIt: "Entendido",
    resetTitle: "Recuperar contraseña",
    resetBody: "Indica tu correo. Te enviaremos un enlace para crear una nueva contraseña.",
    sendLink: "Enviar enlace",
    resetSent: "Si existe una cuenta con este correo, recibirás el enlace en breve. Revisa también el spam.",
    newPasswordTitle: "Crear nueva contraseña",
    newPassword: "Nueva contraseña",
    confirmPassword: "Confirmar nueva contraseña",
    savePassword: "Guardar nueva contraseña",
    mismatch: "Las contraseñas no coinciden.",
    passwordUpdated: "¡Contraseña actualizada!",
    invalidLink: "Enlace inválido o caducado. Solicita uno nuevo en la pantalla de inicio de sesión.",
    backToLogin: "Volver al inicio de sesión",
    cancel: "Cancelar",
  },
  fr: {
    forgot: "Mot de passe oublié",
    notFoundTitle: "Compte introuvable",
    notFoundBody: (e) => `Aucun compte FlashPilot n'existe avec l'e-mail ${e}. Voulez-vous créer un nouveau compte avec cet e-mail ?`,
    createAccount: "Créer mon compte",
    tryOther: "Essayer un autre e-mail",
    confirmTitle: "Presque fini ! Activez votre accès",
    confirmBody: (e) => `Nous avons envoyé un lien d'activation à ${e}. Ouvrez votre boîte de réception et cliquez sur le lien pour activer votre accès.`,
    confirmSpam: "Vous ne le trouvez pas ? Vérifiez aussi votre dossier spam ou courrier indésirable.",
    gotIt: "Compris",
    resetTitle: "Réinitialiser le mot de passe",
    resetBody: "Indiquez votre e-mail. Nous vous enverrons un lien pour créer un nouveau mot de passe.",
    sendLink: "Envoyer le lien",
    resetSent: "Si un compte existe avec cet e-mail, vous recevrez le lien sous peu. Vérifiez aussi les spams.",
    newPasswordTitle: "Créer un nouveau mot de passe",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le nouveau mot de passe",
    savePassword: "Enregistrer le mot de passe",
    mismatch: "Les mots de passe ne correspondent pas.",
    passwordUpdated: "Mot de passe mis à jour !",
    invalidLink: "Lien invalide ou expiré. Demandez-en un nouveau depuis l'écran de connexion.",
    backToLogin: "Retour à la connexion",
    cancel: "Annuler",
  },
  it: {
    forgot: "Ho dimenticato la password",
    notFoundTitle: "Account non trovato",
    notFoundBody: (e) => `Non esiste alcun account FlashPilot con l'e-mail ${e}. Vuoi creare un nuovo account con questa e-mail?`,
    createAccount: "Crea il mio account",
    tryOther: "Prova un'altra e-mail",
    confirmTitle: "Quasi fatto! Attiva il tuo accesso",
    confirmBody: (e) => `Abbiamo inviato un link di attivazione a ${e}. Apri la tua casella di posta e clicca sul link per attivare l'accesso.`,
    confirmSpam: "Non lo trovi? Controlla anche la cartella spam o posta indesiderata.",
    gotIt: "Ho capito",
    resetTitle: "Recupera password",
    resetBody: "Inserisci la tua e-mail. Ti invieremo un link per creare una nuova password.",
    sendLink: "Invia link",
    resetSent: "Se esiste un account con questa e-mail, riceverai il link a breve. Controlla anche lo spam.",
    newPasswordTitle: "Crea una nuova password",
    newPassword: "Nuova password",
    confirmPassword: "Conferma nuova password",
    savePassword: "Salva nuova password",
    mismatch: "Le password non coincidono.",
    passwordUpdated: "Password aggiornata!",
    invalidLink: "Link non valido o scaduto. Richiedine uno nuovo dalla schermata di accesso.",
    backToLogin: "Torna all'accesso",
    cancel: "Annulla",
  },
  de: {
    forgot: "Passwort vergessen",
    notFoundTitle: "Konto nicht gefunden",
    notFoundBody: (e) => `Es gibt kein FlashPilot-Konto mit der E-Mail ${e}. Möchtest du mit dieser E-Mail ein neues Konto erstellen?`,
    createAccount: "Mein Konto erstellen",
    tryOther: "Andere E-Mail versuchen",
    confirmTitle: "Fast geschafft! Aktiviere deinen Zugang",
    confirmBody: (e) => `Wir haben einen Aktivierungslink an ${e} gesendet. Öffne dein Postfach und klicke auf den Link, um deinen Zugang zu aktivieren.`,
    confirmSpam: "Nicht gefunden? Prüfe bitte auch deinen Spam- oder Junk-Ordner.",
    gotIt: "Verstanden",
    resetTitle: "Passwort zurücksetzen",
    resetBody: "Gib deine E-Mail ein. Wir senden dir einen Link, um ein neues Passwort zu erstellen.",
    sendLink: "Link senden",
    resetSent: "Falls ein Konto mit dieser E-Mail existiert, erhältst du den Link in Kürze. Prüfe auch den Spam.",
    newPasswordTitle: "Neues Passwort erstellen",
    newPassword: "Neues Passwort",
    confirmPassword: "Neues Passwort bestätigen",
    savePassword: "Neues Passwort speichern",
    mismatch: "Die Passwörter stimmen nicht überein.",
    passwordUpdated: "Passwort aktualisiert!",
    invalidLink: "Ungültiger oder abgelaufener Link. Fordere auf der Anmeldeseite einen neuen an.",
    backToLogin: "Zurück zur Anmeldung",
    cancel: "Abbrechen",
  },
};

/** Textos em inglês com {email} — fonte do script de tradução dos idiomas extras. */
export const AUTH_FLOW_SOURCE: Record<string, string> = Object.fromEntries(
  Object.entries(COPY.en!).map(([k, v]) => [k, typeof v === "function" ? (v as (e: string) => string)("{email}") : v]),
);

export function authFlowCopy(lang: string): AuthFlowCopy {
  const base = COPY[lang] ?? COPY.en!;
  const ov = lang !== "en" ? getUiOverlay() : null;
  if (!ov) return base;
  const out: any = { ...base };
  for (const k of Object.keys(AUTH_FLOW_SOURCE)) {
    const tr = ov[`af:${k}`];
    if (!tr) continue;
    out[k] = typeof (base as any)[k] === "function" ? (e: string) => tr.split("{email}").join(e) : tr;
  }
  return out;
}
