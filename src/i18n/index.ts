import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// English translations
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enTasks from './locales/en/tasks.json';
import enGamification from './locales/en/gamification.json';
import enAdmin from './locales/en/admin.json';

// Dutch translations
import nlCommon from './locales/nl/common.json';
import nlAuth from './locales/nl/auth.json';
import nlTasks from './locales/nl/tasks.json';
import nlGamification from './locales/nl/gamification.json';
import nlAdmin from './locales/nl/admin.json';

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    tasks: enTasks,
    gamification: enGamification,
    admin: enAdmin,
  },
  nl: {
    common: nlCommon,
    auth: nlAuth,
    tasks: nlTasks,
    gamification: nlGamification,
    admin: nlAdmin,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'tasks', 'gamification', 'admin'],

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
