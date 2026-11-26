import pt from "@/assets/sheet-templates/pt.asset.json";
import ptPT from "@/assets/sheet-templates/pt-PT.asset.json";
import en from "@/assets/sheet-templates/en.asset.json";
import es from "@/assets/sheet-templates/es.asset.json";
import fr from "@/assets/sheet-templates/fr.asset.json";
import it from "@/assets/sheet-templates/it.asset.json";
import de from "@/assets/sheet-templates/de.asset.json";
import { downloadSheetTemplate } from "@/lib/sheet-import";
import { T } from "@/lib/i18n-ui";

const templates = { pt, "pt-PT": ptPT, en, es, fr, it, de };

export function sheetTemplateForLanguage(language: string) {
  if (Object.hasOwn(templates, language)) {
    const asset = templates[language as keyof typeof templates];
    return { url: asset.url, filename: asset.original_filename };
  }
  return { url: null, filename: `flashpilot-${language}.xlsx` };
}

export async function downloadSheetTemplateForLanguage(language: string) {
  const template = sheetTemplateForLanguage(language);
  if (!template.url) {
    await downloadSheetTemplate(
      { q: T("Pergunta"), a: T("Resposta"), ex: [] },
      template.filename,
      T("Flashcards"),
    );
    return;
  }
  const link = document.createElement("a");
  link.href = template.url;
  link.download = template.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
