'use client'

import Link from 'next/link'
import { formatCurrency, calculateChange } from '@/lib/utils'
import { 
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  Building2, CheckCircle, AlertCircle, CalendarClock, 
  Banknote, FileText, ArrowLeft, Users, Receipt, Landmark,
  CreditCard, ChevronDown, ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface IncomeBreakdown {
  actualReceived: number
  actualReceivedCount: number
  issuedForVat: number
  issuedForVatCount: number
  expectedCollection: number
  expectedCollectionCount: number
  overdueAmount: number
  overdueCount: number
}

interface ExpensesBreakdown {
  operational: number
  operationalCount: number
  salary: number
  salaryCount: number
  taxes: number
  taxesCount: number
  socialSecurity: number
  socialSecurityCount: number
  loans: number
  loansCount: number
  bankFees: number
  bankFeesCount: number
}

interface StatsCardsProps {
  totalIncome: number
  totalExpenses: number
  bankBalance: number | null
  prevIncome?: number
  prevExpenses?: number
  periodLabel?: string
  selectedMonth?: number
  selectedYear?: number
  matchedTransactions?: number
  unmatchedTransactions?: number
  futureIncome?: number
  overdueIncome?: number
  futureCount?: number
  overdueCount?: number
  incomeBreakdown?: IncomeBreakdown
  expensesBreakdown?: ExpensesBreakdown
}

export function StatsCards({
  totalIncome,
  totalExpenses,
  bankBalance,
  prevIncome = 0,
  prevExpenses = 0,
  periodLabel = '',
  selectedMonth,
  selectedYear,
  matchedTransactions = 0,
  unmatchedTransactions = 0,
  incomeBreakdown,
  expensesBreakdown,
}: StatsCardsProps) {
  const [showExpenseDetails, setShowExpenseDetails] = useState(false)
  const expensesChange = calculateChange(totalExpenses, prevExpenses)
  const actualIncome = incomeBreakdown?.actualReceived ?? totalIncome
  const profit = actualIncome - totalExpenses

  // בניית query string לפילטור לפי חודש/שנה
  const getFilterParams = () => {
    if (selectedMonth && selectedYear) {
      return `?filterMonth=${selectedMonth}&filterYear=${selectedYear}`
    }
    if (selectedYear) {
      return `?filterYear=${selectedYear}`
    }
    return ''
  }
  const filterParams = getFilterParams()

  // פריטי פירוט הוצאות להצגה
  const expenseItems = expensesBreakdown ? [
    { key: 'operational', label: '🏢 תפעול', amount: expensesBreakdown.operational, count: expensesBreakdown.operationalCount, color: 'text-gray-600' },
    { key: 'salary', label: '💰 משכורות', amount: expensesBreakdown.salary, count: expensesBreakdown.salaryCount, color: 'text-blue-600' },
    { key: 'taxes', label: '📋 מסים', amount: expensesBreakdown.taxes, count: expensesBreakdown.taxesCount, color: 'text-purple-600' },
    { key: 'socialSecurity', label: '🏛️ ביטוח לאומי', amount: expensesBreakdown.socialSecurity, count: expensesBreakdown.socialSecurityCount, color: 'text-indigo-600' },
    { key: 'loans', label: '🏦 הלוואות', amount: expensesBreakdown.loans, count: expensesBreakdown.loansCount, color: 'text-amber-600' },
    { key: 'bankFees', label: '💳 עמלות בנק', amount: expensesBreakdown.bankFees, count: expensesBreakdown.bankFeesCount, color: 'text-gray-500' },
  ].filter(item => item.amount > 0) : []

  return (
    <div className="space-y-4">
      {/* כרטיסי הכנסות - שורה ראשונה */}
      {incomeBreakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* נכנס בפועל */}
          <Link href={`/income${filterParams}${filterParams ? '&' : '?'}filterDocType=receipt,tax_invoice_receipt`} className="group">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-16 -translate-y-16" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <ArrowLeft className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-emerald-100 text-sm font-medium">💵 נכנס בפועל</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(incomeBreakdown.actualReceived)}</p>
                <p className="text-emerald-200 text-sm mt-2">{incomeBreakdown.actualReceivedCount} קבלות</p>
              </div>
            </div>
          </Link>

          {/* לדיווח מע"מ */}
          <Link href={`/income${filterParams}${filterParams ? '&' : '?'}filterDocType=tax_invoice,tax_invoice_receipt`} className="group">
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-16 -translate-y-16" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <FileText className="w-5 h-5" />
                  </div>
                  <ArrowLeft className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-blue-100 text-sm font-medium">📄 לדיווח מע״מ</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(incomeBreakdown.issuedForVat)}</p>
                <p className="text-blue-200 text-sm mt-2">{incomeBreakdown.issuedForVatCount} חשבוניות מס</p>
              </div>
            </div>
          </Link>

          {/* תשלומים עתידיים */}
          <Link href={`/income${filterParams}${filterParams ? '&' : '?'}filterDocType=invoice,tax_invoice&filterStatus=pending`} className="group">
            <div className={cn(
              "relative overflow-hidden rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1",
              incomeBreakdown.expectedCollection > 0 
                ? "bg-gradient-to-br from-amber-500 to-orange-600" 
                : "bg-gradient-to-br from-gray-400 to-gray-500"
            )}>
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-16 -translate-y-16" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <ArrowLeft className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-amber-100 text-sm font-medium">⏳ תשלומים עתידיים</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(incomeBreakdown.expectedCollection)}</p>
                <p className="text-amber-200 text-sm mt-2">
                  {incomeBreakdown.expectedCollectionCount > 0 
                    ? `${incomeBreakdown.expectedCollectionCount} ממתינות לגבייה` 
                    : 'הכל נגבה! 🎉'}
                </p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* אזהרת איחור */}
      {incomeBreakdown && incomeBreakdown.overdueAmount > 0 && (
        <Link href="/collection" className="block">
          <div className="bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 text-white rounded-2xl p-4 flex items-center justify-between hover:shadow-xl transition-all duration-300 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 rounded-xl p-3">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <p className="font-bold text-lg">🚨 {incomeBreakdown.overdueCount} חשבוניות באיחור!</p>
                <p className="text-white/80">סה״כ {formatCurrency(incomeBreakdown.overdueAmount)} - לחצי לטיפול</p>
              </div>
            </div>
            <ArrowLeft className="w-6 h-6" />
          </div>
        </Link>
      )}

      {/* שורה שנייה - הוצאות (עם פירוט), רווח, בנק */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* הוצאות עם פירוט */}
        <div className="relative">
          <Link href={`/expenses${filterParams}`} className="group block">
            <div className="relative overflow-hidden bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-16 -translate-y-16" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <ArrowLeft className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-red-100 text-sm font-medium">💸 הוצאות {periodLabel}</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(totalExpenses)}</p>
                {prevExpenses > 0 && expensesChange !== 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <span className={cn(
                      "inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full",
                      expensesChange > 0 ? "bg-white/20 text-white" : "bg-green-400/30 text-green-100"
                    )}>
                      {expensesChange > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(expensesChange)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
          
          {/* כפתור פירוט */}
          {expenseItems.length > 0 && (
            <button 
              onClick={() => setShowExpenseDetails(!showExpenseDetails)}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-full px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1 border"
            >
              {showExpenseDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              פירוט
            </button>
          )}
        </div>

        {/* רווח/הפסד */}
        <div className={cn(
          "relative overflow-hidden rounded-2xl p-5 shadow-lg",
          profit >= 0 
            ? "bg-gradient-to-br from-purple-500 to-violet-600 text-white" 
            : "bg-gradient-to-br from-gray-700 to-gray-800 text-white"
        )}>
          <div className="absolute top-0 left-0 w-40 h-40 bg-white/5 rounded-full -translate-x-20 -translate-y-20" />
          <div className="relative">
            <div className="bg-white/20 rounded-xl p-2 w-fit mb-3">
              <Wallet className="w-5 h-5" />
            </div>
            <p className="text-white/70 text-sm font-medium">💰 רווח/הפסד {periodLabel}</p>
            <p className="text-4xl font-bold mt-1">{formatCurrency(profit)}</p>
            <p className="text-white/60 text-sm mt-2">
              {profit >= 0 ? '✨ מצב מצוין!' : '⚠️ שימי לב להוצאות'}
            </p>
          </div>
        </div>

        {/* יתרת בנק */}
        <Link href="/bank" className="group">
          <div className="relative overflow-hidden bg-white border-2 border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-gray-300">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-gray-100 rounded-xl p-2">
                <Building2 className="w-5 h-5 text-gray-600" />
              </div>
              <ArrowLeft className="w-5 h-5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-gray-500 text-sm font-medium">🏦 יתרת בנק</p>
            <p className={cn(
              "text-3xl font-bold mt-1",
              bankBalance !== null && bankBalance >= 0 ? "text-gray-900" : "text-red-600"
            )}>
              {bankBalance !== null ? formatCurrency(bankBalance) : 'לא זמין'}
            </p>
            <p className="text-gray-400 text-sm mt-2">יתרה אחרונה</p>
          </div>
        </Link>
      </div>

      {/* פירוט הוצאות - מתרחב */}
      {showExpenseDetails && expenseItems.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-red-100 p-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <p className="text-sm font-medium text-gray-700 mb-3">📊 פירוט הוצאות {periodLabel}:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {expenseItems.map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-600">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.count} רשומות</p>
                </div>
                <p className={cn("text-lg font-bold", item.color)}>{formatCurrency(item.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* שורה שלישית - התאמות */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/matching" className="group">
          <div className="bg-white border-2 border-green-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-green-200">
            <div className="bg-green-100 rounded-xl p-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-500 text-sm">✅ תנועות מותאמות</p>
              <p className="text-2xl font-bold text-green-600">{matchedTransactions}</p>
            </div>
            <ArrowLeft className="w-5 h-5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>

        <Link href="/reconciliation" className="group">
          <div className={cn(
            "border-2 rounded-2xl p-4 flex items-center gap-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5",
            unmatchedTransactions > 0 
              ? "bg-amber-50 border-amber-200 hover:border-amber-300" 
              : "bg-white border-gray-100 hover:border-gray-200"
          )}>
            <div className={cn(
              "rounded-xl p-3",
              unmatchedTransactions > 0 ? "bg-amber-100" : "bg-gray-100"
            )}>
              {unmatchedTransactions > 0 
                ? <AlertCircle className="w-6 h-6 text-amber-600" />
                : <CheckCircle className="w-6 h-6 text-gray-400" />
              }
            </div>
            <div className="flex-1">
              <p className="text-gray-500 text-sm">⏳ ממתינות להתאמה</p>
              <p className={cn(
                "text-2xl font-bold",
                unmatchedTransactions > 0 ? "text-amber-600" : "text-gray-400"
              )}>
                {unmatchedTransactions}
              </p>
            </div>
            <ArrowLeft className="w-5 h-5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
      </div>
    </div>
  )
}
