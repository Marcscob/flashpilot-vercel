DROP INDEX IF EXISTS public.user_purchases_tx_idx;
ALTER TABLE public.user_purchases
  ADD CONSTRAINT user_purchases_tx_product_key UNIQUE (paddle_transaction_id, product_id);