import { applyDeepDictOverlay } from "./app-ext-langs";
import { isLang, type Lang } from "./lang-match";

type PilotCopy = {
  label: string;
  help: string;
  needOne: string;
  question: string;
  none: string;
};

export const LANDING_PILOT_COPY: Record<Lang, PilotCopy> = {
  pt: {
    label: "ImagePilot: usar a própria imagem",
    help: "Ideal para imagens de órgãos em medicina, estruturas em biologia e outras matérias que exijam que o flashcard contenha imagem.",
    needOne: "Para o ImagePilot, envie exatamente 1 imagem.",
    question: "Qual é o item nº {n} na imagem?",
    none: "O PilotAI não encontrou estruturas identificáveis nesta imagem.",
  },
  "pt-PT": {
    label: "ImagePilot: usar a própria imagem",
    help: "Ideal para imagens de órgãos em medicina, estruturas em biologia e outras matérias que exijam que o flashcard contenha imagem.",
    needOne: "Para o ImagePilot, envie exatamente 1 imagem.",
    question: "Qual é o item n.º {n} na imagem?",
    none: "O PilotAI não encontrou estruturas identificáveis nesta imagem.",
  },
  en: {
    label: "ImagePilot: use the image itself",
    help: "Ideal for images of organs in medicine, structures in biology and other subjects that require the flashcard to contain an image.",
    needOne: "For ImagePilot, upload exactly 1 image.",
    question: "What is item no. {n} in the image?",
    none: "PilotAI found no identifiable structures in this image.",
  },
  es: {
    label: "ImagePilot: usar la propia imagen",
    help: "Ideal para imágenes de órganos en medicina, estructuras en biología y otras materias que requieran que la flashcard contenga una imagen.",
    needOne: "Para ImagePilot, sube exactamente 1 imagen.",
    question: "¿Cuál es el elemento n.º {n} de la imagen?",
    none: "PilotAI no encontró estructuras identificables en esta imagen.",
  },
  fr: {
    label: "ImagePilot : utiliser l'image elle-même",
    help: "Idéal pour les images d'organes en médecine, de structures en biologie et d'autres matières exigeant que la flashcard contienne une image.",
    needOne: "Pour ImagePilot, envoyez exactement 1 image.",
    question: "Quel est l'élément n° {n} de l'image ?",
    none: "PilotAI n'a trouvé aucune structure identifiable dans cette image.",
  },
  it: {
    label: "ImagePilot: usa l'immagine stessa",
    help: "Ideale per immagini di organi in medicina, strutture in biologia e altre materie che richiedono che la flashcard contenga un'immagine.",
    needOne: "Per ImagePilot, carica esattamente 1 immagine.",
    question: "Qual è l'elemento n. {n} nell'immagine?",
    none: "PilotAI non ha trovato strutture identificabili in questa immagine.",
  },
  de: {
    label: "ImagePilot: das Bild selbst verwenden",
    help: "Ideal für Bilder von Organen in der Medizin, Strukturen in der Biologie und andere Fächer, bei denen die Karteikarte ein Bild enthalten muss.",
    needOne: "Für ImagePilot lade genau 1 Bild hoch.",
    question: "Was ist Element Nr. {n} im Bild?",
    none: "PilotAI hat in diesem Bild keine erkennbaren Strukturen gefunden.",
  },
};

export function landingPilotCopy(lang: string, overlay?: Record<string, string>): PilotCopy {
  if (isLang(lang)) return LANDING_PILOT_COPY[lang];
  return overlay
    ? applyDeepDictOverlay(LANDING_PILOT_COPY.en, overlay, "landingPilot")
    : LANDING_PILOT_COPY.en;
}
