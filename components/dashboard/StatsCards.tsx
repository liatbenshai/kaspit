'use client'

import { Card } from '@/components/ui/Card'
import { formatCurrency, calculateChange } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, ArrowUp, ArrowDown, Building2, CheckCircle, AlertCircle, Link2, Clock, CalendarClock, Banknote, FileText, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IncomeBreakdown {
  // נכנס בפועל - חשבונית מס קבלה + קבלה (ששולמו)
  actualReceived: number
  actualReceivedCount: number
  // הופק לדיווח מע"מ - חשבונית מס + חשבונית מס קבלה
  issuedForVat: number
  issuedForVatCount: number
  // צפי גבייה - חשבוניות עסקה פתוחות + חשבוניות מס לא שולמו
  expectedCollection: number
  expectedCollectionCount: number
  // באיחור
  overdueAmount: number
  overdueCount: number
}

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
  // הכנסות עתידיות ובאיחור (legacy - לתאימות אחורה)
  futureIncome?: number
  overdueIncome?: number
  futureCount?: number
  overdueCount?: number
  // פירוט הכנסות חדש
  incomeBreakdown?: IncomeBreakdown
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
  futureIncome = 0,
  overdueIncome = 0,
  futureCount = 0,
  overdueCount = 0,
  incomeBreakdown,
}: StatsCardsProps) {
  const incomeChange = calculateChange(totalIncome, prevIncome)
  const expensesChange = calculateChange(totalExpenses, prevExpenses)
  
  // השתמש ב-actualReceived לחישוב הרווח האמיתי אם זמין
  const actualIncome = incomeBreakdown?.actualReceived ?? totalIncome
  const profit = actualIncome - totalExpenses

  return (
    <div className="space-y-4">
      {/* שורה ראשונה - 3 סוגי הכנסות */}
      {incomeBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* נכנס בפועל */}
          <Card padding="md" className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium flex items-center gap-1">
                  <Banknote className="w-4 h-4" />
                  נכנס בפועל
                </p>
                <p className="text-2xl font-bold text-green-800 mt-1">
                  {formatCurrency(incomeBreakdown.actualReceived)}
                </p>
                <p className="text-xs text-green-600 mt-2">
                  {incomeBreakdown.actualReceivedCount} קבלות וחשבוניות מס קבלה
                </p>
              </div>
              <div className="p-3 rounded-xl bg-green-100">
                <Receipt className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          {/* הופק לדיווח מע"מ */}
          <Card padding="md" className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  הופק לדיווח מע״מ
                </p>
                <p className="text-2xl font-bold text-blue-800 mt-1">
                  {formatCurrency(incomeBreakdown.issuedForVat)}
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  {incomeBreakdown.issuedForVatCount} חשבוניות מס
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          {/* צפי גבייה */}
          <Card padding="md" className={cn(
            "bg-gradient-to-br border",
            incomeBreakdown.expectedCollection > 0 
              ? "from-amber-50 to-orange-50 border-amber-200" 
              : "from-gray-50 to-slate-50 border-gray-200"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  "text-sm font-medium flex items-center gap-1",
                  incomeBreakdown.expectedCollection > 0 ? "text-amber-700" : "text-gray-500"
                )}>
                  <CalendarClock className="w-4 h-4" />
                  תשלומים עתידיים
                </p>
                <p className={cn(
                  "text-2xl font-bold mt-1",
                  incomeBreakdown.expectedCollection > 0 ? "text-amber-800" : "text-gray-400"
                )}>
                  {formatCurrency(incomeBreakdown.expectedCollection)}
                </p>
                <p className={cn(
                  "text-xs mt-2",
                  incomeBreakdown.expectedCollection > 0 ? "text-amber-600" : "text-gray-400"
                )}>
                  {incomeBreakdown.expectedCollectionCount > 0 
                    ? `${incomeBreakdown.expectedCollectionCount} חשבוניות עסקה וחשבוניות מס`
                    : 'אין חשבוניות ממתינות 🎉'
                  }
                </p>
              </div>
              <div className={cn(
                "p-3 rounded-xl",
                incomeBreakdown.expectedCollection > 0 ? "bg-amber-100" : "bg-gray-100"
              )}>
                <CalendarClock className={cn(
                  "w-6 h-6",
                  incomeBreakdown.expectedCollection > 0 ? "text-amber-600" : "text-gray-400"
                )} />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* באיחור - אזהרה */}
      {incomeBreakdown && incomeBreakdown.overdueAmount > 0 && (
        <Card padding="md" className="bg-gradient-to-br from-red-50 to-rose-50 border-red-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-medium flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                באיחור - דורש טיפול!
              </p>
              <p className="text-2xl font-bold text-red-700 mt-1">
                {formatCurrency(incomeBreakdown.overdueAmount)}
              </p>
              <a href="/collection" className="text-xs text-red-600 hover:underline mt-2 inline-block">
                {incomeBreakdown.overdueCount} חשבוניות לגבייה →
              </a>
            </div>
            <div className="p-3 rounded-xl bg-red-100">
              <Clock className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>
      )}

      {/* שורה שנייה - הוצאות ורווח */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* רווח/הפסד - מחושב מ"נכנס בפועל" */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                רווח/הפסד {periodLabel}
                {incomeBreakdown && <span className="text-xs block text-gray-400">(לפי נכנס בפועל)</span>}
              </p>
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

        {/* יתרת בנק */}
        <Card padding="md" className="bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700 font-medium">יתרת בנק אחרונה</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {bankBalance !== null ? formatCurrency(bankBalance) : 'לא זמין'}
              </p>
              <p className="text-xs text-slate-600 mt-2">מתנועות הבנק שיובאו</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-100">
              <Building2 className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* שורה שלישית - התאמות בנק */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* תנועות מותאמות */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">תנועות בנק מותאמות</p>
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

      {/* Legacy: הכנסות עתידיות ובאיחור - רק אם אין incomeBreakdown */}
      {!incomeBreakdown && (futureIncome > 0 || overdueIncome > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {futureIncome > 0 && (
            <Card padding="md" className="bg-gradient-to-br from-primary-50 to-indigo-50 border-primary-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary-700 font-medium">הכנסות עתידיות</p>
                  <p className="text-2xl font-bold text-primary-900 mt-1">
                    {formatCurrency(futureIncome)}
                  </p>
                  <p className="text-xs text-primary-600 mt-2">
                    {futureCount} חשבוניות ממתינות לתשלום
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-primary-100">
                  <CalendarClock className="w-6 h-6 text-primary-600" />
                </div>
              </div>
            </Card>
          )}

          {overdueIncome > 0 && (
            <Card padding="md" className="bg-gradient-to-br from-danger-50 to-red-50 border-danger-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-danger-700 font-medium flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    באיחור!
                  </p>
                  <p className="text-2xl font-bold text-danger-700 mt-1">
                    {formatCurrency(overdueIncome)}
                  </p>
                  <a href="/income" className="text-xs text-danger-600 hover:underline mt-2 inline-block">
                    {overdueCount} חשבוניות לטיפול →
                  </a>
                </div>
                <div className="p-3 rounded-xl bg-danger-100">
                  <AlertCircle className="w-6 h-6 text-danger-600" />
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
