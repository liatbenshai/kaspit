'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { BudgetProgress } from '@/components/dashboard/BudgetProgress'
import { Insights } from '@/components/dashboard/Insights'
import { CashFlowForecast } from '@/components/dashboard/CashFlowForecast'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { generateInsights, analyzeBudgetStatus, calculateCashFlowForecast } from '@/lib/insights'
import { formatCurrency, getMonthName, hebrewMonths } from '@/lib/utils'
import { TrendingUp, TrendingDown, PieChart, Calendar } from 'lucide-react'
import type { Insight, BudgetStatus } from '@/lib/insights'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  
  // בחירת תקופה
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [viewMode, setViewMode] = useState<'month' | 'year' | 'all'>('all')
  
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    bankBalance: null as number | null,
    prevIncome: 0,
    prevExpenses: 0,
    matchedTransactions: 0,
    unmatchedTransactions: 0,
    futureIncome: 0,
    overdueIncome: 0,
    futureCount: 0,
    overdueCount: 0,
  })
  const [chartData, setChartData] = useState<any[]>([])
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [forecast, setForecast] = useState<any[]>([])
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [selectedYear, selectedMonth, viewMode])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const companyId = profile.company_id

      // מציאת טווח התאריכים של הנתונים במערכת
      const { data: earliestIncome } = await supabase
        .from('income')
        .select('date')
        .eq('company_id', companyId)
        .order('date', { ascending: true })
        .limit(1)

      const { data: earliestExpense } = await supabase
        .from('expenses')
        .select('date')
        .eq('company_id', companyId)
        .order('date', { ascending: true })
        .limit(1)

      // קביעת שנים זמינות
      const years = new Set<number>()
      if (earliestIncome?.[0]?.date) {
        const year = new Date(earliestIncome[0].date).getFullYear()
        for (let y = year; y <= currentDate.getFullYear(); y++) years.add(y)
      }
      if (earliestExpense?.[0]?.date) {
        const year = new Date(earliestExpense[0].date).getFullYear()
        for (let y = year; y <= currentDate.getFullYear(); y++) years.add(y)
      }
      if (years.size === 0) years.add(currentDate.getFullYear())
      setAvailableYears(Array.from(years).sort((a, b) => b - a))

      // חישוב טווח תאריכים לפי מצב תצוגה
      let startDate: string, endDate: string
      let prevStartDate: string, prevEndDate: string
      
      if (viewMode === 'month') {
        startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
        endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]
        const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
        const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
        prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
        prevEndDate = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0]
      } else if (viewMode === 'year') {
        startDate = `${selectedYear}-01-01`
        endDate = `${selectedYear}-12-31`
        prevStartDate = `${selectedYear - 1}-01-01`
        prevEndDate = `${selectedYear - 1}-12-31`
      } else {
        // כל הנתונים
        startDate = '2000-01-01'
        endDate = '2099-12-31'
        prevStartDate = '1900-01-01'
        prevEndDate = '1999-12-31'
      }

      // קבלת נתונים לתקופה הנבחרת
      const { data: periodIncome } = await supabase
        .from('income')
        .select('amount, date, category_id')
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate)

      const { data: periodExpenses } = await supabase
        .from('expenses')
        .select('amount, date, category_id, category:categories(name, color)')
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate)

      // קבלת נתונים לתקופה קודמת (להשוואה)
      const { data: prevIncome } = await supabase
        .from('income')
        .select('amount')
        .eq('company_id', companyId)
        .gte('date', prevStartDate)
        .lte('date', prevEndDate)

      const { data: prevExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('company_id', companyId)
        .gte('date', prevStartDate)
        .lte('date', prevEndDate)

      // קבלת יתרת בנק
      const { data: bankData } = await supabase
        .from('bank_transactions')
        .select('balance')
        .eq('company_id', companyId)
        .order('date', { ascending: false })
        .limit(1)

      // ספירת תנועות מותאמות ולא מותאמות
      const { data: matchedData, count: matchedCount } = await supabase
        .from('bank_transactions')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .not('matched_id', 'is', null)

      const { data: unmatchedData, count: unmatchedCount } = await supabase
        .from('bank_transactions')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .is('matched_id', null)

      // הכנסות עתידיות - תאריך לתשלום בעתיד ולא שולם
      const today = new Date().toISOString().split('T')[0]
      const { data: futureIncomeData } = await supabase
        .from('income')
        .select('amount, due_date')
        .eq('company_id', companyId)
        .gt('due_date', today)
        .neq('payment_status', 'paid')

      // הכנסות באיחור - תאריך לתשלום עבר ולא שולם
      const { data: overdueIncomeData } = await supabase
        .from('income')
        .select('amount, due_date')
        .eq('company_id', companyId)
        .lt('due_date', today)
        .neq('payment_status', 'paid')

      const totalIncome = periodIncome?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
      const totalExpenses = periodExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
      const prevIncomeTotal = prevIncome?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
      const prevExpensesTotal = prevExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
      const bankBalance = bankData?.[0]?.balance ?? null
      const futureIncome = futureIncomeData?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
      const overdueIncome = overdueIncomeData?.reduce((sum, i) => sum + Number(i.amount), 0) || 0

      setStats({
        totalIncome,
        totalExpenses,
        bankBalance,
        prevIncome: prevIncomeTotal,
        prevExpenses: prevExpensesTotal,
        matchedTransactions: matchedCount || 0,
        unmatchedTransactions: unmatchedCount || 0,
        futureIncome,
        overdueIncome,
        futureCount: futureIncomeData?.length || 0,
        overdueCount: overdueIncomeData?.length || 0,
      })

      // פירוט לפי קטגוריה
      const categoryTotals: Record<string, { name: string; color: string; amount: number }> = {}
      periodExpenses?.forEach(exp => {
        const cat = exp.category as any
        if (cat?.name) {
          if (!categoryTotals[cat.name]) {
            categoryTotals[cat.name] = { name: cat.name, color: cat.color || '#6b7280', amount: 0 }
          }
          categoryTotals[cat.name].amount += Number(exp.amount)
        } else {
          if (!categoryTotals['ללא קטגוריה']) {
            categoryTotals['ללא קטגוריה'] = { name: 'ללא קטגוריה', color: '#9ca3af', amount: 0 }
          }
          categoryTotals['ללא קטגוריה'].amount += Number(exp.amount)
        }
      })
      setCategoryBreakdown(Object.values(categoryTotals).sort((a, b) => b.amount - a.amount))

      // בניית נתוני גרף - לפי חודשים שיש בהם נתונים
      const monthlyData: Record<string, { income: number; expenses: number }> = {}
      
      periodIncome?.forEach(inc => {
        const monthKey = inc.date.substring(0, 7) // YYYY-MM
        if (!monthlyData[monthKey]) monthlyData[monthKey] = { income: 0, expenses: 0 }
        monthlyData[monthKey].income += Number(inc.amount)
      })
      
      periodExpenses?.forEach(exp => {
        const monthKey = exp.date.substring(0, 7)
        if (!monthlyData[monthKey]) monthlyData[monthKey] = { income: 0, expenses: 0 }
        monthlyData[monthKey].expenses += Number(exp.amount)
      })

      const chartDataArray = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, data]) => {
          const [year, month] = monthKey.split('-')
          return {
            month: `${hebrewMonths[parseInt(month) - 1]} ${year.substring(2)}`,
            income: data.income,
            expenses: data.expenses,
          }
        })
      
      setChartData(chartDataArray)

      // קבלת סטטוס תקציב
      const budgets = await analyzeBudgetStatus(companyId, selectedYear, selectedMonth)
      setBudgetStatus(budgets)

      // יצירת תובנות
      const insightsData = generateInsightsFromData(
        periodIncome || [],
        periodExpenses || [],
        categoryTotals,
        prevIncomeTotal,
        prevExpensesTotal
      )
      setInsights(insightsData)

      // תחזית
      const forecastData = await calculateCashFlowForecast(companyId, 3)
      setForecast(forecastData)

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // יצירת תובנות מהנתונים
  const generateInsightsFromData = (
    income: any[],
    expenses: any[],
    categoryTotals: Record<string, any>,
    prevIncome: number,
    prevExpenses: number
  ): Insight[] => {
    const insights: Insight[] = []
    
    const totalIncome = income.reduce((sum, i) => sum + Number(i.amount), 0)
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    
    // רווחיות
    const profit = totalIncome - totalExpenses
    if (profit > 0) {
      insights.push({
        id: 'profit-positive',
        type: 'insight',
        severity: 'success',
        title: `רווח של ${formatCurrency(profit)}`,
        message: `ההכנסות גבוהות מההוצאות ב-${Math.round((profit / totalIncome) * 100)}%`,
      })
    } else if (profit < 0) {
      insights.push({
        id: 'profit-negative',
        type: 'alert',
        severity: 'critical',
        title: `הפסד של ${formatCurrency(Math.abs(profit))}`,
        message: `ההוצאות גבוהות מההכנסות. כדאי לבדוק את התקציב.`,
        action: 'צפה בהוצאות',
        actionUrl: '/expenses',
      })
    }

    // קטגוריה הכי יקרה
    const categories = Object.values(categoryTotals)
    if (categories.length > 0) {
      const topCategory = categories[0]
      const percentage = totalExpenses > 0 ? Math.round((topCategory.amount / totalExpenses) * 100) : 0
      insights.push({
        id: 'top-expense-category',
        type: 'insight',
        severity: 'info',
        title: `הוצאה עיקרית: ${topCategory.name}`,
        message: `${formatCurrency(topCategory.amount)} (${percentage}% מכלל ההוצאות)`,
        action: 'צפה בפירוט',
        actionUrl: '/expenses',
      })
    }

    // השוואה לתקופה קודמת
    if (prevExpenses > 0 && totalExpenses > 0) {
      const change = Math.round(((totalExpenses - prevExpenses) / prevExpenses) * 100)
      if (Math.abs(change) >= 10) {
        insights.push({
          id: 'expense-change',
          type: change > 0 ? 'alert' : 'insight',
          severity: change > 20 ? 'warning' : 'info',
          title: change > 0 ? `עלייה של ${change}% בהוצאות` : `ירידה של ${Math.abs(change)}% בהוצאות`,
          message: change > 0 
            ? 'ההוצאות עלו בהשוואה לתקופה הקודמת'
            : 'ההוצאות ירדו בהשוואה לתקופה הקודמת - כל הכבוד!',
        })
      }
    }

    // הוצאות ללא קטגוריה
    const uncategorized = categoryTotals['ללא קטגוריה']
    if (uncategorized && uncategorized.amount > 0) {
      insights.push({
        id: 'uncategorized-expenses',
        type: 'recommendation',
        severity: 'warning',
        title: `${formatCurrency(uncategorized.amount)} הוצאות ללא קטגוריה`,
        message: 'מומלץ לשייך הוצאות לקטגוריות כדי לקבל תובנות טובות יותר',
        action: 'עדכן הוצאות',
        actionUrl: '/expenses',
      })
    }

    return insights
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="דשבורד"
        description="סקירה כללית של המצב הפיננסי של העסק"
        actions={
          <div className="flex gap-3 items-center">
            <Select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              options={[
                { value: 'all', label: '📊 כל הנתונים' },
                { value: 'year', label: '📅 לפי שנה' },
                { value: 'month', label: '🗓️ לפי חודש' },
              ]}
              className="w-36"
            />
            {viewMode !== 'all' && (
              <Select
                value={selectedYear.toString()}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                options={availableYears.map(y => ({ value: y.toString(), label: y.toString() }))}
                className="w-24"
              />
            )}
            {viewMode === 'month' && (
              <Select
                value={selectedMonth.toString()}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                options={hebrewMonths.map((m, i) => ({ value: (i + 1).toString(), label: m }))}
                className="w-28"
              />
            )}
          </div>
        }
      />

      {/* Stats Cards */}
      <StatsCards
        totalIncome={stats.totalIncome}
        totalExpenses={stats.totalExpenses}
        bankBalance={stats.bankBalance}
        prevIncome={stats.prevIncome}
        prevExpenses={stats.prevExpenses}
        periodLabel={
          viewMode === 'month' 
            ? `ב${hebrewMonths[selectedMonth - 1]}` 
            : viewMode === 'year' 
            ? `ב-${selectedYear}` 
            : ''
        }
        matchedTransactions={stats.matchedTransactions}
        unmatchedTransactions={stats.unmatchedTransactions}
        futureIncome={stats.futureIncome}
        overdueIncome={stats.overdueIncome}
        futureCount={stats.futureCount}
        overdueCount={stats.overdueCount}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={chartData} />
        
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              פירוט הוצאות לפי קטגוריה
            </CardTitle>
          </CardHeader>
          <div className="p-4 space-y-3">
            {categoryBreakdown.length === 0 ? (
              <p className="text-gray-500 text-center py-4">אין הוצאות להצגה</p>
            ) : (
              categoryBreakdown.map((cat, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 text-sm">{cat.name}</span>
                  <span className="font-semibold">{formatCurrency(cat.amount)}</span>
                  <span className="text-xs text-gray-500 w-12 text-left">
                    {stats.totalExpenses > 0 
                      ? `${Math.round((cat.amount / stats.totalExpenses) * 100)}%`
                      : '0%'
                    }
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Insights and Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Insights insights={insights} />
        <BudgetProgress budgets={budgetStatus} />
      </div>

      {/* Forecast */}
      <CashFlowForecast data={forecast} />
    </div>
  )
}
