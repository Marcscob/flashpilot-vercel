import type { LegalSection } from "@/lib/i18n-extra";

/** Renderiza as seções de uma página legal já traduzidas. */
export function LegalSections({ sections }: { sections: readonly LegalSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <div key={s.h}>
          <h2>{s.h}</h2>
          {s.p && <p>{s.p}</p>}
          {s.ul && (
            <ul>
              {s.ul.map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  );
}
