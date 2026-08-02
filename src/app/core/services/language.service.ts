import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Preferences } from '@capacitor/preferences';

export type SupportedLanguage = 'es' | 'en' | 'fr';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['es', 'en', 'fr'];
const LANG_KEY = 'horahome_lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  constructor(private translate: TranslateService) {}

  async initialize(): Promise<void> {
    this.translate.addLangs(SUPPORTED_LANGUAGES);

    const saved = await this.getSavedLanguage();
    // Default is strictly Spanish ('es') unless the user explicitly saved a different preference
    const lang = saved ?? 'es';
    await this.setLanguage(lang);
  }

  async setLanguage(lang: SupportedLanguage): Promise<void> {
    this.translate.use(lang);
    await Preferences.set({ key: LANG_KEY, value: lang });
  }

  getCurrentLanguage(): SupportedLanguage {
    const current = this.translate.currentLang();
    if (current && SUPPORTED_LANGUAGES.includes(current as SupportedLanguage)) {
      return current as SupportedLanguage;
    }
    return 'es';
  }

  private async getSavedLanguage(): Promise<SupportedLanguage | null> {
    const { value } = await Preferences.get({ key: LANG_KEY });
    if (value && SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)) {
      return value as SupportedLanguage;
    }
    return null;
  }
}
