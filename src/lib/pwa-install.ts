import { applyDeepDictOverlay } from "./app-ext-langs";

export const INSTALL_DISMISSED_KEY = "flashpilot:install-dismissed";
export const INSTALL_DISMISS_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** Dismissal is a timestamp that expires; legacy permanent values ("1") or bad data are ignored. */
export function isDismissalActive(raw: string | null, now = Date.now()) {
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at) || at < 1e12) return false;
  return now - at >= 0 && now - at < INSTALL_DISMISS_TTL_MS;
}

export function installPlatform(userAgent: string, touchPoints = 0): "ios" | "android" | null {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1)) {
    return /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent) ? "ios" : null;
  }
  return /Android/i.test(userAgent) ? "android" : null;
}

export function shouldOfferInstall(
  path: string,
  platform: string | null,
  standalone: boolean,
  dismissed: boolean,
) {
  return (path === "/" || path === "/auth") && platform !== null && !standalone && !dismissed;
}

type Copy = {
  title: string;
  body: string;
  install: string;
  close: string;
  share: string;
  add: string;
  confirm: string;
  android: string;
  success: string;
};
const copy: Record<string, Copy> = {
  pt: {
    title: "FlashPilot na sua tela inicial",
    body: "Instale o app ou continue usando pelo navegador.",
    install: "Instalar FlashPilot",
    close: "Continuar pelo navegador",
    share: "Toque em Compartilhar no Safari (quadrado com seta para cima).",
    add: "Escolha “Adicionar à Tela de Início”. Se necessário, role a lista de opções.",
    confirm: "Toque em “Adicionar” para confirmar.",
    android:
      "No menu ⋮ do navegador, escolha “Instalar aplicativo” ou “Adicionar à tela inicial” e confirme. A opção depende do navegador.",
    success:
      "O ícone do Flashpilot será exibido na tela do seu dispositivo em alguns segundos. Você já pode fechar essa tela.",
  },
  "pt-PT": {
    title: "FlashPilot no seu ecrã inicial",
    body: "Instale a aplicação ou continue a usar o navegador.",
    install: "Instalar FlashPilot",
    close: "Continuar no navegador",
    share: "Toque em Partilhar no Safari (quadrado com seta para cima).",
    add: "Escolha “Adicionar ao ecrã principal”. Se necessário, percorra a lista de opções.",
    confirm: "Toque em “Adicionar” para confirmar.",
    android:
      "No menu ⋮ do navegador, escolha “Instalar aplicação” ou “Adicionar ao ecrã principal” e confirme. A opção depende do navegador.",
    success:
      "O ícone do Flashpilot será exibido no ecrã do seu dispositivo em alguns segundos. Já pode fechar este ecrã.",
  },
  en: {
    title: "FlashPilot on your home screen",
    body: "Install the app or keep using your browser.",
    install: "Install FlashPilot",
    close: "Continue in browser",
    share: "Tap Share in Safari (square with an upward arrow).",
    add: "Choose “Add to Home Screen”. Scroll through the options if needed.",
    confirm: "Tap “Add” to confirm.",
    android:
      "In your browser’s ⋮ menu, choose “Install app” or “Add to Home screen” and confirm. Availability depends on your browser.",
    success:
      "The Flashpilot icon will appear on your device’s home screen in a few seconds. You can now close this screen.",
  },
  es: {
    title: "FlashPilot en tu pantalla de inicio",
    body: "Instala la app o sigue usando el navegador.",
    install: "Instalar FlashPilot",
    close: "Continuar en el navegador",
    share: "Toca Compartir en Safari (cuadrado con flecha hacia arriba).",
    add: "Elige “Añadir a pantalla de inicio”. Desplázate por las opciones si es necesario.",
    confirm: "Toca “Añadir” para confirmar.",
    android:
      "En el menú ⋮ del navegador, elige “Instalar aplicación” o “Añadir a pantalla de inicio” y confirma. Depende del navegador.",
    success:
      "El icono de Flashpilot se mostrará en la pantalla de tu dispositivo en unos segundos. Ya puedes cerrar esta pantalla.",
  },
  fr: {
    title: "FlashPilot sur votre écran d’accueil",
    body: "Installez l’application ou continuez dans le navigateur.",
    install: "Installer FlashPilot",
    close: "Continuer dans le navigateur",
    share: "Touchez Partager dans Safari (carré avec flèche vers le haut).",
    add: "Choisissez “Sur l’écran d’accueil”. Faites défiler les options si nécessaire.",
    confirm: "Touchez “Ajouter” pour confirmer.",
    android:
      "Dans le menu ⋮ du navigateur, choisissez “Installer l’application” ou “Ajouter à l’écran d’accueil”, puis confirmez. Selon votre navigateur.",
    success:
      "L’icône Flashpilot s’affichera sur l’écran de votre appareil dans quelques secondes. Vous pouvez fermer cet écran.",
  },
  it: {
    title: "FlashPilot sulla schermata Home",
    body: "Installa l’app oppure continua nel browser.",
    install: "Installa FlashPilot",
    close: "Continua nel browser",
    share: "Tocca Condividi in Safari (quadrato con freccia verso l’alto).",
    add: "Scegli “Aggiungi alla schermata Home”. Scorri le opzioni se necessario.",
    confirm: "Tocca “Aggiungi” per confermare.",
    android:
      "Nel menu ⋮ del browser, scegli “Installa app” o “Aggiungi a schermata Home” e conferma. Dipende dal browser.",
    success:
      "L’icona di Flashpilot apparirà sulla schermata del dispositivo tra qualche secondo. Ora puoi chiudere questa schermata.",
  },
  de: {
    title: "FlashPilot auf deinem Startbildschirm",
    body: "Installiere die App oder nutze weiterhin den Browser.",
    install: "FlashPilot installieren",
    close: "Im Browser fortfahren",
    share: "Tippe in Safari auf Teilen (Quadrat mit Pfeil nach oben).",
    add: "Wähle „Zum Home-Bildschirm“. Scrolle bei Bedarf durch die Optionen.",
    confirm: "Tippe zur Bestätigung auf „Hinzufügen“.",
    android:
      "Wähle im ⋮-Menü des Browsers „App installieren“ oder „Zum Startbildschirm hinzufügen“ und bestätige. Die Option hängt vom Browser ab.",
    success:
      "Das Flashpilot-Symbol wird in wenigen Sekunden auf dem Startbildschirm deines Geräts angezeigt. Du kannst diesen Bildschirm jetzt schließen.",
  },
};
export const INSTALL_COPY_EN = copy.en!;

export function installCopy(lang: string, overlay?: Record<string, string>) {
  const base = copy[lang] ?? copy.en!;
  return overlay ? applyDeepDictOverlay(base, overlay, "pwa") : base;
}
