'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { BudgetProgress } from '@/components/dashboard/BudgetProgress'
import { Insights } from '@/components/dashboard/Insights'
import { CashFlowForecast } from '@/components/dashboard/CashFlowForecast'
import { supabase } from '@/lib/supabase'
import { generateInsights, analyzeBudgetStatus, calculateCashFlowForecast } from '@/lib/insights'
import { getMonthName } from '@/lib/utils'
import type { Insight, BudgetStatus } from '@/lib/insights'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    prevIncome: 0,
    prevExpenses: 0,
  })
  const [chartData, setChartData] = useState<any[]>([])
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [forecast, setForecast] = useState<any[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      const companyId = profile.company_id
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear

      // Get current month stats
      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
      const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

      const { data: currentIncome } = await supabase
        .from('income')
        .select('amount')
        .eq('company_id', companyId)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)

      const { data: currentExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('company_id', companyId)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)

      // Get previous month stats
      const startOfPrevMonth = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
      const endOfPrevMonth = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0]

      const { data: prevIncomeData } = await supabase
        .from('income')
        .select('amount')
        .eq('company_id', companyId)
        .gte('date', startOfPrevMonth)
        .lte('date', endOfPrevMonth)

      const { data: prevExpensesData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('company_id', companyId)
        .gte('date', startOfPrevMonth)
        .lte('date', endOfPrevMonth)

      // Get bank balance
      const { data: bankData } = await supabase
        .from('bank_transactions')
        .select('balance')
        .eq('company_id', companyId)
        .order('date', { ascending: false })
        .limit(1)

      const totalIncome = currentIncome?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
      const totalExpenses = currentExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
      const prevIncome = prevIncomeData?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
      const prevExpenses = prevExpensesData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
      const balance = bankData?.[0]?.balance || totalIncome - totalExpenses

      setStats({
        totalIncome,
        totalExpenses,
        balance,
        prevIncome,
        prevExpenses,
      })

      // Get chart data (last 6 months)
      const chartDataArray = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - 1 - i, 1)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
        const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]

        const { data: monthIncome } = await supabase
          .from('income')
          .select('amount')
          .eq('company_id', companyId)
          .gte('date', monthStart)
          .lte('date', monthEnd)

        const { data: monthExpenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('company_id', companyId)
          .gte('date', monthStart)
          .lte('date', monthEnd)

        chartDataArray.push({
          month: getMonthName(month),
          income: monthIncome?.reduce((sum, i) => sum + Number(i.amount), 0) || 0,
          expenses: monthExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0,
        })
      }
      setChartData(chartDataArray)

      // Get budget status
      const budgets = await analyzeBudgetStatus(companyId, currentYear, currentMonth)
      setBudgetStatus(budgets)

      // Get insights
      const insightsData = await generateInsights(companyId)
      setInsights(insightsData)

      // Get forecast
      const forecastData = await calculateCashFlowForecast(companyId, 3)
      setForecast(forecastData)

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
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
      />

      {/* Stats Cards */}
      <StatsCards
        totalIncome={stats.totalIncome}
        totalExpenses={stats.totalExpenses}
        balance={stats.balance}
        prevIncome={stats.prevIncome}
        prevExpenses={stats.prevExpenses}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={chartData} />
        <BudgetProgress budgets={budgetStatus} />
      </div>

      {/* Insights and Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Insights insights={insights} />
        <CashFlowForecast data={forecast} />
      </div>
    </div>
  )
}
