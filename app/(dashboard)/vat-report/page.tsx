'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { formatCurrency, hebrewMonths, cn } from '@/lib/utils'
import { Download, FileText, TrendingUp, TrendingDown, Calculator } from 'lucide-react'

export default function VatReportPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [reportPeriod, setReportPeriod] = useState<'monthly' | 'bimonthly'>('monthly')
  
  const [vatData, setVatData] = useState({
    // הכנסות
    income_before_vat: 0,
    income_vat: 0,
    income_total: 0,
    income_count: 0,
    // הוצאות
    expense_before_vat: 0,
    expense_vat: 0,
    expense_vat_deductible: 0,
    expense_total: 0,
    expense_count: 0,
    // סיכום
    vat_to_pay: 0,
  })

  useEffect(() => {
    loadData()
  }, [selectedYear, selectedMonth, reportPeriod])

  const loadData = async () => {
    setLoading(true)
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

      // חישוב תקופת הדוח
      let startMonth = selectedMonth
      let endMonth = selectedMonth
      
      if (reportPeriod === 'bimonthly') {
        // דו-חודשי: ינואר-פברואר, מרץ-אפריל וכו'
        startMonth = selectedMonth % 2 === 0 ? selectedMonth - 1 : selectedMonth
        endMonth = startMonth + 1
      }

      const startDate = `${selectedYear}-${String(startMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, endMonth, 0).toISOString().split('T')[0]

      // טעינת הכנסות
      const { data: incomeData } = await supabase
        .from('income')
        .select('amount, amount_before_vat, vat_amount, vat_exempt')
        .eq('company_id', profile.company_id)
        .gte('date', startDate)
        .lte('date', endDate)

      // טעינת הוצאות
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount, amount_before_vat, vat_amount, vat_exempt, vat_deductible')
        .eq('company_id', profile.company_id)
        .gte('date', startDate)
        .lte('date', endDate)

      // חישוב סיכומים
      const incomeBeforeVat = incomeData?.reduce((sum, i) => sum + Number(i.amount_before_vat || i.amount), 0) || 0
      const incomeVat = incomeData?.reduce((sum, i) => sum + Number(i.vat_amount || 0), 0) || 0
      const incomeTotal = incomeData?.reduce((sum, i) => sum + Number(i.amount), 0) || 0

      const expenseBeforeVat = expensesData?.reduce((sum, e) => sum + Number(e.amount_before_vat || e.amount), 0) || 0
      const expenseVat = expensesData?.reduce((sum, e) => sum + Number(e.vat_amount || 0), 0) || 0
      const expenseVatDeductible = expensesData
        ?.filter(e => e.vat_deductible !== false && !e.vat_exempt)
        .reduce((sum, e) => sum + Number(e.vat_amount || 0), 0) || 0
      const expenseTotal = expensesData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0

      const vatToPay = incomeVat - expenseVatDeductible

      setVatData({
        income_before_vat: incomeBeforeVat,
        income_vat: incomeVat,
        income_total: incomeTotal,
        income_count: incomeData?.length || 0,
        expense_before_vat: expenseBeforeVat,
        expense_vat: expenseVat,
        expense_vat_deductible: expenseVatDeductible,
        expense_total: expenseTotal,
        expense_count: expensesData?.length || 0,
        vat_to_pay: vatToPay,
      })

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPeriodLabel = () => {
    if (reportPeriod === 'bimonthly') {
      const startMonth = selectedMonth % 2 === 0 ? selectedMonth - 1 : selectedMonth
      return `${hebrewMonths[startMonth - 1]} - ${hebrewMonths[startMonth]} ${selectedYear}`
    }
    return `${hebrewMonths[selectedMonth - 1]} ${selectedYear}`
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
        title="דוח מע״מ"
        description="סיכום מע״מ לתקופת הדיווח"
        actions={
          <Button variant="outline">
            <Download className="w-4 h-4" />
            ייצוא לאקסל
          </Button>
        }
      />

      {/* Period Selection */}
      <Card padding="md">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700">תקופת דיווח:</span>
          <Select
            options={[
              { value: 'monthly', label: 'חודשי' },
              { value: 'bimonthly', label: 'דו-חודשי' },
            ]}
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value as any)}
          />
          <Select
            options={hebrewMonths.map((name, index) => ({
              value: String(index + 1),
              label: name,
            }))}
            value={String(selectedMonth)}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          />
          <Select
            options={[
              { value: String(currentDate.getFullYear() - 1), label: String(currentDate.getFullYear() - 1) },
              { value: String(currentDate.getFullYear()), label: String(currentDate.getFullYear()) },
            ]}
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          />
        </div>
      </Card>

      {/* Period Header */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-center">
        <p className="text-sm text-primary-600">תקופת דיווח</p>
        <p className="text-2xl font-bold text-primary-800">{getPeriodLabel()}</p>
      </div>

      {/* VAT Summary - Main Card */}
      <Card className="border-2 border-primary-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="w-6 h-6 text-primary-600" />
            <CardTitle>סיכום מע״מ לתשלום / החזר</CardTitle>
          </div>
        </CardHeader>
        <div className="text-center py-6">
          <p className={cn(
            'text-5xl font-bold',
            vatData.vat_to_pay >= 0 ? 'text-danger-600' : 'text-success-600'
          )}>
            {formatCurrency(Math.abs(vatData.vat_to_pay))}
          </p>
          <p className={cn(
            'text-lg mt-2',
            vatData.vat_to_pay >= 0 ? 'text-danger-600' : 'text-success-600'
          )}>
            {vatData.vat_to_pay >= 0 ? 'לתשלום' : 'להחזר'}
          </p>
        </div>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income VAT */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success-600" />
              <CardTitle>מע״מ עסקאות (הכנסות)</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">מספר חשבוניות</span>
              <span className="font-medium">{vatData.income_count}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">סה״כ לפני מע״מ</span>
              <span className="font-medium">{formatCurrency(vatData.income_before_vat)}</span>
            </div>
            <div className="flex justify-between py-2 border-b bg-success-50 px-2 rounded">
              <span className="text-success-700 font-medium">מע״מ עסקאות</span>
              <span className="font-bold text-success-700">{formatCurrency(vatData.income_vat)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">סה״כ כולל מע״מ</span>
              <span className="font-medium">{formatCurrency(vatData.income_total)}</span>
            </div>
          </div>
        </Card>

        {/* Expense VAT */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-danger-600" />
              <CardTitle>מע״מ תשומות (הוצאות)</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">מספר חשבוניות</span>
              <span className="font-medium">{vatData.expense_count}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">סה״כ לפני מע״מ</span>
              <span className="font-medium">{formatCurrency(vatData.expense_before_vat)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">מע״מ כולל</span>
              <span className="font-medium">{formatCurrency(vatData.expense_vat)}</span>
            </div>
            <div className="flex justify-between py-2 bg-blue-50 px-2 rounded">
              <span className="text-blue-700 font-medium">מע״מ תשומות לקיזוז</span>
              <span className="font-bold text-blue-700">{formatCurrency(vatData.expense_vat_deductible)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">סה״כ כולל מע״מ</span>
              <span className="font-medium">{formatCurrency(vatData.expense_total)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Calculation Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            <CardTitle>פירוט החישוב</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-3 px-4 text-gray-600">מע״מ עסקאות (הכנסות)</td>
                <td className="py-3 px-4 text-left font-medium text-success-600">
                  {formatCurrency(vatData.income_vat)}
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-3 px-4 text-gray-600">מע״מ תשומות לקיזוז (הוצאות)</td>
                <td className="py-3 px-4 text-left font-medium text-blue-600">
                  - {formatCurrency(vatData.expense_vat_deductible)}
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="py-4 px-4 font-bold text-gray-900">
                  {vatData.vat_to_pay >= 0 ? 'מע״מ לתשלום' : 'מע״מ להחזר'}
                </td>
                <td className={cn(
                  'py-4 px-4 text-left font-bold text-xl',
                  vatData.vat_to_pay >= 0 ? 'text-danger-600' : 'text-success-600'
                )}>
                  {formatCurrency(Math.abs(vatData.vat_to_pay))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Info Note */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>שימו לב:</strong> דוח זה מיועד לסיוע בחישוב בלבד. יש לוודא את הנתונים מול רואה החשבון לפני הגשת הדוח לרשויות.
        </p>
      </div>
    </div>
  )
}
