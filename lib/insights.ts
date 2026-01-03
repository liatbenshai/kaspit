import { supabase } from './supabase'
import { formatCurrency, getMonthName, calculateChange } from './utils'

export interface Insight {
  id: string
  type: 'alert' | 'insight' | 'recommendation' | 'forecast'
  severity: 'info' | 'warning' | 'critical' | 'success'
  title: string
  message: string
  action?: string
  actionUrl?: string
}

export interface BudgetStatus {
  categoryId: string
  categoryName: string
  budgeted: number
  actual: number
  percentage: number
  status: 'under' | 'near' | 'over'
}

// ניתוח תקציב מול ביצוע
export async function analyzeBudgetStatus(
  companyId: string,
  year: number,
  month: number
): Promise<BudgetStatus[]> {
  // קבלת תקציבים
  const { data: budgets } = await supabase
    .from('budgets')
    .select('*, categories(name)')
    .eq('company_id', companyId)
    .eq('year', year)
    .eq('month', month)

  if (!budgets || budgets.length === 0) return []

  // קבלת הוצאות בפועל
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: expenses } = await supabase
    .from('expenses')
    .select('category_id, amount')
    .eq('company_id', companyId)
    .gte('date', startDate)
    .lte('date', endDate)

  // חישוב סיכום לפי קטגוריה
  const expensesByCategory: Record<string, number> = {}
  expenses?.forEach(exp => {
    if (exp.category_id) {
      expensesByCategory[exp.category_id] = 
        (expensesByCategory[exp.category_id] || 0) + Number(exp.amount)
    }
  })

  // בניית סטטוס
  return budgets.map(budget => {
    const actual = expensesByCategory[budget.category_id] || 0
    const percentage = budget.amount > 0 
      ? Math.round((actual / budget.amount) * 100) 
      : 0
    
    let status: 'under' | 'near' | 'over' = 'under'
    if (percentage >= 100) status = 'over'
    else if (percentage >= 80) status = 'near'

    return {
      categoryId: budget.category_id,
      categoryName: (budget.categories as any)?.name || 'לא ידוע',
      budgeted: Number(budget.amount),
      actual,
      percentage,
      status,
    }
  })
}

// יצירת תובנות והמלצות
export async function generateInsights(companyId: string): Promise<Insight[]> {
  const insights: Insight[] = []
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear

  // 1. התראות על חריגה מתקציב
  const budgetStatus = await analyzeBudgetStatus(companyId, currentYear, currentMonth)
  
  budgetStatus.forEach(bs => {
    if (bs.status === 'over') {
      insights.push({
        id: `budget-over-${bs.categoryId}`,
        type: 'alert',
        severity: 'critical',
        title: `חריגה מתקציב: ${bs.categoryName}`,
        message: `חרגת מהתקציב ב-${formatCurrency(bs.actual - bs.budgeted)}. הוצאת ${formatCurrency(bs.actual)} מתוך ${formatCurrency(bs.budgeted)} מתוקצב.`,
        action: 'צפה בפירוט',
        actionUrl: '/budget',
      })
    } else if (bs.status === 'near') {
      insights.push({
        id: `budget-near-${bs.categoryId}`,
        type: 'alert',
        severity: 'warning',
        title: `קרוב לחריגה: ${bs.categoryName}`,
        message: `ניצלת ${bs.percentage}% מהתקציב (${formatCurrency(bs.actual)} מתוך ${formatCurrency(bs.budgeted)}).`,
        action: 'צפה בפירוט',
        actionUrl: '/budget',
      })
    }
  })

  // 2. חשבוניות שלא שולמו
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: unpaidExpenses } = await supabase
    .from('expenses')
    .select('id, description, amount, due_date, suppliers(name)')
    .eq('company_id', companyId)
    .eq('payment_status', 'pending')
    .lt('due_date', now.toISOString().split('T')[0])

  if (unpaidExpenses && unpaidExpenses.length > 0) {
    const totalUnpaid = unpaidExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    insights.push({
      id: 'unpaid-expenses',
      type: 'alert',
      severity: 'warning',
      title: `${unpaidExpenses.length} חשבוניות לא שולמו`,
      message: `יש ${unpaidExpenses.length} חשבוניות שעבר מועד התשלום שלהן, בסך ${formatCurrency(totalUnpaid)}.`,
      action: 'צפה בחשבוניות',
      actionUrl: '/expenses?status=pending',
    })
  }

  // 3. הכנסות שלא התקבלו
  const { data: pendingIncome } = await supabase
    .from('income')
    .select('id, description, amount, date, customers(name)')
    .eq('company_id', companyId)
    .eq('payment_status', 'pending')

  if (pendingIncome && pendingIncome.length > 0) {
    const totalPending = pendingIncome.reduce((sum, i) => sum + Number(i.amount), 0)
    insights.push({
      id: 'pending-income',
      type: 'insight',
      severity: 'info',
      title: `${formatCurrency(totalPending)} הכנסות ממתינות`,
      message: `יש ${pendingIncome.length} הכנסות שעדיין לא התקבלו.`,
      action: 'צפה בהכנסות',
      actionUrl: '/income?status=pending',
    })
  }

  // 4. השוואה לחודש קודם
  const { data: currentExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('company_id', companyId)
    .gte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
    .lt('date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)

  const { data: prevExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('company_id', companyId)
    .gte('date', `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`)
    .lt('date', `${prevYear}-${String(prevMonth + 1 > 12 ? 1 : prevMonth + 1).padStart(2, '0')}-01`)

  const currentTotal = currentExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
  const prevTotal = prevExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
  const change = calculateChange(currentTotal, prevTotal)

  if (Math.abs(change) >= 20) {
    insights.push({
      id: 'expense-trend',
      type: 'insight',
      severity: change > 0 ? 'warning' : 'success',
      title: change > 0 ? 'עלייה בהוצאות' : 'ירידה בהוצאות',
      message: `ההוצאות החודש ${change > 0 ? 'עלו' : 'ירדו'} ב-${Math.abs(change)}% לעומת ${getMonthName(prevMonth)}.`,
      action: 'צפה בניתוח',
      actionUrl: '/reports',
    })
  }

  // 5. הוצאות חוזרות צפויות
  const { data: recurringExpenses } = await supabase
    .from('expenses')
    .select('description, amount, recurring_day')
    .eq('company_id', companyId)
    .eq('is_recurring', true)

  if (recurringExpenses && recurringExpenses.length > 0) {
    const today = now.getDate()
    const upcomingRecurring = recurringExpenses.filter(
      e => e.recurring_day && e.recurring_day > today && e.recurring_day <= today + 7
    )

    if (upcomingRecurring.length > 0) {
      const total = upcomingRecurring.reduce((sum, e) => sum + Number(e.amount), 0)
      insights.push({
        id: 'upcoming-recurring',
        type: 'forecast',
        severity: 'info',
        title: 'הוצאות קבועות בשבוע הקרוב',
        message: `צפויות ${upcomingRecurring.length} הוצאות קבועות בסך ${formatCurrency(total)}.`,
        action: 'צפה בפירוט',
        actionUrl: '/expenses?recurring=true',
      })
    }
  }

  // 6. קטגוריות ללא תקציב
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('type', 'expense')
    .eq('is_active', true)

  const budgetedCategoryIds = budgetStatus.map(bs => bs.categoryId)
  const unbdudgetedCategories = categories?.filter(
    c => !budgetedCategoryIds.includes(c.id)
  )

  if (unbdudgetedCategories && unbdudgetedCategories.length > 0) {
    insights.push({
      id: 'no-budget-categories',
      type: 'recommendation',
      severity: 'info',
      title: 'הגדר תקציב לקטגוריות נוספות',
      message: `יש ${unbdudgetedCategories.length} קטגוריות הוצאה ללא תקציב מוגדר. הגדרת תקציב תעזור לך לעקוב טוב יותר.`,
      action: 'הגדר תקציב',
      actionUrl: '/budget',
    })
  }

  // 7. המלצה ראשונית אם אין נתונים
  const { count: incomeCount } = await supabase
    .from('income')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const { count: expenseCount } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  if ((incomeCount || 0) < 10 && (expenseCount || 0) < 10) {
    insights.push({
      id: 'getting-started',
      type: 'recommendation',
      severity: 'info',
      title: 'בואי נתחיל! 🚀',
      message: 'הוסיפי הכנסות והוצאות או ייבאי מקובץ Excel כדי שנוכל לספק לך תובנות והמלצות מותאמות אישית.',
      action: 'ייבוא מאקסל',
      actionUrl: '/income',
    })
  }

  return insights
}

// חישוב תחזית תזרים מזומנים
export async function calculateCashFlowForecast(
  companyId: string,
  monthsAhead: number = 3
): Promise<{ month: string; projected: number; income: number; expenses: number }[]> {
  const now = new Date()
  const forecast: { month: string; projected: number; income: number; expenses: number }[] = []

  // קבלת ממוצעים מ-3 חודשים אחרונים
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  
  const { data: recentIncome } = await supabase
    .from('income')
    .select('amount, date')
    .eq('company_id', companyId)
    .gte('date', threeMonthsAgo.toISOString().split('T')[0])

  const { data: recentExpenses } = await supabase
    .from('expenses')
    .select('amount, date, is_recurring')
    .eq('company_id', companyId)
    .gte('date', threeMonthsAgo.toISOString().split('T')[0])

  // חישוב ממוצע חודשי
  const avgIncome = recentIncome 
    ? recentIncome.reduce((sum, i) => sum + Number(i.amount), 0) / 3 
    : 0
  const avgExpenses = recentExpenses 
    ? recentExpenses.reduce((sum, e) => sum + Number(e.amount), 0) / 3 
    : 0

  // קבלת הוצאות קבועות
  const { data: recurringExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('company_id', companyId)
    .eq('is_recurring', true)

  const recurringTotal = recurringExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0

  // בניית תחזית
  for (let i = 1; i <= monthsAhead; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const monthName = getMonthName(futureDate.getMonth() + 1)
    
    // הוצאות צפויות = הוצאות קבועות + ממוצע הוצאות משתנות
    const projectedExpenses = recurringTotal + (avgExpenses - recurringTotal) * 0.9 // 90% מהממוצע
    const projectedIncome = avgIncome * 0.95 // 95% מהממוצע (שמרני)
    
    forecast.push({
      month: `${monthName} ${futureDate.getFullYear()}`,
      projected: projectedIncome - projectedExpenses,
      income: projectedIncome,
      expenses: projectedExpenses,
    })
  }

  return forecast
}

// הצעת תקציב אוטומטית
export async function suggestBudget(
  companyId: string,
  year: number,
  month: number
): Promise<{ categoryId: string; categoryName: string; suggestedAmount: number; avgAmount: number; reason: string }[]> {
  // קבלת קטגוריות הוצאה
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('type', 'expense')
    .eq('is_active', true)

  if (!categories) return []

  // קבלת הוצאות מ-3 חודשים אחרונים
  const threeMonthsAgo = new Date(year, month - 4, 1)
  const endDate = new Date(year, month - 1, 0)

  const { data: expenses } = await supabase
    .from('expenses')
    .select('category_id, amount, is_recurring')
    .eq('company_id', companyId)
    .gte('date', threeMonthsAgo.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])

  // חישוב ממוצע לפי קטגוריה
  const categoryTotals: Record<string, { total: number; count: number; hasRecurring: boolean }> = {}
  
  expenses?.forEach(exp => {
    if (exp.category_id) {
      if (!categoryTotals[exp.category_id]) {
        categoryTotals[exp.category_id] = { total: 0, count: 0, hasRecurring: false }
      }
      categoryTotals[exp.category_id].total += Number(exp.amount)
      categoryTotals[exp.category_id].count++
      if (exp.is_recurring) {
        categoryTotals[exp.category_id].hasRecurring = true
      }
    }
  })

  // בניית הצעות
  return categories.map(category => {
    const data = categoryTotals[category.id]
    const avgAmount = data ? data.total / 3 : 0
    
    let suggestedAmount = avgAmount
    let reason = 'בהתבסס על ממוצע 3 חודשים אחרונים'

    if (data?.hasRecurring) {
      suggestedAmount = avgAmount // הוצאות קבועות - לא משנים
      reason = 'הוצאה קבועה חודשית'
    } else if (avgAmount > 0) {
      suggestedAmount = avgAmount * 1.1 // חיץ של 10%
      reason = 'ממוצע + 10% חיץ בטחון'
    }

    return {
      categoryId: category.id,
      categoryName: category.name,
      suggestedAmount: Math.round(suggestedAmount / 100) * 100, // עיגול למאות
      avgAmount: Math.round(avgAmount),
      reason,
    }
  }).filter(s => s.avgAmount > 0 || s.suggestedAmount > 0)
}
