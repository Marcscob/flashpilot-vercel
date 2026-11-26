/** Textos do painel do usuário ("Minha conta") nos sete idiomas da interface. */
import { useLang, useOverlayD } from "./i18n";
import { applyDictOverlay } from "./app-ext-langs";

type Lang = "pt" | "pt-PT" | "es" | "en" | "fr" | "it" | "de";

export type PanelDict = {
  subjectsTitle: string;
  subjectsEmpty: string;
  browseStore: string;
  purchasedOn: string;
  paid: string;
  expiresOn: string;
  daysLeft: (n: string) => string;
  statusActive: string;
  statusEnding: string;
  statusExpired: string;
  statusRefunded: string;
  study: string;
  renew: string;
  paymentsTitle: string;
  paymentsEmpty: string;
  testEnv: string;
  coinsHistory: string;
  reasonPurchase: string;
  reasonRefund: string;
  reasonSpend: string;
  reasonGift: string;
  nothingYet: string;
  seePlans: string;
};

const en: PanelDict = {
  subjectsTitle: "My subjects",
  subjectsEmpty: "You haven't unlocked any subject yet.",
  browseStore: "Go to the store",
  purchasedOn: "Purchased on",
  paid: "Paid",
  expiresOn: "Expires on",
  daysLeft: (n) => `${n} days left`,
  statusActive: "Active",
  statusEnding: "Expiring soon",
  statusExpired: "Expired",
  statusRefunded: "Refunded",
  study: "Study",
  renew: "Renew",
  paymentsTitle: "Payment history",
  paymentsEmpty: "No payments yet.",
  testEnv: "test",
  coinsHistory: "FlashCoins history",
  reasonPurchase: "Purchase",
  reasonRefund: "Refund",
  reasonSpend: "Usage",
  reasonGift: "Bonus",
  nothingYet: "Nothing purchased yet. Explore the plans and the store.",
  seePlans: "See plans",
};

const pt: PanelDict = {
  subjectsTitle: "Minhas matérias",
  subjectsEmpty: "Você ainda não liberou nenhuma matéria.",
  browseStore: "Ir para a loja",
  purchasedOn: "Comprada em",
  paid: "Pago",
  expiresOn: "Vence em",
  daysLeft: (n) => `faltam ${n} dias`,
  statusActive: "Ativa",
  statusEnding: "A vencer",
  statusExpired: "Expirada",
  statusRefunded: "Estornada",
  study: "Estudar",
  renew: "Renovar",
  paymentsTitle: "Histórico de pagamentos",
  paymentsEmpty: "Nenhum pagamento até agora.",
  testEnv: "teste",
  coinsHistory: "Histórico de FlashCoins",
  reasonPurchase: "Compra",
  reasonRefund: "Estorno",
  reasonSpend: "Uso",
  reasonGift: "Bônus",
  nothingYet: "Você ainda não tem compras. Conheça os planos e a loja.",
  seePlans: "Ver planos",
};

const ptPT: PanelDict = {
  ...pt,
  subjectsEmpty: "Ainda não desbloqueou nenhuma disciplina.",
  subjectsTitle: "As minhas disciplinas",
  purchasedOn: "Comprada a",
  daysLeft: (n) => `faltam ${n} dias`,
  nothingYet: "Ainda não tem compras. Conheça os planos e a loja.",
};

const es: PanelDict = {
  subjectsTitle: "Mis materias",
  subjectsEmpty: "Todavía no has desbloqueado ninguna materia.",
  browseStore: "Ir a la tienda",
  purchasedOn: "Comprada el",
  paid: "Pagado",
  expiresOn: "Vence el",
  daysLeft: (n) => `quedan ${n} días`,
  statusActive: "Activa",
  statusEnding: "Por vencer",
  statusExpired: "Vencida",
  statusRefunded: "Reembolsada",
  study: "Estudiar",
  renew: "Renovar",
  paymentsTitle: "Historial de pagos",
  paymentsEmpty: "Aún no hay pagos.",
  testEnv: "prueba",
  coinsHistory: "Historial de FlashCoins",
  reasonPurchase: "Compra",
  reasonRefund: "Reembolso",
  reasonSpend: "Uso",
  reasonGift: "Bono",
  nothingYet: "Todavía no tienes compras. Descubre los planes y la tienda.",
  seePlans: "Ver planes",
};

const fr: PanelDict = {
  subjectsTitle: "Mes matières",
  subjectsEmpty: "Vous n'avez encore débloqué aucune matière.",
  browseStore: "Aller à la boutique",
  purchasedOn: "Achetée le",
  paid: "Payé",
  expiresOn: "Expire le",
  daysLeft: (n) => `${n} jours restants`,
  statusActive: "Active",
  statusEnding: "Bientôt expirée",
  statusExpired: "Expirée",
  statusRefunded: "Remboursée",
  study: "Étudier",
  renew: "Renouveler",
  paymentsTitle: "Historique des paiements",
  paymentsEmpty: "Aucun paiement pour le moment.",
  testEnv: "test",
  coinsHistory: "Historique des FlashCoins",
  reasonPurchase: "Achat",
  reasonRefund: "Remboursement",
  reasonSpend: "Utilisation",
  reasonGift: "Bonus",
  nothingYet: "Aucun achat pour le moment. Découvrez les offres et la boutique.",
  seePlans: "Voir les offres",
};

const it: PanelDict = {
  subjectsTitle: "Le mie materie",
  subjectsEmpty: "Non hai ancora sbloccato nessuna materia.",
  browseStore: "Vai al negozio",
  purchasedOn: "Acquistata il",
  paid: "Pagato",
  expiresOn: "Scade il",
  daysLeft: (n) => `${n} giorni rimasti`,
  statusActive: "Attiva",
  statusEnding: "In scadenza",
  statusExpired: "Scaduta",
  statusRefunded: "Rimborsata",
  study: "Studia",
  renew: "Rinnova",
  paymentsTitle: "Storico dei pagamenti",
  paymentsEmpty: "Nessun pagamento finora.",
  testEnv: "test",
  coinsHistory: "Storico dei FlashCoins",
  reasonPurchase: "Acquisto",
  reasonRefund: "Rimborso",
  reasonSpend: "Utilizzo",
  reasonGift: "Bonus",
  nothingYet: "Non hai ancora acquisti. Scopri i piani e il negozio.",
  seePlans: "Vedi i piani",
};

const de: PanelDict = {
  subjectsTitle: "Meine Fächer",
  subjectsEmpty: "Du hast noch kein Fach freigeschaltet.",
  browseStore: "Zum Shop",
  purchasedOn: "Gekauft am",
  paid: "Bezahlt",
  expiresOn: "Läuft ab am",
  daysLeft: (n) => `noch ${n} Tage`,
  statusActive: "Aktiv",
  statusEnding: "Läuft bald ab",
  statusExpired: "Abgelaufen",
  statusRefunded: "Erstattet",
  study: "Lernen",
  renew: "Verlängern",
  paymentsTitle: "Zahlungsverlauf",
  paymentsEmpty: "Noch keine Zahlungen.",
  testEnv: "Test",
  coinsHistory: "FlashCoins-Verlauf",
  reasonPurchase: "Kauf",
  reasonRefund: "Erstattung",
  reasonSpend: "Nutzung",
  reasonGift: "Bonus",
  nothingYet: "Noch keine Käufe. Entdecke die Tarife und den Shop.",
  seePlans: "Tarife ansehen",
};

export const PANEL_DICTS: Record<Lang, PanelDict> = { pt, "pt-PT": ptPT, en, es, fr, it, de };

export function usePanelT(): PanelDict {
  const { lang, extLang } = useLang();
  const od = useOverlayD();
  if (extLang && od) return applyDictOverlay(en, od, "panel");
  return PANEL_DICTS[lang as Lang] ?? en;
}
