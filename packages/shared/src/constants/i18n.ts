// Simple i18n without heavy library

type Language = 'sk' | 'en' | 'hu'

interface Translations {
  [key: string]: {
    sk: string
    en: string
    hu: string
  }
}

const translations: Translations = {
  // Dashboard
  'dashboard.title': {
    sk: 'Prehľad',
    en: 'Dashboard',
    hu: 'Áttekintés',
  },
  'dashboard.welcome': {
    sk: 'Ahoj, {{name}} 👋',
    en: 'Hello, {{name}} 👋',
    hu: 'Szia, {{name}} 👋',
  },
  'dashboard.totalBalance': {
    sk: 'Celkový zostatok',
    en: 'Total Balance',
    hu: 'Teljes egyenleg',
  },
  'dashboard.thisMonth': {
    sk: 'Tento mesiac',
    en: 'This Month',
    hu: 'Ez a hónap',
  },
  'dashboard.spending': {
    sk: 'Výdavky',
    en: 'Spending',
    hu: 'Kiadások',
  },
  'dashboard.income': {
    sk: 'Príjmy',
    en: 'Income',
    hu: 'Bevétel',
  },
  'dashboard.transfers': {
    sk: 'Prevody medzi účtami',
    en: 'Transfers between accounts',
    hu: 'Átutalások számlák között',
  },
  'dashboard.recentTransactions': {
    sk: 'Posledné transakcie',
    en: 'Recent Transactions',
    hu: 'Legutóbbi tranzakciók',
  },
  'dashboard.spendingByCategory': {
    sk: 'Výdavky podľa kategórie',
    en: 'Spending by Category',
    hu: 'Kiadások kategória szerint',
  },

  // Transactions
  'transactions.title': {
    sk: 'Transakcie',
    en: 'Transactions',
    hu: 'Tranzakciók',
  },
  'transactions.search': {
    sk: 'Hľadať...',
    en: 'Search...',
    hu: 'Keresés...',
  },
  'transactions.filter': {
    sk: 'Filtrovať',
    en: 'Filter',
    hu: 'Szűrés',
  },
  'transactions.allAccounts': {
    sk: 'Všetky účty',
    en: 'All Accounts',
    hu: 'Minden számla',
  },
  'transactions.allCategories': {
    sk: 'Všetky kategórie',
    en: 'All Categories',
    hu: 'Minden kategória',
  },
  'transactions.markAsTransfer': {
    sk: 'Označiť ako prevod',
    en: 'Mark as transfer',
    hu: 'Megjelölés átutalásként',
  },

  // Insights
  'insights.title': {
    sk: 'Prehľady',
    en: 'Insights',
    hu: 'Betekintések',
  },
  'insights.weekly': {
    sk: 'Týždenný prehľad',
    en: 'Weekly Summary',
    hu: 'Heti összefoglaló',
  },

  // Chat
  'chat.title': {
    sk: 'Asistent',
    en: 'Assistant',
    hu: 'Asszisztens',
  },
  'chat.placeholder': {
    sk: 'Opýtajte sa na svoje financie...',
    en: 'Ask about your finances...',
    hu: 'Kérdezzen a pénzügyeiről...',
  },
  'chat.suggestion1': {
    sk: 'Koľko som minul tento mesiac?',
    en: 'How much did I spend this month?',
    hu: 'Mennyit költöttem ebben a hónapban?',
  },
  'chat.suggestion2': {
    sk: 'Aké mám predplatné?',
    en: 'What subscriptions do I have?',
    hu: 'Milyen előfizetéseim vannak?',
  },
  'chat.suggestion3': {
    sk: 'Kde míňam najviac?',
    en: 'Where do I spend the most?',
    hu: 'Hol költök a legtöbbet?',
  },

  // Settings
  'settings.title': {
    sk: 'Nastavenia',
    en: 'Settings',
    hu: 'Beállítások',
  },
  'settings.profile': {
    sk: 'Profil',
    en: 'Profile',
    hu: 'Profil',
  },
  'settings.linkedBanks': {
    sk: 'Prepojené banky',
    en: 'Linked Banks',
    hu: 'Kapcsolt bankok',
  },
  'settings.addBank': {
    sk: 'Pridať banku',
    en: 'Add Bank',
    hu: 'Bank hozzáadása',
  },
  'settings.disconnectBank': {
    sk: 'Odpojiť banku',
    en: 'Disconnect Bank',
    hu: 'Bank leválasztása',
  },
  'settings.transferManagement': {
    sk: 'Správa prevodov',
    en: 'Transfer Management',
    hu: 'Átutaláskezelés',
  },
  'settings.language': {
    sk: 'Jazyk',
    en: 'Language',
    hu: 'Nyelv',
  },

  // Auth
  'auth.welcome': {
    sk: 'Tvoje peniaze. Konečne pod kontrolou.',
    en: 'Your money. Finally under control.',
    hu: 'A te pénzed. Végre ellenőrzés alatt.',
  },
  'auth.signIn': {
    sk: 'Prihlásiť sa',
    en: 'Sign In',
    hu: 'Bejelentkezés',
  },
  'auth.signInWithGoogle': {
    sk: 'Prihlásiť sa cez Google',
    en: 'Sign in with Google',
    hu: 'Bejelentkezés Google-lal',
  },
  'auth.magicLink': {
    sk: 'Email odkaz',
    en: 'Magic Link',
    hu: 'E-mail link',
  },

  // Common
  'common.save': {
    sk: 'Uložiť',
    en: 'Save',
    hu: 'Mentés',
  },
  'common.cancel': {
    sk: 'Zrušiť',
    en: 'Cancel',
    hu: 'Mégse',
  },
  'common.delete': {
    sk: 'Zmazať',
    en: 'Delete',
    hu: 'Törlés',
  },
  'common.confirm': {
    sk: 'Potvrdiť',
    en: 'Confirm',
    hu: 'Megerősítés',
  },
  'common.loading': {
    sk: 'Načítavam...',
    en: 'Loading...',
    hu: 'Betöltés...',
  },
  'common.error': {
    sk: 'Chyba',
    en: 'Error',
    hu: 'Hiba',
  },
}

export function t(key: string, lang: Language = 'sk', vars?: Record<string, string>): string {
  const translation = translations[key]
  if (!translation) {
    console.warn(`Missing translation for key: ${key}`)
    return key
  }

  let text = translation[lang] || translation.sk

  // Simple variable interpolation
  if (vars) {
    Object.entries(vars).forEach(([varKey, varValue]) => {
      text = text.replace(`{{${varKey}}}`, varValue)
    })
  }

  return text
}

export function getLanguageName(lang: Language): string {
  const names: Record<Language, string> = {
    sk: 'Slovenčina',
    en: 'English',
    hu: 'Magyar',
  }
  return names[lang]
}
