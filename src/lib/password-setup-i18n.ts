import { getUiOverlay } from "./i18n-ui";
type Copy = { title: string; body: string; later: string; error: string };
const copy: Record<string, Copy> = {
  pt: { title: "Crie sua senha", body: "Sua conta ainda não tem senha. Crie uma para entrar também com e-mail e senha.", later: "Agora não", error: "Não foi possível salvar sua senha. Tente novamente." },
  "pt-PT": { title: "Crie a sua palavra-passe", body: "A sua conta ainda não tem palavra-passe. Crie uma para entrar também com e-mail e palavra-passe.", later: "Agora não", error: "Não foi possível guardar a sua palavra-passe. Tente novamente." },
  en: { title: "Create your password", body: "Your account does not have a password yet. Create one to also sign in with email and password.", later: "Not now", error: "Your password could not be saved. Please try again." },
  es: { title: "Crea tu contraseña", body: "Tu cuenta aún no tiene contraseña. Crea una para entrar también con correo y contraseña.", later: "Ahora no", error: "No se pudo guardar tu contraseña. Inténtalo de nuevo." },
  fr: { title: "Créez votre mot de passe", body: "Votre compte n’a pas encore de mot de passe. Créez-en un pour vous connecter aussi avec votre e-mail et votre mot de passe.", later: "Pas maintenant", error: "Impossible d’enregistrer votre mot de passe. Réessayez." },
  it: { title: "Crea la tua password", body: "Il tuo account non ha ancora una password. Creane una per accedere anche con e-mail e password.", later: "Non ora", error: "Impossibile salvare la password. Riprova." },
  de: { title: "Erstelle dein Passwort", body: "Dein Konto hat noch kein Passwort. Erstelle eines, um dich auch mit E-Mail und Passwort anzumelden.", later: "Nicht jetzt", error: "Dein Passwort konnte nicht gespeichert werden. Bitte versuche es erneut." },
};
export function passwordSetupCopy(lang: string, extended = false): Copy {
  const base = copy[extended ? "en" : lang] ?? copy.en;
  const overlay = getUiOverlay();
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, overlay?.[`ps:${key}`] ?? value])) as Copy;
}
