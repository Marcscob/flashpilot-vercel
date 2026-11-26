/**
 * Bandeira como imagem (o Windows não desenha emojis de bandeira).
 * Converte o emoji de bandeira em código de país; outros emojis aparecem como texto.
 */
export function flagToCountry(flag: string): string | null {
  const cps = Array.from(flag).map((c) => c.codePointAt(0) ?? 0);
  if (cps.length !== 2 || cps.some((c) => c < 0x1f1e6 || c > 0x1f1ff)) return null;
  return cps.map((c) => String.fromCharCode(c - 0x1f1e6 + 97)).join("");
}

export function FlagIcon({ flag, className = "" }: { flag: string; className?: string }) {
  const cc = flagToCountry(flag);
  if (!cc) return <span aria-hidden className={`text-base leading-none ${className}`}>{flag}</span>;
  return (
    <img
      src={`https://flagcdn.com/w40/${cc}.png`}
      srcSet={`https://flagcdn.com/w80/${cc}.png 2x`}
      alt=""
      aria-hidden
      loading="lazy"
      className={`inline-block h-3.5 w-5 shrink-0 rounded-[2px] object-cover shadow-sm ${className}`}
    />
  );
}
