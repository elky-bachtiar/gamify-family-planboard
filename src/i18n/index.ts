import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// English translations
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enTasks from './locales/en/tasks.json';
import enGamification from './locales/en/gamification.json';
import enAdmin from './locales/en/admin.json';
import enLanding from './locales/en/landing.json';
import enMessages from './locales/en/messages.json';

// Dutch translations
import nlCommon from './locales/nl/common.json';
import nlAuth from './locales/nl/auth.json';
import nlTasks from './locales/nl/tasks.json';
import nlGamification from './locales/nl/gamification.json';
import nlAdmin from './locales/nl/admin.json';
import nlLanding from './locales/nl/landing.json';
import nlMessages from './locales/nl/messages.json';

// Mandarin Chinese translations
import zhCommon from './locales/zh/common.json';
import zhAuth from './locales/zh/auth.json';
import zhTasks from './locales/zh/tasks.json';
import zhGamification from './locales/zh/gamification.json';
import zhAdmin from './locales/zh/admin.json';
import zhLanding from './locales/zh/landing.json';
import zhMessages from './locales/zh/messages.json';

// Hindi translations
import hiCommon from './locales/hi/common.json';
import hiAuth from './locales/hi/auth.json';
import hiTasks from './locales/hi/tasks.json';
import hiGamification from './locales/hi/gamification.json';
import hiAdmin from './locales/hi/admin.json';
import hiLanding from './locales/hi/landing.json';
import hiMessages from './locales/hi/messages.json';

// Spanish translations
import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esTasks from './locales/es/tasks.json';
import esGamification from './locales/es/gamification.json';
import esAdmin from './locales/es/admin.json';
import esLanding from './locales/es/landing.json';
import esMessages from './locales/es/messages.json';

// Arabic translations
import arCommon from './locales/ar/common.json';
import arAuth from './locales/ar/auth.json';
import arTasks from './locales/ar/tasks.json';
import arGamification from './locales/ar/gamification.json';
import arAdmin from './locales/ar/admin.json';
import arLanding from './locales/ar/landing.json';
import arMessages from './locales/ar/messages.json';

// French translations
import frCommon from './locales/fr/common.json';
import frAuth from './locales/fr/auth.json';
import frTasks from './locales/fr/tasks.json';
import frGamification from './locales/fr/gamification.json';
import frAdmin from './locales/fr/admin.json';
import frLanding from './locales/fr/landing.json';
import frMessages from './locales/fr/messages.json';

// Bengali translations
import bnCommon from './locales/bn/common.json';
import bnAuth from './locales/bn/auth.json';
import bnTasks from './locales/bn/tasks.json';
import bnGamification from './locales/bn/gamification.json';
import bnAdmin from './locales/bn/admin.json';
import bnLanding from './locales/bn/landing.json';
import bnMessages from './locales/bn/messages.json';

// Portuguese translations
import ptCommon from './locales/pt/common.json';
import ptAuth from './locales/pt/auth.json';
import ptTasks from './locales/pt/tasks.json';
import ptGamification from './locales/pt/gamification.json';
import ptAdmin from './locales/pt/admin.json';
import ptLanding from './locales/pt/landing.json';
import ptMessages from './locales/pt/messages.json';

// Russian translations
import ruCommon from './locales/ru/common.json';
import ruAuth from './locales/ru/auth.json';
import ruTasks from './locales/ru/tasks.json';
import ruGamification from './locales/ru/gamification.json';
import ruAdmin from './locales/ru/admin.json';
import ruLanding from './locales/ru/landing.json';
import ruMessages from './locales/ru/messages.json';

// Indonesian translations
import idCommon from './locales/id/common.json';
import idAuth from './locales/id/auth.json';
import idTasks from './locales/id/tasks.json';
import idGamification from './locales/id/gamification.json';
import idAdmin from './locales/id/admin.json';
import idLanding from './locales/id/landing.json';
import idMessages from './locales/id/messages.json';

// German translations
import deCommon from './locales/de/common.json';
import deAuth from './locales/de/auth.json';
import deTasks from './locales/de/tasks.json';
import deGamification from './locales/de/gamification.json';
import deAdmin from './locales/de/admin.json';
import deLanding from './locales/de/landing.json';
import deMessages from './locales/de/messages.json';

// Japanese translations
import jaCommon from './locales/ja/common.json';
import jaAuth from './locales/ja/auth.json';
import jaTasks from './locales/ja/tasks.json';
import jaGamification from './locales/ja/gamification.json';
import jaAdmin from './locales/ja/admin.json';
import jaLanding from './locales/ja/landing.json';
import jaMessages from './locales/ja/messages.json';

// Korean translations
import koCommon from './locales/ko/common.json';
import koAuth from './locales/ko/auth.json';
import koTasks from './locales/ko/tasks.json';
import koGamification from './locales/ko/gamification.json';
import koAdmin from './locales/ko/admin.json';
import koLanding from './locales/ko/landing.json';
import koMessages from './locales/ko/messages.json';

// Thai translations
import thCommon from './locales/th/common.json';
import thAuth from './locales/th/auth.json';
import thTasks from './locales/th/tasks.json';
import thGamification from './locales/th/gamification.json';
import thAdmin from './locales/th/admin.json';
import thLanding from './locales/th/landing.json';
import thMessages from './locales/th/messages.json';

// Turkish translations
import trCommon from './locales/tr/common.json';
import trAuth from './locales/tr/auth.json';
import trTasks from './locales/tr/tasks.json';
import trGamification from './locales/tr/gamification.json';
import trAdmin from './locales/tr/admin.json';
import trLanding from './locales/tr/landing.json';
import trMessages from './locales/tr/messages.json';

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    tasks: enTasks,
    gamification: enGamification,
    admin: enAdmin,
    landing: enLanding,
    messages: enMessages,
  },
  nl: {
    common: nlCommon,
    auth: nlAuth,
    tasks: nlTasks,
    gamification: nlGamification,
    admin: nlAdmin,
    landing: nlLanding,
    messages: nlMessages,
  },
  zh: {
    common: zhCommon,
    auth: zhAuth,
    tasks: zhTasks,
    gamification: zhGamification,
    admin: zhAdmin,
    landing: zhLanding,
    messages: zhMessages,
  },
  hi: {
    common: hiCommon,
    auth: hiAuth,
    tasks: hiTasks,
    gamification: hiGamification,
    admin: hiAdmin,
    landing: hiLanding,
    messages: hiMessages,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    tasks: esTasks,
    gamification: esGamification,
    admin: esAdmin,
    landing: esLanding,
    messages: esMessages,
  },
  ar: {
    common: arCommon,
    auth: arAuth,
    tasks: arTasks,
    gamification: arGamification,
    admin: arAdmin,
    landing: arLanding,
    messages: arMessages,
  },
  fr: {
    common: frCommon,
    auth: frAuth,
    tasks: frTasks,
    gamification: frGamification,
    admin: frAdmin,
    landing: frLanding,
    messages: frMessages,
  },
  bn: {
    common: bnCommon,
    auth: bnAuth,
    tasks: bnTasks,
    gamification: bnGamification,
    admin: bnAdmin,
    landing: bnLanding,
    messages: bnMessages,
  },
  pt: {
    common: ptCommon,
    auth: ptAuth,
    tasks: ptTasks,
    gamification: ptGamification,
    admin: ptAdmin,
    landing: ptLanding,
    messages: ptMessages,
  },
  ru: {
    common: ruCommon,
    auth: ruAuth,
    tasks: ruTasks,
    gamification: ruGamification,
    admin: ruAdmin,
    landing: ruLanding,
    messages: ruMessages,
  },
  id: {
    common: idCommon,
    auth: idAuth,
    tasks: idTasks,
    gamification: idGamification,
    admin: idAdmin,
    landing: idLanding,
    messages: idMessages,
  },
  de: {
    common: deCommon,
    auth: deAuth,
    tasks: deTasks,
    gamification: deGamification,
    admin: deAdmin,
    landing: deLanding,
    messages: deMessages,
  },
  ja: {
    common: jaCommon,
    auth: jaAuth,
    tasks: jaTasks,
    gamification: jaGamification,
    admin: jaAdmin,
    landing: jaLanding,
    messages: jaMessages,
  },
  ko: {
    common: koCommon,
    auth: koAuth,
    tasks: koTasks,
    gamification: koGamification,
    admin: koAdmin,
    landing: koLanding,
    messages: koMessages,
  },
  th: {
    common: thCommon,
    auth: thAuth,
    tasks: thTasks,
    gamification: thGamification,
    admin: thAdmin,
    landing: thLanding,
    messages: thMessages,
  },
  tr: {
    common: trCommon,
    auth: trAuth,
    tasks: trTasks,
    gamification: trGamification,
    admin: trAdmin,
    landing: trLanding,
    messages: trMessages,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'tasks', 'gamification', 'admin', 'landing', 'messages'],

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
