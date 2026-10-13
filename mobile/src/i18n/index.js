import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en.json";
import am from "./locales/am.json";
import om from "./locales/om.json";

export const LANGUAGE_STORAGE_KEY = "equb-language";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeName: "English" },
  { code: "am", label: "Amharic", nativeName: "አማርኛ" },
  { code: "om", label: "Afaan Oromoo", nativeName: "Afaan Oromoo" },
];

export const resources = {
  en: { translation: en },
  am: { translation: am },
  om: { translation: om },
};

let initPromise = null;

/**
 * Initializes i18next asynchronously:
 * - Reads saved language preference from AsyncStorage.
 * - Prevents duplicate initialization.
 * - Falls back to English if no language is saved or an error occurs.
 */
export const initI18n = async () => {
  if (i18n.isInitialized) {
    return i18n;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      let savedLanguage = null;
      try {
        savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      } catch (storageError) {
        console.warn("[i18n] Failed to read saved language from AsyncStorage:", storageError);
      }

      const activeLanguage =
        savedLanguage && ["en", "am", "om"].includes(savedLanguage)
          ? savedLanguage
          : "en";

      await i18n.use(initReactI18next).init({
        resources,
        lng: activeLanguage,
        fallbackLng: "en",
        interpolation: {
          escapeValue: false,
        },
        compatibilityJSON: "v4",
        react: {
          useSuspense: false,
        },
      });
    } catch (error) {
      console.error("[i18n] Initialization error:", error);

      // Graceful fallback to guarantee i18n is initialized
      if (!i18n.isInitialized) {
        await i18n.use(initReactI18next).init({
          resources,
          lng: "en",
          fallbackLng: "en",
          interpolation: {
            escapeValue: false,
          },
          compatibilityJSON: "v4",
          react: {
            useSuspense: false,
          },
        });
      }
    }

    return i18n;
  })();

  return initPromise;
};

/**
 * Changes active language, saves selection to AsyncStorage, and updates i18n.
 * @param {string} languageCode - 'en' | 'am' | 'om'
 */
export const changeAppLanguage = async (languageCode) => {
  try {
    const validLang = ["en", "am", "om"].includes(languageCode)
      ? languageCode
      : "en";

    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, validLang);
    await i18n.changeLanguage(validLang);
  } catch (error) {
    console.error("[i18n] Failed to change language:", error);
    // Still change language in memory even if storage fails
    await i18n.changeLanguage(languageCode);
  }
};

export default i18n;
