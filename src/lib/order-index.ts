// Extrai o número do artigo (ex.: "Art. 12", "Artigo 3º") do texto,
// para servir como ordem natural crescente dos flashcards de leis.
export function extractOrderFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/art(?:\.|igo)?\s*0*(\d{1,6})/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

// Renumera uma lista de ids em sequência 1..n para gravar em `order_index`.
export function renumber(ids: string[]): { id: string; order_index: number }[] {
  return ids.map((id, i) => ({ id, order_index: i + 1 }));
}
