// System categories — seed data for database

export interface CategorySeed {
  slug: string
  name_sk: string
  name_en: string
  name_hu: string
  icon: string
  color: string
  sort_order: number
}

export const SYSTEM_CATEGORIES: CategorySeed[] = [
  // Expenses
  {
    slug: 'groceries',
    name_sk: 'Potraviny',
    name_en: 'Groceries',
    name_hu: 'Élelmiszerbolt',
    icon: '🛒',
    color: '#4ade80',
    sort_order: 1,
  },
  {
    slug: 'dining',
    name_sk: 'Reštaurácie',
    name_en: 'Dining',
    name_hu: 'Éttermek',
    icon: '🍽️',
    color: '#f97316',
    sort_order: 2,
  },
  {
    slug: 'transport',
    name_sk: 'Doprava',
    name_en: 'Transport',
    name_hu: 'Közlekedés',
    icon: '🚗',
    color: '#3b82f6',
    sort_order: 3,
  },
  {
    slug: 'housing',
    name_sk: 'Bývanie',
    name_en: 'Housing',
    name_hu: 'Lakhatás',
    icon: '🏠',
    color: '#8b5cf6',
    sort_order: 4,
  },
  {
    slug: 'utilities',
    name_sk: 'Energie',
    name_en: 'Utilities',
    name_hu: 'Közművek',
    icon: '⚡',
    color: '#eab308',
    sort_order: 5,
  },
  {
    slug: 'shopping',
    name_sk: 'Nakupovanie',
    name_en: 'Shopping',
    name_hu: 'Vásárlás',
    icon: '🛍️',
    color: '#ec4899',
    sort_order: 6,
  },
  {
    slug: 'entertainment',
    name_sk: 'Zábava',
    name_en: 'Entertainment',
    name_hu: 'Szórakozás',
    icon: '🎬',
    color: '#06b6d4',
    sort_order: 7,
  },
  {
    slug: 'health',
    name_sk: 'Zdravie',
    name_en: 'Health',
    name_hu: 'Egészség',
    icon: '💊',
    color: '#ef4444',
    sort_order: 8,
  },
  {
    slug: 'subscriptions',
    name_sk: 'Predplatné',
    name_en: 'Subscriptions',
    name_hu: 'Előfizetések',
    icon: '📱',
    color: '#a855f7',
    sort_order: 9,
  },
  {
    slug: 'savings',
    name_sk: 'Úspory',
    name_en: 'Savings',
    name_hu: 'Megtakarítások',
    icon: '💰',
    color: '#22c55e',
    sort_order: 10,
  },
  {
    slug: 'education',
    name_sk: 'Vzdelávanie',
    name_en: 'Education',
    name_hu: 'Oktatás',
    icon: '🎓',
    color: '#0ea5e9',
    sort_order: 11,
  },
  {
    slug: 'travel',
    name_sk: 'Cestovanie',
    name_en: 'Travel',
    name_hu: 'Utazás',
    icon: '✈️',
    color: '#f59e0b',
    sort_order: 12,
  },
  {
    slug: 'fitness',
    name_sk: 'Šport',
    name_en: 'Fitness',
    name_hu: 'Fitness',
    icon: '🏋️',
    color: '#14b8a6',
    sort_order: 13,
  },
  {
    slug: 'pets',
    name_sk: 'Zvieratá',
    name_en: 'Pets',
    name_hu: 'Háziállatok',
    icon: '🐕',
    color: '#d97706',
    sort_order: 14,
  },
  {
    slug: 'gifts',
    name_sk: 'Dary',
    name_en: 'Gifts',
    name_hu: 'Ajándékok',
    icon: '🎁',
    color: '#e879f9',
    sort_order: 15,
  },
  {
    slug: 'fees',
    name_sk: 'Poplatky',
    name_en: 'Fees',
    name_hu: 'Díjak',
    icon: '💸',
    color: '#64748b',
    sort_order: 16,
  },
  {
    slug: 'transfers',
    name_sk: 'Prevody',
    name_en: 'Transfers',
    name_hu: 'Átutalások',
    icon: '↔️',
    color: '#94a3b8',
    sort_order: 17,
  },
  {
    slug: 'other',
    name_sk: 'Ostatné',
    name_en: 'Other',
    name_hu: 'Egyéb',
    icon: '📦',
    color: '#6b7280',
    sort_order: 18,
  },
  // Income
  {
    slug: 'income-salary',
    name_sk: 'Príjem – Plat',
    name_en: 'Income – Salary',
    name_hu: 'Jövedelem – Fizetés',
    icon: '💵',
    color: '#16a34a',
    sort_order: 19,
  },
  {
    slug: 'income-other',
    name_sk: 'Príjem – Ostatné',
    name_en: 'Income – Other',
    name_hu: 'Jövedelem – Egyéb',
    icon: '💵',
    color: '#15803d',
    sort_order: 20,
  },
]

// Category name lookup by language
export function getCategoryName(
  category: { name_sk: string; name_en: string; name_hu: string },
  lang: 'sk' | 'en' | 'hu'
): string {
  switch (lang) {
    case 'sk':
      return category.name_sk
    case 'en':
      return category.name_en
    case 'hu':
      return category.name_hu
    default:
      return category.name_sk
  }
}
