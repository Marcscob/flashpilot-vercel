import { Coins } from "lucide-react";

/**
 * Contador de FlashCoins da geração em lote — visível APENAS para o AppManager.
 * O custo por card vem da tabela ai_action_costs (id "bulk": 1 FlashCoin/card).
 * A tabela não tem leitura pública (RLS), então o valor é espelhado aqui;
 * se o custo mudar no painel admin, atualizar esta constante.
 */
export const BULK_COINS_PER_CARD = 1;

export function BulkCoinsMeter({ cards, live }: { cards: number; live?: boolean }) {
  if (cards <= 0) return null;
  const coins = cards * BULK_COINS_PER_CARD;
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      <Coins className="h-3.5 w-3.5" />
      {live
        ? `${cards} flashcards · ${coins} FlashCoins consumidos até agora`
        : `Esta operação consome ${coins} FlashCoins (${cards} cards × ${BULK_COINS_PER_CARD})`}
    </div>
  );
}
