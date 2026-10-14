import { cookies } from "next/headers";
import type { Language, Translations } from "./types";
import { en } from "./dictionaries/en";
import { gu } from "./dictionaries/gu";

const dictionaries: Record<Language, Translations> = { en, gu };

export async function getServerLanguage(): Promise<Language> {
  try {
    const cookieStore = await cookies();
    const lang = cookieStore.get("app_lang")?.value;
    if (lang === "gu" || lang === "en") return lang;
  } catch {
    // If called outside request context
  }
  return "en";
}

export async function getServerTranslations(
  explicitLang?: Language
): Promise<{ lang: Language; t: Translations } & Translations> {
  const lang = explicitLang ?? (await getServerLanguage());
  const t = dictionaries[lang] ?? en;
  return Object.assign({}, t, { lang, t });
}
