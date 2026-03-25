// Formatting utilities

export function formatCurrency(amount: number, currency: string = 'EUR', locale: string = 'sk-SK'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(value: number, locale: string = 'sk-SK'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(date: string | Date, locale: string = 'sk-SK'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export function formatDateShort(date: string | Date, locale: string = 'sk-SK'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

export function formatRelativeTime(date: string | Date, locale: string = 'sk-SK'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInMs = now.getTime() - d.getTime()
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInDays === 0) return locale === 'sk-SK' ? 'Dnes' : 'Today'
  if (diffInDays === 1) return locale === 'sk-SK' ? 'Včera' : 'Yesterday'
  if (diffInDays < 7) return `${diffInDays} ${locale === 'sk-SK' ? 'dní' : 'days'} ago`

  return formatDateShort(d, locale)
}

export function parseAmount(amount: string): number {
  // GoCardless returns amounts as strings
  return parseFloat(amount)
}

export function isTransferAmount(amount: number): boolean {
  // Helper to check if amount is likely a transfer (often round numbers)
  return Math.abs(amount) % 10 === 0 || Math.abs(amount) % 100 === 0
}

export function cleanMerchantName(description: string): string {
  // Remove common noise from merchant descriptions
  let cleaned = description

  // Remove card numbers
  cleaned = cleaned.replace(/\*{4}\d{4}/g, '')
  
  // Remove terminal IDs
  cleaned = cleaned.replace(/\bTID\s*\d+/gi, '')
  cleaned = cleaned.replace(/\bPOS\s*\d+/gi, '')
  
  // Remove dates
  cleaned = cleaned.replace(/\d{2}\.\d{2}\.\d{4}/g, '')
  cleaned = cleaned.replace(/\d{2}\/\d{2}\/\d{4}/g, '')
  
  // Remove common prefixes
  cleaned = cleaned.replace(/^(Platba kartou|Card payment|Kártyás fizetés)\s*/i, '')
  cleaned = cleaned.replace(/^(Prevod|Transfer|Átutalás)\s*/i, '')
  
  // Remove city names (common in Slovakia)
  const cities = ['BRATISLAVA', 'KOŠICE', 'PREŠOV', 'ŽILINA', 'NITRA', 'BANSKÁ BYSTRICA', 'TRNAVA', 'TRENČÍN']
  cities.forEach(city => {
    cleaned = cleaned.replace(new RegExp(`\\b${city}\\b`, 'gi'), '')
  })
  
  // Clean up whitespace
  cleaned = cleaned.trim().replace(/\s+/g, ' ')
  
  return cleaned
}

export function detectMerchantFromDescription(description: string): string | null {
  const cleaned = cleanMerchantName(description).toUpperCase()
  
  // Common Slovak merchants
  const merchants: Record<string, string> = {
    'KAUFLAND': 'Kaufland',
    'LIDL': 'Lidl',
    'TESCO': 'Tesco',
    'BILLA': 'Billa',
    'SHELL': 'Shell',
    'OMV': 'OMV',
    'ORANGE': 'Orange SK',
    'TELEKOM': 'Slovak Telekom',
    'O2': 'O2 Slovakia',
    'BOLT': 'Bolt',
    'WOLT': 'Wolt',
    'GLOVO': 'Glovo',
    'NETFLIX': 'Netflix',
    'SPOTIFY': 'Spotify',
    'HBO': 'HBO Max',
    'ALZA': 'Alza.sk',
    'MALL': 'Mall.sk',
    'NAY': 'NAY',
    'DR.MAX': 'Dr. Max',
    'NOTINO': 'Notino',
    'DECATHLON': 'Decathlon',
    'IKEA': 'IKEA',
  }
  
  for (const [key, value] of Object.entries(merchants)) {
    if (cleaned.includes(key)) {
      return value
    }
  }
  
  return null
}
