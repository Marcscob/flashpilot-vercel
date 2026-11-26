/**
 * Selo informativo do Paddle: ao passar o mouse (ou tocar, no celular) o usuário
 * vê os pilares de segurança do processador de pagamentos, nos 7 idiomas da interface.
 */
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useLang } from "@/lib/i18n";
import { BadgeCheck, KeyRound, ScrollText, ShieldAlert, ShieldCheck } from "lucide-react";

type Pillar = { title: string; body: string };
type Copy = { label: string; title: string; pillars: [Pillar, Pillar, Pillar, Pillar] };

const COPY: Record<string, Copy> = {
  pt: {
    label: "Pilares de segurança do Paddle",
    title: "Pilares de Segurança do Paddle",
    pillars: [
      {
        title: "Merchant of Record (MoR)",
        body: "O Paddle opera sob o modelo Merchant of Record (MoR), o que significa que atua como revendedor oficial de produtos digitais e softwares de milhares de empresas globais (como a AdGuard), assumindo toda a responsabilidade jurídica, fiscal e de segurança das transações.",
      },
      {
        title: "Padrões Rigorosos de Conformidade",
        body: "Cumpre estritamente as normas da indústria de cartões de crédito (PCI DSS), a certificação de segurança de dados SOC 2 e as leis de privacidade globais, como o GDPR.",
      },
      {
        title: "Proteção Avançada Contra Fraudes",
        body: "Utiliza algoritmos inteligentes e parcerias com ferramentas antifraude de ponta para monitorar transações em tempo real, bloqueando atividades suspeitas antes mesmo que cheguem a ser cobradas.",
      },
      {
        title: "Autenticação Forte",
        body: "Suporta protocolos como o SCA (Strong Customer Authentication) e a diretiva europeia PSD2, exigindo confirmações adicionais do comprador em pagamentos de risco para evitar o uso de cartões clonados.",
      },
    ],
  },
  en: {
    label: "Paddle security pillars",
    title: "Paddle Security Pillars",
    pillars: [
      {
        title: "Merchant of Record (MoR)",
        body: "Paddle operates under the Merchant of Record (MoR) model, acting as the official reseller of digital products and software for thousands of global companies (such as AdGuard), taking on full legal, tax and security responsibility for transactions.",
      },
      {
        title: "Strict Compliance Standards",
        body: "It strictly follows credit card industry rules (PCI DSS), the SOC 2 data security certification and global privacy laws such as GDPR.",
      },
      {
        title: "Advanced Fraud Protection",
        body: "It uses smart algorithms and partnerships with leading anti-fraud tools to monitor transactions in real time, blocking suspicious activity before it is ever charged.",
      },
      {
        title: "Strong Authentication",
        body: "It supports protocols such as SCA (Strong Customer Authentication) and the European PSD2 directive, requiring extra buyer confirmation on risky payments to prevent the use of cloned cards.",
      },
    ],
  },
  es: {
    label: "Pilares de seguridad de Paddle",
    title: "Pilares de Seguridad de Paddle",
    pillars: [
      {
        title: "Merchant of Record (MoR)",
        body: "Paddle opera bajo el modelo Merchant of Record (MoR), es decir, actúa como revendedor oficial de productos digitales y software de miles de empresas globales (como AdGuard), asumiendo toda la responsabilidad jurídica, fiscal y de seguridad de las transacciones.",
      },
      {
        title: "Estándares Rigurosos de Cumplimiento",
        body: "Cumple estrictamente las normas de la industria de tarjetas de crédito (PCI DSS), la certificación de seguridad de datos SOC 2 y las leyes globales de privacidad, como el GDPR.",
      },
      {
        title: "Protección Avanzada Contra Fraudes",
        body: "Utiliza algoritmos inteligentes y alianzas con herramientas antifraude de vanguardia para monitorear transacciones en tiempo real, bloqueando actividades sospechosas antes de que lleguen a cobrarse.",
      },
      {
        title: "Autenticación Fuerte",
        body: "Admite protocolos como SCA (Strong Customer Authentication) y la directiva europea PSD2, exigiendo confirmaciones adicionales del comprador en pagos de riesgo para evitar el uso de tarjetas clonadas.",
      },
    ],
  },
  fr: {
    label: "Piliers de sécurité de Paddle",
    title: "Piliers de Sécurité de Paddle",
    pillars: [
      {
        title: "Merchant of Record (MoR)",
        body: "Paddle fonctionne selon le modèle Merchant of Record (MoR) : il agit comme revendeur officiel de produits numériques et de logiciels pour des milliers d'entreprises mondiales (comme AdGuard) et assume toute la responsabilité juridique, fiscale et de sécurité des transactions.",
      },
      {
        title: "Normes de Conformité Strictes",
        body: "Il respecte strictement les normes du secteur des cartes bancaires (PCI DSS), la certification de sécurité des données SOC 2 et les lois mondiales sur la confidentialité comme le RGPD.",
      },
      {
        title: "Protection Avancée Contre la Fraude",
        body: "Il utilise des algorithmes intelligents et des partenariats avec des outils antifraude de pointe pour surveiller les transactions en temps réel et bloquer les activités suspectes avant tout prélèvement.",
      },
      {
        title: "Authentification Forte",
        body: "Il prend en charge des protocoles comme le SCA (Strong Customer Authentication) et la directive européenne DSP2, en demandant des confirmations supplémentaires à l'acheteur sur les paiements à risque afin d'éviter l'usage de cartes clonées.",
      },
    ],
  },
  it: {
    label: "Pilastri di sicurezza di Paddle",
    title: "Pilastri di Sicurezza di Paddle",
    pillars: [
      {
        title: "Merchant of Record (MoR)",
        body: "Paddle opera secondo il modello Merchant of Record (MoR): agisce come rivenditore ufficiale di prodotti digitali e software per migliaia di aziende globali (come AdGuard), assumendosi tutta la responsabilità legale, fiscale e di sicurezza delle transazioni.",
      },
      {
        title: "Standard di Conformità Rigorosi",
        body: "Rispetta rigorosamente le norme del settore delle carte di credito (PCI DSS), la certificazione di sicurezza dei dati SOC 2 e le leggi globali sulla privacy come il GDPR.",
      },
      {
        title: "Protezione Avanzata Contro le Frodi",
        body: "Utilizza algoritmi intelligenti e collaborazioni con strumenti antifrode all'avanguardia per monitorare le transazioni in tempo reale, bloccando le attività sospette prima che vengano addebitate.",
      },
      {
        title: "Autenticazione Forte",
        body: "Supporta protocolli come SCA (Strong Customer Authentication) e la direttiva europea PSD2, richiedendo conferme aggiuntive all'acquirente nei pagamenti a rischio per evitare l'uso di carte clonate.",
      },
    ],
  },
  de: {
    label: "Sicherheitssäulen von Paddle",
    title: "Sicherheitssäulen von Paddle",
    pillars: [
      {
        title: "Merchant of Record (MoR)",
        body: "Paddle arbeitet nach dem Merchant-of-Record-Modell (MoR) und tritt damit als offizieller Wiederverkäufer digitaler Produkte und Software für tausende globale Unternehmen (wie AdGuard) auf und übernimmt die vollständige rechtliche, steuerliche und sicherheitsbezogene Verantwortung für die Transaktionen.",
      },
      {
        title: "Strenge Compliance-Standards",
        body: "Paddle erfüllt strikt die Vorgaben der Kreditkartenbranche (PCI DSS), die Datensicherheitszertifizierung SOC 2 und globale Datenschutzgesetze wie die DSGVO.",
      },
      {
        title: "Erweiterter Betrugsschutz",
        body: "Intelligente Algorithmen und Partnerschaften mit führenden Betrugserkennungstools überwachen Transaktionen in Echtzeit und blockieren verdächtige Aktivitäten, bevor überhaupt abgebucht wird.",
      },
      {
        title: "Starke Authentifizierung",
        body: "Paddle unterstützt Protokolle wie SCA (Strong Customer Authentication) und die europäische PSD2-Richtlinie und verlangt bei risikoreichen Zahlungen zusätzliche Bestätigungen des Käufers, um den Einsatz kopierter Karten zu verhindern.",
      },
    ],
  },
};

const ICONS = [BadgeCheck, ScrollText, ShieldAlert, KeyRound];

export function PaddleTrustPopover({ label }: { label: string }) {
  const { lang } = useLang();
  const copy = COPY[lang] ?? COPY[lang?.split("-")[0] ?? "pt"] ?? COPY.pt;

  return (
    <HoverCard openDelay={80} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={copy.label}
          className="inline-flex items-center gap-1 rounded-full text-primary/70 underline decoration-dotted underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {label}
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          {copy.title}
        </p>
        <ul className="mt-3 space-y-3">
          {copy.pillars.map((p, i) => {
            const Icon = ICONS[i] ?? ShieldCheck;
            return (
              <li key={p.title} className="flex gap-2">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{p.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
