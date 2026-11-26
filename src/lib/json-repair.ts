/**
 * Modelos às vezes escrevem `\ b)` em vez de `\nb)` dentro de strings JSON, o que quebra o JSON.parse.
 * Mantém escapes válidos, troca barra + espaço por quebra de linha e descarta barras inválidas.
 */
export function repairJsonEscapes(raw: string): string {
  return raw.replace(
    /\\(["\\/bfnrt]|u[0-9a-fA-F]{4})|\\(\s)|\\([\s\S])/g,
    (match, valid, space, other) => {
      if (valid) return match;
      if (space) return "\\n";
      return other;
    },
  );
}

/** Interpreta JSON de modelo: tenta o texto, o objeto extraído e as versões reparadas. Devolve undefined se nada servir. */
export function parseJsonLenient(raw: string): unknown | undefined {
  const text = raw ?? "";
  const object = text.match(/\{[\s\S]*\}/)?.[0];
  const candidates = object && object !== text ? [text, object] : [text];
  for (const candidate of candidates) {
    for (const version of [candidate, repairJsonEscapes(candidate)]) {
      try {
        return JSON.parse(version);
      } catch {
        // tenta a próxima variante
      }
    }
  }
  return undefined;
}
