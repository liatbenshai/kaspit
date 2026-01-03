import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { he } from 'date-fns/locale'

// מיזוג classNames
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// פורמט מספר לש"ח
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// פורמט מספר עם פסיקים
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('he-IL').format(num)
}

// פורמט תאריך בעברית
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd בMMMM yyyy', { locale: he })
}

// פורמט תאריך קצר
export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy')
}

// פורמט חודש ושנה
export function formatMonthYear(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMMM yyyy', { locale: he })
}

// חישוב אחוז
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

// חישוב שינוי באחוזים
export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

// צבע לפי סטטוס
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'warning',
    partial: 'primary',
    paid: 'success',
    cancelled: 'danger',
  }
  return colors[status] || 'gray'
}

// תרגום סטטוס
export function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    pending: 'ממתין',
    partial: 'שולם חלקית',
    paid: 'שולם',
    cancelled: 'בוטל',
  }
  return translations[status] || status
}

// תרגום סוג
export function translateType(type: string): string {
  const translations: Record<string, string> = {
    income: 'הכנסה',
    expense: 'הוצאה',
  }
  return translations[type] || type
}

// תרגום תפקיד
export function translateRole(role: string): string {
  const translations: Record<string, string> = {
    admin: 'מנהל מערכת',
    finance_manager: 'מנהל כספים',
  }
  return translations[role] || role
}

// חודשים בעברית
export const hebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
]

// קבלת שם חודש
export function getMonthName(month: number): string {
  return hebrewMonths[month - 1] || ''
}

// יצירת צבע רנדומלי
export function generateColor(): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

// קיצור טקסט
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

// בדיקה אם מספר
export function isNumeric(value: string): boolean {
  return !isNaN(Number(value)) && !isNaN(parseFloat(value))
}

// המרת מחרוזת למספר
export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, '')
  return parseFloat(cleaned) || 0
}
