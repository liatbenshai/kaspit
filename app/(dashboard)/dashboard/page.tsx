'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { BudgetProgress } from '@/components/dashboard/BudgetProgress'
import { Insights } from '@/components/dashboard/Insights'
import { CashFlowForecast } from '@/components/dashboard/CashFlowForecast'
import { ActionCenter } from '@/components/dashboard/ActionCenter'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { generateInsights, analyzeBudgetStatus, calculateCashFlowForecast } from '@/lib/insights'
import { formatCurrency, getMonthName, hebrewMonths } from '@/lib/utils'
import { TrendingUp, TrendingDown, PieChart, Calendar, Plus, Receipt, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import type { Insight, BudgetStatus } from '@/lib/insights'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  
  // בחירת תקופה
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [viewMode, setViewMode] = useState<'month' | 'year' | 'all'>('month')
  
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
    // פירוט הכנסות
    incomeBreakdown: {
      actualReceived: 0,
      actualReceivedCount: 0,
      issuedForVat: 0,
      issuedForVatCount: 0,
      expectedCollection: 0,
      expectedCollectionCount: 0,
      overdueAmount: 0,
      overdueCount: 0,
    },
    // פירוט הוצאות (מבוסס על תנועות בנק)
    expensesBreakdown: {
      operational: 0,
      operationalCount: 0,
      operationalWithDoc: 0,
      salary: 0,
      salaryCount: 0,
      salaryWithDoc: 0,
      taxes: 0,
      taxesCount: 0,
      taxesWithDoc: 0,
      socialSecurity: 0,
      socialSecurityCount: 0,
      socialSecurityWithDoc: 0,
      loans: 0,
      loansCount: 0,
      loansWithDoc: 0,
      bankFees: 0,
      bankFeesCount: 0,
      bankFeesWithDoc: 0,
      creditCard: 0,
      creditCardCount: 0,
      creditCardWithDoc: 0,
      internal: 0,
      internalCount: 0,
      internalWithDoc: 0,
      totalWithDoc: 0,
      totalCount: 0,
    },
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
        // תיקון באג timezone - לא להשתמש ב-toISOString
        const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate()
        endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
        const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
        const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
        prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
        const lastDayOfPrevMonth = new Date(prevYear, prevMonth, 0).getDate()
        prevEndDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDayOfPrevMonth).padStart(2, '0')}`
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

      // קבלת נתונים לתקופה הנבחרת - כולל סוג מסמך וסטטוס תשלום
      const { data: periodIncome } = await supabase
        .from('income')
        .select('amount, date, category_id, document_type, payment_status, document_status, due_date')
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate)

      // ============================================
      // הוצאות = תנועות בנק (חובה) - מקור האמת!
      // ============================================
      const { data: bankTransactionsForPeriod } = await supabase
        .from('bank_transactions')
        .select('id, amount, date, description, transaction_type, matched_id, matched_type')
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate)
        .lt('amount', 0) // רק תנועות חובה (הוצאות)
      
      // תנועות בנק לתקופה קודמת (להשוואה)
      const { data: prevBankTransactions } = await supabase
        .from('bank_transactions')
        .select('amount')
        .eq('company_id', companyId)
        .gte('date', prevStartDate)
        .lte('date', prevEndDate)
        .lt('amount', 0)

      // שליפת הוצאות מטבלת expenses (לצורך תאימות אחורה ופירוט קטגוריות)
      const { data: periodExpenses } = await supabase
        .from('expenses')
        .select('amount, date, category_id, description, document_type, category:categories(name, color)')
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
      
      // ============================================
      // הוצאות = סכום תנועות חובה בבנק (מקור האמת!)
      // ============================================
      const totalExpenses = Math.abs(bankTransactionsForPeriod?.reduce((sum, t) => sum + Number(t.amount), 0) || 0)
      const prevExpensesTotal = Math.abs(prevBankTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0)
      
      const prevIncomeTotal = prevIncome?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
      const bankBalance = bankData?.[0]?.balance ?? null
      const futureIncome = futureIncomeData?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
      const overdueIncome = overdueIncomeData?.reduce((sum, i) => sum + Number(i.amount), 0) || 0

      // ========================================
      // חישוב פירוט הכנסות לפי סוגי מסמכים
      // ========================================
      
      // נכנס בפועל (תזרים): 
      // - קבלות
      // - חשבוניות מס קבלה (מסמך שמשלב חשבונית מס + קבלה)
      const actualReceivedDocs = periodIncome?.filter(i => 
        i.document_type === 'receipt' || 
        i.document_type === 'tax_invoice_receipt'
      ) || []
      const actualReceived = actualReceivedDocs.reduce((sum, i) => sum + Number(i.amount), 0)
      
      // הופק לדיווח מע"מ: חשבוניות מס + חשבוניות מס קבלה
      const vatDocTypes = ['tax_invoice', 'tax_invoice_receipt']
      const issuedForVatDocs = periodIncome?.filter(i => vatDocTypes.includes(i.document_type)) || []
      const issuedForVat = issuedForVatDocs.reduce((sum, i) => sum + Number(i.amount), 0)
      
      // תשלומים עתידיים: חשבוניות עסקה + חשבוניות מס
      // (הכסף מתועד בקבלה נפרדת, לא בחשבונית עצמה)
      const expectedCollectionDocs = periodIncome?.filter(i => 
        i.document_type === 'invoice' || 
        i.document_type === 'tax_invoice'
      ) || []
      const expectedCollection = expectedCollectionDocs.reduce((sum, i) => sum + Number(i.amount), 0)
      
      // באיחור: חשבוניות עסקה וחשבוניות מס שעבר תאריך היעד שלהן ולא שולמו
      const overdueDocs = periodIncome?.filter(i => 
        (i.document_type === 'invoice' || i.document_type === 'tax_invoice') &&
        i.due_date && 
        i.due_date < today &&
        i.payment_status !== 'paid'
      ) || []
      const overdueAmount = overdueDocs.reduce((sum, i) => sum + Number(i.amount), 0)

      // ========================================
      // פירוט הוצאות מתנועות בנק (מקור האמת!)
      // ========================================
      
      // קטגוריות מיוחדות לזיהוי לפי תיאור או transaction_type
      const salaryKeywords = ['משכורת', 'שכר', 'salary', 'מתמלל']
      const taxKeywords = ['מע"מ', 'מע״מ', 'vat', 'מס הכנסה', 'מקדמ', 'tax', 'רשות המסים']
      const socialSecurityKeywords = ['ביטוח לאומי', 'בל"ל', 'בטל', 'ביטוח לאומ']
      const loanKeywords = ['הלוואה', 'loan', 'החזר הלו', 'פרעון']
      const bankFeeKeywords = ['עמלת', 'עמלה', 'bank fee', 'דמי ניהול']
      const creditCardKeywords = ['ישראכרט', 'כאל', 'מקס', 'לאומי קארד', 'אמריקן', 'ויזה', 'מסטרקארד']
      const internalKeywords = ['העברה', 'transfer']
      
      const matchKeywords = (text: string | undefined | null, keywords: string[]) => {
        const textLower = (text || '').toLowerCase()
        return keywords.some(kw => textLower.includes(kw.toLowerCase()))
      }
      
      const classifyBankTransaction = (t: any) => {
        const desc = t.description || ''
        const type = t.transaction_type || ''
        
        // קודם בודקים transaction_type אם הוגדר
        if (type === 'salary') return 'salary'
        if (type === 'vat_payment' || type === 'tax_payment') return 'taxes'
        if (type === 'social_security') return 'socialSecurity'
        if (type === 'loan_payment') return 'loans'
        if (type === 'bank_fee') return 'bankFees'
        if (type === 'credit_card') return 'creditCard'
        if (type === 'internal_transfer' || type === 'owner_withdrawal' || type === 'owner_deposit') return 'internal'
        
        // אם לא הוגדר, מנסים לזהות לפי תיאור
        if (matchKeywords(desc, salaryKeywords)) return 'salary'
        if (matchKeywords(desc, taxKeywords)) return 'taxes'
        if (matchKeywords(desc, socialSecurityKeywords)) return 'socialSecurity'
        if (matchKeywords(desc, loanKeywords)) return 'loans'
        if (matchKeywords(desc, bankFeeKeywords)) return 'bankFees'
        if (matchKeywords(desc, creditCardKeywords)) return 'creditCard'
        if (matchKeywords(desc, internalKeywords)) return 'internal'
        
        return 'operational' // ברירת מחדל - הוצאות תפעול
      }
      
      // סיווג כל תנועות הבנק
      const classifiedExpenses = {
        operational: { amount: 0, count: 0, withDoc: 0 },
        salary: { amount: 0, count: 0, withDoc: 0 },
        taxes: { amount: 0, count: 0, withDoc: 0 },
        socialSecurity: { amount: 0, count: 0, withDoc: 0 },
        loans: { amount: 0, count: 0, withDoc: 0 },
        bankFees: { amount: 0, count: 0, withDoc: 0 },
        creditCard: { amount: 0, count: 0, withDoc: 0 },
        internal: { amount: 0, count: 0, withDoc: 0 },
      }
      
      bankTransactionsForPeriod?.forEach(t => {
        const category = classifyBankTransaction(t)
        const absAmount = Math.abs(Number(t.amount))
        classifiedExpenses[category as keyof typeof classifiedExpenses].amount += absAmount
        classifiedExpenses[category as keyof typeof classifiedExpenses].count += 1
        if (t.matched_id) {
          classifiedExpenses[category as keyof typeof classifiedExpenses].withDoc += 1
        }
      })
      
      const expensesBreakdown = {
        operational: classifiedExpenses.operational.amount,
        operationalCount: classifiedExpenses.operational.count,
        operationalWithDoc: classifiedExpenses.operational.withDoc,
        salary: classifiedExpenses.salary.amount,
        salaryCount: classifiedExpenses.salary.count,
        salaryWithDoc: classifiedExpenses.salary.withDoc,
        taxes: classifiedExpenses.taxes.amount,
        taxesCount: classifiedExpenses.taxes.count,
        taxesWithDoc: classifiedExpenses.taxes.withDoc,
        socialSecurity: classifiedExpenses.socialSecurity.amount,
        socialSecurityCount: classifiedExpenses.socialSecurity.count,
        socialSecurityWithDoc: classifiedExpenses.socialSecurity.withDoc,
        loans: classifiedExpenses.loans.amount,
        loansCount: classifiedExpenses.loans.count,
        loansWithDoc: classifiedExpenses.loans.withDoc,
        bankFees: classifiedExpenses.bankFees.amount,
        bankFeesCount: classifiedExpenses.bankFees.count,
        bankFeesWithDoc: classifiedExpenses.bankFees.withDoc,
        creditCard: classifiedExpenses.creditCard.amount,
        creditCardCount: classifiedExpenses.creditCard.count,
        creditCardWithDoc: classifiedExpenses.creditCard.withDoc,
        internal: classifiedExpenses.internal.amount,
        internalCount: classifiedExpenses.internal.count,
        internalWithDoc: classifiedExpenses.internal.withDoc,
        // סיכום כללי
        totalWithDoc: Object.values(classifiedExpenses).reduce((sum, c) => sum + c.withDoc, 0),
        totalCount: Object.values(classifiedExpenses).reduce((sum, c) => sum + c.count, 0),
      }

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
        // פירוט הכנסות
        incomeBreakdown: {
          actualReceived,
          actualReceivedCount: actualReceivedDocs.length,
          issuedForVat,
          issuedForVatCount: issuedForVatDocs.length,
          expectedCollection,
          expectedCollectionCount: expectedCollectionDocs.length,
          overdueAmount,
          overdueCount: overdueDocs.length,
        },
        // פירוט הוצאות (מבוסס על תנועות בנק)
        expensesBreakdown,
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
      {/* Header מעוצב */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {viewMode === 'month' 
                ? `📊 ${hebrewMonths[selectedMonth - 1]} ${selectedYear}` 
                : viewMode === 'year' 
                ? `📊 שנת ${selectedYear}` 
                : '📊 סיכום כללי'}
            </h1>
            <p className="text-primary-100 mt-1">סקירת המצב הפיננסי של העסק</p>
          </div>
          
          {/* בחירת תקופה - הכל בשורה */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-white/10 rounded-lg p-1">
              <button 
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'month' ? 'bg-white text-primary-600' : 'text-white hover:bg-white/10'}`}
              >
                חודש
              </button>
              <button 
                onClick={() => setViewMode('year')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'year' ? 'bg-white text-primary-600' : 'text-white hover:bg-white/10'}`}
              >
                שנה
              </button>
              <button 
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'all' ? 'bg-white text-primary-600' : 'text-white hover:bg-white/10'}`}
              >
                הכל
              </button>
            </div>
            
            {viewMode !== 'all' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-white/10 border-0 text-white rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-white/50"
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="text-gray-900">{y}</option>
                ))}
              </select>
            )}
            
            {viewMode === 'month' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-white/10 border-0 text-white rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-white/50"
              >
                {hebrewMonths.map((m, i) => (
                  <option key={i} value={i + 1} className="text-gray-900">{m}</option>
                ))}
              </select>
            )}
            
            <div className="h-6 w-px bg-white/30 mx-2" />
            
            {/* כפתורי הוספה מהירה */}
            <Link href="/income?action=add">
              <button className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg">
                <Plus className="w-4 h-4" />
                הכנסה
              </button>
            </Link>
            <Link href="/expenses?action=add">
              <button className="flex items-center gap-1 bg-rose-500 hover:bg-rose-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg">
                <Plus className="w-4 h-4" />
                הוצאה
              </button>
            </Link>
          </div>
        </div>
      </div>

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
        selectedMonth={viewMode === 'month' ? selectedMonth : undefined}
        selectedYear={viewMode !== 'all' ? selectedYear : undefined}
        matchedTransactions={stats.matchedTransactions}
        unmatchedTransactions={stats.unmatchedTransactions}
        futureIncome={stats.futureIncome}
        overdueIncome={stats.overdueIncome}
        futureCount={stats.futureCount}
        overdueCount={stats.overdueCount}
        incomeBreakdown={stats.incomeBreakdown}
        expensesBreakdown={stats.expensesBreakdown}
      />

      {/* Action Center - מרכז פעולות */}
      {companyId && <ActionCenter companyId={companyId} />}

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
