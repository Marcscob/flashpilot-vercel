export type CardCase = {
  id: string;
  text: string;
  /** Código do idioma de saída pedido ao app. */
  lang: string;
  language: string;
  minCards: number;
};

export const CARD_CASES: CardCase[] = [
  {
    id: "pt-lei-prazos",
    lang: "pt",
    language: "Brazilian Portuguese",
    minCards: 6,
    text: `Art. 5º do Código de Processo Civil (exemplo didático). O prazo para contestar é de 15 dias úteis, contados da audiência de conciliação ou da última sessão de mediação, ou da juntada do mandado de citação, conforme o caso. O prazo para apelar é de 15 dias úteis. Os embargos de declaração têm prazo de 5 dias úteis e interrompem o prazo para outros recursos. A Fazenda Pública tem prazo em dobro para todas as manifestações processuais, salvo se a lei estabelecer prazo próprio. O Ministério Público também tem prazo em dobro. Os prazos só se contam em dias úteis, excluindo-se o dia do começo e incluindo-se o dia do vencimento. Se o vencimento cair em dia sem expediente forense, prorroga-se até o primeiro dia útil seguinte.`,
  },
  {
    id: "en-photosynthesis",
    lang: "en",
    language: "English",
    minCards: 6,
    text: `Photosynthesis converts light energy into chemical energy stored in glucose. It occurs in chloroplasts, which contain chlorophyll. The light-dependent reactions take place in the thylakoid membranes: water is split, oxygen is released, and ATP and NADPH are produced. The Calvin cycle occurs in the stroma and uses ATP and NADPH to fix carbon dioxide into G3P, which is later used to build glucose. Rubisco is the enzyme that catalyses the first step of carbon fixation. Factors that limit the rate of photosynthesis include light intensity, carbon dioxide concentration and temperature. C4 plants such as maize reduce photorespiration by spatially separating initial carbon fixation from the Calvin cycle.`,
  },
  {
    id: "es-independencia",
    lang: "es",
    language: "Spanish",
    minCards: 5,
    text: `La Revolución de Mayo de 1810 inició el proceso de independencia del Río de la Plata. El 25 de mayo se formó la Primera Junta, presidida por Cornelio Saavedra, con Mariano Moreno como secretario. La Declaración de Independencia se firmó el 9 de julio de 1816 en el Congreso de Tucumán. José de San Martín organizó el Ejército de los Andes y cruzó la cordillera en 1817 para liberar Chile en la batalla de Chacabuco. Después impulsó la expedición libertadora al Perú. La entrevista de Guayaquil en 1822 con Simón Bolívar marcó el retiro de San Martín.`,
  },
  {
    id: "de-physik-to-pt",
    lang: "pt",
    language: "Brazilian Portuguese",
    minCards: 5,
    text: `Das zweite Newtonsche Gesetz besagt, dass die Beschleunigung eines Körpers proportional zur resultierenden Kraft und umgekehrt proportional zu seiner Masse ist: F = m · a. Die Einheit der Kraft ist das Newton, also kg·m/s². Das dritte Gesetz, actio gleich reactio, beschreibt, dass zwei Körper stets gleich große, entgegengesetzte Kräfte aufeinander ausüben. Die Gewichtskraft berechnet sich als G = m · g, wobei g auf der Erde etwa 9,81 m/s² beträgt. Reibungskräfte wirken der Bewegung entgegen und hängen vom Reibungskoeffizienten und der Normalkraft ab.`,
  },
  {
    id: "en-economics-to-ja",
    lang: "ja",
    language: "Japanese",
    minCards: 5,
    text: `Inflation is a sustained increase in the general price level of goods and services. Central banks typically target an inflation rate of around 2 percent. Raising the policy interest rate makes borrowing more expensive, which reduces spending and cools inflation. Demand-pull inflation occurs when aggregate demand exceeds supply, while cost-push inflation results from rising production costs such as wages or energy. Deflation, a sustained fall in prices, can be harmful because it encourages consumers to postpone purchases. The consumer price index (CPI) measures the average change in prices paid for a fixed basket of goods.`,
  },
  {
    id: "fr-revolution",
    lang: "fr",
    language: "French",
    minCards: 5,
    text: `La Révolution française débute en 1789 avec la convocation des États généraux et la prise de la Bastille le 14 juillet. La Déclaration des droits de l'homme et du citoyen est adoptée le 26 août 1789. La monarchie est abolie en septembre 1792 et Louis XVI est guillotiné en janvier 1793. La Terreur, dirigée par le Comité de salut public sous l'influence de Robespierre, dure de 1793 à 1794. Le coup d'État du 18 brumaire an VIII, en 1799, porte Napoléon Bonaparte au pouvoir comme Premier consul.`,
  },
  {
    id: "pt-tabela",
    lang: "pt",
    language: "Brazilian Portuguese",
    minCards: 6,
    text: `Recurso | Prazo | Observação
Apelação | 15 dias úteis | Cabe contra sentença
Agravo de instrumento | 15 dias úteis | Cabe nas hipóteses do art. 1.015
Embargos de declaração | 5 dias úteis | Interrompem o prazo dos demais recursos
Recurso especial | 15 dias úteis | Cabe ao STJ, exige prequestionamento
Recurso extraordinário | 15 dias úteis | Cabe ao STF, exige repercussão geral
Agravo interno | 15 dias úteis | Cabe contra decisão monocrática do relator`,
  },
  {
    id: "pt-curto",
    lang: "pt",
    language: "Brazilian Portuguese",
    minCards: 2,
    text: `A mitocôndria é a organela responsável pela respiração celular e pela produção da maior parte do ATP. Ela possui DNA próprio e membrana dupla.`,
  },
];

export type NoteCase = { id: string; text: string; lang: string; language: string };

export const NOTE_CASES: NoteCase[] = [
  { id: "pt-prazos", lang: "pt", language: "Brazilian Portuguese", text: CARD_CASES[0]!.text },
  { id: "en-photosynthesis", lang: "en", language: "English", text: CARD_CASES[1]!.text },
  { id: "de-to-en", lang: "en", language: "English", text: CARD_CASES[3]!.text },
];

export type SttCase = { id: string; text: string; alt?: string; unit: "word" | "char"; lang: string };

export const STT_CASES: SttCase[] = [
  { id: "pt", lang: "pt", unit: "word", alt: "O prazo para apresentar a contestação é de 15 dias úteis, contados da audiência de conciliação.", text: "O prazo para apresentar a contestação é de quinze dias úteis, contados da audiência de conciliação." },
  { id: "en", lang: "en", unit: "word", text: "The mitochondria produce most of the cell's energy in the form of ATP through cellular respiration." },
  { id: "es", lang: "es", unit: "word", alt: "La declaración de independencia se firmó el 9 de julio de 1816 en Tucumán.", text: "La declaración de independencia se firmó el nueve de julio de mil ochocientos dieciséis en Tucumán." },
  { id: "de", lang: "de", unit: "word", text: "Die Beschleunigung eines Körpers ist proportional zur resultierenden Kraft und umgekehrt proportional zu seiner Masse." },
  { id: "ja", lang: "ja", unit: "char", text: "光合成は光のエネルギーを化学エネルギーに変換するプロセスです。" },
];
