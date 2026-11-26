// SSR-safe copy for the 15-day money-back guarantee and refund policy (7 native languages).
// Refunds are processed by Paddle as Merchant of Record: the receipt link is the primary route,
// e-mail/WhatsApp is alternative support.
import { applyDeepDictOverlay } from "./app-ext-langs";

export type RefundLang = "pt" | "pt-PT" | "es" | "en" | "fr" | "it" | "de";

type Copy = {
  title: string;
  lead: string;
  body: string;
  note: string;
  link: string;
  policyTitle: string;
  metaDesc: string;
  sections: { h: string; p: string }[];
};

const C: Record<RefundLang, Copy> = {
  en: {
    title: "15-Day Money-Back Guarantee",
    lead: "Try FlashPilot completely risk-free.",
    body: "If you're not satisfied with your experience, you can request a full refund within 15 days of your purchase.",
    note: "No complicated questions. Your satisfaction matters to us.",
    link: "Refund Policy",
    policyTitle: "Refund Policy",
    metaDesc:
      "FlashPilot 15-day money-back guarantee: request a full refund within 15 days of purchase, no complicated questions.",
    sections: [
      {
        h: "1. Our commitment",
        p: "Your satisfaction always comes first. Every FlashPilot purchase — subscriptions, FlashCoin packs and store subjects — is covered by a 15-day money-back guarantee.",
      },
      {
        h: "2. Who can request it",
        p: "Any customer may request a full refund within 15 days of the purchase date, for any reason. We will not ask complicated questions.",
      },
      {
        h: "3. How to request it",
        p: "The fastest way is the receipt: open the confirmation e-mail Paddle, our payment partner, sent you after the purchase and use the support link there, or the Paddle customer portal. If you prefer, write to us at {email} and we will pass your request on.",
      },
      {
        h: "4. Processing",
        p: "Paddle processes every refund and returns the money to your original payment method, usually within 5 to 10 business days depending on your bank. Access to the refunded plan or content ends when the refund is completed.",
      },
      {
        h: "5. After 15 days",
        p: "After the guarantee period, you can cancel your subscription at any time to stop future charges; the current period remains available until it ends. Exceptional cases are always analysed with goodwill.",
      },
    ],
  },
  pt: {
    title: "Garantia de 15 dias ou seu dinheiro de volta",
    lead: "Experimente o FlashPilot sem nenhum risco.",
    body: "Se você não ficar satisfeito com sua experiência, pode solicitar o reembolso integral em até 15 dias após a compra.",
    note: "Sem perguntas complicadas. Sua satisfação é importante para nós.",
    link: "Política de Reembolso",
    policyTitle: "Política de Reembolso",
    metaDesc:
      "Garantia de 15 dias do FlashPilot: solicite o reembolso integral em até 15 dias após a compra, sem perguntas complicadas.",
    sections: [
      {
        h: "1. Nosso compromisso",
        p: "Sua satisfação vem sempre em primeiro lugar. Toda compra no FlashPilot — assinaturas, pacotes de FlashCoins e matérias da Loja — tem garantia de 15 dias ou seu dinheiro de volta.",
      },
      {
        h: "2. Quem pode solicitar",
        p: "Qualquer cliente pode solicitar o reembolso integral em até 15 dias a partir da data da compra, por qualquer motivo. Não faremos perguntas complicadas.",
      },
      {
        h: "3. Como solicitar",
        p: "O caminho mais rápido é o recibo: abra o e-mail de confirmação que a Paddle, nossa parceira de pagamentos, enviou após a compra e use o link de suporte que está nele, ou o portal do cliente da Paddle. Se preferir, escreva para {email} e encaminhamos o seu pedido.",
      },
      {
        h: "4. Processamento",
        p: "A Paddle processa todos os reembolsos e devolve o dinheiro no mesmo meio de pagamento, normalmente em 5 a 10 dias úteis, conforme seu banco. O acesso ao plano ou conteúdo reembolsado termina quando o reembolso é concluído.",
      },
      {
        h: "5. Após 15 dias",
        p: "Depois do prazo de garantia, você pode cancelar a assinatura a qualquer momento para evitar novas cobranças; o período atual segue disponível até o fim. Casos excepcionais são sempre analisados com boa vontade.",
      },
    ],
  },
  "pt-PT": {
    title: "Garantia de 15 dias ou o seu dinheiro de volta",
    lead: "Experimente o FlashPilot sem qualquer risco.",
    body: "Se não ficar satisfeito com a sua experiência, pode pedir o reembolso total até 15 dias após a compra.",
    note: "Sem perguntas complicadas. A sua satisfação é importante para nós.",
    link: "Política de Reembolso",
    policyTitle: "Política de Reembolso",
    metaDesc:
      "Garantia de 15 dias do FlashPilot: peça o reembolso total até 15 dias após a compra, sem perguntas complicadas.",
    sections: [
      {
        h: "1. O nosso compromisso",
        p: "A sua satisfação vem sempre em primeiro lugar. Todas as compras no FlashPilot — subscrições, pacotes de FlashCoins e disciplinas da Loja — têm garantia de 15 dias ou o seu dinheiro de volta.",
      },
      {
        h: "2. Quem pode pedir",
        p: "Qualquer cliente pode pedir o reembolso total até 15 dias a contar da data da compra, por qualquer motivo. Não faremos perguntas complicadas.",
      },
      {
        h: "3. Como pedir",
        p: "O caminho mais rápido é o recibo: abra o e-mail de confirmação que a Paddle, a nossa parceira de pagamentos, enviou após a compra e use a ligação de suporte que está nele, ou o portal do cliente da Paddle. Se preferir, escreva para {email} e encaminhamos o seu pedido.",
      },
      {
        h: "4. Processamento",
        p: "A Paddle processa todos os reembolsos e devolve o dinheiro no mesmo meio de pagamento, normalmente em 5 a 10 dias úteis, consoante o seu banco. O acesso ao plano ou conteúdo reembolsado termina quando o reembolso é concluído.",
      },
      {
        h: "5. Após 15 dias",
        p: "Depois do prazo de garantia, pode cancelar a subscrição a qualquer momento para evitar novas cobranças; o período atual mantém-se disponível até ao fim. Casos excecionais são sempre analisados com boa vontade.",
      },
    ],
  },
  es: {
    title: "Garantía de devolución de 15 días",
    lead: "Prueba FlashPilot sin ningún riesgo.",
    body: "Si no estás satisfecho con tu experiencia, puedes solicitar el reembolso total dentro de los 15 días posteriores a tu compra.",
    note: "Sin preguntas complicadas. Tu satisfacción nos importa.",
    link: "Política de Reembolso",
    policyTitle: "Política de Reembolso",
    metaDesc:
      "Garantía de 15 días de FlashPilot: solicita el reembolso total dentro de los 15 días posteriores a la compra, sin preguntas complicadas.",
    sections: [
      {
        h: "1. Nuestro compromiso",
        p: "Tu satisfacción siempre es lo primero. Toda compra en FlashPilot — suscripciones, paquetes de FlashCoins y materias de la Tienda — tiene garantía de devolución de 15 días.",
      },
      {
        h: "2. Quién puede solicitarlo",
        p: "Cualquier cliente puede solicitar el reembolso total dentro de los 15 días desde la fecha de compra, por cualquier motivo. No haremos preguntas complicadas.",
      },
      {
        h: "3. Cómo solicitarlo",
        p: "Lo más rápido es el recibo: abre el correo de confirmación que Paddle, nuestro socio de pagos, te envió tras la compra y usa el enlace de soporte que aparece ahí, o el portal de cliente de Paddle. Si lo prefieres, escríbenos a {email} y encaminamos tu solicitud.",
      },
      {
        h: "4. Procesamiento",
        p: "Paddle tramita todos los reembolsos y devuelve el dinero en el mismo medio de pago, normalmente en 5 a 10 días hábiles según tu banco. El acceso al plan o contenido reembolsado finaliza cuando se completa el reembolso.",
      },
      {
        h: "5. Después de 15 días",
        p: "Tras el plazo de garantía, puedes cancelar tu suscripción en cualquier momento para evitar nuevos cargos; el período actual sigue disponible hasta su fin. Los casos excepcionales siempre se analizan con buena voluntad.",
      },
    ],
  },
  fr: {
    title: "Garantie satisfait ou remboursé de 15 jours",
    lead: "Essayez FlashPilot sans aucun risque.",
    body: "Si vous n'êtes pas satisfait de votre expérience, vous pouvez demander un remboursement intégral dans les 15 jours suivant votre achat.",
    note: "Pas de questions compliquées. Votre satisfaction compte pour nous.",
    link: "Politique de remboursement",
    policyTitle: "Politique de remboursement",
    metaDesc:
      "Garantie de 15 jours FlashPilot : demandez un remboursement intégral dans les 15 jours suivant l'achat, sans questions compliquées.",
    sections: [
      {
        h: "1. Notre engagement",
        p: "Votre satisfaction passe toujours en premier. Tout achat sur FlashPilot — abonnements, packs de FlashCoins et matières de la Boutique — bénéficie d'une garantie satisfait ou remboursé de 15 jours.",
      },
      {
        h: "2. Qui peut la demander",
        p: "Tout client peut demander un remboursement intégral dans les 15 jours suivant la date d'achat, pour quelque raison que ce soit. Nous ne poserons pas de questions compliquées.",
      },
      {
        h: "3. Comment la demander",
        p: "Le plus rapide, c'est le reçu : ouvrez l'e-mail de confirmation que Paddle, notre partenaire de paiement, vous a envoyé après l'achat et utilisez le lien d'assistance qu'il contient, ou le portail client Paddle. Si vous préférez, écrivez-nous à {email} et nous transmettrons votre demande.",
      },
      {
        h: "4. Traitement",
        p: "Paddle traite tous les remboursements et restitue les sommes sur le moyen de paiement d'origine, généralement sous 5 à 10 jours ouvrés selon votre banque. L'accès au plan ou au contenu remboursé prend fin une fois le remboursement effectué.",
      },
      {
        h: "5. Après 15 jours",
        p: "Après la période de garantie, vous pouvez résilier votre abonnement à tout moment pour éviter de nouveaux prélèvements ; la période en cours reste disponible jusqu'à son terme. Les cas exceptionnels sont toujours examinés avec bienveillance.",
      },
    ],
  },
  it: {
    title: "Garanzia soddisfatti o rimborsati di 15 giorni",
    lead: "Prova FlashPilot senza alcun rischio.",
    body: "Se non sei soddisfatto della tua esperienza, puoi richiedere il rimborso completo entro 15 giorni dall'acquisto.",
    note: "Nessuna domanda complicata. La tua soddisfazione è importante per noi.",
    link: "Politica di rimborso",
    policyTitle: "Politica di rimborso",
    metaDesc:
      "Garanzia di 15 giorni FlashPilot: richiedi il rimborso completo entro 15 giorni dall'acquisto, senza domande complicate.",
    sections: [
      {
        h: "1. Il nostro impegno",
        p: "La tua soddisfazione viene sempre prima di tutto. Ogni acquisto su FlashPilot — abbonamenti, pacchetti di FlashCoins e materie dello Store — è coperto dalla garanzia soddisfatti o rimborsati di 15 giorni.",
      },
      {
        h: "2. Chi può richiederlo",
        p: "Qualsiasi cliente può richiedere il rimborso completo entro 15 giorni dalla data di acquisto, per qualsiasi motivo. Non faremo domande complicate.",
      },
      {
        h: "3. Come richiederlo",
        p: "La strada più rapida è la ricevuta: apri l'e-mail di conferma che Paddle, il nostro partner di pagamento, ti ha inviato dopo l'acquisto e usa il link di supporto che contiene, oppure il portale clienti Paddle. Se preferisci, scrivici a {email} e inoltreremo la tua richiesta.",
      },
      {
        h: "4. Elaborazione",
        p: "Paddle elabora tutti i rimborsi e restituisce l'importo sullo stesso metodo di pagamento, di solito entro 5-10 giorni lavorativi a seconda della banca. L'accesso al piano o al contenuto rimborsato termina al completamento del rimborso.",
      },
      {
        h: "5. Dopo 15 giorni",
        p: "Dopo il periodo di garanzia puoi annullare l'abbonamento in qualsiasi momento per evitare nuovi addebiti; il periodo in corso resta disponibile fino alla scadenza. I casi eccezionali vengono sempre valutati con buona volontà.",
      },
    ],
  },
  de: {
    title: "15 Tage Geld-zurück-Garantie",
    lead: "Testen Sie FlashPilot völlig risikofrei.",
    body: "Wenn Sie mit Ihrer Erfahrung nicht zufrieden sind, können Sie innerhalb von 15 Tagen nach dem Kauf eine vollständige Rückerstattung beantragen.",
    note: "Keine komplizierten Fragen. Ihre Zufriedenheit ist uns wichtig.",
    link: "Rückerstattungsrichtlinie",
    policyTitle: "Rückerstattungsrichtlinie",
    metaDesc:
      "FlashPilot 15 Tage Geld-zurück-Garantie: volle Rückerstattung innerhalb von 15 Tagen nach dem Kauf, ohne komplizierte Fragen.",
    sections: [
      {
        h: "1. Unser Versprechen",
        p: "Ihre Zufriedenheit steht immer an erster Stelle. Jeder Kauf bei FlashPilot — Abonnements, FlashCoin-Pakete und Fächer im Store — ist durch eine 15-tägige Geld-zurück-Garantie abgedeckt.",
      },
      {
        h: "2. Wer sie beantragen kann",
        p: "Jeder Kunde kann innerhalb von 15 Tagen ab Kaufdatum aus beliebigem Grund eine vollständige Rückerstattung beantragen. Wir stellen keine komplizierten Fragen.",
      },
      {
        h: "3. So beantragen Sie sie",
        p: "Am schnellsten geht es über die Quittung: Öffnen Sie die Bestätigungs-E-Mail, die Paddle als unser Zahlungspartner nach dem Kauf an Sie geschickt hat, und nutzen Sie den dortigen Support-Link oder das Paddle-Kundenportal. Wenn Sie möchten, schreiben Sie uns an {email} — wir leiten Ihr Anliegen weiter.",
      },
      {
        h: "4. Bearbeitung",
        p: "Paddle wickelt alle Rückerstattungen ab und zahlt das Geld auf das ursprüngliche Zahlungsmittel zurück, in der Regel innerhalb von 5 bis 10 Werktagen je nach Bank. Der Zugang zum erstatteten Plan oder Inhalt endet mit Abschluss der Rückerstattung.",
      },
      {
        h: "5. Nach 15 Tagen",
        p: "Nach Ablauf der Garantie können Sie Ihr Abonnement jederzeit kündigen, um weitere Abbuchungen zu vermeiden; der laufende Zeitraum bleibt bis zum Ende verfügbar. Ausnahmefälle prüfen wir stets wohlwollend.",
      },
    ],
  },
};

export function refundCopy(lang: string, overlay?: Record<string, string>): Copy {
  const copy = C[lang as RefundLang] ?? C.en;
  return overlay ? applyDeepDictOverlay(copy, overlay, "refund") : copy;
}
