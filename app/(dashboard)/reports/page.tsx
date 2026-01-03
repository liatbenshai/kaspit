'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getMonthName, hebrewMonths, cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import { Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [reportType, setReportType] = useState<'monthly' | 'category' | 'trend'>('monthly')
  
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [categoryData, setCategoryData] = useState<{ income: any[], expenses: any[] }>({ income: [], expenses: [] })
  const [summary, setSummary] = useState({ income: 0, expenses: 0, profit: 0 })

  useEffect(() => {
    loadData()
  }, [selectedYear])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      // Load monthly data
      const monthlyDataArray = []
      let totalIncome = 0
      let totalExpenses = 0

      for (let month = 1; month <= 12; month++) {
        const startDate = `${selectedYear}-${String(month).padStart(2, '0')}-01`
        const endDate = new Date(selectedYear, month, 0).toISOString().split('T')[0]

        const { data: monthIncome } = await supabase
          .from('income')
          .select('amount')
          .eq('company_id', profile.company_id)
          .gte('date', startDate)
          .lte('date', endDate)

        const { data: monthExpenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('company_id', profile.company_id)
          .gte('date', startDate)
          .lte('date', endDate)

        const income = monthIncome?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
        const expenses = monthExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0

        totalIncome += income
        totalExpenses += expenses

        monthlyDataArray.push({
          month: getMonthName(month),
          income,
          expenses,
          profit: income - expenses,
        })
      }

      setMonthlyData(monthlyDataArray)
      setSummary({
        income: totalIncome,
        expenses: totalExpenses,
        profit: totalIncome - totalExpenses,
      })

      // Load category data
      const { data: incomeByCategory } = await supabase
        .from('income')
        .select('amount, category:categories(name, color)')
        .eq('company_id', profile.company_id)
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`)

      const { data: expensesByCategory } = await supabase
        .from('expenses')
        .select('amount, category:categories(name, color)')
        .eq('company_id', profile.company_id)
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`)

      // Aggregate by category
      const incomeCats: Record<string, { name: string, value: number, color: string }> = {}
      incomeByCategory?.forEach(item => {
        const catName = (item.category as any)?.name || 'ללא קטגוריה'
        const catColor = (item.category as any)?.color || '#6b7280'
        if (!incomeCats[catName]) {
          incomeCats[catName] = { name: catName, value: 0, color: catColor }
        }
        incomeCats[catName].value += Number(item.amount)
      })

      const expenseCats: Record<string, { name: string, value: number, color: string }> = {}
      expensesByCategory?.forEach(item => {
        const catName = (item.category as any)?.name || 'ללא קטגוריה'
        const catColor = (item.category as any)?.color || '#6b7280'
        if (!expenseCats[catName]) {
          expenseCats[catName] = { name: catName, value: 0, color: catColor }
        }
        expenseCats[catName].value += Number(item.amount)
      })

      setCategoryData({
        income: Object.values(incomeCats).sort((a, b) => b.value - a.value),
        expenses: Object.values(expenseCats).sort((a, b) => b.value - a.value),
      })

    } catch (error) {
      console.error('Error loading data:', error)
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
        title="דוחות"
        description="ניתוח וסיכום פיננסי"
        actions={
          <Button variant="outline">
            <Download className="w-4 h-4" />
            ייצוא לאקסל
          </Button>
        }
      />

      {/* Filters */}
      <Card padding="md">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">שנה:</span>
          <Select
            options={[
              { value: String(currentDate.getFullYear() - 2), label: String(currentDate.getFullYear() - 2) },
              { value: String(currentDate.getFullYear() - 1), label: String(currentDate.getFullYear() - 1) },
              { value: String(currentDate.getFullYear()), label: String(currentDate.getFullYear()) },
            ]}
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          />
          <span className="text-sm font-medium text-gray-700 mr-4">סוג דוח:</span>
          <Select
            options={[
              { value: 'monthly', label: 'חודשי' },
              { value: 'category', label: 'לפי קטגוריה' },
              { value: 'trend', label: 'מגמות' },
            ]}
            value={reportType}
            onChange={(e) => setReportType(e.target.value as any)}
          />
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">סה״כ הכנסות {selectedYear}</p>
              <p className="text-2xl font-bold text-success-600">{formatCurrency(summary.income)}</p>
            </div>
            <div className="p-3 bg-success-50 rounded-xl">
              <TrendingUp className="w-6 h-6 text-success-600" />
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">סה״כ הוצאות {selectedYear}</p>
              <p className="text-2xl font-bold text-danger-600">{formatCurrency(summary.expenses)}</p>
            </div>
            <div className="p-3 bg-danger-50 rounded-xl">
              <TrendingDown className="w-6 h-6 text-danger-600" />
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">רווח נקי {selectedYear}</p>
              <p className={cn(
                'text-2xl font-bold',
                summary.profit >= 0 ? 'text-success-600' : 'text-danger-600'
              )}>
                {formatCurrency(summary.profit)}
              </p>
            </div>
            <div className={cn(
              'p-3 rounded-xl',
              summary.profit >= 0 ? 'bg-success-50' : 'bg-danger-50'
            )}>
              <DollarSign className={cn(
                'w-6 h-6',
                summary.profit >= 0 ? 'text-success-600' : 'text-danger-600'
              )} />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      {reportType === 'monthly' && (
        <Card>
          <CardHeader>
            <CardTitle>סיכום חודשי - {selectedYear}</CardTitle>
          </CardHeader>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend formatter={(v) => v === 'income' ? 'הכנסות' : v === 'expenses' ? 'הוצאות' : 'רווח'} />
                <Bar dataKey="income" name="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {reportType === 'category' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>הכנסות לפי קטגוריה</CardTitle>
            </CardHeader>
            <div className="h-80">
              {categoryData.income.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData.income}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categoryData.income.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  אין נתונים
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>הוצאות לפי קטגוריה</CardTitle>
            </CardHeader>
            <div className="h-80">
              {categoryData.expenses.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData.expenses}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categoryData.expenses.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  אין נתונים
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {reportType === 'trend' && (
        <Card>
          <CardHeader>
            <CardTitle>מגמת רווח חודשי - {selectedYear}</CardTitle>
          </CardHeader>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend formatter={() => 'רווח'} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="profit"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 6 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>פירוט חודשי</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right font-medium text-gray-500">חודש</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">הכנסות</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">הוצאות</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">רווח/הפסד</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">אחוז רווח</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthlyData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{row.month}</td>
                  <td className="px-4 py-3 text-success-600">{formatCurrency(row.income)}</td>
                  <td className="px-4 py-3 text-danger-600">{formatCurrency(row.expenses)}</td>
                  <td className={cn(
                    'px-4 py-3 font-semibold',
                    row.profit >= 0 ? 'text-success-600' : 'text-danger-600'
                  )}>
                    {formatCurrency(row.profit)}
                  </td>
                  <td className="px-4 py-3">
                    {row.income > 0 ? `${((row.profit / row.income) * 100).toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold">
              <tr>
                <td className="px-4 py-3">סה״כ</td>
                <td className="px-4 py-3 text-success-600">{formatCurrency(summary.income)}</td>
                <td className="px-4 py-3 text-danger-600">{formatCurrency(summary.expenses)}</td>
                <td className={cn(
                  'px-4 py-3',
                  summary.profit >= 0 ? 'text-success-600' : 'text-danger-600'
                )}>
                  {formatCurrency(summary.profit)}
                </td>
                <td className="px-4 py-3">
                  {summary.income > 0 ? `${((summary.profit / summary.income) * 100).toFixed(1)}%` : '-'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}
