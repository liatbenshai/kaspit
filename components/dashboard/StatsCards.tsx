'use client'

import { Card } from '@/components/ui/Card'
import { formatCurrency, calculateChange } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, ArrowUp, ArrowDown, Building2, CheckCircle, AlertCircle, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardsProps {
  totalIncome: number
  totalExpenses: number
  bankBalance: number | null
  prevIncome?: number
  prevExpenses?: number
  periodLabel?: string
  // נתוני התאמה
  matchedTransactions?: number
  unmatchedTransactions?: number
}

export function StatsCards({
  totalIncome,
  totalExpenses,
  bankBalance,
  prevIncome = 0,
  prevExpenses = 0,
  periodLabel = 'בתקופה',
  matchedTransactions = 0,
  unmatchedTransactions = 0,
}: StatsCardsProps) {
  const incomeChange = calculateChange(totalIncome, prevIncome)
  const expensesChange = calculateChange(totalExpenses, prevExpenses)
  const profit = totalIncome - totalExpenses

  return (
    <div className="space-y-4">
      {/* שורה ראשונה - הכנסות, הוצאות, רווח */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* הכנסות */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">הכנסות {periodLabel}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(totalIncome)}
              </p>
              {prevIncome > 0 && (
                <div className="flex items-center mt-2">
                  {incomeChange > 0 ? (
                    <ArrowUp className="w-4 h-4 text-success-500" />
                  ) : incomeChange < 0 ? (
                    <ArrowDown className="w-4 h-4 text-danger-500" />
                  ) : null}
                  <span className={cn(
                    'text-sm font-medium mr-1',
                    incomeChange > 0 ? 'text-success-500' : incomeChange < 0 ? 'text-danger-500' : 'text-gray-500'
                  )}>
                    {Math.abs(incomeChange)}%
                  </span>
                  <span className="text-xs text-gray-400 mr-1">מתקופה קודמת</span>
                </div>
              )}
            </div>
            <div className="p-3 rounded-xl bg-success-50">
              <TrendingUp className="w-6 h-6 text-success-600" />
            </div>
          </div>
        </Card>

        {/* הוצאות */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">הוצאות {periodLabel}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(totalExpenses)}
              </p>
              {prevExpenses > 0 && (
                <div className="flex items-center mt-2">
                  {expensesChange > 0 ? (
                    <ArrowUp className="w-4 h-4 text-danger-500" />
                  ) : expensesChange < 0 ? (
                    <ArrowDown className="w-4 h-4 text-success-500" />
                  ) : null}
                  <span className={cn(
                    'text-sm font-medium mr-1',
                    expensesChange > 0 ? 'text-danger-500' : expensesChange < 0 ? 'text-success-500' : 'text-gray-500'
                  )}>
                    {Math.abs(expensesChange)}%
                  </span>
                  <span className="text-xs text-gray-400 mr-1">מתקופה קודמת</span>
                </div>
              )}
            </div>
            <div className="p-3 rounded-xl bg-danger-50">
              <TrendingDown className="w-6 h-6 text-danger-600" />
            </div>
          </div>
        </Card>

        {/* רווח/הפסד */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">רווח/הפסד {periodLabel}</p>
              <p className={cn(
                'text-2xl font-bold mt-1',
                profit >= 0 ? 'text-success-600' : 'text-danger-600'
              )}>
                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {profit >= 0 ? 'מצב חיובי 👍' : 'שימי לב להוצאות ⚠️'}
              </p>
            </div>
            <div className={cn(
              'p-3 rounded-xl',
              profit >= 0 ? 'bg-success-50' : 'bg-danger-50'
            )}>
              <Wallet className={cn(
                'w-6 h-6',
                profit >= 0 ? 'text-success-600' : 'text-danger-600'
              )} />
            </div>
          </div>
        </Card>
      </div>

      {/* שורה שנייה - יתרת בנק והתאמות */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* יתרת בנק */}
        <Card padding="md" className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">יתרת בנק אחרונה</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {bankBalance !== null ? formatCurrency(bankBalance) : 'לא זמין'}
              </p>
              <p className="text-xs text-blue-600 mt-2">מתנועות הבנק שיובאו</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-100">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* תנועות מותאמות */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">תנועות מותאמות</p>
              <p className="text-2xl font-bold text-success-600 mt-1">
                {matchedTransactions}
              </p>
              <p className="text-xs text-gray-400 mt-2">הכנסות והוצאות משויכות לבנק</p>
            </div>
            <div className="p-3 rounded-xl bg-success-50">
              <CheckCircle className="w-6 h-6 text-success-600" />
            </div>
          </div>
        </Card>

        {/* תנועות לא מותאמות */}
        <Card padding="md" className={unmatchedTransactions > 0 ? 'border-warning-300 bg-warning-50/30' : ''}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">ממתינות להתאמה</p>
              <p className={cn(
                'text-2xl font-bold mt-1',
                unmatchedTransactions > 0 ? 'text-warning-600' : 'text-gray-400'
              )}>
                {unmatchedTransactions}
              </p>
              {unmatchedTransactions > 0 ? (
                <a href="/bank" className="text-xs text-primary-600 hover:underline mt-2 inline-block">
                  לחצי להתאמה →
                </a>
              ) : (
                <p className="text-xs text-gray-400 mt-2">הכל מותאם! 🎉</p>
              )}
            </div>
            <div className={cn(
              'p-3 rounded-xl',
              unmatchedTransactions > 0 ? 'bg-warning-100' : 'bg-gray-100'
            )}>
              {unmatchedTransactions > 0 ? (
                <AlertCircle className="w-6 h-6 text-warning-600" />
              ) : (
                <Link2 className="w-6 h-6 text-gray-400" />
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
